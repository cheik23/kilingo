import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { insertNotification } from "./notifications";
import { recordWeeklyXp } from "./leaderboard";
import { recordAchievementMetric } from "./achievementProgress";
import { settleReferralOnFirstQuiz } from "./referrals";

/* ═══════════════════════════════════════════════════════════════════
   GAMIFICATION (Phase 2/4) — XP, niveaux, streaks, badges, quiz.

   Une seule ligne `userStats` par utilisateur (upsert) :
   - level = floor(sqrt(totalXP / 50))  → niveau 1 = 50 XP, niv 10 = 5000 XP
   - streak : dernière activité = hier → +1 ; plus vieux → reset à 1
   - longestStreak : max historique
   - badges : tableau d'ids (src/lib/badges.ts est la source des libellés)

   recordQuiz insère la ligne quizHistory ET applique l'XP dans la même
   transaction via applyAward (aucune référence interne, anti-quota R6).
   Aucun crash sur données vides : getUserStats crée l'entrée par défaut.
   ═══════════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;

/** MOD 2 — prix et durées de l'économie gems. */
const DOUBLE_XP_PRICE_GEMS = 300;
const DOUBLE_XP_DURATION_MS = 3_600_000;
const REVEAL_TOKEN_PRICE_GEMS = 50;

/** Niveau = floor(sqrt(totalXP / 50)) : 50 XP → niv 1, 5000 XP → niv 10. */
export function levelFromTotalXp(totalXP: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalXP) / 50));
}

/** Jour ISO UTC (YYYY-MM-DD) — clé d'agrégation de quizHistory. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

type StatsDoc = {
  _id: Id<"userStats">;
  userId: Id<"users">;
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: number;
  badges: string[];
  /** Loss aversion — champs optionnels (lignes créées avant la MOD 1). */
  decayStartAt?: number | null;
  lastFreezeAt?: number;
  gems?: number;
  lastChanceUsedAt?: number;
  /** MOD 3 — défi quotidien. */
  lastDailyAt?: number;
  /** MOD 2 — gems & loot. */
  gemsHistory?: { delta: number; reason: string; balance: number; at: number }[];
  revealTokens?: number;
  doubleXpUntil?: number;
  /** Paliers de streak déjà crédités (1 = réclamé) — indices = STREAK_GEM_TIERS. */
  streakXPed?: number[];
};

