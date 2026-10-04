"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getJson } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   CATALOGUE DEEZER — chart albums réels + recherche (métadonnées + extraits
   officiels 30 s). Tout est fetched CÔTE SERVEUR (aucun CORS navigateur),
   mis en cache 24 h dans ovSourceCache (clé « cat:… »). Aucune clé requise.
   ═══════════════════════════════════════════════════════════════════════ */

type DeezerArtist = { id?: number; name?: string };
type DeezerAlbumChart = {
  id?: number;
  title?: string;
  cover_xl?: string;
  cover_big?: string;
  artist?: DeezerArtist;
};
type DeezerAlbumDetail = {
  id?: number;
  title?: string;
  cover_xl?: string;
  cover_big?: string;
  release_date?: string;
  artist?: DeezerArtist;
  tracks?: { data?: { id?: number; title?: string; preview?: string; duration?: number }[] };
};
type DeezerTrackSearch = {
  id?: number;
  title?: string;
  duration?: number;
  preview?: string;
  release_date?: string;
  artist?: DeezerArtist;
  album?: { id?: number; title?: string; cover_big?: string; cover_xl?: string };
};

/** Forme uniforme consommée par l'UI (même contrat côté iTunes). */
export type CatalogTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  albumName: string;
  artworkUrl: string;
  previewUrl: string;
  trackViewUrl: string;
  durationSec: number;
  year: string;
  source: "deezer";
};
export type CatalogAlbum = {
  albumId: number;
  title: string;
  artistName: string;
  artworkUrl: string;
  year: string;
  source: "deezer";
  /** Extrait 30 s du 1er titre de l'album (lecture immédiate dans l'UI). */
  previewUrl?: string;
  trackName?: string;
  trackId?: number;
};

/* ── Cache 24 h (ovSourceCache, helpers partagés lyricsCache) ─────────── */

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
    /* best-effort : un échec de cache ne fait jamais échouer la recherche */
  }
}

function yearOf(date?: string): string {
  return typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : "";
}

/* ── Chart albums (réels, enrichis : année + extrait 1er titre) ──────── */

/**
 * `bunx convex run connectors/deezerCatalog:deezerChart '{"limit":10}'`
 * → 10 vrais albums du classement Deezer avec cover_xl, release_date et
 * preview_url (extrait officiel du 1er titre) NON VIDE quand disponible.
 */
export const deezerChart = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 3), 25);
    const cacheKey = `cat:deezer:chart:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { source: string; albums: CatalogAlbum[] };

    const chart = await getJson<{ data?: DeezerAlbumChart[] }>(
      `https://api.deezer.com/chart/0/albums?limit=${limit}`,
      {},
      12_000,
    );
    const ids = (chart.data ?? [])
      .filter((a) => typeof a.id === "number" && typeof a.title === "string")
      .slice(0, limit);

    // Enrichissement : /album/{id} fournit release_date + tracks.data[0].preview.
    const settled = await Promise.allSettled(
      ids.map((a) =>
        getJson<DeezerAlbumDetail>(`https://api.deezer.com/album/${a.id}`, {}, 12_000),
      ),
    );
    const albums: CatalogAlbum[] = [];
    for (const res of settled) {
      if (res.status !== "fulfilled") continue;
      const a = res.value;
      if (!a?.id) continue;
      const top = a.tracks?.data?.[0];
      albums.push({
        albumId: a.id,
        title: a.title ?? "Album",
        artistName: a.artist?.name ?? "",
        artworkUrl: a.cover_xl ?? a.cover_big ?? "",
        year: yearOf(a.release_date),
        source: "deezer",
        ...(top?.preview
          ? { previewUrl: top.preview, trackName: top.title ?? "", trackId: top.id ?? 0 }
          : {}),
      });
    }
    const out = { source: "deezer", albums };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
});

/* ── Playlists éditoriales + pistes d'une playlist ───────────────────── */

type DeezerPlaylist = {
  id?: number;
  title?: string;
  picture_xl?: string;
  picture_big?: string;
  nb_tracks?: number;
  user?: { name?: string };
};
export type CatalogPlaylist = {
  playlistId: number;
  title: string;
  pictureUrl: string;
  trackCount: number;
  creator: string;
  source: "deezer";
};

/**
 * Playlists éditoriales populaires Deezer (recherche "top" triée par
 * fans = sélection officielle) — ouvrables en liste de pistes.
 */
export const deezerPlaylists = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 8, 3), 20);
    const cacheKey = `cat:deezer:playlists:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { source: string; playlists: CatalogPlaylist[] };

    const data = await getJson<{ data?: DeezerPlaylist[] }>(
      `https://api.deezer.com/search/playlist?${new URLSearchParams({ q: "top hits", limit: String(limit) }).toString()}`,
      {},
      12_000,
    );
    const playlists: CatalogPlaylist[] = (data.data ?? [])
      .filter((p) => typeof p.id === "number" && typeof p.title === "string")
      .slice(0, limit)
      .map((p) => ({
        playlistId: p.id as number,
        title: p.title as string,
        pictureUrl: p.picture_xl ?? p.picture_big ?? "",
        trackCount: p.nb_tracks ?? 0,
        creator: p.user?.name ?? "Deezer",
        source: "deezer" as const,
      }));
    const out = { source: "deezer", playlists };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
});

/**
 * Pistes d'une playlist Deezer (/playlist/{id}/tracks) — chaque titre garde
 * son extrait 30 s jouable.
 */
