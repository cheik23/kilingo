import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { subtitleValidator } from "./subtitles";

/* ═══════════════════════════════════════════════════════════════════
   mediaJobs — lifecycle interne des transcriptions longues.
   Mutations internes uniquement (appelées par l'action transcribeLongAudio
   via ctx.runMutation(internal.mediaJobOps.*)) — pas d'exposition client.
   ═══════════════════════════════════════════════════════════════════ */

/** Démarre un job : status "chunking" + step i18n. */
export const start = internalMutation({
  args: { jobId: v.id("mediaJobs"), step: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "chunking",
      currentStep: args.step,
      error: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Progression : chunks faits, total, étape courante. */
export const progress = internalMutation({
  args: {
    jobId: v.id("mediaJobs"),
    totalChunks: v.number(),
    doneChunks: v.number(),
    step: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "transcribing",
      totalChunks: args.totalChunks,
      doneChunks: args.doneChunks,
      currentStep: args.step,
      updatedAt: Date.now(),
    });
  },
});

/** Avertissement non-bloquant (chunk indécodable sauté). */
export const warn = internalMutation({
  args: { jobId: v.id("mediaJobs"), warning: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      warning: args.warning,
      updatedAt: Date.now(),
    });
  },
});

/** Ajoute un transcript de chunk réussi au cache du job. */
export const cacheChunk = internalMutation({
  args: {
    jobId: v.id("mediaJobs"),
    i: v.number(),
    segments: v.array(
      v.object({ start: v.number(), end: v.number(), text: v.string() }),
    ),
    lang: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    const cache = (job.chunkCache ?? []).filter((c) => c.i !== args.i);
    cache.push({ i: args.i, segments: args.segments, lang: args.lang });
    await ctx.db.patch(args.jobId, {
      chunkCache: cache,
      updatedAt: Date.now(),
    });
  },
});

/** Échec définitif après retries. */
export const fail = internalMutation({
  args: { jobId: v.id("mediaJobs"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      currentStep: "media.stepFailed",
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});

/** Termine : segments fusionnés + média créé + médiaId renvoyé à l'UI. */
export const complete = internalMutation({
  args: {
    jobId: v.id("mediaJobs"),
    mediaId: v.id("userMedia"),
    segments: v.array(subtitleValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      currentStep: "media.stepDone",
      doneChunks: undefined,
      totalChunks: undefined,
      mediaId: args.mediaId,
      segments: args.segments,
      chunkCache: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Nettoie les jobs abandonnés d'un user (optionnel, hygiène). */
export const purgeUserJobs = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("mediaJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const job of jobs) {
      if (job.status !== "completed") {
        await ctx.db.delete(job._id as Id<"mediaJobs">);
      }
    }
  },
});
