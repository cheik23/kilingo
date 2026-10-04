import { licenseByCode } from "../ovRights";
import { getJson, toEpoch, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   APPLE ITUNES / APPLE MUSIC — catalogue, extraits officiels, classements

   Source « index » : elle prouve l'existence d'une œuvre et fournit un
   extrait promotionnel jouable (30-90 s). Elle ne donne AUCUN droit de
   diffusion intégrale — le Rights Engine la traite donc en
   EMBED_ALLOWED / extrait, jamais en lecture complète.
   ═══════════════════════════════════════════════════════════════════════ */

type ItunesItem = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  country?: string;
  longDescription?: string;
  shortDescription?: string;
  feedUrl?: string; // podcasts
  trackCount?: number;
};

function entityFor(kind: SearchOpts["kind"]): { media: string; entity?: string } | null {
  switch (kind) {
    case "music":
      return { media: "music", entity: "musicTrack" };
    case "movie":
      return { media: "movie", entity: "movie" };
    case "series":
      return { media: "tvShow", entity: "tvSeason" };
    case "book":
      return { media: "ebook" };
    case "podcast":
      return { media: "podcast", entity: "podcast" };
    default:
      return null;
  }
}

function resolvedKind(kind: SearchOpts["kind"], item: ItunesItem): RawHit["kind"] {
  if (kind) return kind;
  if (item.kind === "podcast") return "podcast";
  if (item.wrapperType === "audiobook" || item.kind === "ebook") return "book";
  if (item.wrapperType === "collection" && item.kind === "album") return "music";
  return "music";
}

function toHit(item: ItunesItem, kind: RawHit["kind"], country: string): RawHit {
  const id = item.trackId ?? item.collectionId ?? 0;
  const hasPreview = typeof item.previewUrl === "string";
  return {
    source: "itunes",
    externalId: String(id),
    kind,
    title: item.trackName ?? item.collectionName ?? "Sans titre",
    creator: item.artistName,
    creatorKind: kind === "book" || kind === "podcast" ? "publisher" : "label",
    year: toEpoch(item.releaseDate) ? new Date(toEpoch(item.releaseDate)!).getUTCFullYear() : undefined,
    country: item.country?.toUpperCase() ?? country.toUpperCase(),
    duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : undefined,
    genres: item.primaryGenreName ? [item.primaryGenreName] : undefined,
    description: item.longDescription ?? item.shortDescription,
    thumbnail: (item.artworkUrl600 ?? item.artworkUrl100)?.replace("100x100", "600x600bb"),
    externalUrl: item.trackViewUrl ?? item.collectionViewUrl ?? "https://www.apple.com/itunes/",
    previewUrl: hasPreview ? item.previewUrl : undefined,
    rssUrl: item.feedUrl,
    mediaFormat: kind === "podcast" ? "rss" : hasPreview ? "preview" : "metadata",
    publishedAt: toEpoch(item.releaseDate),
    releaseDate: toEpoch(item.releaseDate),
    /* Un extrait promotionnel reste un extrait : le moteur ne l'ouvre
       jamais comme une lecture complète. */
    rightsStatus: hasPreview ? "EMBED_ALLOWED" : "EXTERNAL_ONLY",
    license: hasPreview ? licenseByCode("APPLE-PREVIEW") : undefined,
    attribution: "Extrait promotionnel fourni par Apple",
    subtype: item.wrapperType ?? kind,
  };
}

