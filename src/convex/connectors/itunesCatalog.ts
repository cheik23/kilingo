"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getJson } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   CATALOGUE ITUNES — recherche entity=album (métadonnées réelles + extraits
   officiels), fetched CÔTE SERVEUR (aucun CORS navigateur), cache 24 h dans
   ovSourceCache (clé « cat:… »). Aucune clé requise.
   trackTimeMillis → durationSec, previewUrl → extrait 30 s jouable,
   artworkUrl100 → 300x300 / 600x600bb.
   ═══════════════════════════════════════════════════════════════════════ */

type ItunesResult = {
  wrapperType?: string;
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
};

/** Formes uniformes consommées par l'UI (même contrat que deezerCatalog). */
export type ItunesCatalogTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  albumName: string;
  artworkUrl: string;
  previewUrl: string;
  trackViewUrl: string;
  durationSec: number;
  year: string;
  source: "itunes";
};
export type ItunesCatalogAlbum = {
  albumId: number;
  title: string;
  artistName: string;
  artworkUrl: string;
  year: string;
  source: "itunes";
  previewUrl?: string;
  trackName?: string;
  trackId?: number;
};

/* ── Cache 24 h (ovSourceCache via helpers lyricsCache) ───────────────── */

async function cacheGet(ctx: { runQuery: Function }, cacheKey: string): Promise<unknown | null> {
  try {
    const raw = (await ctx.runQuery(internal.lyricsCache.cacheGetLyrics, { cacheKey })) as
      | string
      | null;
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function cachePut(
  ctx: { runMutation: Function },
  cacheKey: string,
  value: unknown,
): Promise<void> {
  try {
    await ctx.runMutation(internal.lyricsCache.cachePutLyrics, {
      cacheKey,
      payload: [JSON.stringify(value)],
    });
  } catch {
    /* best-effort */
  }
}

/* ── Recherche albums (+ titres, extraits inclus) ────────────────────── */

/**
 * `bunx convex run connectors/itunesCatalog:itunesSearch '{"query":"drake"}'`
 * → albums + titres réels avec artworkUrl100 et previewUrl.
 */
export const itunesSearch = action({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return { tracks: [] as ItunesCatalogTrack[], albums: [] as ItunesCatalogAlbum[] };
    const limit = Math.min(Math.max(args.limit ?? 12, 3), 25);
    const cacheKey = `cat:itunes:search:${q.toLowerCase()}:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { tracks: ItunesCatalogTrack[]; albums: ItunesCatalogAlbum[] };

    const base = "https://itunes.apple.com/search";
    const [trkRes, albRes] = await Promise.allSettled([
      getJson<{ results?: ItunesResult[] }>(
        `${base}?${new URLSearchParams({ term: q, media: "music", entity: "song", limit: String(limit) }).toString()}`,
        {},
        12_000,
      ),
      getJson<{ results?: ItunesResult[] }>(
        `${base}?${new URLSearchParams({ term: q, media: "music", entity: "album", limit: String(limit) }).toString()}`,
        {},
        12_000,
      ),
    ]);

    const tracks: ItunesCatalogTrack[] = [];
    if (trkRes.status === "fulfilled") {
      const seen = new Set<number>();
      for (const r of trkRes.value.results ?? []) {
        if (!r.trackId || !r.trackName || seen.has(r.trackId)) continue;
        seen.add(r.trackId);
        if (!r.previewUrl) continue; // sans extrait, la carte n'est pas écoutable
        tracks.push({
          trackId: r.trackId,
          trackName: r.trackName,
          artistName: r.artistName ?? "",
          albumName: r.collectionName ?? "",
          artworkUrl: String(r.artworkUrl100 ?? "").replace("100x100", "300x300"),
          previewUrl: r.previewUrl,
          trackViewUrl: r.trackViewUrl ?? "",
          durationSec: Math.round((r.trackTimeMillis ?? 0) / 1000),
          year: typeof r.releaseDate === "string" ? r.releaseDate.slice(0, 4) : "",
          source: "itunes",
        });
        if (tracks.length >= limit) break;
      }
    }

    const albums: ItunesCatalogAlbum[] = [];
    if (albRes.status === "fulfilled") {
      const seen = new Set<number>();
      for (const r of albRes.value.results ?? []) {
        if (!r.collectionId || !r.collectionName || seen.has(r.collectionId)) continue;
        seen.add(r.collectionId);
        albums.push({
          albumId: r.collectionId,
          title: r.collectionName,
          artistName: r.artistName ?? "",
          artworkUrl: String(r.artworkUrl100 ?? "").replace("100x100", "300x300"),
          year: typeof r.releaseDate === "string" ? r.releaseDate.slice(0, 4) : "",
          source: "itunes",
        });
        if (albums.length >= limit) break;
      }
    }

    const out = { tracks, albums };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
});

/* ── Tracklist d'un album (lookup entity=song) ───────────────────────── */

/**
 * `bunx convex run connectors/itunesCatalog:itunesAlbumTracks
 *   '{"albumId":1440847073}'` → titres de l'album avec extraits.
 */
export const itunesAlbumTracks = action({
  args: { albumId: v.number() },
  handler: async (ctx, args) => {
    const cacheKey = `cat:itunes:album:${args.albumId}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as Array<{
      trackId: number;
      trackName: string;
      artistName: string;
      previewUrl: string;
      trackNumber: number;
      durationSec: number;
    }>;

    const res = await getJson<{ results?: ItunesResult[] }>(
      `https://itunes.apple.com/lookup?id=${args.albumId}&entity=song&limit=50`,
      {},
      12_000,
    );
    const out = (res.results ?? [])
      .filter((r) => typeof r.trackId === "number" && typeof r.previewUrl === "string")
      .map((r) => ({
        trackId: r.trackId as number,
        trackName: r.trackName ?? "",
        artistName: r.artistName ?? "",
        previewUrl: r.previewUrl as string,
        trackNumber: 0,
        durationSec: Math.round((r.trackTimeMillis ?? 0) / 1000),
      }));
    await cachePut(ctx, cacheKey, out);
    return out;
  },
  returns: v.array(
    v.object({
      trackId: v.number(),
      trackName: v.string(),
      artistName: v.string(),
      previewUrl: v.string(),
      trackNumber: v.number(),
      durationSec: v.number(),
    }),
  ),
});
