import { getJson, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   RADIO — radio-browser.info (annuaire ouvert, sans clé)

   Les webradios diffusent publiquement leur flux : on lit ce flux en
   streaming, on ne copie rien et on ne le réhéberge pas. Les flux HLS
   (.m3u8) sont écartés : le lecteur HTML natif ne sait pas les décoder,
   mieux vaut ne pas proposer de bouton qui ne marcherait pas.
   ═══════════════════════════════════════════════════════════════════════ */

const ENDPOINT = "https://de1.api.radio-browser.info/json/stations/search";

type Station = {
  stationuuid?: string;
  name?: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  language?: string;
  votes?: number;
  clickcount?: number;
  codec?: string;
  bitrate?: number;
};

function toHit(station: Station): RawHit | null {
  const url = station.url_resolved;
  if (!station.stationuuid || !station.name || !url) return null;
  if (/\.m3u8(\?|$)/i.test(url)) return null; // HLS : non lisible nativement

  const languages = (station.language ?? "")
    .split(",")
    .map((l) => l.trim().slice(0, 2).toLowerCase())
    .filter((l) => l.length === 2);

  return {
    source: "radio",
    externalId: station.stationuuid,
    kind: "audio",
    title: station.name,
    creator: station.country,
    creatorKind: "broadcaster",
    country: station.countrycode?.toUpperCase(),
    language: languages[0],
    genres: (station.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4),
    description: [station.codec, station.bitrate ? `${station.bitrate} kbps` : null, station.country]
      .filter(Boolean)
      .join(" · "),
    thumbnail: station.favicon || undefined,
    externalUrl: station.homepage || url,
    streamUrl: url,
    mediaFormat: (station.codec ?? "mp3").toLowerCase(),
    popularity: station.clickcount,
    /* Flux public de la station : écoute en streaming, sans copie. */
    rightsStatus: "EMBED_ALLOWED",
    officialFeed: true,
    attribution: station.name,
    subtype: "radio",
  };
}

async function call(params: URLSearchParams): Promise<RawHit[]> {
  const data = await getJson<Station[]>(`${ENDPOINT}?${params.toString()}`, {}, 10_000);
  const out: RawHit[] = [];
  for (const station of data) {
    const hit = toHit(station);
    if (hit) out.push(hit);
  }
  return out;
}

function base(opts: SearchOpts, limit: number): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(limit),
    order: "clickcount",
    reverse: "true",
    hidebroken: "true",
    is_https: "true",
  });
  if (opts.country) params.set("countrycode", opts.country.toUpperCase());
  if (opts.lang) params.set("language", opts.lang);
  if (opts.sort === "new") params.set("order", "clicktrend");
  return params;
}

export const radio: ConnectorSpec = {
  key: "radio",
  kinds: ["audio"],
  search: async (q, opts) => {
    const params = base(opts, Math.min(Math.max(opts.rows * 2, 10), 40));
    params.set("name", q);
    return (await call(params)).slice(0, opts.rows);
  },
  discover: async (opts) => {
    // Les stations les plus écoutées : un rayon utilisable dès l'ouverture.
    const params = base({ ...opts, sort: opts.sort }, Math.min(Math.max(opts.rows * 2, 12), 60));
    return (await call(params)).slice(0, opts.rows);
  },
};
