import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { speakText, speakableText, isSpeechSupported } from "@/lib/speech";

/**
 * Play the pronunciation of a slang expression with the native Web Speech
 * API — instant playback, 100% free, nothing to generate, nothing to store.
 */
export function SpeakButton({
  text,
  language,
  size = "sm",
  className = "",
}: {
  text: string;
  language: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  // Never leave speech running after the component unmounts.
  // (Appelé inconditionnellement — Rules of Hooks — même si le bouton
  // ne se rend pas ci-dessous faute d'API native.)
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );

  // Règle stricte n°2 (Phase 10-C) : sans l'API native, le composant
  // échoue silencieusement — pas de bouton, pas de crash, jamais.
  if (!isSpeechSupported()) return null;

  const handleSpeak = () => {
    if (playing) return;
    speakText(speakableText(text), language, {
      onStart: () => setPlaying(true),
      onEnd: () => setPlaying(false),
    });
  };

  const dim = size === "lg" ? "size-11" : "size-8";
  const icon = size === "lg" ? "size-5" : "size-3.5";

  return (
    <button
      type="button"
      onClick={handleSpeak}
      title="Écouter la prononciation"
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold transition-all hover:scale-105 hover:bg-gold/20 disabled:opacity-60 ${className}`}
    >
      {/* L'icône est enveloppée : l'anneau (`.ln-speak-ring`) anime
          `transform` + `box-shadow` sur le wrapper, ce qui laisse au bouton
          son `hover:scale-105` intact et ne laisse AUCUN style résiduel
          après la lecture. */}
      <span className={`inline-flex ${playing ? "ln-speak-ring" : ""}`}>
        <Volume2 className={icon} />
      </span>
    </button>
  );
}
