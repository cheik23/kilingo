import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   Lecteurs Shadow — fichier uploadé (audio/vidéo) + texte collé.

   Le « Shadow muet » venait de l'absence totale de lecteur pour les
   fichiers uploadés : le pipeline publiait mediaUrl mais rien ne le
   consommait. Ici, un élément <video>/<audio> natif avec une barre de
   transport complète (play/pause, ±5/10 s, segment précédent/suivant,
   volume, muet, vitesse, barre cliquable).

   Le lecteur texte offre la même synchronisation sur une horloge
   virtuelle (1 segment = ~2 s), pour que « cliquer un segment déplace
   la position » fonctionne aussi sur du texte.
   ═══════════════════════════════════════════════════════════════════ */

export type ShadowControls = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  nudge: (delta: number) => void;
  prevSegment: (starts: number[]) => void;
  nextSegment: (starts: number[]) => void;
  setRate: (rate: number) => void;
  element: () => HTMLMediaElement | null;
};

/**
 * Un play() interrompu (AbortError — course preload/interruption) n'est PAS
 * une erreur de fichier : le traiter comme un échec affichait à tort
 * « Lecture indisponible » sur des médias parfaitement valides.
 * NotAllowedError (autoplay policy) n'est pas non plus une panne média :
 * l'utilisateur doit d'abord interagir. Toute autre erreur est fatale.
 */
function playSafely(el: HTMLMediaElement, onFatal: () => void): void {
  el.play().catch((err: unknown) => {
    const e = err as { name?: string; message?: string } | null;
    if (e?.name === "AbortError" || e?.name === "NotAllowedError") {
      console.warn("[shadow] lecture différée :", e?.name);
      return;
    }
    console.error("[shadow] lecture impossible :", e?.name, e?.message);
    onFatal();
  });
}

export function fmtClock(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ── Barre de transport partagée ───────────────────────────────────── */

export function ShadowTransport({
  playing,
  time,
  duration,
  volume,
  muted,
  rate,
  hasMedia,
  onToggle,
  onSeek,
  onNudge,
  onPrevSeg,
  onNextSeg,
  onVolume,
  onMute,
  onRate,
  starts,
  minimal = false,
  volumeControl = true,
  rateControl = true,
}: {
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  hasMedia: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onNudge: (d: number) => void;
  onPrevSeg: (starts: number[]) => void;
  onNextSeg: (starts: number[]) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
  onRate: (r: number) => void;
  /** Timestamps de début des segments — pour sauts précis. */
  starts: number[];
  /** Mode texte : pas de son ni de vitesse — on masque ces contrôles. */
  minimal?: boolean;
  /** Expose volume/mute ? (YouTube/fichier : oui ; TikTok/texte : non) */
  volumeControl?: boolean;
  /** Expose le menu vitesse ? (YouTube/fichier : oui ; TikTok/texte : non) */
  rateControl?: boolean;
}) {
  const [ratesOpen, setRatesOpen] = useState(false);
  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-noir-2 px-3 py-2">
      <button
        type="button"
        onClick={() => onPrevSeg(starts)}
        disabled={!hasMedia}
        aria-label="Segment précédent"
        className="text-ink-2 transition-colors hover:text-gold disabled:opacity-40"
      >
        <SkipBack className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onNudge(-10)}
        disabled={!hasMedia}
        aria-label="Reculer de 10 secondes"
        className="font-mono text-[0.625rem] text-ink-2 transition-colors hover:text-gold disabled:opacity-40"
      >
        −10s
      </button>
      <button
        type="button"
        onClick={() => onNudge(-5)}
        disabled={!hasMedia}
        aria-label="Reculer de 5 secondes"
        className="font-mono text-[0.625rem] text-ink-2 transition-colors hover:text-gold disabled:opacity-40"
      >
        −5s
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasMedia}
        aria-label={playing ? "Pause" : "Lecture"}
        className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-soft text-noir transition-transform hover:scale-105 disabled:opacity-40"
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <button
        type="button"
        onClick={() => onNudge(5)}
        disabled={!hasMedia}
        aria-label="Avancer de 5 secondes"
        className="font-mono text-[0.625rem] text-ink-2 transition-colors hover:text-gold disabled:opacity-40"
      >
        +5s
      </button>
      <button
        type="button"
        onClick={() => onNudge(10)}
        disabled={!hasMedia}
        aria-label="Avancer de 10 secondes"
        className="font-mono text-[0.625rem] text-ink-2 transition-colors hover:text-gold disabled:opacity-40"
      >
        +10s
      </button>
      <button
        type="button"
        onClick={() => onNextSeg(starts)}
        disabled={!hasMedia}
        aria-label="Segment suivant"
        className="text-ink-2 transition-colors hover:text-gold disabled:opacity-40"
      >
        <SkipForward className="size-4" />
      </button>

      <span className="ml-1 font-mono text-[0.6875rem] text-ink-2">
        {fmtClock(time)}
      </span>
      <div
        role="slider"
        aria-label="Position"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.round(duration))}
        aria-valuenow={Math.round(time)}
        tabIndex={0}
        onClick={(e) => {
          if (!hasMedia || duration <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * duration);
        }}
        className="group relative h-1.5 min-w-32 flex-1 cursor-pointer rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold-soft"
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-gold opacity-0 transition-opacity group-hover:opacity-100"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <span className="font-mono text-[0.6875rem] text-ink-3">
        {fmtClock(duration)}
      </span>

      {!minimal && volumeControl && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onMute}
            disabled={!hasMedia}
            aria-label={muted ? "Réactiver le son" : "Muet"}
            className="text-ink-2 transition-colors hover:text-gold disabled:opacity-40"
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            disabled={!hasMedia}
            aria-label="Volume"
            className="w-16 accent-gold disabled:opacity-40"
          />
        </div>
      )}

      {!minimal && rateControl && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setRatesOpen((o) => !o)}
            disabled={!hasMedia}
            aria-label="Vitesse de lecture"
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 font-mono text-[0.625rem] text-ink-2 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-40"
          >
            <Gauge className="size-3.5" /> {rate}×
          </button>
          {ratesOpen && (
            <div className="absolute bottom-10 right-0 z-20 w-16 overflow-hidden rounded-xl border border-white/10 bg-noir shadow-xl">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    onRate(r);
                    setRatesOpen(false);
                  }}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-xs",
                    rate === r
                      ? "text-gold"
                      : "text-ink-2 hover:bg-white/5 hover:text-ink",
                  )}
                >
                  {r}×
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Lecteur de fichier uploadé (audio OU vidéo) ───────────────────── */

