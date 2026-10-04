/* ═══════════════════════════════════════════════════════════════════════
   JABARI — PROVIDER & SCÈNE PARTAGÉE

   Un seul point de vérité pour l'humeur de la mascotte. N'importe quelle
   page peut lui demander de célébrer, de râler ou de saluer ; la bulle
   affichée est toujours la chaîne `mascot.*` de la langue courante.

   Règle de performance : une seule scène 3D vivante à la fois. Chaque
   `MascotStage` s'inscrit au montage ; la plus récente obtient le WebGL,
   les autres tombent automatiquement sur le sprite 2D (moins cher, et
   visuellement cohérent puisqu'il porte le même visage).
   ═════════════════════════════════════════════════════════════════════ */

import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "../../lib/i18n";
import { shouldUse3D, supportsReducedMotion } from "../../lib/perf";
import { type MascotState } from "./Mascot";
import { MascotSprite } from "./MascotSprite";

/* La scène 3D est un chunk séparé : le provider est monté dans le shell
   (donc sur toutes les pages) et ne doit surtout pas traîner three.js
   dans le bundle initial. Le type seul est importé — coût nul. */
const Mascot = lazy(() => import("./Mascot"));

/* ── Registre d'instances (un seul WebGL) ─────────────────────────── */
let liveStages = 0;
let latestStage = 0;
function claimStage(): number {
  latestStage += 1;
  liveStages += 1;
  return latestStage;
}
function releaseStage() {
  liveStages = Math.max(0, liveStages - 1);
}

/* ── Contexte ─────────────────────────────────────────────────────── */
type MascotContextValue = {
  state: MascotState;
  /** Change d'état. `ms` = durée avant retour automatique à `idle`. */
  play: (next: MascotState, ms?: number) => void;
  /** Force un état persistant (untilChanged). */
  setState: (next: MascotState) => void;
  /** Micro-bulles libres (hors machine d'état). */
  say: (key: string) => void;
  /** Clic sur la mascotte : salut + une phrase tirée au sort. */
  tap: () => void;
  line: string | null;
  dismiss: () => void;
};

const MascotContext = createContext<MascotContextValue | null>(null);

export function useMascot(): MascotContextValue {
  const ctx = useContext(MascotContext);
  if (!ctx) throw new Error("useMascot doit être utilisé dans <MascotProvider>");
  return ctx;
}

/**
 * Variante tolérante pour les surfaces qui vivent HORS du shell
 * (ErrorBoundary racine, onboarding public) : renvoie null si aucun
 * provider n'est monté, l'appelant garde alors son rendu neutre.
 */
export function useMascotSafe(): MascotContextValue | null {
  return useContext(MascotContext);
}

const RANDOM_TAPS = [
  "mascot.tap",
  "mascot.wave",
  "mascot.dance",
  "mascot.idle",
] as const;

export function MascotProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<MascotState>("idle");
  const [line, setLine] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const play = useCallback(
    (next: MascotState, ms = 2000) => {
      clearTimer();
      setState(next);
      // La bulle suit l'état, sauf pour `dance` qui n'a pas de phrase propre.
      if (next !== "dance") setLine(t(`mascot.${next}`));
      if (ms > 0) {
        timer.current = setTimeout(() => {
          setState("idle");
          setLine(null);
        }, ms);
      }
    },
    [clearTimer, t],
  );

  const persist = useCallback((next: MascotState) => {
    clearTimer();
    setState(next);
    setLine(next === "dance" ? null : t(`mascot.${next}`));
  }, [clearTimer, t]);

  const say = useCallback((key: string) => {
    clearTimer();
    setLine(t(key));
    timer.current = setTimeout(() => setLine(null), 3200);
  }, [clearTimer, t]);

  const dismiss = useCallback(() => setLine(null), []);

  // Le salut n'est jamais deux fois le même : on tire la phrase au sort
  // dans la section mascot.* de la langue courante, puis on rend la main
  // au repos après 2.2 s (état ET bulle retombent ensemble).
  const tap = useCallback(() => {
    clearTimer();
    const key = RANDOM_TAPS[Math.floor(Math.random() * RANDOM_TAPS.length)];
    setState("wave");
    setLine(t(key));
    timer.current = setTimeout(() => {
      setState("idle");
      setLine(null);
    }, 2200);
  }, [clearTimer, t]);

  const value = useMemo<MascotContextValue>(
    () => ({ state, play, setState: persist, say, tap, line, dismiss }),
    [state, play, persist, say, tap, line, dismiss],
  );

  return <MascotContext.Provider value={value}>{children}</MascotContext.Provider>;
}

