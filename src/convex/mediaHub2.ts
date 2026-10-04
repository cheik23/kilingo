"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { runSharedPipeline, transcribeAudio } from "./youtubePipeline";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

/** Bornes de sécurité sur un transcript poussé par le client (§14). */
const MAX_CLIENT_SEGMENTS = 5_000;
const MAX_CLIENT_CHARS = 400_000;

/* ── (e) Transcription d'un audio distant → pipeline complet ─────── */

type TranscribeResult = { mediaId: Id<"userMedia"> };

export const transcribeRemoteAudio = action({
  args: {
    url: v.string(),
    title: v.string(),
    language: v.union(
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
    ),
    targetLanguage: v.optional(
      v.union(
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
        v.literal("fr"),
      ),
    ),
  },
  handler: async (ctx, args): Promise<TranscribeResult> => {
    // 1. Taille : au-delà de 25 Mo, le moteur refuse la requête directe —
    // découpage en jobs (mediaJobs).
    const size = await fetch(args.url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8_000),
    })
      .then((r) => Number(r.headers.get("content-length") ?? "0"))
      .catch(() => 0);
    if (size > 25 * 1024 * 1024) {
      throw new Error(
        "Épisode trop long pour la transcription automatique (max 25 Mo). Uploade un extrait via le bouton Upload.",
      );
    }

    // 2. Téléchargement du fichier.
    const audioRes = await fetch(args.url, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!audioRes.ok) {
      throw new Error("Fichier audio injoignable. Essaie un autre épisode.");
    }
    const buf = Buffer.from(await audioRes.arrayBuffer());
    if (buf.length === 0) {
      throw new Error("Fichier audio vide. Essaie un autre épisode.");
    }

    // 3. Transcription (faster-whisper local → Groq en repli, timestamps réels).
    const { text, segments, lang } = await transcribeAudio(buf, "episode.webm");

    // 4. userMedia + pipeline partagé (traduction → argot → DB).
    const mediaId = await ctx.runMutation(api.media.createHubMedia, {
      language: args.language,
      title: args.title,
      sourceName: args.url,
      mediaType: "talk",
      targetLanguage: args.targetLanguage,
    });
    await runSharedPipeline(ctx, {
      mediaId,
      language: args.language,
      targetLanguage: args.targetLanguage,
      sourceLangOverride: lang,
      text,
      segments,
      transcriptSource: "remote_audio",
    });
    return { mediaId };
  },
  returns: v.object({ mediaId: v.id("userMedia") }),
});

