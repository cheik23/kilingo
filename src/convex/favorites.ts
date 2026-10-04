import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ═══════════════════════════════════════════════════════════════════════
   FAVORIS D'EXPRESSIONS

   Un favori range. Il ne programme jamais de révision : le deck SRS est
   piloté uniquement par `learning.addToSrs` (« Apprendre »). Cette
   séparation est volontaire — toucher le cœur dans Découverte ne doit
   pas faire apparaître la carte dans les révisions du jour.
   ═══════════════════════════════════════════════════════════════════════ */

const languageValidator = v.union(
  v.literal("en"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("ar"),
  v.literal("ru"),
);

/** Identifiants des expressions mises de côté, pour l'état des cœurs. */
export const favoriteSlangIds = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("slangFavorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => r.slangId as string);
  },
});

/** Bascule un favori. Retourne l'état obtenu pour le retour visuel. */
export const toggleSlangFavorite = mutation({
  args: { slangId: v.id("slangExpressions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const slang = await ctx.db.get(args.slangId);
    if (!slang) throw new Error("Expression not found");

    const existing = await ctx.db
      .query("slangFavorites")
      .withIndex("by_user_slang", (q) =>
        q.eq("userId", userId).eq("slangId", args.slangId),
      )
      .collect();

    if (existing.length > 0) {
      for (const row of existing) await ctx.db.delete(row._id);
      return { ok: true as const, favorite: false as const };
    }
    await ctx.db.insert("slangFavorites", {
      userId,
      slangId: args.slangId,
      addedAt: Date.now(),
    });
    return { ok: true as const, favorite: true as const };
  },
});

/** Favoris de l'utilisateur, du plus récent au plus ancien (Mon espace). */
export const mySlangFavorites = query({
  args: { language: v.optional(languageValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("slangFavorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const joined = await Promise.all(
      rows
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, 120)
        .map(async (row) => {
          const slang = await ctx.db.get(row.slangId);
          if (!slang) return null;
          if (args.language && slang.language !== args.language) return null;
          return { favoriteId: row._id, addedAt: row.addedAt, slang };
        }),
    );
    return joined.filter((x) => x !== null);
  },
});
