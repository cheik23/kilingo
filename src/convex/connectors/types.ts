import type { ContentKind, LicenseFacts, RightsStatus } from "../ovRights";

/* ═══════════════════════════════════════════════════════════════════════
   CONTENT AGGREGATION ENGINE — CONTRAT DE CONNECTEUR

   Un connecteur est un module indépendant qui :

     1. interroge UNE source externe ;
     2. normalise ses résultats en `RawHit` (modèle commun) ;
     3. déclare ce qu'il fournit (`kinds`) et, le cas échéant, comment
        découvrir du contenu sans requête (`discover`) ou résoudre une
        fiche (`detail`).

   Il ne décide JAMAIS des droits : le Rights Engine (ovRights) tranche
   après normalisation. Un connecteur de métadonnées ne peut donc pas
   « ouvrir » une lecture par erreur : c'est structurel.

   Ajouter une source = ajouter un fichier + une ligne dans `index.ts`.
   Aucun autre module de l'application n'a besoin d'être modifié.
   ═══════════════════════════════════════════════════════════════════════ */

export type RawHit = {
  /** Clé du connecteur (doit correspondre au registre ovSources). */
  source: string;
  externalId: string;
  kind: ContentKind;
  title: string;
  creator?: string;
  /** creator | label | studio | publisher | broadcaster | institution | aggregator */
  creatorKind?: string;
  year?: number;
  language?: string;
  country?: string; // ISO 3166-1 alpha-2, uniquement si la source le fournit
  duration?: number; // secondes
  genres?: string[];
  description?: string;
  thumbnail?: string;
  rating?: number;
  externalUrl: string;
  /** Fichier lisible/streamable fourni par la source. */
  streamUrl?: string;
  /** Extrait promotionnel officiel. */
  previewUrl?: string;
  /** Lecteur officiel intégrable (iframe / oEmbed). */
  embedUrl?: string;
  /** Texte intégral lisible (Gutenberg, Wikisource, presse ouverte…). */
  textUrl?: string;
  /**
   * Corps de texte déjà récupéré (article sous licence libre). Réservé aux
   * contenus courts dont la licence autorise la redistribution, avec
   * attribution obligatoire affichée sur la fiche.
   */
  body?: string;
  /** Flux RSS/Atom à parcourir (podcast : la fiche liste les épisodes). */
  rssUrl?: string;
  /** mp3 | hls | rss | epub | pdf | text | embed | video … */
  mediaFormat?: string;
  /* ── Fraîcheur ── */
  publishedAt?: number; // epoch ms — sert au tri « Nouveautés / Récent »
  releaseDate?: number; // epoch ms — date d'œuvre
  lastUpdatedAt?: number; // epoch ms — dernière modif côté source
  popularity?: number; // score brut fourni par la source
  /* ── Droits (déclaration de la source, jamais une décision) ── */
  rightsStatus: RightsStatus;
  license?: LicenseFacts;
  attribution?: string;
  /** Écoute publique publiée par l'éditeur (enclosure RSS, webradio). */
  officialFeed?: boolean;
  /** show | episode | track | album … */
  subtype?: string;
};

/** Ordres de tri exposés par les rayons (§ Nouveautés / Tendances / Récent). */
export type SortKey = "new" | "popular" | "trending" | "relevant";

export type SearchOpts = {
  kind: ContentKind | null;
  rows: number;
  /** Filtre pays demandé (le connecteur l'ignore s'il ne sait pas faire). */
  country?: string;
  /** Filtre langue demandé. */
  lang?: string;
  /** Ordre attendu : les sources qui savent trier côté serveur le font. */
  sort?: SortKey;
};

export type ConnectorSpec = {
  key: string;
  /** Types de contenus que ce connecteur peut produire. */
  kinds: ContentKind[];
  search: (q: string, opts: SearchOpts) => Promise<RawHit[]>;
  /**
   * Listing sans requête : « qu'est-ce qui est nouveau / populaire
   * maintenant ? ». C'est ce qui alimente les rayons (Films, Musiques,
   * Livres, Audio) sans que l'utilisateur tape quoi que ce soit.
   */
  discover?: (opts: SearchOpts) => Promise<RawHit[]>;
  /** Détail d'un élément quand la source l'expose (saisons, épisodes…). */
  detail?: (externalId: string, opts?: SearchOpts) => Promise<RawHit | null>;
};

/* ── Réseau ─────────────────────────────────────────────────────────── */

const UA = "KILINGO/1.0";

/** GET JSON avec délai maximum et un essai supplémentaire. */
export async function getJson<T>(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 12_000,
  retries = 1,
): Promise<T> {
  const res = await getResponse(url, headers, timeoutMs, retries);
  return (await res.json()) as T;
}

/** GET texte (flux RSS, .txt, .srt…). */
export async function getText(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 15_000,
  retries = 1,
): Promise<string> {
  const res = await getResponse(url, headers, timeoutMs, retries);
  return await res.text();
}

async function getResponse(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  retries: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": UA, ...headers },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} sur ${new URL(url).hostname}`);
      return res;
    } catch (error) {
      lastError = error;
      // Une source lente mérite une seconde chance ; une 404 non.
      if (error instanceof Error && /HTTP 4\d\d/.test(error.message)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Source injoignable");
}

/* ── Normalisation ──────────────────────────────────────────────────── */

export function stripHtml(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

/** Première valeur texte non vide d'une valeur JSON inconnue. */
export function txt(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = txt(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "title", "value", "#text", "@id"]) {
      const found = txt(record[key]);
      if (found) return found;
    }
  }
  return undefined;
}

export function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) && value.trim() !== "" ? parsed : undefined;
  }
  return undefined;
}

