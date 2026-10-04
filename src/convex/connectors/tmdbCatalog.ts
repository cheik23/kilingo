"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getJson, stripHtml, toEpoch } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   CATALOGUE FILMS — TMDB (si TMDB_API_KEY) sinon TVmaze (fallback keyless).
   Fetched CÔTE SERVEUR (aucun CORS navigateur), cache 24 h ovSourceCache.
   TMDB : /discover/movie (2000-2026) + /movie/{id}/videos (trailers YouTube).
   Sans clé : top séries TVmaze (2000-2026, poster + synopsis), jamais
   d'erreur — l'onglet Films affiche toujours du contenu réel.
   ═══════════════════════════════════════════════════════════════════════ */

type TmdbMovie = {
  id?: number;
  title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  original_language?: string;
};
type TmdbVideo = {
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
};

export type CatalogMovie = {
  movieId: number;
  title: string;
  year: string;
  posterUrl: string;
  overview: string;
  rating?: number;
  lang?: string;
  /** Embed YouTube officiel du trailer (player natif de la MediaRoom). */
  trailerEmbedUrl?: string;
  source: "tmdb" | "tvmaze";
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

/* ── Helpers TMDB ─────────────────────────────────────────────────────── */

function tmdbKey(): string | null {
  return process.env.TMDB_API_KEY?.trim() || null;
}

function imgUrl(path: string | null | undefined, size: "w342" | "w500" = "w500"): string {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}

function yearOf(date?: string): string {
  return typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : "";
}

function movieFromTmdb(m: TmdbMovie, videos: TmdbVideo[]): CatalogMovie {
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer");
  return {
    movieId: m.id ?? 0,
    title: m.title ?? "Film",
    year: yearOf(m.release_date),
    posterUrl: imgUrl(m.poster_path),
    overview: stripHtml(m.overview ?? "").slice(0, 400),
    ...(typeof m.vote_average === "number" && m.vote_average > 0
      ? { rating: Math.round(m.vote_average * 10) / 10 }
      : {}),
    ...(m.original_language ? { lang: m.original_language } : {}),
    ...(trailer?.key
      ? { trailerEmbedUrl: `https://www.youtube-nocookie.com/embed/${trailer.key}` }
      : {}),
    source: "tmdb",
  };
}

/* ── Découverte : TMDB /discover/movie (2000-2026) sinon TVmaze ─────── */

/**
 * `bunx convex run connectors/tmdbCatalog:movieDiscover '{"limit":12}'`
 * → films/séries récents 2000-2026 avec poster, synopsis, trailer.
 */
export const movieDiscover = action({
  args: {
    limit: v.optional(v.number()),
    /** Sous-onglet demandé : films (TMDB) ou séries (TVmaze). */
    kind: v.optional(v.union(v.literal("movie"), v.literal("series"))),
    query: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 12, 3), 24);
    const kind = args.kind ?? "movie";
    const q = args.query?.trim() ?? "";
    const cacheKey = `cat:movies:${kind}:${q.toLowerCase() || "chart"}:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { source: string; items: CatalogMovie[] };

    const key = tmdbKey();
    if (kind === "movie" && key) {
      // Étage TMDB — /discover/movie borné 2000-2026, ou /search/movie.
      const params = new URLSearchParams({
        language: "fr-FR",
        sort_by: q ? "popularity.desc" : "primary_release_date.desc",
        "primary_release_date.gte": "2000-01-01",
        "primary_release_date.lte": "2026-12-31",
        include_adult: "false",
        page: "1",
      });
      if (q) {
        const search = await getJson<{ results?: TmdbMovie[] }>(
          `https://api.themoviedb.org/3/search/movie?${new URLSearchParams({ api_key: key, query: q, language: "fr-FR", include_adult: "false" }).toString()}`,
          {},
          12_000,
        );
        const items = (search.results ?? []).slice(0, limit).map((m) => movieFromTmdb(m, []));
        const out = { source: "tmdb", items };
        await cachePut(ctx, cacheKey, out);
        return out;
      }
      const data = await getJson<{ results?: TmdbMovie[] }>(
        `https://api.themoviedb.org/3/discover/movie?${params.toString()}&api_key=${key}`,
        {},
        12_000,
      );
      // Enrichissement trailers : 6 premiers films (limite de latence).
      const base = (data.results ?? []).slice(0, limit).map((m) => movieFromTmdb(m, []));
      const withTrailers = await Promise.allSettled(
        base.slice(0, 6).map(async (m) => {
          const vids = await getJson<{ results?: TmdbVideo[] }>(
            `https://api.themoviedb.org/3/movie/${m.movieId}/videos?api_key=${key}&language=fr-FR`,
            {},
            10_000,
          );
          return movieFromTmdb(m as TmdbMovie, vids.results ?? []);
        }),
      );
      const trailerById = new Map<number, CatalogMovie>();
      withTrailers.forEach((r, i) => {
        if (r.status === "fulfilled") trailerById.set(base[i].movieId, r.value);
      });
      const items = base.map((m) => trailerById.get(m.movieId) ?? m);
      const out = { source: "tmdb", items };
      await cachePut(ctx, cacheKey, out);
      return out;
    }

    // Étage TMDB séries (/tv/popular ou /search/tv) quand la clé existe ;
    // la moindre erreur → repli TVmaze silencieux (blocs ci-dessous).
    if (kind === "series" && key) {
      try {
        const data = q
          ? await getJson<{ results?: TmdbMovie[] }>(
              `https://api.themoviedb.org/3/search/tv?${new URLSearchParams({ api_key: key, query: q, language: "fr-FR", include_adult: "false" }).toString()}`,
              {},
              12_000,
            )
          : await getJson<{ results?: TmdbMovie[] }>(
              `https://api.themoviedb.org/3/tv/popular?api_key=${key}&language=fr-FR&page=1`,
              {},
              12_000,
            );
        const items: CatalogMovie[] = [];
        for (const m of data.results ?? []) {
          const year = yearOf(
            (m as { first_air_date?: string }).first_air_date ?? m.release_date,
          );
          if (year && (Number(year) < 2000 || Number(year) > 2026)) continue;
          items.push({
            movieId: m.id ?? 0,
            title: m.title ?? (m as { name?: string }).name ?? "Série",
            year,
            posterUrl: imgUrl(m.poster_path),
            overview: stripHtml(m.overview ?? "").slice(0, 400),
            ...(typeof m.vote_average === "number" && m.vote_average > 0
              ? { rating: Math.round(m.vote_average * 10) / 10 }
              : {}),
            ...(m.original_language ? { lang: m.original_language } : {}),
            source: "tmdb",
          });
          if (items.length >= limit) break;
        }
        if (items.length > 0) {
          const out = { source: "tmdb", items };
          await cachePut(ctx, cacheKey, out);
          return out;
        }
      } catch {
        // TMDB indisponible → fallback TVmaze silencieux.
      }
    }

    // Fallback TVmaze (keyless) — séries réelles, 2000-2026.
    if (q) {
      const data = await getJson<Array<{ show?: {
        id?: number;
        name?: string;
        summary?: string | null;
        image?: { original?: string; medium?: string } | null;
        premiered?: string | null;
        averageRuntime?: number | null;
        weight?: number;
      } }>>(
        `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
        {},
        12_000,
      );
      const items: CatalogMovie[] = [];
      for (const entry of data) {
        const s = entry.show;
        if (!s?.id || !s.name) continue;
        const year = yearOf(s.premiered ?? undefined);
        if (year && (Number(year) < 2000 || Number(year) > 2026)) continue;
        items.push({
          movieId: s.id,
          title: s.name,
          year,
          posterUrl: s.image?.original ?? s.image?.medium ?? "",
          overview: stripHtml(s.summary ?? "").slice(0, 400),
          source: "tvmaze",
        });
        if (items.length >= limit) break;
      }
      const out = { source: "tvmaze", items };
      await cachePut(ctx, cacheKey, out);
      return out;
    }

    // TVmaze : « la télé d'aujourd'hui » puis top-rated, borné 2000-2026.
    type TvmazeShowEntry = {
      id?: number;
      name?: string;
      summary?: string | null;
      image?: { original?: string; medium?: string } | null;
      premiered?: string | null;
      weight?: number;
    };
    const today = new Date().toISOString().slice(0, 10);
    const schedule = await getJson<Array<{ show?: TvmazeShowEntry }>>(
      `https://api.tvmaze.com/schedule/web?date=${today}`,
      {},
      12_000,
    ).catch(() => [] as Array<{ show?: TvmazeShowEntry }>);

    const items: CatalogMovie[] = [];
    const seen = new Set<number>();
    for (const entry of schedule) {
      const s = entry.show;
      if (!s?.id || !s.name || seen.has(s.id)) continue;
      seen.add(s.id);
      const year = yearOf(s.premiered ?? undefined);
      if (year && (Number(year) < 2000 || Number(year) > 2026)) continue;
      items.push({
        movieId: s.id,
        title: s.name,
        year,
        posterUrl: s.image?.original ?? s.image?.medium ?? "",
        overview: stripHtml(s.summary ?? "").slice(0, 400),
        source: "tvmaze",
      });
      if (items.length >= limit) break;
    }
    // Complète avec les séries les mieux notées si la grille du jour est courte.
    if (items.length < limit) {
      // Forme uniforme pour les deux pages TVmaze (schedule + /shows).
      type TvmazeEntry = {
        id?: number;
        name?: string;
        summary?: string | null;
        image?: { original?: string; medium?: string } | null;
        premiered?: string | null;
        weight?: number;
      };
      const rated = await getJson<TvmazeEntry[]>(
        "https://api.tvmaze.com/shows?page=0",
        {},
        12_000,
      ).catch(() => [] as TvmazeEntry[]);
      for (const s of rated) {
        if (!s?.id || !s.name || seen.has(s.id)) continue;
        const year = yearOf(s.premiered ?? undefined);
        if (!year || Number(year) < 2000) continue;
        seen.add(s.id);
        items.push({
          movieId: s.id,
          title: s.name,
          year,
          posterUrl: s.image?.original ?? s.image?.medium ?? "",
          overview: stripHtml(s.summary ?? "").slice(0, 400),
          source: "tvmaze",
        });
        if (items.length >= limit) break;
      }
    }
    const out = { source: "tvmaze", items };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
  returns: v.object({
    source: v.string(),
    items: v.array(
      v.object({
        movieId: v.number(),
        title: v.string(),
        year: v.string(),
        posterUrl: v.string(),
        overview: v.string(),
        rating: v.optional(v.number()),
        lang: v.optional(v.string()),
        trailerEmbedUrl: v.optional(v.string()),
        source: v.string(),
      }),
    ),
  }),
});