/** Lit la ligne userStats sans la créer (null si absente). */
async function findStats(ctx: MutationCtx, userId: Id<"users">) {
  return (await ctx.db
    .query("userStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()) as StatsDoc | null;
}

/** Crée (ou lit) la ligne userStats par défaut de l'utilisateur. */
export async function ensureStats(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await findStats(ctx, userId);
  if (existing) return existing;
  const id = await ctx.db.insert("userStats", {
    userId,
    totalXP: 0,
    level: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveAt: 0,
    badges: [],
    decayStartAt: null,
    gems: 0,
  });
  return (await ctx.db.get(id)) as StatsDoc;
}

const awardResultValidator = v.object({
  xpGained: v.number(),
  newLevel: v.number(),
  totalXP: v.number(),
  streakUpdated: v.boolean(),
  currentStreak: v.number(),
  longestStreak: v.number(),
  reason: v.optional(v.string()),
  /** MOD 2 — Double XP actif sur ce gain ; gems de palier de streak. */
  doubleXp: v.optional(v.boolean()),
  streakGems: v.optional(v.number()),
  /** Parrainage — gems créditées à ce quiz parce que c'est le 1er du filleul. */
  referralReward: v.optional(v.number()),
});

/**
 * Cœur partagé awardXP / recordQuiz / submitQuiz : XP + niveau + streak
 * en un seul patch (même transaction que l'appelant).
 * MOD 2 — Double XP (×2 si doubleXpUntil > now) + gems de palier de
 * streak (7 j → +50, 30 j → +200, une seule fois chacun).
 */
export async function applyAward(ctx: MutationCtx, userId: Id<"users">, amount: number, reason?: string) {
  const stats = await ensureStats(ctx, userId);
  const decayPct = decayPercentFromStats(stats);
  const doubleXp = (stats.doubleXpUntil ?? 0) > Date.now();
  const decayed = Math.round(amount * (1 - decayPct / 100) * (doubleXp ? 2 : 1));
  const totalXP = stats.totalXP + decayed;
  const newLevel = levelFromTotalXp(totalXP);

  const now = Date.now();
  const last = stats.lastActiveAt;
  const sameDay = last > 0 && now - last < DAY_MS && dayKey(last) === dayKey(now);
  const yesterday =
    last > 0 && now - last < 2 * DAY_MS && dayKey(last) === dayKey(now - DAY_MS);
  // MOD 5 — le retour après une longue absence devient un événement
  // d'achèvement, pas un simple Day streak.
  if (last > 0 && now - last >= 7 * DAY_MS) {
    await recordAchievementMetric(ctx, userId, "comebacks");
  }
  const currentStreak = sameDay ? stats.currentStreak : yesterday ? stats.currentStreak + 1 : 1;
  const longestStreak = Math.max(stats.longestStreak, currentStreak);

  await ctx.db.patch(stats._id, {
    totalXP,
    level: newLevel,
    currentStreak,
    longestStreak,
    lastActiveAt: now,
    // Toute activité réarme le decay (MOD 1 — B.4).
    decayStartAt: null,
  });
  // MOD 4 — le leaderboard mesure l'XP finale effectivement créditée
  // (decay et Double XP inclus), via le writer XP central unique.
  await recordWeeklyXp(ctx, userId, decayed, now);

  // MOD 2 — gems de palier de streak (sur le streak APRÈS cette activité).
  const streakGems = await grantStreakGems(
    ctx,
    userId,
    stats._id,
    currentStreak,
    stats.streakXPed ?? [0, 0, 0],
  );

  // MOD 3 — record quotidien d'XP : le premier gain qui dépasse le cumul
  // déjà crédité aujourd'hui déclenche un rappel in-app.
  const today = dayKey(now);
  const todayHistory = await ctx.db
    .query("quizHistory")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
    .collect();
  const todayXP = todayHistory.reduce((sum, row) => sum + row.xpEarned, 0);
  if (decayed > 0 && todayXP > 0 && decayed > todayXP) {
    await insertNotification(ctx, {
      userId,
      kind: "record",
      title: "🏆 Nouveau record quotidien",
      body: `Tu viens de dépasser ton meilleur score XP du jour : ${todayXP} XP.`,
    });
  }

  return {
    xpGained: decayed,
    newLevel,
    totalXP,
    streakUpdated: !sameDay,
    currentStreak,
    longestStreak,
    reason,
    doubleXp,
    streakGems,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   GEMS & LOOT BOXES (MOD 2) — économie virtuelle + récompenses variables.

   A. earnGems/spendGems : seule source d'écriture de userStats.gems
   (jamais négatif — spend échoue proprement), historique 10 entrées.
   D. Double XP : si doubleXpUntil > now, applyAward double l'XP —
   quiz, conversation et shadow passent tous par ce cœur partagé.
   Triggers A.2/A.3 : streak 7 j → +50, 30 j → +200 (une seule fois par
   palier grâce aux états correspondants de streakXPed) ; +100 gems
   par nouveau badge débloqué par les moteurs (submitQuiz, fin de
   conversation) via applyBadgeGems.
   B. grantLootBox (roll 70/25/5) + openLootBox : le roll du tier ET du
   contenu est tiré côté serveur à la création (anti-triche), la box
   reste scellée jusqu'à openLootBox.
   ═══════════════════════════════════════════════════════════════════ */

const GEMS_HISTORY_MAX = 10;
const STREAK_GEM_TIERS = [
  { streak: 30, gems: 200 },
  { streak: 7, gems: 50 },
] as const;

function pushGemsHistory(
  stats: StatsDoc,
  delta: number,
  reason: string,
  balance: number,
): StatsDoc["gemsHistory"] {
  const entry = { delta, reason, balance, at: Date.now() };
  return [...(stats.gemsHistory ?? []), entry].slice(-GEMS_HISTORY_MAX);
}

/** Crédite (ou débite) des gems (usage interne, garde faite par l'appelant). */
export async function addGemsInternal(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  reason: string,
): Promise<number> {
  const stats = await ensureStats(ctx, userId);
  const gems = Math.max(0, (stats.gems ?? 0) + amount);
  await ctx.db.patch(stats._id, {
    gems,
    gemsHistory: pushGemsHistory(stats, amount, reason, gems),
  });
  return gems;
}

/** A.3 — crédite les gems de palier de streak non encore réclamés. */
async function grantStreakGems(
  ctx: MutationCtx,
  userId: Id<"users">,
  statsId: Id<"userStats">,
  currentStreak: number,
  claimed: number[],
): Promise<number> {
  const next = [...claimed];
  let earned = 0;
  for (let i = 0; i < STREAK_GEM_TIERS.length; i++) {
    const tier = STREAK_GEM_TIERS[i];
    if (next[i] === 0 && currentStreak >= tier.streak) {
      next[i] = 1;
      earned += tier.gems;
    }
  }
  if (earned === 0) return 0;
  await ctx.db.patch(statsId, { streakXPed: next });
  await addGemsInternal(ctx, userId, earned, "streak_tier");
  return earned;
}

/**
 * A.2 (trigger) — +100 gems par NOUVEAU badge crédité par les moteurs.
 * Utilisé après détection de nouveaux badges (quiz, conversation) : le
 * patch gems n'est pas passé par spendGems pour rester transactionnel
 * avec l'écriture des badges de l'appelant.
 */
export async function applyBadgeGems(
  ctx: MutationCtx,
  userId: Id<"users">,
  newBadgeCount: number,
): Promise<number> {
  if (newBadgeCount <= 0) return 0;
  return addGemsInternal(ctx, userId, newBadgeCount * 100, "badge");
}

/**
 * A.1 — crédit de gems (mutation publique, garde auth standard).
 */
export const earnGems = mutation({
  args: { amount: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const amount = Math.max(0, Math.round(args.amount));
    if (amount === 0) {
      const stats = await ensureStats(ctx, userId);
      return { ok: true, gems: stats.gems ?? 0 };
    }
    const gems = await addGemsInternal(
      ctx,
      userId,
      amount,
      args.reason ?? "earn",
    );
    return { ok: true, gems };
  },
  returns: v.object({ ok: v.boolean(), gems: v.number() }),
});

/** Writer interne unique pour débiter des gems dans une transaction métier. */
export async function spendGemsInternal(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  reason: string,
): Promise<{ ok: true; gems: number } | { ok: false; reason: "not_enough_gems"; gems: number }> {
  const rounded = Math.max(0, Math.round(amount));
  const stats = await ensureStats(ctx, userId);
  const gems = stats.gems ?? 0;
  if (rounded === 0) return { ok: true, gems };
  if (gems < rounded) return { ok: false, reason: "not_enough_gems", gems };
  const left = gems - rounded;
  await ctx.db.patch(stats._id, {
    gems: left,
    gemsHistory: pushGemsHistory(stats, -rounded, reason, left),
  });
  return { ok: true, gems: left };
}

/**
 * A.1 — dépense de gems. Jamais négatif : échec propre avec raison.
 */
export const spendGems = mutation({
  args: { amount: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return spendGemsInternal(ctx, userId, args.amount, args.reason ?? "spend");
  },
  returns: v.object({ ok: v.boolean(), reason: v.optional(v.string()), gems: v.number() }),
});

/**
 * B.1/B.3 — crée une loot box : tier ET contenu tirés côté serveur.
 * common 70 % (10-50 gems) · rare 25 % (100-200 + badge « chanceux »)
 * · epic 5 % (500 gems + avatarToken exclusif).
 */
export async function grantLootBox(
  ctx: MutationCtx,
  userId: Id<"users">,
  source: string,
): Promise<Id<"userLootBoxes">> {
  const roll = Math.random() * 100;
  const tier = roll < 5 ? "epic" : roll < 30 ? "rare" : "common";
  const contents =
    tier === "epic"
      ? { gems: 500, avatarToken: true }
      : tier === "rare"
        ? { gems: 100 + Math.floor(Math.random() * 101), badgeId: "chanceux" }
        : { gems: 10 + Math.floor(Math.random() * 41) };
  const id = await ctx.db.insert("userLootBoxes", {
    userId,
    tier,
    contents,
    openedAt: null,
    source,
  });
  await insertNotification(ctx, {
    userId,
    kind: "loot",
    title: "🎁 Loot Box t’attend",
    body: `Ta ${tier} box est prête. Ouvre-la dans la Boutique.`,
  });
  return id;
}

/**
 * B.4 — ouverture d'une box : crédite gems + badge/avatar, scelle à
 * jamais (openedAt). Le contenu a été figé à la création : l'animation
 * côté client est purement cosmétique.
 */
export const openLootBox = mutation({
  args: { lootId: v.id("userLootBoxes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const box = await ctx.db.get(args.lootId);
    if (!box || box.userId !== userId) throw new Error("Loot box introuvable.");
    const badgeId = box.contents.badgeId;
    const avatarToken = box.contents.avatarToken;
    if (box.openedAt) {
      const stats = await ctx.db
        .query("userStats")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      return {
        tier: box.tier,
        rewardGems: box.contents.gems,
        badgeId,
        avatarToken,
        alreadyOpened: true,
        gems: stats?.gems ?? 0,
      };
    }
    const gems = await addGemsInternal(ctx, userId, box.contents.gems, "loot_" + box.tier);
    await recordAchievementMetric(ctx, userId, "loot:opened");
    if (badgeId) {
      const stats = await findStats(ctx, userId);
      if (stats && !stats.badges.includes(badgeId)) {
        await ctx.db.patch(stats._id, { badges: [...stats.badges, badgeId] });
      }
    }
    await ctx.db.patch(args.lootId, { openedAt: Date.now() });
    return {
      tier: box.tier,
      rewardGems: box.contents.gems,
      badgeId,
      avatarToken,
      alreadyOpened: false,
      gems,
    };
  },
  returns: v.object({
    tier: v.union(v.literal("common"), v.literal("rare"), v.literal("epic")),
    rewardGems: v.number(),
    badgeId: v.optional(v.string()),
    avatarToken: v.optional(v.boolean()),
    alreadyOpened: v.boolean(),
    gems: v.number(),
  }),
});

/** B.5 — boxes non ouvertes du store (plus récentes d'abord). */
export const getMyLootBoxes = query({
  args: { opened: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("userLootBoxes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return rows
      .filter((r) => (args.opened === undefined ? true : args.opened ? r.openedAt != null : r.openedAt == null))
      .map((r) => ({
        _id: r._id,
        tier: r.tier,
        openedAt: r.openedAt ?? null,
        createdAt: r._creationTime,
        source: r.source ?? "",
      }));
  },
  returns: v.array(
    v.object({
      _id: v.id("userLootBoxes"),
      tier: v.union(v.literal("common"), v.literal("rare"), v.literal("epic")),
      openedAt: v.union(v.number(), v.null()),
      createdAt: v.number(),
      source: v.string(),
    }),
  ),
});

/** D.1 — Double XP actif ? (utilisé par la UI et les toasts). */
export const hasDoubleXp = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { active: false, until: 0, remainingMs: 0 };
    // Query ctx : lecture directe (findStats attend un MutationCtx).
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const until = stats?.doubleXpUntil ?? 0;
    const active = until > Date.now();
    return { active, until, remainingMs: active ? until - Date.now() : 0 };
  },
  returns: v.object({
    active: v.boolean(),
    until: v.number(),
    remainingMs: v.number(),
  }),
});

/** D.2 — active le Double XP 1 h après achat (300 gems, serveur only). */
export const activateDoubleXp = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const stats = await ensureStats(ctx, userId);
    const gems = stats.gems ?? 0;
    if (gems < DOUBLE_XP_PRICE_GEMS) {
      return { ok: false, reason: "not_enough_gems", gems };
    }
    const left = gems - DOUBLE_XP_PRICE_GEMS;
    // Empilement : acheté pendant un effet actif → cumule au-delà de la fin.
    const base = Math.max(Date.now(), stats.doubleXpUntil ?? 0);
    await ctx.db.patch(stats._id, {
      gems: left,
      doubleXpUntil: base + DOUBLE_XP_DURATION_MS,
      gemsHistory: pushGemsHistory(stats, -DOUBLE_XP_PRICE_GEMS, "double_xp", left),
    });
    return { ok: true, until: base + DOUBLE_XP_DURATION_MS, gems: left };
  },
  returns: v.object({ ok: v.boolean(), reason: v.optional(v.string()), until: v.optional(v.number()), gems: v.number() }),
});

