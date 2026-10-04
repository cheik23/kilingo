"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ═══════════════════════════════════════════════════════════════════
   Media Hub — actions keyless (iTunes, TVmaze, Archive.org, Open
   Library, Gutendex, lyrics.ovh, radio-browser). Toutes les clés
   (SPOTIFY_CLIENT_ID, GENIUS_API_TOKEN, OPENSUBTITLES_KEY) sont des
   bonus optionnels : absente = fonctionnalité masquée, jamais d'erreur.
   ═══════════════════════════════════════════════════════════════════ */

/** fetch + timeout 8 s + message d'erreur français friendly. */
async function safeFetch(url: string, label: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "MOOVY/1.0", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      throw new Error(`${label} indisponible pour le moment (HTTP ${res.status}). Réessaie dans un instant.`);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.message.includes(label)) throw err;
    throw new Error(`${label} est injoignable. Vérifie ta connexion et réessaie.`);
  }
}

function stripHtml(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const AUTH_ERR = "Non authentifié — recharge la page.";

/* ── (a) Musique : recherche iTunes (keyless, aperçus 30 s légaux) ── */

export const itunesSearchMusic = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) {
      return { artists: [], tracks: [], albums: [] };
    }
    // 3 requêtes parallèles : artistes, titres, albums (keyless).
    const base = "https://itunes.apple.com/search";
    const [artRes, trkRes, albRes] = await Promise.all([
      safeFetch(`${base}?term=${encodeURIComponent(q)}&media=music&entity=musicArtist&limit=12`, "La recherche musique"),
      safeFetch(`${base}?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`, "La recherche musique"),
      safeFetch(`${base}?term=${encodeURIComponent(q)}&media=music&entity=album&limit=12`, "La recherche musique"),
    ]);
    const [artData, trkData, albData] = (await Promise.all([
      artRes.json(),
      trkRes.json(),
      albRes.json(),
    ])) as Array<{ results?: Record<string, unknown>[] }>;

    const artists = (artData.results ?? [])
      .filter((r) => typeof r.artistName === "string" && typeof r.artistId === "number")
      .map((r) => ({
        artistId: r.artistId as number,
        artistName: r.artistName as string,
        genre: typeof r.primaryGenreName === "string" ? r.primaryGenreName : "",
      }));

    // Dédoublonnage strict par trackId.
    const seen = new Set<number>();
    const tracks = (trkData.results ?? [])
      .filter((r) => typeof r.trackId === "number" && typeof r.previewUrl === "string")
      .filter((r) => {
        const id = r.trackId as number;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((r) => ({
        trackId: r.trackId as number,
        trackName: r.trackName as string,
        artistName: (r.artistName as string) ?? "",
        albumName: (r.collectionName as string) ?? "",
        artworkUrl: String(r.artworkUrl100 ?? "").replace("100x100", "300x300"),
        previewUrl: r.previewUrl as string,
        trackViewUrl: (r.trackViewUrl as string) ?? "",
        // Durée réelle du titre : départage les versions homonymes
        // (radio edit, album, live) lors de la sélection des paroles.
        durationSec: Math.round(Number(r.trackTimeMillis ?? 0) / 1000),
        year: typeof r.releaseDate === "string" ? (r.releaseDate as string).slice(0, 4) : "",
      }));

    const albums = (albData.results ?? [])
      .filter((r) => typeof r.collectionId === "number" && typeof r.collectionName === "string")
      .map((r) => ({
        collectionId: r.collectionId as number,
        collectionName: r.collectionName as string,
        artistName: (r.artistName as string) ?? "",
        artworkUrl: String(r.artworkUrl100 ?? "").replace("100x100", "300x300"),
      }));

    return { artists, tracks, albums };
  },
  returns: v.object({
    artists: v.array(
      v.object({
        artistId: v.number(),
        artistName: v.string(),
        genre: v.string(),
      }),
    ),
    tracks: v.array(
      v.object({
        trackId: v.number(),
        trackName: v.string(),
        artistName: v.string(),
        albumName: v.string(),
        artworkUrl: v.string(),
        previewUrl: v.string(),
        trackViewUrl: v.string(),
        durationSec: v.number(),
        year: v.string(),
      }),
    ),
    albums: v.array(
      v.object({
        collectionId: v.number(),
        collectionName: v.string(),
        artistName: v.string(),
        artworkUrl: v.string(),
      }),
    ),
  }),
});