/** « 1:12:03 » / « 12:03 » / « 725.5 » → secondes. */
export function parseLength(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  if (value.includes(":")) {
    const parts = value.split(":").map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p))) return undefined;
    return parts.reduce((acc, part) => acc * 60 + part, 0);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Toute date exploitable (ISO, RFC 822, année seule) → epoch ms. */
export function toEpoch(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Une valeur en secondes (date Unix) plutôt qu'en millisecondes.
    return value < 10_000_000_000 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  if (/^\d{4}$/.test(raw)) return Date.UTC(Number(raw), 0, 1);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Score de fraîcheur 0-100 (100 = publié aujourd'hui).
 * Calculé une fois à l'indexation : le tri de la base reste un tri sur une
 * valeur stockée, seul moyen d'utiliser un index Convex.
 */
export function freshnessScore(publishedAt: number | undefined, now = Date.now()): number | undefined {
  if (!publishedAt || !Number.isFinite(publishedAt)) return undefined;
  const days = (now - publishedAt) / 86_400_000;
  if (days <= 0) return 100;
  if (days <= 30) return Math.round(100 - days);
  if (days <= 365) return Math.round(70 - ((days - 30) / 335) * 30);
  if (days <= 3650) return Math.round(40 - ((days - 365) / 3285) * 35);
  return 0;
}

/** Densité de contenu exploitée par le classement : jouable, récent, léger. */
export function playability(hit: RawHit): number {
  let score = 0;
  if (hit.streamUrl) score += 40;
  if (hit.textUrl) score += 35;
  if (hit.previewUrl) score += 25;
  if (hit.embedUrl) score += 15;
  return score;
}

/* ── Flux RSS / Atom ────────────────────────────────────────────────── */

export type FeedItem = {
  title: string;
  description?: string;
  link?: string;
  enclosureUrl?: string;
  enclosureType?: string;
  publishedAt?: number;
  image?: string;
  author?: string;
  duration?: number;
};

function firstMatch(xml: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) {
      const value = stripHtml(match[1].replace(/<!\[CDATA\[|\]\]>/g, ""));
      if (value) return value;
    }
  }
  return undefined;
}

/**
 * Analyseur RSS/Atom volontairement tolérant (pas de dépendance externe).
 * Il ne sert qu'à des flux publics : podcasts, presse, blogs.
 */
export function parseFeed(
  xml: string,
  limit = 30,
): { title?: string; author?: string; image?: string; description?: string; items: FeedItem[] } {
  const head = xml.slice(0, 4000);
  const feedTitle = firstMatch(head, [/<title[^>]*>([\s\S]*?)<\/title>/i]) ?? undefined;
  const feedAuthor =
    firstMatch(head, [/<itunes:author>([\s\S]*?)<\/itunes:author>/i, /<managingEditor>([\s\S]*?)<\/managingEditor>/i]) ??
    undefined;
  const feedImage =
    xml.match(/<itunes:image[^>]*href\s*=\s*"([^"]+)"/i)?.[1] ??
    xml.match(/<image>[\s\S]*?<url>([\s\S]*?)<\/url>/i)?.[1] ??
    undefined;
  const feedDescription =
    firstMatch(head, [
      /<description>([\s\S]*?)<\/description>/i,
      /<itunes:summary>([\s\S]*?)<\/itunes:summary>/i,
      /<subtitle[^>]*>([\s\S]*?)<\/subtitle>/i,
    ]) ?? undefined;

  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/g) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) ??
    [];

  const items: FeedItem[] = [];
  for (const block of blocks.slice(0, limit)) {
    const title = firstMatch(block, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
    if (!title) continue;
    const enclosureTag = block.match(/<enclosure[^>]*>/i)?.[0];
    const enclosureUrl = enclosureTag
      ? (/url\s*=\s*"([^"]+)"/i.exec(enclosureTag)?.[1] ??
        /url\s*=\s*'([^']+)'/i.exec(enclosureTag)?.[1])
      : undefined;
    const enclosureType = enclosureTag
      ? (/type\s*=\s*"([^"]+)"/i.exec(enclosureTag)?.[1] ?? undefined)
      : undefined;
    const linkFromTag = block.match(/<link[^>]*href\s*=\s*"([^"]+)"/i)?.[1];
    const linkPlain = firstMatch(block, [/<link>([\s\S]*?)<\/link>/i]);
    const published = firstMatch(block, [
      /<pubDate>([\s\S]*?)<\/pubDate>/i,
      /<published>([\s\S]*?)<\/published>/i,
      /<updated>([\s\S]*?)<\/updated>/i,
      /<dc:date>([\s\S]*?)<\/dc:date>/i,
    ]);
    const description = firstMatch(block, [
      /<description>([\s\S]*?)<\/description>/i,
      /<summary[^>]*>([\s\S]*?)<\/summary>/i,
      /<content:encoded>([\s\S]*?)<\/content:encoded>/i,
    ]);
    const duration =
      parseLength(firstMatch(block, [/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i])) ?? undefined;
    const image = block.match(/<itunes:image[^>]*href\s*=\s*"([^"]+)"/i)?.[1] ?? undefined;
    const author = firstMatch(block, [
      /<dc:creator>([\s\S]*?)<\/dc:creator>/i,
      /<author>([\s\S]*?)<\/author>/i,
    ]);

    items.push({
      title,
      description: description ? stripHtml(description).slice(0, 600) : undefined,
      link: linkFromTag ?? linkPlain ?? undefined,
      enclosureUrl: enclosureUrl?.replace(/&amp;/g, "&"),
      enclosureType,
      publishedAt: toEpoch(published),
      image,
      author,
      duration,
    });
  }

  return {
    title: feedTitle,
    author: feedAuthor,
    image: feedImage,
    description: feedDescription ? stripHtml(feedDescription).slice(0, 600) : undefined,
    items,
  };
}