/** Ajoute des segments de sous-titres à un média du Hub (lyrics, .srt/.vtt…). */
export const analyzeHubSegments = action({
  args: {
    mediaId: v.id("userMedia"),
    language: v.union(
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
    ),
    targetLanguage: v.optional(
      v.union(
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
        v.literal("fr"),
      ),
    ),
    /** Langue RÉELLE du fichier importé quand elle diffère de la langue
        d'apprentissage : un .srt anglais pendant qu'on apprend le yoruba
        doit être traduit en → cible, pas yo → cible. Absent = la langue
        d'apprentissage est utilisée (comportement historique). */
    sourceLanguage: v.optional(
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
    segments: v.array(
      v.object({ start: v.number(), end: v.number(), text: v.string() }),
    ),
    transcriptSource: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const ordered = [...args.segments].sort((a, b) => a.start - b.start);
    const text = ordered.map((s) => s.text.trim()).join(" ");
    await runSharedPipeline(ctx, {
      mediaId: args.mediaId,
      language: args.language,
      targetLanguage: args.targetLanguage,
      sourceLangOverride: args.sourceLanguage,
      text,
      segments: ordered.map((s, i) => ({ id: i, ...s })),
      transcriptSource: args.transcriptSource,
    });
    return { ok: true };
  },
  returns: v.object({ ok: v.literal(true) }),
});

/* ── (f) Transcript produit par le moteur LOCAL DU DÉPLOIEMENT ──────

   Le déploiement Freebuff ne peut pas héberger de processus Python /
   whisper.cpp, et un « localhost » configuré dans Convex désigne le
   loopback du runtime Convex (prouvé). L'ASR tourne donc dans le
   navigateur de l'utilisateur — Whisper ONNX (`src/lib/localEngines.ts`),
   mots horodatés réels — et pousse ici son résultat. Tout l'aval (fusion
   des sous-titres, argot, karaoké, Memory) reste le pipeline existant :
   aucun second pipeline parallèle. */

export const ingestLocalTranscript = action({
  args: {
    mediaId: v.id("userMedia"),
    language: v.union(
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
    ),
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
    /** Identifiant du moteur : « browser_whisper_local » (jamais groq). */
    transcriptSource: v.string(),
    text: v.string(),
    durationSeconds: v.optional(v.number()),
    /** Langue réellement détectée par le moteur (hint ASR). */
    detectedLanguage: v.optional(v.string()),
    segments: v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        text: v.string(),
        /** Word timestamps RÉELS du moteur ASR (karaoké mot par mot). */
        words: v.optional(
          v.array(
            v.object({
              word: v.string(),
              start: v.number(),
              end: v.number(),
              probability: v.optional(v.number()),
            }),
          ),
        ),
      }),
    ),
    /** Traductions locales (OPUS-MT) — évite toute requête distante. */
    translations: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Non authentifié");
    // Propriété du média : un client ne peut pas écrire dans le média d'autrui.
    const media = await ctx.runQuery(internal.media.getMediaInternal, {
      mediaId: args.mediaId,
    });
    if (media.userId !== userId) throw new Error("Média introuvable");

    if (args.segments.length === 0) {
      throw new Error("INVALID_AUDIO — aucun segment transcrit");
    }
    if (args.segments.length > MAX_CLIENT_SEGMENTS) {
      throw new Error(
        `Transcript trop volumineux (max ${MAX_CLIENT_SEGMENTS} segments).`,
      );
    }
    const totalChars = args.segments.reduce((n, s) => n + s.text.length, 0);
    if (totalChars > MAX_CLIENT_CHARS) {
      throw new Error("Transcript trop long (max 400 000 caractères).");
    }

    // Nettoyage : segments ordonnés, timestamps finis et cohérents, mots
    // attachés au segment qui les contient. Rien n'est inventé ici.
    const ordered = [...args.segments]
      .filter(
        (s) =>
          Number.isFinite(s.start) &&
          Number.isFinite(s.end) &&
          s.end >= s.start &&
          s.text.trim().length > 0,
      )
      .sort((a, b) => a.start - b.start);
    const segments = ordered.map((s, i) => {
      const words = (s.words ?? []).filter(
        (w) =>
          w.word.trim().length > 0 &&
          Number.isFinite(w.start) &&
          Number.isFinite(w.end) &&
          w.end >= w.start,
      );
      return {
        id: i,
        start: s.start,
        end: s.end,
        text: s.text.trim(),
        ...(words.length > 0 ? { words } : {}),
      };
    });
    if (segments.length === 0) {
      throw new Error("INVALID_AUDIO — segments illisibles après validation");
    }

    await runSharedPipeline(ctx, {
      mediaId: args.mediaId,
      language: args.language,
      targetLanguage: args.targetLanguage,
      sourceLangOverride: args.detectedLanguage,
      text: args.text.trim() || segments.map((s) => s.text).join(" "),
      segments,
      duration: args.durationSeconds,
      transcriptSource: args.transcriptSource,
      translations: args.translations,
    });
    console.log(
      `[shadow] transcript local ingéré — ${segments.length} segments, ${segments.reduce((n, s) => n + (s.words?.length ?? 0), 0)} mots horodatés (${args.transcriptSource})`,
    );
    return { ok: true };
  },
  returns: v.object({ ok: v.literal(true) }),
});
