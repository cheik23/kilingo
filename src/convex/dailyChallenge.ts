import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { applyAward, addGemsInternal, dayKey, ensureStats } from "./gamification";

const DAY_MS = 24 * 60 * 60 * 1000;
const typeValidator = v.union(v.literal("quiz"), v.literal("mcq"), v.literal("listen"));
const payloadValidator = v.object({
  slangId: v.id("slangExpressions"),
  question: v.string(),
  options: v.array(v.string()),
  answerIndex: v.number(),
  language: v.string(),
  expression: v.string(),
});
const resultValidator = v.object({
  _id: v.id("dailyChallenges"),
  dayKey: v.string(),
  type: typeValidator,
  payload: payloadValidator,
  expiresAt: v.number(),
  completedAt: v.union(v.number(), v.null()),
});

type VocabularyEntry = { _id: any; expression: string; meaning: string };
type Vocabulary = { language: string; count: number; entries: VocabularyEntry[] };
type DailyResult = {
  _id: any;
  dayKey: string;
  type: "quiz" | "mcq" | "listen";
  payload: { slangId: any; question: string; options: string[]; answerIndex: number; language: string; expression: string };
  expiresAt: number;
  completedAt: number | null;
};

/** Action publique : consultation anonyme possible, création via le store interne. */
export const getOrGenerateDailyChallenge = action({
  args: {},
  handler: async (ctx): Promise<DailyResult> => {
    const today = dayKey(Date.now());
    const userId = await getAuthUserId(ctx);
    const existing: DailyResult | null = await ctx.runQuery(internal.dailyChallengeStore.getExisting, {
      dayKey: today,
      userId: userId ?? undefined,
    });
    if (existing) return existing;

    const vocabulary = (await ctx.runQuery(internal.dailyChallengeStore.vocabulary, {})) as Vocabulary[];
    const viable = vocabulary.filter((group) => group.count >= 4);
    const groups = viable.length > 0 ? viable : vocabulary;
    const group = groups[Math.floor(Math.random() * groups.length)];
    const pool = group?.entries ?? [];
    const slang = pool[Math.floor(Math.random() * pool.length)];
    if (!slang) throw new Error("Daily challenge vocabulary is empty");

    const distractors = pool
      .filter((candidate) => candidate._id !== slang._id && candidate.meaning !== slang.meaning)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((candidate) => candidate.meaning);
    while (distractors.length < 3) {
      const fallback = pool[distractors.length];
      if (!fallback || distractors.includes(fallback.meaning)) break;
      distractors.push(fallback.meaning);
    }
    const options = [slang.meaning, ...distractors.slice(0, 3)];
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const type = (["quiz", "mcq", "listen"] as const)[Math.floor(Math.random() * 3)];
    const question = type === "listen"
      ? "Écoute l’expression et choisis son sens."
      : `Que signifie « ${slang.expression} » ?`;
    const payload = {
      slangId: slang._id,
      question,
      options,
      answerIndex: options.indexOf(slang.meaning),
      language: group.language,
      expression: slang.expression,
    };
    const expiresAt = Date.now() + DAY_MS;
    return ctx.runMutation(internal.dailyChallengeStore.create, {
      userId: userId ?? undefined,
      dayKey: today,
      type,
      payload,
      expiresAt,
    });
  },
  returns: resultValidator,
});

export const completeDailyChallenge = mutation({
  args: { challengeId: v.id("dailyChallenges"), success: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || challenge.userId !== userId) throw new Error("Daily challenge introuvable");
    const stats = await ensureStats(ctx, userId);
    const now = Date.now();
    if (challenge.expiresAt < now) throw new Error("Daily challenge expiré");
    if (challenge.completedAt != null || (stats.lastDailyAt ?? 0) >= now - DAY_MS) {
      return { ok: false, reason: "already_today", xpGained: 0, gemsEarned: 0 };
    }
    await ctx.db.patch(stats._id, { lastDailyAt: now });
    const award = await applyAward(ctx, userId, args.success ? 10 : 2, "daily_challenge");
    const gemsEarned = args.success ? await addGemsInternal(ctx, userId, 5, "daily_challenge") : 0;
    await ctx.db.patch(challenge._id, { completedAt: now });
    return { ok: true, xpGained: award.xpGained, gemsEarned };
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(v.string()),
    xpGained: v.number(),
    gemsEarned: v.number(),
  }),
});