/** Tracklist d'un album iTunes (bonus navigation albums → titres). */
export const itunesAlbumTracks = action({
  args: { collectionId: v.number() },
  handler: async (_ctx, args) => {
    const res = await safeFetch(
      `https://itunes.apple.com/lookup?id=${args.collectionId}&entity=song&limit=50`,
      "La tracklist",
    );
    const data = (await res.json()) as {
      results?: Array<{
        trackId?: number;
        trackName?: string;
        artistName?: string;
        previewUrl?: string;
        trackNumber?: number;
        trackTimeMillis?: number;
      }>;
    };
    return (data.results ?? [])
      .filter((r) => typeof r.trackId === "number" && typeof r.previewUrl === "string")
      .map((r) => ({
        trackId: r.trackId as number,
        trackName: r.trackName as string,
        artistName: (r.artistName as string) ?? "",
        previewUrl: r.previewUrl as string,
        trackNumber: r.trackNumber ?? 0,
        durationSec: Math.round((r.trackTimeMillis ?? 0) / 1000),
      }));
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

/* ── (b) Talk : recherche podcasts iTunes ──────────────────────────── */

export const itunesSearchPodcasts = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return [];
    const res = await safeFetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&entity=podcast&limit=15`,
      "La recherche de podcasts",
    );
    const data = (await res.json()) as {
      results?: Array<{
        collectionName?: string;
        artistName?: string;
        artworkUrl100?: string;
        feedUrl?: string;
      }>;
    };
    return (data.results ?? [])
      .filter((r) => r.collectionName && r.feedUrl)
      .map((r) => ({
        collectionName: r.collectionName as string,
        artistName: r.artistName ?? "",
        artworkUrl: (r.artworkUrl100 ?? "").replace("100x100", "300x300"),
        feedUrl: r.feedUrl as string,
      }));
  },
  returns: v.array(
    v.object({
      collectionName: v.string(),
      artistName: v.string(),
      artworkUrl: v.string(),
      feedUrl: v.string(),
    }),
  ),
});

/* ── (c) Talk : épisodes d'un flux RSS podcast (parse regex, 30 max) ─ */

export const podcastEpisodes = action({
  args: { feedUrl: v.string() },
  handler: async (_ctx, args) => {
    const res = await safeFetch(args.feedUrl, "Le flux du podcast");
    const xml = await res.text();
    const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
    const episodes = items.slice(0, 30).map((item) => {
      const title = stripHtml(item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]);
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const description = stripHtml(
        item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1],
      ).slice(0, 300);
      const enclosure =
        item.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="audio\/[^"]*"/) ??
        item.match(/<enclosure[^>]*type="audio\/[^"]*"[^>]*url="([^"]+)"/) ??
        item.match(/<enclosure[^>]*url="([^"]+)"/);
      return {
        title,
        date: pubDate,
        audioUrl: enclosure?.[1]?.replace(/&amp;/g, "&") ?? "",
        description,
      };
    });
    return episodes.filter((e) => e.title && e.audioUrl);
  },
  returns: v.array(
    v.object({
      title: v.string(),
      date: v.string(),
      audioUrl: v.string(),
      description: v.string(),
    }),
  ),
});

/* ── (d) Taille d'un audio distant (seuil de découpage ~25 Mo) ───── */

export const audioSizeCheck = action({
  args: { url: v.string() },
  handler: async (_ctx, args) => {
    try {
      const res = await fetch(args.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(8_000),
      });
      const len = Number(res.headers.get("content-length") ?? "0");
      return { bytes: len, okForUpload: len > 0 && len <= 25 * 1024 * 1024 };
    } catch {
      return { bytes: 0, okForUpload: false };
    }
  },
  returns: v.object({ bytes: v.number(), okForUpload: v.boolean() }),
});
