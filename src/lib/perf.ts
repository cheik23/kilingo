import { useSyncExternalStore } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   GARDES DE PERFORMANCE (MODULE 6) — non négociables

   Un seul point de vérité pour décider combien d'effort 3D l'app peut
   Consentir : `full` (tout) ou `lite` (le strict nécessaire).

   Trois entrées, dans cet ordre de priorité :
     1. `prefers-reduced-motion` → TOUT LE 3D est coupé, sans débat ;
     2. device low-end (`hardwareConcurrency <= 4`) ou pas de WebGL → repli ;
     3. watchdog FPS : moins de 30 FPS pendant 3 s → passage en `lite`.

   Le mode `lite` n'est jamais posé par la seule détection : un hoquet
   isolé ne dégrade pas l'app. Il faut trois fenêtres consécutives sous
   le seuil. La remontée en `full` exige dix bonnes fenêtres d'affilée
   (plus une seconde de marge) pour éviter tout clignotement.
   ═══════════════════════════════════════════════════════════════════════ */

export type PerfMode = "full" | "lite";

const FPS_LOW = 30;
const WINDOW_MS = 1000;
const LOW_WINDOWS_TO_DEGRADE = 3;
const HIGH_WINDOWS_TO_RECOVER = 10;

let mode: PerfMode = "full";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Le mode 3D courant. `lite` = replis statiques assumés. */
export function getPerfMode(): PerfMode {
  return mode;
}

export function setPerfMode(next: PerfMode) {
  if (next === mode) return;
  mode = next;
  emit();
}

export function subscribePerfMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Abonnement React au mode 3D : `lite` déclenche les replis. */
export function usePerfMode(): PerfMode {
  return useSyncExternalStore(subscribePerfMode, getPerfMode, () => "lite");
}

export function supportsReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Device d'entrée de gamme : on évite un WebGL lent plutôt que de l'amputer. */
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator.hardwareConcurrency ?? 8) <= 4;
}

export function supportsWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

/**
 * Le 3D est-il envisageable ? `lite` impose non : les deux scènes
 * permanentes (globe, réseau de particules) ne tournent jamais en
 * parallèle quand l'app est dégradée.
 */
export function canRender3D(): boolean {
  return (
    getPerfMode() === "full" &&
    !supportsReducedMotion() &&
    !isLowEndDevice() &&
    supportsWebGL()
  );
}

/** Repli quand le 3D est indisponible : dégradé mais jamais cassé. */
export function shouldUse3D(): boolean {
  return canRender3D();
}

let watchdogStarted = false;
let rafId = 0;

/**
 * Surveille le framerate réel et bascule en `lite` si la machine ne suit
 * pas. Démarré une seule fois (plusieurs appelants peuvent demander).
 */
export function startFpsWatchdog(): () => void {
  if (watchdogStarted || typeof window === "undefined") return () => undefined;
  watchdogStarted = true;

  let frames = 0;
  let windowStart = performance.now();
  let low = 0;
  let high = 0;

  const tick = (now: number) => {
    frames += 1;
    const elapsed = now - windowStart;

    if (elapsed >= WINDOW_MS) {
      const fps = (frames * 1000) / elapsed;
      frames = 0;
      windowStart = now;
      // Une fenêtre qui suit une longue pause (onglet en arrière-plan)
      // n'est pas représentative : on l'ignore.
      if (elapsed < WINDOW_MS * 2.5) {
        if (fps < FPS_LOW) {
          low += 1;
          high = 0;
          if (low >= LOW_WINDOWS_TO_DEGRADE && getPerfMode() === "full") {
            setPerfMode("lite");
          }
        } else if (fps > 52) {
          high += 1;
          low = 0;
          if (high >= HIGH_WINDOWS_TO_RECOVER && getPerfMode() === "lite") {
            setPerfMode("full");
          }
        } else {
          low = 0;
          high = 0;
        }
      }
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    watchdogStarted = false;
  };
}
