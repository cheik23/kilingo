import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { applyAward, levelFromTotalXp } from "./gamification";

/* ═══════════════════════════════════════════════════════════════════
   STORE CONVERSATION IA (Phase 3/4) — projections + commit de tour.

   Séparé du moteur (aiConversation.ts) pour éviter toute référence
   api.* auto-circulaire : le moteur consomme ce module, jamais
   l'inverse. Cache 1 h des réponses IA inclus.
   ═══════════════════════════════════════════════════════════════════ */

export const CACHE_TTL_MS = 3_600_000;

export const correctionValidator = v.object({
  wrong: v.string(),
  right: v.string(),
  note: v.optional(v.string()),
});

export const conversationViewValidator = v.object({
  _id: v.id("aiConversations"),
  characterId: v.string(),
  scenarioId: v.string(),
  language: v.string(),
  messages: v.array(
    v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      timestamp: v.number(),
      corrections: v.optional(v.array(correctionValidator)),
    }),
  ),
  objectives: v.array(
    v.object({ expression: v.string(), done: v.boolean() }),
  ),
  /** 1.3 — mode libre : base slang vide ⇒ aucun objectif masqué. */
  freeMode: v.boolean(),
  expressionsUsed: v.array(v.string()),
  xpEarned: v.number(),
  status: v.string(),
  qualityAvg: v.number(),
});

export type ConversationView = {
  _id: string;
  characterId: string;
  scenarioId: string;
  language: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    corrections?: { wrong: string; right: string; note?: string }[];
  }[];
  objectives: { expression: string; done: boolean }[];
  freeMode: boolean;
  expressionsUsed: string[];
  xpEarned: number;
  status: string;
  qualityAvg: number;
};

/* ── Proctions lecture ─────────────────────────────────────────────── */

/** Conversation en direct (chat + panneau latéral réactifs). */
export const getConversation = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) return null;
    return {
      _id: conv._id,
      characterId: conv.characterId,
      scenarioId: conv.scenarioId,
      language: conv.language,
      messages: conv.messages,
      objectives: conv.objectives,
      freeMode: conv.freeMode ?? conv.objectives.length === 0,
      expressionsUsed: conv.expressionsUsed,
      xpEarned: conv.xpEarned,
      status: conv.status,
      qualityAvg:
        conv.qualityCount > 0
          ? Math.round(conv.qualitySum / conv.qualityCount)
          : 0,
    };
  },
  returns: v.union(v.null(), conversationViewValidator),
});

/** Banque d'argot de la conversation (expressions + sens). */
export const getPoolFor = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return [];
    return conv.pool.map((p) => ({
      expression: p.expression,
      meaning: p.meaning,
    }));
  },
  returns: v.array(
    v.object({ expression: v.string(), meaning: v.string() }),
  ),
});

export const getCharacter = query({
  args: { characterId: v.string(), language: v.string() },
  handler: async (ctx, args) => {
    // Même contrainte que startConversation : les `id` sont partagés entre
    // langues, on filtre donc par langue avant de matcher l'id.
    const row = (
      await ctx.db
        .query("aiCharacters")
        .withIndex("by_language", (q) => q.eq("language", args.language))
        .collect()
    ).find((candidate) => candidate.id === args.characterId);
    if (!row) return null;
    return { personality: row.personality };
  },
  returns: v.union(v.null(), v.object({ personality: v.string() })),
});

export const getScenario = query({
  args: { scenarioId: v.string(), language: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("aiScenarios")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();
    const row = rows.find((s) => s.id === args.scenarioId);
    if (!row) return null;
    return {
      title: row.title,
      context: row.context,
      difficulty: row.difficulty,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      context: v.string(),
      difficulty: v.string(),
    }),
  ),
});

export const peekCache = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("aiChatCache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) return null;
    if (row.expiresAt < Date.now()) return null;
    return row.reply;
  },
  returns: v.union(v.null(), v.string()),
});

/* ── Commit d'un tour (1 transaction) ──────────────────────────────── */

export const commitTurn = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    userMessage: v.string(),
    assistantMessage: v.string(),
    corrections: v.array(correctionValidator),
    newlyUsed: v.array(v.string()),
    newlyDone: v.array(v.string()),
    xpGained: v.number(),
    quality: v.number(),
    cacheKey: v.optional(v.string()),
    cacheReply: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) throw new Error("Conversation introuvable.");
    const now = Date.now();

    const messages: typeof conv.messages = [
      ...conv.messages,
      { role: "user" as const, content: args.userMessage, timestamp: now },
      {
        role: "assistant" as const,
        content: args.assistantMessage,
        timestamp: now + 1,
        corrections: args.corrections.length > 0 ? args.corrections : undefined,
      },
    ];
    const expressionsUsed = [
      ...new Set([...conv.expressionsUsed, ...args.newlyUsed]),
    ];
    const objectives = conv.objectives.map((o) =>
      args.newlyDone.includes(o.expression) ? { ...o, done: true } : o,
    );

    let levelUp: number | undefined;
    if (args.xpGained > 0) {
      const award = await applyAward(ctx, userId, args.xpGained, "conversation");
      levelUp =
        award.newLevel > levelFromTotalXp(award.totalXP - args.xpGained)
          ? award.newLevel
          : undefined;
    }

    await ctx.db.patch(args.conversationId, {
      messages: messages.slice(-80),
      expressionsUsed,
      objectives,
      xpEarned: conv.xpEarned + args.xpGained,
      qualitySum: conv.qualitySum + args.quality,
      qualityCount: conv.qualityCount + 1,
    });

    // Cache 1 h (jamais alimenté pour les échecs IA).
    if (args.cacheKey && args.cacheReply) {
      const existing = await ctx.db
        .query("aiChatCache")
        .withIndex("by_key", (q) => q.eq("key", args.cacheKey as string))
        .first();
      if (!existing) {
        await ctx.db.insert("aiChatCache", {
          key: args.cacheKey,
          reply: args.cacheReply,
          createdAt: now,
          expiresAt: now + CACHE_TTL_MS,
        });
      }
    }

    return { expressionsUsed, levelUp };
  },
  returns: v.object({
    expressionsUsed: v.array(v.string()),
    levelUp: v.optional(v.number()),
  }),
});