/** C.3 — achat d'un token « Révéler 1 réponse » (50 gems). */
export const buyRevealToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const stats = await ensureStats(ctx, userId);
    const gems = stats.gems ?? 0;
    if (gems < REVEAL_TOKEN_PRICE_GEMS) {
      return { ok: false, reason: "not_enough_gems", tokens: stats.revealTokens ?? 0, gems };
    }
    const left = gems - REVEAL_TOKEN_PRICE_GEMS;
    await ctx.db.patch(stats._id, {
      gems: left,
      revealTokens: (stats.revealTokens ?? 0) + 1,
      gemsHistory: pushGemsHistory(stats, -REVEAL_TOKEN_PRICE_GEMS, "reveal_token", left),
    });
    return { ok: true, tokens: (stats.revealTokens ?? 0) + 1, gems: left };
  },
  returns: v.object({ ok: v.boolean(), reason: v.optional(v.string()), tokens: v.number(), gems: v.number() }),
});

/**
 * C.3 — consomme 1 token pour révéler la bonne réponse d'UNE question
 * déjà répondue (même garde de propriété que revealAnswer).
 */
export const consumeRevealToken = mutation({
  args: { sessionId: v.id("quizSessions"), questionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const stats = await ensureStats(ctx, userId);
    if ((stats.revealTokens ?? 0) <= 0) {
      return { ok: false, reason: "no_token", correctIndex: -1 };
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Session introuvable");
    const q = session.questions.find((x) => x.id === args.questionId);
    if (!q) throw new Error("Question introuvable");
    await ctx.db.patch(stats._id, { revealTokens: (stats.revealTokens ?? 0) - 1 });
    return { ok: true, correctIndex: q.correctIndex };
  },
  returns: v.object({ ok: v.boolean(), reason: v.optional(v.string()), correctIndex: v.number() }),
});

/* ── 1.2 Mutations ─────────────────────────────────────────────────── */

/** Award XP : upsert stats, niveau, streak hier→+1 / plus vieux→1.
 *  MOD 1 (B) — l'XP gagnée subit le decay courant (−10 %/−25 %/semaine).
 */
export const awardXP = mutation({
  args: { amount: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await applyAward(ctx, userId, Math.max(0, Math.round(args.amount)), args.reason);
  },
  returns: awardResultValidator,
});

/** Ajoute un badge au tableau (idempotent). */
export const unlockBadge = mutation({
  args: { badgeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const stats = await ensureStats(ctx, userId);
    if (stats.badges.includes(args.badgeId)) {
      return { ok: false, already: true };
    }
    await ctx.db.patch(stats._id, { badges: [...stats.badges, args.badgeId] });
    return { ok: true, already: false };
  },
  returns: v.object({ ok: v.boolean(), already: v.boolean() }),
});

/** Insère la ligne quizHistory (partagé avec le moteur de quiz). */
export async function insertQuizHistory(
  ctx: MutationCtx,
  userId: Id<"users">,
  entry: {
    language: string;
    questionsAnswered: number;
    correctAnswers: number;
    xpEarned: number;
    questionTypes: string[];
  },
) {
  await ctx.db.insert("quizHistory", {
    userId,
    date: dayKey(Date.now()),
    ...entry,
  });
}

/** Insère une ligne quizHistory + crédite l'XP (même transaction). */
export const recordQuiz = mutation({
  args: {
    language: v.string(),
    questionsAnswered: v.number(),
    correctAnswers: v.number(),
    xpEarned: v.number(),
    questionTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    await insertQuizHistory(ctx, userId, args);
    const award = await applyAward(ctx, userId, args.xpEarned, "quiz");
    // Parrainage : c'est le premier quiz RÉELLEMENT terminé qui déclenche la
    // récompense. Même transaction que le XP — soit tout passe, soit rien.
    // Idempotent : le deuxième quiz du filleul ne redistribue aucune gemme.
    const referral = await settleReferralOnFirstQuiz(ctx, userId);
    return { ...award, referralReward: referral.gems };
  },
  returns: awardResultValidator,
});

/* ═══════════════════════════════════════════════════════════════════
   LOSS AVERSION (MOD 1) — streaks protégés, XP decay, Last Chance.

   B. XP decay : décisions pures `decayPercent(days)` + `decayPercentFromStats`
   (réutilisables par getXpDecay et applyAward, aucune écriture côté query).
   applyAward réarme `decayStartAt` à chaque activité — quiz, conversation
   et shadow passent tous par ce cœur partagé.
   A. freezeStreak : applique le décrément userFreezes et, si le streak
   allait sauter (> 24 h sans activité), le restaure au jour précédent
   (streak « sauvé »). Le patch lastActiveAt est volontairement en dernier
   pour écraser celui de applyAward (le Freeze ne doit PAS compter comme
   une activité réelle). lastFreezeAt sert d'anti double-dépense même jour.
   C. completeLastChance : le quiz express déjà corrigé par submitQuiz
   (source de vérité serveur) ; ici on statue sur le sort du streak.
   ═══════════════════════════════════════════════════════ ═══ */

const FREEZE_PRICE_GEMS = 500;

/** % de decay selon les jours d'inactivité (B.2) — décision pure testable. */
export function decayPercent(days: number): number {
  if (days < 3) return 0;
  if (days < 7) return 10;
  return 25;
}

/** Decay courant de l'utilisateur, depuis sa ligne stats (0 si inexistante). */
function decayPercentFromStats(stats: StatsDoc | null): number {
  const started = stats?.decayStartAt;
  if (!started || started <= 0) return 0;
  return decayPercent(Math.floor((Date.now() - started) / DAY_MS));
}

/**
 * Query B — % de decay courant + XP perdu par semaine (0 si actif).
 * `simulateDaysInactive` permet la vérification CLI sans utilisateur :
 * la simulation n'écrit ni ne lit aucune donnée personnelle.
 */
export const getXpDecay = query({
  args: { simulateDaysInactive: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.simulateDaysInactive !== undefined) {
      const days = Math.max(0, Math.round(args.simulateDaysInactive));
      return { percent: decayPercent(days), daysInactive: days, xpPerWeek: 0 };
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const days = stats?.decayStartAt
      ? Math.floor((Date.now() - stats.decayStartAt) / DAY_MS)
      : 0;
    const percent = stats ? decayPercentFromStats(stats) : 0;
    return {
      percent,
      daysInactive: Math.max(0, days),
      xpPerWeek: stats ? Math.round((stats.totalXP * percent) / 100) : 0,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      percent: v.number(),
      daysInactive: v.number(),
      xpPerWeek: v.number(),
    }),
  ),
});

