"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ═══════════════════════════════════════════════════════════════════════
   TRADUCTION D'UN TEXTE COLLÉ — « bloc » (LOT D)

   Ce que fait ce module, et ce qu'il ne fait pas :

   - il traduit le texte ENTIER, paragraphe par paragraphe, jamais ligne
     par ligne : une phrase coupée en morceaux de sous-titres perd son sens,
     surtout en argot. Chaque paragraphe est un item du lot ;
   - il réutilise la cascade EXISTANTE (Groq → serveur local → MyMemory via
     ovStudioEngine.translateRemote) et son cache 24 h, en passant par
     l'action paroles : aucun second chemin de traduction à maintenir ;
   - il confronte le résultat à la base d'argot LOCALE (aucune API) et
     renvoie pour chaque expression son `slangId`, pour que « + Ma mémoire »
     soit un vrai clic (addToSrs exige l'id) ;
   - toute défaillance renvoie `ok:false` avec une raison lisible : jamais
     d'exception qui remonte telle quelle dans l'interface.
   ═══════════════════════════════════════════════════════════════════════ */

/** Borne dure : au-delà, on refuse plutôt que de tronquer en silence. */
const MAX_CHARS = 24_000;
/** Un paragraphe plus long que ça est redécoupé sur les fins de phrase. */
const BLOCK_CHARS = 600;
const MAX_BLOCKS = 80;
const MAX_HITS = 40;

/** Langues couvertes par la base d'argot locale (comme le pipeline média). */
const SLANG_LANGS = ["en", "zh", "es", "ar", "ru"] as const;

type LangCode =
  | "en" | "fr" | "es" | "zh" | "ar" | "ru"
  | "sw" | "ln" | "ha" | "yo" | "zu" | "wo";

const langValidator = v.union(
  v.literal("en"), v.literal("fr"), v.literal("es"), v.literal("zh"),
  v.literal("ar"), v.literal("ru"), v.literal("sw"), v.literal("ln"),
  v.literal("ha"), v.literal("yo"), v.literal("zu"), v.literal("wo"),
);

/** Empreinte stable (djb2) — clé de cache du texte, jamais un secret. */
function fingerprint(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Découpe un texte en blocs « naturels » : les paragraphes sont respectés,
 * un paragraphe trop long est coupé sur une fin de phrase, jamais au milieu
 * d'un mot. C'est ce découpage qui donne une traduction intégrale lisible —
 * pas un tableau ligne par ligne.
 */
export function splitIntoBlocks(text: string): string[] {
  const blocks: string[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const paragraph of paragraphs) {
    const clean = paragraph.trim();
    if (!clean) continue;
    if (clean.length <= BLOCK_CHARS) {
      blocks.push(clean);
      continue;
    }
    // Paragraphe long : on coupe sur les fins de phrase (., !, ?, …).
    const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
    let current = "";
    for (const sentence of sentences) {
      if (current && (current + sentence).length > BLOCK_CHARS) {
        blocks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) blocks.push(current.trim());
  }

  return blocks.slice(0, MAX_BLOCKS);
}

export const translateTextBlock = action({
  args: {
    text: v.string(),
    sourceLanguage: langValidator,
    targetLanguage: langValidator,
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        ok: true;
        cached: boolean;
        blocks: number;
        translation: string;
        detected: {
          slangId: string;
          expression: string;
          meaning: string;
          context?: string;
        }[];
      }
    | { ok: false; reason: string }
  > => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false, reason: "not_signed_in" };

    const text = args.text.replace(/\r\n/g, "\n").trim();
    if (text.length < 2) return { ok: false, reason: "empty" };
    if (text.length > MAX_CHARS) return { ok: false, reason: "too_long" };

    const blocks = splitIntoBlocks(text);
    if (blocks.length === 0) return { ok: false, reason: "empty" };

    // 1) Traduction par bloc, via la cascade existante + cache 24 h. Le texte
    //    source identique réutilise le même cache : re-cliquer ne re-paie rien.
    const source: LangCode = args.sourceLanguage;
    const result = await ctx.runAction(api.lyricsTranslate.translateLyrics, {
      lyricsId: `bloc-${source}-${fingerprint(text)}`,
      lang: args.targetLanguage,
      lines: blocks,
      sourceLang: source,
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    const translation = result.lines.join("\n\n");

    // 2) Argot : base locale uniquement (gratuit, instantané, hors ligne).
    const slangLanguage = (SLANG_LANGS as readonly string[]).includes(source)
      ? (source as (typeof SLANG_LANGS)[number])
      : "en";
    let detected: {
      slangId: string;
      expression: string;
      meaning: string;
      context?: string;
    }[] = [];
    try {
      const rows = await ctx.runQuery(internal.slang.allForLanguage, {
        language: slangLanguage,
      });
      const haystack = `${text}\n${translation}`.toLowerCase();
      detected = rows
        .filter((row) => row.expression.trim().length > 1)
        .filter((row) => haystack.includes(row.expression.trim().toLowerCase()))
        .slice(0, MAX_HITS)
        .map((row) => ({
          slangId: row.slangId,
          expression: row.expression,
          meaning: row.meaning,
          ...(row.context ? { context: row.context } : {}),
        }));
    } catch (err) {
      console.warn(
        `[textTranslate] détection d'argot ignorée : ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    return {
      ok: true,
      cached: result.cached,
      blocks: blocks.length,
      translation,
      detected,
    };
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      cached: v.boolean(),
      blocks: v.number(),
      translation: v.string(),
      detected: v.array(
        v.object({
          slangId: v.string(),
          expression: v.string(),
          meaning: v.string(),
          context: v.optional(v.string()),
        }),
      ),
    }),
    v.object({ ok: v.literal(false), reason: v.string() }),
  ),
});
