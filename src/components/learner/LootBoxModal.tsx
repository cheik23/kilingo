import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Confetti, CountUp } from "@/components/fx/rewards";
import { coinTrailFrom } from "@/components/fx/coinTrail";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { showAchievementFeedback } from "@/lib/achievementFeedback";
import { soundEngine } from "@/lib/soundEngine";
import {
  MascotStage,
  useMascotSafe,
} from "@/components/three/MascotProvider";

/* Le coffre 3D vit dans un chunk séparé : three.js n'est téléchargé
   qu'à l'ouverture effective d'une loot box, et seulement si le device
   le permet. `fallback` garantit l'icône 2D d'origine dans tous les
   autres cas (reduced-motion, low-end, WebGL absent). */
const LootChest3D = lazy(() =>
  import("@/components/three/LootChest3D").then((m) => ({ default: m.LootChest3D })),
);

/* ═══════════════════════════════════════════════════════════════════
   LOOT BOX MODAL (MOD 2 — B.4) — récompense variable, thème or/noir.

   Cascade : découverte (« 🎁 Loot Box gagnée ! ») → ouverture
   (animation 3 s : coffre + lumière dorée) → révélation. Confettis
   dorés si rare/epic. Le contenu a été figé côté serveur à la
   création (anti-triche) ; toute l'animation est cosmétique. Le
   résultat réel vient de gamification:openLootBox.
   Zéro rouge : le doré est réservé aux récompenses.
   ═══════════════════════════════════════════════════════════════════ */

const GOLD = "var(--gold-primary)";

type OpenResult = {
  tier: "common" | "rare" | "epic";
  rewardGems: number;
  badgeId?: string;
  avatarToken?: boolean;
  alreadyOpened: boolean;
  gems: number;
};

