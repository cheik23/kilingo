"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { runSharedPipeline, transcribeAudio } from "./youtubePipeline";
import {
  fetchLyricsById,
  searchGenius,
  searchLrclibHits,
  type GeniusHit,
} from "./connectors/geniusLyrics";
import type { Id } from "./_generated/dataModel";

/* ═══════════════════════════════════════════════════════════════════
   Paroles & radio & sous-titres — lyrics.ovh supprimé (service mort).
   L'analyse d'un morceau transcrit l'extrait audio iTunes (toujours
   dispo, 30 s) via le moteur ASR (asrEngine) ; les paroles viennent du
   connecteur Genius (connectors/geniusLyrics : RapidAPI → API officielle
   → repli lrclib.net sans clé, cache 24 h) — bonus silencieux sinon.
   ═══════════════════════════════════════════════════════════════════ */

const languageValidator = v.union(
  v.literal("en"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("ar"),
  v.literal("ru"),
);

const targetLanguageValidator = v.union(
  v.literal("en"),
  v.literal("fr"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("ar"),
  v.literal("ru"),
);

/* ── (k) Analyse d'un morceau : transcription de l'extrait + bonus ── */

/** Résultat de la recherche de paroles (connecteur Genius). */
export type LyricsResult = {
  ok: boolean;
  reason?: string;
  title: string;
  artist: string;
  /** Page officielle Genius (toujours fournie quand un hit existe). */
  url?: string;
  /** Paroles nettoyées (en-têtes de section retirés). Vide si indisponible. */
  text: string;
  /** Segments synchronisés — uniquement quand la source les expose (LRC). */
  segments?: { start: number; text: string }[];
  /** Source des paroles (Genius, ou repli lrclib sans clé). */
  source?: "genius" | "lrclib";
};

type AnalyzeTrackResult = {
  mediaId: Id<"userMedia">;
  /** Paroles complètes, ou URL Genius quand seul le lien est disponible. */
  geniusLyrics?: string;
  geniusAnnotations?: number;
  geniusUrl?: string;
  geniusSegments?: { start: number; text: string }[];
};

/* ── Paroles : normalisation, sélection du meilleur hit, LRC ─────── */

/** « Beyoncé feat. JAY-Z » → « beyonce feat jay z » (comparaison tolérante). */
function normKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Marqueurs de version : une entrée « remix / live / cover… » ne doit pas
 * rafler un titre homonyme quand la requête ne demande pas cette version.
 */
const VERSION_MARKER =
  /\b(remix|rmx|remaster(ed)?|live|instrumental|karaoke|cover|sped ?up|slowed|reverb|8d|acoustic|parody|tribute|demo|session|edit)\b/;

/** Artiste identique (4) > artiste demandé inclus (3) > l'inverse (2). */
function artistScore(hitArtist: string, wanted: string): number {
  if (!hitArtist || !wanted) return 0;
  if (hitArtist === wanted) return 4;
  if (` ${hitArtist} `.includes(` ${wanted} `)) return 3;
  if (` ${wanted} `.includes(` ${hitArtist} `)) return 2;
  return 0;
}

/**
 * Titre : identique (4) > même titre avec un seul mot de version (3) >
 * simple contenance (1) — « Hello » ne doit pas primer « HELLO HELLO HELLO ».
 */
function titleScore(hitTitle: string, wanted: string): number {
  if (!hitTitle || !wanted) return 0;
  if (hitTitle === wanted) return 4;
  if (hitTitle.startsWith(wanted)) {
    const extra = hitTitle.slice(wanted.length).split(" ").filter(Boolean).length;
    if (extra <= 1) return 3;
  }
  if (hitTitle.includes(wanted) || wanted.includes(hitTitle)) return 1;
  return 0;
}

/**
 * Score d'un candidat : titre + artiste, durée (radio edit vs album vs live),
 * pénalités de version, texte déjà disponible.
 */
function matchScore(
  hit: GeniusHit,
  title: string,
  artist: string,
  durationSec?: number,
): number {
  const ht = normKey(hit.title);
  const t = normKey(title);
  const wantedArtist = normKey(artist);
  let score = titleScore(ht, t);
  score += artistScore(normKey(hit.artist), wantedArtist);
  if (!VERSION_MARKER.test(t) && VERSION_MARKER.test(ht)) score -= 3;
  // Durée connue des deux côtés : la version exacte passe devant les autres.
  // Signal d'appoint quand l'artiste est connu — il ne doit pas damer le pion
  // à l'artiste ; sans artiste, il devient le seul discriminant fiable.
  if (durationSec && durationSec > 0 && hit.duration) {
    const delta = Math.abs(hit.duration - durationSec);
    if (delta <= 3) score += 2;
    else if (delta <= 8) score += 1;
    else if (delta > 25 && !wantedArtist) score -= 3;
  }
  // Un candidat déjà porteur de texte évite un aller-retour réseau.
  if (hit.lyrics || hit.synced) score += 1;
  return score;
}

/** Nombre de candidats réellement résolus — garde la latence bornée. */
const MAX_CANDIDATES = 3;

/** Candidats classés du plus probable au moins probable (ordre stable). */
function rankHits(
  hits: GeniusHit[],
  title: string,
  artist: string,
  durationSec?: number,
): GeniusHit[] {
  return hits
    .map((hit, index) => ({
      hit,
      score: matchScore(hit, title, artist, durationSec),
      index,
    }))
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .map((entry) => entry.hit);
}

/** Ligne « [01:23.45] texte » → { start, text }. */
const TIMED_LINE = /^\s*\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.+)$/;

/** Segments synchronisés quand la source expose des horodatages (LRC). */
function parseTimedLyrics(
  raw: string,
): { start: number; text: string }[] | undefined {
  const out: { start: number; text: string }[] = [];
  for (const line of raw.split("\n")) {
    const m = TIMED_LINE.exec(line);
    if (!m) continue;
    const text = m[4].trim();
    if (!text) continue;
    const fraction = m[3] ? Number(`0.${m[3]}`) : 0;
    out.push({ start: Number(m[1]) * 60 + Number(m[2]) + fraction, text });
  }
  return out.length >= 3 ? out : undefined;
}

/** Retire les en-têtes de section ([Verse 1], [Chorus]…) du texte brut. */
function cleanLyrics(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\[[^\]]*\]$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Préfixe d'horodatage LRC « [01:23.45] ». */
const TIMED_PREFIX = /^\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/;

/** Texte nu d'un LRC : « [01:23.45] texte » → « texte ». */
function stripTimed(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(TIMED_PREFIX, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/** Paroles exploitables d'un jeu de candidats (métadonnées + texte). */
type LyricsCandidate = {
  title: string;
  artist: string;
  url?: string;
  source?: "genius" | "lrclib";
  plain: string;
  synced: string;
};

/** Métadonnées + texte d'un candidat (le détail prime, le hit sert de repli). */
function candidateFrom(chosen: GeniusHit, hit: GeniusHit): LyricsCandidate {
  return {
    title: chosen.title,
    artist: chosen.artist,
    url: chosen.url ?? hit.url,
    source: chosen.source ?? hit.source,
    plain: (chosen.lyrics ?? hit.lyrics ?? "").trim(),
    synced: (chosen.synced ?? hit.synced ?? "").trim(),
  };
}

/**
 * Candidats classés, essayés dans l'ordre jusqu'au premier qui fournit du
 * texte : plusieurs titres homonymes (reprises, autres artistes, remixes)
 * cohabitent dans les sources, le score seul ne suffit pas. La durée réelle
 * du morceau, quand elle est connue, tranche entre les versions. Renvoie un
 * « lien seulement » quand aucune version n'expose de paroles.
 */
async function lyricsFromHits(
  ctx: { runQuery: Function; runMutation: Function },
  hits: GeniusHit[] | null,
  title: string,
  artist: string,
  durationSec?: number,
): Promise<LyricsCandidate | null> {
  if (!hits || hits.length === 0) return null;
  let withoutText: LyricsCandidate | null = null;
  for (const hit of rankHits(hits, title, artist, durationSec).slice(
    0,
    MAX_CANDIDATES,
  )) {
    const inline = candidateFrom(hit, hit);
    if (inline.plain || inline.synced) return inline;
    const detail = await fetchLyricsById(ctx, hit.id);
    const candidate = detail ? candidateFrom(detail, hit) : inline;
    if (candidate.plain || candidate.synced) return candidate;
    withoutText ??= candidate;
  }
  return withoutText;
}

/**
 * Paroles d'un titre : Genius (RapidAPI → API officielle), puis repli
 * lrclib.net sans clé — seul étage qui expose des paroles synchronisées.
 * Jamais d'exception : `ok: false` + `reason` (no_hit / lyrics_unavailable)
 * et le meilleur lien disponible quand aucun texte n'existe.
 */
async function lyricsRemote(
  ctx: { runQuery: Function; runMutation: Function },
  args: { title: string; artist?: string; query?: string; durationSec?: number },
): Promise<LyricsResult> {
  const query =
    args.query?.trim() || [args.artist, args.title].filter(Boolean).join(" ").trim();
  const base: LyricsResult = {
    ok: false,
    title: args.title,
    artist: args.artist ?? "",
    text: "",
  };
  if (!query) return { ...base, reason: "empty_query" };

  // Filtres structurés (artiste + titre) : le repli lrclib trie bien mieux
  // que le texte libre quand plusieurs morceaux portent le même nom.
  const opts = { trackName: args.title, artistName: args.artist };
  const first = await lyricsFromHits(
    ctx,
    await searchGenius(ctx, query, opts),
    args.title,
    args.artist ?? "",
    args.durationSec,
  );
  let resolved = first && (first.plain || first.synced) ? first : null;

  // Genius n'expose souvent que des métadonnées : repli lrclib explicite.
  if (!resolved) {
    const fallback = await lyricsFromHits(
      ctx,
      await searchLrclibHits(ctx, query, opts),
      args.title,
      args.artist ?? "",
      args.durationSec,
    );
    if (fallback && (fallback.plain || fallback.synced)) resolved = fallback;
    else {
      const link = first ?? fallback;
      if (!link) return { ...base, reason: "no_hit" };
      return {
        ...base,
        title: link.title,
        artist: link.artist,
        url: link.url,
        source: link.source,
        reason: "lyrics_unavailable",
      };
    }
  }

  const rawPlain = resolved.plain;
  const rawSynced = resolved.synced;
  const text = cleanLyrics(rawPlain || stripTimed(rawSynced)) || rawPlain;
  const segments = parseTimedLyrics(rawSynced || rawPlain);
  return {
    ok: true,
    title: resolved.title,
    artist: resolved.artist,
    url: resolved.url,
    source: resolved.source,
    text,
    ...(segments ? { segments } : {}),
  };
}

export const analyzeTrack = action({
  args: {
    trackName: v.string(),
    artistName: v.string(),
    previewUrl: v.optional(v.string()),
    trackViewUrl: v.optional(v.string()),
    /** Durée réelle du morceau (s) : départage les versions homonymes. */
    durationSec: v.optional(v.number()),
    language: languageValidator,
    targetLanguage: v.optional(targetLanguageValidator),
  },
  handler: async (ctx, args): Promise<AnalyzeTrackResult> => {
    const title = `${args.artistName} — ${args.trackName}`;

    // ── Bonus paroles (connecteur Genius, silencieux si clé absente) ─
    let geniusLyrics: string | undefined;
    let geniusAnnotations: number | undefined;
    let geniusUrl: string | undefined;
    let geniusSegments: { start: number; text: string }[] | undefined;
    const bonus = await lyricsRemote(ctx, {
      title: args.trackName,
      artist: args.artistName,
      durationSec: args.durationSec,
    });
    geniusUrl = bonus.url;
    if (bonus.ok) {
      geniusLyrics = bonus.text;
      geniusAnnotations = bonus.segments?.length;
      geniusSegments = bonus.segments;
    } else if (bonus.url) {
      // Pas de texte exploitable : le lien officiel reste utile.
      geniusLyrics = bonus.url;
    }

    // ── ÉTAPE 1 : transcription de l'extrait audio (toujours dispo) ─
    if (!args.previewUrl) {
      throw new Error(
        "Analyse vocale indisponible pour ce titre (pas d'extrait audio fourni).",
      );
    }
    const audioRes = await fetch(args.previewUrl, {
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (!audioRes || !audioRes.ok) {
      throw new Error(
        "Extrait audio injoignable. Réessaie dans un instant ou choisis un autre titre.",
      );
    }
    const buf = Buffer.from(await audioRes.arrayBuffer());
    if (buf.length === 0) {
      throw new Error(
        "Analyse vocale indisponible pour ce titre (pas d'extrait audio fourni).",
      );
    }

    const { text, segments, lang } = await transcribeAudio(buf, "preview.m4a");

    const mediaId = await ctx.runMutation(api.media.createHubMedia, {
      language: args.language,
      title,
      sourceName: args.trackViewUrl ?? args.previewUrl,
      mediaType: "music",
      targetLanguage: args.targetLanguage,
    });
    await runSharedPipeline(ctx, {
      mediaId,
      language: args.language,
      targetLanguage: args.targetLanguage,
      sourceLangOverride: lang,
      text,
      segments,
      transcriptSource: "itunes_preview",
    });
    return {
      mediaId,
      ...(geniusLyrics !== undefined ? { geniusLyrics } : {}),
      ...(geniusAnnotations !== undefined ? { geniusAnnotations } : {}),
      ...(geniusUrl !== undefined ? { geniusUrl } : {}),
      ...(geniusSegments !== undefined ? { geniusSegments } : {}),
    };
  },
});

/* ── (k-bis) Paroles à la demande (fiche musique) ─────────────────── */

/**
 * Paroles d'un titre pour l'onglet « Paroles » de la MediaRoom. Renvoie
 * `ok: true` + texte quand le connecteur Genius expose les paroles, sinon
 * `ok: false` + `reason` + lien officiel — jamais d'erreur affichée.
 */
export const lyricsFor = action({
  args: {
    title: v.string(),
    artist: v.optional(v.string()),
    query: v.optional(v.string()),
    /** Durée réelle du morceau (s) : départage les versions homonymes. */
    durationSec: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<LyricsResult> => lyricsRemote(ctx, args),
});

/* ── (l) Radio live : radio-browser (keyless) ─────────────────────── */

export const radioSearch = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return [];
    try {
      const res = await fetch(
        `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(q)}&limit=10&order=clickcount&reverse=true`,
        { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "KILINGO/1.0" } },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as Array<{
        name?: string;
        url_resolved?: string;
        country?: string;
      }>;
      return data
        .filter((s) => s.name && s.url_resolved)
        .map((s) => ({
          name: s.name as string,
          url: s.url_resolved as string,
          country: s.country ?? "",
        }));
    } catch {
      // Radio keyless best-effort — jamais d'erreur bloquante.
      return [];
    }
  },
  returns: v.array(
    v.object({ name: v.string(), url: v.string(), country: v.string() }),
  ),
});

/* ── (m) Parse .srt / .vtt (regex blocs temps) → segments ─────────── */

function timeToSeconds(h: string, m: string, s: string, ms: string): number {
  return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;
}

export const parseSubtitlesFile = action({
  args: { content: v.string() },
  handler: async (_ctx, args) => {
    const text = args.content.replace(/\r\n/g, "\n");
    const out: Array<{ start: number; end: number; text: string }> = [];
    const re =
      /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})\n([\s\S]*?)(?=\n\s*\n|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = timeToSeconds(m[1] ?? "0", m[2], m[3], m[4]);
      const end = timeToSeconds(m[5] ?? "0", m[6], m[7], m[8]);
      const body = m[9]
        .split("\n")
        .map((l) => l.replace(/<[^>]+>/g, "").trim())
        .filter((l) => l && !/^\d+$/.test(l) && !l.startsWith("WEBVTT"))
        .join(" ")
        .trim();
      if (body) out.push({ start, end, text: body });
    }
    if (out.length === 0) {
      throw new Error(
        "Aucun sous-titre reconnu dans ce fichier. Vérifie qu'il s'agit bien d'un .srt ou .vtt.",
      );
    }
    return out;
  },
  returns: v.array(
    v.object({ start: v.number(), end: v.number(), text: v.string() }),
  ),
});
