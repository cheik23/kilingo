import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { LANGUAGE_CODES } from "./languages";

/* Dashboard "Performance" — agrégats rétroactifs depuis les tables
   learningSessions / srsCards / userMedia / users / userLanguages. */

const DAY_MS = 86_400_000;

/** Level thresholds (cumulative XP) — level = index + 1. */
export const LEVELS = [0, 100, 250, 500, 850, 1300, 1900, 2650, 3550, 4600];

const XP_MEDIA = 20;
const XP_REVIEW = 2;
const XP_CORRECT = 1;
const XP_NEW_WORD = 5;
const XP_GOAL = 10;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** FSRS-stability retention estimator for one card (0..1). */
function cardRetention(
  c: Pick<Doc<"srsCards">, "lastReview" | "intervalDays" | "easeFactor">,
  now: number,
): number {
  const elapsedDays = (now - (c.lastReview as number)) / DAY_MS;
  const stabilityDays = Math.max(
    0.1,
    c.intervalDays * Math.max(1, c.easeFactor - 1.3) * 0.6,
  );
  return Math.exp(-elapsedDays / stabilityDays);
}

type ByDay = Map<string, { minutes: number; xp: number; words: number }>;

/** Retroactive XP per day: media +20 · review +2 (+1 correct) · word +5 · goal +10 · streak bonus. */
function buildByDay(
  user: Doc<"users"> | null,
  cards: Doc<"srsCards">[],
  sessions: Doc<"learningSessions">[],
  media: Doc<"userMedia">[],
  streakCurrent: number,
): ByDay {
  const byDay: ByDay = new Map();
  const touch = (k: string): { minutes: number; xp: number; words: number } => {
    let e = byDay.get(k);
    if (!e) {
      e = { minutes: 0, xp: 0, words: 0 };
      byDay.set(k, e);
    }
    return e;
  };

  for (const c of cards) {
    if (!c.lastReview) continue;
    touch(dayKey(c.lastReview)).xp += XP_REVIEW + (c.repetitions >= 1 ? XP_CORRECT : 0);
  }

  for (const s of sessions) {
    const e = touch(dayKey(s.completedAt));
    e.minutes += (s.durationSeconds ?? 0) / 60;
    e.words += s.itemsLearned ?? 0;
  }

  for (const m of media) {
    if (m.status !== "completed") continue;
    touch(dayKey(m._creationTime)).xp += XP_MEDIA;
  }

  for (const c of cards) {
    touch(dayKey(c.createdAt)).xp += XP_NEW_WORD;
  }

  const goal = user?.dailyGoalMinutes ?? 10;
  for (const e of byDay.values()) {
    if (e.minutes >= goal) e.xp += XP_GOAL;
  }

  const activeDays = [...byDay.keys()].sort();
  if (activeDays.length > 0 && streakCurrent > 0) {
    touch(activeDays[activeDays.length - 1]).xp += 5 * Math.min(streakCurrent, 7);
  }

  return byDay;
}

async function loadAll(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{
  cards: Doc<"srsCards">[];
  sessions: Doc<"learningSessions">[];
  media: Doc<"userMedia">[];
  languages: Doc<"userLanguages">[];
}> {
  const [cards, sessions, media, languages] = await Promise.all([
    ctx.db.query("srsCards").withIndex("by_user_language", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("learningSessions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("userMedia").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("userLanguages").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
  ]);
  return { cards, sessions, media, languages };
}

function levelInfo(xp: number): {
  level: number;
  levelFloor: number;
  levelCeil: number;
  levelProgress: number;
} {
  let level = 1;
  let levelFloor = 0;
  let levelCeil = LEVELS[1] ?? 100;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]) {
      level = i + 1;
      levelFloor = LEVELS[i];
      levelCeil = LEVELS[i + 1] ?? LEVELS[i] + 1000;
    }
  }
  const levelProgress = Math.min(
    1,
    Math.max(0, (xp - levelFloor) / Math.max(1, levelCeil - levelFloor)),
  );
  return { level, levelFloor, levelCeil, levelProgress };
}

