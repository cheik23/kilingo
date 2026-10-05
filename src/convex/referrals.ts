import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { addGemsInternal } from "./gamification";
import { insertNotification } from "./notifications";

const REFERRAL_REWARD = 500;

/** Garde-fou anti-fraude : un compte ne peut pas faire grossir indéfiniment
 *  son code d'invitation au-delà de ce plafond. */
const MAX_REFERRALS = 50;

type ReferralRow = {
  _id: Id<"referrals">;
  referrerId: Id<"users">;
  referredId: Id<"users">;
  rewarded: boolean;
};

/** Crédit idempotent des deux comptes dans la transaction appelante.
 *  `rewarded` est le verrou anti-double : une seule fois par filleul. */
async function rewardReferralInternal(ctx: MutationCtx, row: ReferralRow) {
  if (row.rewarded) return { gems: 0, referrerGems: 0, alreadyRewarded: true };
  const now = Date.now();
  const gems = await addGemsInternal(ctx, row.referredId, REFERRAL_REWARD, "referral_reward");
  const referrerGems = await addGemsInternal(ctx, row.referrerId, REFERRAL_REWARD, "referral_reward");
  await insertNotification(ctx, {
    userId: row.referredId,
    kind: "achievement",
    title: `+${REFERRAL_REWARD} gems`,
    body: "Bienvenue sur Kilingo — ta récompense de parrainage est arrivée.",
  });
  await insertNotification(ctx, {
    userId: row.referrerId,
    kind: "achievement",
    title: `+${REFERRAL_REWARD} gems`,
    body: "Un filleul a terminé son premier quiz. Bien joué !",
  });
  // Le verrou est posé APRÈS les crédits : si l'écriture échoue, la
  // transaction entière est annulée et rien n'a été distribué.
  await ctx.db.patch(row._id, { rewarded: true, rewardedAt: now });
  return { gems, referrerGems, alreadyRewarded: false };
}

/**
 * Récompense LAZY : appelée depuis `gamification.recordQuiz`, donc le
 * filleul doit réellement finir un quiz avant que les deux comptes soient
 * crédités. Idempotente — le 2e quiz ne redistribue rien.
 */
export async function settleReferralOnFirstQuiz(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ rewarded: boolean; gems: number; referrerGems: number }> {
  const row = await ctx.db
    .query("referrals")
    .withIndex("by_referred", (q) => q.eq("referredId", userId))
    .unique();
  if (!row || row.rewarded) return { rewarded: false, gems: 0, referrerGems: 0 };
  const result = await rewardReferralInternal(ctx, row);
  return { rewarded: !result.alreadyRewarded, gems: result.gems, referrerGems: result.referrerGems };
}

/** Associe le nouvel utilisateur au code d'invitation, une seule fois. */
export const trackReferral = mutation({
  args: { refCode: v.string() },
  handler: async (ctx, args) => {
    const referredId = await getAuthUserId(ctx);
    if (referredId === null) throw new Error("Not signed in");
    const ref = args.refCode.trim();
    if (!ref) return { ok: true, alreadyTracked: false };
    const referrer = await ctx.db.get(ref as Id<"users">);
    if (!referrer) return { ok: false, reason: "invalid_referral" as const };
    if (referrer._id === referredId) return { ok: false, reason: "self_referral" as const };
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", referredId))
      .unique();
    if (existing) return { ok: true, alreadyTracked: true };
    // Plafond : le referrer ne peut pas accumulating plus de MAX_REFERRALS
    // parrainages. Le lien reste valide, il refuse simplement d'accueillir
    // un nouveau filleul (protection contre les inscriptions automatisées).
    const refCount = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", referrer._id))
      .collect();
    if (refCount.length >= MAX_REFERRALS) {
      return { ok: false, reason: "referrer_full" as const };
    }
    const referredUser = await ctx.db.get(referredId);
    await ctx.db.insert("referrals", {
      referrerId: referrer._id,
      referredId,
      createdAt: Date.now(),
      rewarded: false,
    });
    // PAS de crédit ici : la récompense est paresseuse, déclenchée par le
    // premier quiz du filleul (`settleReferralOnFirstQuiz`). On prévient
    // quand même le referrer que l'invitation a été acceptée.
    if (referredUser?.name) {
      await insertNotification(ctx, {
        userId: referrer._id,
        kind: "achievement",
        title: "Nouveau filleul",
        body: `${referredUser.name} a rejoint Kilingo grâce à ton lien.`,
      });
    }
    return { ok: true, alreadyTracked: false };
  },
  returns: v.object({
    ok: v.boolean(),
    alreadyTracked: v.optional(v.boolean()),
    reason: v.optional(v.union(v.literal("invalid_referral"), v.literal("self_referral"), v.literal("referrer_full"))),
  }),
});

/** Récompense explicite, conservée pour les anciens clients et un retry manuel. */
export const rewardReferral = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", userId))
      .unique();
    if (!row) return { ok: false, reason: "no_referral" as const, gems: 0 };
    if (row.rewarded) {
      const stats = await ctx.db.query("userStats").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
      return { ok: true, alreadyRewarded: true, gems: stats?.gems ?? 0 };
    }
    const result = await rewardReferralInternal(ctx, row);
    return { ok: true, alreadyRewarded: result.alreadyRewarded, gems: result.gems, referrerGems: result.referrerGems };
  },
  returns: v.object({
    ok: v.boolean(),
    alreadyRewarded: v.optional(v.boolean()),
    reason: v.optional(v.literal("no_referral")),
    gems: v.optional(v.number()),
    referrerGems: v.optional(v.number()),
  }),
});

export const getMyReferrals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { inviteCode: "", friends: [], totalFriends: 0, rewardedFriends: 0, gemsEarned: 0 };
    const rows = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
      .order("desc")
      .collect();
    const friends = await Promise.all(rows.map(async (row) => {
      const user = await ctx.db.get(row.referredId);
      return {
        id: row.referredId,
        name: user?.name ?? "Kilingo",
        email: user?.email ?? "",
        joinedAt: row.createdAt,
        rewarded: row.rewarded,
      };
    }));
    return {
      inviteCode: userId,
      friends,
      totalFriends: friends.length,
      rewardedFriends: friends.filter((friend) => friend.rewarded).length,
      gemsEarned: friends.filter((friend) => friend.rewarded).length * REFERRAL_REWARD,
    };
  },
  returns: v.object({
    inviteCode: v.string(),
    friends: v.array(v.object({ id: v.id("users"), name: v.string(), email: v.string(), joinedAt: v.number(), rewarded: v.boolean() })),
    totalFriends: v.number(),
    rewardedFriends: v.number(),
    gemsEarned: v.number(),
  }),
});
