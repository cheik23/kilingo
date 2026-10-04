import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** Compteur d'activité agrégé, écrit uniquement par les mutations métier. */
export async function recordAchievementMetric(
  ctx: MutationCtx,
  userId: Id<"users">,
  metric: string,
  amount = 1,
): Promise<void> {
  const delta = Math.max(0, Math.round(amount));
  if (delta === 0) return;
  const existing = await ctx.db
    .query("achievementCounters")
    .withIndex("by_user_metric", (q) => q.eq("userId", userId).eq("metric", metric))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { count: existing.count + delta, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("achievementCounters", {
      userId,
      metric,
      count: delta,
      updatedAt: Date.now(),
    });
  }
}
