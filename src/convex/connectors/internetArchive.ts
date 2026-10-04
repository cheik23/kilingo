import { detectLicense, licenseByCode, statusFromLicense } from "../ovRights";
import {
  getJson,
  num,
  parseLength,
  toEpoch,
  txt,
  type ConnectorSpec,
  type RawHit,
  type SearchOpts,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   INTERNET ARCHIVE — films, audio, textes (+ Prelinger, LibriVox)

   Le seul connecteur « contenu » sans clé dont la licence est vérifiable
   par item (`licenseurl`). Sans licence explicite, l'item reste UNKNOWN et
   le Rights Engine bloque la lecture : c'est ce qui rend ce connecteur
   utilisable en production sans revue manuelle.
   ═══════════════════════════════════════════════════════════════════════ */

const IA = "https://archive.org";

type IaDoc = {
  identifier: string;
  title?: unknown;
  creator?: unknown;
  year?: unknown;
  date?: unknown;
  publicdate?: unknown;
  addeddate?: unknown;
  mediatype?: unknown;
  licenseurl?: unknown;
  description?: unknown;
  language?: unknown;
  runtime?: unknown;
  collection?: unknown;
  subject?: unknown;
  downloads?: unknown;
  item_size?: unknown;
  avg_rating?: unknown;
};

type IaFile = { name: string; format?: string; length?: unknown; size?: unknown };

const FL = [
  "identifier",
  "title",
  "creator",
  "year",
  "date",
  "publicdate",
  "addeddate",
  "mediatype",
  "licenseurl",
  "description",
  "language",
  "runtime",
  "collection",
  "subject",
  "downloads",
  "item_size",
  "avg_rating",
];

type IaOpts = {
  source?: string;
  /** Restreint à une collection (prelinger, librivox…). */
  collection?: string;
  /** Collections dont le contrat de licence publique est connu. */
  assumePublicDomain?: boolean;
  /** Force le mediatype quand le rayon est explicite. */
  mediatype?: string;
};

function mediatypeFor(kind: SearchOpts["kind"]): string | undefined {
  if (kind === "movie" || kind === "series" || kind === "video") return "movies";
  if (kind === "book") return "texts";
  if (kind === "image") return "image";
  if (kind === "music" || kind === "audio" || kind === "podcast") return "audio";
  return undefined;
}

async function advancedSearch(doc: {
  q: string;
  rows: number;
  sort?: string;
}): Promise<IaDoc[]> {
  const params = new URLSearchParams();
  params.set("q", doc.q);
  for (const field of FL) params.append("fl[]", field);
  params.set("rows", String(doc.rows));
  params.set("page", "1");
  params.set("output", "json");
  if (doc.sort) params.append("sort[]", doc.sort);
  const data = await getJson<{ response?: { docs?: IaDoc[] } }>(
    `${IA}/advancedsearch.php?${params.toString()}`,
    {},
    15_000,
  );
  return data.response?.docs ?? [];
}

/** Traduit un item Archive en contenu normalisé (fichiers + licence). */
function toHit(
  doc: IaDoc,
  files: IaFile[],
  wanted: SearchOpts["kind"],
  source: string,
  assumePublicDomain: boolean,
): RawHit {
  const detected = detectLicense({ licenseUrl: txt(doc.licenseurl) });
  const facts = detected ?? (assumePublicDomain ? licenseByCode("PD") : undefined);
  const rightsStatus = statusFromLicense(facts);

  const names = files.filter((f) => f.name && !f.name.startsWith("__ia_thumb"));
  const byName = (re: RegExp) => names.find((f) => re.test(f.name));
  const byFormat = (re: RegExp) => names.find((f) => f.format && re.test(f.format));

  const mediatype = txt(doc.mediatype);
  const isMovie = wanted === "movie" || wanted === "series" || wanted === "video" || mediatype === "movies";
  const isText = wanted === "book" || mediatype === "texts";
  const isImage = wanted === "image" || mediatype === "image";

  let kind: RawHit["kind"] = "audio";
  let streamUrl: string | undefined;
  let textUrl: string | undefined;
  let mediaFormat: string | undefined;
  let duration: number | undefined;

  if (isMovie) {
    kind = wanted === "series" ? "series" : wanted === "video" ? "video" : "movie";
    const video =
      byName(/\.(mp4|m4v)$/i) ?? byFormat(/h\.264|mpeg4/i) ?? byName(/\.(webm|ogv)$/i) ?? byFormat(/webm|ogg video/i);
    if (video) {
      streamUrl = `${IA}/download/${doc.identifier}/${encodeURIComponent(video.name)}`;
      mediaFormat = video.name.split(".").pop()?.toLowerCase() ?? "video";
      duration = parseLength(video.length) ?? parseLength(doc.runtime);
    }
  } else if (isText) {
    kind = "book";
    const text = byName(/_djvu\.txt$/i) ?? byName(/\_text\.txt$/i) ?? byName(/\.txt$/i);
    if (text) {
      textUrl = `${IA}/download/${doc.identifier}/${encodeURIComponent(text.name)}`;
      mediaFormat = "text";
    }
  } else if (isImage) {
    kind = "image";
    const picture = byName(/\.(jpe?g|png|webp|gif|tiff?)$/i) ?? byFormat(/jpeg|png|tiff|gif/i);
    if (picture) {
      streamUrl = `${IA}/download/${doc.identifier}/${encodeURIComponent(picture.name)}`;
      mediaFormat = picture.name.split(".").pop()?.toLowerCase() ?? "image";
    }
  } else {
    kind = wanted === "podcast" ? "podcast" : wanted === "music" ? "music" : "audio";
    const audio = byFormat(/VBR MP3|MP3/i) ?? byName(/\.mp3$/i) ?? byFormat(/Ogg Vorbis/i) ?? byName(/\.ogg$/i);
    if (audio) {
      streamUrl = `${IA}/download/${doc.identifier}/${encodeURIComponent(audio.name)}`;
      mediaFormat = audio.name.split(".").pop()?.toLowerCase() ?? "mp3";
      duration = parseLength(audio.length);
    }
  }

  const collections = (
    Array.isArray(doc.collection) ? doc.collection.map(String) : txt(doc.collection) ? [txt(doc.collection)!] : []
  )
    .filter((c) => c && c !== "additional_collections")
    .slice(0, 4);

  const publishedAt = toEpoch(doc.publicdate) ?? toEpoch(doc.addeddate) ?? toEpoch(doc.date);

  return {
    source,
    externalId: doc.identifier,
    kind,
    title: txt(doc.title) ?? doc.identifier,
    creator: txt(doc.creator),
    creatorKind: "aggregator",
    year: num(doc.year) ?? (publishedAt ? new Date(publishedAt).getUTCFullYear() : undefined),
    language: txt(doc.language),
    duration,
    genres: collections,
    description: txt(doc.description),
    thumbnail: `${IA}/services/img/${doc.identifier}`,
    rating: num(doc.avg_rating),
    externalUrl: `${IA}/details/${doc.identifier}`,
    streamUrl,
    textUrl,
    embedUrl: `${IA}/embed/${doc.identifier}`,
    mediaFormat,
    publishedAt,
    releaseDate: toEpoch(doc.date),
    lastUpdatedAt: toEpoch(doc.addeddate),
    popularity: num(doc.downloads),
    rightsStatus,
    license: facts,
    attribution: txt(doc.creator),
    subtype: mediatype,
  };
}

/**
 * Un appel `metadata` léger par item : c'est le seul moyen de savoir
 * quels fichiers la source sert réellement. Il est plafonné (12 items par
 * appel) pour ne jamais transformer une recherche en rafale de requêtes.
 */
async function resolveFiles(
  docs: IaDoc[],
  kind: SearchOpts["kind"],
  source: string,
  assumePublicDomain: boolean,
): Promise<RawHit[]> {
  const capped = docs.slice(0, 12);
  const metas = await Promise.allSettled(
    capped.map((d) => getJson<{ files?: IaFile[] }>(`${IA}/metadata/${d.identifier}`, {}, 12_000)),
  );
  return capped.map((doc, i) => {
    const meta = metas[i];
    const files = meta && meta.status === "fulfilled" ? (meta.value.files ?? []) : [];
    return toHit(doc, files, kind, source, assumePublicDomain);
  });
}

async function run(q: string, opts: SearchOpts, cfg: IaOpts): Promise<RawHit[]> {
  const source = cfg.source ?? "internet_archive";
  const mediatype = cfg.mediatype ?? mediatypeFor(opts.kind);
  let full = `(${q})`;
  if (mediatype) full += ` AND mediatype:(${mediatype})`;
  if (cfg.collection) full += ` AND collection:(${cfg.collection})`;
  if (opts.lang) full += ` AND language:(${opts.lang})`;

  const docs = await advancedSearch({ q: full, rows: Math.min(opts.rows, 100) });
  return resolveFiles(docs, opts.kind, source, cfg.assumePublicDomain ?? false);
}

/**
 * Listing sans requête : les rayons affichent du contenu réel dès
 * l'ouverture, trié par nouveauté (publicdate) ou par popularité
 * (downloads) — deux tris supportés nativement par Archive.org.
 */
/**
 * Collections « rayon » : pour un affichage par défaut, on s'appuie sur des
 * collections éditorialisées plutôt que sur le dépôt ouvert, où n'importe
 * quel fichier peut être téléversé. La recherche par mots-clés, elle, reste
 * exhaustive : c'est l'utilisateur qui demande un titre précis.
 */
const CURATED: Partial<Record<string, string>> = {
  movies: "feature_films OR classic_cartoons OR film_noir OR moviesandfilms",
  // Miroir de Project Gutenberg : domaine public par contrat de collection.
  texts: "gutenberg",
  audio: "librivox OR audio_books OR netlabels OR audio_music",
};

/** Collections dont le domaine public est contractuel (jamais deviné). */
const CONTRACTUAL_PD: Partial<Record<string, boolean>> = { texts: true };

async function discover(opts: SearchOpts, cfg: IaOpts): Promise<RawHit[]> {
  const source = cfg.source ?? "internet_archive";
  const mediatype = cfg.mediatype ?? mediatypeFor(opts.kind) ?? "movies";
  const curated = cfg.collection ?? CURATED[mediatype];

  let q = `mediatype:(${mediatype})`;
  if (curated) q += ` AND collection:(${curated})`;
  if (opts.lang) q += ` AND language:(${opts.lang})`;
  else if (!cfg.assumePublicDomain) q += " AND (language:(eng) OR language:(fra) OR language:(spa))";
  // Hors dépôt ouvert et hors podcasts (traités par leur propre connecteur).
  q += " AND -collection:(opensource_movies OR opensource_audio OR opensource OR community)";

  const sort = opts.sort === "popular" || opts.sort === "trending" ? "-downloads" : "-publicdate";
  const docs = await advancedSearch({ q, rows: Math.min(opts.rows, 100), sort });
  const assumePd = cfg.assumePublicDomain ?? CONTRACTUAL_PD[mediatype] ?? false;
  return resolveFiles(docs, opts.kind, source, assumePd);
}

export const internetArchive: ConnectorSpec = {
  key: "internet_archive",
  // Films, vidéos, audio, livres et images. Les séries viennent de TVmaze et
  // les podcasts de leur connecteur dédié : Archive.org ne les sert pas sous
  // cette forme, les revendiquer remplirait ces rayons de contenus hors sujet.
  kinds: ["movie", "video", "audio", "music", "book", "image"],
  search: (q, opts) => run(q, opts, {}),
  discover: (opts) => discover(opts, {}),
  detail: async (externalId) => {
    const meta = await getJson<{ files?: IaFile[]; metadata?: IaDoc }>(`${IA}/metadata/${externalId}`, {}, 12_000);
    if (!meta.metadata) return null;
    return toHit(meta.metadata, meta.files ?? [], null, "internet_archive", false);
  },
};

export const prelinger: ConnectorSpec = {
  key: "prelinger",
  kinds: ["movie", "video"],
  search: (q, opts) => run(q, opts, { source: "prelinger", collection: "prelinger", assumePublicDomain: true, mediatype: "movies" }),
  discover: (opts) =>
    discover({ ...opts, kind: "movie" }, { source: "prelinger", collection: "prelinger", assumePublicDomain: true, mediatype: "movies" }),
};

export const librivox: ConnectorSpec = {
  key: "librivox",
  kinds: ["audio", "book"],
  search: (q, opts) =>
    run(q, opts, {
      source: "librivox",
      collection: "gutenberg OR librivox",
      assumePublicDomain: true,
      mediatype: opts.kind === "book" ? "texts" : "audio",
    }),
  discover: (opts) =>
    discover(
      { ...opts, kind: "audio" },
      { source: "librivox", collection: "librivox", assumePublicDomain: true, mediatype: "audio" },
    ),
};