export function UploadedPlayer({
  mediaUrl,
  mediaType,
  onTime,
  onPlayingChange,
  onEnded,
  onError,
  controlsRef,
  starts,
}: {
  mediaUrl: string;
  mediaType: string;
  onTime: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
  onError: () => void;
  controlsRef: React.RefObject<ShadowControls | null>;
  starts: number[];
}) {
  const isVideo = mediaType === "video";
  const elRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRateState] = useState(1);
  const [failed, setFailed] = useState(false);
  // Reprise en cas d'erreur réseau passagère : un seul retry auto.
  const retriedRef = useRef(false);

  // Nouveau média = nouvel essai : sans ce réarmement, un fichier dont
  // l'URL avait expiré marquait le lecteur « mort » pour le fichier suivant.
  useEffect(() => {
    setFailed(false);
    retriedRef.current = false;
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, [mediaUrl]);

  const getEl = () => elRef.current;

  useEffect(() => {
    const el = getEl();
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    el.playbackRate = rate;
  }, [volume, muted, rate, mediaUrl]);

  useEffect(() => {
    controlsRef.current = {
      play: () => {
        const el = getEl();
        if (el) playSafely(el, () => setFailed(true));
      },
      pause: () => getEl()?.pause(),
      toggle: () => {
        const el = getEl();
        if (!el) return;
        if (el.paused) playSafely(el, () => setFailed(true));
        else el.pause();
      },
      seek: (t) => {
        const el = getEl();
        if (!el) return;
        el.currentTime = Math.max(0, Math.min(el.duration || Infinity, t));
        setTime(el.currentTime);
      },
      nudge: (d) => {
        const el = getEl();
        if (!el) return;
        el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + d));
        setTime(el.currentTime);
      },
      prevSegment: (starts) => {
        const el = getEl();
        if (!el) return;
        const prev = [...starts].reverse().find((s) => s < el.currentTime - 0.4);
        if (prev !== undefined) {
          el.currentTime = prev;
          setTime(prev);
        }
      },
      nextSegment: (starts) => {
        const el = getEl();
        if (!el) return;
        const next = starts.find((s) => s > el.currentTime + 0.2);
        if (next !== undefined) {
          el.currentTime = next;
          setTime(next);
        }
      },
      setRate: (r) => setRateState(r),
      element: getEl,
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, mediaUrl]);

  const MediaEl = isVideo ? "video" : "audio";
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className={cn(isVideo ? "relative aspect-video bg-black" : "flex aspect-[21/6] items-center justify-center bg-noir")}>
        <MediaEl
          ref={elRef as never}
          src={mediaUrl}
          preload="metadata"
          className={cn(isVideo && "size-full")}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setTime(t);
            onTime(t);
          }}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setDuration(d);
          }}
          onPlay={() => {
            setPlaying(true);
            onPlayingChange(true);
          }}
          onPause={() => {
            setPlaying(false);
            onPlayingChange(false);
          }}
          onEnded={() => {
            setPlaying(false);
            onPlayingChange(false);
            onEnded();
          }}
          onError={() => {
            // Une interruption volontaire (changement de src, unload) déclenche
            // onError sur certains navigateurs sans être une vraie panne : on
            // réessaie un unique load() avant de déclarer l'échec.
            if (!retriedRef.current) {
              retriedRef.current = true;
              const el = getEl();
              if (el) {
                el.load();
                return;
              }
            }
            setFailed(true);
            onPlayingChange(false);
            onError();
          }}
          onClick={isVideo ? () => controlsRef.current?.toggle() : undefined}
          controls={false}
          playsInline={isVideo ? true : undefined}
        />
        {!isVideo && (
          <div className="pointer-events-none flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10",
                playing && "animate-pulse",
              )}
            >
              <Volume2 className="size-7 text-gold" />
            </div>
            <p className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
              {playing ? "lecture en cours" : "audio prêt"}
            </p>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-noir/80">
            <p className="max-w-xs text-center text-sm text-ink-2">
              Lecture indisponible pour le moment — réessaie ou recharge la
              page.
            </p>
          </div>
        )}
      </div>
      <ShadowTransport
        playing={playing}
        time={time}
        duration={duration}
        volume={volume}
        muted={muted}
        rate={rate}
        hasMedia={!failed}
        starts={starts}
        onToggle={() => controlsRef.current?.toggle()}
        onSeek={(t) => controlsRef.current?.seek(t)}
        onNudge={(d) => controlsRef.current?.nudge(d)}
        onPrevSeg={(starts) => controlsRef.current?.prevSegment(starts)}
        onNextSeg={(starts) => controlsRef.current?.nextSegment(starts)}
        onVolume={(v) => {
          setVolume(v);
          setMuted(false);
        }}
        onMute={() => setMuted((m) => !m)}
        onRate={(r) => setRateState(r)}
      />
    </div>
  );
}

