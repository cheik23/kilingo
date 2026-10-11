import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isoWeekKey, type League } from "./leaderboard";

/* ═══════════════════════════════════════════════════════════════════════
   CLASSEMENT MULTI-PÉRIODES — LECTURE SEULE

   `leaderboard.ts` reste la SEULE source de vérité du classement
   hebdomadaire : un writer (`recordWeeklyXp`), un finaliseur
   (`finalizeWeek`). Ce module ne fait que relire la même table `weeklyXp`
   pour agréger d'autres fenêtres (mois, tout) et le classement des
   filleuls : aucun second writer, aucun XP recalculé, aucune donnée
   inventée. Tout utilisateur sans ligne `weeklyXp` sur la fenêtre est
   simplement absent du classement (0 XP ne mérite pas un rang).

   Fenêtres :
   - `week`  : semaine ISO courante ;
   - `month` : 30 derniers jours → semaines ISO recouvertes ;
   - `all`   : toutes les semaines écrites (plafonné comme `finalizeWeek`).

   Chaque fenêtre possède une fenêtre précédente de même longueur : c'est
   elle qui alimente les flèches de progression (`rankDelta`), jamais une
   valeur stockée qui pourrait se désynchroniser.
   ═══════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;

const periodValidator = v.union(
  v.literal("week"),
  v.literal("month"),
  v.literal("all"),
);

type Period = "week" | "month" | "all";

function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** Clés ISO des semaines recouvertes par [from, to] (bornes incluses). */
function weekKeysBetween(from: number, to: number): string[] {
  const keys = new Set<string>();
  for (let t = dayStart(from); t <= to; t += DAY_MS) keys.add(isoWeekKey(t));
  return [...keys];
}

type Window = { keys: string[] | null; prev: string[] | null; days: number };

function windowOf(period: Period, now: number): Window {
  if (period === "all") return { keys: null, prev: null, days: 0 };
  const days = period === "week" ? 7 : 30;
  const from = dayStart(now) - (days - 1) * DAY_MS;
  return {
    keys: weekKeysBetween(from, now),
    prev: weekKeysBetween(from - days * DAY_MS, from - DAY_MS),
    days,
  };
}

async function loadRows(ctx: QueryCtx, keys: string[] | null): Promise<Doc<"weeklyXp">[]> {
  if (keys === null) {
    // Même plafond que finalizeWeek : une ligne par utilisateur et par semaine.
    return await ctx.db.query("weeklyXp").take(4096);
  }
  const rows: Doc<"weeklyXp">[] = [];
  for (const key of keys) {
    const part = await ctx.db
      .query("weeklyXp")
      .withIndex("by_week", (q) => q.eq("weekKey", key))
      .collect();
    rows.push(...part);
  }
  return rows;
}

function sumByUser(rows: Doc<"weeklyXp">[]): Map<Id<"users">, number> {
  const totals = new Map<Id<"users">, number>();
  for (const row of rows) {
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.xp);
  }
  return totals;
}

/** Rang par XP décroissant (départage déterministe par identifiant). */
function rankOf(
  totals: Map<Id<"users">, number>,
  only?: Set<Id<"users">>,
): Map<Id<"users">, number> {
  const ranks = new Map<Id<"users">, number>();
  const ordered = [...totals.entries()]
    .filter(([userId, xp]) => xp > 0 && (!only || only.has(userId)))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  ordered.forEach(([userId], index) => ranks.set(userId, index + 1));
  return ranks;
}

type BoardEntry = {
  userId: Id<"users">;
  name: string;
  image: string | null;
  rpmAvatarUrl: string | null;
  rank: number;
  xp: number;
  league: League;
  previousRank: number | null;
  rankDelta: number;
  isYou: boolean;
};

