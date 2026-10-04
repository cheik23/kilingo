/* ═══════════════════════════════════════════════════════════════════════
   STUDIO READY PLAYER ME — PANNEAU INTÉGRÉ (onglet « Avatar 3D »)

   Ce composant n'est PLUS une modale. Il vit dans l'onglet « Avatar 3D »
   de la section « Forge ton look » : une seule entrée pour tout l'avatar,
   pas trois boutons qui se chevauchent.

   Le studio RPM est un tiers, et dans un aperçu enrichi son iframe est
   souvent bloquée (X-Frame-Options, pas de WebGL chez le tiers, réseau).
   On ne laisse donc JAMAIS l'utilisateur devant une iframe vide :

     1. squelette animé (silhouette qui pulse) pendant le chargement ;
     2. au bout de 8 s sans `load`, bascule vers la carte de secours ;
     3. la carte de secours propose le studio dans un nouvel onglet ET un
        champ « colle le lien de ton avatar (.glb) ». Les deux voies
        mènent au même résultat : zéro impasse.

   La validation de l'URL (.glb, HTTPS, domainemodels.readyplayer.me)
   reste côté serveur — `setRpmAvatar` refuse tout le reste. L'aperçu
   client ne fait qu'éviter une erreur inutile.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "convex/react";
import { AlertTriangle, ExternalLink, Loader2, Sparkles } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/** Route officielle du studio (pas l'ancienne `/iframe` de l'overlay). */
const STUDIO_URL =
  "https://readyplayer.me/avatar?frame=true&quickStart=true&language=fr";

/** Au-delà, on ne fait plus confiance à l'iframe : carte de secours. */
const LOAD_TIMEOUT_MS = 8000;

const RPM_HOST = /^https:\/\/(models\.)?readyplayer\.me\/.+\.glb(\?.*)?$/i;

/** Vérif miroir de la validation serveur — pour ne pas erred-visible. */
export function looksLikeRpmGlb(value: string): boolean {
  return RPM_HOST.test(value.trim());
}

type RpmMessage = {
  source?: string;
  data?: { eventName?: string; avatarURL?: string };
};

/** Silhouette qui pulse : le studio arrive, mais on ne sait pas encore quoi. */
function StudioSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      {/* Silhouette humaine : tête + buste, pas un simple rectangle gris. */}
      <div className="relative flex flex-col items-center" aria-hidden>
        <div className="size-16 animate-pulse rounded-full bg-gradient-to-b from-gold/40 to-gold/10" />
        <div className="-mt-3 h-20 w-28 animate-pulse rounded-t-[3rem] bg-gradient-to-b from-gold/35 to-transparent" />
      </div>
      <p className="animate-pulse text-sm text-ink-3">
        Chargement du studio…
      </p>
    </div>
  );
}

export function RpmAvatarStudio({
  onSaved,
  className = "",
}: {
  onSaved?: (url: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const saveAvatar = useMutation(api.customization.setRpmAvatar);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (url: string) => {
      setSaving(true);
      setManualError(null);
      try {
        await saveAvatar({ url });
        onSaved?.(url);
      } catch {
        // Domaine refusé ou réseau coupé : jamais de trace technique, on
        // redemande simplement une autre URL.
        setManualError(t("space.rpm.error"));
      } finally {
        setSaving(false);
      }
    },
    [saveAvatar, onSaved, t],
  );

  // 1. Le timeout de sécurité : 8 s sans `load` → carte de secours.
  useEffect(() => {
    timer.current = setTimeout(() => setStatus("failed"), LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // 2. Le studio répond : on annule le filet de sécurité.
  const handleLoad = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("ready");
  }, []);

  // 3. Le studio crée l'avatar et publie l'URL (.glb) dans le message.
  useEffect(() => {
    const onMessage = (event: MessageEvent<RpmMessage>) => {
      const data = event.data?.data;
      if (data?.eventName !== "v1-avatar-created") return;
      const url = data.avatarURL;
      if (typeof url === "string" && url.length > 0) void persist(url);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [persist]);

  const submitManual = useCallback(() => {
    const value = manual.trim();
    if (!looksLikeRpmGlb(value)) {
      setManualError(t("space.rpm.badLink"));
      return;
    }
    void persist(value);
  }, [manual, persist, t]);

  return (
    <div className={className}>
      <div className="relative min-h-[22rem] overflow-hidden rounded-(--radius-lg) border border-white/10 bg-noir">
        {/* Le squelette reste SOUS l'iframe : visible tant que le studio
            n'a pas peint, invisible dès qu'il répond. */}
        <AnimatePresence>
          {status !== "ready" && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 z-0"
            >
              <StudioSkeleton />
            </motion.div>
          )}
        </AnimatePresence>

        {status === "failed" ? (
          /* ── Carte de secours : deux sorties, aucune impasse ─────────── */
          <div className="relative z-10 flex min-h-[22rem] flex-col items-center justify-center gap-4 p-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full border border-terracotta/40 bg-terracotta/10 text-terracotta">
              <AlertTriangle className="size-5" aria-hidden />
            </span>
            <p className="max-w-sm text-sm leading-relaxed text-ink-2">
              {t("space.rpm.fallback")}
            </p>
            <Button
              onClick={() => window.open(STUDIO_URL, "_blank", "noopener,noreferrer")}
              className="gap-2 bg-gradient-to-r from-gold-strong to-gold text-noir"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t("space.rpm.openTab")}
            </Button>
            <p className="text-xs text-ink-3">{t("space.rpm.pasteHint")}</p>
            <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
              <input
                type="url"
                inputMode="url"
                value={manual}
                onChange={(event) => {
                  setManual(event.target.value);
                  setManualError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitManual();
                }}
                placeholder="https://models.readyplayer.me/….glb"
                aria-label={t("space.rpm.paste")}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-noir-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3/70 focus:border-gold/50 focus:outline-none"
              />
              <Button
                onClick={submitManual}
                disabled={saving || manual.trim().length === 0}
                className="shrink-0 gap-2"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {t("space.rpm.useLink")}
              </Button>
            </div>
            {manualError && (
              <p className="text-xs text-terracotta">{manualError}</p>
            )}
          </div>
        ) : (
          <iframe
            src={STUDIO_URL}
            title={t("space.rpm.studio")}
            onLoad={handleLoad}
            loading="lazy"
            allow="camera; microphone; fullscreen; xr-spatial-tracking"
            className="relative z-10 block size-full min-h-[22rem] border-0"
          />
        )}
      </div>
    </div>
  );
}

export default RpmAvatarStudio;
