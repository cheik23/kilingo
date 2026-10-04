import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { recordAchievementMetric } from "./achievementProgress";
import {
  addGemsInternal,
  applyAward,
  applyBadgeGems,
  grantLootBox,
  insertQuizHistory,
  levelFromTotalXp,
} from "./gamification";

/* ═══════════════════════════════════════════════════════════════════
   GÉNÉRATEUR DE QUIZ (Phase 2/4) — QCM · Fill-in-the-blank · Reverse

   Anti-triche sans crypto : chaque question a deux faces.
   - Face publique : { id, type, prompt, hint, options[], example,
     expression, meaning } — sans correctIndex.
   - Face serveur  : + correctIndex, stockée dans quizSessions.

   Le client répond { questionId, choice } ; submitQuiz relit la session
   (propriété userId) et corrige côté serveur.
   XP : 10 / bonne réponse + 20 bonus 100 % (« Perfectionniste »).
   Bonus « Rapide » : quiz fini en < 30 s (+30 XP, badge).
   Badges auto dans la même transaction : perfectionniste, rapide,
   streak7, level10. Contexte "recent" : priorité aux cartes SRS vues
   récemment, complétées par tirage aléatoire dans la base.
   Leurres : mêmes-champs (meanings pour QCM, expressions pour
   fill/reverse) d'AUTRES expressions DE LA MÊME LANGUE.
   ═══════════════════════════════════════════════════════════════════ */

const languageValidator = v.union(
  v.literal("en"), v.literal("zh"), v.literal("es"), v.literal("ar"), v.literal("ru"),
  v.literal("sw"), v.literal("ln"), v.literal("ha"), v.literal("yo"), v.literal("zu"), v.literal("wo"),
);

type SlangDoc = {
  _id: Id<"slangExpressions">;
  language: string;
  expression: string;
  meaning: string;
  example?: string;
  register: string;
};

const LANG_NAMES: Record<string, string> = {
  en: "anglais",
  zh: "mandarin",
  es: "espagnol",
  ar: "arabe",
  ru: "russe",
  sw: "swahili",
  ln: "lingala",
  ha: "haoussa",
  yo: "yoruba",
  zu: "zoulou",
  wo: "wolof",
};

/** Mélange Fisher-Yates. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function blankExample(example: string, expression: string): string {
  const lower = example.toLowerCase();
  const expr = expression.toLowerCase();
  const idx = lower.indexOf(expr);
  if (idx === -1) return example.replace(expression, "___");
  return example.slice(0, idx) + "___" + example.slice(idx + expression.length);
}

/** Regroupe les types : count/3 par type, le reste en QCM. */
function plannedTypes(count: number): ("mcq" | "fill" | "reverse")[] {
  const perType = Math.floor(count / 3);
  const rest = count - perType * 3;
  return [
    ...Array.from({ length: perType }, () => "mcq" as const),
    ...Array.from({ length: perType }, () => "fill" as const),
    ...Array.from({ length: perType }, () => "reverse" as const),
    ...Array.from({ length: rest }, () => "mcq" as const),
  ];
}

/** 3 leurres uniques dans le pool (hors cible), par champ choisi. */
function pickLeathers(
  pool: SlangDoc[],
  targetId: string,
  field: "meaning" | "expression",
): string[] {
  const out: string[] = [];
  for (const doc of shuffle(pool.filter((d) => d._id !== targetId))) {
    const value = doc[field];
    if (value && !out.includes(value)) out.push(value);
    if (out.length === 3) break;
  }
  return out;
}

/* ── 2.1 Génération ────────────────────────────────────────────────── */