/* ── Retention partagée ─────────────────────────────────────────────── */

function retentionLast7(cards: Doc<"srsCards">[], now: number): {
  value: number;
  reviewedCount: number;
} {
  const recent = cards.filter(
    (c) => c.lastReview && now - c.lastReview < 7 * DAY_MS,
  );
  if (recent.length === 0) return { value: 1, reviewedCount: 0 };
  const sum = recent.reduce((a, c) => a + cardRetention(c, now), 0);
  return { value: sum / recent.length, reviewedCount: recent.length };
}

const BADGES: Array<{
  id: string;
  title: string;
  desc: string;
  icon: string;
}> = [
  { id: "first-flame", title: "Première flamme", desc: "3 jours de streak", icon: "🔥" },
  { id: "cinephile", title: "Cinéphile", desc: "1re vidéo analysée", icon: "🎬" },
  { id: "gold-ear", title: "Oreille d'or", desc: "1er audio transcrit", icon: "🎧" },
  { id: "centurion", title: "Centurion", desc: "100 mots maîtrisés", icon: "💯" },
  { id: "slang-hunter", title: "Chasseur d'argot", desc: "25 expressions argot", icon: "🗣️" },
  { id: "polyglot", title: "Polyglotte", desc: "3 langues pratiquées", icon: "🌍" },
  { id: "night-owl", title: "Noctambule", desc: "Session après minuit", icon: "🌙" },
  { id: "early-bird", title: "Lève-tôt", desc: "Session avant 7 h", icon: "🌅" },
  { id: "lightning", title: "Éclair", desc: "10 reviews < 2 min", icon: "⚡" },
  { id: "elephant", title: "Mémoire d'éléphant", desc: "Rétention ≥ 95 % sur 7 j", icon: "🧠" },
  { id: "streak-king", title: "Roi de la série", desc: "Streak 30 jours", icon: "👑" },
  { id: "bibliophile", title: "Bibliophile", desc: "1er extrait de livre terminé", icon: "📚" },
];

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        xp: 0,
        level: 1,
        levelCeil: LEVELS[1] ?? 100,
        levelProgress: 0,
        streakCurrent: 0,
        streakLongest: 0,
        wordsMastered: 0,
        wordsLearning: 0,
        retention7d: 1,
        minutesTotal: 0,
        minutesToday: 0,
        mediaCount: 0,
        slangMastered: 0,
        deltaWeek: 0,
        dueToday: 0,
        minutesWeek: 0,
        dailyGoalMinutes: 10,
      };
    }

    const user = await ctx.db.get(userId);
    const { cards, sessions, media, languages } = await loadAll(ctx, userId);
    const now = Date.now();

    const streakCurrent = languages.reduce((a, r) => Math.max(a, r.streak), 0);
    const byDay = buildByDay(user, cards, sessions, media, streakCurrent);
    const { value: retention7d } = retentionLast7(cards, now);
    const xp = languages.reduce((a, r) => a + r.xp, 0);
    const { level, levelCeil, levelProgress } = levelInfo(xp);

    const minutesTotal = Math.round(
      sessions.reduce((a, s) => a + (s.durationSeconds ?? 0), 0) / 60,
    );
    const minutesToday = Math.round(
      sessions
        .filter((s) => dayKey(s.completedAt) === dayKey(now))
        .reduce((a, s) => a + (s.durationSeconds ?? 0), 0) / 60,
    );

    const todayStart = dayStart(now);
    const weekStart = todayStart - 6 * DAY_MS;
    const prevWeekStart = weekStart - 7 * DAY_MS;
    const inRange = (ms: number, from: number, to: number) => ms >= from && ms < to;
    let minutesWeek = 0;
    let xpWeek = 0;
    let minutesPrevWeek = 0;
    let xpPrevWeek = 0;
    for (const [k, e] of byDay) {
      const t = new Date(`${k}T00:00:00Z`).getTime();
      if (inRange(t, weekStart, todayStart + DAY_MS)) {
        minutesWeek += e.minutes;
        xpWeek += e.xp;
      } else if (inRange(t, prevWeekStart, weekStart)) {
        minutesPrevWeek += e.minutes;
        xpPrevWeek += e.xp;
      }
    }
    const cur = minutesWeek + xpWeek * 0.1;
    const prev = minutesPrevWeek + xpPrevWeek * 0.1;
    const deltaWeek =
      prev === 0 ? (cur > 0 ? 1 : 0) : Math.max(-1, Math.min(1, (cur - prev) / prev));

    return {
      xp,
      level,
      levelCeil,
      levelProgress,
      streakCurrent,
      streakLongest: streakCurrent,
      wordsMastered: cards.filter((c) => c.repetitions >= 3).length,
      wordsLearning: cards.filter((c) => c.repetitions > 0 && c.repetitions < 3).length,
      retention7d,
      minutesTotal,
      minutesToday,
      mediaCount: media.filter((m) => m.status === "completed").length,
      slangMastered: cards.filter((c) => c.repetitions >= 3).length,
      deltaWeek,
      dueToday: cards.filter((c) => c.nextReview <= now).length,
      minutesWeek: Math.round(minutesWeek),
      dailyGoalMinutes: user?.dailyGoalMinutes ?? 10,
    };
  },
  returns: v.object({
    xp: v.number(),
    level: v.number(),
    levelCeil: v.number(),
    levelProgress: v.number(),
    streakCurrent: v.number(),
    streakLongest: v.number(),
    wordsMastered: v.number(),
    wordsLearning: v.number(),
    retention7d: v.number(),
    minutesTotal: v.number(),
    minutesToday: v.number(),
    mediaCount: v.number(),
    slangMastered: v.number(),
    deltaWeek: v.number(),
    dueToday: v.number(),
    minutesWeek: v.number(),
    dailyGoalMinutes: v.number(),
  }),
});

