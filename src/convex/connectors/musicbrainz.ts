import { contactHeaders } from "../ovEnv";
import { getJson, toEpoch, type ConnectorSpec, type RawHit } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   MUSICBRAINZ — référentiel musical ouvert (métadonnées, aucune lecture)

   Sert à enrichir les fiches musicales : année de première sortie, album,
   artiste, durée, pays d'origine. Aucun fichier n'est distribué ici, donc
   le statut reste EXTERNAL_ONLY — un moteur de métadonnées n'est jamais
   une source de streaming.
   ═══════════════════════════════════════════════════════════════════════ */

type MbRecording = {
  id: string;
  title?: string;
  length?: number;
  "artist-credit"?: { name?: string }[];
  "first-release-date"?: string;
  releases?: { title?: string; country?: string; date?: string }[];
  tags?: { name?: string }[];
};

export const musicbrainz: ConnectorSpec = {
  key: "musicbrainz",
  kinds: ["music"],
  search: async (q, opts) => {
    const data = await getJson<{ recordings?: MbRecording[] }>(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=${Math.min(
        Math.max(opts.rows, 3),
        20,
      )}`,
      contactHeaders(),
      12_000,
    );
    return (data.recordings ?? []).map((r) => {
      const release = r.releases?.[0];
      return {
        source: "musicbrainz",
        externalId: r.id,
        kind: "music",
        title: r.title ?? "Sans titre",
        creator: r["artist-credit"]?.map((c) => c.name).filter(Boolean).join(", "),
        creatorKind: "label",
        country: release?.country?.toUpperCase(),
        duration: r.length ? Math.round(r.length / 1000) : undefined,
        genres: r.tags?.map((t) => t.name ?? "").filter(Boolean).slice(0, 3),
        description: release?.title
          ? `Album : ${release.title}. Référentiel ouvert : aucun fichier audio n'est distribué.`
          : "Référentiel ouvert : aucun fichier audio n'est distribué.",
        externalUrl: `https://musicbrainz.org/recording/${r.id}`,
        mediaFormat: "metadata",
        releaseDate: toEpoch(r["first-release-date"]),
        publishedAt: toEpoch(release?.date ?? r["first-release-date"]),
        rightsStatus: "EXTERNAL_ONLY",
        attribution: "MusicBrainz (CC0)",
        subtype: "recording",
      } satisfies RawHit;
    });
  },
};
