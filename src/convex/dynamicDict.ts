import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

type RunCtx = GenericActionCtx<DataModel>;

/** Champs publics d'une ligne slangExpressions (cf. slang.searchLocal). */
type BaseEntry = {
  _id: string;
  language: string;
  expression: string;
  literal?: string;
  meaning: string;
  context: string;
  register: string;
  region: string;
  popularity: number;
  mediaRefs?: string[];
  meaningLang?: string;
};

/* ═══════════════════════════════════════════════════════════════════════
   DICTIONNAIRE DYNAMIQUE v3 — résolution d'un terme pour la recherche
   universelle, par étages :
     1. base locale (slang.searchLocal, exact)       → origin "base"
     2. Urban Dictionary (mot anglais isolé)         → origin "urban"
     3. cascade de traduction (translateRemote)      → origin "translated"

   CONTRAT UX (lot v2) : le contenu renvoyé est TOUJOURS dans la langue
   cible quand la cascade y parvient :
     - content      : définition traduite dans targetLang
     - contentSrc   : définition originale (italique gris en repli)
     - example      : VRAIE phrase de contexte (context seedé, exemple UD)
     - exampleTr    : phrase traduite dans targetLang (affichée en or)
     - meaningLang  : langue du sens source ("en" pour UD, "fr" base)
   Cache 24 h par (texte + cible) pour base/translated — JAMAIS pour
   origin "urban" (définitions vivantes). Aucun étage ne crash.
   ═══════════════════════════════════════════════════════════════════════ */

export const lookupDynamic = action({
  args: {
    text: v.string(),
    targetLang: v.string(), // code UI 2 lettres (fr, en, es, …)
  },
  handler: async (ctx, args) => {
    const text = args.text.trim().slice(0, 200);
    const targetLang = args.targetLang.trim().slice(0, 5) || "fr";
    if (!text) {
      return { origin: "empty", content: "", contentSrc: undefined, example: undefined, exampleTr: undefined, meaningLang: undefined };
    }
    // v4 : invalide les caches antérieurs (entrées « yet » avec placeholder
    // d'exemple avant le filtre looksLikeSentence côté serveur).
    const cacheKey = `dyndict:v4:${text.toLowerCase()}|${targetLang}`;

    // 1) Cache 24 h — hit ⇒ réponse immédiate, zéro appel externe.
    try {
      const cached = await ctx.runQuery(internal.lyricsCache.cacheGetLyrics, { cacheKey });
      if (cached) {
        const parsed = JSON.parse(cached) as { origin: string; content: string } | null;
        if (parsed && typeof parsed.origin === "string" && typeof parsed.content === "string") {
          return parsed as LookupResult;
        }
      }
    } catch {
      // Cache indisponible : on continue vers les étages.
    }

    const result = await resolve(ctx, text, targetLang);

    // Écriture de cache best-effort (24 h) — sauf origin "urban" : les
    // définitions UD sont vivantes, on les réévalue à chaque recherche.
    if (result.origin !== "urban") {
      try {
        await ctx.runMutation(internal.lyricsCache.cachePutLyrics, {
          cacheKey,
          payload: [JSON.stringify(result)],
        });
      } catch {
        // Écriture de cache best-effort.
      }
    }
    return result;
  },
  returns: v.object({
    origin: v.string(),
    content: v.string(),
    contentSrc: v.optional(v.string()),
    example: v.optional(v.string()),
    exampleTr: v.optional(v.string()),
    meaningLang: v.optional(v.string()),
  }),
});

export type LookupResult = {
  origin: string;
  content: string;
  contentSrc?: string;
  example?: string;
  exampleTr?: string;
  meaningLang?: string;
};

/** Stocke l'exemple UD récupéré dans context (une seule fois, idempotent). */
export const storeExampleInternal = internalMutation({
  args: { entryId: v.id("slangExpressions"), example: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return;
    // Ne touche pas à une vraie phrase déjà stockée.
    const current = entry.context.trim();
    if (current.length >= 12 && /\s/.test(current) && !/^Importé depuis/.test(current)) return;
    await ctx.db.patch(args.entryId, { context: args.example });
  },
});

/* ── Cascade de traduction (wrapper translateRemote EXISTANT) ──────── */

async function translateOne(
  ctx: RunCtx,
  text: string,
  target: string,
): Promise<string | null> {
  try {
    const res = await ctx.runAction(internal.ovStudioEngine.translateRemote, {
      texts: [text],
      target,
      preferLocal: false, // Groq d'abord : meilleur rendu d'argot
    });
    const out = res.translations?.[0]?.trim();
    return res.ok && out ? out : null;
  } catch (err) {
    console.warn("[dynamicDict] translateRemote échec:", err);
    return null;
  }
}

/** Une phrase a-t-elle l'air réelle (pas un libellé type « Importé… ») ? */
function looksLikeSentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 12) return false;
  if (/^Importé depuis/i.test(t)) return false; // placeholder d'import
  return /\s/.test(t) || t.length > 25;
}

/* ── Étage 1 : base locale (recherche exacte de l'expression) ──────── */