export const dailyActivity = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const days = Math.min(Math.max(args.days ?? 30, 1), 120);
    const user = await ctx.db.get(userId);
    const { cards, sessions, media, languages } = await loadAll(ctx, userId);
    const streakCurrent = languages.reduce((a, r) => Math.max(a, r.streak), 0);
    const byDay = buildByDay(user, cards, sessions, media, streakCurrent);

    const out: Array<{ date: string; minutes: number; xp: number; words: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(Date.now() - i * DAY_MS);
      const e = byDay.get(key) ?? { minutes: 0, xp: 0, words: 0 };
      out.push({ date: key, minutes: Math.round(e.minutes), xp: e.xp, words: e.words });
    }
    return out;
  },
  returns: v.array(
    v.object({
      date: v.string(),
      minutes: v.number(),
      xp: v.number(),
      words: v.number(),
    }),
  ),
});

export const heatmap = query({
  args: { weeks: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const weeks = Math.min(Math.max(args.weeks ?? 12, 1), 26);
    const sessions = await ctx.db
      .query("learningSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const byDay = new Map<string, number>();
    for (const s of sessions) {
      const k = dayKey(s.completedAt);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    const out: Array<{ date: string; sessions: number }> = [];
    const start = dayStart(Date.now()) - (weeks * 7 - 1) * DAY_MS;
    for (let i = 0; i < weeks * 7; i++) {
      const k = dayKey(start + i * DAY_MS);
      out.push({ date: k, sessions: byDay.get(k) ?? 0 });
    }
    return out;
  },
  returns: v.array(
    v.object({ date: v.string(), sessions: v.number() }),
  ),
});

export const srsSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        dueToday: 0,
        forecast7: Array.from({ length: 7 }, (_, i) => ({
          date: dayKey(Date.now() + i * DAY_MS),
          due: 0,
        })),
        maturity: { new: 0, learning: 0, mature: 0 },
      };
    }
    const cards = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    const dueToday = cards.filter((c) => c.nextReview <= now).length;
    const forecast7: Array<{ date: string; due: number }> = [];
    for (let i = 0; i < 7; i++) {
      const from = dayStart(now) + i * DAY_MS;
      const to = from + DAY_MS;
      forecast7.push({
        date: dayKey(from),
        due: cards.filter((c) => c.nextReview >= from && c.nextReview < to).length,
      });
    }
    return {
      dueToday,
      forecast7,
      maturity: {
        new: cards.filter((c) => c.repetitions === 0).length,
        learning: cards.filter((c) => c.repetitions > 0 && c.repetitions < 3).length,
        mature: cards.filter((c) => c.repetitions >= 3).length,
      },
    };
  },
  returns: v.object({
    dueToday: v.number(),
    forecast7: v.array(v.object({ date: v.string(), due: v.number() })),
    maturity: v.object({ new: v.number(), learning: v.number(), mature: v.number() }),
  }),
});

