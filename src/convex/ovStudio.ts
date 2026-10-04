import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { envValue } from "./ovSources";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — STUDIO (transcription, traduction, sous-titres)

   Pipeline :  CONTENU → EXTRACTION → LANGUE → TRANSCRIPTION →
               SEGMENTATION → TRADUCTION → SOUS-TITRES → LECTEUR

   Deux verrous avant toute opération :
     1. l'utilisateur est authentifié ;
     2. le Rights Engine autorise la dérivation (canDerive / canTranslate).
   Sans les deux, la demande est refusée et journalisée — jamais exécutée.
   ═══════════════════════════════════════════════════════════════════════ */

export const engineInfo = query({
  args: {},
  handler: async () => ({
    localWhisper: Boolean(envValue("WHISPER_LOCAL_URL")),
    groqWhisper: Boolean(envValue("GROQ_API_KEY")),
    localTranslate: Boolean(envValue("TRANSLATE_LOCAL_URL")),
    freeTranslate: true,
    whisperModel: envValue("WHISPER_MODEL") ?? "whisper-large-v3-turbo",
  }),
});

/** Démarre une transcription si — et seulement si — les droits le permettent. */
export const requestTranscription = action({
  args: { contentKey: v.string(), language: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    transcriptionId?: string;
    engine: string;
    reason?: string;
    warnings?: string[];
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connexion requise pour lancer une transcription.");

    const content = await ctx.runQuery(internal.ovStudioOps.contentForStudio, {
      contentKey: args.contentKey,
    });
    if (!content) throw new Error("Contenu inconnu : lance d'abord une recherche.");

    const refuse = async (reason: string): Promise<never> => {
      await ctx.runMutation(internal.ovStudioOps.logStudio, {
        level: "warn",
        scope: "studio",
        message: `Transcription refusée — ${content.title}`,
        meta: reason,
        userId,
      });
      throw new Error(reason);
    };

    if (content.rightsStatus === "UNKNOWN" || content.rightsStatus === "RESTRICTED") {
      // R4 : le motif technique reste dans le journal, jamais dans l'UI.
      return refuse("Transcription indisponible pour ce contenu.");
    }
    if (!content.derivativeWorkAllowed && !content.translationAllowed) {
      return refuse("Transcription indisponible pour ce contenu.");
    }

    const transcriptionId = await ctx.runMutation(internal.ovStudioOps.insertTranscription, {
      userId,
      contentKey: args.contentKey,
      engine: content.textUrl ? "source_text" : "pending",
      language: args.language ?? content.language,
      status: "processing",
      step: "extraction",
    });

    // 1. Le contenu expose déjà un texte : aucune inférence nécessaire.
    if (content.textUrl) {
      const out = await ctx.runAction(internal.ovStudioEngine.fetchTextRemote, {
        textUrl: content.textUrl,
      });
      await ctx.runMutation(internal.ovStudioOps.finishTranscription, {
        id: transcriptionId,
        status: out.ok ? "done" : "error",
        text: out.text,
        segments: [],
        step: out.ok ? "done" : "error",
        error: out.ok ? undefined : out.reason,
      });
      return { ok: out.ok, transcriptionId, engine: "source_text", reason: out.reason };
    }

    // 2. Sinon, il faut de l'audio et un moteur de reconnaissance.
    if (!content.streamUrl && !content.previewUrl) {
      await ctx.runMutation(internal.ovStudioOps.finishTranscription, {
        id: transcriptionId,
        status: "error",
        step: "error",
        error: "Aucun flux audio exploitable pour ce contenu (source de métadonnées).",
      });
      return { ok: false, transcriptionId, engine: "unavailable", reason: "no_audio" };
    }

    if (!envValue("WHISPER_LOCAL_URL") && !envValue("GROQ_API_KEY")) {
      await ctx.runMutation(internal.ovStudioOps.finishTranscription, {
        id: transcriptionId,
        status: "error",
        step: "error",
        error:
          "Aucun moteur de transcription disponible. Renseigne WHISPER_LOCAL_URL (recommandé : gratuit et local) ou GROQ_API_KEY dans l'onglet Keys/API keys.",
      });
      return { ok: false, transcriptionId, engine: "unavailable", reason: "no_engine" };
    }

    await ctx.runMutation(internal.ovStudioOps.finishTranscription, {
      id: transcriptionId,
      status: "processing",
      step: "transcription",
      progress: 20,
    });

    const out = await ctx.runAction(internal.ovStudioEngine.transcribeRemote, {
      audioUrl: content.streamUrl ?? content.previewUrl!,
      language: args.language ?? content.language,
    });

    const full = out as typeof out & { text?: string; warnings?: string[] };
    await ctx.runMutation(internal.ovStudioOps.finishTranscription, {
      id: transcriptionId,
      status: out.ok ? "done" : "error",
      segments: out.segments,
      text: full.text,
      step: out.ok ? "done" : "error",
      progress: out.ok ? 100 : undefined,
      error: out.ok ? undefined : out.reason,
      engine: out.engine,
    });

    return {
      ok: out.ok,
      transcriptionId,
      engine: out.engine,
      reason: out.ok ? undefined : out.reason,
      warnings: full.warnings,
    };
  },
});