export const generateQuiz = mutation({
  args: {
    language: languageValidator,
    count: v.optional(v.number()),
    context: v.optional(v.union(v.literal("recent"), v.literal("random"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const count = Math.max(3, Math.min(12, Math.round(args.count ?? 5)));
    const lang = args.language;

    // 1. Pool de la langue (plafonné pour le quota de lecture Convex).
    const pool = (
      await ctx.db
        .query("slangExpressions")
        .withIndex("by_language", (q) => q.eq("language", lang))
        .take(80)
    ).filter((s) => s.expression.length > 0 && s.meaning.length > 0);
    if (pool.length < 4) {
      throw new Error(
        `Pas assez d'expressions en base pour cette langue (${pool.length} disponibles, 4 minimum).`,
      );
    }

    // 2. Cartes SRS vues récemment (contexte "recent", utilisateur connecté).
    const recentSlangIds: Id<"slangExpressions">[] = [];
    if (args.context === "recent" && userId !== null) {
      const cards = await ctx.db
        .query("srsCards")
        .withIndex("by_user_language", (q) => q.eq("userId", userId).eq("language", lang))
        .collect();
      cards.sort((a, b) => (b.lastReview ?? b.createdAt) - (a.lastReview ?? a.createdAt));
      for (const c of cards.slice(0, 15)) recentSlangIds.push(c.slangId);
    }

    // 3. Sélection : récents d'abord (s'ils sont dans le pool), complétés.
    const byId = new Map(pool.map((p) => [p._id, p]));
    const chosen: SlangDoc[] = [];
    const used = new Set<string>();
    for (const id of shuffle(recentSlangIds)) {
      const doc = byId.get(id);
      if (doc && chosen.length < count && !used.has(id)) {
        chosen.push(doc);
        used.add(id);
      }
    }
    for (const doc of shuffle(pool.filter((p) => !used.has(p._id)))) {
      if (chosen.length >= count) break;
      chosen.push(doc);
      used.add(doc._id);
    }

    // 4. Types en alternance (count/3 chacun, reste en QCM).
    //    Le fill exige un example contenant l'expression : sans exemple,
    //    la question retombe en QCM.
    const types = plannedTypes(count);

    type PublicQuestion = {
      id: string;
      type: "mcq" | "fill" | "reverse";
      prompt: string;
      hint?: string;
      options: string[];
      example?: string;
      expression: string;
      meaning: string;
    };
    type StoredQuestion = PublicQuestion & { correctIndex: number };

    const publicQuestions: PublicQuestion[] = [];
    const storedQuestions: StoredQuestion[] = [];

    chosen.forEach((target, i) => {
      const requested = types[i];
      const type =
        requested === "fill" && !target.example ? ("mcq" as const) : requested;
      let prompt: string;
      let options: string[];
      let example: string | undefined;

      if (type === "fill") {
        // Le trou attend l'EXPRESSION — leurres = expressions de la langue.
        // (type "fill" garantit example défini : downgrade en mcq sinon.)
        prompt = `Complète : « ${blankExample(target.example!, target.expression)} »`;
        options = shuffle([
          target.expression,
          ...pickLeathers(pool, target._id, "expression"),
        ]);
        example = target.example;
      } else if (type === "reverse") {
        // Sens FR → langue : options = expressions.
        prompt = `Comment dit-on « ${target.meaning} » en ${LANG_NAMES[lang] ?? lang} ?`;
        options = shuffle([
          target.expression,
          ...pickLeathers(pool, target._id, "expression"),
        ]);
      } else {
        // QCM : « Que signifie [expression] ? » — leurres = meanings.
        prompt = `Que signifie « ${target.expression} » ?`;
        options = shuffle([target.meaning, ...pickLeathers(pool, target._id, "meaning")]);
      }

      const correctIndex = options.indexOf(
        type === "mcq" ? target.meaning : target.expression,
      );
      const question: PublicQuestion = {
        id: `q${i}`,
        type,
        prompt,
        hint: target.register,
        options,
        example,
        expression: target.expression,
        meaning: target.meaning,
      };
      publicQuestions.push(question);
      storedQuestions.push({ ...question, correctIndex });
    });

    const sessionId = await ctx.db.insert("quizSessions", {
      userId: userId ?? undefined,
      language: lang,
      questions: storedQuestions,
      createdAt: Date.now(),
      completed: false,
    });

    return {
      sessionId,
      questions: publicQuestions,
      totalQuestions: publicQuestions.length,
    };
  },
});

/* ── 2.2 Soumission + feedback ─────────────────────────────────────── */

/**
 * Révèle la bonne réponse d'UNE question après choix du client.
 * Le serveur reste la source de vérité (correctIndex jamais exposé avant
 * la réponse) ; le score final reste calculé par submitQuiz.
 */
export const revealAnswer = mutation({
  args: { sessionId: v.id("quizSessions"), questionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Session introuvable");
    const q = session.questions.find((x) => x.id === args.questionId);
    if (!q) throw new Error("Question introuvable");
    return { correctIndex: q.correctIndex, options: q.options };
  },
  returns: v.object({
    correctIndex: v.number(),
    options: v.array(v.string()),
  }),
});

export const submitQuiz = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    answers: v.array(v.object({ questionId: v.string(), choice: v.number() })),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Session introuvable");
    if (session.completed) throw new Error("Session déjà soumise");

    const answerMap = new Map(args.answers.map((a) => [a.questionId, a.choice]));
    let correctCount = 0;
    const wrong: {
      expression: string;
      meaning: string;
      example?: string;
      correctOption: string;
    }[] = [];
    const questionTypes: string[] = [];

    for (const q of session.questions) {
      questionTypes.push(q.type);
      const choice = answerMap.get(q.id);
      if (choice === q.correctIndex) {
        correctCount += 1;
      } else {
        wrong.push({
          expression: q.expression,
          meaning: q.meaning,
          example: q.example,
          correctOption: q.options[q.correctIndex] ?? q.meaning,
        });
      }
    }

    const total = session.questions.length;
    const score = Math.round((correctCount / total) * 100);
    const perfect = correctCount === total && total > 0;
    const xpEarned =
      correctCount * 10 +
      (perfect ? 20 : 0) +
      ((args.durationMs ?? Infinity) < 30_000 ? 30 : 0);

    // XP + niveau + streak (crée la ligne userStats si absente).
    const award = await applyAward(ctx, userId, xpEarned, "quiz");
    const levelBefore = levelFromTotalXp(award.totalXP - xpEarned);

    // Badges auto — patch sur la ligne stats désormais garantie.
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const newBadges: string[] = [];
    if (stats) {
      const badges = new Set(stats.badges);
      const grant = (id: string) => {
        if (!badges.has(id)) {
          badges.add(id);
          newBadges.push(id);
        }
      };
      if (perfect) grant("perfectionniste");
      if ((args.durationMs ?? Infinity) < 30_000 && total > 0) grant("rapide");
      if (award.currentStreak >= 7 || award.longestStreak >= 7) grant("streak7");
      if (award.newLevel >= 10) grant("level10");
      if (newBadges.length > 0) {
        await ctx.db.patch(stats._id, { badges: [...badges] });
      }
    }

    await insertQuizHistory(ctx, userId, {
      language: session.language,
      questionsAnswered: total,
      correctAnswers: correctCount,
      xpEarned,
      questionTypes,
    });
    if ((args.durationMs ?? Infinity) < 30_000) {
      await recordAchievementMetric(ctx, userId, "quiz:fast");
    }

    await ctx.db.patch(args.sessionId, { completed: true, score, xpEarned });

    // MOD 2 — économie gems + loot box (récompenses variables) :
    // score 5/5 → +20 gems et 1 loot box ; +100 gems par nouveau badge.
    let gemsEarned = 0;
    let lootBoxId: Id<"userLootBoxes"> | undefined;
    if (perfect) {
      gemsEarned += await addGemsInternal(ctx, userId, 20, "quiz_perfect");
      lootBoxId = await grantLootBox(ctx, userId, "quiz");
    }
    if (newBadges.length > 0) {
      gemsEarned += await applyBadgeGems(ctx, userId, newBadges.length);
    }

    return {
      score,
      xpEarned,
      totalQuestions: total,
      correctCount,
      levelUp: award.newLevel > levelBefore,
      newLevel: award.newLevel,
      currentStreak: award.currentStreak,
      streakUpdated: award.streakUpdated,
      newBadges,
      gemsEarned,
      lootBoxId,
      doubleXp: award.doubleXp ?? false,
      wrongAnswers: wrong,
    };
  },
});

