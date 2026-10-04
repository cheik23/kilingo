import { envValue } from "../ovEnv";
import { getJson, toEpoch, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   YOUTUBE — deux portes d'entrée, UNE seule façon de regarder

   1. API Data v3 *officielle* (clé gratuite YOUTUBE_API_KEY) :
      `search.list` + `videos.list` fournissent métadonnées, durées, vues.

   2. Sans clé : un connecteur de *découverte* interroge des instances
      publiques (Invidious / Piped) uniquement pour TROUVER les vidéos
      (titres, identifiants, durées). La lecture, elle, se fait toujours
      dans le lecteur officiel intégré (youtube-nocookie.com/embed/<id>) :
      rien n'est téléchargé, copié ni réhébergé — le Rights Engine marque
      ces résultats EMBED_ALLOWED exactement comme l'API officielle.

   Sans aucune des deux, le connecteur reste présent mais inactif :
   le registre l'annonce honnêtement comme « indisponible ».
   ═══════════════════════════════════════════════════════════════════════ */

const API = "https://www.googleapis.com/youtube/v3";

type YtSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    description?: string;
    categoryId?: string;
    liveBroadcastContent?: string;
    defaultAudioLanguage?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
  };
};

type YtVideoItem = {
  id?: string;
  snippet?: YtSearchItem["snippet"];
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string };
};

/** « PT1H2M3S » → secondes. */
function isoDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return undefined;
  const [, d, h, m, s] = match;
  const total = Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return total > 0 ? total : undefined;
}

function apiKey(): string | undefined {
  return envValue("YOUTUBE_API_KEY");
}

function toHit(item: YtVideoItem, country?: string): RawHit | null {
  const id = item.id;
  const snippet = item.snippet;
  if (!id || !snippet?.title) return null;
  // Catégorie 10 = Musique : un clip reste de la musique dans les rayons.
  const kind: RawHit["kind"] = snippet.categoryId === "10" ? "music" : "video";
  const live = snippet.liveBroadcastContent === "live";

  return {
    source: "youtube",
    externalId: id,
    kind,
    title: snippet.title,
    creator: snippet.channelTitle,
    creatorKind: "creator",
    language: snippet.defaultAudioLanguage?.slice(0, 2),
    country,
    duration: isoDuration(item.contentDetails?.duration),
    description: snippet.description?.slice(0, 700),
    thumbnail: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url,
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    mediaFormat: live ? "live" : "embed",
    publishedAt: toEpoch(snippet.publishedAt),
    lastUpdatedAt: toEpoch(snippet.publishedAt),
    popularity: item.statistics?.viewCount ? Number(item.statistics.viewCount) : undefined,
    /* Lecteur officiel intégré : lecture dans l'app, zéro copie, zéro
       hébergement, aucun contournement. */
    rightsStatus: "EMBED_ALLOWED",
    attribution: snippet.channelTitle,
    subtype: live ? "live" : "video",
  };
}

/* ── Découverte sans clé : instances publiques (recherche seule) ─────── */

type InvidiousItem = {
  videoId?: string;
  title?: string;
  author?: string;
  lengthSeconds?: number;
  published?: number; // epoch s
  viewCount?: number;
  videoThumbnails?: { url?: string }[];
};

type PipedItem = {
  url?: string; // /watch?v=ID
  title?: string;
  uploaderName?: string;
  duration?: number; // s
  thumbnail?: string;
  uploaded?: number; // epoch ms
  views?: number;
};

function invidiousHit(item: InvidiousItem): RawHit | null {
  const id = item.videoId;
  if (!id || !item.title) return null;
  const publishedMs = item.published ? item.published * 1000 : undefined;
  return {
    source: "youtube",
    externalId: id,
    kind: "video",
    title: item.title,
    creator: item.author,
    creatorKind: "creator",
    duration: item.lengthSeconds && item.lengthSeconds > 0 ? item.lengthSeconds : undefined,
    thumbnail: item.videoThumbnails?.[0]?.url,
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    mediaFormat: "embed",
    publishedAt: publishedMs,
    lastUpdatedAt: publishedMs,
    popularity: item.viewCount,
    /* Découverte uniquement : la lecture reste le lecteur officiel intégré. */
    rightsStatus: "EMBED_ALLOWED",
    attribution: item.author,
    subtype: "video",
  };
}