export const skills = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { listening: 0, reading: 0, vocab: 0, slang: 0 };
    }
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
    const minutes = (kinds: string[]) =>
      sessions
        .filter((s) => kinds.includes(s.kind))
        .reduce((a, s) => a + (s.durationSeconds ?? 0), 0) / 60;
    return {
      listening: Math.min(100, Math.round(minutes(["shadowing", "sleep"]) * 3.3)),
      reading: Math.min(100, Math.round(minutes(["discovery"]) * 2.2)),
      vocab: Math.min(100, Math.round(cards.length * 2.5)),
      slang: Math.min(100, Math.round(cards.filter((c) => c.repetitions >= 3).length * 4)),
    };
  },
  returns: v.object({
    listening: v.number(),
    reading: v.number(),
    vocab: v.number(),
    slang: v.number(),
  }),
});

/* ── Maîtrise par registre d'argot (MasteryTree) ───────────────────── */

const REGISTER_ORDER = ["street", "casual", "vulgar", "internet"] as const;

/**
 * Progression groupée par registre : total d'expressions du registre (les 5
 * langues d'apprentissage, « fr » étant une cible de traduction) + cartes
 * maîtrisées / en cours de l'utilisateur (une carte est maîtrisée dès que la
 * machine à états SRS la valide, ou après 3 répétitions réussies).
 * Sans session : les totaux restent visibles, la maîtrise est à zéro.
 */
