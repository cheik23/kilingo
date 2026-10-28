import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ACHIEVEMENT_DEFINITIONS } from "./achievementCatalog";
import { recordAchievementMetric } from "./achievementProgress";

export { getMyAchievements } from "./achievementEngine";

type CheckAchievementsResult = {
  completed: Array<{ achievementId: string; title: string; xp: number; gems: number; icon: string }>;
  reminders: Array<{ achievementId: string; title: string; remaining: number; icon: string }>;
};

/**
 * Seed idempotent : les définitions sont patchées, jamais dupliquées.
 *
 * INTERNE DEPUIS P0.2 : ce seed écrit le catalogue des 150 succès et n'a
 * aucun appelant dans l'application. Public, il permettait à un client
 * anonyme de réécrire le catalogue des récompenses. L'exécution de
 * maintenance passe par le CLI Convex authentifié :
 *   npx convex run internal.achievements.seed
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      const existing = await ctx.db
        .query("achievements")
        .withIndex("by_slug", (q) => q.eq("achievementId", definition.achievementId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, definition);
        updated += 1;
      } else {
        await ctx.db.insert("achievements", definition);
        inserted += 1;
      }
    }
    return { inserted, updated, total: ACHIEVEMENT_DEFINITIONS.length };
  },
  returns: v.object({ inserted: v.number(), updated: v.number(), total: v.number() }),
});

/** Compteurs d'usage client, limités aux événements de la collection. */
export const recordActivity = mutation({
  args: {
    metric: v.union(
      v.literal("atlas:uses"),
      v.literal("cross:uses"),
      v.literal("shadow:analyses"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    await recordAchievementMetric(ctx, userId, args.metric);
    return { ok: true };
  },
  returns: v.object({ ok: v.boolean() }),
});

/** Action appelée après une activité authentifiée. */
export const checkAchievements = action({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CheckAchievementsResult> => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) throw new Error("Not signed in");
    if (args.userId && args.userId !== authUserId) throw new Error("Not authorized");
    return ctx.runMutation(internal.achievementEngine.run, { userId: authUserId });
  },
  returns: v.object({
    completed: v.array(v.object({ achievementId: v.string(), title: v.string(), xp: v.number(), gems: v.number(), icon: v.string() })),
    reminders: v.array(v.object({ achievementId: v.string(), title: v.string(), remaining: v.number(), icon: v.string() })),
  }),
});
