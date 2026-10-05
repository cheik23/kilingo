import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, ListMusic, Loader2, Music, Play, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ScrambleHeading } from "@/components/fx/text";
import { cn, friendlyError } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { HubMedia } from "@/components/media/MediaRoomView";

/* ═══════════════════════════════════════════════════════════════════
   Media Hub — Musique : recherche iTunes structurée (artistes / titres
   / albums, keyless), aperçus 30 s légaux, analyse via transcription
   de l'extrait via le moteur ASR. L'analyse s'ouvre dans la MediaRoom.
   ═══════════════════════════════════════════════════════════════════ */

export function MediaTabs({
  tab,
  onTab,
}: {
  tab: string;
  onTab: (t: string) => void;
}) {
  const { t } = useI18n();
  // Les emojis restent en dur : ils sont identiques dans toutes les langues,
  // seuls les libellés ont besoin d'être traduits.
  const TABS = [
    { key: "music", label: `🎵 ${t("mediaHub.tabs.music")}` },
    { key: "screen", label: `🎬 ${t("mediaHub.tabs.screen")}` },
    { key: "books", label: `📚 ${t("mediaHub.tabs.books")}` },
    { key: "talk", label: `🎙️ ${t("mediaHub.tabs.talk")}` },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onTab(t.key)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
            tab === t.key
              ? "border-gold/60 bg-gold/10 font-medium text-gold"
              : "border-white/10 text-ink-2 hover:border-gold/30 hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

type Artist = { artistId: number; artistName: string; genre: string };
type Track = {
  trackId: number;
  trackName: string;
  artistName: string;
  albumName: string;
  artworkUrl: string;
  previewUrl: string;
  trackViewUrl: string;
  year: string;
  /** Durée réelle (s) : départage les versions homonymes pour les paroles. */
  durationSec: number;
  /** Source réelle du catalogue (badge carte). */
  source: "deezer" | "itunes";
};
type Album = {
  albumId: number;
  title: string;
  artistName: string;
  artworkUrl: string;
  year: string;
  source: "deezer" | "itunes";
  /** Extrait 30 s du 1er titre quand la source l'expose. */
  previewUrl?: string;
  trackName?: string;
  trackId?: number;
};
type Playlist = {
  playlistId: number;
  title: string;
  pictureUrl: string;
  trackCount: number;
  creator: string;
  source: "deezer";
};

/** Décennies proposées : 2000s / 2010s / 2020s (catalogue 2000-2026). */
const DECADES = [
  { key: "2000", label: "2000s", min: 2000, max: 2009 },
  { key: "2010", label: "2010s", min: 2010, max: 2019 },
  { key: "2020", label: "2020s", min: 2020, max: 2026 },
] as const;

function AudioPreview({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [broken, setBroken] = useState(false);

  // B — garde-fou : jamais de src vide ou non-HTTP(S) (l'<audio> sans
  // source valable déclenche « no supported source was found » = dialogue
  // Runtime error). La validation précède TOUTe affectation au DOM.
  const usable = Boolean(src && src.trim() && /^https?:\/\//i.test(src.trim()));

  // Un seul aperçu à la fois : couper les autres lectures.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stopOthers = () => {
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== el) a.pause();
      });
    };
    el.addEventListener("play", stopOthers);
    return () => el.removeEventListener("play", stopOthers);
  }, []);

  if (!usable) {
    return (
      <span title="Preview 30 s indisponible" className="inline-flex items-center gap-2">
        <span
          aria-disabled
          className="flex size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-white/10 text-ink-3/60"
        >
          <Play className="size-4" />
        </span>
        <span className="font-mono text-[0.625rem] text-ink-3">sans preview</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <audio
        ref={ref}
        src={src}
        onError={() => {
          // B2 — capture : toast discret, JAMAIS de throw (l'instrumentation
          // Runtime error ne doit plus se déclencher).
          setBroken(true);
          setPlaying(false);
          toast.info("Preview indisponible pour ce titre");
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress(el.duration ? el.currentTime / el.duration : 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        preload="none"
      />
      <button
        onClick={() => {
          if (broken) {
            toast.info("Preview indisponible pour ce titre");
            return;
          }
          const el = ref.current;
          if (!el) return;
          if (el.paused) {
            // Rejection JAMAIS non gérée : le dialogue Runtime error global
            // écoute window.unhandledrejection.
            el.play().catch(() => {
              setPlaying(false);
              setBroken(true);
              toast.info("Preview indisponible pour ce titre");
            });
          } else {
            el.pause();
          }
        }}
        aria-label={playing ? "Pause" : "Écouter l'aperçu de 30 secondes"}
        title={broken ? "Preview 30 s indisponible" : undefined}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold transition-colors hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={broken}
      >
        {playing ? (
          <span className="flex gap-[3px]" aria-hidden="true">
            <span className="h-3 w-[3px] rounded bg-gold" />
            <span className="h-3 w-[3px] rounded bg-gold" />
          </span>
        ) : (
          <Play className="size-4" />
        )}
      </button>
      <span
        className="block h-1 w-20 overflow-hidden rounded-full bg-white/10"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full bg-gold transition-[width] duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </span>
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[0.5rem] tracking-widest text-ink-3 uppercase">
      {source === "deezer" ? "Deezer" : "iTunes"}
    </span>
  );
}

const MUSIC_SUGGESTIONS = [
  "Drake",
  "Gims",
  "Kendrick Lamar",
  "PNL",
  "Bad Bunny",
];

/**
 * Onglet Musique — 100 % catalogue réel : Charts Deezer (albums + extraits),
 * Albums (recherche + filtres décennies 2000s/2010s/2020s), Playlists
 * éditoriales (ouvrables en liste de pistes), Recherche (Deezer + iTunes).
 * Lecture = extrait 30 s officiel (player audio natif existant) ;
 * « Shadower » = createHubMedia + analyzeHubSegments (pipeline EXISTANT :
 * Whisper + paroles + argot), aucune duplication.
 */
export function MusicTab({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    artists: Artist[];
    tracks: Track[];
    albums: Album[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [decade, setDecade] = useState<string | null>(null);
  // B3 — Shadower sans preview : le pipeline Whisper exige un extrait audio ;
  // le repli passe par les paroles synchronisées (lrclib) via le pipeline
  // EXISTANT (lyricsFor → analyzeHubSegments), sans duplication.
  const lyricsFor = useAction(api.mediaHub4.lyricsFor);
  const createMedia = useMutation(api.media.createHubMedia);
  const analyzeSegments = useAction(api.mediaHub2.analyzeHubSegments);

  // ── Catalogues réels (chargés au montage, en parallèle) ─────────────
  const [chart, setChart] = useState<Album[] | null>(null);
  const [chartError, setChartError] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [openPlaylist, setOpenPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[] | null>(null);

  const fetchChart = useAction(api.connectors.deezerCatalog.deezerChart);
  const fetchPlaylists = useAction(api.connectors.deezerCatalog.deezerPlaylists);
  const fetchPlaylistTracks = useAction(api.connectors.deezerCatalog.deezerPlaylistTracks);
  const searchDeezer = useAction(api.connectors.deezerCatalog.deezerSearchMusic);
  const searchItunes = useAction(api.mediaHub.itunesSearchMusic);
  const analyzeTrack = useAction(api.mediaHub4.analyzeTrack);

  useEffect(() => {
    let alive = true;
    void fetchChart({ limit: 12 })
      .then((res) => {
        if (alive) setChart((res.albums ?? []) as unknown as Album[]);
      })
      .catch(() => {
        if (alive) setChartError(true);
      });
    void fetchPlaylists({ limit: 8 })
      .then((res) => {
        if (alive) setPlaylists((res.playlists ?? []) as unknown as Playlist[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openPlaylistTracks(p: Playlist) {
    setOpenPlaylist(p);
    setPlaylistTracks(null);
    try {
      const res = await fetchPlaylistTracks({ playlistId: p.playlistId, limit: 20 });
      setPlaylistTracks((res.tracks ?? []) as unknown as Track[]);
    } catch {
      toast.error("Playlist indisponible pour le moment.");
    }
  }

  async function doSearch(q?: string) {
    const term = (q ?? query).trim();
    if (term.length < 2) return;
    setSearching(true);
    setQuery(term);
    try {
      // Recherche réelle croisée : Deezer (extraits + albums enrichis) puis
      // iTunes en repli/complément artistes.
      const [dz, it] = await Promise.allSettled([
        searchDeezer({ query: term, limit: 12 }),
        searchItunes({ query: term }),
      ]);
      const dzTracks = dz.status === "fulfilled" ? ((dz.value.tracks ?? []) as unknown as Track[]) : [];
      const itTracks =
        it.status === "fulfilled"
          ? ((it.value.tracks ?? []).map((t) => ({ ...t, source: "itunes" as const })) as unknown as Track[])
          : [];
      // Fusion dédoublonnée (titre+artiste), Deezer en tête (extraits garantis).
      const seen = new Set<string>();
      const merged: Track[] = [];
      for (const t of [...dzTracks, ...itTracks]) {
        const key = `${t.trackName.toLowerCase().slice(0, 60)}|${t.artistName.toLowerCase().slice(0, 40)}`;
        if (seen.has(key) || !t.previewUrl) continue;
        seen.add(key);
        merged.push(t);
      }
      const albums =
        dz.status === "fulfilled" ? ((dz.value.albums ?? []) as unknown as Album[]) : [];
      const artists = it.status === "fulfilled" ? (it.value.artists ?? []) : [];
      setResults({ artists, tracks: merged.slice(0, 18), albums: albums.slice(0, 12) });
    } catch (err) {
      toast.error(friendlyError(err, "La recherche a échoué."));
    } finally {
      setSearching(false);
    }
  }

  /** B3 — repli lrclib : paroles synchronisées → segments → pipeline existant. */
  async function analyzeViaLyrics(t: Track) {
    setAnalyzing(t.trackId);
    try {
      const lyrics = await lyricsFor({
        title: t.trackName,
        artist: t.artistName,
        ...(t.durationSec ? { durationSec: t.durationSec } : {}),
      });
      if (!lyrics.ok || (!lyrics.segments?.length && !lyrics.text)) {
        toast.error(
          "Analyse impossible pour ce titre : ni extrait audio, ni paroles disponibles.",
        );
        return;
      }
      const timed =
        lyrics.segments && lyrics.segments.length > 0
          ? lyrics.segments.map((s) => ({ start: s.start, end: s.start + 4, text: s.text }))
          : [];
      const body = timed.length > 0 ? timed : lyrics.text.split(/\r?\n/).filter(Boolean).slice(0, 60);
      const segments = body.map((row, i) =>
        typeof row === "string"
          ? { start: i * 6, end: (i + 1) * 6, text: (row as string).slice(0, 400) }
          : row,
      );
      const id = await createMedia({
        language: language as "en",
        title: `${t.artistName} — ${t.trackName}`,
        sourceName: t.trackViewUrl || `lrclib:${t.artistName}:${t.trackName}`,
        mediaType: "music",
      });
      await analyzeSegments({
        mediaId: id,
        language: language as "en",
        segments,
        transcriptSource: "lrclib_lyrics",
      });
      toast.success("Paroles trouvées — traduction et argot en cours.");
      onOpenRoom({
        kind: "music",
        title: `${t.artistName} — ${t.trackName}`,
        artist: t.artistName,
        year: t.year,
        artworkUrl: t.artworkUrl,
        language,
        statusId: id,
      });
    } catch (err) {
      toast.error(friendlyError(err, "Analyse impossible."));
    } finally {
      setAnalyzing(null);
    }
  }

  /** Pipeline EXISTANT (createHubMedia + analyzeHubSegments) — zéro duplication. */
  async function analyze(t: Track) {
    if (!t.previewUrl) {
      await analyzeViaLyrics(t);
      return;
    }
    setAnalyzing(t.trackId);
    try {
      const res = await analyzeTrack({
        trackName: t.trackName,
        artistName: t.artistName,
        previewUrl: t.previewUrl,
        trackViewUrl: t.trackViewUrl || undefined,
        durationSec: t.durationSec || undefined,
        language: language as "en",
      });
      toast.success("Extrait transcrit — traduction et argot en cours.");
      onOpenRoom({
        kind: "music",
        title: `${t.artistName} — ${t.trackName}`,
        artist: t.artistName,
        year: t.year,
        artworkUrl: t.artworkUrl,
        previewUrl: t.previewUrl,
        trackViewUrl: t.trackViewUrl || undefined,
        durationSec: t.durationSec || undefined,
        language,
        statusId: res.mediaId,
      });
    } catch (err) {
      toast.error(friendlyError(err, "Analyse impossible."));
    } finally {
      setAnalyzing(null);
    }
  }

  /** Filtre décennie local (catalogue réel déjà fetched) — années "2000"…"2026". */
  const decadeAlbums = useMemo(() => {
    const pool = results?.albums ?? chart ?? [];
    if (!decade) return pool;
    const d = DECADES.find((x) => x.key === decade);
    if (!d) return pool;
    return pool.filter((a) => {
      const y = Number(a.year);
      return Number.isFinite(y) && y >= d.min && y <= d.max;
    });
  }, [results, chart, decade]);

  const hasResults =
    results &&
    (results.artists.length > 0 ||
      results.tracks.length > 0 ||
      results.albums.length > 0);

  return (
    <div className="space-y-5">
      <ScrambleHeading text="Musique" />

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
            placeholder="Une chanson, un artiste…"
            aria-label="Rechercher une chanson"
            className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 font-medium text-noir transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
        </button>
      </form>

      {!results && !searching && (
        <EmptyState
          icon={<Music className="size-6 text-gold" />}
          title="Cherche un morceau à décortiquer"
          hint="Aperçus de 30 s gratuits, transcription + argot en un clic."
          suggestions={MUSIC_SUGGESTIONS}
          onSuggestion={(s) => void doSearch(s)}
        />
      )}

      {searching && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      )}

      {results && !hasResults && !searching && (
        <EmptyState
          icon={<Music className="size-6 text-ink-3" />}
          title="Aucun résultat"
          hint="Vérifie l'orthographe ou essaie un autre artiste."
          suggestions={MUSIC_SUGGESTIONS}
          onSuggestion={(s) => void doSearch(s)}
        />
      )}

      {results && results.artists.length > 0 && (
        <section aria-label="Artistes">
          <p className="mb-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
            Artistes
          </p>
          <div className="flex flex-wrap gap-2">
            {results.artists.map((a, i) => (
              <button
                key={a.artistId}
                className="ln-stagger-item flex items-center gap-2 rounded-full border border-white/10 bg-noir-2 px-3 py-1.5 transition-colors hover:border-gold/40"
                style={{ "--ln-i": i } as React.CSSProperties}
                onClick={() => void doSearch(a.artistName)}
                title={a.genre || undefined}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-gold/15 font-mono text-[0.625rem] text-gold">
                  {a.artistName.slice(0, 1).toUpperCase()}
                </span>
                <span className="line-clamp-1 text-xs text-ink">{a.artistName}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── CHARTS RÉELS (Deezer) — état d'accueil quand aucune recherche ── */}
      {!results && !searching && (
        <section aria-label="Charts réels">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
            <Flame className="size-3.5" /> Charts réels — classement Deezer
          </p>
          {chartError ? (
            <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
              Charts indisponibles pour le moment — réessaie dans un instant.
            </p>
          ) : chart === null ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chart.map((al, i) => (
                <div
                  key={al.albumId}
                  className="ln-stagger-item flex h-full flex-col rounded-2xl border border-white/5 bg-noir-2 p-3 transition-colors hover:border-gold/40 hover:shadow-[0_0_24px_rgba(212,165,116,0.12)]"
                  style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
                >
                  <div className="flex gap-3">
                    {al.artworkUrl ? (
                      <img src={al.artworkUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-white/5">
                        <Music className="size-5 text-ink-3" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-ink">{al.title}</p>
                      <p className="line-clamp-1 text-xs text-ink-2">{al.artistName}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.625rem] text-ink-3">
                        {al.year && <span>{al.year}</span>}
                        <SourceBadge source="deezer" />
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                    {al.previewUrl ? (
                      <AudioPreview src={al.previewUrl} />
                    ) : (
                      <span title="Preview 30 s indisponible" className="inline-flex items-center gap-2">
                        <span
                          aria-disabled
                          className="flex size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-white/10 text-ink-3/60"
                        >
                          <Play className="size-4" />
                        </span>
                        <span className="font-mono text-[0.625rem] text-ink-3">sans preview</span>
                      </span>
                    )}
                    {al.trackId ? (
                      <button
                        onClick={() =>
                          void analyze({
                            trackId: al.trackId as number,
                            trackName: al.trackName ?? al.title,
                            artistName: al.artistName,
                            albumName: al.title,
                            artworkUrl: al.artworkUrl,
                            previewUrl: al.previewUrl as string,
                            trackViewUrl: `https://www.deezer.com/track/${al.trackId}`,
                            durationSec: 30,
                            year: al.year,
                            source: "deezer",
                          })
                        }
                        disabled={analyzing !== null}
                        aria-label={`Shadower ${al.title}`}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
                      >
                        {analyzing !== null ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        Shadower
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── PLAYLISTS ÉDITORIALES (Deezer) — ouvrables en liste de pistes ── */}
      {!results && !searching && (
        <section aria-label="Playlists">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
            <ListMusic className="size-3.5" /> Playlists
          </p>
          {openPlaylist && (
            <div className="mb-3 space-y-2">
              <button
                onClick={() => {
                  setOpenPlaylist(null);
                  setPlaylistTracks(null);
                }}
                className="text-xs text-ink-3 transition-colors hover:text-gold"
              >
                ← Retour aux playlists
              </button>
              <p className="font-mono text-xs text-gold">
                {openPlaylist.title} — {playlistTracks?.length ?? "…"} pistes
              </p>
              {playlistTracks === null ? (
                <div className="h-24 animate-pulse rounded-xl bg-white/5" />
              ) : (
                playlistTracks.map((t) => (
                  <div
                    key={t.trackId}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-noir-2 p-2.5"
                  >
                    {t.artworkUrl ? (
                      <img src={t.artworkUrl} alt="" loading="lazy" className="size-10 rounded-lg object-cover" />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-lg bg-white/5">
                        <Music className="size-4 text-ink-3" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{t.trackName}</p>
                      <p className="truncate text-xs text-ink-3">{t.artistName}</p>
                    </div>
                    <AudioPreview src={t.previewUrl} />
                    <button
                      onClick={() => void analyze(t)}
                      disabled={analyzing !== null}
                      className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
                    >
                      {analyzing === t.trackId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Shadower"
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          {!openPlaylist &&
            (playlists === null ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {playlists.map((p, i) => (
                  <button
                    key={p.playlistId}
                    onClick={() => void openPlaylistTracks(p)}
                    className="ln-stagger-item rounded-2xl border border-white/5 bg-noir-2 p-2 text-left transition-colors hover:border-gold/40"
                    style={{ "--ln-i": Math.min(i, 7) } as React.CSSProperties}
                    title={`${p.title} — ${p.trackCount} pistes`}
                  >
                    {p.pictureUrl ? (
                      <img src={p.pictureUrl} alt="" loading="lazy" className="mb-2 aspect-square w-full rounded-xl object-cover" />
                    ) : (
                      <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-white/5">
                        <ListMusic className="size-5 text-ink-3" />
                      </div>
                    )}
                    <p className="line-clamp-1 text-xs text-ink">{p.title}</p>
                    <p className="font-mono text-[0.625rem] text-ink-3">{p.trackCount} pistes · Deezer</p>
                  </button>
                ))}
              </div>
            ))}
        </section>
      )}

      {results && results.tracks.length > 0 && (
        <section aria-label="Titres">
          <p className="mb-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
            Titres
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.tracks.map((t, i) => (
              <div
                key={`${t.source}-${t.trackId}`}
                className="ln-stagger-item flex h-full flex-col rounded-2xl border border-white/5 bg-noir-2 p-3 transition-colors hover:border-gold/40 hover:shadow-[0_0_24px_rgba(212,165,116,0.12)]"
                style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
              >
                <div className="flex gap-3">
                  {t.artworkUrl ? (
                    <img
                      src={t.artworkUrl}
                      alt=""
                      loading="lazy"
                      className="size-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-white/5">
                      <Music className="size-5 text-ink-3" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-ink">
                      {t.trackName}
                    </p>
                    <p className="line-clamp-1 text-xs text-ink-2">{t.artistName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.625rem] text-ink-3">
                      {[t.albumName, t.year].filter(Boolean).join(" · ")}
                      <SourceBadge source={t.source} />
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                  {t.previewUrl ? (
                    <AudioPreview src={t.previewUrl} />
                  ) : (
                    <span title="Preview 30 s indisponible" className="inline-flex items-center gap-2">
                      <span
                        aria-disabled
                        className="flex size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-white/10 text-ink-3/60"
                      >
                        <Play className="size-4" />
                      </span>
                      <span className="font-mono text-[0.625rem] text-ink-3">sans preview</span>
                    </span>
                  )}
                  <button
                    onClick={() => void analyze(t)}
                    disabled={analyzing !== null}
                    aria-label={`Analyser ${t.trackName}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
                  >
                    {analyzing === t.trackId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Shadower
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {results && results.albums.length > 0 && (
        <section aria-label="Albums">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="font-mono text-[0.625rem] tracking-widest text-gold uppercase">
              Albums
            </p>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <button
              onClick={() => setDecade(null)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[0.625rem] transition-colors",
                decade === null
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-white/10 text-ink-3 hover:border-gold/40 hover:text-gold",
              )}
            >
              Toutes
            </button>
            {DECADES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDecade(d.key)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-mono text-[0.625rem] transition-colors",
                  decade === d.key
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : "border-white/10 text-ink-3 hover:border-gold/40 hover:text-gold",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {decadeAlbums.map((al) => (
              <div
                key={al.albumId}
                className="rounded-2xl border border-white/5 bg-noir-2 p-2 text-left transition-colors hover:border-gold/40"
              >
                {al.artworkUrl ? (
                  <img
                    src={al.artworkUrl}
                    alt=""
                    loading="lazy"
                    className="mb-2 aspect-square w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-white/5">
                    <Music className="size-5 text-ink-3" />
                  </div>
                )}
                <p className="line-clamp-1 text-xs text-ink">{al.title}</p>
                <p className="line-clamp-1 text-[0.625rem] text-ink-3">{al.artistName}</p>
                <p className="mt-0.5 flex items-center justify-between font-mono text-[0.625rem] text-ink-3">
                  <span>{al.year || "—"}</span>
                  <SourceBadge source={al.source} />
                </p>
                {al.previewUrl ? (
                  <div className="mt-2">
                    <AudioPreview src={al.previewUrl} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {decadeAlbums.length === 0 && (
            <p className="py-4 text-center text-xs text-ink-3">
              Aucun album de cette décennie dans les résultats.
            </p>
          )}
        </section>
      )}

    </div>
  );
}

/** État vide partagé avec suggestions cliquables. */
export function EmptyState({
  icon,
  title,
  hint,
  suggestions,
  onSuggestion,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-noir-2 px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-gold/10">
        {icon}
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-ink-2">{hint}</p>}
      {suggestions && suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion?.(s)}
              className="rounded-full border border-white/10 px-3 py-1 font-mono text-[0.625rem] text-ink-3 transition-colors hover:border-gold/40 hover:text-gold"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
