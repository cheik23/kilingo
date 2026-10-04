import { licenseByCode } from "../ovRights";
import { getJson, num, toEpoch, type ConnectorSpec, type RawHit } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   GOOGLE BOOKS — catalogue éditorial récent, sans clé

   Source « index » : métadonnées complètes (couverture, résumé, date de
   publication). Quand l'éditeur autorise l'aperçu ou fournit le texte
   intégral, l'aperçu est lisible dans l'application ; sinon la fiche
   reste informative.
   ═══════════════════════════════════════════════════════════════════════ */

type VolumeInfo = {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  language?: string;
  previewLink?: string;
  infoLink?: string;
  canonicalVolumeLink?: string;
};

type Volume = {
  id?: string;
  volumeInfo?: VolumeInfo;
  accessInfo?: {
    epub?: { isAvailable?: boolean; acsTokenLink?: string };
    pdf?: { isAvailable?: boolean; acsTokenLink?: string };
    textToSpeechPermission?: string;
    viewability?: string; // NO_PAGES | PARTIAL | ALL_PAGES
    publicDomain?: boolean;
    webReaderLink?: string;
  };
};

type BooksEnvelope = { items?: Volume[] };

function toHit(volume: Volume): RawHit | null {
  const info = volume.volumeInfo;
  if (!volume.id || !info?.title) return null;

  // « 2009 », « 2009-04-07 », « 2009-04 » : toute date partielle est exploitable.
  const publishedAt = toEpoch(info.publishedDate);
  const viewability = volume.accessInfo?.viewability ?? "NO_PAGES";
  const webReader = volume.accessInfo?.webReaderLink;
  const readable = viewability === "ALL_PAGES" || viewability === "PARTIAL" || Boolean(webReader);
  const cover = (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? "").replace(/^http:/, "https:");

  return {
    source: "google_books",
    externalId: volume.id,
    kind: "book",
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    creator: (info.authors ?? []).join(", ") || undefined,
    creatorKind: "publisher",
    year: publishedAt ? new Date(publishedAt).getUTCFullYear() : undefined,
    language: info.language,
    duration: info.pageCount ? info.pageCount * 60 : undefined, // ~1 min/page : durée indicative
    genres: (info.categories ?? []).slice(0, 4),
    description: info.description ? info.description.slice(0, 900) : undefined,
    thumbnail: cover || undefined,
    externalUrl: info.canonicalVolumeLink ?? info.infoLink ?? "https://books.google.com",
    embedUrl: readable && webReader ? webReader : undefined,
    mediaFormat: readable ? "embed" : "metadata",
    publishedAt,
    releaseDate: publishedAt,
    popularity: undefined,
    /* Aperçu officiel fourni par l'éditeur via Google Books. */
    rightsStatus: readable ? "EMBED_ALLOWED" : "EXTERNAL_ONLY",
    license: readable ? licenseByCode("OFFICIAL-PREVIEW") : undefined,
    attribution: readable ? "Aperçu fourni par Google Books" : "Catalogue Google Books",
    subtype: volume.accessInfo?.publicDomain ? "public_domain" : "book",
  };
}

export const googleBooks: ConnectorSpec = {
  key: "google_books",
  kinds: ["book"],
  search: async (q, opts) => {
    // `orderBy=newest` côté source : les récents d'abord, comme demandé
    // par le filtre « catalogue récent ». En tri « popular » on respecte
    // la pertinence Google (œuvres les plus consultées).
    const orderBy = opts.sort === "popular" || opts.sort === "trending" ? "relevance" : "newest";
    const params = new URLSearchParams({
      q,
      maxResults: String(Math.min(Math.max(opts.rows, 3), 25)),
      orderBy,
      printType: "books",
    });
    if (opts.lang) params.set("langRestrict", opts.lang);
    const data = await getJson<BooksEnvelope>(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
      {},
      12_000,
    );
    const seen = new Set<string>();
    const out: RawHit[] = [];
    for (const volume of data.items ?? []) {
      if (!volume.id || seen.has(volume.id)) continue;
      seen.add(volume.id);
      const hit = toHit(volume);
      if (hit) out.push(hit);
      if (out.length >= opts.rows) break;
    }
    return out;
  },

  /** Nouveautés éditoriales sans requête : les sorties les plus récentes. */
  discover: async (opts) => {
    const params = new URLSearchParams({
      q: "*",
      orderBy: "newest",
      maxResults: String(Math.min(Math.max(opts.rows, 5), 25)),
      printType: "books",
    });
    if (opts.lang) params.set("langRestrict", opts.lang);
    const data = await getJson<BooksEnvelope>(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
      {},
      12_000,
    );
    return (data.items ?? [])
      .map(toHit)
      .filter((hit): hit is RawHit => hit !== null)
      .slice(0, opts.rows);
  },
};
