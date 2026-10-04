import { getJson, stripHtml, toEpoch, txt, type ConnectorSpec, type RawHit } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   SÉRIES — TVmaze (métadonnées ouvertes, sans clé)

   TVmaze raconte les séries, il ne les diffuse pas. Ce connecteur est donc
   structurellement « métadonnées » : le Rights Engine le classe
   EXTERNAL_ONLY, la fiche MOOVY reste interne (saisons, épisodes,
   genres, diffusion du jour) et la lecture renvoie vers la plateforme
   légale — ou vers un fichier que l'utilisateur possède.
   ═══════════════════════════════════════════════════════════════════════ */

type TvShow = {
  id?: number;
  name?: string;
  summary?: string | null;
  image?: { medium?: string; original?: string } | null;
  premiered?: string | null;
  ended?: string | null;
  language?: string | null;
  genres?: string[];
  weight?: number;
  averageRuntime?: number | null;
  runtime?: number | null;
  officialSite?: string | null;
  status?: string | null;
  network?: { country?: { code?: string }; name?: string } | null;
  webChannel?: { country?: { code?: string }; name?: string } | null;
  externals?: { imdb?: string | null; thetvdb?: number | null };
};

type TvEpisode = {
  id?: number;
  url?: string;
  name?: string;
  season?: number;
  number?: number;
  airdate?: string;
  airstamp?: string;
  runtime?: number | null;
  summary?: string | null;
  image?: { medium?: string } | null;
  _embedded?: { show?: TvShow };
};

/** TVmaze nomme les langues (« English ») : conversion ISO honnête. */
const TV_LANGS: Record<string, string> = {
  english: "en",
  french: "fr",
  spanish: "es",
  german: "de",
  italian: "it",
  portuguese: "pt",
  russian: "ru",
  arabic: "ar",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
  dutch: "nl",
  polish: "pl",
  turkish: "tr",
  hindi: "hi",
  danish: "da",
  swedish: "sv",
  norwegian: "no",
  finnish: "fi",
  hebrew: "he",
  greek: "el",
  czech: "cs",
  ukrainian: "uk",
};

function showLanguage(show: TvShow): string | undefined {
  const raw = show.language?.trim().toLowerCase();
  if (!raw) return undefined;
  return TV_LANGS[raw] ?? (raw.length === 2 ? raw : undefined);
}

function showCountry(show: TvShow): string | undefined {
  const code = show.network?.country?.code ?? show.webChannel?.country?.code;
  return code ? code.toUpperCase() : undefined;
}

function showHit(show: TvShow): RawHit | null {
  if (!show.id || !show.name) return null;
  return {
    source: "tvmaze",
    externalId: String(show.id),
    kind: "series",
    title: show.name,
    creator: show.network?.name ?? show.webChannel?.name ?? undefined,
    creatorKind: show.webChannel?.name ? "aggregator" : "broadcaster",
    country: showCountry(show),
    language: showLanguage(show),
    genres: show.genres?.slice(0, 4),
    description: show.summary ? stripHtml(show.summary).slice(0, 600) : undefined,
    thumbnail: show.image?.medium,
    externalUrl: show.officialSite ?? `https://www.tvmaze.com/shows/${show.id}`,
    mediaFormat: "metadata",
    releaseDate: toEpoch(show.premiered),
    publishedAt: toEpoch(show.premiered),
    popularity: show.weight,
    duration: show.averageRuntime ?? show.runtime ?? undefined,
    /* Métadonnées seules : aucun droit de diffusion n'en découle. */
    rightsStatus: "EXTERNAL_ONLY",
    attribution: "TVmaze",
    subtype: show.status ?? "show",
  };
}

function episodeHit(episode: TvEpisode, show?: TvShow): RawHit | null {
  const title = episode.name;
  if (!title) return null;
  const showName = show?.name ?? "";
  return {
    source: "tvmaze",
    externalId: String(episode.id ?? `${show?.id}-${episode.season}-${episode.number}`),
    kind: "series",
    title: showName
      ? `${showName} — S${String(episode.season ?? 0).padStart(2, "0")}E${String(episode.number ?? 0).padStart(2, "0")} · ${title}`
      : title,
    creator: show ? (show.network?.name ?? show.webChannel?.name ?? undefined) : undefined,
    country: show ? showCountry(show) : undefined,
    language: show ? showLanguage(show) : undefined,
    genres: show?.genres?.slice(0, 3),
    description: episode.summary ? stripHtml(episode.summary).slice(0, 400) : undefined,
    thumbnail: episode.image?.medium ?? show?.image?.medium,
    externalUrl: episode.url ?? (show?.id ? `https://www.tvmaze.com/shows/${show.id}` : "https://www.tvmaze.com"),
    mediaFormat: "metadata",
    duration: episode.runtime ?? undefined,
    publishedAt: toEpoch(episode.airstamp) ?? toEpoch(episode.airdate),
    rightsStatus: "EXTERNAL_ONLY",
    attribution: "TVmaze",
    subtype: "episode",
  };
}

/** Épisode → série : la fiche d'épisode a besoin de son parent. */
export const tvmaze: ConnectorSpec = {
  key: "tvmaze",
  kinds: ["series"],
  search: async (q, opts) => {
    const data = await getJson<Array<{ show?: TvShow }>>(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
      {},
      10_000,
    );
    const out: RawHit[] = [];
    for (const entry of data.slice(0, opts.rows)) {
      const hit = entry.show ? showHit(entry.show) : null;
      if (hit) out.push(hit);
    }
    return out;
  },
  /**
   * « Aujourd'hui à la télé / en streaming » : la seule liste de séries qui
   * soit réellement fraîche, et elle est fournie par la source elle-même.
   */
  discover: async (opts) => {
    const days = [0, 1];
    const requests = days.map((offset) => {
      const date = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
      return getJson<TvEpisode[]>(`https://api.tvmaze.com/schedule/web?date=${date}&embed=show`, {}, 12_000).catch(
        () => [] as TvEpisode[],
      );
    });
    const settled = await Promise.all(requests);
    const out: RawHit[] = [];
    const seenShows = new Set<string>();
    for (const episode of settled.flat()) {
      const show = episode._embedded?.show;
      const hit = episodeHit(episode, show);
      if (!hit) continue;
      const showKey = String(show?.id ?? hit.externalId);
      if (seenShows.has(showKey)) continue;
      seenShows.add(showKey);
      out.push(hit);
      if (out.length >= opts.rows) break;
    }
    return out;
  },
  detail: async (externalId) => {
    const id = txt(externalId);
    if (!id) return null;
    const show = await getJson<TvShow>(`https://api.tvmaze.com/shows/${encodeURIComponent(id)}`, {}, 10_000).catch(
      () => null,
    );
    return show ? showHit(show) : null;
  },
};

/** Liste des épisodes d'une série (utilisée par la fiche). */
export async function seriesEpisodes(showId: string, limit = 40): Promise<RawHit[]> {
  const data = await getJson<TvEpisode[]>(
    `https://api.tvmaze.com/shows/${encodeURIComponent(showId)}/episodes`,
    {},
    12_000,
  );
  const out: RawHit[] = [];
  for (const episode of data.slice(-limit).reverse()) {
    const hit = episodeHit(episode);
    if (hit) out.push(hit);
  }
  return out;
}
