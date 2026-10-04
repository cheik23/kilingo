import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ACHIEVEMENT_DEFINITIONS } from "./achievementCatalog";
import { addGemsInternal, applyAward, ensureStats } from "./gamification";
import { insertNotification } from "./notifications";
import { CUSTOMIZATION_DEFINITIONS } from "./customizationCatalog";

type ProgressDefinition = (typeof ACHIEVEMENT_DEFINITIONS)[number];
type ProgressCtx = MutationCtx | QueryCtx;

function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

async function unlockAchievementCustomization(ctx: MutationCtx, userId: Id<"users">, achievementId: string) {
  const exclusiveItems = CUSTOMIZATION_DEFINITIONS.filter((item) => item.achievementId === achievementId);
  if (exclusiveItems.length === 0) return;
  const existing = await ctx.db.query("userCustomization").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  const unlocked = new Set(existing?.unlocked ?? []);
  for (const item of exclusiveItems) unlocked.add(item.itemId);
  if (existing) await ctx.db.patch(existing._id, { unlocked: [...unlocked] });
  else await ctx.db.insert("userCustomization", { userId, selectedAvatar: "avatar-lion", unlocked: [...unlocked] });
  await insertNotification(ctx, { userId, kind: "achievement", title: "🎁 Avatar exclusif débloqué !", body: `${exclusiveItems.map((item) => item.name).join(", ")} attend dans Mon espace.` });
}

function valueForMetric(
  metric: string,
  values: {
    counters: Map<string, number>;
    stats: { longestStreak: number; currentStreak: number; gems: number } | null;
    cards: Array<{ language: string; status?: string; repetitions: number }>;
    languages: Array<{ language: string; active: boolean }>;
    quizzes: Array<{ correctAnswers: number; questionsAnswered: number; xpEarned: number; date: string; language: string }>;
    conversations: Array<{ characterId: string; scenarioId: string; language: string; status: string; messages: unknown[]; qualitySum: number; qualityCount: number; endedAt?: number }>;
    sessions: Array<{ kind: string; language: string; completedAt: number; itemsLearned: number }>;
    media: number;
    favorites: number;
    loot: number;
  },
): number {
  const counter = values.counters.get(metric) ?? 0;
  if (metric === "longestStreak") return Math.max(counter, values.stats?.longestStreak ?? 0);
  if (metric === "currentStreak") return values.stats?.currentStreak ?? counter;
  if (metric === "gems:balance") return values.stats?.gems ?? 0;
  if (metric === "cards:mastered") return values.cards.filter((c) => c.status === "mastered").length;
  if (metric === "cards:total") return values.cards.length;
  if (metric.startsWith("cards:")) {
    const language = metric.slice("cards:".length);
    return values.cards.filter((c) => c.language === language).length;
  }
  if (metric === "languages:mastered") return new Set(values.cards.filter((c) => c.repetitions > 0).map((c) => c.language)).size;
  if (metric === "deck:languages") return new Set(values.cards.map((c) => c.language)).size;
  if (metric === "languages:african") return values.languages.filter((l) => ["sw", "ln", "ha", "yo", "zu", "wo"].includes(l.language) && l.active).length;
  if (metric === "media:saved") return values.media;
  if (metric === "favorites:count") return values.favorites;
  if (metric === "loot:opened") return values.loot;
  if (metric === "quiz:total") return values.quizzes.length;
  if (metric === "quiz:perfect" || metric === "quiz:perfectAny") return values.quizzes.filter((q) => q.questionsAnswered > 0 && q.correctAnswers === q.questionsAnswered).length;
  if (metric === "quiz:fast") return counter;
  if (metric === "quiz:correct") return values.quizzes.reduce((sum, q) => sum + q.correctAnswers, 0);
  if (metric === "quiz:accuracy90") return values.quizzes.filter((q) => q.questionsAnswered >= 5 && q.correctAnswers / q.questionsAnswered >= 0.9).length;
  if (metric === "quiz:days") return new Set(values.quizzes.map((q) => q.date)).size;
  if (metric === "quiz:xp") return values.quizzes.reduce((sum, q) => sum + q.xpEarned, 0);
  if (metric === "quiz:languages") return new Set(values.quizzes.map((q) => q.language)).size;
  if (metric === "conv:baba") return values.conversations.filter((c) => c.characterId === "baba_street" && c.status === "completed").length;
  if (metric === "conv:marche") return values.conversations.filter((c) => c.scenarioId === "marche_lagos" && c.status === "completed").length;
  if (metric === "conv:total") return values.conversations.filter((c) => c.status === "completed").length;
  if (metric === "conv:turns") return values.conversations.filter((c) => c.status === "completed").reduce((sum, c) => sum + Math.floor(c.messages.length / 2), 0);
  if (metric === "conv:quality80") return values.conversations.filter((c) => c.status === "completed" && c.qualityCount > 0 && c.qualitySum / c.qualityCount >= 80).length;
  if (metric === "conv:characters") return new Set(values.conversations.filter((c) => c.status === "completed").map((c) => c.characterId)).size;
  if (metric === "conv:scenarios") return new Set(values.conversations.filter((c) => c.status === "completed").map((c) => c.scenarioId)).size;
  if (metric === "conv:languages") return new Set(values.conversations.filter((c) => c.status === "completed").map((c) => c.language)).size;
  if (metric === "conv:days") return new Set(values.conversations.filter((c) => c.status === "completed" && c.endedAt).map((c) => dayKey(c.endedAt!))).size;
  if (metric === "atlas:uses") return counter;
  if (metric === "shadow:analyses") return values.sessions.filter((s) => s.kind === "shadowing").length;
  if (metric === "cross:uses") return counter;
  if (metric === "browse:languages") return new Set(values.sessions.map((s) => s.language)).size;
  if (metric === "focus:sessions") return values.sessions.filter((s) => s.kind === "srs" || s.kind === "discovery").length;
  if (metric === "expressions:discovered") return values.sessions.reduce((sum, s) => sum + s.itemsLearned, 0);
  if (metric === "activeDays") return new Set([
    ...values.quizzes.map((q) => q.date),
    ...values.sessions.map((s) => dayKey(s.completedAt)),
    ...values.conversations.filter((c) => c.endedAt).map((c) => dayKey(c.endedAt!)),
  ]).size;
  return counter;
}