/* ── 1.4 Loss aversion : mutations ────────────────────────────────── */

type FreezeRow = { _id: Id<"userFreezes">; count: number; lastUsed?: number };

/** Lit la ligne userFreezes sans la créer (null si absente). */
async function findFreezes(ctx: MutationCtx, userId: Id<"users">) {
  return (await ctx.db
    .query("userFreezes")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()) as FreezeRow | null;
}

/** Ajoute un Freeze (upsert userFreezes) — partagé par les deux achats. */
async function addFreeze(ctx: MutationCtx, userId: Id<"users">) {
  const row = await findFreezes(ctx, userId);
  if (row) {
    await ctx.db.patch(row._id, { count: row.count + 1 });
    return row.count + 1;
  }
  await ctx.db.insert("userFreezes", { userId, count: 1 });
  return 1;
}

/**
 * A.3 — consomme un Streak Freeze : décrémente userFreezes puis, si le
 * streak allait être réinitialisé (dernière activité > 24 h), le ramène
 * à la veille. Anti double-dépense : 1 Freeze maximum par jour. Le
 * lastActiveAt est re-patché APRÈS applyAward : le Freeze ne compte pas
 * comme une activité réelle.
 */
export const freezeStreak = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const now = Date.now();

    const row = await findFreezes(ctx, userId);
    if (!row || row.count <= 0) {
      return { ok: false, reason: "no_freeze", freezesLeft: row?.count ?? 0, streakSaved: false };
    }
    const stats = await ensureStats(ctx, userId);
    if ((stats.lastFreezeAt ?? 0) > now - DAY_MS) {
      return { ok: false, reason: "already_today", freezesLeft: row.count, streakSaved: false };
    }

    await applyAward(ctx, userId, 0, "freeze");
    const streak = Math.max(0, stats.currentStreak);
    await ctx.db.patch(stats._id, {
      // Gelé à hier : la prochaine vraie activité repassera par la branche
      // « hier → +1 » sans que le Freeze ne compte comme un jour gagné.
      lastActiveAt: now - DAY_MS,
      currentStreak: streak,
      lastFreezeAt: now,
      // Le Freeze ne réarme PAS le decay (réservé aux vraies activités).
      decayStartAt: stats.decayStartAt ?? null,
    });
    await recordAchievementMetric(ctx, userId, "freezeUses");
    await ctx.db.patch(row._id, { count: row.count - 1, lastUsed: now });

    return { ok: true, freezesLeft: row.count - 1, streakSaved: true, currentStreak: streak };
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(v.string()),
    freezesLeft: v.number(),
    streakSaved: v.boolean(),
    currentStreak: v.optional(v.number()),
  }),
});

