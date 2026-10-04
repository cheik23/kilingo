import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

const GOALS = [5, 10, 20, 30] as const;

/** Set the daily practice goal (minutes). Defaults to 10 when never set. */
export const setDailyGoal = mutation({
  args: { minutes: v.union(
    v.literal(5),
    v.literal(10),
    v.literal(20),
    v.literal(30),
  ) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (!GOALS.includes(args.minutes)) {
      throw new Error("Objectif invalide");
    }
    await ctx.db.patch(userId, { dailyGoalMinutes: args.minutes });
    return { ok: true as const, dailyGoalMinutes: args.minutes };
  },
  returns: v.object({
    ok: v.literal(true),
    dailyGoalMinutes: v.number(),
  }),
});
