import { licenseByCode } from "../ovRights";
import { internetArchive } from "./internetArchive";
import { getJson, type ConnectorSpec, type RawHit } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   LIVRES — Gutendex (Project Gutenberg) & Open Library

   · Gutendex : texte intégral du domaine public → lecture, traduction et
     analyse linguistique autorisées.
   · Open Library : catalogue sensiblement plus large, dont la majeure
     partie n'est PAS lisible. Quand l'API annonce `ebook_access: public`
     (texte intégral ouvert, hébergé par Internet Archive), le connecteur
     va chercher le fichier réel pour que la lecture reste dans MOOVY.
     Sinon la fiche reste informative : aucun fichier, aucun texte inventé.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Gutendex ───────────────────────────────────────────────────────── */

type GutendexBook = {
  id: number;
  title: string;
  authors?: { name: string }[];
  languages?: string[];
  subjects?: string[];
  bookshelves?: string[];
  download_count?: number;
  formats?: Record<string, string>;
};

function gutenbergHit(book: GutendexBook): RawHit {
  const formats = book.formats ?? {};
  const textUrl =
    formats["text/plain; charset=utf-8"] ??
    formats["text/plain; charset=us-ascii"] ??
    formats["text/plain"] ??
    formats["text/html; charset=utf-8"] ??
    formats["text/html"];

  return {
    source: "gutendex",
    externalId: String(book.id),
    kind: "book",
    title: book.title,
    creator: (book.authors ?? []).map((a) => a.name).filter(Boolean).join(", ") || undefined,
    creatorKind: "publisher",
    language: book.languages?.[0],
    genres: [...(book.bookshelves ?? []), ...(book.subjects ?? [])].slice(0, 4),
    description: (book.subjects ?? []).slice(0, 6).join(" · ") || undefined,
    thumbnail: formats["image/jpeg"] ?? undefined,
    externalUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
    textUrl,
    mediaFormat: textUrl?.includes("html") ? "html" : "text",
    // Project Gutenberg : œuvres dont le copyright est expiré aux États-Unis.
    rightsStatus: "PUBLIC_DOMAIN",
    license: licenseByCode("PD"),
    attribution: "Project Gutenberg",
    popularity: book.download_count,
    subtype: "ebook",
  };
}

export const gutendex: ConnectorSpec = {
  key: "gutendex",
  kinds: ["book"],
  search: async (q, opts) => {
    // L'API redirige (301) avant de répondre : le client HTTP suit les
    // redirections et réessaie, ce qui la rend de nouveau exploitable.
    const params = new URLSearchParams({ search: q });
    if (opts.lang) params.set("languages", opts.lang);
    const data = await getJson<{ results?: GutendexBook[] }>(
      `https://gutendex.com/books/?${params.toString()}`,
      {},
      20_000,
      2,
    );
    return (data.results ?? []).slice(0, opts.rows).map(gutenbergHit);
  },
  discover: async (opts) => {
    const params = new URLSearchParams({ sort: "popular" });
    if (opts.lang) params.set("languages", opts.lang);
    const data = await getJson<{ results?: GutendexBook[] }>(
      `https://gutendex.com/books/?${params.toString()}`,
      {},
      20_000,
      2,
    );
    return (data.results ?? []).slice(0, opts.rows).map(gutenbergHit);
  },
};

/* ── Open Library ───────────────────────────────────────────────────── */

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
  ebook_access?: string;
  has_fulltext?: boolean;
  ia?: string[];
  subject?: string[];
  edition_count?: number;
};

const OL_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "language",
  "ebook_access",
  "has_fulltext",
  "ia",
  "subject",
  "edition_count",
].join(",");

/** Open Library renvoie des codes ISO 639-2/3 (« eng », « fre »…). */
const OL_LANGS: Record<string, string> = {
  eng: "en",
  fre: "fr",
  fra: "fr",
  spa: "es",
  ger: "de",
  deu: "de",
  ita: "it",
  por: "pt",
  rus: "ru",
  ara: "ar",
  chi: "zh",
  zho: "zh",
  jpn: "ja",
  kor: "ko",
  dut: "nl",
  pol: "pl",
  tur: "tr",
  hin: "hi",
};

function olLanguage(codes: string[] | undefined): string | undefined {
  if (!codes?.length) return undefined;
  const first = codes[0]?.toLowerCase();
  return OL_LANGS[first] ?? (first?.length === 2 ? first : undefined);
}