/**
 * C.2 — dénouement de la Last Chance. Le quiz express 3 questions a
 * déjà été corrigé côté serveur par submitQuiz (anti-triche) ; ici on
 * statue uniquement sur le sort du streak.
 * - succès : streak conservé (dernière activité ramenée à hier) + bonus
 *   50 XP + decay réarmé ;
 * - échec/timeout : streak remis à zéro.
 */
export const completeLastChance = mutation({
  args: { quizId: v.optional(v.id("quizSessions")), success: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const stats = await ensureStats(ctx, userId);
    const now = Date.now();

    if (!args.success) {
      await ctx.db.patch(stats._id, {
        currentStreak: 0,
        decayStartAt: stats.decayStartAt ?? now,
      });
      return { saved: false, currentStreak: 0, bonusXp: 0 };
    }

    // Anti-farm : un sauvetage réussi maximum par jour.
    if ((stats.lastChanceUsedAt ?? 0) > now - DAY_MS) {
      return { saved: false, reason: "already_today", currentStreak: stats.currentStreak, bonusXp: 0 };
    }

    const bonusXp = 50;
    const totalXP = stats.totalXP + bonusXp;
    const currentStreak = Math.max(1, stats.currentStreak);
    await ctx.db.patch(stats._id, {
      lastActiveAt: now - DAY_MS,
      lastChanceUsedAt: now,
      currentStreak,
      totalXP,
      level: levelFromTotalXp(totalXP),
      decayStartAt: null,
    });
    // Ce bonus historique contourne volontairement applyAward : on le verse
    // explicitement au registre hebdomadaire pour ne pas le competitors.
    await recordWeeklyXp(ctx, userId, bonusXp, now);
    if (args.quizId !== undefined) {
      await insertQuizHistory(ctx, userId, {
        language: "last-chance",
        questionsAnswered: 3,
        correctAnswers: 3,
        xpEarned: bonusXp,
        questionTypes: ["last-chance"],
      });
    }
    return { saved: true, currentStreak, bonusXp };
  },
  returns: v.object({
    saved: v.boolean(),
    reason: v.optional(v.string()),
    currentStreak: v.number(),
    bonusXp: v.number(),
  }),
});

