import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";

/* ═══════════════════════════════════════════════════════════════════════
   ANALYTICS PERSONNEL — dashboard de progression (Phase 1/4)

   Toutes les données viennent des tables EXISTANTES :
   - srsCards (language dénormalisé, createdAt, firstSeenAt, lastReview,
     status, repetitions) — aucune jointure slang nécessaire ;
   - learningSessions (completedAt, language, kind, durationSeconds) ;
   - userLanguages (streak, lastActivity — langues suivies) ;
   - slangFavorites (join slangExpressions pour la langue) ;
   - slangAggregates (totaux de corpus par registre — taille du corpus).

   SEULE nouvelle table : goals. « current » d'un objectif n'est JAMAIS
   stocké : recalculé à chaque lecture depuis le nombre réel de cartes.
   Toutes les queries répondent sans crash sur des données vides.
   ═══════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;

/** Langues d'apprentissage + « total » (objectifs toutes langues). */
const goalLanguageValidator = v.union(
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
  v.literal("total"),
);

function dayStartMs(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/* ── 1a. Expressions apprises / jour (7 derniers jours) ───────────── */

export const getWeeklyProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const [cards, sessions] = await Promise.all([
      ctx.db
        .query("srsCards")
        .withIndex("by_user_language", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("learningSessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    // « Expression apprise » = première sortie du deck ce jour-là
    // (firstSeenAt, repli createdAt) + items appris en session.
    const byDay = new Map<string, number>();
    for (const c of cards) {
      const k = dayKey(c.firstSeenAt ?? c.createdAt);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    for (const s of sessions) {
      const n = s.itemsLearned ?? 0;
      if (n > 0) {
        const k = dayKey(s.completedAt);
        byDay.set(k, (byDay.get(k) ?? 0) + n);
      }
    }
    const today = dayStartMs(Date.now());
    const out: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const k = dayKey(today - i * DAY_MS);
      out.push({ date: k, count: byDay.get(k) ?? 0 });
    }
    return out;
  },
  returns: v.array(v.object({ date: v.string(), count: v.number() })),
});

/* ── 1b. Répartition par langue d'apprentissage ───────────────────── */

export const getLanguageBreakdown = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const [cards, favorites] = await Promise.all([
      ctx.db
        .query("srsCards")
        .withIndex("by_user_language", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("slangFavorites")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    // Union par expression (une expression favorite ET carte compte une
    // fois) : la langue des cartes est dénormalisée, celle des favoris
    // vient du join slangExpressions (« fr » = cible de traduction, hors
    // langues d'apprentissage).
    const perSlang = new Map<string, string>(); // slangId → language
    for (const c of cards) perSlang.set(c.slangId, c.language);
    for (const f of favorites) {
      if (perSlang.has(f.slangId)) continue;
      const slang = await ctx.db.get(f.slangId);
      if (slang && slang.language !== "fr") {
        perSlang.set(f.slangId, slang.language);
      }
    }
    const counts = new Map<string, number>();
    for (const lang of perSlang.values()) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return [...counts.entries()]
      .map(([language, count]) => ({
        language,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  },
  returns: v.array(
    v.object({
      language: v.string(),
      count: v.number(),
      percentage: v.number(),
    }),
  ),
});

/* ── 1c. Heatmap d'activité heure × jour de semaine (90 j) ────────── */

export const getActivityHeatmap = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { cells: [], insight: null as string | null };
    }
    const since = Date.now() - 90 * DAY_MS;
    const [sessions, cards] = await Promise.all([
      ctx.db
        .query("learningSessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("srsCards")
        .withIndex("by_user_language", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const cells = new Map<string, number>(); // "day:hour" → count
    const touch = (ms: number) => {
      if (ms < since) return;
      const d = new Date(ms);
      const key = `${d.getUTCDay()}:${d.getUTCHours()}`;
      cells.set(key, (cells.get(key) ?? 0) + 1);
    };
    for (const s of sessions) touch(s.completedAt);
    for (const c of cards) if (c.lastReview) touch(c.lastReview);

    const out: Array<{ hour: number; dayOfWeek: number; count: number }> = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        out.push({
          hour,
          dayOfWeek: day,
          count: cells.get(`${day}:${hour}`) ?? 0,
        });
      }
    }
    // Insight : tranche horaire la plus active (somme sur les 7 jours).
    const perHour = new Map<number, number>();
    for (const c of out) perHour.set(c.hour, (perHour.get(c.hour) ?? 0) + c.count);
    let bestHour = -1;
    let bestCount = 0;
    for (const [h, n] of perHour) {
      if (n > bestCount) {
        bestCount = n;
        bestHour = h;
      }
    }
    const insight =
      bestHour >= 0 && bestCount > 0
        ? `Tu apprends le mieux entre ${bestHour}h et ${(bestHour + 1) % 24}h`
        : null;
    return { cells: out, insight };
  },
  returns: v.object({
    cells: v.array(
      v.object({
        hour: v.number(),
        dayOfWeek: v.number(),
        count: v.number(),
      }),
    ),
    insight: v.union(v.string(), v.null()),
  }),
});

/* ── 1d. Insights typés ───────────────────────────────────────────── */

export const getInsights = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        strength: null,
        weakness: null,
        streak: 0,
        retention: 0,
        delta: 0,
        mastered: 0,
        corpusTotal: 0,
        active: false,
      };
    }
    const [cards, sessions, languages, aggregates] = await Promise.all([
      ctx.db
        .query("srsCards")
        .withIndex("by_user_language", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("learningSessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userLanguages")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("slangAggregates")
        .withIndex("by_key", (q) =>
          q.gte("key", "register:").lt("key", "register;"),
        )
        .collect(),
    ]);
    const now = Date.now();

    // Taille du corpus (somme des agrégats par registre, repli 0).
    const corpusTotal = aggregates.reduce((a, r) => a + r.total, 0);

    // FORCE : langue avec le plus de cartes.
    const perLang = new Map<string, number>();
    for (const c of cards) {
      perLang.set(c.language, (perLang.get(c.language) ?? 0) + 1);
    }
    let strength: { language: string; count: number } | null = null;
    for (const [language, count] of perLang) {
      if (!strength || count > strength.count) strength = { language, count };
    }

    // FAIBLESSE : langue étudiée (≥ 1 carte) sans activité depuis ≥ 12 j.
    const lastActivityByLang = new Map<string, number>();
    for (const l of languages) {
      if (l.lastActivity) {
        lastActivityByLang.set(
          l.language,
          Math.max(lastActivityByLang.get(l.language) ?? 0, l.lastActivity),
        );
      }
    }
    let weakness: { language: string; daysIdle: number } | null = null;
    for (const [language] of perLang) {
      const last = lastActivityByLang.get(language) ?? 0;
      if (last === 0) continue;
      const daysIdle = Math.floor((now - last) / DAY_MS);
      if (daysIdle >= 12 && (!weakness || daysIdle > weakness.daysIdle)) {
        weakness = { language, daysIdle };
      }
    }

    // STREAK : jours consécutifs avec activité jusqu'à aujourd'hui
    // (aujourd'hui inactif mais hier actif → la série n'est pas encore
    // brisée — même grâcieuseté que le streak des userLanguages).
    const activeDays = new Set<string>();
    for (const s of sessions) activeDays.add(dayKey(s.completedAt));
    for (const c of cards) if (c.lastReview) activeDays.add(dayKey(c.lastReview));
    let streak = 0;
    let cursor = dayStartMs(now);
    if (!activeDays.has(dayKey(cursor))) {
      if (!activeDays.has(dayKey(cursor - DAY_MS))) {
        cursor = -1; // aucune activité récente
      } else {
        cursor -= DAY_MS; // grâce : la série repart d'hier
      }
    }
    if (cursor >= 0) {
      while (activeDays.has(dayKey(cursor))) {
        streak += 1;
        cursor -= DAY_MS;
      }
    }

    // RÉTENTION : cartes revues / cartes créées (%).
    const reviewed = cards.filter((c) => c.lastReview != null).length;
    const retention =
      cards.length === 0 ? 0 : Math.round((reviewed / cards.length) * 100);

    // DELTA : volume d'activité semaine vs semaine précédente (%).
    const weekStart = dayStartMs(now) - 6 * DAY_MS;
    const prevStart = weekStart - 7 * DAY_MS;
    let cur = 0;
    let prev = 0;
    for (const s of sessions) {
      if (s.completedAt >= weekStart) cur += 1;
      else if (s.completedAt >= prevStart) prev += 1;
    }
    for (const c of cards) {
      if (!c.lastReview) continue;
      if (c.lastReview >= weekStart) cur += 1;
      else if (c.lastReview >= prevStart) prev += 1;
    }
    const delta =
      prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

    const mastered = cards.filter(
      (c) => c.status === "mastered" || c.repetitions >= 3,
    ).length;

    const active = sessions.length > 0 || cards.length > 0;
    return {
      strength,
      weakness,
      streak,
      retention,
      delta,
      mastered,
      corpusTotal,
      active,
    };
  },
  returns: v.object({
    strength: v.union(
      v.object({ language: v.string(), count: v.number() }),
      v.null(),
    ),
    weakness: v.union(
      v.object({ language: v.string(), daysIdle: v.number() }),
      v.null(),
    ),
    streak: v.number(),
    retention: v.number(),
    delta: v.number(),
    mastered: v.number(),
    corpusTotal: v.number(),
    active: v.boolean(),
  }),
});