export async function readAchievementProgress(ctx: ProgressCtx, userId: Id<"users"> | null, definitions = ACHIEVEMENT_DEFINITIONS) {
  if (!userId) return Object.fromEntries(definitions.map((d) => [d.achievementId, 0])) as Record<string, number>;
  const [stats, cards, languages, quizzes, conversations, sessions, media, favorites, loot, counters] = await Promise.all([
    ctx.db.query("userStats").withIndex("by_user", (q) => q.eq("userId", userId)).unique(),
    ctx.db.query("srsCards").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("userLanguages").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("quizHistory").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("aiConversations").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("learningSessions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("userMedia").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("slangFavorites").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("userLootBoxes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("achievementCounters").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
  ]);
  const counterMap = new Map(counters.map((row) => [row.metric, row.count]));
  const values = {
    counters: counterMap,
    stats: stats ? { longestStreak: stats.longestStreak, currentStreak: stats.currentStreak, gems: stats.gems ?? 0 } : null,
    cards,
    languages,
    quizzes,
    conversations,
    sessions,
    media: media.length,
    favorites: favorites.length,
    loot: loot.filter((row) => row.openedAt != null).length,
  };
  return Object.fromEntries(definitions.map((definition) => [
    definition.achievementId,
    Math.max(0, valueForMetric(definition.metric, values)),
  ])) as Record<string, number>;
}

/** Point d'entrée interne idempotent, appelé par l'action publique checkAchievements. */
export const run = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const definitions = await ctx.db.query("achievements").collect();
    const progress = await readAchievementProgress(ctx, args.userId, definitions as ProgressDefinition[]);
    const existing = await ctx.db.query("userAchievements").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    const byId = new Map(existing.map((row) => [row.achievementId, row]));
    const completed: Array<{ achievementId: string; title: string; xp: number; gems: number; icon: string }> = [];
    const reminders: Array<{ achievementId: string; title: string; remaining: number; icon: string }> = [];
    for (const definition of definitions as ProgressDefinition[]) {
      const current = Math.min(definition.target, progress[definition.achievementId] ?? 0);
      const row = byId.get(definition.achievementId);
      if (!row) {
        const done = current >= definition.target;
        await ctx.db.insert("userAchievements", { userId: args.userId, achievementId: definition.achievementId, progress: current, completed: done, completedAt: done ? Date.now() : null });
        if (done) {
          completed.push({ achievementId: definition.achievementId, title: definition.title, xp: definition.reward.xp, gems: definition.reward.gems, icon: definition.icon });
          await applyAward(ctx, args.userId, definition.reward.xp, "achievement");
          await addGemsInternal(ctx, args.userId, definition.reward.gems, "achievement");
          const stats = await ensureStats(ctx, args.userId);
          if (definition.reward.badgeId && !stats.badges.includes(definition.reward.badgeId)) await ctx.db.patch(stats._id, { badges: [...stats.badges, definition.reward.badgeId] });
          await insertNotification(ctx, { userId: args.userId, kind: "achievement", title: `🏆 ${definition.title} débloqué !`, body: `+${definition.reward.xp} XP · +${definition.reward.gems} gems` });
          await unlockAchievementCustomization(ctx, args.userId, definition.achievementId);
        }
      } else if (!row.completed && current >= definition.target) {
        await ctx.db.patch(row._id, { progress: current, completed: true, completedAt: Date.now() });
        completed.push({ achievementId: definition.achievementId, title: definition.title, xp: definition.reward.xp, gems: definition.reward.gems, icon: definition.icon });
        await applyAward(ctx, args.userId, definition.reward.xp, "achievement");
        await addGemsInternal(ctx, args.userId, definition.reward.gems, "achievement");
        const stats = await ensureStats(ctx, args.userId);
        if (definition.reward.badgeId && !stats.badges.includes(definition.reward.badgeId)) {
          await ctx.db.patch(stats._id, { badges: [...stats.badges, definition.reward.badgeId] });
        }
        await insertNotification(ctx, { userId: args.userId, kind: "achievement", title: `🏆 ${definition.title} débloqué !`, body: `+${definition.reward.xp} XP · +${definition.reward.gems} gems` });
      } else if (!row.completed) {
        await ctx.db.patch(row._id, { progress: current, ...(current >= definition.target * 0.8 && current > (row.lastReminderProgress ?? 0) ? { lastReminderProgress: current } : {}) });
        if (current >= definition.target * 0.8 && current > (row.lastReminderProgress ?? 0)) {
          const remaining = Math.max(1, definition.target - current);
          reminders.push({ achievementId: definition.achievementId, title: definition.title, remaining, icon: definition.icon });
          await insertNotification(ctx, { userId: args.userId, kind: "achievement", title: `🏆 Plus que ${remaining} pour ${definition.title} !`, body: "Encore un petit effort pour compléter cette collection." });
        }
      }
    }
    return { completed, reminders };
  },
  returns: v.object({
    completed: v.array(v.object({ achievementId: v.string(), title: v.string(), xp: v.number(), gems: v.number(), icon: v.string() })),
    reminders: v.array(v.object({ achievementId: v.string(), title: v.string(), remaining: v.number(), icon: v.string() })),
  }),
});

