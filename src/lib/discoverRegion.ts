import { COUNTRIES, type LanguageCode } from "../convex/languages";

/* ═══════════════════════════════════════════════════════════════════════
   RÉGION PAR DÉFAUT DE LA DÉCOUVERTE — Espagne pour l'espagnol.

   L'audit de transition a reproduit le problème : avec la langue
   espagnol sélectionnée et AUCUNE préférence régionale explicite, le
   deck reste sur « tous pays » — régionalement flou, alors que tout
   l'onboarding raconte « apprendre l'espagnol ». Correctif demandé :
   l'Espagne (code canonique « es » de `COUNTRIES.es`) est le défaut
   quand rien n'a été choisi ; ni le Chili, ni le Venezuela, ni
   « tous pays » ne doivent jamais être écrasés une fois choisis.

   Règles exactes (verrouillées par tests/discoverRegion.test.ts) :
   · lang « es » sans préférence ⇒ « es » ;
   · toute autre langue ⇒ « all » AUCUN héritage du défaut espagnol ;
   · préférence explicite persistée ("all" ou code) : conservée si elle
     reste proposée pour cette langue, sinon repli « all » (une région
     n'a de sens que dans sa langue — comportement inchangé des chips) ;
   · la préférence vit dans localStorage pour survivre à la navigation
     et au rechargement, comme `discover_shown`/`discover_swiped`.

   Import RELATIF (`../convex/languages`) : ce fichier doit rester
   exécutable par bun:test sans bundler d'alias — même choix que le
   test des registres qui importe `../src/convex/languages`.
   ═══════════════════════════════════════════════════════════════════════ */

/** Clé localStorage de la préférence régionale explicite de Discover. */
export const DISCOVER_REGION_PREF = "kilingo.discover.region";

/**
 * Préférence explicite persistée : "all" (choix « tous pays »), un code
 * de `COUNTRIES[*]`, ou null (jamais choisi — défaut régional pris).
 * Toute valeur parasite est traitée comme null par `effectiveRegion`.
 */
export function readDiscoverRegionPref(): string | null {
  try {
    const raw = localStorage.getItem(DISCOVER_REGION_PREF);
    if (raw === null) return null;
    const v = raw.trim();
    return v === "" ? null : v;
  } catch {
    return null;
  }
}

/** Persiste (ou efface avec null) la préférence ; silencieux sans stockage. */
export function writeDiscoverRegionPref(v: string | null): void {
  try {
    if (v === null) localStorage.removeItem(DISCOVER_REGION_PREF);
    else localStorage.setItem(DISCOVER_REGION_PREF, v);
  } catch {
    // localStorage indisponible — le défaut régional prendra le relais.
  }
}

/** Défaut régional canonique d'une langue : Espagne pour « es », rien ailleurs. */
export function defaultRegionFor(lang: LanguageCode): string | "all" {
  return lang === "es" ? "es" : "all";
}

/**
 * Région effective pour (langue, préférence explicite) :
 * · préférence "all" ⇒ "all" exactement tel que demandé ;
 * · préférence code encore proposée pour cette langue ⇒ gardée
 *   (le Chili choisi explicitement n'est jamais remplacé par l'Espagne) ;
 * · préférence invalide ou inaccessible depuis cette langue ⇒ « all »
 *   (repli cohérent avec la règle actuelle : une région n'a de sens
 *   que dans sa langue) ;
 * · pas de préférence ⇒ défaut régional de la langue ("es" pour
 *   l'espagnol, "all" pour toutes les autres).
 */
export function effectiveRegion(
  lang: LanguageCode | "all",
  pref: string | null,
): string | "all" {
  if (pref !== null) {
    if (pref === "all") return "all";
    const offered =
      lang !== "all" ? (COUNTRIES[lang] ?? []).some((c) => c.code === pref) : false;
    return offered ? pref : "all";
  }
  return lang === "all" ? "all" : defaultRegionFor(lang);
}