function pipedHit(item: PipedItem): RawHit | null {
  const id = item.url?.match(/[?&]v=([\w-]{6,})/)?.[1];
  if (!id || !item.title) return null;
  return {
    source: "youtube",
    externalId: id,
    kind: "video",
    title: item.title,
    creator: item.uploaderName,
    creatorKind: "creator",
    duration: item.duration && item.duration > 0 ? item.duration : undefined,
    thumbnail: item.thumbnail,
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    mediaFormat: "embed",
    publishedAt: item.uploaded && item.uploaded > 0 ? item.uploaded : undefined,
    lastUpdatedAt: item.uploaded && item.uploaded > 0 ? item.uploaded : undefined,
    popularity: item.views,
    /* Découverte uniquement : la lecture reste le lecteur officiel intégré. */
    rightsStatus: "EMBED_ALLOWED",
    attribution: item.uploaderName,
    subtype: "video",
  };
}

async function firstJson<T>(urls: string[], pick: (data: unknown) => T[]): Promise<T[]> {
  for (const url of urls) {
    const data = await getJson<unknown>(url, {}, 9_000).catch(() => null);
    if (!data) continue;
    try {
      const out = pick(data);
      if (out.length) return out;
    } catch {
      // Instance incompréhensible : on passe à la suivante.
    }
  }
  return [];
}

/** Instances publiques actives (vérifiées en direct). */
const PIPED_BASES = ["https://pipedapi.ducks.party", "https://api.piped.private.coffee"];

/**
 * Recherche publique de découverte via Piped : 20 vidéos par page, on
 * enchaîne les pages (jeton fourni par la source) jusqu'au volume voulu.
 * Découverte uniquement — la lecture reste l'embed officiel.
 */
async function pipedSearch(q: string, rows: number): Promise<RawHit[]> {
  for (const base of PIPED_BASES) {
    const out: RawHit[] = [];
    const seen = new Set<string>();
    try {
      let token: string | undefined;
      for (let page = 0; page < 5 && out.length < rows; page++) {
        const url = token
          ? `${base}/nextpage/search?${new URLSearchParams({ nextpage: token, q, filter: "videos" })}`
          : `${base}/search?${new URLSearchParams({ q, filter: "videos" })}`;
        const data = await getJson<{ items?: PipedItem[]; nextpage?: string }>(url, {}, 9_000);
        const batch = data.items ?? [];
        if (!batch.length) break;
        for (const item of batch) {
          const hit = pipedHit(item);
          if (hit && !seen.has(hit.externalId)) {
            seen.add(hit.externalId);
            out.push(hit);
          }
        }
        token = data.nextpage;
        if (!token) break;
      }
      if (out.length) return out.slice(0, rows);
    } catch {
      // Instance muette ou lente : on essaie la suivante.
    }
  }
  return [];
}

/** Recherche publique de découverte (aucune clé, aucun téléchargement). */
async function discoverSearch(q: string, rows: number): Promise<RawHit[]> {
  // Porte 1 : Piped paginé (le plus fiable en ce moment).
  const piped = await pipedSearch(q, rows);
  if (piped.length) return piped;
  // Porte 2 : Invidious, une requête unique.
  const enc = encodeURIComponent(q);
  const invidious = await firstJson<InvidiousItem>(
    [
      `https://yewtu.be/api/v1/search?q=${enc}&type=video&sort_by=relevance`,
      `https://invidious.nerdvpn.de/api/v1/search?q=${enc}&type=video&sort_by=relevance`,
      `https://inv.nadeko.net/api/v1/search?q=${enc}&type=video&sort_by=relevance`,
    ],
    (data) => (Array.isArray(data) ? data : []),
  );
  return invidious
    .map(invidiousHit)
    .filter((hit): hit is RawHit => hit !== null)
    .slice(0, rows);
}

async function videosById(ids: string[]): Promise<YtVideoItem[]> {
  const key = apiKey();
  if (!key || !ids.length) return [];
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: ids.slice(0, 50).join(","),
    key,
  });
  const data = await getJson<{ items?: YtVideoItem[] }>(`${API}/videos?${params.toString()}`, {}, 12_000);
  return data.items ?? [];
}

/** Filtre « clips courts » : la source classe elle-même les < 4 minutes. */
function shortParams(q: string, rows: number, key: string, order: string): URLSearchParams {
  const params = new URLSearchParams({
    part: "snippet",
    q,
    type: "video",
    order,
    videoDuration: "short",
    maxResults: String(Math.min(Math.max(rows, 3), 50)),
    key,
    safeSearch: "moderate",
  });
  return params;
}

