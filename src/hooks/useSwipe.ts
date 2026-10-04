import { useCallback, useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   useSwipe — gestuelle de swipe card (pointer events, zéro lib).

   - pointerdown/move/up : dx suivi en temps réel ;
   - seuil 60 px : au-delà, le relâchement confirme le swipe ;
   - retour élastique si sous le seuil ;
   - navigator.vibrate(10) au swipe confirmé (si disponible).
   ═══════════════════════════════════════════════════════════════════ */

export const SWIPE_THRESHOLD = 60;
const EXIT_MS = 250;

export type SwipeDirection = "left" | "right";

type SwipeState = {
  /** Déplacement horizontal courant en px (positif = droite). */
  dx: number;
  /** Vrai entre pointerdown et pointerup. */
  dragging: boolean;
  /** Direction de sortie animée (250 ms), sinon null. */
  exiting: SwipeDirection | null;
};

export function useSwipe(onConfirm: (dir: SwipeDirection) => void) {
  const [state, setState] = useState<SwipeState>({
    dx: 0,
    dragging: false,
    exiting: null,
  });
  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  const cleanup = useCallback(() => {
    pointerId.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (state.exiting) return;
      // Ignore les clics sur les boutons internes (TTS, reveal…).
      if ((e.target as HTMLElement).closest("button")) return;
      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      // Capture du pointeur : les move/up restent liés à la carte même
      // si le curseur/doigt sort de l'élément pendant le drag.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* non supporté — le drag fonctionne quand même à l'intérieur */
      }
      setState({ dx: 0, dragging: true, exiting: null });
    },
    [state.exiting],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      const dx = e.clientX - startX.current;
      setState((s) => (s.dragging ? { ...s, dx } : s));
    },
    [],
  );

  const finish = useCallback(
    (dir: SwipeDirection | null) => {
      setState({ dx: 0, dragging: false, exiting: dir });
      if (dir) {
        // Retour haptique léger au swipe confirmé.
        try {
          navigator.vibrate?.(10);
        } catch {
          /* non supporté */
        }
        if (exitTimer.current) window.clearTimeout(exitTimer.current);
        exitTimer.current = window.setTimeout(() => {
          confirmRef.current(dir);
          setState({ dx: 0, dragging: false, exiting: null });
        }, EXIT_MS);
      }
      cleanup();
    },
    [cleanup],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      const dx = e.clientX - startX.current;
      const dir: SwipeDirection | null =
        Math.abs(dx) >= SWIPE_THRESHOLD ? (dx > 0 ? "right" : "left") : null;
      finish(dir);
    },
    [finish],
  );

  const onPointerCancel = useCallback(() => {
    finish(null);
  }, [finish]);

  /** Déclenche programmatiquement un swipe confirmé (boutons, clavier). */
  const swipe = useCallback(
    (dir: SwipeDirection) => {
      if (state.exiting || state.dragging) return;
      finish(dir);
    },
    [finish, state.exiting, state.dragging],
  );

  useEffect(
    () => () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  return {
    dx: state.dx,
    dragging: state.dragging,
    exiting: state.exiting,
    swipe,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
