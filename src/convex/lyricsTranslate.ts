"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/* ═══════════════════════════════════════════════════════════════════════
   TRADUCTION DE PAROLES — onglet « Paroles » de la MediaRoom.

   Réutilise la cascade de traduction EXISTANTE (ovStudioEngine.translateRemote
   → connectors/groqTranslate : Groq → serveur local → MyMemory), aucun
   connecteur ni pipeline modifié. Cache 24 h dans ovSourceCache, clé
   « lyrics-tr:{lyricsId}:{lang} » — un morceau + une langue UI = 1 appel.
   Toute défaillance renvoie ok:false (le toggle UI se désactive), jamais
   d'exception.
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Traduit les lignes de paroles dans la langue UI courante.
 * `lyricsId` : identité stable du titre (URL officielle ou artiste+titre)
 * pour la clé de cache. `lines` : texte nu des lignes, dans l'ordre —
 * la réponse conserve strictement le même ordre.
 */
export const translateLyrics = action({
  args: {
    lyricsId: v.string(),
    lang: v.string(),
    lines: v.array(v.string()),
    sourceLang: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; cached: boolean; lines: string[] }
    | { ok: false; reason: string }
  > => {
    const key = `lyrics-tr:${args.lyricsId.slice(0, 180)}:${args.lang}`;

    // 1) Cache 24 h — le même titre ne re-traduit jamais deux fois.
    try {
      const cached = await ctx.runQuery(internal.lyricsCache.cacheGetLyrics, {
        cacheKey: key,
      });
      if (cached) {
        const parsed = JSON.parse(cached) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.length === args.lines.length &&
          parsed.every((l) => typeof l === "string")
        ) {
          return { ok: true, cached: true, lines: parsed as string[] };
        }
      }
    } catch {
      /* cache illisible → on re-traduit simplement */
    }

    // 2) Cascade existante : Groq → local → MyMemory (preferLocal:false).
    const texts = args.lines.map((l) => l.slice(0, 900));
    if (!texts.some((t) => t.trim())) {
      return { ok: false, reason: "empty" };
    }
    const out = await ctx.runAction(internal.ovStudioEngine.translateRemote, {
      texts,
      source: args.sourceLang,
      target: args.lang,
      preferLocal: false,
    });
    if (!out.ok) {
      return { ok: false, reason: out.reason ?? out.engine };
    }

    // 3) Mise en cache — un échec d'écriture n'invalide pas la réponse.
    try {
      await ctx.runMutation(internal.lyricsCache.cachePutLyrics, {
        cacheKey: key,
        payload: [JSON.stringify(out.translations)],
      });
    } catch {
      /* best-effort */
    }
    return { ok: true, cached: false, lines: out.translations };
  },
});