export function LootBoxModal({
  lootId,
  onClose,
}: {
  lootId: Id<"userLootBoxes"> | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  // Mouvement réduit ⇒ tout est statique : pas de flottement, pas de
  // secousse, pas de lueur pulsée (le contenu reste identique).
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const openBox = useMutation(api.gamification.openLootBox);
  const checkAchievements = useAction(api.achievements.checkAchievements);
  const [phase, setPhase] = useState<"sealed" | "opening" | "revealed">("sealed");
  const [result, setResult] = useState<OpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Jabari présente le coffre, puis saute quand l'objet sort.
  const mascot = useMascotSafe();

  // Nouvelle box → retour à l'état scellé.
  useEffect(() => {
    setPhase("sealed");
    setResult(null);
    setError(null);
    // À l'ouverture du modal, il salue et montre le coffre.
    mascot?.play("wave", 2600);
  }, [lootId, mascot]);

  const open = () => {
    if (!lootId || phase !== "sealed") return;
    soundEngine.play("loot");
    setPhase("opening");
    // 3 s d'animation avant la requête : la révélation tombe pile à la
    // fin de l'effet (le contenu réel est déjà figé côté serveur).
    setTimeout(() => {
      openBox({ lootId })
        .then((r) => {
          setResult(r as OpenResult);
          soundEngine.play("reward");
          setPhase("revealed");
          mascot?.play("celebrate", 2600);
          void checkAchievements({}).then(showAchievementFeedback).catch(() => undefined);
        })
        .catch((e: Error) => {
          setError(e.message);
          setPhase("sealed");
        });
    }, 3000);
  };

  return (
    <AnimatePresence>
      {lootId !== null && (
        <motion.div
          key="loot-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-noir/95 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("loot.title")}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="ln-modal-safe max-w-md rounded-2xl border border-gold/30 bg-noir-2 p-5 shadow-[0_0_90px_rgba(212,165,116,0.2)] sm:p-6"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="ms-auto flex rounded-lg p-1 text-ink-3 transition-colors hover:text-ink"
            >
              <X className="size-4" />
            </button>

            {phase === "sealed" && (
              <div className="relative text-center">
                {/* Jabari présente le coffre depuis le coin. */}
                <MascotStage
                  variant="auto"
                  className="absolute -top-2 end-0 h-20 w-20"
                  bubbleClassName="justify-end"
                />
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.25em] text-gold">
                  {t("loot.title")}
                </p>
                <motion.div
                  animate={reduced ? undefined : { y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                  className="mx-auto mt-5"
                >
                  <Suspense fallback={<Gift className="mx-auto size-16 text-gold" />}>
                    <LootChest3D open={false} fallback={<Gift className="mx-auto size-16 text-gold" />} />
                  </Suspense>
                </motion.div>
                <p className="mt-4 font-display text-2xl font-bold text-ink">
                  {t("loot.wonTitle")}
                </p>
                <p className="mt-2 text-sm text-ink-2">{t("loot.wonHint")}</p>
                <button
                  type="button"
                  onClick={open}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir transition-transform hover:-translate-y-0.5"
                >
                  {t("loot.open")}
                </button>
              </div>
            )}

            {phase === "opening" && (
              <div className="relative overflow-hidden py-10 text-center">
                {/* Lumière dorée ascendante */}
                <motion.div
                  className="absolute inset-x-0 bottom-0 mx-auto h-40 w-40 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(212,165,116,0.35) 0%, transparent 70%)" }}
                  animate={
                    reduced
                      ? { opacity: 0.7 }
                      : { scale: [0.8, 1.3, 0.8], opacity: [0.4, 0.9, 0.4] }
                  }
                  transition={{ repeat: Infinity, duration: 1.4 }}
                />
                <motion.div
                  animate={
                    reduced
                      ? undefined
                      : { rotate: [0, -4, 4, -4, 0], y: [0, -3, 0] }
                  }
                  transition={{ repeat: Infinity, duration: 0.9 }}
                  className="relative mx-auto w-32"
                >
                  <Suspense fallback={<Gift className="mx-auto size-16 text-gold drop-shadow-[0_0_18px_rgba(212,165,116,0.7)]" />}>
                    <LootChest3D open fallback={<Gift className="mx-auto size-16 text-gold drop-shadow-[0_0_18px_rgba(212,165,116,0.7)]" />} className="mx-auto h-32 w-32" />
                  </Suspense>
                </motion.div>
                <p className="relative mt-6 font-display text-xl text-gold">
                  {t("loot.opening")}
                </p>
                <MascotStage variant="sprite" className="mx-auto mt-4 h-20 w-20" />
              </div>
            )}

            {phase === "revealed" && result && (
              <RevealView result={result} onDone={onClose} />
            )}

            {error && <p className="text-center text-xs text-red-400">{error}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Révélation + confettis si rare/epic ──────────────────────────── */

function RevealView({ result, onDone }: { result: OpenResult; onDone: () => void }) {
  const { t } = useI18n();
  const isSpecial = result.tier !== "common";
  const gemsRef = useRef<HTMLParagraphElement | null>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // LOT H — les gems gagnés quittent la carte en traînée dorée et
  // rejoignent le compteur du header (canvas, 800 ms, aucune re-render).
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => coinTrailFrom(gemsRef.current), 300);
    return () => window.clearTimeout(timer);
  }, [reduced, result.rewardGems]);

  return (
    <div className="relative text-center">
      {/* LOT H — confettis or/noir (80 pièces) pour les paliers rare et +. */}
      {isSpecial && <Confetti pieces={80} />}
      {isSpecial &&
        !reduced &&
        Array.from({ length: 24 }, (_, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute left-1/2 top-8 size-1.5 rounded-full"
            style={{ background: i % 3 === 0 ? "#F5E7B8" : GOLD }}
            initial={{ opacity: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              x: Math.cos((i / 24) * Math.PI * 2) * (70 + (i % 5) * 26),
              y: 110 + (i % 6) * 18,
            }}
            transition={{ duration: 1.6, delay: (i % 6) * 0.07, ease: "easeOut" }}
          />
        ))}

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
      >
        <Sparkles className={cn("mx-auto size-12", isSpecial ? "text-gold" : "text-ink-2")} />
      </motion.div>

      <p
        className={cn(
          "mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.3em]",
          isSpecial ? "text-gold" : "text-ink-3",
        )}
      >
        {t(`loot.tier_${result.tier}`)}
      </p>
      <p ref={gemsRef} className="mt-3 font-display text-4xl font-bold text-gold">
        💎 <CountUp value={result.rewardGems} />
      </p>
      {result.badgeId && (
        <p className="mt-3 text-sm text-ink">
          🏅 {t("loot.badgeWon", { b: result.badgeId })}
        </p>
      )}
      {result.avatarToken && (
        <p className="mt-2 text-sm text-ink">{t("loot.avatarToken")}</p>
      )}
      <p className="mt-4 font-mono text-xs text-ink-3">
        {t("loot.balance", { n: result.gems })}
      </p>

      <button
        type="button"
        onClick={onDone}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir"
      >
        {t("loot.done")}
      </button>
    </div>
  );
}

/** Petit compteur réutilisable : nombre de boxes non ouvertes. */
export function useUnopenedLootCount(): number | undefined {
  const boxes = useQuery(api.gamification.getMyLootBoxes, { opened: false });
  return boxes?.length;
}