export const pushAchievementReminder = internalMutation({
  args: { userId: v.id("users"), achievementId: v.string(), remaining: v.number(), title: v.string() },
  handler: async (ctx, args) => insertNotification(ctx, { userId: args.userId, kind: "achievement", title: `🏆 Plus que ${args.remaining} pour ${args.title} !`, body: "Encore un petit effort pour compléter cette collection." }),
  returns: v.id("userNotifications"),
});

export const getMyAchievements = query({
  args: { lang: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const definitions = await ctx.db.query("achievements").collect();
    const progress = await readAchievementProgress(ctx, userId, definitions as ProgressDefinition[]);
    const rows = userId ? await ctx.db.query("userAchievements").withIndex("by_user", (q) => q.eq("userId", userId)).collect() : [];
    const byId = new Map(rows.map((row) => [row.achievementId, row]));
    const lang = args.lang ?? "fr";
    const items = definitions.map((definition) => {
      const row = byId.get(definition.achievementId);
      const current = Math.min(definition.target, progress[definition.achievementId] ?? 0);
      return {
        achievementId: definition.achievementId,
        category: definition.category,
        title: definition.titleTranslations?.[lang] ?? definition.title,
        description: definition.descriptionTranslations?.[lang] ?? definition.description,
        target: definition.target,
        progress: row?.completed ? definition.target : current,
        completed: row?.completed === true,
        completedAt: row?.completedAt ?? null,
        reward: definition.reward,
        icon: definition.icon,
        tier: definition.tier,
      };
    });
    const completedItems = items.filter((item) => item.completed);
    return {
      items,
      summary: {
        total: items.length,
        completed: completedItems.length,
        xpEarned: completedItems.reduce((sum, item) => sum + item.reward.xp, 0),
        gemsEarned: completedItems.reduce((sum, item) => sum + item.reward.gems, 0),
      },
    };
  },
  returns: v.object({
    items: v.array(v.object({
      achievementId: v.string(), category: v.string(), title: v.string(), description: v.string(), target: v.number(), progress: v.number(), completed: v.boolean(), completedAt: v.union(v.number(), v.null()), reward: v.object({ xp: v.number(), gems: v.number(), badgeId: v.optional(v.string()) }), icon: v.string(), tier: v.string(),
    })),
    summary: v.object({ total: v.number(), completed: v.number(), xpEarned: v.number(), gemsEarned: v.number() }),
  }),
});