export const youtube: ConnectorSpec = {
  key: "youtube",
  kinds: ["video", "music", "podcast", "article"],
  search: async (q, opts) => {
    const key = apiKey();
    const rows = Math.min(Math.max(opts.rows, 3), 100);

    if (!key) return discoverSearch(q, rows);

    // Tri côté source : « new » demande les vidéos les plus récentes
    // (exigence « contenu actuel ») ; les autres ordres restent pertinents.
    const order = opts.sort === "new" ? "date" : "relevance";
    const region = (opts.country ?? "FR").toUpperCase();
    const params = new URLSearchParams({
      part: "snippet",
      q,
      type: "video",
      order,
      maxResults: String(Math.min(Math.max(rows, 3), 50)),
      key,
      safeSearch: "moderate",
    });
    params.set("regionCode", region);
    if (opts.lang) params.set("relevanceLanguage", opts.lang);

    // Gros volume sur le rayon Vidéos : on ajoute un passage « clips
    // courts » (videoDuration=short) pour garnir la section dédiée.
    const wantShorts = rows >= 60 && (opts.kind === null || opts.kind === "video");
    const [data, shorts] = await Promise.all([
      getJson<{ items?: YtSearchItem[] }>(`${API}/search?${params.toString()}`, {}, 12_000),
      wantShorts
        ? getJson<{ items?: YtSearchItem[] }>(
            `${API}/search?${shortParams(q, 50, key, order).toString()}`,
            {},
            12_000,
          ).catch(() => ({ items: [] as YtSearchItem[] }))
        : Promise.resolve({ items: [] as YtSearchItem[] }),
    ]);

    const ids = [...(data.items ?? []), ...(shorts.items ?? [])]
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));
    const unique = [...new Set(ids)];
    // `search.list` ne renvoie ni durée ni vues : un second appel groupé les
    // récupère (un seul appel pour jusqu'à 50 vidéos).
    const details = await videosById(unique);
    const out: RawHit[] = [];
    for (const item of details) {
      const hit = toHit(item, region);
      if (hit) out.push(hit);
    }
    if (out.length) {
      // Les courts sans fiche enrichie gardent leurs métadonnées de recherche.
      if (out.length >= rows) return out.slice(0, rows);
      const seen = new Set(out.map((h) => h.externalId));
      for (const item of [...(data.items ?? []), ...(shorts.items ?? [])]) {
        const id = item.id?.videoId;
        if (!id || seen.has(id) || !item.snippet?.title) continue;
        const hit = toHit({ id, snippet: item.snippet }, region);
        if (hit) {
          out.push(hit);
          seen.add(id);
        }
      }
      return out.slice(0, rows);
    }

    // Repli : métadonnées de recherche seules (sans durée ni vues).
    const fallback: RawHit[] = [];
    for (const item of [...(data.items ?? []), ...(shorts.items ?? [])]) {
      const id = item.id?.videoId;
      if (!id || !item.snippet?.title) continue;
      const hit = toHit({ id, snippet: item.snippet }, region);
      if (hit) fallback.push(hit);
    }
    return fallback.slice(0, rows);
  },
  /** Classement officiel « les plus populaires » par pays et catégorie. */
  discover: async (opts) => {
    const key = apiKey();
    if (!key) return [];
    const region = (opts.country ?? "FR").toUpperCase();
    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      chart: "mostPopular",
      regionCode: region,
      maxResults: String(Math.min(Math.max(opts.rows, 5), 50)),
      key,
    });
    if (opts.lang) params.set("relevanceLanguage", opts.lang);
    const data = await getJson<{ items?: YtVideoItem[] }>(`${API}/videos?${params.toString()}`, {}, 12_000);
    const out: RawHit[] = [];
    for (const item of data.items ?? []) {
      const hit = toHit(item, region);
      if (hit) out.push(hit);
    }
    return out;
  },
  detail: async (externalId: string, _opts?: SearchOpts) => {
    const items = await videosById([externalId]);
    return items[0] ? toHit(items[0]) : null;
  },
};

/** Le connecteur est-il configuré ? (exposé au registre) */
export function youtubeReady(): boolean {
  return Boolean(apiKey());
}
