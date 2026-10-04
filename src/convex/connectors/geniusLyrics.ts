import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { getLrclibById, searchLrclib, type LrclibHit } from "./lrclibLyrics";

/* ═══════════════════════════════════════════════════════════════════════
   PAROLES — Genius via RapidAPI (clés lues UNIQUEMENT côté serveur)

   Env (noms exacts de ce déploiement) :
     RAPIDAPI_KEY          → clé RapidAPI
     RAPIDAPI_GENIUS_HOST  → hôte du connecteur Genius (ex. genius.p.rapidapi.com)
     GENIUS_KEY            → repli : API officielle Genius (métadonnées)

   Endpoints : /search?q=… → id de chanson → /songs/{id} (paroles).
   Cache 24 h par (query|id) dans ovSourceCache.
   Clé absente / erreur / quota → repli silencieux + log, JAMAIS de crash.

   Cascade : RapidAPI → API officielle (GENIUS_KEY) → lrclib.net (sans clé).
   lrclib est le seul étage qui fournit des paroles synchronisées (LRC) et
   il fonctionne sans abonnement : les fiches de cet étage portent un id
   négatif (les ids Genius sont toujours positifs) et `source: "lrclib"`.
   ═══════════════════════════════════════════════════════════════════════ */

export type GeniusHit = {
  id: number;
  title: string;
  artist: string;
  url?: string;
  thumbnail?: string;
  /** Paroles brutes quand le connecteur en expose (sinon lien officiel). */
  lyrics?: string;
  /** Paroles synchronisées au format LRC (lrclib) → segments horodatés. */
  synced?: string;
  /** Durée du titre en secondes (lrclib) : départage les versions homonymes. */
  duration?: number;
  /** Source réellement utilisée pour ce hit. */
  source?: "genius" | "lrclib";
};

type GeniusSearchApi = {
  response?: {
    hits?: Array<{
      result?: {
        id?: number;
        full_title?: string;
        title?: string;
        url?: string;
        primary_artist?: { name?: string };
        song_art_image_thumbnail_url?: string;
        instrumental?: boolean;
      };
    }>;
  };
};

type GeniusSongApi = {
  response?: {
    song?: {
      id?: number;
      title?: string;
      url?: string;
      lyrics_state?: string;
      instrumental?: boolean;
      description?: { plain?: string };
      primary_artist?: { name?: string };
      song_art_image_url?: string;
    };
  };
};

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Hôte RapidAPI par défaut : le connecteur « Genius Song Lyrics » expose
 * exactement /search?q= puis /songs/{id}. RAPIDAPI_GENIUS_HOST le surcharge
 * quand un autre abonnement RapidAPI est utilisé.
 */
const DEFAULT_RAPIDAPI_GENIUS_HOST = "genius-song-lyrics1.p.rapidapi.com";

function rapidApiConfig(): { key: string; host: string } | null {
  const key = process.env.RAPIDAPI_KEY?.trim();
  if (!key) return null;
  const host =
    process.env.RAPIDAPI_GENIUS_HOST?.trim() || DEFAULT_RAPIDAPI_GENIUS_HOST;
  return { key, host };
}

/**
 * API officielle Genius : en-tête Bearer, puis repli `?access_token=`
 * (les deux modes sont acceptés par l'API). null ⇒ inaccessible.
 */
async function geniusOfficialGet<T>(path: string, token: string): Promise<T | null> {
  const bearer = await safeGetJson<T>(`https://api.genius.com${path}`, {
    Authorization: `Bearer ${token}`,
  });
  if (bearer) return bearer;
  const sep = path.includes("?") ? "&" : "?";
  return await safeGetJson<T>(
    `https://api.genius.com${path}${sep}access_token=${encodeURIComponent(token)}`,
    {},
  );
}

function officialGeniusKey(): string | null {
  return process.env.GENIUS_KEY?.trim() || null;
}

