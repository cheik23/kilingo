import { useEffect, useState } from "react";

/**
 * Transport impératif du lecteur TikTok officiel — commandes envoyées par
 * postMessage (protocole : developer.tiktok.com/doc/embed-player).
 */
export type TTControls = {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  mute: () => void;
  unMute: () => void;
};

/**
 * Synchronise l'état `ready` / `playing` / durée avec le lecteur TikTok
 * officiel monté dans `TikTokEmbed` : même protocole postMessage, mêmes
 * validations d'origine. La durée arrive via le champ `duration` porté par
 * les messages `onCurrentTime` du lecteur.
 *
 * Séparé du composant d'embed pour que Shadow puisse souscrire à l'état de
 * lecture sans recréer l'iframe (le composant reste le seul propriétaire du
 * DOM ; ce hook n'écoute que les messages).
 */
export function useTikTokPlayer(
  postId: string | null,
  origin = "https://www.tiktok.com",
) {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!postId) {
      setReady(false);
      setPlaying(false);
      setDuration(0);
      return;
    }
    setReady(false);
    setPlaying(false);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      if (!event.data || event.data["x-tiktok-player"] !== true) return;
      switch (event.data.type) {
        case "onPlayerReady":
          setReady(true);
          break;
        case "onStateChange": {
          const state = event.data.value;
          setPlaying(state === 1 || state === 3);
          if (state === 0) setPlaying(false);
          break;
        }
        case "onCurrentTime": {
          // value = temps courant ; le champ `duration` accompagne le message.
          const d = (event.data as { duration?: unknown }).duration;
          if (typeof d === "number" && d > 0) setDuration(d);
          break;
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postId, origin]);

  return { ready, playing, duration };
}
