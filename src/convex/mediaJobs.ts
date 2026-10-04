import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ═══════════════════════════════════════════════════════════════════
   mediaJobs — accès client : créer un job, suivre la progression,
   supprimer. Toutes les fonctions sont scellées par l'identité.
   ═══════════════════════════════════════════════════════════════════ */

/** Retourne un job si l'appelant en est le propriétaire. */
export const get = query({
  args: { id: v.id("mediaJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const job = await ctx.db.get(args.id);
    if (!job || job.userId !== userId) return null;
    return job;
  },
});

/** Les jobs de l'utilisateur (les plus récents d'abord). */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const jobs = await ctx.db
      .query("mediaJobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return jobs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Crée un job de transcription longue. */
export const create = mutation({
  args: {
    title: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connexion requise.");
    const now = Date.now();
    const jobId = await ctx.db.insert("mediaJobs", {
      userId,
      title: args.title,
      sourceUrl: args.sourceUrl,
      status: "pending",
      currentStep: "media.stepQueued",
      createdAt: now,
      updatedAt: now,
    });
    return jobId;
  },
});

/**
 * Injecte des transcripts de chunks depuis le cache localStorage du client
 * (`chunkcache:{url}:{i}`) dans le job avant un « Réessayer » — les chunks
 * déjà présents côté serveur sont conservés tels quels.
 */
export const seedCache = mutation({
  args: {
    id: v.id("mediaJobs"),
    entries: v.array(
      v.object({
        i: v.number(),
        segments: v.array(
          v.object({ start: v.number(), end: v.number(), text: v.string() }),
        ),
        lang: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const job = await ctx.db.get(args.id);
    if (!job || job.userId !== userId) return;
    const known = new Set((job.chunkCache ?? []).map((c) => c.i));
    const fresh = args.entries.filter((e) => !known.has(e.i));
    if (fresh.length === 0) return;
    await ctx.db.patch(args.id, {
      chunkCache: [...(job.chunkCache ?? []), ...fresh],
      updatedAt: Date.now(),
    });
  },
});

/** Supprime un job terminé ou échoué. */
export const remove = mutation({
  args: { id: v.id("mediaJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const job = await ctx.db.get(args.id);
    if (!job || job.userId !== userId) return;
    await ctx.db.delete(args.id);
  },
});