/** GET JSON avec timeout court — un échec renvoie null, jamais une exception. */
async function safeGetJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[geniusLyrics] HTTP ${res.status} — repli/cascade`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`[geniusLyrics] réseau indisponible — repli/cascade :`, error instanceof Error ? error.message : error);
    return null;
  }
}

/* ── Cache 24 h (lecture requête + écriture mutation, borne 20 Ko) ──── */

export const lyricsCacheGet = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("ovSourceCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (!row) return null;
    if (Date.now() - row.createdAt > TTL_MS) return null;
    return row.payload.join("\n");
  },
});

export const lyricsCachePut = internalMutation({
  args: { cacheKey: v.string(), payload: v.array(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ovSourceCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { payload: args.payload, createdAt: Date.now() });
      return;
    }
    await ctx.db.insert("ovSourceCache", {
      cacheKey: args.cacheKey,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

async function readCache(ctx: { runQuery: Function }, cacheKey: string): Promise<GeniusHit[] | null> {
  try {
    const raw = await ctx.runQuery(
      internal.connectors.geniusLyrics.lyricsCacheGet,
      { cacheKey },
    );
    if (!raw) return null;
    return JSON.parse(raw) as GeniusHit[];
  } catch {
    return null;
  }
}

/** Le cache ne garde que les métadonnées : le texte repasse par fetchLyricsById. */
function cacheableHit(hit: GeniusHit): GeniusHit {
  return {
    id: hit.id,
    title: hit.title,
    artist: hit.artist,
    url: hit.url,
    thumbnail: hit.thumbnail,
    duration: hit.duration,
    source: hit.source,
  };
}

async function writeCache(ctx: { runMutation: Function }, cacheKey: string, hits: GeniusHit[]): Promise<void> {
  try {
    let payload = "";
    for (const hit of hits.map(cacheableHit)) {
      const chunk = JSON.stringify(hit) + "\n";
      if (payload.length + chunk.length > 20_000) break;
      payload += chunk;
    }
    if (!payload) return;
    await ctx.runMutation(internal.connectors.geniusLyrics.lyricsCachePut, {
      cacheKey,
      payload: payload.split("\n").filter(Boolean),
    });
  } catch {
    // Le cache ne doit jamais faire échouer une recherche.
  }
}

/* ── Repli lrclib.net (sans clé) ─────────────────────────────────────── */

/** Fiches lrclib → hits : id négatif (routage) et `source: "lrclib"`. */
function lrclibToHits(records: LrclibHit[]): GeniusHit[] {
  return records.map((record) => ({
    id: -record.id,
    title: record.title,
    artist: record.artist,
    lyrics: record.instrumental ? undefined : record.plain,
    synced: record.instrumental ? undefined : record.synced,
    duration: record.duration,
    source: "lrclib" as const,
  }));
}

/**
 * Filtres structurés transmis à lrclib : le titre et l'artiste séparés
 * donnent des candidats bien plus justes que la requête en texte libre.
 */
export type LyricsQueryOpts = { trackName?: string; artistName?: string };

/** Recherche lrclib mise en cache 24 h (métadonnées seulement). */
export async function searchLrclibHits(
  ctx: { runQuery: Function; runMutation: Function },
  q: string,
  opts?: LyricsQueryOpts,
): Promise<GeniusHit[]> {
  const cacheKey = `genius|lrclib|search|${[opts?.artistName, opts?.trackName, q]
    .map((part) => (part ?? "").toLowerCase().trim())
    .join("|")}`;
  const cached = await readCache(ctx, cacheKey);
  if (cached) return cached;
  const hits = lrclibToHits(await searchLrclib(q, opts));
  if (hits.length > 0) await writeCache(ctx, cacheKey, hits);
  return hits;
}

/* ── Recherche + paroles ─────────────────────────────────────────────── */

/**
 * Recherche « artiste titre » → hits Genius. RapidAPI d'abord (search),
 * API officielle (GENIUS_KEY) en repli. null ⇒ rien trouvé / non configuré.
 */
export async function searchGenius(
  ctx: { runQuery: Function; runMutation: Function },
  q: string,
  opts?: LyricsQueryOpts,
): Promise<GeniusHit[] | null> {
  const cacheKey = `genius|search|${q.toLowerCase().trim()}`;
  const cached = await readCache(ctx, cacheKey);
  if (cached) return cached;

  const rapid = rapidApiConfig();
  if (rapid) {
    const data = await safeGetJson<GeniusSearchApi>(
      `https://${rapid.host}/search?q=${encodeURIComponent(q)}`,
      { "X-RapidAPI-Key": rapid.key, "X-RapidAPI-Host": rapid.host },
    );
    const hits: GeniusHit[] = (data?.response?.hits ?? [])
      .map((h) => h.result)
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.id))
      .map((r) => ({
        id: r.id!,
        title: r.title ?? r.full_title ?? "Sans titre",
        artist: r.primary_artist?.name ?? "",
        url: r.url,
        thumbnail: r.song_art_image_thumbnail_url,
        source: "genius" as const,
      }));
    if (hits.length > 0) {
      await writeCache(ctx, cacheKey, hits);
      return hits;
    }
  }

  const official = officialGeniusKey();
  if (official) {
    const data = await geniusOfficialGet<GeniusSearchApi>(
      `/search?q=${encodeURIComponent(q)}`,
      official,
    );
    const hits: GeniusHit[] = (data?.response?.hits ?? [])
      .map((h) => h.result)
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.id))
      .map((r) => ({
        id: r.id!,
        title: r.title ?? r.full_title ?? "Sans titre",
        artist: r.primary_artist?.name ?? "",
        url: r.url,
        thumbnail: r.song_art_image_thumbnail_url,
        source: "genius" as const,
      }));
    if (hits.length > 0) {
      await writeCache(ctx, cacheKey, hits);
      return hits;
    }
  }

  // Repli sans clé : lrclib (texte brut + paroles synchronisées LRC).
  const lrclibHits = await searchLrclibHits(ctx, q, opts);
  if (lrclibHits.length > 0) {
    await writeCache(ctx, cacheKey, lrclibHits);
    return lrclibHits;
  }

  if (!rapid && !official) {
    console.warn("[geniusLyrics] aucune clé Genius configurée (RAPIDAPI_KEY + RAPIDAPI_GENIUS_HOST ou GENIUS_KEY)");
  }
  return null;
}

