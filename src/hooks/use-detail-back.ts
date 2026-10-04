import { useCallback, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   RETOUR ARRIÈRE DES FICHES

   Une fiche ouverte est un état de navigation à part entière :
     · `pushState` à l'ouverture → le bouton précédent du navigateur la
       referme au lieu de quitter la vue ;
     · `popstate` au retour → la fiche se referme, la position de scroll
       est restaurée (les filtres vivent dans les composants parents) ;
     · `Escape` referme la fiche ;
     · swipe à droite depuis le bord gauche referme la fiche sur mobile.

   Un compteur de profondeur (`moovyDepth`) est écrit dans l'état
   d'historique : quand une fiche en ouvre une autre (épisode → fiche
   d'épisode), chaque instance ne réagit qu'à SA propre entrée — un seul
   `back` referme exactement une fiche.
   ═══════════════════════════════════════════════════════════════════════ */

function restoreScroll(y: number) {
  requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }));
}

function currentDepth(): number {
  const value = (window.history.state as { moovyDepth?: number } | null)?.moovyDepth;
  return typeof value === "number" ? value : 0;
}

/**
 * @param pushHistory `true` (défaut) : l'ouverture pousse une entrée
 *   d'historique (panneau latéral refermé par le bouton précédent).
 *   `false` : la page est déjà une ROUTE (navigateur gère le bouton
 *   précédent) — seuls Escape, le swipe et le bouton « Retour » ferment.
 */
export function useDetailBack(onClose: () => void, enabled = true, pushHistory = true) {
  // Références stables : les effets ne se réarment pas à chaque rendu parent.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  /** Profondeur de l'entrée poussée par CETTE instance (null = aucune). */
  const pushedDepthRef = useRef<number | null>(null);
  const scrollRef = useRef(0);

  // pushState à l'ouverture + popstate au retour (mode panneau uniquement ;
  // une fiche-route est déjà une entrée d'historique, on n'en pousse pas une
  // seconde).
  useEffect(() => {
    if (!enabled || !pushHistory) return;
    const depth = currentDepth() + 1;
    scrollRef.current = window.scrollY;
    window.history.pushState({ moovyDetail: true, moovyDepth: depth }, "");
    pushedDepthRef.current = depth;

    const onPop = (event: PopStateEvent) => {
      const state = event.state as { moovyDepth?: number } | null;
      // Seule l'instance qui a poussé la dernière entrée réagit.
      if ((state?.moovyDepth ?? 0) !== depth - 1) return;
      pushedDepthRef.current = null;
      restoreScroll(scrollRef.current);
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Démontage sans popstate (navigation interne, changement de vue) :
      // on retire l'entrée poussée pour ne pas polluer l'historique — sauf
      // si une navigation a déjà remplacé l'état courant.
      if (
        pushedDepthRef.current !== null &&
        currentDepth() === pushedDepthRef.current
      ) {
        window.history.back();
      }
      pushedDepthRef.current = null;
    };
    // L'effet suit `enabled` : il se réarme si la fiche change de contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Escape referme la fiche.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeArmed = useRef(false);

  // Swipe droite → retour (mobile).
  useEffect(() => {
    if (!enabled) return;
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      // Zone de départ : bord gauche de l'écran, comme les gestes natifs.
      swipeArmed.current = touch.clientX < 48;
    };
    const onEnd = (e: TouchEvent) => {
      if (!swipeArmed.current) return;
      swipeArmed.current = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartX.current;
      const dy = Math.abs(touch.clientY - touchStartY.current);
      // Geste horizontal franc vers la droite (> 96 px, pente < 30°).
      if (dx > 96 && dy < dx * 0.55) {
        closeRef.current();
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [enabled]);

  /** Fermeture via l'UI : consomme l'entrée d'historique si elle existe. */
  const close = useCallback(() => {
    if (pushedDepthRef.current !== null) {
      window.history.back(); // déclenche popstate → onClose + scroll restauré
    } else {
      closeRef.current();
    }
  }, []);

  return { close };
}

/**
 * Retour arrière d'une PAGE (fiche routée) : Escape + swipe droite,
 * le bouton précédent du navigateur étant déjà géré par React Router.
 * Le bouton « ← Retour » de la fiche utilise `back`.
 */
export function usePageBack(onBack: () => void, enabled = true) {
  return useDetailBack(onBack, enabled, false);
}
