import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { subtitleValidator } from "./subtitles";

/* ═══════════════════════════════════════════════════════════════════
   mediaJobs — lifecycle interne des transcriptions longues.
   Mutations internes uniquement (appelées par l'action transcribeLongAudio
   via ctx.runMutation(internal.mediaJobOps.*)) — pas d'exposition client.
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Fenêtre pendant laquelle un job « en cours » est considéré comme VIVANT.
 * Elle doit dépasser la durée d'un chunk lent (téléchargement + ASR) pour
 * qu'une relance ne double pas un run actif. Passé ce délai sans aucune
 * écriture de progression, le job est réputé bloqué : il peut être repris.
 */
const RUNNING_FRESH_MS = 180_000;

/** États dans lesquels un run travaille réellement sur le job. */
const RUNNING_STATUSES = new Set(["chunking", "transcribing", "translating"]);

/**
 * Démarre (ou réserve) un run de transcription : status "chunking" + step.
 *
 * P0.2.3 — `requireIdle: true` (premier appel du run) applique la garde de
 * relance : si un run est déjà en cours ET frais, la réservation est
 * refusée. La lecture et le patch portent sur le MÊME document, donc deux
 * relances concurrentes se départagent par un conflit OCC réel (la perdante
 * est rejouée, relit `updatedAt` frais et refuse) — contrairement à un
 * compteur lu puis incrémenté sur des documents différents.
 *
 * Un job `failed`, `completed` ou bloqué (aucune progression depuis
 * RUNNING_FRESH_MS) reste relançable : la reprise légitime est préservée.
 * Le second appel du run (étape de traduction) passe sans garde : il
 * appartient au run déjà réservé.
 */
export const start = internalMutation({
  args: {
    jobId: v.id("mediaJobs"),
    step: v.string(),
    requireIdle: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.requireIdle) {
      const job = await ctx.db.get(args.jobId);
      if (!job) throw new Error("Tâche introuvable.");
      if (RUNNING_STATUSES.has(job.status) && now - job.updatedAt < RUNNING_FRESH_MS) {
        throw new Error(
          "Transcription déjà en cours pour cette tâche : attends la fin du traitement en cours.",
        );
      }
    }
    await ctx.db.patch(args.jobId, {
      status: "chunking",
      currentStep: args.step,
      error: undefined,
      updatedAt: now,
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