/* ── Extraction tolérante (les hôtes RapidAPI varient) ─────────────── */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Première chaîne « lyrics » / « text » exploitable de la réponse. */
function deepFindLyrics(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value == null || typeof value === "string") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindLyrics(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of ["lyrics", "text"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 30) {
      return candidate;
    }
  }
  for (const nested of Object.values(record)) {
    const found = deepFindLyrics(nested, depth + 1);
    if (found) return found;
  }
  return undefined;
}

type SongMeta = {
  title?: string;
  artist?: string;
  url?: string;
  thumbnail?: string;
  instrumental?: boolean;
};

/** Métadonnées de chanson, où que le connecteur les place. */
function extractSongMeta(data: unknown): SongMeta | undefined {
  const root = asRecord(data);
  if (!root) return undefined;
  const song =
    asRecord(asRecord(root.response)?.song) ?? asRecord(root.song) ?? root;
  const artist = asRecord(song.primary_artist);
  const title = song.title ?? song.full_title;
  const url = song.url;
  if (typeof title !== "string" && typeof url !== "string") return undefined;
  return {
    title: typeof title === "string" ? title : undefined,
    artist: typeof artist?.name === "string" ? (artist.name as string) : undefined,
    url: typeof url === "string" ? url : undefined,
    thumbnail:
      typeof song.song_art_image_url === "string"
        ? (song.song_art_image_url as string)
        : undefined,
    instrumental: song.instrumental === true,
  };
}

