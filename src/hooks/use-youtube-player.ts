import { useEffect, useRef, useState } from "react";

// ─── Minimal ambient types for the YouTube IFrame API (no extra dep) ──
interface YTPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  // Contrôle audio officiel de l'API IFrame (setVolume : 0–100).
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
}
interface YTPlayerEvent {
  data: number;
}
interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: () => void;
    onStateChange?: (event: YTPlayerEvent) => void;
    onError?: (event: YTPlayerEvent) => void;
  };
}

/** Messages lisibles pour les codes d'erreur officiels de l'IFrame API. */
function ytErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return "Identifiant de vidéo YouTube invalide.";
    case 5:
      return "Le lecteur HTML5 de YouTube a échoué — réessaie.";
    case 100:
      return "Vidéo introuvable : supprimée ou privée.";
    case 101:
    case 150:
      return "Le propriétaire de cette vidéo interdit la lecture intégrée (embed).";
    default:
      return `Erreur YouTube (${code}).`;
  }
}
interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_URL = "https://www.youtube.com/iframe_api";
const SCRIPT_FLAG = "data-linguoshadow-yt-api";

function loadIframeApi(onReady: () => void): void {
  if (window.YT?.Player) {
    // Script already loaded (or cached): the global ready callback will
    // never fire again — invoke directly.
    onReady();
    return;
  }
  // Global singleton: chain instead of overwrite so concurrent consumers
  // keep working.
  const previous = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    previous?.();
    onReady();
  };
  if (!document.querySelector(`script[${SCRIPT_FLAG}]`)) {
    const tag = document.createElement("script");
    tag.src = SCRIPT_URL;
    tag.setAttribute(SCRIPT_FLAG, "true");
    document.head.appendChild(tag);
  }
}

/** Imperative controls shared upward through a ref (no re-render churn). */
export type YTControls = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
  /** Volume 0–1 (converti 0–100 pour l'API IFrame). */
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
};

const API_LOAD_TIMEOUT_MS = 12_000;

/**
 * Mounts a YouTube IFrame player into `hostRef` and samples the playback
 * clock (`getCurrentTime`) every `sampleMs` while the video is playing.
 *
 * Fixes over the naive pattern: the sampling interval is a ref-owned timer
 * cleaned up on every state change and unmount (no stacking, no leaks), the
 * global API-ready callback is chained (works when the script is cached),
 * and the player is destroyed on unmount and on video change.
 */
export function useYouTubePlayer(
  videoId: string | null,
  options?: {
    onTimeUpdate?: (time: number) => void;
    sampleMs?: number;
    /** Receives imperative controls as soon as the player is ready. */
    onControls?: (controls: YTControls) => void;
    /** True while the video plays or buffers (drives transport buttons). */
    onPlayingChange?: (playing: boolean) => void;
    /** Human-readable failure (API bloquée, vidéo privée, embed interdit…). */
    onError?: (message: string) => void;
    /** Bump to force a full teardown + rebuild (retry after an error). */
    reloadKey?: number;
  },
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(options?.onTimeUpdate);
  const controlsCbRef = useRef(options?.onControls);
  const playingCbRef = useRef(options?.onPlayingChange);
  const errorCbRef = useRef(options?.onError);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbackRef.current = options?.onTimeUpdate;
  }, [options?.onTimeUpdate]);
  useEffect(() => {
    controlsCbRef.current = options?.onControls;
  }, [options?.onControls]);
  useEffect(() => {
    playingCbRef.current = options?.onPlayingChange;
  }, [options?.onPlayingChange]);
  useEffect(() => {
    errorCbRef.current = options?.onError;
  }, [options?.onError]);

  useEffect(() => {
    if (!videoId || !hostRef.current) return;
    let cancelled = false;
    setPlaying(false);
    setReady(false);

    const stopClock = () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const startClock = () => {
      stopClock();
      timerRef.current = setInterval(() => {
        const player = playerRef.current;
        if (player) callbackRef.current?.(player.getCurrentTime());
      }, options?.sampleMs ?? 500);
    };

    console.log(`[ShadowURL] player mount — videoId ${videoId}`);

    // Watchdog : si l'API IFrame n'arrive jamais (script bloqué par une
    // extension/réseau, offline), on affiche une erreur au lieu d'une
    // boîte noire éternelle.
    const apiWatchdog = window.setTimeout(() => {
      if (!cancelled && !playerRef.current && !window.YT?.Player) {
        errorCbRef.current?.(
          "Le lecteur YouTube n'a pas pu se charger — vérifie ta connexion ou une extension qui bloquerait youtube.com.",
        );
      }
    }, API_LOAD_TIMEOUT_MS);

    loadIframeApi(() => {
      if (cancelled || !hostRef.current || !window.YT) return;
      // The API replaces this placeholder element with the iframe — a fresh
      // child per mount keeps re-mounts (video change) working.
      const mountPoint = document.createElement("div");
      hostRef.current.replaceChildren(mountPoint);
      try {
        playerRef.current = new window.YT.Player(mountPoint, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              if (cancelled) return;
              console.log("[ShadowURL] player ready");
              setReady(true);
              controlsCbRef.current?.({
                play: () => playerRef.current?.playVideo(),
                pause: () => playerRef.current?.pauseVideo(),
                seek: (s) => playerRef.current?.seekTo(Math.max(0, s), true),
                setRate: (r) => playerRef.current?.setPlaybackRate(r),
                setVolume: (v) =>
                  playerRef.current?.setVolume(Math.round(Math.min(1, Math.max(0, v)) * 100)),
                mute: () => playerRef.current?.mute(),
                unMute: () => playerRef.current?.unMute(),
              });
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const isPlaying =
                event.data === window.YT?.PlayerState.PLAYING ||
                event.data === window.YT?.PlayerState.BUFFERING;
              console.log(`[ShadowURL] playback state — ${event.data}`);
              setPlaying(isPlaying);
              playingCbRef.current?.(isPlaying);
              if (event.data === window.YT?.PlayerState.PLAYING) {
                startClock();
              } else {
                stopClock();
              }
            },
            onError: (event) => {
              if (cancelled) return;
              const message = ytErrorMessage(event.data);
              console.error(`[ShadowURL] player error — ${event.data} : ${message}`);
              errorCbRef.current?.(message);
            },
          },
        });
      } catch (err) {
        if (!cancelled) {
          errorCbRef.current?.(
            err instanceof Error
              ? `Lecteur YouTube : ${err.message}`
              : "Le lecteur YouTube n'a pas pu être créé.",
          );
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(apiWatchdog);
      stopClock();
      try {
        playerRef.current?.destroy();
      } catch {
        // player already gone
      }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [videoId, options?.sampleMs, options?.reloadKey]);

  return { hostRef, playing, ready };
}
