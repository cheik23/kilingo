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
 * `languages` et `avatars` restent des CONSTANTES : ce sont des tailles de
 * catalogue que le produit ne fait pas varier au fil de l'eau.
 *
 * `expressions` est en revanche une MESURE. Elle était figée à 2363, mais le
 * seed `SLANG_SEED_2025` (55 entrées) n'était jamais importé par la mutation
 * `slang:seed` : la landing sous-annonçait de 54 expressions le contenu
 * réellement servi. On lit donc le compteur dénormalisé qu'écrit
 * `slang:recomputeAggregates` — une lecture d'index d'un seul document, au
 * lieu d'un scan par visiteur.
 */
export const getLandingNumbers = query({
  args: {},
  handler: async (ctx) => {
    const totalRow = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.eq("key", CATALOG_TOTAL_KEY))
      .unique();
    return {
      languages: 11,
      // Base pas encore seedée : on retombe sur le plancher marketing, le
      // temps que `slang:seed` ait tourné au moins une fois.
      expressions: totalRow?.total ?? 2363,
      avatars: 85,
    };
  },
  returns: v.object({
    languages: v.number(),
    expressions: v.number(),
    avatars: v.number(),
  }),
});
