import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * R4 — zéro erreur technique dans l'interface.
 * Les détails réels (message Convex, Request ID, stack) restent en console ;
 * l'utilisateur ne voit que le repli fourni, toujours en français lisible.
 */
export function friendlyError(
  err: unknown,
  fallback = "Indisponible pour le moment.",
): string {
  if (err instanceof Error) {
    console.error("[friendlyError]", err.message);
  } else if (err !== undefined) {
    console.error("[friendlyError]", err);
  }
  return fallback;
}