/* ── 1e/1f/1g. Objectifs ──────────────────────────────────────────── */

/** Objectifs actifs, « current » recalculé depuis les cartes réelles. */
export const getGoals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const [goals, cards] = await Promise.all([
      ctx.db
        .query("goals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("srsCards")
        .withIndex("by_user_language", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const perLang = new Map<string, number>();
    for (const c of cards) {
      perLang.set(c.language, (perLang.get(c.language) ?? 0) + 1);
    }
    const currentOf = (language: string) =>
      language === "total" ? cards.length : (perLang.get(language) ?? 0);
    return goals
      .filter((g) => !g.archived)
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((g) => ({
        _id: g._id,
        language: g.language,
        target: g.target,
        deadline: g.deadline,
        origin: g.origin,
        current: currentOf(g.language),
      }));
  },
  returns: v.array(
    v.object({
      _id: v.id("goals"),
      language: goalLanguageValidator,
      target: v.number(),
      deadline: v.optional(v.number()),
      origin: v.union(v.literal("suggested"), v.literal("custom")),
      current: v.number(),
    }),
  ),
});

/**
 * Amorçage idempotent des 3 objectifs « suggested » (langue forte +50/30 j,
 * langue faible +20/14 j, total +100/60 j). Appelé par le frontend au
 * premier chargement quand getGoals revient vide — une mutation ne peut pas
 * être déclenchée depuis une query Convex, ce duo respecte le moteur.
 */
export const seedSuggestedGoals = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { seeded: 0 };
    const existing = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.length > 0) return { seeded: 0 }; // idempotent

    const [cards, languages] = await Promise.all([
      ctx.db
        .query("srsCards")
        .withIndex("by_user_language", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userLanguages")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const perLang = new Map<string, number>();
    for (const c of cards) {
      perLang.set(c.language, (perLang.get(c.language) ?? 0) + 1);
    }
    const activeTracked = languages.map((l) => l.language as string);

    const strong =
      [...perLang.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      activeTracked[0] ??
      "en";
    const weak =
      activeTracked.find((l) => l !== strong) ??
      [...perLang.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ??
      (strong === "en" ? "es" : "en");

    const now = Date.now();
    const levelOf = (language: string) =>
      language === "total" ? cards.length : (perLang.get(language) ?? 0);
    const mk = (language: string, increment: number, days: number) => ({
      userId,
      // « +N » : la barre démarre au niveau actuel réel.
      target: levelOf(language) + increment,
      deadline: now + days * DAY_MS,
      origin: "suggested" as const,
      archived: false,
      ...(language === "total"
        ? { language: "total" as const }
        : { language: language as "en" }),
    });
    await ctx.db.insert("goals", mk(strong, 50, 30));
    await ctx.db.insert("goals", mk(weak, 20, 14));
    await ctx.db.insert("goals", mk("total", 100, 60));
    return { seeded: 3 };
  },
  returns: v.object({ seeded: v.number() }),
});

/** Nouvel objectif personnalisé (modal Analytics). */
export const createGoal = mutation({
  args: {
    language: goalLanguageValidator,
    target: v.number(),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (
      !Number.isFinite(args.target) ||
      args.target < 1 ||
      args.target > 100_000
    ) {
      throw new Error("Objectif invalide (1 à 100 000).");
    }
    if (args.deadline != null && args.deadline <= Date.now()) {
      throw new Error("L'échéance doit être dans le futur.");
    }
    await ctx.db.insert("goals", {
      userId,
      language: args.language,
      target: Math.round(args.target),
      ...(args.deadline != null ? { deadline: args.deadline } : {}),
      origin: "custom",
      archived: false,
    });
    return { ok: true as const };
  },
  returns: v.object({ ok: v.literal(true) }),
});

/** Archive un objectif (gardé en base, masqué du dashboard). */
export const archiveGoal = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const goal: Doc<"goals"> | null = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== userId) throw new Error("Objectif introuvable.");
    await ctx.db.patch(args.goalId, { archived: true });
    return { ok: true as const };
  },
  returns: v.object({ ok: v.literal(true) }),
});