/** Habille les rangs avec les données publiques (nom, ligue, avatar 3D). */
async function decorate(
  ctx: QueryCtx,
  totals: Map<Id<"users">, number>,
  previousRanks: Map<Id<"users">, number>,
  limit: number,
  authUserId: Id<"users"> | null,
  only?: Set<Id<"users">>,
): Promise<BoardEntry[]> {
  const ordered = [...totals.entries()]
    .filter(([userId, xp]) => xp > 0 && (!only || only.has(userId)))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);

  const [users, stats, customizations] = await Promise.all([
    Promise.all(ordered.map(([userId]) => ctx.db.get(userId))),
    Promise.all(
      ordered.map(([userId]) =>
        ctx.db
          .query("userStats")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
      ),
    ),
    Promise.all(
      ordered.map(([userId]) =>
        ctx.db
          .query("userCustomization")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
      ),
    ),
  ]);

  return ordered.map(([userId, xp], index) => {
    const user = users[index];
    const previousRank = previousRanks.get(userId) ?? null;
    return {
      userId,
      name: user?.name ?? user?.email ?? "KILINGO",
      image: user?.image ?? null,
      rpmAvatarUrl: customizations[index]?.rpmAvatarUrl ?? null,
      rank: index + 1,
      xp,
      league: (stats[index]?.currentLeague ?? "bronze") as League,
      previousRank,
      rankDelta: previousRank === null ? 0 : previousRank - (index + 1),
      isYou: userId === authUserId,
    };
  });
}

const entryValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  image: v.union(v.string(), v.null()),
  rpmAvatarUrl: v.union(v.string(), v.null()),
  rank: v.number(),
  xp: v.number(),
  league: v.union(
    v.literal("bronze"),
    v.literal("silver"),
    v.literal("gold"),
    v.literal("platinum"),
    v.literal("diamond"),
  ),
  previousRank: v.union(v.number(), v.null()),
  rankDelta: v.number(),
  isYou: v.boolean(),
});

const myValidator = v.union(
  v.null(),
  v.object({
    rank: v.number(),
    xp: v.number(),
    league: v.union(
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("platinum"),
      v.literal("diamond"),
    ),
    previousRank: v.union(v.number(), v.null()),
    rankDelta: v.number(),
    /** Nombre d'utilisateurs classés sur la fenêtre (0 XP exclus). */
    participants: v.number(),
  }),
);

/* ── 2a. Classement global, par période ─────────────────────────────── */

export const getRankingBoard = query({
  args: { period: periodValidator },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    const now = Date.now();
    const win = windowOf(args.period, now);

    const [rows, previousRows] = await Promise.all([
      loadRows(ctx, win.keys),
      win.prev === null ? Promise.resolve([] as Doc<"weeklyXp">[]) : loadRows(ctx, win.prev),
    ]);

    const totals = sumByUser(rows);
    const previousRanks = rankOf(sumByUser(previousRows));
    const ranks = rankOf(totals);
    const participants = ranks.size;
    const entries = await decorate(ctx, totals, previousRanks, 100, authUserId);

    let my: {
      rank: number;
      xp: number;
      league: League;
      previousRank: number | null;
      rankDelta: number;
      participants: number;
    } | null = null;
    if (authUserId !== null) {
      const xp = totals.get(authUserId) ?? 0;
      const rank = ranks.get(authUserId) ?? participants + 1;
      const previousRank = previousRanks.get(authUserId) ?? null;
      const stats = await ctx.db
        .query("userStats")
        .withIndex("by_user", (q) => q.eq("userId", authUserId))
        .unique();
      my = {
        rank,
        xp,
        league: (stats?.currentLeague ?? "bronze") as League,
        previousRank,
        rankDelta: previousRank === null ? 0 : previousRank - rank,
        participants,
      };
    }

    return { period: args.period, days: win.days, entries, my };
  },
  returns: v.object({
    period: periodValidator,
    days: v.number(),
    entries: v.array(entryValidator),
    my: myValidator,
  }),
});

/* ── 2b. Classement des filleuls (parrainage) ───────────────────────── */

/**
 * « Amis » = les filleuls réellement rattachés à mon compte (`referrals`).
 * Aucune notion d'ami déclaratif n'existe en base : on n'en invente pas.
 */
