import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  action,
  mutation,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  subtitleArrayValidator,
  slangHitArrayValidator,
} from "./subtitles";
import {
  resolveMedia,
  type MediaResolution,
} from "./mediaResolver";

const languageValidator = v.union(
  v.literal("en"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("ar"),
  v.literal("ru"),
  v.literal("sw"),
  v.literal("ln"),
  v.literal("ha"),
  v.literal("yo"),
  v.literal("zu"),
  v.literal("wo"),
);

// Cible de traduction : les 12 langues UI (languageValidator + fr, langue
// d'arrivée des sous-titres et des paroles traduites).
const targetLanguageValidator = v.union(
  v.literal("en"),
  v.literal("fr"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("ar"),
  v.literal("ru"),
  v.literal("sw"),
  v.literal("ln"),
  v.literal("ha"),
  v.literal("yo"),
  v.literal("zu"),
  v.literal("wo"),
);

// ─── Internal helpers used by the Node.js pipeline (youtubePipeline.ts) ──

export const getMediaInternal = internalQuery({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.mediaId);
    if (!doc) throw new Error("Média introuvable");
    return doc;
  },
});

export const patchMedia = internalMutation({
  args: {
    mediaId: v.id("userMedia"),
    status: v.optional(v.string()),
    error: v.optional(v.string()),
    errorKind: v.optional(v.string()),
    transcription: v.optional(v.string()),
    translation: v.optional(v.string()),
    translationFailed: v.optional(v.boolean()),
    translationProgress: v.optional(v.number()),
    segmentCount: v.optional(v.number()),
    subtitles: v.optional(subtitleArrayValidator),
    slangDetected: v.optional(slangHitArrayValidator),
    durationSeconds: v.optional(v.number()),
    transcriptSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { mediaId, ...patch } = args;
    await ctx.db.patch(mediaId, patch);
  },
});

// ─── Public API ────────────────────────────────────────────────────

