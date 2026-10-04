import { useEffect, useRef, useState } from "react";
import {
  useYouTubePlayer,
  type YTControls,
} from "@/hooks/use-youtube-player";
import { TriangleAlert } from "lucide-react";

/**
 * Responsive YouTube embed that reports the playback clock (sampled every
 * 500 ms while playing) so parents can synchronize content to the video —
 * e.g. highlight the active subtitle in ScreenShadow.
 *
 * `controlsRef` exposes imperative transport (play/pause/seek/rate) so a
 * parent can drive the player — segment clicks, skip buttons, speed. It is
 * filled once the IFrame API reports ready; until then every method is a
 * no-op, so callers never need to check.
 */
export function YouTubeEmbed({
  videoId,
  onTimeUpdate,
  controlsRef,
  onPlayingChange,
  className = "",
}: {
  videoId: string | null;
  onTimeUpdate?: (time: number) => void;
  controlsRef?: React.RefObject<YTControls | null>;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}) {
  // Keep the latest callback without ever re-creating the player.
  const cbRef = useRef(onTimeUpdate);
  useEffect(() => {
    cbRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const { hostRef } = useYouTubePlayer(videoId, {
    onTimeUpdate: (t) => cbRef.current?.(t),
    onControls: (c) => {
      if (controlsRef) controlsRef.current = c;
    },
    onPlayingChange,
    onError: setError,
    reloadKey,
  });

  // A new video clears any previous error.
  useEffect(() => {
    setError(null);
  }, [videoId]);

  if (!videoId) {
    return (
      <div
        className={`flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-noir-2 ${className}`}
      >
        <p className="text-sm text-ink-3">Aucune vidéo liée</p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_16px_32px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div className="relative w-full pt-[56.25%]">
        <div
          ref={hostRef}
          className="absolute inset-0 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full"
        />
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-noir/95 p-6 text-center">
            <TriangleAlert className="size-8 text-gold" />
            <p className="max-w-sm text-sm text-ink">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setReloadKey((k) => k + 1);
              }}
              className="rounded-lg border border-white/15 px-4 py-2 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
