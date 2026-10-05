import type { ItunesItem } from "./itunes";
import { getJson, getText, parseFeed, toEpoch, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   PODCASTS — index (Apple) + flux RSS publié par l'éditeur

   Un podcast est *distribué* par son éditeur sous forme de flux RSS public :
   l'écouter dans un lecteur est précisément l'usage prévu. On lit donc
   l'enclosure officielle en streaming — jamais une copie, jamais un
   hébergement, jamais un téléchargement côté KILINGO.

   En revanche, produire une transcription reste une œuvre dérivée : le
   Rights Engine la refuse tant que l'éditeur ne l'a pas autorisée
   (un contenu peut être débloqué explicitement dans l'admin).
   ═══════════════════════════════════════════════════════════════════════ */

function showHit(item: ItunesItem, country: string): RawHit {
  const id = item.collectionId ?? item.trackId ?? 0;
  return {
    source: "podcasts",
    externalId: String(id),
    kind: "podcast",
    title: item.collectionName ?? item.trackName ?? "Podcast",
    creator: item.artistName,
    creatorKind: "broadcaster",
    country: country.toUpperCase(),
    genres: item.primaryGenreName ? [item.primaryGenreName] : undefined,
    description: item.longDescription ?? item.shortDescription,
    thumbnail: (item.artworkUrl600 ?? item.artworkUrl100)?.replace("100x100", "600x600bb"),
    externalUrl: item.collectionViewUrl ?? item.trackViewUrl ?? "https://podcasts.apple.com/",
    rssUrl: item.feedUrl,
    mediaFormat: "rss",
    publishedAt: toEpoch(item.releaseDate),
    releaseDate: toEpoch(item.releaseDate),
    /* La fiche « émission » est un conteneur : sa lecture se fait épisode
       par épisode (chacun évalué séparément par le Rights Engine). */
    rightsStatus: "EXTERNAL_ONLY",
    attribution: "Index Apple Podcasts",
    subtype: "show",
  };
}

async function searchShows(q: string, opts: SearchOpts): Promise<RawHit[]> {
  const country = (opts.country ?? "FR").toLowerCase();
  const params = new URLSearchParams({
    term: q,
    media: "podcast",
    entity: "podcast",
    limit: String(Math.min(Math.max(opts.rows, 3), 25)),
    country,
  });
  const data = await getJson<{ results?: ItunesItem[] }>(
    `https://itunes.apple.com/search?${params.toString()}`,
    {},
    12_000,
  );
  return (data.results ?? []).filter((r) => r.feedUrl).slice(0, opts.rows).map((r) => showHit(r, country));
}

async function chartShows(opts: SearchOpts): Promise<RawHit[]> {
  const country = (opts.country ?? "FR").toLowerCase();
  const n = Math.min(Math.max(opts.rows, 5), 25);
  const chart = await getJson<{
    feed?: { results?: { id?: string }[] };
  }>(`https://rss.marketingtools.apple.com/api/v2/${country}/podcasts/top/${n}/podcasts.json`);
  const ids = (chart.feed?.results ?? []).map((r) => r.id).filter((id): id is string => Boolean(id)).slice(0, 15);
  if (!ids.length) return [];
  const lookup = await getJson<{ results?: ItunesItem[] }>(
    `https://itunes.apple.com/lookup?id=${ids.join(",")}&entity=podcast&country=${country}`,
    {},
    12_000,
  );
  return (lookup.results ?? []).filter((r) => r.feedUrl).map((r) => showHit(r, country));
}

/** Un épisode de flux est-il exploitable ? (enclosure publiée) */
function isPlayable(enclosure?: string, type?: string): boolean {
  if (!enclosure) return false;
  if (!/^https?:\/\//i.test(enclosure)) return false;
  if (type && !/^audio\//i.test(type) && !/^video\//i.test(type)) return false;
  return true;
}

/**
 * Parcourt un flux RSS de podcast et normalise ses épisodes.
 * Utilisé par la fiche (section « Épisodes ») et par le connecteur RSS.
 */
export async function feedEpisodes(
  feedUrl: string,
  source = "podcasts",
  limit = 20,
): Promise<{ title?: string; author?: string; image?: string; description?: string; episodes: RawHit[] }> {
  const xml = await getText(feedUrl, { Accept: "application/rss+xml, application/xml, text/xml, */*" }, 15_000);
  const feed = parseFeed(xml, limit);

  const episodes: RawHit[] = feed.items.map((item, index) => {
    const playable = isPlayable(item.enclosureUrl, item.enclosureType);
    const isVideo = Boolean(item.enclosureType && /^video\//i.test(item.enclosureType));
    return {
      source,
      externalId: `${feedUrl}#${item.link ?? item.title ?? index}`,
      kind: isVideo ? "video" : playable ? "podcast" : "article",
      title: item.title,
      creator: item.author ?? feed.author,
      creatorKind: "broadcaster",
      duration: item.duration,
      description: item.description ?? feed.description,
      thumbnail: item.image ?? feed.image,
      externalUrl: item.link ?? feedUrl,
      streamUrl: playable ? item.enclosureUrl : undefined,
      mediaFormat: isVideo ? "video" : "mp3",
      publishedAt: item.publishedAt,
      /* Épisode publié par l'éditeur pour une écoute publique.
         Aucune licence n'est inventée : c'est le mode de distribution
         (flux officiel intégré) qui fonde la décision, pas une licence. */
      rightsStatus: playable ? "EMBED_ALLOWED" : "EXTERNAL_ONLY",
      officialFeed: playable,
      attribution: feed.title ?? feedUrl,
      subtype: "episode",
    } satisfies RawHit;
  });

  return {
    title: feed.title,
    author: feed.author,
    image: feed.image,
    description: feed.description,
    episodes,
  };
}

export const podcasts: ConnectorSpec = {
  key: "podcasts",
  kinds: ["podcast"],
  search: searchShows,
  discover: chartShows,
  detail: async (externalId, opts) => {
    const id = Number(externalId);
    if (!Number.isFinite(id)) return null;
    const country = (opts?.country ?? "FR").toLowerCase();
    const lookup = await getJson<{ results?: ItunesItem[] }>(
      `https://itunes.apple.com/lookup?id=${id}&entity=podcast&country=${country}`,
      {},
      12_000,
    );
    const item = lookup.results?.[0];
    return item ? showHit(item, country) : null;
  },
};
