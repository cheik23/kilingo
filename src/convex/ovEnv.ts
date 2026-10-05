/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — ACCÈS AUX VARIABLES D'ENVIRONNEMENT

   Module neutre, importé à la fois par le registre de connecteurs
   (ovSources) et par les connecteurs eux-mêmes : il évite le cycle
   d'imports tout en gardant une seule implémentation.

   Aucune clé n'est jamais renvoyée au client : `hasEnv` n'expose que la
   présence, `envValue` reste côté serveur.
   ═══════════════════════════════════════════════════════════════════════ */

/** La variable existe-t-elle (et n'est-elle pas vide/blanche) ? */
export function hasEnv(name: string): boolean {
  try {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
  } catch {
    return false;
  }
}

/** Valeur d'une variable, ou `undefined`. Jamais journalisée. */
export function envValue(name: string): string | undefined {
  try {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/** En-tête User-Agent commun (exigé par Wikimedia, MusicBrainz, Openverse). */
export function contactHeaders(): Record<string, string> {
  const contact = envValue("OPENVERSE_CONTACT") ?? "contact@kilingo.app";
  return {
    "User-Agent": `KILINGO/1.0 (${contact})`,
    Accept: "application/json",
  };
}

/**
 * `true` si toutes les variables requises sont présentes.
 * Un connecteur sans exigence est toujours considéré comme configuré.
 */
export function envReady(requiresEnv: string[]): boolean {
  return requiresEnv.every((name) => hasEnv(name));
}
