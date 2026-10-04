"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

/* ── Helpers partagés (copie locale, fichier "use node" séparé) ────── */

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

/* ── (e2) Livres : archive.org textes (keyless, prêts légaux) ─────── */

export const archiveTextSearch = action({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return { items: [] };
    const rows = Math.max(1, Math.min(args.limit ?? 4, 10));
    const url =
      `https://archive.org/advancedsearch.php?q=mediatype%3A(texts)+AND+%28${encodeURIComponent(q)}%29` +
      `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=description&rows=${rows}&output=json`;
    const res = await safeFetch(url, "La recherche archive.org");
    const data = (await res.json()) as {
      response?: {
        docs?: Array<{ identifier?: string; title?: string; description?: unknown }>;
      };
    };
    const items = (data.response?.docs ?? [])
      .filter((d) => d.identifier && d.title)
      .map((d) => ({
        identifier: d.identifier as string,
        title: stripHtml(d.title) || (d.identifier as string),
        description: stripHtml(
          Array.isArray(d.description) ? d.description[0] : d.description,
        ),
        detailsUrl: `https://archive.org/details/${d.identifier as string}`,
      }));
    return { items };
  },
  returns: v.object({
    items: v.array(
      v.object({
        identifier: v.string(),
        title: v.string(),
        description: v.string(),
        detailsUrl: v.string(),
      }),
    ),
  }),
});

/* ── (f) Séries : TVmaze (keyless) ─────────────────────────────────── */

export const tvmazeSearch = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return [];
    const res = await safeFetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
      "La recherche de séries",
    );
    const data = (await res.json()) as Array<{
      show?: {
        id?: number;
        name?: string;
        summary?: string;
        image?: { medium?: string; original?: string };
        premiered?: string;
        language?: string;
      };
    }>;
    return (data ?? [])
      .filter((r) => r.show?.id && r.show?.name)
      .map((r) => ({
        id: r.show!.id as number,
        name: r.show!.name as string,
        summary: stripHtml(r.show!.summary).slice(0, 220),
        image: r.show!.image?.medium ?? "",
        premiered: r.show!.premiered?.slice(0, 4) ?? "",
        language: r.show!.language ?? "",
      }));
  },
  returns: v.array(
    v.object({
      id: v.number(),
      name: v.string(),
      summary: v.string(),
      image: v.string(),
      premiered: v.string(),
      language: v.string(),
    }),
  ),
});

export const tvmazeEpisodes = action({
  args: { showId: v.number() },
  handler: async (_ctx, args) => {
    const res = await safeFetch(
      `https://api.tvmaze.com/shows/${args.showId}/episodes`,
      "La liste des épisodes",
    );
    const data = (await res.json()) as Array<{
      number?: number;
      season?: number;
      name?: string;
      summary?: string;
      airdate?: string;
    }>;
    return (data ?? [])
      .filter((e) => e.name)
      .map((e) => ({
        number: e.number ?? 0,
        season: e.season ?? 1,
        name: e.name as string,
        summary: stripHtml(e.summary).slice(0, 200),
        airdate: e.airdate ?? "",
      }));
  },
  returns: v.array(
    v.object({
      number: v.number(),
      season: v.number(),
      name: v.string(),
      summary: v.string(),
      airdate: v.string(),
    }),
  ),
});

/* ── (g) Films libres : Archive.org (domaine public, légal) ───────── */

export const archiveMoviesSearch = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return [];
    const url =
      `https://archive.org/advancedsearch.php?q=mediatype%3A(movies)+AND+%28${encodeURIComponent(q)}%29` +
      `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=20&output=json`;
    const res = await safeFetch(url, "La recherche de films libres");
    const data = (await res.json()) as {
      response?: {
        docs?: Array<{ identifier?: string; title?: string; year?: number | string }>;
      };
    };
    return (data.response?.docs ?? [])
      .filter((d) => d.identifier && d.title)
      .map((d) => ({
        identifier: d.identifier as string,
        title: d.title as string,
        year: String(d.year ?? ""),
        embedUrl: `https://archive.org/embed/${d.identifier}`,
      }));
  },
  returns: v.array(
    v.object({
      identifier: v.string(),
      title: v.string(),
      year: v.string(),
      embedUrl: v.string(),
    }),
  ),
});

/* ── (h) Livres : Open Library ─────────────────────────────────────── */

export const openLibrarySearch = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return [];
    const res = await safeFetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10`,
      "La recherche de livres",
    );
    const data = (await res.json()) as {
      docs?: Array<{
        key?: string;
        title?: string;
        author_name?: string[];
        first_publish_year?: number;
        cover_i?: number;
      }>;
    };
    return (data.docs ?? [])
      .filter((d) => d.key && d.title)
      .map((d) => ({
        key: d.key as string,
        title: d.title as string,
        author: (d.author_name ?? []).join(", ") || "Auteur inconnu",
        year: d.first_publish_year ? String(d.first_publish_year) : "",
        coverUrl: d.cover_i
          ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
          : "",
      }));
  },
  returns: v.array(
    v.object({
      key: v.string(),
      title: v.string(),
      author: v.string(),
      year: v.string(),
      coverUrl: v.string(),
    }),
  ),
});

/* ── (i) Livres : Gutendex (domaine public, texte complet) ─────────── */

export const gutenbergSearch = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const q = args.query.trim();
    if (q.length < 2) return [];
    const res = await safeFetch(
      `https://gutendex.com/books/?search=${encodeURIComponent(q)}`,
      "La recherche de livres libres",
    );
    const data = (await res.json()) as {
      results?: Array<{
        id?: number;
        title?: string;
        authors?: Array<{ name?: string }>;
        formats?: Record<string, string>;
      }>;
    };
    return (data.results ?? [])
      .filter((b) => b.id && b.title)
      .map((b) => ({
        id: b.id as number,
        title: b.title as string,
        authors: (b.authors ?? []).map((a) => a.name ?? "").filter(Boolean).join(", "),
        textUrl: (b.formats ?? {})["text/plain"] ?? "",
      }));
  },
  returns: v.array(
    v.object({
      id: v.number(),
      title: v.string(),
      authors: v.string(),
      textUrl: v.string(),
    }),
  ),
});

/** Récupère le texte brut Gutenberg (découpage client en segments). */
export const gutenbergText = action({
  args: { textUrl: v.string() },
  handler: async (_ctx, args) => {
    const res = await safeFetch(args.textUrl, "Le texte du livre");
    const raw = await res.text();
    // Gutenberg wrappe à ~75 chars ; on ne renvoie qu'un extrait lisible.
    return raw.replace(/\r\n/g, "\n").slice(0, 400_000);
  },
  returns: v.string(),
});

/* ── (j) Aperçu Google Books (embed légal) ─────────────────────────── */

export const googleBooksEmbed = action({
  args: { volumeId: v.string() },
  handler: async (_ctx, args) => {
    const id = args.volumeId.trim();
    if (!id) throw new Error("Identifiant de livre invalide.");
    return { embedUrl: `https://books.google.com/books?id=${encodeURIComponent(id)}&output=embed` };
  },
  returns: v.object({ embedUrl: v.string() }),
});
