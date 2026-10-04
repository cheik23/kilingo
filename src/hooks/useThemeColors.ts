import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   COULEURS 3D PAR THÈME

   Les scènes three.js (Jabari, coffre, globe, particules, trophée,
   level-up) ne peuvent pas lire une variable CSS : elles ont besoin de
   valeurs concrètes. Plutôt que de dupliquer une palette dans le code,
   on lit les tokens `--fx-3d-*` définis par le thème actif.

   Le thème change via `data-theme` / la classe `theme-*` sur <html> :
   un MutationObserver relit donc les tokens et provoque un re-render des
   scènes, qui recréent leurs matériaux.

   Source de vérité unique : `src/index.css`. Ce fichier ne fait que lire.
   ═══════════════════════════════════════════════════════════════════════ */

export type ThemeColors = {
  /** Or principal (corps de Jabari, métal du coffre, globe). */
  gold: string;
  /** Or profond (crinière, ombres métalliques). */
  goldDeep: string;
  /** Accent secondaire (vert olive : particules, confettis, rim-light). */
  accent: string;
  /** Vêtement de Jabari (hoodie) — sombre en nuit, brun moyen en jour. */
  suit: string;
  /** Fond de l'environnement de réflexion (dôme du coffre). */
  env: string;
};

/** Repli = palette Terre Sacrée (nuit), si les tokens sont indisponibles. */
const FALLBACK: ThemeColors = {    gold: "#f5c542",
    goldDeep: "#d4af37",
    accent: "#e91e63",
    suit: "#232946",
    env: "#1a1f3a",
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const raw = styles.getPropertyValue(name).trim();
  return raw.length > 0 ? raw : fallback;
}

function readColors(): ThemeColors {
  if (typeof document === "undefined") return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  return {
    gold: readVar(styles, "--fx-3d-gold", FALLBACK.gold),
    goldDeep: readVar(styles, "--fx-3d-gold-deep", FALLBACK.goldDeep),
    accent: readVar(styles, "--fx-3d-accent", FALLBACK.accent),
    suit: readVar(styles, "--fx-3d-suit", FALLBACK.suit),
    env: readVar(styles, "--fx-3d-env", FALLBACK.env),
  };
}

/**
 * Couleurs des scènes 3D, qui suivent le thème actif.
 *
 * Re-render garanti quand `data-theme` ou la classe de <html> change
 * (c'est ce que fait `useThemeMode`). Aucune animation n'est pilotée ici :
 * uniquement des couleurs.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(readColors);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const update = () => setColors((prev) => {
      const next = readColors();
      // Évite un re-render (et une recréation de matériaux) pour rien.
      return next.gold === prev.gold &&
        next.goldDeep === prev.goldDeep &&
        next.accent === prev.accent &&
        next.suit === prev.suit &&
        next.env === prev.env
        ? prev
        : next;
    });
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    // Le thème a pu changer entre le premier rendu et l'effet.
    update();
    return () => observer.disconnect();
  }, []);

  return colors;
}

export default useThemeColors;