export const getMasteryData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    /* Anti-quota R6 — deux sources seulement :
       1. Totaux par registre : ~6 lignes d'agrégats pré-calculés
          (slang:seed / slang:recomputeAggregates) au lieu des ~800
          expressions relues à chaque chargement.
       2. Cartes de l'utilisateur : registre dénormalisé sur la carte
          (addToSrs) — plus aucune jointure vers la table slang. */
    let totals = new Map<string, number>();
    const aggregates = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) =>
        q.gte("key", "register:").lt("key", "register;"),
      )
      .collect();
    for (const a of aggregates) {
      totals.set(a.key.slice("register:".length), a.total);
    }

    if (aggregates.length === 0) {
      // Filet de sécurité : agrégats pas encore calculés (premier déploiement).
      // Un seul scan par langue, le temps que slang:recomputeAggregates passe —
      // ensuite ce chemin n'est plus jamais pris.
      totals = new Map<string, number>();
      for (const lang of LANGUAGE_CODES) {
        const found = await ctx.db
          .query("slangExpressions")
          .withIndex("by_language_popularity", (q) => q.eq("language", lang))
          .collect();
        for (const r of found) {
          totals.set(r.register, (totals.get(r.register) ?? 0) + 1);
        }
      }
    }

    const cards =
      userId === null
        ? []
        : await ctx.db
            .query("srsCards")
            .withIndex("by_user_language", (q) => q.eq("userId", userId))
            .collect();

    const mastered = new Map<string, number>();
    const learning = new Map<string, number>();
    for (const c of cards) {
      // Registre dénormalisé sur la carte ; lecture unitaire de repli pour
      // les cartes antérieures à la dénormalisation (self-heal : backfill).
      let register = c.register;
      if (register === undefined) {
        const slang = await ctx.db.get(c.slangId);
        register = slang?.register;
      }
      if (register === undefined) continue;
      const bucket =
        c.status === "mastered" || c.repetitions >= 3 ? mastered : learning;
      bucket.set(register, (bucket.get(register) ?? 0) + 1);
    }

    const ordered = [
      ...REGISTER_ORDER,
      ...[...new Set([...totals.keys(), ...mastered.keys(), ...learning.keys()])]
        .filter((r) => !(REGISTER_ORDER as readonly string[]).includes(r)),
    ];

    const registers = ordered.map((register) => {
      const total = totals.get(register) ?? 0;
      const done = Math.min(mastered.get(register) ?? 0, total);
      return {
        register,
        total,
        mastered: done,
        learning: learning.get(register) ?? 0,
        progress: total === 0 ? 0 : done / total,
      };
    });

    const total = registers.reduce((a, r) => a + r.total, 0);
    const masteredTotal = registers.reduce((a, r) => a + r.mastered, 0);

    return {
      registers,
      total,
      mastered: masteredTotal,
      progress: total === 0 ? 0 : masteredTotal / total,
    };
  },
  returns: v.object({
    registers: v.array(
      v.object({
        register: v.string(),
        total: v.number(),
        mastered: v.number(),
        learning: v.number(),
        progress: v.number(),
      }),
    ),
    total: v.number(),
    mastered: v.number(),
    progress: v.number(),
  }),
});

export const achievements = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    if (userId === null) {
      return BADGES.map((b) => ({ ...b, unlocked: false, unlockedAt: undefined }));
    }
    const { cards, sessions, media, languages } = await loadAll(ctx, userId);

    const streakMax = languages.reduce((a, r) => Math.max(a, r.streak), 0);
    const mastered = cards.filter((c) => c.repetitions >= 3).length;
    const languagesCount = new Set(languages.map((l) => l.language)).size;
    const mediaCompleted = media.filter((m) => m.status === "completed");
    const hasVideo = mediaCompleted.some((m) => m.mediaType === "video");
    const hasAudio = mediaCompleted.some((m) => m.mediaType === "audio");
    const hasBook = mediaCompleted.some(
      (m) => m.mediaType === "text" || m.mediaType === "book",
    );
    const hourOf = (ms: number) => new Date(ms).getUTCHours();
    const night = sessions.find((s) => hourOf(s.completedAt) >= 0 && hourOf(s.completedAt) < 5);
    const early = sessions.find((s) => hourOf(s.completedAt) >= 5 && hourOf(s.completedAt) < 7);
    const fast = cards.filter((c) => c.lastReview && now - c.lastReview < 2 * 60_000).length;
    const { value: retention, reviewedCount } = retentionLast7(cards, now);

    const cond: Record<string, boolean> = {
      "first-flame": streakMax >= 3,
      cinephile: hasVideo,
      "gold-ear": hasAudio,
      centurion: mastered >= 100,
      "slang-hunter": mastered >= 25,
      polyglot: languagesCount >= 3,
      "night-owl": night !== undefined,
      "early-bird": early !== undefined,
      lightning: fast >= 10,
      elephant: retention >= 0.95 && reviewedCount >= 5,
      "streak-king": streakMax >= 30,
      bibliophile: hasBook,
    };

    return BADGES.map((b) => ({
      ...b,
      unlocked: cond[b.id] ?? false,
      unlockedAt: cond[b.id] ? now : undefined,
    }));
  },
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      desc: v.string(),
      icon: v.string(),
      unlocked: v.boolean(),
      unlockedAt: v.optional(v.number()),
    }),
  ),
});

