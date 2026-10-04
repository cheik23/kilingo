import { licenseByCode } from "../ovRights";
import { getJson, num, toEpoch, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   DEEZER — catalogue musical réel, sans clé

   Source « index » : métadonnées + extrait officiel de 30 s fourni par
   Deezer, jouable dans le lecteur intégré. L'œuvre complète reste sur les
   plateformes officielles : le Rights Engine traite ces résultats en
   EMBED_ALLOWED / extrait, jamais en lecture complète.
   ═══════════════════════════════════════════════════════════════════════ */

type DeezerArtist = { id?: number; name?: string; picture_medium?: string };

type DeezerAlbum = { id?: number; title?: string; cover_medium?: string; cover_big?: string };

type DeezerTrack = {
  id?: number;
  title?: string;
  duration?: number; // secondes
  preview?: string; // mp3 officiel 30 s
  link?: string;
  release_date?: string;
  rank?: number;
  explicit_lyrics?: boolean;
  artist?: DeezerArtist;
  album?: DeezerAlbum;
};

type DeezerEnvelope = { data?: DeezerTrack[]; error?: { message?: string } };

function trackHit(track: DeezerTrack): RawHit | null {
  if (!track.id || !track.title) return null;
  const hasPreview = typeof track.preview === "string" && track.preview.startsWith("http");
  const publishedAt = toEpoch(track.release_date);
  return {
    source: "deezer",
    externalId: String(track.id),
    kind: "music",
    title: track.title,
    creator: track.artist?.name,
    creatorKind: "label",
    year: publishedAt ? new Date(publishedAt).getUTCFullYear() : undefined,
    duration: num(track.duration),
    thumbnail: track.album?.cover_big ?? track.album?.cover_medium ?? track.artist?.picture_medium,
    externalUrl: track.link ?? "https://www.deezer.com",
    previewUrl: hasPreview ? track.preview : undefined,
    mediaFormat: hasPreview ? "preview" : "metadata",
    publishedAt,
    releaseDate: publishedAt,
    popularity: num(track.rank),
    /* Extrait officiel publié par Deezer pour l'écoute publique. */
    rightsStatus: hasPreview ? "EMBED_ALLOWED" : "EXTERNAL_ONLY",
    license: hasPreview ? licenseByCode("OFFICIAL-PREVIEW") : undefined,
    attribution: hasPreview ? "Extrait officiel fourni par Deezer" : undefined,
    subtype: "track",
  };
}

async function fetchTracks(url: string): Promise<DeezerTrack[]> {
  const data = await getJson<DeezerEnvelope>(url, {}, 12_000);
  if (data.error?.message) throw new Error(data.error.message);
  return data.data ?? [];
}

export const deezer: ConnectorSpec = {
  key: "deezer",
  kinds: ["music"],
  search: async (q, opts: SearchOpts) => {
    const wanted = Math.min(Math.max(opts.rows, 3), 300);
    // Deezer renvoie 25 par page par défaut : on enchaîne les pages
    // (index 0, 100, 200…) jusqu'au volume demandé.
    const pages: DeezerTrack[][] = [];
    let index = 0;
    while (pages.flat().length < wanted && index < 300) {
      const params = new URLSearchParams({ q, limit: "100", index: String(index) });
      const tracks = await fetchTracks(`https://api.deezer.com/search?${params.toString()}`);
      if (!tracks.length) break;
      pages.push(tracks);
      index += 100;
    }
    const seen = new Set<string>();
    const out: RawHit[] = [];
    for (const track of pages.flat()) {
      const hit = trackHit(track);
      if (!hit) continue;
      // Un même morceau peut revenir en plusieurs versions : on garde la première.
      const dedupeKey = `${hit.title.toLowerCase().slice(0, 60)}|${(hit.creator ?? "").toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(hit);
      if (out.length >= opts.rows) break;
    }
    return out;
  },

  /** Classement global Deezer : morceaux les plus écoutés maintenant. */
  discover: async (opts) => {
    const limit = Math.min(Math.max(opts.rows, 5), 100);
    const tracks = await fetchTracks(`https://api.deezer.com/chart/0/tracks?limit=${limit}`);
    return tracks
      .map(trackHit)
      .filter((hit): hit is RawHit => hit !== null)
      .slice(0, opts.rows);
  },
};
