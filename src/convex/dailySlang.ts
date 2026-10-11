import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { applyAward, dayKey } from "./gamification";
import { DAILY_XP, buildDailySlang } from "../lib/dailySlang";

/* ═══════════════════════════════════════════════════════════════════
   SLANG DU JOUR — couche serveur

   Le tirage et le QCM viennent de `lib/dailySlang.ts` (PUR, déterministe).
   Ce module n'apporte que ce qui exige le serveur :

     · la résolution de la langue (demandée → première langue active → fr) ;
     · le vivier borné (index `by_language_popularity`, 100 lignes) ;
     · la CORRECTION : la mutation recalcule la carte du jour et compare —
       le client n'envoie que son index de réponse ;
     · l'XP, créditée par `applyAward` (niveau, streak journalier, Double
       XP, decay, leaderboard) : jamais recalculée ici ;
     · l'unicité d'une réussite par jour : une ligne par (utilisateur, jour).
   ═══════════════════════════════════════════════════════════════════ */

/** Langues du catalogue d'argot — la même union que `slangExpressions.language`. */
const SLANG_LANGUAGES = [
  "fr",
  "en",
  "es",
  "zh",
  "ar",
  "ru",
  "sw",
  "ln",
  "ha",
  "yo",
  "zu",
  "wo",
] as const;

export type SlangLanguage = (typeof SLANG_LANGUAGES)[number];

/**
 * Valide une langue reçue du client (« pt-BR » → « pt » inconnu ⇒ null).
 * Un code inconnu n'est jamais transmis tel quel à l'index : il tombe sur
 * le repli par défaut.
 */
function asSlangLanguage(code: string | undefined | null): SlangLanguage | null {
  if (!code) return null;
  const base = code.toLowerCase().trim().split(/[-_]/)[0];
  return (SLANG_LANGUAGES as readonly string[]).includes(base)
    ? (base as SlangLanguage)
    : null;
}

/** Langue du jour : celle demandée, sinon la première langue active, sinon
 *  « fr » (la langue de la base seedée la plus riche). */
async function resolveLanguage(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | null,
  requested?: string,
): Promise<SlangLanguage> {
  const asked = asSlangLanguage(requested);
  if (asked) return asked;
  if (userId) {
    const rows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const active = asSlangLanguage(rows[0]?.language);
    if (active) return active;
  }
  return "fr";
}

/** Vivier du jour : les expressions les plus populaires de la langue,
 *  borné pour ne jamais balayer la table. */
async function candidatesFor(
  ctx: QueryCtx | MutationCtx,
  language: SlangLanguage,
): Promise<Doc<"slangExpressions">[]> {
  return ctx.db
    .query("slangExpressions")
    .withIndex("by_language_popularity", (q) => q.eq("language", language))
    .order("desc")
    .take(100);
}

/** Réussite déjà enregistrée aujourd'hui, ou null. */
async function progressOf(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | null,
  today: string,
) {
  if (!userId) return null;
  return ctx.db
    .query("dailySlangProgress")
    .withIndex("by_user_day", (q) =>
      q.eq("userId", userId).eq("dayKey", today),
    )
    .first();
}

const cardValidator = v.object({
  dayKey: v.string(),
  language: v.string(),
  slangId: v.id("slangExpressions"),
  expression: v.string(),
  meaning: v.string(),
  context: v.string(),
  literal: v.optional(v.string()),
  register: v.string(),
  region: v.string(),
  options: v.array(v.string()),
  answerIndex: v.number(),
});

export const getDailySlang = query({
  args: { language: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      ...cardValidator.fields,
      /** La réussite du jour est déjà enregistrée. */
      completed: v.boolean(),
      /** XP réellement créditée pour cette réussite (0 si non atteint). */
      xpGained: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const today = dayKey(Date.now());
    const language = await resolveLanguage(ctx, userId, args.language);
    const built = buildDailySlang(
      today,
      language,
      await candidatesFor(ctx, language),
    );
    // Jour sans expression exploitable : rien à afficher, jamais une carte vide.
    if (!built) return null;
    const card = { ...built, slangId: built.slangId as Id<"slangExpressions"> };
    const progress = await progressOf(ctx, userId, today);
    const done = progress?.slangId === card.slangId;
    return {
      ...card,
      completed: done,
      xpGained: done ? (progress?.xpGained ?? 0) : 0,
    };
  },
});

export const completeDailySlang = mutation({
  args: { answerIndex: v.number() },
  returns: v.object({
    ok: v.boolean(),
    correct: v.boolean(),
    xpGained: v.number(),
    currentStreak: v.number(),
    /** Réussite déjà comptée aujourd'hui : l'XP n'est pas re-créditée. */
    already: v.boolean(),
    /** Réponse hors des propositions : aucune correction possible. */
    invalid: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const today = dayKey(Date.now());
    const language = await resolveLanguage(ctx, userId, undefined);
    const card = buildDailySlang(
      today,
      language,
      await candidatesFor(ctx, language),
    );
    const noStats = async () =>
      (
        await ctx.db
          .query("userStats")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique()
      )?.currentStreak ?? 0;

    // Jour sans expression : rien à corriger, rien à créditer.
    if (!card) {
      return { ok: false, correct: false, xpGained: 0, currentStreak: 0, already: false };
    }
    if (
      !Number.isInteger(args.answerIndex) ||
      args.answerIndex < 0 ||
      args.answerIndex >= card.options.length
    ) {
      return {
        ok: false,
        correct: false,
        xpGained: 0,
        currentStreak: 0,
        already: false,
        invalid: true,
      };
    }

    const existing = await progressOf(ctx, userId, today);
    // Une seule réponse comptée par jour : rejouer ne paie pas deux fois.
    if (existing) {
      return {
        ok: true,
        correct: existing.correct,
        xpGained: 0,
        currentStreak: await noStats(),
        already: true,
      };
    }

    const correct = card.options[args.answerIndex] === card.meaning;
    await ctx.db.insert("dailySlangProgress", {
      userId,
      dayKey: today,
      slangId: card.slangId as Id<"slangExpressions">,
      correct,
      xpGained: 0,
      completedAt: Date.now(),
    });
    if (!correct) {
      return {
        ok: true,
        correct: false,
        xpGained: 0,
        currentStreak: await noStats(),
        already: false,
      };
    }

    // Le cœur de gamification crédite l'XP (Double XP, decay, niveau,
    // streak journalier, leaderboard) — jamais recalculée ici.
    const award = await applyAward(ctx, userId, DAILY_XP, "daily_slang");
    const row = await progressOf(ctx, userId, today);
    if (row) await ctx.db.patch(row._id, { xpGained: award.xpGained });
    return {
      ok: true,
      correct: true,
      xpGained: award.xpGained,
      currentStreak: award.currentStreak,
      already: false,
    };
  },
});
