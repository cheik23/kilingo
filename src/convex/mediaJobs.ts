import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAudioSourceUrl } from "./mediaUrlPolicy";

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

/* ── Bornes de création (P0.2.2) ────────────────────────────────────
   `create` est le SEUL point d'entrée client qui fabrique un job, et un
   job déclenche en aval un téléchargement CÔTÉ SERVEUR puis des appels de
   transcription payants (`mediaJobRun.transcribeLongAudio`). D'où :
   • identité dérivée de la session (`getAuthUserId`) — jamais d'un
     `userId` fourni par l'appelant — donc aucun job créé pour autrui ;
   • champs bornés (titre, adresse) et adresse validée par la politique
     PARTAGÉE `mediaUrlPolicy` : http(s) sans identifiants, hôtes internes
     et plages privées refusés en mode normal, adresses locales admises
     seulement si `KILINGO_MEDIA_ALLOW_LOCAL_SOURCES=1` (essais locaux) ;
   • plafond de transcriptions SIMULTANÉES par compte, lu sur l'index
     `by_user` existant (aucune table ni index nouveau) ;
   • création idempotente : le même audio déjà en cours pour ce compte
     rend le job existant (`created: false`) au lieu d'en créer un second
     — un rejeu de l'interface ne paie plus deux fois la transcription.
   Lecture puis écriture : sous forte concurrence, le plafond peut être
   dépassé de quelques unités (même limite honnête que le journal client).
   La fenêtre de lecture est bornée aux RECENT_JOBS_SCAN jobs récents. */
const JOB_TITLE_MAX = 200;
const JOB_URL_MAX = 2048;
const MAX_ACTIVE_JOBS = 5;
const RECENT_JOBS_SCAN = 200;
const ACTIVE_JOB_STATUSES = new Set([
  "pending",
  "chunking",
  "transcribing",
  "translating",
]);
/**
 * Crée un job de transcription longue.
 *
 * Rend `{ jobId, created }` : `created: false` signifie qu'un job en cours
 * existait déjà pour le même audio — le client ouvre la salle sans relancer
 * le pipeline (le job n'est pas dupliqué).
 */
