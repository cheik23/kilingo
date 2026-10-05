import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const LEAGUES = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
] as const;
export type League = (typeof LEAGUES)[number];

const leagueValidator = v.union(
  v.literal("bronze"),
  v.literal("silver"),
  v.literal("gold"),
  v.literal("platinum"),
  v.literal("diamond"),
);

/** Seuil minimal XP/semaine pour entrer dans chaque ligue. */
export const LEAGUE_MIN_XP: Record<League, number> = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 3500,
  diamond: 7000,
};

/** ISO week UTC. Les semaines commencent le lundi, comme les seuils de spec. */
export function isoWeekKey(at: number = Date.now()): string {
  const date = new Date(at);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function previousWeekKey(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return weekKey;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = jan4.getTime() + (jan4.getUTCDay() || 7) - 1;
  return isoWeekKey(monday + (week - 2) * 7 * 86_400_000);
}

function shiftLeague(league: League, offset: number): League {
  return LEAGUES[Math.max(0, Math.min(LEAGUES.length - 1, LEAGUES.indexOf(league) + offset))];
}

/**
 * Écriture unique du cumul hebdomadaire. Elle est appelée par applyAward,
 * donc toutes les surfaces qui créditent l'XP sont couvertes sans second writer.
 */
export async function recordWeeklyXp(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  at: number = Date.now(),
): Promise<void> {
  const earned = Math.max(0, Math.round(amount));
  if (earned === 0) return;
  const weekKey = isoWeekKey(at);
  const existing = await ctx.db
    .query("weeklyXp")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekKey", weekKey))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { xp: existing.xp + earned, updatedAt: at });
  } else {
    await ctx.db.insert("weeklyXp", { userId, weekKey, xp: earned, updatedAt: at });
  }
}

type Participant = {
  userId: Id<"users">;
  xp: number;
  league: League;
};

/**
 * Sunday 23:59 UTC finalizes the ISO week that is ending. The resulting league
 * becomes the user's starting league for the next week. Re-running is a no-op.
 */
export const finalizeWeek = internalMutation({
  args: { weekKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const weekKey = args.weekKey ?? isoWeekKey();
    const already = await ctx.db
      .query("weeklyLeaderboard")
      .withIndex("by_week_rank", (q) => q.eq("weekKey", weekKey))
      .first();
    if (already) {
      return { weekKey, processed: already.rank, alreadyProcessed: true };
    }

    const [xpRows, allStats, previousRows] = await Promise.all([
      ctx.db
        .query("weeklyXp")
        .withIndex("by_week", (q) => q.eq("weekKey", weekKey))
        .collect(),
      ctx.db.query("userStats").take(4096),
      ctx.db
        .query("weeklyLeaderboard")
        .withIndex("by_week_rank", (q) => q.eq("weekKey", previousWeekKey(weekKey)))
        .collect(),
    ]);
    const xpByUser = new Map(xpRows.map((row) => [row.userId, row.xp]));
    const participants: Participant[] = allStats.map((stats) => ({
      userId: stats.userId,
      xp: xpByUser.get(stats.userId) ?? 0,
      league: stats.currentLeague ?? "bronze",
    }));
    const known = new Set(participants.map((row) => row.userId));
    for (const row of xpRows) {
      if (!known.has(row.userId)) {
        participants.push({ userId: row.userId, xp: row.xp, league: "bronze" });
      }
    }
    participants.sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId));
    if (participants.length === 0) {
      return { weekKey, processed: 0, alreadyProcessed: false };
    }

    const previousRanks = new Map(previousRows.map((row) => [row.userId, row.rank]));
    const statsByUser = new Map(allStats.map((stats) => [stats.userId, stats]));
    const grouped = new Map<League, Participant[]>();
    for (const league of LEAGUES) grouped.set(league, []);
    participants.forEach((participant) => grouped.get(participant.league)?.push(participant));

    const resultingByUser = new Map<Id<"users">, League>();
    for (const league of LEAGUES) {
      const cohort = grouped.get(league) ?? [];
      const promotionCount = cohort.length === 1 ? 1 : Math.ceil(cohort.length * 0.2);
      const relegationCount = cohort.length <= 1 ? 0 : Math.ceil(cohort.length * 0.2);
      cohort.forEach((participant, index) => {
        let nextLeague = league;
        const promoted = index < promotionCount;
        const relegated = index >= cohort.length - relegationCount;
        if (promoted) {
          const above = shiftLeague(league, 1);
          if (LEAGUE_MIN_XP[above] <= participant.xp) nextLeague = above;
        }
        if (relegated && participant.xp < LEAGUE_MIN_XP[league]) {
          nextLeague = shiftLeague(league, -1);
        }
        resultingByUser.set(participant.userId, nextLeague);
      });
    }

    const processedAt = Date.now();
    for (let index = 0; index < participants.length; index += 1) {
      const participant = participants[index];
      const resultingLeague = resultingByUser.get(participant.userId) ?? participant.league;
      const previousRank = previousRanks.get(participant.userId);
      await ctx.db.insert("weeklyLeaderboard", {
        weekKey,
        userId: participant.userId,
        xp: participant.xp,
        rank: index + 1,
        league: participant.league,
        previousRank,
        rankDelta: previousRank == null ? undefined : previousRank - (index + 1),
        resultingLeague,
        processedAt,
      });
      const stats = statsByUser.get(participant.userId);
      if (stats) {
        await ctx.db.patch(stats._id, {
          currentLeague: resultingLeague,
          lastLeagueWeek: weekKey,
          ...(resultingLeague !== participant.league && LEAGUES.indexOf(resultingLeague) > LEAGUES.indexOf(participant.league)
            ? { pendingPromotion: { from: participant.league, to: resultingLeague, weekKey } }
            : {}),
        });
      }
    }
    return { weekKey, processed: participants.length, alreadyProcessed: false };
  },
  returns: v.object({
    weekKey: v.string(),
    processed: v.number(),
    alreadyProcessed: v.boolean(),
  }),
});

const entryValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  image: v.union(v.string(), v.null()),
  rank: v.number(),
  xp: v.number(),
  league: leagueValidator,
  previousRank: v.union(v.number(), v.null()),
  rankDelta: v.number(),
  isYou: v.boolean(),
  /** Avatar 3D créé dans le studio Ready Player Me (portrait de tête). */
  rpmAvatarUrl: v.union(v.string(), v.null()),
});

/** Classement live de la semaine courante; repli sur le dernier snapshot finalisé. */
export const getCurrentLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    const currentWeekKey = isoWeekKey();
    const liveRows = await ctx.db
      .query("weeklyXp")
      .withIndex("by_week", (q) => q.eq("weekKey", currentWeekKey))
      .collect();
    const previousWeek = previousWeekKey(currentWeekKey);
    const previousRows = await ctx.db
      .query("weeklyLeaderboard")
      .withIndex("by_week_rank", (q) => q.eq("weekKey", previousWeek))
      .collect();
    const previousRanks = new Map(previousRows.map((row) => [row.userId, row.rank]));

    let weekKey = currentWeekKey;
    let ranked: Array<{
      userId: Id<"users">;
      xp: number;
      rank: number;
      league: League;
      previousRank: number | null;
    }>;

    if (liveRows.length > 0) {
      ranked = liveRows
        .map((row) => ({ userId: row.userId, xp: row.xp }))
        .sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId))
        .map((row, index) => ({
          ...row,
          rank: index + 1,
          league: "bronze" as League,
          previousRank: null,
        }));
    } else {
      const latest = await ctx.db.query("weeklyLeaderboard").order("desc").first();
      const rows = latest
        ? await ctx.db
            .query("weeklyLeaderboard")
            .withIndex("by_week_rank", (q) => q.eq("weekKey", latest.weekKey))
            .collect()
        : [];
      weekKey = latest?.weekKey ?? currentWeekKey;
      ranked = rows.map((row) => ({
        userId: row.userId,
        xp: row.xp,
        rank: row.rank,
        league: row.league,
        previousRank: row.previousRank ?? null,
      }));
    }

    const userDocs = await Promise.all(ranked.map((row) => ctx.db.get(row.userId)));
    const statsDocs = await Promise.all(ranked.map((row) =>
      ctx.db
        .query("userStats")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .unique(),
    ));
    // Avatar 3D optionnel : une seule requête de plus par ligne affichée.
    const customizationDocs = await Promise.all(ranked.map((row) =>
      ctx.db
        .query("userCustomization")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .unique(),
    ));
    const entries = ranked.slice(0, 100).map((row, index) => {
      const user = userDocs[index];
      const stats = statsDocs[index];
      const previousRank = row.previousRank ?? previousRanks.get(row.userId) ?? null;
      return {
        userId: row.userId,
        name: user?.name ?? user?.email ?? "KILINGO",
        image: user?.image ?? null,
        rank: row.rank,
        xp: row.xp,
        league: stats?.currentLeague ?? row.league ?? "bronze",
        previousRank,
        rankDelta: previousRank == null ? 0 : previousRank - row.rank,
        isYou: row.userId === authUserId,
        rpmAvatarUrl: customizationDocs[index]?.rpmAvatarUrl ?? null,
      };
    });

    let my: {
      rank: number;
      xp: number;
      league: League;
      previousRank: number | null;
      rankDelta: number;
      lastLeagueWeek: string;
      pendingPromotion: { from: League; to: League; weekKey: string } | null;
    } | null = null;
    if (authUserId) {
      const myStats = await ctx.db
        .query("userStats")
        .withIndex("by_user", (q) => q.eq("userId", authUserId))
        .unique();
      const liveIndex = ranked.findIndex((row) => row.userId === authUserId);
      const snapshot = liveIndex >= 0 ? ranked[liveIndex] : null;
      const fallback = entries.find((row) => row.userId === authUserId);
      const rank = snapshot?.rank ?? fallback?.rank ?? ranked.length + 1;
      const previousRank = snapshot?.previousRank ?? fallback?.previousRank ?? null;
      my = {
        rank,
        xp: snapshot?.xp ?? fallback?.xp ?? liveRows.find((row) => row.userId === authUserId)?.xp ?? 0,
        league: myStats?.currentLeague ?? "bronze",
        previousRank,
        rankDelta: previousRank == null ? 0 : previousRank - rank,
        lastLeagueWeek: myStats?.lastLeagueWeek ?? weekKey,
        pendingPromotion: myStats?.pendingPromotion ?? null,
      };
    }

    return { weekKey, entries, my };
  },
  returns: v.object({
    weekKey: v.string(),
    entries: v.array(entryValidator),
    my: v.union(
      v.null(),
      v.object({
        rank: v.number(),
        xp: v.number(),
        league: leagueValidator,
        previousRank: v.union(v.number(), v.null()),
        rankDelta: v.number(),
        lastLeagueWeek: v.string(),
        pendingPromotion: v.union(
          v.null(),
          v.object({ from: leagueValidator, to: leagueValidator, weekKey: v.string() }),
        ),
      }),
    ),
  }),
});
