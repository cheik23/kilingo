import { v } from "convex/values";
import { query } from "./_generated/server";
import { CATALOG_TOTAL_KEY } from "./slang";

/**
 * CHIFFRES PUBLICS DE LA LANDING
 *
 * Requête publique et volontairement BONNE MARCHE : c'est la toute première
 * requête d'un visiteur qui ne s'est jamais connecté, sur la page la plus
 * consultée. Elle ne lit aucun compte nominatif.
 *
 * Sur le nombre d'apprenants : `db.query("users").collect()` ramènerait
 * TOUTES les lignes en mémoire et fait croître la latence avec la base.
 * On exploite donc le fait que la table ne contient qu'une ligne par
 * compte (jamais de contenu) et on ne conserve que le compte — le coût
 * mémoire réel est borné par le nombre d'inscrits, pas par le contenu du
 * produit. Si la base grossit fortement (centaines de milliers), il faudra
 * un compteur dénormalisé mis à jour à l'inscription : c'est le seul point
 * de ce module qui ne passe pas à l'échelle.
 */

/** Comptage des comptes, anonymes exclus du chiffre affiché. */
export const getLandingStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return {
      learners: users.length,
      verifiedLearners: users.filter((user) => !user.isAnonymous).length,
    };
  },
  returns: v.object({
    learners: v.number(),
    verifiedLearners: v.number(),
  }),
});

/**
 * Chiffres de marque de la landing (langues, expressions, avatars).
 *
 * `languages` est le nombre de langues APPRENABLES servies : 29, la totalité
 * de `LANGUAGES` (`languages.ts`), chacune désormais pourvue de contenu depuis
 * le Lot 4 (amharique et igbo).
 *
 * « 29 », PAS « 30 » : `fr` figure bien dans le seed (c'est le vocabulaire
 * cible de traduction) mais ce n'est pas une langue qu'on apprend — il n'est
 * ni dans `LANGUAGE_CODES`, ni sélectionnable, ni badgeable. Les valeurs
 * précédentes (19, puis 28) comptaient `fr` comme une langue de plus, ce qui
 * désalignait la copy de `languages.ts` d'exactement un et faisait échouer
 * l'assertion de `scripts/verify-upgrade.mjs` (« la copy annonce N,
 * languages.ts en compte 29 »). Le chiffre affiché doit être celui des
 * langues qu'on peut réellement suivre : 29.
 *
 * C'est donc `LANGUAGE_CODES.length`, PAS la taille de `CONTENT_LANGUAGES`
 * (`vite.config.ts`, 30 entrées `fr` inclus) ni celle de `ALL_LANGS`
 * (`slang.ts`). Le catalogue est COMPLET : `languageIsComingSoon()` ne
 * retourne plus vrai pour aucune langue, donc plus aucun badge « Bientôt ».
 * `avatars` reste une constante de catalogue.
 *
 * `expressions` est en revanche une MESURE. Elle était figée comme repli,
 * mais le seed complet (SLANG_SEED_2025 + Lots 1 à 4 + Vague 1 + lot allemand
 * + bloc inline) n'est jamais compté tant que `slang:seed` n'a pas tourné : la landing
 * sous-annoncerait le contenu réellement servi. On lit donc le compteur
 * dénormalisé qu'écrit `slang:recomputeAggregates` — une lecture d'index d'un
 * seul document, au lieu d'un scan par visiteur.
 */
export const getLandingNumbers = query({
  args: {},
  handler: async (ctx) => {
    const totalRow = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.eq("key", CATALOG_TOTAL_KEY))
      .unique();
    return {
      languages: 29,
      // Base pas encore seedée : on retombe sur la taille du seed, le temps
      // que `slang:seed` ait tourné au moins une fois. Valeur mesurée après le
      // lot italien 2 (4 235 après le lot allemand, + 100 : l'italien passe de
      // 200 à 300 fiches) ; la mesure réelle vient de
      // slangAggregates, écrit par slang:recomputeAggregates (le pilote de
      // semis l'appelle langue par langue après slang:seed).
      // ⚠️ Le compte PRODUIT peut différer d'une unité (une fiche `en`
      // importée hors seed existe en production) : c'est la mesure qui fait foi.
      expressions: totalRow?.total ?? 4335,
      avatars: 85,
    };
  },
  returns: v.object({
    languages: v.number(),
    expressions: v.number(),
    avatars: v.number(),
  }),
});