export const itunes: ConnectorSpec = {
  key: "itunes",
  kinds: ["music", "movie", "series", "book", "podcast"],
  search: async (q, opts) => {
    const target = entityFor(opts.kind);
    if (!target) return [];
    const country = (opts.country ?? "US").toLowerCase();
    const params = new URLSearchParams({
      term: q,
      media: target.media,
      limit: String(Math.min(Math.max(opts.rows, 3), 200)),
      country,
    });
    if (target.entity) params.set("entity", target.entity);
    const data = await getJson<{ results?: ItunesItem[] }>(
      `https://itunes.apple.com/search?${params.toString()}`,
      {},
      12_000,
    );
    const seen = new Set<string>();
    return (data.results ?? [])
      .filter((r) => {
        const id = String(r.trackId ?? r.collectionId ?? "");
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, opts.rows)
      .map((r) => toHit(r, opts.kind ?? resolvedKind(opts.kind, r), country));
  },

  /**
   * Classements Apple (flux publics) : nouveautés et tendances réelles sans
   * requête. Un `lookup` groupé récupère ensuite les extraits jouables.
   */
  discover: async (opts) => {
    // Un classement Apple n'existe que pour la musique et les podcasts :
    // pour les autres rayons, ce connecteur ne renvoie rien plutôt que de
    // déverser un classement musical dans un rayon Films ou Livres.
    if (opts.kind !== "music" && opts.kind !== "podcast" && opts.kind !== null) return [];

    const country = (opts.country ?? "FR").toLowerCase();
    const n = Math.min(Math.max(opts.rows, 5), 25);

    if (opts.kind === "podcast") {
      const chart = await getJson<ItunesChart>(
        `https://rss.marketingtools.apple.com/api/v2/${country}/podcasts/top/${n}/podcasts.json`,
      );
      const ids = (chart.feed?.results ?? []).map((r) => r.id).filter(Boolean).slice(0, 15);
      if (!ids.length) return [];
      const details = await getJson<{ results?: ItunesItem[] }>(
        `https://itunes.apple.com/lookup?id=${ids.join(",")}&entity=podcast&country=${country}`,
        {},
        12_000,
      );
      return (details.results ?? [])
        .filter((r) => r.feedUrl)
        .map((r) => toHit(r, "podcast", country));
    }

    const chart = await getJson<ItunesChart>(
      `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${n}/songs.json`,
    );
    const chartItems = (chart.feed?.results ?? []).filter((r) => r.id);
    if (!chartItems.length) return [];

    const ids = chartItems.map((r) => r.id).slice(0, 15);
    let details: ItunesItem[] = [];
    try {
      const lookup = await getJson<{ results?: ItunesItem[] }>(
        `https://itunes.apple.com/lookup?id=${ids.join(",")}&entity=song&country=${country}`,
        {},
        12_000,
      );
      details = lookup.results ?? [];
    } catch {
      // Classement seul : on garde les fiches, sans extrait jouable.
      details = [];
    }
    const byId = new Map(details.map((d) => [String(d.trackId ?? d.collectionId), d]));

    return chartItems.map((item) => {
      const match = byId.get(String(item.id));
      if (match) return toHit(match, "music", country);
      return {
        source: "itunes",
        externalId: String(item.id),
        kind: "music",
        title: item.name ?? "Sans titre",
        creator: item.artistName,
        creatorKind: "label",
        country: country.toUpperCase(),
        genres: (item.genres ?? [])
          .map((g) => g.name)
          .filter((name): name is string => Boolean(name))
          .slice(0, 3),
        thumbnail: item.artworkUrl100?.replace("100x100", "600x600bb"),
        externalUrl: item.url ?? "https://music.apple.com/",
        mediaFormat: "metadata",
        publishedAt: toEpoch(item.releaseDate),
        releaseDate: toEpoch(item.releaseDate),
        rightsStatus: "EXTERNAL_ONLY",
        attribution: "Apple Music — classement public",
      } satisfies RawHit;
    });
  },
};

type ItunesChart = {
  feed?: {
    results?: Array<{
      id?: string;
      name?: string;
      artistName?: string;
      artworkUrl100?: string;
      url?: string;
      releaseDate?: string;
      genres?: { name?: string }[];
    }>;
  };
};

/** Exporté pour le connecteur podcasts (même mécanique de classement). */
export type { ItunesItem };