export const getFriendRanking = query({
  args: { period: periodValidator },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) return { period: args.period, entries: [], my: null };

    const now = Date.now();
    const win = windowOf(args.period, now);
    const [rows, links] = await Promise.all([
      loadRows(ctx, win.keys),
      ctx.db
        .query("referrals")
        .withIndex("by_referrer", (q) => q.eq("referrerId", authUserId))
        .collect(),
    ]);

    const circle = new Set<Id<"users">>([authUserId, ...links.map((l) => l.referredId)]);
    const totals = sumByUser(rows);
    // Progression réelle : mes filleuls et moi, sur la fenêtre précédente.
    const previousRanks =
      win.prev === null
        ? new Map<Id<"users">, number>()
        : rankOf(sumByUser(await loadRows(ctx, win.prev)), circle);
    const entries = await decorate(ctx, totals, previousRanks, circle.size, authUserId, circle);
    const mine = entries.find((entry) => entry.isYou) ?? null;

    return {
      period: args.period,
      entries,
      my:
        mine === null
          ? null
          : {
              rank: mine.rank,
              xp: mine.xp,
              league: mine.league,
              previousRank: mine.previousRank,
              rankDelta: mine.rankDelta,
              participants: entries.length,
            },
    };
  },
  returns: v.object({
    period: periodValidator,
    entries: v.array(entryValidator),
    my: myValidator,
  }),
});

/* ── 2c. Évolution de mon rang, semaine par semaine ─────────────────── */

export const getRankingHistory = query({
  args: { weeks: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { points: [], current: null, bestRank: null };

    const weeks = Math.min(Math.max(args.weeks ?? 12, 1), 52);
    const rows = await ctx.db
      .query("weeklyLeaderboard")
      .withIndex("by_user_week", (q) => q.eq("userId", userId))
      .collect();
    const points = rows
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(-weeks)
      .map((row) => ({
        weekKey: row.weekKey,
        rank: row.rank,
        xp: row.xp,
        league: row.league as League,
        resultingLeague: (row.resultingLeague ?? row.league) as League,
      }));

    // Point courant : rang live de la semaine en cours (même calcul que la
    // page Classement hebdomadaire, sans attendre la finalisation du dimanche).
    const currentKey = isoWeekKey();
    const liveRows = await ctx.db
      .query("weeklyXp")
      .withIndex("by_week", (q) => q.eq("weekKey", currentKey))
      .collect();
    const liveRanks = rankOf(sumByUser(liveRows));
    const liveXp = sumByUser(liveRows).get(userId) ?? 0;
    const current =
      liveXp > 0 || liveRanks.has(userId)
        ? {
            weekKey: currentKey,
            rank: liveRanks.get(userId) ?? liveRanks.size + 1,
            xp: liveXp,
            league: (points[points.length - 1]?.resultingLeague ?? "bronze") as League,
          }
        : null;

    const ranks = points.map((p) => p.rank);
    if (current) ranks.push(current.rank);

    return {
      points,
      current,
      bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
    };
  },
  returns: v.object({
    points: v.array(
      v.object({
        weekKey: v.string(),
        rank: v.number(),
        xp: v.number(),
        league: v.union(
          v.literal("bronze"),
          v.literal("silver"),
          v.literal("gold"),
          v.literal("platinum"),
          v.literal("diamond"),
        ),
        resultingLeague: v.union(
          v.literal("bronze"),
          v.literal("silver"),
          v.literal("gold"),
          v.literal("platinum"),
          v.literal("diamond"),
        ),
      }),
    ),
    current: v.union(
      v.null(),
      v.object({
        weekKey: v.string(),
        rank: v.number(),
        xp: v.number(),
        league: v.union(
          v.literal("bronze"),
          v.literal("silver"),
          v.literal("gold"),
          v.literal("platinum"),
          v.literal("diamond"),
        ),
      }),
    ),
    bestRank: v.union(v.number(), v.null()),
  }),
});