/**
 * B.4 — réarme le decay après une activité qui ne passe pas (encore)
 * par applyAward. applyAward le fait déjà pour quiz/conversation/shadow.
 */
export const resetDecayMutation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const stats = await findStats(ctx, userId);
    if (stats && stats.decayStartAt != null) {
      await ctx.db.patch(stats._id, { decayStartAt: null });
    }
    return { ok: true };
  },
  returns: v.object({ ok: v.boolean() }),
});

/**
 * D — achat d'un Streak Freeze : 500 gems (débit réel du solde) ou
 * €0.99 (paiement simulé — Stripe/RevenueCat à venir).
 */
export const buyFreeze = mutation({
  args: { method: v.union(v.literal("gems"), v.literal("card")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const stats = await ensureStats(ctx, userId);
    const gems = stats.gems ?? 0;

    if (args.method === "gems") {
      if (gems < FREEZE_PRICE_GEMS) {
        const freezes = (await findFreezes(ctx, userId))?.count ?? 0;
        return { ok: false, reason: "not_enough_gems", gems, freezes };
      }
      // MOD 2 — le débit passe par l'historique gems centralisé.
      await addGemsInternal(ctx, userId, -FREEZE_PRICE_GEMS, "buy_freeze");
    }
    const freezes = await addFreeze(ctx, userId);
    return {
      ok: true,
      gems: args.method === "gems" ? gems - FREEZE_PRICE_GEMS : gems,
      freezes,
    };
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(v.string()),
    gems: v.number(),
    freezes: v.number(),
  }),
});

