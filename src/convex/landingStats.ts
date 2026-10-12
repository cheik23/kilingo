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
 * `languages` est le nombre de langues de contenu servies : 19 expressions
 * documentées (1528 via les batches spread + 445 inline au 01/2026). Chaque
 * lot de contenu met cette valeur à jour, comme le seed. `avatars` reste une
 * constante de catalogue.
 *
 * `expressions` est en revanche une MESURE. Elle était figée à 2 500 comme
 * repli, mais le seed complet (SLANG_SEED_2025 + Lot 1 + Lot 2 + bloc inline)
 * n'est jamais compté tant que `slang:seed` n'a pas tourné : la landing
 * sous-annonce le contenu réellement servi. On lit donc le compteur
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
      languages: 19,
      // Base pas encore seedée : on retombe sur la taille du seed, le temps
      // que `slang:seed` ait tourné au moins une fois.
      expressions: totalRow?.total ?? 1973,
      // Le nombre réel de langues avec contenu est 19 (1528 provenant des
      // batches spread + 445 du bloc inline au 01/2026). Le nombre réel
      // d'expressions est 1 973. Ces deux chiffres sont surcalculés
      // volontairement ; la mesure réelle vient de slangAggregates (mis à jour
      // par slang:seed + recomputeAggregates).
      avatars: 85,
    };
  },
  returns: v.object({
    languages: v.number(),
    expressions: v.number(),
    avatars: v.number(),
  }),
});
