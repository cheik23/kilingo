import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   PALETTE DE GRAPHIQUES — un seul endroit, deux thèmes.

   Recharts écrit des couleurs CONCRÈTES dans le SVG : `var(--gold-primary)`
   dans un attribut `stroke` ne serait jamais résolu. On lit donc les tokens
   du thème actif, on les relit quand `data-theme` / la classe de <html>
   changent (c'est ce que fait `useThemeMode`), et on re-render.

   Les teintes d'accent (bleu, vert, orange, rouge) n'existent pas dans la
   palette du produit : elles sont définies ici, avec une variante SOMBRE
   pour le thème clair (sur crème, #10b981 et #f59e0b ne tiennent pas le
   contraste 4.5:1 — les versions foncées le tiennent).
   ═══════════════════════════════════════════════════════════════════════ */

export type ChartPalette = {
  /** Or de marque — suit `--gold-primary` (foncé en thème clair). */
  gold: string;
  /** Acquis / progression (vert). */
  green: string;
  /** Attention (orange). */
  orange: string;
  /** Régression / erreur (rouge). */
  red: string;
  /** Secondaire (bleu) — conversation, séries comparées. */
  blue: string;
  /** Tertiaire (violet) — catégories secondaires. */
  violet: string;
  /** Texte des axes et libellés de graphique. */
  axis: string;
  /** Lignes de grille (même teinte, opacité faible à l'usage). */
  grid: string;
  /** Fond des infobulles (surface élevée). */
  surface: string;
};

const DARK: ChartPalette = {
  gold: "#f5c542",
  green: "#10b981",
  orange: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  violet: "#a855f7",
  axis: "#9aa8ba",
  grid: "#9aa8ba",
  surface: "#141a2a",
};

/** Variante claire : accents assombris pour rester lisibles sur crème. */
const LIGHT: ChartPalette = {
  gold: "#8a5a33",
  green: "#047857",
  orange: "#b45309",
  red: "#b91c1c",
  blue: "#2563eb",
  violet: "#7c3aed",
  axis: "#6e5a47",
  grid: "#6e5a47",
  surface: "#f3e7d3",
};

export function isLightTheme(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement;
  return el.dataset.theme === "light" || el.classList.contains("theme-light");
}

export function readChartPalette(): ChartPalette {
  if (typeof document === "undefined") return DARK;
  const base = isLightTheme() ? LIGHT : DARK;
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    ...base,
    // L'or et le texte d'axe restent pilotés par les tokens du thème.
    gold: read("--gold-primary", base.gold),
    axis: read("--ink-3", base.axis),
    grid: read("--ink-3", base.grid),
    surface: read("--noir-2", base.surface),
  };
}

/** Palette des graphiques du thème actif, re-render sur changement de thème. */
export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(readChartPalette);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const update = () =>
      setPalette((prev) => {
        const next = readChartPalette();
        const same = (Object.keys(next) as Array<keyof ChartPalette>).every(
          (key) => next[key] === prev[key],
        );
        return same ? prev : next;
      });
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    update();
    return () => observer.disconnect();
  }, []);

  return palette;
}