/* ── 1.3 Queries ───────────────────────────────────────────────────── */

/** Stats de gamification — entrée par défaut créée à la première lecture. */
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const history = await ctx.db
      .query("quizHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const quizzesTaken = history.length;
    const correct = history.reduce((a, h) => a + h.correctAnswers, 0);
    const answered = history.reduce((a, h) => a + h.questionsAnswered, 0);
    const freezes = await ctx.db
      .query("userFreezes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return {
      totalXP: stats?.totalXP ?? 0,
      level: stats?.level ?? 0,
      currentStreak: stats?.currentStreak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
      lastActiveAt: stats?.lastActiveAt ?? 0,
      badges: stats?.badges ?? [],
      gems: stats?.gems ?? 0,
      freezes: freezes?.count ?? 0,
      revealTokens: stats?.revealTokens ?? 0,
      quizzesTaken,
      quizAccuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      totalXP: v.number(),
      level: v.number(),
      currentStreak: v.number(),
      longestStreak: v.number(),
      lastActiveAt: v.number(),
      badges: v.array(v.string()),
      gems: v.number(),
      freezes: v.number(),
      revealTokens: v.number(),
      quizzesTaken: v.number(),
      quizAccuracy: v.number(),
    }),
  ),
});

/** N derniers jours de quiz (tri décroissant). */
export const getQuizHistory = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const days = Math.max(1, Math.min(365, Math.round(args.days ?? 30)));
    const since = dayKey(Date.now() - (days - 1) * DAY_MS);
    const rows = await ctx.db
      .query("quizHistory")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", since))
      .collect();
    return rows.sort((a, b) =>
      a.date === b.date ? b._creationTime - a._creationTime : b.date.localeCompare(a.date),
    );
  },
  returns: v.array(
    v.object({
      _id: v.id("quizHistory"),
      _creationTime: v.number(),
      userId: v.id("users"),
      date: v.string(),
      language: v.string(),
      questionsAnswered: v.number(),
      correctAnswers: v.number(),
      xpEarned: v.number(),
      questionTypes: v.array(v.string()),
    }),
  ),
});

/** Badges dont la progression est calculable côté serveur. */
const BADGE_PROGRESS: { id: string; target: number }[] = [
  { id: "polyglotte", target: 3 },
  { id: "streak7", target: 7 },
  { id: "perfectionniste", target: 1 },
  { id: "maitreRue", target: 1 },
  { id: "erudit", target: 1 },
  { id: "rapide", target: 1 },
  { id: "level10", target: 10 },
];

/** Progression de chaque badge (current / target) pour la page quiz. */
export const getBadgeProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const owned = new Set(stats?.badges ?? []);
    const langRows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const activeLangs = langRows.filter((r) => r.active).length;

    return BADGE_PROGRESS.map((b) => {
      let current = 0;
      if (b.id === "streak7") current = stats?.longestStreak ?? 0;
      else if (b.id === "level10") current = stats?.level ?? 0;
      else if (b.id === "polyglotte") current = activeLangs;
      else current = owned.has(b.id) ? 1 : 0; // réussites ponctuelles
      return { id: b.id, current, target: b.target, unlocked: owned.has(b.id) };
    });
  },
  returns: v.array(
    v.object({
      id: v.string(),
      current: v.number(),
      target: v.number(),
      unlocked: v.boolean(),
    }),
  ),
});