/** Traduit une transcription existante, segment par segment. */
export const translateTranscription = action({
  args: { transcriptionId: v.id("ovTranscriptions"), targetLang: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; engine: string; reason?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connexion requise pour traduire.");

    const transcription = await ctx.runQuery(internal.ovStudioOps.transcriptionById, {
      id: args.transcriptionId,
    });
    if (!transcription) throw new Error("Transcription introuvable.");
    if (transcription.userId !== userId) throw new Error("Cette transcription ne t'appartient pas.");

    const content = await ctx.runQuery(internal.ovStudioOps.contentForStudio, {
      contentKey: transcription.contentKey,
    });
    if (!content) throw new Error("Contenu introuvable.");
    if (!content.translationAllowed) {
      await ctx.runMutation(internal.ovStudioOps.logStudio, {
        level: "warn",
        scope: "studio",
        message: `Traduction refusée — ${content.title}`,
        meta: `statut ${content.rightsStatus} / licence ${content.licenseName ?? "inconnue"}`,
        userId,
      });
      throw new Error(
        "Traduction refusée : la licence de ce contenu n'autorise pas les œuvres dérivées.",
      );
    }

    const stored = transcription.segments ?? [];
    const texts: string[] = stored.length ? stored.map((s) => s.text) : [transcription.text ?? ""];
    if (!texts.join("").trim()) throw new Error("Rien à traduire : la transcription est vide.");

    const out = await ctx.runAction(internal.ovStudioEngine.translateRemote, {
      texts,
      source: transcription.language,
      target: args.targetLang,
      preferLocal: true,
    });

    const segments = texts.map((text, i) => ({
      start: stored[i]?.start ?? 0,
      end: stored[i]?.end ?? 0,
      source: text,
      text: out.translations[i] ?? text,
    }));

    await ctx.runMutation(internal.ovStudioOps.upsertTranslation, {
      userId,
      transcriptionId: args.transcriptionId,
      targetLang: args.targetLang,
      engine: out.engine,
      status: out.ok ? "done" : "error",
      segments,
      error: out.reason,
    });

    return { ok: out.ok, engine: out.engine, reason: out.reason };
  },
});

/**
 * Traduction ponctuelle : un passage d'un livre, une phrase de sous-titre.
 * Mêmes verrous que la traduction complète (authentification + droits).
 */
export const translateSnippet = action({
  args: { contentKey: v.string(), text: v.string(), targetLang: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; text: string; engine: string; reason?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connexion requise pour traduire.");
    const snippet = args.text.trim().slice(0, 900);
    if (snippet.length < 2) throw new Error("Passage trop court à traduire.");

    const content = await ctx.runQuery(internal.ovStudioOps.contentForStudio, {
      contentKey: args.contentKey,
    });
    if (content && !content.translationAllowed) {
      return {
        ok: false,
        text: snippet,
        engine: "blocked",
        reason: `Traduction refusée : la licence de « ${content.title} » n'autorise pas les œuvres dérivées.`,
      };
    }

    const out = await ctx.runAction(internal.ovStudioEngine.translateRemote, {
      texts: [snippet],
      source: content?.language,
      target: args.targetLang,
      preferLocal: true,
    });
    return {
      ok: out.ok,
      text: out.translations[0] ?? snippet,
      engine: out.engine,
      reason: out.reason,
    };
  },
});

/** État complet du studio pour un contenu. */
export const studioState = query({
  args: { contentKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { transcription: null, translations: [], subtitles: [] };
    const transcription = await ctx.db
      .query("ovTranscriptions")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
      .order("desc")
      .first();
    if (!transcription) return { transcription: null, translations: [], subtitles: [] };
    const [translations, subtitles] = await Promise.all([
      ctx.db
        .query("ovTranslations")
        .withIndex("by_transcription", (q) => q.eq("transcriptionId", transcription._id))
        .take(20),
      ctx.db
        .query("ovSubtitles")
        .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
        .take(20),
    ]);
    return { transcription, translations, subtitles };
  },
});

export const saveSubtitle = mutation({
  args: {
    contentKey: v.string(),
    format: v.union(v.literal("srt"), v.literal("vtt")),
    lang: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connexion requise.");
    if (args.body.length > 900_000) throw new Error("Sous-titres trop volumineux.");
    const existing = await ctx.db
      .query("ovSubtitles")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
      .take(20);
    const same = existing.find((s) => s.format === args.format && s.lang === args.lang);
    if (same) await ctx.db.patch(same._id, { body: args.body, createdAt: Date.now() });
    else
      await ctx.db.insert("ovSubtitles", {
        userId,
        contentKey: args.contentKey,
        format: args.format,
        lang: args.lang,
        body: args.body,
        createdAt: Date.now(),
      });
    return { ok: true as const };
  },
});

/** Toutes les transcriptions / traductions de l'utilisateur. */
export const myStudio = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const transcriptions = await ctx.db
      .query("ovTranscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(40);
    const translations = await ctx.db
      .query("ovTranslations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(60);
    return { transcriptions, translations };
  },
});
