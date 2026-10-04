import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "auto" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

const STORAGE_KEY = "ln.theme";

function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "light" || stored === "dark") return stored;
  } catch { /* private mode */ }
  // Terre Sacrée s'ouvre en nuit (brun profond + or terre) : c'est le
  // thème par défaut demandé. "auto" reste disponible dans les réglages
  // pour qui préfère suivre l'heure (6h-18h = clair).
  return "dark";
}

export function resolveTheme(mode: ThemeMode, date = new Date()): EffectiveTheme {
  if (mode === "light" || mode === "dark") return mode;
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [theme, setTheme] = useState<EffectiveTheme>(() => resolveTheme(readMode()));

  const apply = useCallback((nextMode: ThemeMode, date = new Date()) => {
    const effective = resolveTheme(nextMode, date);
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(`theme-${effective}`);
    /* La classe `dark` est celle que lisent les composants shadcn (variantes
       `dark:`, tokens neutres du bloc `.dark`). On la synchronise pour que
       le thème clair éteigne réellement ces variantes — sans quoi l'app
       resterait à moitié sombre sur les surfaces shadcn. */
    root.classList.toggle("dark", effective === "dark");
    root.dataset.theme = effective;
    root.dataset.themeMode = nextMode;
    root.style.colorScheme = effective;
    setTheme(effective);
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    try { localStorage.setItem(STORAGE_KEY, nextMode); } catch { /* ignore */ }
    apply(nextMode);
  }, [apply]);

  useEffect(() => {
    apply(mode);
    if (mode !== "auto") return;
    const interval = window.setInterval(() => apply("auto"), 60_000);
    return () => window.clearInterval(interval);
  }, [apply, mode]);

  return { mode, theme, setMode };
}
