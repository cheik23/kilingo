import { getJson, num, stripHtml, toEpoch, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   DAILYMOTION — API publique, SANS CLÉ

   Lecture dans MOOVY via le lecteur officiel (dailymotion.com/embed).
   L'API expose un tri natif par date : le rayon Vidéos affiche de vraies
   nouveautés, pas un catalogue figé.
   ═══════════════════════════════════════════════════════════════════════ */

const API = "https://api.dailymotion.com";

type DmVideo = {
  id?: string;
  title?: string;
  description?: string;
  "owner.screenname"?: string;
  "thumbnail_480_url"?: string;
  "thumbnail_240_url"?: string;
  duration?: number;
  created_time?: number;
  "views_total"?: number;
  "channel.name"?: string;
  "language"?: string;
};

const FIELDS = [
  "id",
  "title",
  "description",
  "owner.screenname",
  "thumbnail_480_url",
  "duration",
  "created_time",
  "views_total",
  "channel.name",
  "language",
].join(",");

function toHit(video: DmVideo): RawHit | null {
  if (!video.id || !video.title) return null;
  return {
    source: "dailymotion",
    externalId: video.id,
    kind: "video",
    title: video.title,
    creator: video["owner.screenname"],
    creatorKind: "creator",
    language: video.language?.slice(0, 2),
    genres: video["channel.name"] ? [video["channel.name"]] : undefined,
    description: video.description ? stripHtml(video.description).slice(0, 600) : undefined,
    thumbnail: video["thumbnail_480_url"],
    duration: num(video.duration),
    externalUrl: `https://www.dailymotion.com/video/${video.id}`,
    embedUrl: `https://www.dailymotion.com/embed/video/${video.id}`,
    mediaFormat: "embed",
    publishedAt: toEpoch(video.created_time),
    lastUpdatedAt: toEpoch(video.created_time),
    popularity: num(video["views_total"]),
    /* Lecteur officiel intégré : lecture dans l'app, zéro copie. */
    rightsStatus: "EMBED_ALLOWED",
    attribution: video["owner.screenname"],
    subtype: "video",
  };
}

async function call(params: URLSearchParams): Promise<RawHit[]> {
  const wanted = Number(params.get("__wanted") ?? 100);
  params.delete("__wanted");
  params.set("fields", FIELDS);
  // Dailymotion envoie 100 vidéos par page maximum : on enchaîne les pages
  // (limit=100, page 1, 2, …) jusqu'au volume demandé.
  params.set("limit", "100");
  const out: RawHit[] = [];
  let page = 1;
  while (out.length < wanted && page <= 3) {
    params.set("page", String(page));
    const data = await getJson<{ list?: DmVideo[] }>(`${API}/videos?${params.toString()}`, {}, 12_000);
    const batch = data.list ?? [];
    if (!batch.length) break;
    for (const video of batch) {
      const hit = toHit(video);
      if (hit) out.push(hit);
    }
    page += 1;
  }
  return out.slice(0, wanted);
}

function base(opts: SearchOpts): URLSearchParams {
  const params = new URLSearchParams();
  // Les vidéos privées/supprimées ne produiraient que des fiches mortes.
  params.set("flags", "no_live");
  if (opts.lang) params.set("languages", opts.lang);
  return params;
}

export const dailymotion: ConnectorSpec = {
  key: "dailymotion",
  kinds: ["video", "music"],
  search: async (q, opts) => {
    const params = base(opts);
    params.set("search", q);
    params.set("sort", opts.sort === "new" ? "recent" : "relevance");
    params.set("__wanted", String(Math.min(Math.max(opts.rows, 3), 200)));
    return await call(params);
  },
  /** Rayon Vidéos : nouveautés ou tendances réelles de la plateforme. */
  discover: async (opts) => {
    const params = base(opts);
    params.set("sort", opts.sort === "popular" || opts.sort === "trending" ? "visited" : "recent");
    params.set("__wanted", String(Math.min(Math.max(opts.rows, 3), 200)));
    return await call(params);
  },
};
