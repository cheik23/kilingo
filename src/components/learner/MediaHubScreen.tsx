import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { Clapperboard, Film, FileUp, Loader2, Play, Search, Tv } from "lucide-react";
import { toast } from "sonner";
import { cn, friendlyError } from "@/lib/utils";
import { EmptyState } from "./MediaHubView";
import { YouTubeInlineSearch } from "./YouTubeInlineSearch";
import type { HubMedia } from "@/components/media/MediaRoomView";

/* ═══════════════════════════════════════════════════════════════════
   Films / Séries — séries TVmaze (keyless), films libres Archive.org,
   sous-titres .srt/.vtt personnels. Le sous-onglet YouTube renvoie vers
   le module Shadow existant (inchangé).
   ═══════════════════════════════════════════════════════════════════ */

type SubTab = "movies" | "youtube" | "series" | "free" | "subs";

function SubTabs({
  tab,
  onTab,
}: {
  tab: SubTab;
  onTab: (t: SubTab) => void;
}) {
  const TABS: Array<{ key: SubTab; label: string }> = [
    { key: "movies", label: "Films & séries" },
    { key: "youtube", label: "YouTube" },
    { key: "series", label: "Séries .srt" },
    { key: "free", label: "Films libres" },
    { key: "subs", label: "Mes sous-titres" },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onTab(t.key)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
            tab === t.key
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-white/10 text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Séries ─────────────────────────────────────────────────────────── */

/** TVmaze renvoie du HTML dans les synopsis — nettoyage avant affichage. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

type Show = {
  id: number;
  name: string;
  summary: string;
  image: string;
  premiered: string;
  language: string;
};
type Episode = {
  number: number;
  season: number;
  name: string;
  summary: string;
  airdate: string;
};

function SeriesPane({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [query, setQuery] = useState("");
  const [shows, setShows] = useState<Show[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [episodes, setEpisodes] = useState<{ show: string; list: Episode[] } | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  // B4 — métadonnées du show courant (poster/synopsis/année) : affichées
  // dans la MediaRoom quand la fiche n'a pas de lecteur.
  const showMetaRef = useRef<Show | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingEpisode = useRef<string>("");

  const searchShows = useAction(api.mediaHub3.tvmazeSearch);
  const loadEpisodes = useAction(api.mediaHub3.tvmazeEpisodes);
  const parseFile = useAction(api.mediaHub4.parseSubtitlesFile);
  const createMedia = useMutation(api.media.createHubMedia);
  const analyzeSegments = useAction(api.mediaHub2.analyzeHubSegments);

  async function doSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setEpisodes(null);
    try {
      setShows(await searchShows({ query: query.trim() }));
    } catch (err) {
      toast.error(friendlyError(err, "Recherche impossible."));
    } finally {
      setSearching(false);
    }
  }

  async function openEpisodes(show: Show) {
    showMetaRef.current = show;
    setLoadingEpisodes(true);
    try {
      const list = await loadEpisodes({ showId: show.id });
      setEpisodes({ show: show.name, list });
    } catch (err) {
      toast.error(friendlyError(err, "Épisodes indisponibles."));
    } finally {
      setLoadingEpisodes(false);
    }
  }

  async function handleSubtitleFile(file: File) {
    const label = pendingEpisode.current || file.name;
    setUploading(label);
    try {
      const content = await file.text();
      const segments = await parseFile({ content });
      const id = await createMedia({
        language: language as "en",
        title: label,
        sourceName: file.name,
        mediaType: "film",
      });
      await analyzeSegments({
        mediaId: id,
        language: language as "en",
        segments,
        transcriptSource: "subtitle_file",
      });
      toast.success("Sous-titres reçus — analyse en cours.");
      onOpenRoom({
        kind: "series",
        title: label,
        language,
        statusId: id,
        // B4 — métadonnées réelles du show (poster, synopsis, année).
        ...(showMetaRef.current
          ? {
              artworkUrl: showMetaRef.current.image,
              summary: stripHtml(showMetaRef.current.summary),
              year: showMetaRef.current.premiered?.slice(0, 4),
            }
          : {}),
      });
    } catch (err) {
      toast.error(friendlyError(err, "Analyse impossible."));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Une série… (ex : Peaky Blinders, Mr Robot)"
            aria-label="Rechercher une série"
            className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 font-medium text-noir disabled:opacity-50"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
        </button>
      </form>

      {!shows && !searching && (
        <EmptyState
          icon={<Tv className="size-6 text-gold" />}
          title="Analyse un épisode via ses sous-titres"
          hint="Choisis une série, récupère le .srt de l'épisode, et on s'occupe du reste."
          suggestions={["Peaky Blinders", "Mr Robot", "The Office"]}
        />
      )}

      {shows && shows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shows.map((s) => (
            <button
              key={s.id}
              onClick={() => void openEpisodes(s)}
              className="flex gap-3 rounded-2xl border border-white/5 bg-noir-2 p-3 text-left transition-colors hover:border-gold/40"
            >
              {s.image ? (
                <img src={s.image} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <Clapperboard className="size-5 text-ink-3" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                <p className="font-mono text-[0.625rem] text-ink-3">
                  {[s.premiered, s.language].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 line-clamp-3 text-xs text-ink-2">{s.summary}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {loadingEpisodes && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      )}

      {episodes && (
        <div className="space-y-2">
          <p className="font-mono text-xs text-gold">
            {episodes.show} — {episodes.list.length} épisodes
          </p>
          {episodes.list.map((e) => (
            <div
              key={`${e.season}-${e.number}`}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-noir-2 p-3"
            >
              <span className="shrink-0 rounded-md bg-white/5 px-2 py-1 font-mono text-[0.625rem] text-gold">
                S{String(e.season).padStart(2, "0")}E{String(e.number).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{e.name}</p>
                {e.summary && (
                  <p className="truncate text-xs text-ink-3">{e.summary}</p>
                )}
              </div>
              <button
                onClick={() => {
                  pendingEpisode.current = `${episodes.show} — S${e.season}E${e.number} ${e.name}`;
                  fileRef.current?.click();
                }}
                disabled={uploading !== null}
                className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
              >
                {uploading === pendingEpisode.current ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Analyser cet épisode"
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".srt,.vtt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleSubtitleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Films libres (Archive.org) ────────────────────────────────────── */

type Movie = { identifier: string; title: string; year: string; embedUrl: string };

function FreeFilmsPane({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState<Movie | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const searchMovies = useAction(api.mediaHub3.archiveMoviesSearch);
  const createMedia = useMutation(api.media.createHubMedia);
  const transcribe = useAction(api.mediaHub2.transcribeRemoteAudio);

  async function doSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setMovies(await searchMovies({ query: query.trim() }));
    } catch (err) {
      toast.error(friendlyError(err, "Recherche impossible."));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Un film à regarder… (ex : Nosferatu, Sherlock)"
            aria-label="Rechercher un film à regarder ici"
            className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 font-medium text-noir disabled:opacity-50"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
        </button>
      </form>

      {playing && (
        <div className="space-y-2">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/5">
            <iframe
              src={playing.embedUrl}
              title={playing.title}
              allow="fullscreen"
              className="h-full w-full"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink">{playing.title}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenRoom({
                  kind: "archive",
                  title: playing.title,
                  year: playing.year,
                  embedUrl: playing.embedUrl,
                  language,
                })}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-ink-2 hover:border-gold/40 hover:text-gold"
              >
                Ouvrir dans la MediaRoom
              </button>
            <button
              onClick={() => {
                void (async () => {
                  try {
                    // L'embed Archive.org ne donne pas d'URL de fichier directe :
                    // on tente le fichier mp4 standard d'Archive.
                    const r = await transcribe({
                      url: `https://archive.org/download/${playing.identifier}/${playing.identifier}.mp4`,
                      title: playing.title,
                      language: language as "en",
                    });
                    toast.success("Analyse lancée — ouverture de la MediaRoom.");
                    onOpenRoom({
                      kind: "archive",
                      title: playing.title,
                      year: playing.year,
                      embedUrl: playing.embedUrl,
                      language,
                      statusId: (r as { mediaId?: string }).mediaId,
                    });
                  } catch (err) {
                    toast.error(
                      friendlyError(err, "Analyse impossible."),
                    );
                  }
                })();
              }}
              className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs text-gold hover:bg-gold/20"
            >
              Analyser l'audio
            </button>
          </div>
          </div>
        </div>
      )}

      {!movies && !searching && !playing && (
        <EmptyState
          icon={<Clapperboard className="size-6 text-gold" />}
          title="Des films à regarder directement ici"
          hint="Des milliers de films libres, lisibles dans KILINGO sans quitter l'application."
          suggestions={["Nosferatu", "Sherlock Jr", "Metropolis"]}
        />
      )}

      {movies && movies.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {movies.map((m) => (
            <button
              key={m.identifier}
              onClick={() => setPlaying(m)}
              className="rounded-2xl border border-white/5 bg-noir-2 p-3 text-left transition-colors hover:border-gold/40"
            >
              <p className="line-clamp-2 text-sm font-medium text-ink">{m.title}</p>
              <p className="mt-1 font-mono text-[0.625rem] text-ink-3">{m.year}</p>
            </button>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".srt,.vtt" className="hidden" />
    </div>
  );
}

/* ── Mes sous-titres ───────────────────────────────────────────────── */

function SubsPane({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [lang, setLang] = useState(language);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const parseFile = useAction(api.mediaHub4.parseSubtitlesFile);
  const createMedia = useMutation(api.media.createHubMedia);
  const analyzeSegments = useAction(api.mediaHub2.analyzeHubSegments);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const content = await file.text();
      const segments = await parseFile({ content });
      const id = await createMedia({
        language: lang as "en",
        title: file.name.replace(/\.(srt|vtt)$/i, ""),
        sourceName: file.name,
        mediaType: "film",
      });
      await analyzeSegments({
        mediaId: id,
        language: lang as "en",
        segments,
        transcriptSource: "subtitle_file",
      });
      toast.success("Sous-titres reçus — analyse en cours.");
      onOpenRoom({
        kind: "archive",
        title: file.name.replace(/\.(srt|vtt)$/i, ""),
        language: lang,
        statusId: id,
      });
    } catch (err) {
      toast.error(friendlyError(err, "Analyse impossible."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-white/10 bg-noir-2 p-8 text-center">
        <FileUp className="mx-auto size-6 text-gold" />
        <p className="mt-2 text-sm text-ink">Dépose un fichier .srt ou .vtt</p>
        <p className="mt-1 text-xs text-ink-3">
          Traduction + détection d'argot automatiques via le pipeline complet.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Langue des sous-titres"
            className="rounded-lg border border-white/10 bg-noir px-3 py-2 text-xs text-ink focus:border-gold/60 focus:outline-none"
          >
            <option value="en">Anglais</option>
            <option value="es">Espagnol</option>
            <option value="ru">Russe</option>
            <option value="ar">Arabe</option>
            <option value="zh">Mandarin</option>
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 py-2 text-sm font-medium text-noir disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Choisir un fichier"}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".srt,.vtt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Films & séries TMDB (fallback TVmaze) — catalogue réel 2000-2026 ─ */

type CatalogMovie = {
  movieId: number;
  title: string;
  year: string;
  posterUrl: string;
  overview: string;
  rating?: number;
  lang?: string;
  trailerEmbedUrl?: string;
  source: string;
};

function TmdbMoviesPane({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [kind, setKind] = useState<"movie" | "series">("movie");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogMovie[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [trailer, setTrailer] = useState<CatalogMovie | null>(null);

  const discover = useAction(api.connectors.tmdbCatalog.movieDiscover);

  useEffect(() => {
    let alive = true;
    setSearching(true);
    setError(false);
    void discover({ kind, limit: 12 })
      .then((res) => {
        if (alive) setItems((res.items ?? []) as unknown as CatalogMovie[]);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setSearching(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function doSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(false);
    try {
      const res = await discover({ kind, query: q, limit: 18 });
      setItems((res.items ?? []) as unknown as CatalogMovie[]);
    } catch {
      setError(true);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "movie", label: "🎬 Films" },
            { key: "series", label: "📺 Séries" },
          ] as const
        ).map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              kind === k.key
                ? "border-gold/60 bg-gold/10 font-medium text-gold"
                : "border-white/10 text-ink-2 hover:border-gold/40 hover:text-gold",
            )}
          >
            {k.label}
          </button>
        ))}
        {/* Source et période, pas un second sélecteur : « Catalogue réel » y
            faisait doublon avec le sélecteur Plateformes / OpenVerse du
            Hub, et ne disait pas d'où viennent les fiches. */}
        <span className="ml-auto font-mono text-[0.625rem] text-ink-3">
          Base TMDB · 2000–2026
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === "movie" ? "Un film… (ex : Inception, Dune)" : "Une série… (ex : Peaky Blinders)"}
            aria-label={kind === "movie" ? "Rechercher un film" : "Rechercher une série"}
            className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 font-medium text-noir disabled:opacity-50"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
          Catalogue indisponible pour le moment — réessaie dans un instant.
        </p>
      )}

      {trailer && (
        <div className="space-y-2">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/5">
            <iframe
              src={trailer.trailerEmbedUrl}
              title={`Bande-annonce — ${trailer.title}`}
              allow="fullscreen"
              className="h-full w-full"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink">
              Bande-annonce — {trailer.title} {trailer.year && `(${trailer.year})`}
            </p>
            <button
              onClick={() => setTrailer(null)}
              className="text-xs text-ink-3 transition-colors hover:text-gold"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {items === null && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        items &&
        items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((m, i) => (
              <div
                key={`${m.source}-${m.movieId}`}
                className="ln-stagger-item flex flex-col rounded-2xl border border-white/5 bg-noir-2 p-2.5 transition-colors hover:border-gold/40"
                style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
              >
                {m.posterUrl ? (
                  <img
                    src={m.posterUrl}
                    alt=""
                    loading="lazy"
                    className="mb-2 aspect-[2/3] w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-2 flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-white/5">
                    <Film className="size-6 text-ink-3" />
                  </div>
                )}
                <p className="line-clamp-2 text-sm font-medium text-ink">{m.title}</p>
                <p className="mt-0.5 flex items-center justify-between font-mono text-[0.625rem] text-ink-3">
                  <span>{m.year || "—"}</span>
                  <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 tracking-widest uppercase">
                    {m.source === "tmdb" ? "TMDB" : "TVmaze"}
                  </span>
                </p>
                {m.overview && (
                  <p className="mt-1 line-clamp-3 text-xs text-ink-2">{m.overview}</p>
                )}
                <div className="mt-2 flex flex-1 flex-col justify-end gap-1.5">
                  {m.trailerEmbedUrl && (
                    <button
                      onClick={() => setTrailer(m)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold/15 py-1.5 text-xs text-gold transition-colors hover:bg-gold/25"
                    >
                      <Play className="size-3.5" /> Trailer
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onOpenRoom({
                        kind: "series",
                        title: m.title,
                        year: m.year,
                        embedUrl: m.trailerEmbedUrl,
                        language,
                        // B4 — poster + synopsis réels (TMDB/TVmaze).
                        artworkUrl: m.posterUrl,
                        summary: m.overview,
                      })
                    }
                    className="w-full rounded-lg border border-gold/30 py-1.5 text-[0.625rem] text-gold/80 transition-colors hover:bg-gold/10"
                  >
                    Ouvrir la fiche
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {items !== null && items.length === 0 && !searching && !error && (
        <EmptyState
          icon={<Clapperboard className="size-6 text-ink-3" />}
          title="Aucun résultat"
          hint="Essaie un autre titre."
        />
      )}
    </div>
  );
}

/* ── Onglet racine ─────────────────────────────────────────────────── */

export function ScreenTab({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  // « Films & séries » (catalogue réel TMDB/TVmaze) est le sous-onglet PAR
  // DÉFAUT : contenu réel affiché d'emblée, les outils historiques restent
  // accessibles (YouTube, séries .srt, films libres, sous-titres persos).
  const [sub, setSub] = useState<SubTab>("movies");
  return (
    <div className="space-y-4">
      <SubTabs tab={sub} onTab={setSub} />
      <div key={sub} className="ln-tab-in">
      {sub === "movies" && (
        <TmdbMoviesPane language={language} onOpenRoom={onOpenRoom} />
      )}
      {sub === "youtube" && (
        <YouTubeInlineSearch language={language} onOpenRoom={onOpenRoom} />
      )}
      {sub === "series" && <SeriesPane language={language} onOpenRoom={onOpenRoom} />}
      {sub === "free" && <FreeFilmsPane language={language} onOpenRoom={onOpenRoom} />}
      {sub === "subs" && <SubsPane language={language} onOpenRoom={onOpenRoom} />}
      </div>
    </div>
  );
}