/**
 * Paroles d'une chanson par id : endpoints « Song Lyrics » du connecteur
 * RapidAPI (métadonnées puis texte brut, plusieurs formes d'URL essayées),
 * API officielle Genius en repli (métadonnées + lien, le texte n'y est pas
 * exposé).
 */
export async function fetchLyricsById(ctx: { runQuery: Function; runMutation: Function }, id: number): Promise<GeniusHit | null> {
  const cacheKey = `genius|song|${id}`;
  const cached = await readCache(ctx, cacheKey);
  if (cached && cached[0]) return cached[0];

  // Id négatif = fiche lrclib (voir lrclibToHits). Les ids Genius sont
  // toujours positifs : la convention évite d'ajouter un paramètre.
  if (id < 0) {
    const record = await getLrclibById(-id);
    if (!record) return null;
    const hit = lrclibToHits([record])[0];
    if (!hit || (!hit.lyrics && !hit.synced)) return null;
    await writeCache(ctx, cacheKey, [hit]);
    return hit;
  }

  const rapid = rapidApiConfig();
  if (rapid) {
    const headers = { "X-RapidAPI-Key": rapid.key, "X-RapidAPI-Host": rapid.host };
    // Plusieurs formes d'URL : les connecteurs RapidAPI « Genius » n'exposent
    // pas tous le même chemin pour le texte des paroles.
    const candidates = [
      `https://${rapid.host}/songs/${id}`,
      `https://${rapid.host}/songs/${id}?text_format=plain`,
      `https://${rapid.host}/lyrics/${id}`,
    ];
    let meta: SongMeta | undefined;
    let lyrics = "";
    for (const url of candidates) {
      const data = await safeGetJson<unknown>(url, headers);
      if (!data) continue;
      meta = meta ?? extractSongMeta(data);
      lyrics = lyrics || (deepFindLyrics(data) ?? "").trim();
      if (meta && lyrics) break;
    }
    if (meta) {
      // Dernier repli : la description officielle, toujours exposée.
      if (!lyrics) {
        const desc = await safeGetJson<GeniusSongApi>(
          `https://${rapid.host}/songs/${id}`,
          headers,
        );
        lyrics = (desc?.response?.song?.description?.plain ?? "").trim();
      }
      const hit: GeniusHit = {
        id,
        title: meta.title ?? "Sans titre",
        artist: meta.artist ?? "",
        url: meta.url,
        thumbnail: meta.thumbnail,
        source: "genius",
        lyrics: meta.instrumental ? undefined : lyrics || undefined,
      };
      await writeCache(ctx, cacheKey, [hit]);
      return hit;
    }
  }

  const official = officialGeniusKey();
  if (official) {
    const meta = await geniusOfficialGet<GeniusSongApi>(`/songs/${id}`, official);
    const song = meta?.response?.song;
    if (song) {
      const hit: GeniusHit = {
        id,
        title: song.title ?? "Sans titre",
        artist: song.primary_artist?.name ?? "",
        url: song.url,
        thumbnail: song.song_art_image_url,
        source: "genius",
        // L'API officielle n'expose pas le texte : on fournit le lien.
        lyrics: undefined,
      };
      await writeCache(ctx, cacheKey, [hit]);
      return hit;
    }
  }

  return null;
}

/** Action publique : recherche côté fiche (métadonnées + lien officiel). */
export const search = action({
  args: {
    q: v.string(),
    /** Filtres structurés optionnels (repli lrclib plus précis). */
    title: v.optional(v.string()),
    artist: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; hits: GeniusHit[]; reason?: string; source?: string }> => {
    const hits = await searchGenius(ctx, args.q, {
      trackName: args.title,
      artistName: args.artist,
    });
    if (!hits) return { ok: false, hits: [], reason: "genius_unavailable" };
    return { ok: true, hits, ...(hits[0]?.source ? { source: hits[0].source } : {}) };
  },
});
