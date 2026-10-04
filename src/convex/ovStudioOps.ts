import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — OPÉRATIONS STUDIO (usage interne)
   Ces primitives sont isolées du fichier qui expose les actions : un
   module qui s'appelle lui-même via `internal.*` crée un cycle
   d'inférence de types que TypeScript ne sait pas résoudre.
   ═══════════════════════════════════════════════════════════════════════ */

export const contentForStudio = internalQuery({
  args: { contentKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ovContents")
      .withIndex("by_key", (q) => q.eq("key", args.contentKey))
      .unique();
  },
});

export const transcriptionById = internalQuery({
  args: { id: v.id("ovTranscriptions") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const logStudio = internalMutation({
  args: {
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    scope: v.string(),
    message: v.string(),
    meta: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ovLogs", { ...args, createdAt: Date.now() });
    return { ok: true as const };
  },
});

export const insertTranscription = internalMutation({
  args: {
    userId: v.id("users"),
    contentKey: v.string(),
    engine: v.string(),
    language: v.optional(v.string()),
    status: v.string(),
    step: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("ovTranscriptions", {
      userId: args.userId,
      contentKey: args.contentKey,
      engine: args.engine,
      language: args.language,
      status: args.status,
      step: args.step,
      progress: 5,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const finishTranscription = internalMutation({
  args: {
    id: v.id("ovTranscriptions"),
    status: v.string(),
    step: v.optional(v.string()),
    progress: v.optional(v.number()),
    text: v.optional(v.string()),
    segments: v.optional(
      v.array(v.object({ start: v.number(), end: v.number(), text: v.string() })),
    ),
    error: v.optional(v.string()),
    engine: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      step: args.step,
      progress: args.progress,
      text: args.text,
      ...(args.segments ? { segments: args.segments } : {}),
      error: args.error,
      ...(args.engine ? { engine: args.engine } : {}),
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** Crée ou remplace la traduction d'une transcription pour une langue. */
export const upsertTranslation = internalMutation({
  args: {
    userId: v.id("users"),
    transcriptionId: v.id("ovTranscriptions"),
    targetLang: v.string(),
    engine: v.string(),
    status: v.string(),
    segments: v.array(
      v.object({ start: v.number(), end: v.number(), source: v.string(), text: v.string() }),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ovTranslations")
      .withIndex("by_transcription", (q) => q.eq("transcriptionId", args.transcriptionId))
      .take(20);
    const same = existing.find((t) => t.targetLang === args.targetLang);
    if (same) {
      await ctx.db.patch(same._id, {
        segments: args.segments,
        engine: args.engine,
        status: args.status,
        error: args.error,
      });
      return { id: same._id, replaced: true as const };
    }
    const id = await ctx.db.insert("ovTranslations", {
      userId: args.userId,
      transcriptionId: args.transcriptionId,
      targetLang: args.targetLang,
      engine: args.engine,
      status: args.status,
      segments: args.segments,
      error: args.error,
      createdAt: Date.now(),
    });
    return { id, replaced: false as const };
  },
});