/* ── Bulle ────────────────────────────────────────────────────────── */
export function SpeechBubble({
  className = "",
  maxWidth = "16rem",
}: {
  className?: string;
  maxWidth?: string;
}) {
  const { line, dismiss } = useMascot();
  return (
    <AnimatePresence>
      {line && (
        <motion.button
          type="button"
          onClick={dismiss}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          style={{ maxWidth }}
          className={`pointer-events-auto cursor-pointer rounded-(--radius-md) border border-gold-primary/30 bg-card-bg/95 px-4 py-2.5 text-left text-sm leading-snug text-ink shadow-lg backdrop-blur ${className}`}
        >
          {line}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ── Scène ────────────────────────────────────────────────────────── */
export type MascotStageProps = {
  /** `sprite` = visage 2D seul (jamais de WebGL). `auto` = 3D si possible. */
  variant?: "auto" | "sprite" | "scene";
  className?: string;
  bubbleClassName?: string;
  /** Affiche la bulle sous la mascotte. */
  bubble?: boolean;
  /** Désactive le clic (surfaces purement décoratives). */
  interactive?: boolean;
  onTap?: () => void;
};

export function MascotStage({
  variant = "auto",
  className = "h-44 w-44",
  bubble = true,
  bubbleClassName = "",
  interactive = true,
  onTap,
}: MascotStageProps) {
  const { state, tap: mascotTap } = useMascot();
  const [isLatest, setIsLatest] = useState(false);
  const [reduced] = useState(() => supportsReducedMotion());

  useEffect(() => {
    const id = claimStage();
    setIsLatest(id === latestStage);
    return () => releaseStage();
  }, []);

  // 3D uniquement pour la dernière scène montée, si l'appareil suit.
  const useScene =
    variant === "scene" || (variant === "auto" && isLatest && shouldUse3D() && !reduced);

  const handleTap = () => {
    mascotTap();
    onTap?.();
  };

  if (variant === "sprite") {
    return (
      <div className={className}>
        <MascotSprite state={state} className="size-full" />
      </div>
    );
  }

  if (useScene) {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleTap}
          aria-label="Jabari"
          className={`block size-full cursor-pointer rounded-(--radius-lg) ${interactive ? "" : "pointer-events-none"}`}
        >
          {/* Pendant le chargement du chunk three : la même mascotte en 2D,
              pour qu'il n'y ait jamais de trou visuel. */}
          <Suspense
            fallback={<MascotSprite state={state} className="size-full" />}
          >
            <Mascot state={state} interactive={interactive} className="size-full" />
          </Suspense>
        </button>
        {bubble && (
          <div className={`absolute inset-x-0 top-full z-20 mt-1 flex justify-center ${bubbleClassName}`}>
            <SpeechBubble />
          </div>
        )}
      </div>
    );
  }

  // Repli 2D — même visage, mêmes expressions, aucun WebGL.
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleTap}
        aria-label="Jabari"
        className={`block size-full cursor-pointer ${interactive ? "" : "pointer-events-none"}`}
      >
        <motion.div
          className="size-full"
          animate={
            reduced
              ? undefined
              : state === "dance"
                ? { rotate: [0, -6, 6, 0], y: [0, -6, 0] }
                : state === "celebrate"
                  ? { y: [0, -10, 0], scale: [1, 1.05, 1] }
                  : state === "nag"
                    ? { x: [0, -4, 4, -4, 0] }
                    : { y: [0, -4, 0] }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <MascotSprite state={state} className="size-full" />
        </motion.div>
      </button>
      {bubble && (
        <div className={`absolute inset-x-0 top-full z-20 mt-1 flex justify-center ${bubbleClassName}`}>
          <SpeechBubble />
        </div>
      )}
    </div>
  );
}

export { RANDOM_TAPS };
export default MascotProvider;
