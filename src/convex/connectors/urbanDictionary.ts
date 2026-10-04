"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

/* ═══════════════════════════════════════════════════════════════════════
   CONNECTEUR URBAN DICTIONARY — définitions crowd-sourcées pour les mots
   HORS base locale. Appel CÔTE SERVEUR (aucun CORS navigateur), cache 24 h
   dans ovSourceCache (clé « ud:v2:{word} »), timeout 8 s — tout échec ⇒
   null silencieux (jamais de crash).

   FILTRE QUALITÉ ADAPTATIF (2026) : l'API publique a retiré les votes
   (thumbs_up / thumbs_down renvoient 0 pour TOUTES les entrées). Quand des
   votes réels existent, on exige thumbs_up >= 10 ; sinon (toutes entrées à
   0 = votes indisponibles), on garde la meilleure entrée par heuristique
   de contenu (longueur, exemple présent, pas de spam "there are no
   definitions"). Le payload renvoie thumbsUp = null dans ce cas.
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_THUMBS_UP = 10;
const FETCH_TIMEOUT_MS = 8_000;

type UrbanPayload = {
  definition: string;
  example: string;
  /** null = votes indisponibles côté API (toutes entrées à 0). */
  thumbsUp: number | null;
  /** null = votes indisponibles côté API (toutes entrées à 0). */
  thumbsDown: number | null;
};

/** UD souligne le lexique avec des crochets : on rend le texte brut. */
function stripUdMarkup(s: string): string {
  return s
    .replace(/\[(.+?)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

type RawUdEntry = {
  definition?: unknown;
  example?: unknown;
  thumbs_up?: unknown;
  thumbs_down?: unknown;
};

function normalize(entry: RawUdEntry) {
  return {
    definition:
      typeof entry.definition === "string" ? stripUdMarkup(entry.definition) : "",
    example: typeof entry.example === "string" ? stripUdMarkup(entry.example) : "",
    up: typeof entry.thumbs_up === "number" ? entry.thumbs_up : 0,
    down: typeof entry.thumbs_down === "number" ? entry.thumbs_down : 0,
  };
}

function isSpam(def: string): boolean {
  const d = def.toLowerCase();
  return (
    d.length < 4 ||
    d.includes("there are no definitions") ||
    d.includes("hasn't been defined") ||
    d.startsWith("buy ") ||
    d === "yeet" // entrées-tautologies
  );
}

/** Heuristique de contenu : plus la définition est riche, meilleur le score. */
function contentScore(e: { definition: string; example: string }): number {
  const len = Math.min(e.definition.length, 400);
  return (e.example ? 100 : 0) + len;
}

async function fetchUrban(word: string): Promise<UrbanPayload | null> {
  const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { list?: RawUdEntry[] };
  const rows = (Array.isArray(data.list) ? data.list : []).map(normalize).filter(
    (e) => e.definition.length > 0 && !isSpam(e.definition),
  );
  if (rows.length === 0) return null;

  const votesAvailable = rows.some((e) => e.up > 0 || e.down > 0);
  if (votesAvailable) {
    // Votes réels : filtre qualité strict, meilleure entrée par (up − down).
    const best = rows
      .filter((e) => e.up >= MIN_THUMBS_UP)
      .sort((a, b) => b.up - b.down - (a.up - a.down))[0];
    if (!best) return null;
    return {
      definition: best.definition,
      example: best.example,
      thumbsUp: best.up,
      thumbsDown: best.down,
    };
  }

  // Votes indisponibles (API 2026) : meilleure entrée par heuristique de
  // contenu — l'API classe déjà les définitions par pertinence.
  const best = [...rows].sort((a, b) => contentScore(b) - contentScore(a))[0];
  return {
    definition: best.definition,
    example: best.example,
    thumbsUp: null,
    thumbsDown: null,
  };
}

export const searchUrban = action({
  args: { word: v.string() },
  handler: async (ctx, args): Promise<UrbanPayload | null> => {
    const word = args.word.trim().slice(0, 80);
    if (!word) return null;
    const cacheKey = `ud:v2:${word.toLowerCase()}`;

    // 1) Cache 24 h (retour string[] join → JSON.parse).
    try {
      const cached = await ctx.runQuery(internal.lyricsCache.cacheGetLyrics, { cacheKey });
      if (cached) {
        const parsed = JSON.parse(cached) as UrbanPayload | null;
        return parsed;
      }
    } catch {
      // Cache indisponible : on interroge l'API directement.
    }

    // 2) Appel réseau protégé — échec ⇒ null + warn (jamais de crash).
    try {
      const hit = await fetchUrban(word);
      try {
        await ctx.runMutation(internal.lyricsCache.cachePutLyrics, {
          cacheKey,
          payload: [JSON.stringify(hit)],
        });
      } catch {
        // Écriture de cache best-effort.
      }
      return hit;
    } catch (err) {
      console.warn("[urbanDictionary] échec silencieux:", err);
      return null;
    }
  },
  returns: v.union(
    v.null(),
    v.object({
      definition: v.string(),
      example: v.string(),
      thumbsUp: v.union(v.number(), v.null()),
      thumbsDown: v.union(v.number(), v.null()),
    }),
  ),
});