export const deezerPlaylistTracks = action({
  args: { playlistId: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 3), 50);
    const cacheKey = `cat:deezer:pltracks:${args.playlistId}:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { source: string; tracks: CatalogTrack[] };

    type DeezerPlaylistTrack = {
      id?: number;
      title?: string;
      duration?: number;
      preview?: string;
      artist?: DeezerArtist;
      album?: { id?: number; title?: string; cover_big?: string; cover_xl?: string };
    };
    const data = await getJson<{ data?: DeezerPlaylistTrack[] }>(
      `https://api.deezer.com/playlist/${args.playlistId}/tracks?limit=${limit}`,
      {},
      12_000,
    );
    const tracks: CatalogTrack[] = (data.data ?? [])
      .filter((t) => typeof t.id === "number" && typeof t.title === "string" && typeof t.preview === "string" && t.preview.startsWith("http"))
      .slice(0, limit)
      .map((t) => ({
        trackId: t.id as number,
        trackName: t.title as string,
        artistName: t.artist?.name ?? "",
        albumName: t.album?.title ?? "",
        artworkUrl: t.album?.cover_big ?? t.album?.cover_xl ?? "",
        previewUrl: t.preview as string,
        trackViewUrl: `https://www.deezer.com/track/${t.id}`,
        durationSec: t.duration ?? 0,
        year: "",
        source: "deezer" as const,
      }));
    const out = { source: "deezer", tracks };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
});

/* ── Top titres d'un artiste (/artist/{id}/top) ─────────────────────── */

/**
 * Top titres réels d'un artiste : alimente la section Albums/Artiste de
 * l'onglet Musique (recherche artiste → pistes jouables immédiatement).
 */
export const deezerArtistTop = action({
  args: { artistId: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 3), 25);
    const cacheKey = `cat:deezer:artisttop:${args.artistId}:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { source: string; tracks: CatalogTrack[] };

    const data = await getJson<{ data?: Array<DeezerTrackSearch & { album?: { cover_big?: string; cover_xl?: string } }> }>(
      `https://api.deezer.com/artist/${args.artistId}/top?limit=${limit}`,
      {},
      12_000,
    );
    const tracks: CatalogTrack[] = (data.data ?? [])
      .filter((t) => typeof t.id === "number" && typeof t.title === "string" && typeof t.preview === "string" && t.preview.startsWith("http"))
      .slice(0, limit)
      .map((t) => ({
        trackId: t.id as number,
        trackName: t.title as string,
        artistName: t.artist?.name ?? "",
        albumName: t.album?.title ?? "",
        artworkUrl: t.album?.cover_big ?? t.album?.cover_xl ?? "",
        previewUrl: t.preview as string,
        trackViewUrl: `https://www.deezer.com/track/${t.id}`,
        durationSec: t.duration ?? 0,
        year: yearOf(t.release_date),
        source: "deezer" as const,
      }));
    const out = { source: "deezer", tracks };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
});

/* ── Recherche (titres avec extraits + albums enrichis) ─────────────── */

export const deezerSearchMusic = action({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return { tracks: [] as CatalogTrack[], albums: [] as CatalogAlbum[] };
    const limit = Math.min(Math.max(args.limit ?? 12, 3), 25);
    const cacheKey = `cat:deezer:search:${q.toLowerCase()}:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { tracks: CatalogTrack[]; albums: CatalogAlbum[] };

    const [trkRes, albRes] = await Promise.allSettled([
      getJson<{ data?: DeezerTrackSearch[] }>(
        `https://api.deezer.com/search?${new URLSearchParams({ q, limit: String(limit) }).toString()}`,
        {},
        12_000,
      ),
      getJson<{ data?: DeezerAlbumChart[] }>(
        `https://api.deezer.com/search/album?${new URLSearchParams({ q, limit: String(limit) }).toString()}`,
        {},
        12_000,
      ),
    ]);

    const tracks: CatalogTrack[] = [];
    if (trkRes.status === "fulfilled") {
      const seen = new Set<number>();
      for (const t of trkRes.value.data ?? []) {
        if (!t.id || !t.title || seen.has(t.id)) continue;
        seen.add(t.id);
        if (!t.preview) continue; // sans extrait, la carte n'est pas écoutable
        tracks.push({
          trackId: t.id,
          trackName: t.title,
          artistName: t.artist?.name ?? "",
          albumName: t.album?.title ?? "",
          artworkUrl: t.album?.cover_big ?? t.album?.cover_xl ?? "",
          previewUrl: t.preview,
          trackViewUrl: `https://www.deezer.com/track/${t.id}`,
          durationSec: t.duration ?? 0,
          year: yearOf(t.release_date),
          source: "deezer",
        });
        if (tracks.length >= limit) break;
      }
    }

    // Albums enrichis (année + extrait du 1er titre) : /album/{id} en batch.
    const albums: CatalogAlbum[] = [];
    if (albRes.status === "fulfilled") {
      const candidates = (albRes.value.data ?? [])
        .filter((a) => typeof a.id === "number" && typeof a.title === "string")
        .slice(0, limit);
      const details = await Promise.allSettled(
        candidates.map((a) =>
          getJson<DeezerAlbumDetail>(`https://api.deezer.com/album/${a.id}`, {}, 12_000),
        ),
      );
      const seen = new Set<number>();
      for (const res of details) {
        if (res.status !== "fulfilled") continue;
        const a = res.value;
        if (!a?.id) continue;
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        const top = a.tracks?.data?.[0];
        albums.push({
          albumId: a.id,
          title: a.title ?? "Album",
          artistName: a.artist?.name ?? "",
          artworkUrl: a.cover_xl ?? a.cover_big ?? "",
          year: yearOf(a.release_date),
          source: "deezer",
          ...(top?.preview
            ? { previewUrl: top.preview, trackName: top.title ?? "", trackId: top.id ?? 0 }
            : {}),
        });
        if (albums.length >= limit) break;
      }
    }

    const out = { tracks, albums };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
});
