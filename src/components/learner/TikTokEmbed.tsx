import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, TriangleAlert, Upload } from "lucide-react";
import type { TTControls } from "@/hooks/use-tiktok-player";

/**
 * Lecteur OFFICIEL TikTok (developer.tiktok.com/doc/embed-player) monté dans
 * une iframe responsive. Le contrôle (play/pause/seekTo/mute) passe par
 * postMessage avec une validation stricte de `event.origin` — aucun message
 * d'une autre origine n'est accepté.
 *
 * `controlsRef` expose le transport impératif (rempli à `onPlayerReady`,
 * no-op avant) ; `onTimeUpdate` reçoit l'horloge poussée par le lecteur
 * (`onCurrentTime`, ≈ 4 Hz) — même contrat que YouTubeEmbed pour Shadow.
 *
 * TikTok n'expose pas de transcription : ce lecteur est monté indépendamment
 * du pipeline de sous-titres (le karaoké reste honnêtement indisponible).
 */
export function TikTokEmbed({
  postId,
  onTimeUpdate,
  controlsRef,
  onPlayingChange,
  onRequestUpload,
  onRequestPaste,
  className = "",
}: {
  /** ID numérique du post TikTok (jamais une URL — construit par le resolver). */
  postId: string;
  onTimeUpdate?: (time: number) => void;
  controlsRef?: React.RefObject<TTControls | null>;
  onPlayingChange?: (playing: boolean) => void;
  /** TikTok ne fournit aucun texte : ces deux portes ouvrent les seules
   *  voies qui marchent (fichier téléchargé, ou texte collé). Optionnelles :
   *  l'embed reste utilisable seul, sans bouton mort. */
  onRequestUpload?: () => void;
  onRequestPaste?: () => void;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derniers callbacks sans re-créer les listeners à chaque rendu.
  const cbRef = useRef(onTimeUpdate);
  useEffect(() => {
    cbRef.current = onTimeUpdate;
  }, [onTimeUpdate]);
  const playingCbRef = useRef(onPlayingChange);
  useEffect(() => {
    playingCbRef.current = onPlayingChange;
  }, [onPlayingChange]);
  const controlsRefLocal = useRef<TTControls | null>(null);

  // Commande vers le lecteur — cible `contentWindow` à chaque envoi (l'iframe
  // peut avoir été remplacée) ; silencieux tant que le player n'est pas prêt.
  const post = useRef((type: string, value?: number) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type, value, "x-tiktok-player": true },
      "https://www.tiktok.com",
    );
  });

  useEffect(() => {
    setReady(false);
    setError(null);
    controlsRefLocal.current = {
      play: () => post.current("play"),
      pause: () => post.current("pause"),
      seekTo: (t) => post.current("seekTo", Math.max(0, t)),
      mute: () => post.current("mute"),
      unMute: () => post.current("unMute"),
    };
    if (controlsRef) controlsRef.current = controlsRefLocal.current;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.tiktok.com") return;
      if (!event.data || event.data["x-tiktok-player"] !== true) return;
      switch (event.data.type) {
        case "onPlayerReady":
          setReady(true);
          break;
        case "onStateChange": {
          // 1 = playing, 3 = buffering (protocole officiel).
          const state = event.data.value;
          playingCbRef.current?.(state === 1 || state === 3);
          if (state === 0) cbRef.current?.(0);
          break;
        }
        case "onCurrentTime":
          // value = temps courant (secondes).
          if (typeof event.data.value === "number") {
            cbRef.current?.(event.data.value);
          }
          break;
        case "onPlayerError": {
          const code = Number(event.data.value);
          const reason =
            code === 1001
              ? "Vidéo TikTok introuvable — supprimée ou lien invalide."
              : code === 2001
                ? "TikTok n'arrive pas à servir cette vidéo — réessaie dans un instant."
                : code === 3002
                  ? "Lecture automatique bloquée par le navigateur — appuie sur lecture."
                  : "Le lecteur TikTok a échoué pour cette vidéo.";
          setError(reason);
          break;
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postId, controlsRef]);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_16px_32px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div className="relative mx-auto w-full max-w-[340px] pt-[177.78%] sm:pt-[130%]">
        <iframe
          ref={iframeRef}
          src={`https://www.tiktok.com/player/v1/${postId}?rel=0&native_context_menu=0`}
          title="Lecteur TikTok"
          allow="fullscreen; encrypted-media; picture-in-picture"
          className="absolute inset-0 size-full"
        />
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-noir/95 p-6 text-center">
            <TriangleAlert className="size-8 text-gold" />
            <p className="max-w-xs text-sm text-ink">{error}</p>
          </div>
        )}
      </div>

      {/* Carte honnête : TikTok n'expose NI sous-titres NI transcription, et
          son lecteur ne dit rien des paroles. Plutôt qu'un karaoké vide, on
          l'explique en une phrase et on propose les deux portes qui
          fonctionnent — sans jamais afficher d'erreur technique. */}
      <div className="border-t border-gold/20 bg-noir-2/95 px-4 py-3">
        <p className="text-[0.6875rem] leading-relaxed text-ink-2">
          TikTok ne partage pas ses sous-titres. Télécharge ta vidéo ou colle
          le texte.
        </p>
        {(onRequestUpload || onRequestPaste) && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {onRequestUpload && (
              <button
                type="button"
                onClick={onRequestUpload}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold to-gold-soft px-3 py-1.5 text-[0.6875rem] font-semibold text-noir transition-transform hover:-translate-y-0.5"
              >
                <Upload className="size-3" />
                Uploader ta vidéo
              </button>
            )}
            {onRequestPaste && (
              <button
                type="button"
                onClick={onRequestPaste}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[0.6875rem] text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
              >
                <ClipboardPaste className="size-3" />
                Coller le texte
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
