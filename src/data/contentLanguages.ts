import { LANGUAGE_CODES } from "@/convex/languages";

/* ═══════════════════════════════════════════════════════════════════════
   CETTE LANGUE EST-ELLE ENCORE VIDE ? — une seule réponse pour toute l'app.

   La liste des langues qui portent du contenu est INJECTÉE AU BUILD par
   `vite.config.ts`, calculée sur les seeds (`convex/slangSeed.ts`). Rien
   n'est recopié ici : semer des expressions pour une langue fait disparaître
   ses badges « Bientôt » au build suivant, sans toucher à l'interface.
   Le backend calcule la même chose à chaud (`convex/slang.ts`, ALL_LANGS)
   depuis le même tableau — les deux ne peuvent pas diverger.

   Pourquoi pas une requête Convex : les fonctions Convex se déploient à la
   main alors que le front part au push. Une requête aurait rendu les badges
   invisibles jusqu'à ce déploiement, en silence, et la page publique dépend
   d'un aller-retour réseau pour dire une vérité connue à la compilation.
   ═══════════════════════════════════════════════════════════════════════ */

declare const __CONTENT_LANGUAGES__: readonly string[];

/** `null` hors Vite (test, script Node) : l'information est alors INCONNUE. */
const injected: readonly string[] | null =
  typeof __CONTENT_LANGUAGES__ === "undefined" ? null : __CONTENT_LANGUAGES__;

const withContent = new Set<string>(injected ?? []);
const declared = new Set<string>(LANGUAGE_CODES);

/** Langues du catalogue, pour information (aucune décision n'en dépend). */
export const CONTENT_LANGUAGES: readonly string[] = injected ?? [];

/**
 * Vrai UNIQUEMENT pour une langue d'apprentissage déclarée qui n'a pas encore
 * d'expressions. Trois exclusions, chacune pour une raison :
 *
 *  · `fr` et les codes hors catalogue — présents sur la carte comme langues
 *    d'interface, mais jamais « en retard » : ils n'attendent pas de contenu.
 *    Sans ce filtre, le français aurait affiché un badge « Bientôt ».
 *  · information inconnue (hors Vite) — on ne badge RIEN plutôt que de tout
 *    badger : mieux vaut aucun badge qu'une promesse fausse.
 */
export function languageIsComingSoon(code: string): boolean {
  return injected !== null && declared.has(code) && !withContent.has(code);
}

/** Nombre de langues déclarées encore vides (utilisé par les vérifications). */
export function comingSoonCount(): number {
  return [...declared].filter((code) => languageIsComingSoon(code)).length;
}