export const nextActions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const [user, cards, sessions, languages] = await Promise.all([
      ctx.db.get(userId),
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
    ]);

    const now = Date.now();
    const goal = user?.dailyGoalMinutes ?? 10;
    const dueToday = cards.filter((c) => c.nextReview <= now).length;
    const streakCurrent = languages.reduce((a, r) => Math.max(a, r.streak), 0);
    const todayKey = dayKey(now);
    const minutesToday = Math.round(
      sessions
        .filter((s) => dayKey(s.completedAt) === todayKey)
        .reduce((a, s) => a + (s.durationSeconds ?? 0), 0) / 60,
    );
    const weekStart = dayStart(now) - 6 * DAY_MS;
    const minutesWeek = Math.round(
      sessions
        .filter((s) => s.completedAt >= weekStart)
        .reduce((a, s) => a + (s.durationSeconds ?? 0), 0) / 60,
    );
    const { value: retention, reviewedCount } = retentionLast7(cards, now);

    type Action = { id: string; label: string; cta: string; priority: number; target: string };
    const actions: Action[] = [];

    if (dueToday > 0) {
      actions.push({
        id: "review-due",
        label: `${dueToday} mot${dueToday > 1 ? "s" : ""} t'attendent en revue`,
        cta: "Réviser maintenant",
        priority: 1,
        target: "review",
      });
    }
    if (minutesToday === 0 && streakCurrent > 0) {
      actions.push({
        id: "flame-guard",
        label: `${goal} min pour garder ta flamme 🔥`,
        cta: "Session rapide",
        priority: 2,
        target: "home",
      });
    }
    if (retention < 0.8 && reviewedCount >= 5) {
      actions.push({
        id: "retention-rescue",
        label: "Rétention sous 80 % : revois tes cartes matures",
        cta: "Review ciblé",
        priority: 3,
        target: "review",
      });
    }
    if (minutesWeek < goal * 7) {
      const missing = Math.max(1, goal * 7 - minutesWeek);
      actions.push({
        id: "weekly-goal",
        label: `Il te manque ${missing} min cette semaine`,
        cta: "Compléter",
        priority: 4,
        target: "shadow",
      });
    }

    // Région argot suivante à explorer (régions déjà couvertes via cartes maîtrisées).
    const masteredIds = cards.filter((c) => c.repetitions >= 3).map((c) => c.slangId);
    const regionDone = new Set<string>();
    for (const id of masteredIds.slice(0, 200)) {
      const s = await ctx.db.get(id);
      if (s) regionDone.add(s.region);
    }
    const REGIONS: Record<string, string[]> = {
      en: ["US", "UK", "Jamaïque", "Afrique du Sud", "Afrique"],
      zh: ["Chine"],
      es: ["Espagne", "Mexique", "Argentine", "Chili", "LatAm"],
      ru: ["Russie"],
      ar: ["Levant", "Égypte", "Maroc", "Maghreb", "Golf"],
    };
    for (const lang of languages.filter((l) => l.active)) {
      const remaining = (REGIONS[lang.language] ?? []).filter((r) => !regionDone.has(r));
      if (remaining.length > 0) {
        actions.push({
          id: `explore-${lang.language}`,
          label: `Explore l'argot de ${remaining[0]}`,
          cta: "Découvrir",
          priority: 5,
          target: "discover",
        });
        break;
      }
    }

    if (actions.length === 0) {
      actions.push({
        id: "explore-media",
        label: "Nouveau média suggéré",
        cta: "Explorer",
        priority: 6,
        target: "shadow",
      });
    }

    return actions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
      .map(({ id, label, cta, priority }) => ({ id, label, cta, priority }));
  },
  returns: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      cta: v.string(),
      priority: v.number(),
    }),
  ),
});
