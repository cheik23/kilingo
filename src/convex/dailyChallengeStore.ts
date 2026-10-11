import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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

export const getExisting = internalQuery({
  args: { dayKey: v.string(), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Résilient : si plusieurs lignes existent pour la même clé (ex. doublons
    // créés par des tests précédents), on ne prend pas le risque de faire
    // planter l'action avec `.unique()`. On trie par insertion récente et on
    // garde le premier. En production propre on n'en aura jamais plus d'un.
    const row = args.userId
      ? await ctx.db
          .query("dailyChallenges")
          .withIndex("by_user_day", (q) =>
            q.eq("userId", args.userId).eq("dayKey", args.dayKey),
          )
          .order("desc")
          .take(1)
      : await ctx.db
          .query("dailyChallenges")
          .withIndex("by_day", (q) => q.eq("dayKey", args.dayKey))
          .order("desc")
          .take(1);
    const chosen = row[0] ?? null;
    if (!chosen || chosen.userId != null) return null;
    return {
      _id: chosen._id,
      dayKey: chosen.dayKey,
      type: chosen.type,
      payload: { ...chosen.payload, expression: chosen.payload.expression ?? "" },
      expiresAt: chosen.expiresAt,
      completedAt: chosen.completedAt ?? null,
    };
  },
  returns: v.union(v.null(), resultValidator),
});

export const vocabulary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const languages = ["en", "es", "zh", "ar", "ru", "sw", "ln", "ha", "yo", "zu", "wo"] as const;
    const rows = await Promise.all(languages.map(async (language) => {
      const entries = await ctx.db
        .query("slangExpressions")
        .withIndex("by_language_popularity", (q) => q.eq("language", language))
        .collect();
      return {
        language,
        count: entries.length,
        entries: entries.slice(0, 80).map((entry) => ({
          _id: entry._id,
          expression: entry.expression,
          meaning: entry.meaning,
        })),
      };
    }));
    return rows;
  },
  returns: v.array(v.object({
    language: v.string(),
    count: v.number(),
    entries: v.array(v.object({
      _id: v.id("slangExpressions"),
      expression: v.string(),
      meaning: v.string(),
    })),
  })),
});

export const create = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    dayKey: v.string(),
    type: typeValidator,
    payload: payloadValidator,
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("dailyChallenges", {
      ...(args.userId ? { userId: args.userId } : {}),
      dayKey: args.dayKey,
      type: args.type,
      payload: args.payload,
      expiresAt: args.expiresAt,
      completedAt: null,
    });
    return {
      _id: id,
      dayKey: args.dayKey,
      type: args.type,
      payload: args.payload,
      expiresAt: args.expiresAt,
      completedAt: null,
    };
  },
  returns: resultValidator,
});