function olHit(doc: OpenLibraryDoc): RawHit {
  const readable = doc.ebook_access === "public";
  return {
    source: "open_library",
    externalId: doc.key ?? doc.title ?? "unknown",
    kind: "book",
    title: doc.title ?? "Sans titre",
    creator: (doc.author_name ?? []).join(", ") || undefined,
    creatorKind: "publisher",
    year: doc.first_publish_year,
    language: olLanguage(doc.language),
    genres: (doc.subject ?? []).slice(0, 4),
    thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    externalUrl: `https://openlibrary.org${doc.key ?? ""}`,
    mediaFormat: "metadata",
    /* Métadonnées ouvertes, œuvre protégée : par défaut on ne lit rien.
       `readableSignal` permet au moteur d'aller chercher le texte libre. */
    rightsStatus: "EXTERNAL_ONLY",
    attribution: "Open Library",
    popularity: doc.edition_count,
    subtype: readable ? "ol_public_domain" : "catalog",
  };
}

/**
 * Transforme un résultat « lisible » d'Open Library en contenu réellement
 * lisible, en récupérant le fichier texte auprès d'Internet Archive et en
 * vérifiant sa licence item par item. Sans confirmation de licence, le
 * résultat reste une fiche informative.
 */
async function resolveReadable(docs: OpenLibraryDoc[], rows: number): Promise<RawHit[]> {
  const candidates = docs
    .filter((d) => d.ebook_access === "public" && (d.ia?.length ?? 0) > 0)
    .slice(0, Math.min(rows, 6));

  const resolved = await Promise.allSettled(
    candidates.map(async (doc): Promise<RawHit | null> => {
      const iaId = doc.ia![0];
      const ia = await internetArchive.detail?.(iaId);
      if (!ia?.textUrl || ia.rightsStatus !== "PUBLIC_DOMAIN") return null;
      const title = doc.title ?? ia.title;
      const hit: RawHit = {
        ...ia,
        // Provenance : découvert par Open Library, servi par Internet Archive.
        source: "open_library",
        externalId: doc.key ?? ia.externalId,
        title,
        creator: (doc.author_name ?? []).join(", ") || ia.creator,
        year: doc.first_publish_year ?? ia.year,
        language: olLanguage(doc.language) ?? ia.language,
        thumbnail: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : ia.thumbnail,
        externalUrl: `https://openlibrary.org${doc.key ?? ""}`,
        attribution: `Open Library · Internet Archive (${ia.externalId})`,
        subtype: "ol_public_domain",
      };
      return hit;
    }),
  );

  const out: RawHit[] = [];
  for (const settled of resolved) {
    if (settled.status === "fulfilled" && settled.value) out.push(settled.value);
  }
  return out;
}

function olQuery(q: string, opts: { rows: number; lang?: string }): string {
  const params = new URLSearchParams({
    q,
    limit: String(Math.min(Math.max(opts.rows, 3), 20)),
    fields: OL_FIELDS,
  });
  if (opts.lang) params.set("lang", opts.lang);
  return `https://openlibrary.org/search.json?${params.toString()}`;
}

export const openLibrary: ConnectorSpec = {
  key: "open_library",
  kinds: ["book"],
  search: async (q, opts) => {
    const data = await getJson<{ docs?: OpenLibraryDoc[] }>(olQuery(q, opts), {}, 15_000);
    const docs = (data.docs ?? []).slice(0, opts.rows);
    const readable = await resolveReadable(docs, opts.rows);
    const readableIds = new Set(readable.map((h) => h.externalId));
    return [...readable, ...docs.map(olHit).filter((h) => !readableIds.has(h.externalId))];
  },
  discover: async (opts) => {
    // « Trending » d'Open Library : catalogue vivant sans requête.
    const data = await getJson<{ works?: OpenLibraryDoc[] }>(
      `https://openlibrary.org/trending/now.json?limit=${Math.min(Math.max(opts.rows, 3), 20)}`,
      {},
      15_000,
    );
    const docs = (data.works ?? []).slice(0, opts.rows);
    const readable = await resolveReadable(docs, opts.rows);
    const readableIds = new Set(readable.map((h) => h.externalId));
    return [...readable, ...docs.map(olHit).filter((h) => !readableIds.has(h.externalId))];
  },
};