/** Create an upload URL the client POSTs the media file to. */
export const createUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Register an uploaded media file and schedule processing. */
export const createMedia = mutation({
  args: {
    language: languageValidator,
    title: v.string(),
    sourceName: v.string(),
    mediaType: v.string(),
    storageId: v.id("_storage"),
    // Translation target; defaults to "fr" in the pipeline when absent.
    targetLanguage: v.optional(
      v.union(
        v.literal("en"),
        v.literal("fr"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
    ),
    /**
     * true ⇒ le client transcrit lui-même (moteur local Whisper du
     * déploiement, §7) et publiera le transcript via
     * `mediaHub2.ingestLocalTranscript`. Le pipeline serveur n'est alors PAS
     * planifié : pas de double transcription, et surtout aucune requête ASR
     * distante. Si le moteur local échoue, le client relance le pipeline
     * serveur avec `kickPipeline` (repli explicite).
     */
    deferPipeline: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const mediaId = await ctx.db.insert("userMedia", {
      userId,
      language: args.language,
      title: args.title,
      sourceName: args.sourceName,
      mediaType: args.mediaType,
      storageId: args.storageId,
      targetLanguage: args.targetLanguage,
      status: "pending",
    });
    if (!args.deferPipeline) {
      await ctx.scheduler.runAfter(0, api.youtubePipeline.processMedia, {
        mediaId,
      });
    }
    return { mediaId };
  },
});

/**
 * Register a pasted YouTube link and schedule the pipeline
 * (YouTube auto-captions first; audio transcription is the upload path).
 */
/**
 * Résolution universelle d'un lien média (YouTube, TikTok, Vimeo, …) via le
 * MediaUrlResolver : contrat unique MediaResolution, métadonnées oEmbed
 * officielles, erreurs explicites. Le frontend n'oriente vers la création de
 * média QUE si la résolution est réellement exploitable — plus jamais de
 * lecteur vide ni de faux succès pour une URL privée/supprimée.
 */
export const resolveMediaUrl = action({
  args: { url: v.string() },
  handler: async (_ctx, args) => {
    const userId = await getAuthUserId(_ctx);
    if (userId === null) throw new Error("Not signed in");
    const resolution: MediaResolution = await resolveMedia(args.url);
    return resolution;
  },
});

export const createLinkMedia = mutation({
  args: {
    language: languageValidator,
    title: v.string(),
    url: v.string(),
    /** Platform key from the media resolver — "youtube" today, extensible. */
    platform: v.optional(v.string()),
    // Translation target; defaults to "fr" in the pipeline when absent.
    targetLanguage: v.optional(
      v.union(
        v.literal("en"),
        v.literal("fr"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    // Generic http(s) validation — the platform-specific verdict belongs to
    // the resolver, which already routed this call.
    if (!/^https?:\/\//i.test(args.url)) {
      throw new Error("URL invalide");
    }
    const mediaId = await ctx.db.insert("userMedia", {
      userId,
      language: args.language,
      title: args.title,
      sourceName: args.url,
      mediaType: "video",
      sourceUrl: args.url,
      platform: args.platform,
      targetLanguage: args.targetLanguage,
      status: "pending",
    });
    // Route on the resolver's verdict, not on a YouTube-only guess :
    // YouTube → pipeline sous-titres ; TikTok et Dailymotion (lecteurs
    // officiels, sans transcript) → statut completed sans sous-titres ;
    // toute autre plateforme → échec explicite avec message honnête.
    await ctx.scheduler.runAfter(
      0,
      args.platform === "youtube"
        ? api.youtubePipeline.processYouTube
        : args.platform === "tiktok" || args.platform === "dailymotion"
          ? api.youtubePipeline.completeEmbedOnlyMedia
          : api.youtubePipeline.processUnresolvedUrl,
      { mediaId },
    );
    return { mediaId };
  },
});

/** Media status with synced subtitles — safe fields only. */
export const getMediaStatus = query({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(args.mediaId);
    if (!doc || doc.userId !== userId) return null;
    return {
      _id: doc._id,
      _creationTime: doc._creationTime,
      title: doc.title,
      language: doc.language,
      targetLanguage: doc.targetLanguage ?? "fr",
      mediaType: doc.mediaType,
      status: doc.status,
      error: doc.error,
      errorKind: doc.errorKind,
      transcription: doc.transcription,
      translation: doc.translation,
      textContent: doc.textContent,
      translationFailed: doc.translationFailed,
      translationProgress: doc.translationProgress,
      segmentCount: doc.segmentCount,
      subtitles: doc.subtitles ?? [],
      slangDetected: doc.slangDetected ?? [],
      durationSeconds: doc.durationSeconds,
      transcriptSource: doc.transcriptSource,
      sourceUrl: doc.sourceUrl,
      // URL de lecture du fichier uploadé (Convex Storage) : sans elle le
      // lecteur n'a rien à jouer — c'était la cause du « Shadow muet ».
      // getUrl peut renvoyer null (fichier purgé) → normalisé en undefined.
      mediaUrl: doc.storageId
        ? ((await ctx.storage.getUrl(doc.storageId)) ?? undefined)
        : undefined,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("userMedia"),
      _creationTime: v.number(),
      title: v.string(),
      language: languageValidator,
      mediaType: v.string(),
      status: v.string(),
      error: v.optional(v.string()),
      errorKind: v.optional(v.string()),
      transcription: v.optional(v.string()),
      translation: v.optional(v.string()),
      textContent: v.optional(v.string()),
      translationFailed: v.optional(v.boolean()),
      translationProgress: v.optional(v.number()),
      segmentCount: v.optional(v.number()),
      subtitles: subtitleArrayValidator,
      slangDetected: slangHitArrayValidator,
      durationSeconds: v.optional(v.number()),
      transcriptSource: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
      targetLanguage: v.union(
        v.literal("en"),
        v.literal("fr"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
    }),
  ),
});

/**
 * Manual restart for a stalled pipeline (stall watchdog in the UI). Unlike a
 * fire-and-forget scheduler call made by the client, a mutation always runs
 * — this is the reliable recovery path when a scheduled action died before
 * updating the status.
 */
export const kickPipeline = mutation({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const media = await ctx.db.get(args.mediaId);
    if (!media || media.userId !== userId) throw new Error("Média introuvable");
    if (media.status === "completed") return { ok: true as const };

    await ctx.db.patch(args.mediaId, { status: "pending" });
    // Text media stores its content inline and runs the text pipeline —
    // without this branch a pasted text was un-restartable.
    await ctx.scheduler.runAfter(
      0,
      media.mediaType === "text"
        ? api.youtubePipeline.processTextMedia
        : // URL media routes through the universal resolver ; TikTok (lecteur
          // officiel) se matérialise sans sous-titres ; les autres liens non
          // YouTube échouent explicitement au lieu d'un faux « no transcript ».
          media.sourceUrl != null
          ? media.platform === "youtube"
            ? api.youtubePipeline.processYouTube
            : media.platform === "tiktok" || media.platform === "dailymotion"
              ? api.youtubePipeline.completeEmbedOnlyMedia
              : api.youtubePipeline.processUnresolvedUrl
          : api.youtubePipeline.processMedia,
      { mediaId: args.mediaId },
    );
    return { ok: true as const };
  },
});

/**
 * Persiste la cible de traduction choisie dans le sélecteur « TRADUIRE
 * VERS » (LOT UI 2). La prochaine relance de pipeline (kick, retry) part
 * sur cette cible — la re-traduction immédiate passe par l'action
 * mediaRetranslate:retranslateMedia (media.ts reste un fichier sans Node).
 */
export const setMediaTargetLanguage = mutation({
  args: {
    mediaId: v.id("userMedia"),
    targetLanguage: targetLanguageValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const media = await ctx.db.get(args.mediaId);
    if (!media || media.userId !== userId) throw new Error("Média introuvable");
    await ctx.db.patch(args.mediaId, { targetLanguage: args.targetLanguage });
    return { ok: true as const };
  },
});

/**
 * Register pasted text and schedule its pipeline (segmentation → translation
 * → slang — no transcription needed, the source IS text).
 */
export const createTextMedia = mutation({
  args: {
    language: languageValidator,
    title: v.string(),
    text: v.string(),
    // Translation target; defaults to "fr" in the pipeline when absent.
    targetLanguage: v.optional(
      v.union(
        v.literal("en"),
        v.literal("fr"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const text = args.text.trim();
    if (text.length < 2) throw new Error("Texte trop court");
    if (text.length > 100_000) {
      throw new Error("Texte trop long (100 000 caractères max)");
    }
    const mediaId = await ctx.db.insert("userMedia", {
      userId,
      language: args.language,
      title: args.title.slice(0, 120) || "Texte importé",
      sourceName: "texte collé",
      mediaType: "text",
      textContent: text,
      targetLanguage: args.targetLanguage,
      status: "pending",
    });
    await ctx.scheduler.runAfter(0, api.youtubePipeline.processTextMedia, {
      mediaId,
    });
    return { mediaId };
  },
});

/**
 * Crée un userMedia pour toute analyse du Media Hub (music/film/book/talk).
 * Le pipeline complet (traduction → argot → sous-titres) est ensuite lancé
 * par les actions "use node" de mediaHub2 via runSharedPipeline.
 */
export const createHubMedia = mutation({
  args: {
    language: languageValidator,
    title: v.string(),
    sourceName: v.string(),
    mediaType: v.string(), // music | film | book | talk
    sourceUrl: v.optional(v.string()),
    targetLanguage: v.optional(
      v.union(
        v.literal("en"),
        v.literal("fr"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Non authentifié");
    return await ctx.db.insert("userMedia", {
      userId,
      language: args.language,
      title: args.title,
      sourceName: args.sourceName,
      mediaType: args.mediaType,
      sourceUrl: args.sourceUrl,
      targetLanguage: args.targetLanguage,
      status: "pending",
    });
  },
  returns: v.id("userMedia"),
});

/** Media history for the signed-in user. */
export const myMedia = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("userMedia")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        title: doc.title,
        language: doc.language,
        mediaType: doc.mediaType,
        status: doc.status,
        error: doc.error,
        slangCount: doc.slangDetected?.length ?? 0,
      }));
  },
  returns: v.array(
    v.object({
      _id: v.id("userMedia"),
      _creationTime: v.number(),
      title: v.string(),
      language: languageValidator,
      mediaType: v.string(),
      status: v.string(),
      error: v.optional(v.string()),
      slangCount: v.number(),
    }),
  ),
});