/* ── Lecteur texte (horloge virtuelle) ─────────────────────────────── */

export function TextShadowPlayer({
  title,
  segments,
  currentTime,
  onSeekClock,
  starts,
}: {
  title: string;
  segments: Array<{ id: number; start: number; end: number; text: string }>;
  currentTime: number;
  onSeekClock: (t: number) => void;
  starts: number[];
}) {
  const duration = useMemo(
    () => (segments.length > 0 ? segments[segments.length - 1].end : 0),
    [segments],
  );
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef(currentTime);
  clockRef.current = currentTime;

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => {
      const next = clockRef.current + 0.25;
      const end = durationRef.current;
      if (next >= end) {
        setPlaying(false);
        onSeekClock(end);
        return;
      }
      onSeekClock(next);
    }, 250);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const durationRef = useRef(duration);
  durationRef.current = duration;

  const active = segments.find(
    (s) => currentTime >= s.start && currentTime < s.end,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-noir-2">
      <div className="border-b border-white/5 px-5 py-4">
        <p className="font-mono text-[0.625rem] uppercase tracking-widest text-gold">
          Texte importé
        </p>
        <h3 className="mt-0.5 font-display text-lg font-semibold">{title}</h3>
        {active && (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">
            {active.text}
          </p>
        )}
      </div>
      <ShadowTransport
        playing={playing}
        time={currentTime}
        duration={duration}
        volume={1}
        muted={false}
        rate={1}
        hasMedia={segments.length > 0}
        starts={starts}
        minimal
        onToggle={() => setPlaying((p) => !p)}
        onSeek={(t) => onSeekClock(Math.max(0, Math.min(duration, t)))}
        onNudge={(d) =>
          onSeekClock(Math.max(0, Math.min(duration, currentTime + d)))
        }
        onPrevSeg={(starts) => {
          const prev = [...starts].reverse().find((s) => s < currentTime - 0.4);
          onSeekClock(prev ?? 0);
        }}
        onNextSeg={(starts) => {
          const next = starts.find((s) => s > currentTime + 0.2);
          onSeekClock(next ?? duration);
        }}
        onVolume={() => {}}
        onMute={() => {}}
        onRate={() => {}}
      />
      <div className="flex items-center justify-between px-5 py-2 text-[0.6875rem] text-ink-3">
        <span className="flex items-center gap-1.5">
          <ChevronLeft className="size-3" /> segment
        </span>
        <span className="font-mono">
          {segments.findIndex((s) => s.id === active?.id) + 1} /{" "}
          {segments.length}
        </span>
        <span className="flex items-center gap-1.5">
          segment <ChevronRight className="size-3" />
        </span>
      </div>
    </div>
  );
}