async function tryLocal(
  ctx: RunCtx,
  text: string,
  targetLang: string,
): Promise<LookupResult | null> {
  try {
    const hits = (await ctx.runQuery(api.slang.searchLocal, {
      query: text,
      exact: true,
      limit: 1,
    })) as BaseEntry[];
    const first = hits[0];
    if (!first) return null;

    // Langue du sens : meaningLang explicite, sinon la base seedée est FR.
    const meaningLang = first.meaningLang ?? "fr";
    // Phrase de contexte : uniquement si c'en est une vraie (jamais un
    // libellé d'import).
    let example = looksLikeSentence(first.context) ? first.context.trim() : undefined;

    // b) Entrée importée d'UD sans exemple réel stocké : re-fetch du
    //    connecteur (cache 24 h) puis PATCH du context — les recherches
    //    suivantes affichent directement la vraie phrase.
    if (!example && meaningLang === "en" && first.register === "internet") {
      try {
        const hit = await ctx.runAction(api.connectors.urbanDictionary.searchUrban, {
          word: first.expression,
        });
        const ex = hit?.example?.trim();
        if (ex && looksLikeSentence(ex)) {
          example = ex;
          await ctx.runMutation(internal.dynamicDict.storeExampleInternal, {
            entryId: first._id as never,
            example: ex.slice(0, 600),
          });
        }
      } catch {
        // Re-fetch best-effort : sans exemple, la section est masquée.
      }
    }

    if (meaningLang === targetLang) {
      return { origin: "base", content: first.meaning, example, meaningLang };
    }
    const translated = await translateOne(ctx, first.meaning, targetLang);
    if (translated) {
      let exampleTr: string | undefined;
      if (example) {
        const tr = await translateOne(ctx, example, targetLang);
        if (tr) exampleTr = tr;
      }
      return {
        origin: "base",
        content: translated,
        contentSrc: first.meaning,
        example,
        exampleTr,
        meaningLang,
      };
    }
    // Échec cascade : sens original + drapeau langue pour le repli UI.
    return { origin: "base", content: first.meaning, example, meaningLang };
  } catch (err) {
    console.warn("[dynamicDict] searchLocal échec:", err);
    return null;
  }
}

/* ── Étage 2 : Urban Dictionary (texte anglais uniquement) ─────────── */

function isLikelyEnglish(text: string): boolean {
  // Heuristique écrite : 2+ lettres ASCII latin → considéré anglais
  // (la base locale et les langues non latines sont déjà épuisées).
  const letters = text.match(/[a-zA-Z]/g)?.length ?? 0;
  return letters >= 2;
}

async function tryUrban(
  ctx: RunCtx,
  text: string,
  targetLang: string,
): Promise<LookupResult | null> {
  try {
    const hit = await ctx.runAction(api.connectors.urbanDictionary.searchUrban, {
      word: text,
    });
    if (!hit || !hit.definition.trim()) return null;
    const example = hit.example.trim() || undefined;
    // UD répond en anglais : traduction du sens ET de l'exemple vers la cible.
    const [contentTr, exampleTrRaw] = await Promise.all([
      targetLang !== "en"
        ? translateOne(ctx, hit.definition, targetLang)
        : Promise.resolve<string | null>(hit.definition.trim()),
      example && targetLang !== "en"
        ? translateOne(ctx, example, targetLang)
        : Promise.resolve<string | null>(null),
    ]);
    const exampleTr: string | undefined = exampleTrRaw ?? undefined;
    return {
      origin: "urban",
      content: contentTr ?? hit.definition.trim(),
      contentSrc: contentTr ? hit.definition.trim() : undefined,
      example,
      exampleTr,
      meaningLang: "en",
    };
  } catch (err) {
    console.warn("[dynamicDict] searchUrban échec:", err);
    return null;
  }
}

/* ── Étage 3 : cascade de traduction directe ───────────────────────── */

async function tryTranslate(
  ctx: RunCtx,
  text: string,
  targetLang: string,
): Promise<LookupResult | null> {
  const translation = await translateOne(ctx, text, targetLang);
  if (translation) return { origin: "translated", content: translation, meaningLang: undefined };
  return null;
}

async function resolve(ctx: RunCtx, text: string, targetLang: string): Promise<LookupResult> {
  // 1) Base locale d'abord — hit ⇒ réponse immédiate, sens déjà dans la
  //    cible quand la cascade couvre.
  const local = await tryLocal(ctx, text, targetLang);
  if (local) return local;

  // 2) MOT SEUL anglais : Urban Dictionary avant la traduction — la
  //    définition crowd-sourcée vaut mieux qu'une traduction littérale de
  //    l'argot, et l'exemple UD fournit la phrase de contexte réelle.
  const words = text.split(/\s+/).filter(Boolean);
  const singleWord = words.length === 1;
  if (isLikelyEnglish(text) && singleWord) {
    const urban = await tryUrban(ctx, text, targetLang);
    if (urban) return urban;
  }

  // 3) Cascade de traduction existante (aucune duplication).
  const translated = await tryTranslate(ctx, text, targetLang);
  if (translated) return translated;

  return { origin: "none", content: "" };
}
