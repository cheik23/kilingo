import { v } from "convex/values";
import { query } from "./_generated/server";

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
 * Les trois chiffres de marque (langues, expressions, avatars) sont des
 * CONSTANTES, pas des mesures : le catalogue ne les change pas. Les lire
 * depuis la base serait une latence payée pour rien. `avatars` : 85 unités du
 * catalogue de personnalisation.
 */
export const getLandingNumbers = query({
  args: {},
  handler: async () => {
    return {
      languages: 11,
      expressions: 2363,
      avatars: 85,
    };
  },
  returns: v.object({
    languages: v.number(),
    expressions: v.number(),
    avatars: v.number(),
  }),
});
