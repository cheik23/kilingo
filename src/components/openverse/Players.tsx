import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Languages,
  Maximize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  KIND_META,
  decisionOf,
  fmtClock,
  proxied,
  type Content,
  type Segment,
} from "@/openverse/model";

/* ═══════════════════════════════════════════════════════════════════════
   LECTEURS — l'accès leur est donné par le Rights Engine uniquement.
   Aucune source non autorisée n'atteint ces composants.
   Aucun lien ne sort de l'application : une fiche non lisible affiche
   « Indisponible pour le moment. », point final.
   ═══════════════════════════════════════════════════════════════════════ */

const UNAVAILABLE_COPY = "Indisponible pour le moment.";

function useCue(segments: Segment[] | undefined, time: number, offset = 0): string | null {
  return useMemo(() => {
    if (!segments?.length) return null;
    const t = time + offset;
    const found = segments.find((s) => t >= s.start && t <= s.end + 0.35);
    return found?.text ?? null;
  }, [segments, time, offset]);
}

function ControlBar({
  playing,
  time,
  duration,
  volume,
  muted,
  rate,
  onToggle,
  onSeek,
  onVolume,
  onMute,
  onRate,
  onFullscreen,
  extra,
}: {
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
  onRate: (r: number) => void;
  onFullscreen?: () => void;
  extra?: React.ReactNode;
}) {
  const [ratesOpen, setRatesOpen] = useState(false);
  const pct = duration > 0 ? (time / duration) * 100 : 0;
  return (
    <div className="relative flex items-center gap-3 border-t border-white/5 bg-black/60 px-3 py-2 backdrop-blur">
      <button type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Lecture"} className="text-ink hover:text-gold">
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <span className="font-mono text-[0.6875rem] text-ink-2">{fmtClock(time)}</span>
      <div
        role="slider"
        aria-label="Position"
        aria-valuenow={Math.round(time)}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.round(duration))}
        tabIndex={0}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * duration);
        }}
        className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/10"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold-soft" style={{ width: `${pct}%` }} />
        <span
          className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-gold opacity-0 transition-opacity group-hover:opacity-100"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <span className="font-mono text-[0.6875rem] text-ink-3">{fmtClock(duration)}</span>
      {extra}
      <button type="button" onClick={() => setRatesOpen((o) => !o)} aria-label="Vitesse" className="text-ink-2 hover:text-gold">
        <Gauge className="size-4" />
      </button>
      {ratesOpen && (
        <div className="absolute bottom-12 right-16 z-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-noir">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                onRate(r);
                setRatesOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs ${rate === r ? "text-gold" : "text-ink-2 hover:bg-white/5"}`}
            >
              {r}×
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onMute} aria-label="Muet" className="text-ink-2 hover:text-gold">
        {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(e) => onVolume(Number(e.target.value))}
        aria-label="Volume"
        className="hidden w-20 accent-gold sm:block"
      />
      {onFullscreen && (
        <button type="button" onClick={onFullscreen} aria-label="Plein écran" className="text-ink-2 hover:text-gold">
          <Maximize className="size-4" />
        </button>
      )}
    </div>
  );
}

/* ── Lecteur vidéo ──────────────────────────────────────────────────── */

export function VideoPlayer({
  content,
  segments,
  startAt = 0,
  onProgress,
}: {
  content: Content;
  segments?: Segment[];
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(startAt);
  const [duration, setDuration] = useState(content.duration ?? 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [showSubs, setShowSubs] = useState(true);
  const cue = useCue(segments, time, 0);

  // Lecture directe depuis la source autorisée : un élément média n'a pas
  // besoin de CORS pour jouer un flux, alors que le proxy média, lui, est
  // limité à une liste blanche d'hôtes (protection SSRF). Passer par lui
  // casserait les podcasts, les webradios et les extraits promotionnels.
  const src = content.streamUrl ?? content.previewUrl;

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    el.playbackRate = rate;
    el.volume = volume;
    el.muted = muted;
  }, [rate, volume, muted, src]);

  useEffect(() => {
    if (ref.current && startAt > 0 && Math.abs(ref.current.currentTime - startAt) > 2) {
      ref.current.currentTime = startAt;
    }
  }, [startAt]);

  const lastReport = useRef(0);
  const handleTime = () => {
    const el = ref.current;
    if (!el) return;
    setTime(el.currentTime);
    if (el.duration && Number.isFinite(el.duration)) setDuration(el.duration);
    if (onProgress && Date.now() - lastReport.current > 9000) {
      lastReport.current = Date.now();
      onProgress(el.currentTime, el.duration || content.duration || 0);
    }
  };

  if (!src) return null;

  return (
    <div ref={shell} className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="relative aspect-video bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={ref}
          src={src}
          className="size-full"
          onTimeUpdate={handleTime}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            if (onProgress) onProgress(ref.current?.currentTime ?? 0, ref.current?.duration ?? 0);
          }}
          onEnded={() => onProgress?.(duration, duration)}
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            if (playing) el.pause();
            else el.play().catch(() => {
              setPlaying(false);
              toast.info("Lecture indisponible pour ce média");
            });
          }}
        />
        {showSubs && cue && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
            <p className="max-w-2xl rounded-lg bg-black/75 px-3 py-1.5 text-center text-sm font-medium text-[#ffffff]">
              {cue}
            </p>
          </div>
        )}
        {content.previewUrl && !content.streamUrl && (
          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[0.625rem] font-medium text-ink-2 backdrop-blur">
            Extrait
          </span>
        )}
      </div>
      <ControlBar
        playing={playing}
        time={time}
        duration={duration}
        volume={volume}
        muted={muted}
        rate={rate}
        onToggle={() => {
          const el = ref.current;
          if (!el) return;
          if (playing) el.pause();
          else el.play().catch(() => {
            setPlaying(false);
            toast.info("Lecture indisponible pour ce média");
          });
        }}
        onSeek={(t) => {
          if (ref.current) ref.current.currentTime = t;
          setTime(t);
        }}
        onVolume={(v) => {
          setVolume(v);
          setMuted(false);
        }}
        onMute={() => setMuted((m) => !m)}
        onRate={setRate}
        onFullscreen={() => shell.current?.requestFullscreen?.()}
        extra={
          segments?.length ? (
            <button
              type="button"
              onClick={() => setShowSubs((s) => !s)}
              aria-label="Sous-titres"
              className={`text-[0.6875rem] font-semibold ${showSubs ? "text-gold" : "text-ink-3"}`}
            >
              CC
            </button>
          ) : null
        }
      />
    </div>
  );
}

/* ── Lecteur audio ──────────────────────────────────────────────────── */

export function AudioPlayer({
  content,
  segments,
  translation,
  startAt = 0,
  onProgress,
  onNext,
  onPrev,
}: {
  content: Content;
  segments?: Segment[];
  translation?: Segment[];
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(startAt);
  const [duration, setDuration] = useState(content.duration ?? 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [showLyrics, setShowLyrics] = useState(true);
  const cue = useCue(segments, time);

  // Même raison que pour la vidéo : lecture directe, sans proxy.
  const src = content.streamUrl ?? content.previewUrl;
  const translated = useMemo(() => {
    if (!translation?.length) return null;
    const t = time;
    return translation.find((s) => t >= s.start && t <= s.end + 0.35)?.text ?? null;
  }, [translation, time]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = rate;
    el.volume = volume;
    el.muted = muted;
  }, [rate, volume, muted]);

  const lastReport = useRef(0);
  const handleTime = () => {
    const el = ref.current;
    if (!el) return;
    setTime(el.currentTime);
    if (el.duration && Number.isFinite(el.duration)) setDuration(el.duration);
    if (onProgress && Date.now() - lastReport.current > 9000) {
      lastReport.current = Date.now();
      onProgress(el.currentTime, el.duration || content.duration || 0);
    }
  };

  if (!src) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-2xl border border-white/10 bg-noir p-4">
        <div className="aspect-square overflow-hidden rounded-xl bg-black/40">
          {content.thumbnail ? (
            <img src={content.thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-4xl opacity-40">🎵</div>
          )}
        </div>
        <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink">{content.title}</p>
        {content.creator && <p className="text-xs text-ink-2">{content.creator}</p>}
        <audio
          ref={ref}
          src={src}
          onTimeUpdate={handleTime}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => onProgress?.(duration, duration)}
          onError={() => {
            // A3 — erreur média capturée : jamais de remontée window.
            setPlaying(false);
            toast.info("Preview indisponible pour ce titre");
          }}
        />
        <div className="mt-3 flex items-center justify-center gap-3">
          {onPrev && (
            <button type="button" onClick={onPrev} aria-label="Précédent" className="text-ink-2 hover:text-gold">
              <SkipBack className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              if (playing) el.pause();
              else el.play().catch(() => {
                setPlaying(false);
                toast.info("Preview indisponible pour ce titre");
              });
            }}
            aria-label={playing ? "Pause" : "Lecture"}
            className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-soft text-noir"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          {onNext && (
            <button type="button" onClick={onNext} aria-label="Suivant" className="text-ink-2 hover:text-gold">
              <SkipForward className="size-5" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="flex items-center justify-between px-4 py-2.5">
          <p className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
            <Languages className="size-3.5 text-gold" /> Paroles / transcription
          </p>
          <button
            type="button"
            onClick={() => setShowLyrics((s) => !s)}
            className={`text-[0.6875rem] ${showLyrics ? "text-gold" : "text-ink-3"}`}
          >
            {showLyrics ? "Masquer" : "Afficher"}
          </button>
        </div>
        <div className="h-40 overflow-y-auto px-4 pb-3">
          {showLyrics ? (
            segments?.length ? (
              <ul className="space-y-1">
                {segments.map((s, i) => (
                  <li
                    key={`${s.start}-${i}`}
                    onClick={() => {
                      if (ref.current) ref.current.currentTime = s.start;
                    }}
                    className={`cursor-pointer rounded-lg px-2 py-1 text-sm transition-colors ${
                      Math.abs(time - s.start) < 3 ? "bg-gold/10 text-gold" : "text-ink-2 hover:bg-white/5"
                    }`}
                  >
                    <span className="mr-2 font-mono text-[0.625rem] text-ink-3">{fmtClock(s.start)}</span>
                    {s.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-xs text-ink-3">
                Transcription indisponible pour ce contenu.
              </p>
            )
          ) : null}
        </div>
        {translated && showLyrics && (
          <div className="border-t border-white/5 px-4 py-2 text-sm text-gold-soft">{translated}</div>
        )}
        <ControlBar
          playing={playing}
          time={time}
          duration={duration}
          volume={volume}
          muted={muted}
          rate={rate}
          onToggle={() => {
            const el = ref.current;
            if (!el) return;
            if (playing) el.pause();
            else el.play().catch(() => {
              setPlaying(false);
              toast.info("Preview indisponible pour ce titre");
            });
          }}
          onSeek={(t) => {
            if (ref.current) ref.current.currentTime = t;
            setTime(t);
          }}
          onVolume={(v) => {
            setVolume(v);
            setMuted(false);
          }}
          onMute={() => setMuted((m) => !m)}
          onRate={setRate}
        />
      </div>
    </div>
  );
}

/* ── Lecteur de livre ───────────────────────────────────────────────── */

const PAGE_SIZE = 2600;

export function BookReader({
  content,
  startAt = 0,
  onProgress,
  onBookmark,
  onTranslate,
}: {
  content: Content;
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
  onBookmark?: (label: string, position: number) => void;
  onTranslate?: (text: string) => Promise<string | null>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(() => Math.max(0, Math.floor(startAt / PAGE_SIZE)));
  const [fontSize, setFontSize] = useState(17);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState("");
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Un corps de texte déjà récupéré (article sous licence libre, corps de
    // flux) se lit sans appel réseau : la lecture ne dépend alors ni du
    // proxy ni de la disponibilité de la source.
    if (content.body) {
      setText(content.body);
      setError(null);
      return;
    }
    const url = proxied(content.textUrl);
    if (!url) {
      setError("Indisponible pour le moment.");
      return;
    }
    let alive = true;
    setText(null);
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body) => {
        if (alive) setText(body);
      })
      .catch(() => alive && setError("Indisponible pour le moment."));
    return () => {
      alive = false;
    };
  }, [content.body, content.textUrl]);

  const pages = useMemo(() => {
    if (!text) return [];
    const out: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let buffer = "";
    for (const paragraph of paragraphs) {
      if ((buffer + paragraph).length > PAGE_SIZE) {
        if (buffer) out.push(buffer.trim());
        buffer = "";
      }
      buffer += paragraph + "\n\n";
    }
    if (buffer.trim()) out.push(buffer.trim());
    return out;
  }, [text]);

  useEffect(() => {
    if (pages.length && onProgress && page % 5 === 0) {
      onProgress(Math.min(page * PAGE_SIZE, text?.length ?? 0), text?.length ?? 1);
    }
  }, [page, pages.length, onProgress, text]);

  const results = useMemo(() => {
    if (!text || query.trim().length < 3) return [];
    const needle = query.trim().toLowerCase();
    const found: number[] = [];
    let from = 0;
    while (found.length < 40) {
      const index = text.toLowerCase().indexOf(needle, from);
      if (index === -1) break;
      found.push(Math.floor(index / PAGE_SIZE));
      from = index + needle.length;
    }
    return [...new Set(found)];
  }, [text, query]);

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-noir p-6 text-sm text-ink-2">{error}</div>
    );
  }
  if (!text) {
    return (
      <div className="space-y-2 rounded-2xl border border-white/10 bg-noir p-6">
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
        <div className="h-4 w-full animate-pulse rounded bg-white/5" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-white/5" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-noir">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans le texte…"
          className="h-8 min-w-40 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-ink outline-none placeholder:text-ink-3"
        />
        {results.length > 0 && (
          <span className="font-mono text-[0.625rem] text-ink-3">
            {results.length} page(s) : {results.slice(0, 6).map((r) => r + 1).join(", ")}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFontSize((f) => Math.max(13, f - 1))}
            className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-ink-2 hover:text-gold"
            aria-label="Réduire la taille du texte"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => setFontSize((f) => Math.min(24, f + 1))}
            className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-ink-2 hover:text-gold"
            aria-label="Augmenter la taille du texte"
          >
            A+
          </button>
          {onBookmark && (
            <button
              type="button"
              onClick={() => onBookmark(`Page ${page + 1}`, page * PAGE_SIZE)}
              className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-xs text-ink-2 hover:text-gold"
            >
              <BookmarkPlus className="size-3.5" /> Marquer
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 text-[0.6875rem] text-ink-3">
        <button
          type="button"
          onClick={() => {
            const sel = window.getSelection()?.toString().trim();
            if (sel && sel.length > 1) {
              setSelection(sel);
              setTranslated(null);
            }
          }}
          className="rounded-md border border-white/10 px-2 py-1 hover:text-gold"
        >
          Traduire la sélection
        </button>
        {selection && (
          <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-2">
            <p className="line-clamp-2 text-ink-2">« {selection} »</p>
            {translated ? (
              <p className="mt-1 text-gold-soft">{translated}</p>
            ) : (
              <button
                type="button"
                disabled={busy || !onTranslate}
                onClick={async () => {
                  if (!onTranslate) return;
                  setBusy(true);
                  const out = await onTranslate(selection);
                  setTranslated(out ?? "Traduction indisponible pour le moment.");
                  setBusy(false);
                }}
                className="mt-1 rounded-md bg-gold/15 px-2 py-0.5 text-[0.6875rem] text-gold disabled:opacity-50"
              >
                {busy ? "Traduction…" : "Traduire"}
              </button>
            )}
          </div>
        )}
      </div>

      <article
        className="max-h-[62vh] overflow-y-auto px-6 py-5 leading-relaxed text-ink-2"
        style={{ fontSize }}
      >
        {pages[page]?.split(/\n\n+/).map((paragraph, i) => (
          <p key={i} className="mb-4">
            {paragraph}
          </p>
        ))}
      </article>

      <div className="flex items-center justify-between border-t border-white/5 px-4 py-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="flex items-center gap-1 text-xs text-ink-2 disabled:opacity-30 hover:text-gold"
        >
          <ChevronLeft className="size-4" /> Précédent
        </button>
        <span className="font-mono text-[0.6875rem] text-ink-3">
          page {page + 1} / {pages.length || 1}
        </span>
        <button
          type="button"
          disabled={page >= pages.length - 1}
          onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
          className="flex items-center gap-1 text-xs text-ink-2 disabled:opacity-30 hover:text-gold"
        >
          Suivant <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Aiguillage : le moteur décide, l'UI applique ───────────────────── */

export function PlayerHost({
  content,
  segments,
  translation,
  startAt = 0,
  onProgress,
  onBookmark,
  onTranslate,
  onNext,
  onPrev,
}: {
  content: Content;
  segments?: Segment[];
  translation?: Segment[];
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
  onBookmark?: (label: string, position: number) => void;
  onTranslate?: (text: string) => Promise<string | null>;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const decision = decisionOf(content);

  if (decision.canEmbed && content.embedUrl && !decision.canStream) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-[0.6875rem] text-ink-2">
          <span aria-hidden>▶</span> Lecture intégrée — tu restes dans MOOVY.
        </div>
        <iframe
          src={content.embedUrl}
          title={content.title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video w-full"
        />
      </div>
    );
  }

  // Un contenu textuel (livre, article, note sociale, corps de flux) se lit
  // dans le lecteur de texte — y compris quand le texte vient de la base.
  const textual =
    content.kind === "book" ||
    content.kind === "article" ||
    content.kind === "social" ||
    Boolean((content.body || content.textUrl) && !content.streamUrl && !content.previewUrl);

  if (decision.canStream && textual) {
    return (
      <BookReader
        content={content}
        startAt={startAt}
        onProgress={onProgress}
        onBookmark={onBookmark}
        onTranslate={onTranslate}
      />
    );
  }

  if (decision.canStream || decision.canPreview) {
    if (
      content.kind === "movie" ||
      content.kind === "video" ||
      content.kind === "series" ||
      content.kind === "image"
    ) {
      return <VideoPlayer content={content} segments={segments} startAt={startAt} onProgress={onProgress} />;
    }
    return (
      <AudioPlayer
        content={content}
        segments={segments}
        translation={translation}
        startAt={startAt}
        onProgress={onProgress}
        onNext={onNext}
        onPrev={onPrev}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-noir p-6">
      <p className="text-sm leading-relaxed text-ink-2">{UNAVAILABLE_COPY}</p>
    </div>
  );
}
