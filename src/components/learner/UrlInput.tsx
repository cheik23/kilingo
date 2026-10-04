import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { Link2, Loader2, ScanSearch } from "lucide-react";
import {
  detectPlatform,
  PLATFORM_LABELS,
  type MediaPlatform,
} from "../../convex/mediaResolver";

export type ParsedVideo = {
  platform: MediaPlatform;
  /** Absent pour les plateformes sans ID structuré (SoundCloud…). */
  videoId?: string;
  url: string;
};

const PLATFORM_HINTS: Record<MediaPlatform, string> = {
  youtube: "lecture intégrée et sous-titres disponibles",
  tiktok: "lecture intégrée (lecteur officiel) ; sans sous-titres",
  vimeo: "lecture directe limitée, l'upload complet reste disponible",
  dailymotion: "lecture intégrée (lecteur officiel) ; sans sous-titres",
  archive: "média du domaine public — lecture intégrée",
  soundcloud: "audio externe — l'upload complet reste disponible",
  twitch: "lecture externe — l'upload complet reste disponible",
  instagram: "lecture externe — l'upload complet reste disponible",
  direct: "fichier direct — l'upload garantit l'analyse complète",
  external: "plateforme fermée — l'upload complet reste disponible",
};

/**
 * Intake URL — la détection appartient DÉSORMAIS au MediaUrlResolver
 * (convex/mediaResolver.ts) : une seule logique de reconnaissance pour
 * toutes les plateformes. Ce composant ne fait que préparer la soumission ;
 * la résolution complète (métadonnées oEmbed, verdict de lisibilité) a lieu
 * côté backend via media.resolveMediaUrl avant toute création de média.
 */
export function parseVideoUrl(raw: string): ParsedVideo | null {
  const detected = detectPlatform(raw);
  if (!detected) return null;
  const { adapter, url } = detected;
  const base = adapter.resolve(url);
  return { platform: adapter.key, videoId: base.id, url: raw.trim() };
}

export { PLATFORM_LABELS };

export function UrlInput({
  onAnalyse,
  busy = false,
}: {
  onAnalyse?: (video: ParsedVideo) => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseVideoUrl(value), [value]);
  const canSubmit = parsed !== null && !busy;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError("Colle d'abord un lien de vidéo.");
      return;
    }
    if (!parsed) {
      // Message simple + DEUX exemples concrets : l'utilisateur voit
      // immédiatement à quoi ressemble un lien accepté.
      setError(
        "Lien non reconnu. Exemples de liens acceptés : « https://youtu.be/dQw4w9WgXcQ » ou « https://www.tiktok.com/@compte/video/7123456789012345678 ».",
      );
      return;
    }
    setError(null);
    onAnalyse?.(parsed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="ln-fade-up w-full"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="group relative flex-1">
            <Link2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3 transition-colors group-focus-within:text-gold" />
            <input
              type="url"
              inputMode="url"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Colle un lien YouTube, TikTok, Vimeo, SoundCloud..."
              className="w-full rounded-xl border border-white/10 bg-noir-2 py-3.5 pl-11 pr-4 text-sm text-ink transition-all placeholder:text-ink-3 focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,165,116,0.12)] focus:outline-none focus:ring-0"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-6 py-3.5 text-sm font-semibold text-noir transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(212,165,116,0.2)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ScanSearch className="size-4" />
            )}
            Analyser
          </button>
        </div>

        {/* Live platform hint + inline error */}
        <div className="min-h-5 px-1">
          {error ? (
            <p className="text-xs text-red-300">{error}</p>
          ) : parsed ? (
            <p className="text-xs text-gold/80">
              {PLATFORM_LABELS[parsed.platform]} détecté — {PLATFORM_HINTS[parsed.platform]}
            </p>
          ) : null}
        </div>
      </form>
    </motion.div>
  );
}
