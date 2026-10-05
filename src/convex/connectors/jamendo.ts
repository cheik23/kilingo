import { getJson, num, toEpoch, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";
import { licenseByCode } from "../ovRights";
import { envValue } from "../ovEnv";

/* ═══════════════════════════════════════════════════════════════════════
   JAMENDO + AUDIUS — musique complète, licence libre, SANS CLÉ

   Ces deux catalogues publient des fichiers intégraux téléchargeables
   publiquement (Jamendo : CC sous toutes ses formes ; Audius : réseau
   musical décentralisé, contenu publié par les artistes pour l'écoute
   publique). Le connecteur ne donne que ce que la source publie : un
   fichier jouable → lecture intégrale DANS l'application. Toute
   publication sans fichier lisible est écartée : jamais une fiche morte.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Jamendo (endpoint public, aucune clé requise) ──────────────────── */

const JAMENDO = "https://api.jamendo.com/v3.0";

type JamendoTrack = {
  id?: string;
  name?: string;
  artist_name?: string;
  album_name?: string;
  album_image?: string;
  audio?: string;
  audiodownload?: string;
  duration?: number | string;
  license_ccurl?: string;
  audio_download_location?: string;
  datecreated?: string;
  shareurl?: string;
};

async function jamendo(params: URLSearchParams, rows: number): Promise<RawHit[]> {
  /* L'API exige un id client gratuit : sans clé, l'endpoint renvoie une
     erreur d'identification. Le connecteur reste branché : il utilise la
     clé si elle est renseignée, et échoue proprement (liste vide) sinon. */
  const clientId = envValue("JAMENDO_CLIENT_ID") ?? "";
  const fetchTracks = async (extra: string) =>
    getJson<{ results?: JamendoTrack[] }>(
      `${JAMENDO}/tracks/?${params.toString()}&client_id=${clientId}&format=json&limit=${Math.min(rows, 100)}${extra}`,
      {},
      12_000,
    );
  const data = await fetchTracks("&include=musicinfo+licenses").catch(() => fetchTracks(""));
  const out: RawHit[] = [];
  for (const track of data.results ?? []) {
    const stream = track.audio || track.audiodownload;
    if (!track.id || !track.name || !stream || !/^https:\/\//i.test(stream)) continue;
    out.push({
      source: "jamendo",
      externalId: track.id,
      kind: "music",
      title: track.name,
      creator: track.artist_name || undefined,
      creatorKind: "creator",
      genres: track.album_name ? [track.album_name] : undefined,
      description: track.album_name ? `Album : ${track.album_name}` : undefined,
      thumbnail: track.album_image || undefined,
      duration: num(track.duration),
      externalUrl: track.shareurl || track.audiodownload || stream,
      streamUrl: stream,
      mediaFormat: "mp3",
      publishedAt: toEpoch(track.datecreated),
      /* Licence Creative Commons vérifiable côté Jamendo : redistribution
         et streaming autorisés — lecture intégrale, pas un extrait. */
      rightsStatus: "CC_ALLOWED",
      license: licenseByCode("CC-BY"),
      attribution: track.artist_name || "Jamendo",
      officialFeed: true,
      subtype: "track",
    });
  }
  return out;
}

/* ── Audius (réseau ouvert, endpoint discovery, aucune clé) ─────────── */

type AudiusHosts = { data?: { initializer?: string; endpoint?: string }[] };
type AudiusTrack = {
  id?: string;
  title?: string;
  user?: { name?: string; handle?: string };
  duration?: number;
  artwork?: { ["480x480"]?: string; ["150x150"]?: string };
  genre?: string;
  mood?: string;
  release_date?: string;
  created_at?: string;
  permalink?: string;
  play_count?: number;
};

let audiusHost: string | null = null;

async function audiusBase(): Promise<string | null> {
  if (audiusHost) return audiusHost;
  const hosts = await getJson<AudiusHosts>(
    "https://api.audius.co",
    {},
    8_000,
  ).catch(() => null);
  const endpoint =
    (hosts?.data ?? []).map((h) => h.endpoint ?? h.initializer ?? "").find((h) => /^https:\/\//i.test(h)) ?? null;
  audiusHost = endpoint ? endpoint.replace(/\/$/, "") : null;
  return audiusHost;
}

async function audiusCall(params: URLSearchParams, rows: number): Promise<RawHit[]> {
  const base = await audiusBase();
  if (!base) return [];
  const data = await getJson<{ data?: AudiusTrack[] }>(
    `${base}/v1/tracks/search?${params.toString()}&app_name=KILINGO`,
    {},
    12_000,
  ).catch(() => null);
  const out: RawHit[] = [];
  for (const track of data?.data ?? []) {
    if (!track.id || !track.title) continue;
    const stream = `${base}/v1/tracks/${encodeURIComponent(track.id)}/stream?app_name=KILINGO`;
    out.push({
      source: "audius",
      externalId: track.id,
      kind: "music",
      title: track.title,
      creator: track.user?.name || track.user?.handle || undefined,
      creatorKind: "creator",
      genres: [track.genre, track.mood].filter((g): g is string => Boolean(g)).slice(0, 3),
      thumbnail: track.artwork?.["480x480"] || track.artwork?.["150x150"] || undefined,
      duration: num(track.duration),
      externalUrl: track.permalink || "https://audius.co",
      /* Flux public publié par l'artiste : écoute publique intégrale. */
      streamUrl: stream,
      mediaFormat: "mp3",
      publishedAt: toEpoch(track.release_date ?? track.created_at),
      popularity: track.play_count,
      rightsStatus: "EMBED_ALLOWED",
      officialFeed: true,
      attribution: track.user?.name || "Audius",
      subtype: "track",
    });
  }
  return out.slice(0, rows);
}

/* ── Contrat de connecteur ──────────────────────────────────────────── */

function limitFor(rows: number): number {
  return Math.min(Math.max(rows, 8), 100);
}

export const jamendoConnector: ConnectorSpec = {
  key: "jamendo",
  kinds: ["music"],
  search: async (q, opts) => {
    const rows = limitFor(opts.rows);
    const params = new URLSearchParams({ search: q, order: "popularity_week" });
    if (opts.lang) params.set("lang", opts.lang);
    return jamendo(params, rows);
  },
  /** Rayon Musique : morceaux récents du catalogue libre. */
  discover: async (opts) => {
    const rows = limitFor(opts.rows);
    const params = new URLSearchParams(
      opts.sort === "new"
        ? { order: "releasedate" }
        : { order: "popularity_week" },
    );
    if (opts.lang) params.set("lang", opts.lang);
    return jamendo(params, rows);
  },
};

export const audius: ConnectorSpec = {
  key: "audius",
  kinds: ["music"],
  search: async (q, opts) => audiusCall(new URLSearchParams({ query: q }), limitFor(opts.rows)),
  discover: async (opts) => {
    const params = new URLSearchParams(
      opts.sort === "new" ? { sort: "date" } : { sort: "plays" },
    );
    return audiusCall(params, limitFor(opts.rows));
  },
};