export const create = mutation({
  args: {
    title: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connexion requise.");

    const title = args.title.trim();
    if (title.length === 0) throw new Error("Titre de transcription manquant.");
    if (title.length > JOB_TITLE_MAX) {
      throw new Error(`Titre trop long (max ${JOB_TITLE_MAX} caractères).`);
    }
    const sourceUrl = args.sourceUrl.trim();
    if (sourceUrl.length === 0) throw new Error("Adresse audio manquante.");
    if (sourceUrl.length > JOB_URL_MAX) {
      throw new Error(`Adresse audio trop longue (max ${JOB_URL_MAX} caractères).`);
    }
    // Normalisation + politique d'hôte partagée (P0.2.3) : l'adresse STOCKÉE
    // est exactement celle validée, donc celle réellement téléchargée.
    const safeSourceUrl = assertAudioSourceUrl(sourceUrl);

    const recent = await ctx.db
      .query("mediaJobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(RECENT_JOBS_SCAN);
    const active = recent.filter((job) => ACTIVE_JOB_STATUSES.has(job.status));

    const alreadyRunning = active.find((job) => job.sourceUrl === sourceUrl);
    if (alreadyRunning) return { jobId: alreadyRunning._id, created: false };

    if (active.length >= MAX_ACTIVE_JOBS) {
      throw new Error(
        `Trop de transcriptions en cours (max ${MAX_ACTIVE_JOBS}) : attends la fin d'une tâche avant d'en lancer une autre.`,
      );
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("mediaJobs", {
      userId,
      title,
      sourceUrl: safeSourceUrl,
      status: "pending",
      currentStep: "media.stepQueued",
      createdAt: now,
      updatedAt: now,
    });
    return { jobId, created: true };
  },
});

/* ── Bornes du cache client (P0.2.1) ───────────────────────────────────
   `seedCache` reçoit un tableau ENTIÈREMENT fourni par le client : sans
   bornes, un compte pouvait gonfler indéfiniment le document de son job
   (segments, textes arbitraires) et payer un coût d'écriture illimité.
   Les plafonds ci-dessous sont ceux du parcours légitime : le client lit
   `localStorage` de 0 à 199 (`MediaRoomView`), chaque chunk transcrit tient
   largement sous 500 segments, et le cache d'un job dépasse rarement
   quelques dizaines de chunks.
   Le pipeline serveur (`internal.mediaJobOps.cacheChunk`) n'est PAS borné
   par ces valeurs : c'est un écrivain de confiance, un chunk à la fois. */
const SEED_CACHE_MAX_ENTRIES = 200;
const SEED_CACHE_MAX_CHUNK_INDEX = 999;
const SEED_CACHE_MAX_SEGMENTS = 500;
const SEED_CACHE_MAX_TEXT = 1000;
/** Plafond du cache stocké sur le job (tous écrivains confondus côté client). */
const CHUNK_CACHE_MAX = 600;

/**
 * Injecte des transcripts de chunks depuis le cache localStorage du client
 * (`chunkcache:{url}:{i}`) dans le job avant un « Réessayer » — les chunks
 * déjà présents côté serveur sont conservés tels quels.
 *
 * P0.2.1 : refuse explicitement (au lieu d'un retour silencieux) un appel
 * anonyme ou un job dont l'appelant n'est pas le propriétaire, et rejette
 * toute charge hors bornes plutôt que de l'écrire.
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
    if (!userId) throw new Error("Connexion requise.");
    const job = await ctx.db.get(args.id);
    if (!job || job.userId !== userId) {
      throw new Error("Job de transcription introuvable pour ce compte.");
    }

    if (args.entries.length > SEED_CACHE_MAX_ENTRIES) {
      throw new Error(`Cache client trop volumineux (max ${SEED_CACHE_MAX_ENTRIES} chunks).`);
    }
    for (const entry of args.entries) {
      if (!Number.isInteger(entry.i) || entry.i < 0 || entry.i > SEED_CACHE_MAX_CHUNK_INDEX) {
        throw new Error("Index de chunk invalide dans le cache client.");
      }
      if (entry.segments.length > SEED_CACHE_MAX_SEGMENTS) {
        throw new Error(`Chunk trop découpé (max ${SEED_CACHE_MAX_SEGMENTS} segments).`);
      }
      for (const segment of entry.segments) {
        if (
          !Number.isFinite(segment.start) ||
          !Number.isFinite(segment.end) ||
          segment.start < 0 ||
          segment.end < segment.start
        ) {
          throw new Error("Segment invalide dans le cache client.");
        }
        if (segment.text.length > SEED_CACHE_MAX_TEXT) {
          throw new Error(`Texte de segment trop long (max ${SEED_CACHE_MAX_TEXT} caractères).`);
        }
      }
    }

    const known = new Set((job.chunkCache ?? []).map((c) => c.i));
    // Déduplication INTRA-payload (un client ne le fait pas, un appelant
    // malveillant si) : la première occurrence d'un index gagne, comme pour
    // les chunks déjà en base.
    const fresh: typeof args.entries = [];
    for (const entry of args.entries) {
      if (known.has(entry.i)) continue;
      known.add(entry.i);
      fresh.push(entry);
    }
    if (fresh.length === 0) return { stored: 0 };

    const merged = [...(job.chunkCache ?? []), ...fresh];
    if (merged.length > CHUNK_CACHE_MAX) {
      throw new Error(
        `Cache du job saturé (max ${CHUNK_CACHE_MAX} chunks) : termine la transcription puis relance-la.`,
      );
    }
    await ctx.db.patch(args.id, {
      chunkCache: merged,
      updatedAt: Date.now(),
    });
    return { stored: fresh.length };
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
