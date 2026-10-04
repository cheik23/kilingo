"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getJson } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   CATALOGUE GOOGLE BOOKS — /volumes réel (couvertures + extraits lisibles),
   fetched CÔTE SERVEUR (aucun CORS navigateur), cache 24 h ovSourceCache.
   Filtre publishedDate 2000-2026 côté serveur ; sans résultat filtré on
   renvoie le meilleur effort réel (jamais de contenu inventé).
   ═══════════════════════════════════════════════════════════════════════ */

type GbVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    previewLink?: string;
    infoLink?: string;
    language?: string;
    categories?: string[];
  };
};

export type CatalogBook = {
  bookId: string;
  title: string;
  author: string;
  year: string;
  coverUrl: string;
  description: string;
  previewLink: string;
  lang?: string;
  source: "google_books";
};

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

function yearOf(date?: string): string {
  return typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : "";
}

/** thumbnail http → https (Google Books les sert encore en http). */
function coverOf(info: GbVolume["volumeInfo"]): string {
  const raw = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? "";
  return raw.replace(/^http:\/\//i, "https://").replace("&edge=curl", "");
}

/**
 * `bunx convex run connectors/googleBooksCatalog:googleBooksSearch
 *   '{"query":"fantasy 2020","limit":20}'`
 * → volumes réels, publishedDate ≥ 2000, couverture + previewLink.
 */
export const googleBooksSearch = action({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return { items: [] as CatalogBook[] };
    const limit = Math.min(Math.max(args.limit ?? 20, 3), 40);
    const cacheKey = `cat:gbooks:${q.toLowerCase()}:${limit}`;
    const cached = await cacheGet(ctx, cacheKey);
    if (cached) return cached as { items: CatalogBook[] };

    // Sur-échantillonnage : le filtre 2000-2026 élimine une partie des hits.
    // Google Books anonyme est quota-limité par IP (429 possible depuis un
    // datacenter) : une seule relance après backoff, puis repli SILENCIEUX
    // en liste vide — jamais d'exception remontée à l'interface.
    let data: { items?: GbVolume[] } | null = null;
    for (let attempt = 0; attempt < 2 && !data; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1_200));
      data = await getJson<{ items?: GbVolume[] }>(
        `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({
          q,
          maxResults: "40",
          printType: "books",
        }).toString()}`,
        {},
        12_000,
      ).catch(() => null);
    }
    if (!data) {
      console.warn("[googleBooksCatalog] quota/réseau indisponible — repli liste vide");
      return { items: [] as CatalogBook[] };
    }

    const items: CatalogBook[] = [];
    const rest: CatalogBook[] = [];
    for (const vol of data.items ?? []) {
      const info = vol.volumeInfo;
      if (!vol.id || !info?.title) continue;
      const year = yearOf(info.publishedDate);
      const book: CatalogBook = {
        bookId: vol.id,
        title: info.title,
        author: (info.authors ?? []).join(", "),
        year,
        coverUrl: coverOf(info),
        description: (info.description ?? "").replace(/<[^>]*>/g, " ").slice(0, 300),
        previewLink: info.previewLink ?? info.infoLink ?? "",
        ...(info.language ? { lang: info.language } : {}),
        source: "google_books",
      };
      // Filtre serveur 2000-2026 en priorité ; le reste est repli ordonné.
      if (year && Number(year) >= 2000 && Number(year) <= 2026) items.push(book);
      else rest.push(book);
      if (items.length >= limit) break;
    }
    const finalItems = items.length >= 3 ? items.slice(0, limit) : [...items, ...rest].slice(0, limit);
    const out = { items: finalItems };
    await cachePut(ctx, cacheKey, out);
    return out;
  },
  returns: v.object({
    items: v.array(
      v.object({
        bookId: v.string(),
        title: v.string(),
        author: v.string(),
        year: v.string(),
        coverUrl: v.string(),
        description: v.string(),
        previewLink: v.string(),
        lang: v.optional(v.string()),
        source: v.string(),
      }),
    ),
  }),
});
