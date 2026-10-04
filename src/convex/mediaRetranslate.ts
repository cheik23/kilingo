"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { runSharedPipeline } from "./youtubePipeline";

/* ═══════════════════════════════════════════════════════════════════════
   RE-TRADUCTION — le sélecteur « TRADUIRE VERS » change la cible en cours
   de session. Le transcript est déjà stocké : on re-traduit SANS re-
   transcrire, puis runSharedPipeline réécrit sous-titres + argot dans le
   média (le client est abonné à getMediaStatus — mise à jour réactive).
   Aucune nouvelle cascade : la cascade existante est réutilisée telle
   quelle (Groq couvre les 12 langues UI ; MyMemory peut couvrir moins —
   échec total ⇒ repli italique gris du texte original côté UI, jamais de
   crash : translationFailed=true).
   ═══════════════════════════════════════════════════════════════════════ */

export const retranslateMedia = action({
  args: {
    mediaId: v.id("userMedia"),
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const media = await ctx.runQuery(internal.media.getMediaInternal, {
      mediaId: args.mediaId,
    });
    if (media.userId !== userId) throw new Error("Média introuvable");

    const segments = (media.subtitles ?? []).map((s) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.originalText,
      ...(s.words && s.words.length > 0 ? { words: s.words } : {}),
    }));
    if (segments.length === 0) {
      return { ok: false as const, reason: "no_subtitles" as const };
    }

    // sourceLangOverride n'est pas stocké en base : la langue déclarée du
    // média est la meilleure approximation disponible côté re-traduction.
    const sourceLang = media.language;
    await runSharedPipeline(ctx, {
      mediaId: args.mediaId,
      language: media.language,
      targetLanguage: args.targetLanguage,
      sourceLangOverride: sourceLang,
      text: media.transcription ?? "",
      segments,
      duration: media.durationSeconds ?? undefined,
      transcriptSource: media.transcriptSource ?? "retranslate",
    });
    return { ok: true as const };
  },
});
