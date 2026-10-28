import {
  query,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  levelFromXp,
  levelProgress,
  reviewCard,
  newCardDefaults,
  advanceCard,
  type CEFRLevel,
  type LanguageCode,
  type CardStatus,
} from "./languages";
import type { Id } from "./_generated/dataModel";
import { premiumStatusFor } from "./subscriptions";
import {
  activeLanguageBlockReason,
  activeLanguageCap,
} from "../lib/premiumLimits";

const languageValidator = v.union(
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
  v.literal("de"),
  v.literal("hi"),
  v.literal("bn"),
  v.literal("pt"),
  v.literal("ur"),
  v.literal("id"),
  v.literal("ja"),
  v.literal("tr"),
  v.literal("ko"),
  v.literal("it"),
  v.literal("th"),
  v.literal("vi"),
  v.literal("am"),
  v.literal("ig"),
  v.literal("fa"),
  v.literal("tl"),
  v.literal("pl"),
  v.literal("el"),
);

const ratingValidator = v.union(
  v.literal("again"),
  v.literal("hard"),
  v.literal("good"),
  v.literal("easy"),
);

/** Shape of a joined slang row (public fields only, never leaks rows). */
const slangPublicValidator = v.object({
  _id: v.id("slangExpressions"),
  _creationTime: v.number(),
  // Table union includes "fr" (translation-target rows are filtered before
  // the join, but the static type must match the table).
  language: v.union(
    v.literal("en"),
    v.literal("zh"),
    v.literal("es"),
    v.literal("ar"),
    v.literal("ru"),
    v.literal("fr"),
  ),
  expression: v.string(),
  literal: v.optional(v.string()),
  meaning: v.string(),
  context: v.string(),
  register: v.string(),
  region: v.string(),
  popularity: v.number(),
  mediaRefs: v.optional(v.array(v.string())),
  // Fiche à faire relire par un natif — recopiée depuis slangExpressions pour
  // que la file de révision puisse porter le même avertissement que la
  // Découverte. Absente (undefined) pour tout le contenu déjà validé.
  validated: v.optional(v.boolean()),
  // Contenu adulte — même recopie, même raison : la révision doit pouvoir
  // prévenir l'apprenant qui retombe sur « goonen ».
  isAdult: v.optional(v.boolean()),
});

/** Card fields exposed to the client. */
const srsCardValidator = v.object({
  _id: v.id("srsCards"),
  _creationTime: v.number(),
  language: languageValidator,
  slangId: v.id("slangExpressions"),
  easeFactor: v.number(),
  intervalDays: v.number(),
  repetitions: v.number(),
  nextReview: v.number(),
  lastReview: v.optional(v.number()),
  createdAt: v.number(),
  status: v.optional(v.string()),
  due: v.optional(v.union(v.number(), v.null())),
  consecutiveFails: v.optional(v.number()),
  lastRating: v.optional(v.union(v.string(), v.null())),
  firstSeenAt: v.optional(v.number()),
});

/* ═══════════════════════════════════════════════════════════════════════
   MODULE A — PLAFOND DE LANGUES ACTIVES

   La règle pure vit dans `src/lib/premiumLimits.ts` (`activeLanguageCap`,
   `activeLanguageBlockReason`) : elle n'est pas recopiée ici, elle est
   APPLIQUÉE. Ce module possède les mutations de langue, donc c'est lui qui
   porte la garde — et lui seul.

   Ce qui compte, c'est l'ORDRE : le refus est calculé AVANT la première
   écriture. Un refus qui patcherait d'abord enlèverait une langue à un
   utilisateur gratuit avant de lui dire « non » — le contraire exact de la
   non-rétroactivité.
   ═══════════════════════════════════════════════════════════════════════ */

/** Vue minimale d'une ligne `userLanguages`, pour le calcul du plafond. */
type LanguageRow = {
  language: string;
  active: boolean;
  activatedAt?: number;
};

/**
 * Refuse la modification si l'ensemble demandé dépasse le plafond du compte.
 *
 * Le code machine remonte seul (Convex ne transporte qu'un message) :
 * `{ ok: false, reason: "language_cap", cap, wanted }`, comme
 * `quota_shadow` et `character_locked`. Le client reconnaît ce code ; un
 * blocage mal reconnu se dégrade en message générique, jamais en crash.
 */
async function guardLanguageCap(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  rows: LanguageRow[],
  wanted: string[],
): Promise<void> {
  const { isPremium } = await premiumStatusFor(ctx, userId);
  if (activeLanguageBlockReason(isPremium, rows, wanted) === null) return;
  const cap = activeLanguageCap(isPremium, rows);
  throw new Error(
    JSON.stringify({ ok: false, reason: "language_cap", cap, wanted }),
  );
}

// ─── User languages & focus rotatif ────────────────────────────────

export const myLanguages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const activeFocus = rows.filter((r) => r.active).map((r) => r.language);
    /* Le plafond et l'état Premium viennent du SERVEUR : le client affiche,
       il ne recalcule rien. Un `isPremium` recalculé côté client serait une
       seconde vérité, celle qui dérive en silence. */
    const { isPremium } = await premiumStatusFor(ctx, userId);
    return {
      rows,
      activeFocus,
      onboarded: rows.length > 0,
      activeLanguageCap: activeLanguageCap(isPremium, rows),
      isPremium,
    };
  },
});

export const setFocus = mutation({
  args: { languages: v.array(languageValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (args.languages.length === 0 || args.languages.length > 2) {
      throw new Error("Select 1 or 2 focus languages");
    }
    const unique = Array.from(new Set(args.languages));
    const existing = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existingByLang = new Map(existing.map((r) => [r.language, r]));
    const now = Date.now();

    // Module A — refus AVANT toute écriture : rien n'est retiré au compte.
    await guardLanguageCap(ctx, userId, existing, unique);

    for (const row of existing) {
      const shouldActive = unique.includes(row.language);
      if (row.active !== shouldActive) {
        // Activer horodate (l'activation compte contre le plafond) ;
        // désactiver EFFACE l'horodatage, donc réactiver plus tard est une
        // nouvelle activation — pas un crédit reconduit.
        await ctx.db.patch(row._id, {
          active: shouldActive,
          activatedAt: shouldActive ? now : undefined,
        });
      }
    }
    for (const lang of unique) {
      if (!existingByLang.has(lang)) {
        await ctx.db.insert("userLanguages", {
          userId,
          language: lang,
          active: true,
          activatedAt: now,
          level: "A1",
          xp: 0,
          streak: 0,
          lastActivity: now,
        });
      }
    }
    return { ok: true };
  },
});

export const switchFocus = mutation({
  args: { activate: v.array(languageValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (args.activate.length === 0 || args.activate.length > 2) {
      throw new Error("Select 1 or 2 focus languages");
    }
    const rows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existingByLang = new Map(rows.map((r) => [r.language, r]));
    const now = Date.now();

    // Module A — même garde que `setFocus` : refus AVANT toute écriture.
    await guardLanguageCap(ctx, userId, rows, args.activate);

    for (const row of rows) {
      const shouldActive = args.activate.includes(row.language);
      if (row.active !== shouldActive) {
        await ctx.db.patch(row._id, {
          active: shouldActive,
          activatedAt: shouldActive ? now : undefined,
        });
      }
    }
    // create rows for languages not yet tracked
    for (const lang of args.activate) {
      if (!existingByLang.has(lang)) {
        await ctx.db.insert("userLanguages", {
          userId,
          language: lang,
          active: true,
          activatedAt: now,
          level: "A1",
          xp: 0,
          streak: 0,
          lastActivity: now,
        });
      }
    }
    return { ok: true };
  },
});

export const setOnboarded = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const existing = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.length === 0) {
      // default: English + Mandarin focus, others passive
      const defaults: LanguageCode[] = ["en", "zh"];
      for (const lang of ["en", "zh", "es", "ar", "ru"] as LanguageCode[]) {
        await ctx.db.insert("userLanguages", {
          userId,
          language: lang,
          active: defaults.includes(lang),
          level: "A1",
          xp: 0,
          streak: 0,
          lastActivity: Date.now(),
        });
      }
    }
    return { ok: true };
  },
});

// ─── SRS flow ──────────────────────────────────────────────────────

/** Due cards for the signed-in user (optionally filtered by language). */
export const dueCards = query({
  args: { language: v.optional(languageValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    const due = rows.filter(
      (r) =>
        r.nextReview <= now && (args.language ? r.language === args.language : true),
    );
    const withSlang = await Promise.all(
      due.slice(0, 40).map(async (card) => {
        const slang = await ctx.db.get(card.slangId);
        return slang ? { card, slang } : null;
      }),
    );
    return withSlang.filter((x) => x !== null);
  },
});

/**
 * Tire les nouvelles cartes du jour (plafond 10/jour UTC) et les fait
 * passer en "learning" avec due = maintenant — appelée au montage de la
 * vue Révision. Les tirées comptent dans le plafond même si non revues.
 */
export const drawNewCards = mutation({
  args: { language: v.optional(languageValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { drawn: 0 };
    const rows = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    const todayStart = new Date().setUTCHours(0, 0, 0, 0);
    const inScope = (c: (typeof rows)[number]) =>
      args.language ? c.language === args.language : true;
    const newToday = rows.filter(
      (c) => (c.firstSeenAt ?? 0) >= todayStart && inScope(c),
    ).length;
    const quota = Math.max(0, 10 - newToday);
    if (quota === 0) return { drawn: 0 };
    const now = Date.now();
    const fresh = rows
      .filter((c) => (c.status ?? "learning") === "new" && inScope(c))
      .sort(() => Math.random() - 0.5)
      .slice(0, quota);
    for (const card of fresh) {
      await ctx.db.patch(card._id, {
        status: "learning",
        due: now,
        nextReview: now,
        firstSeenAt: card.firstSeenAt ?? now,
      });
    }
    return { drawn: fresh.length };
  },
  returns: v.object({ drawn: v.number() }),
});

/**
 * File de révision (machine à états SRS) :
 * - cartes learning/confirming avec due <= maintenant, triées par due asc ;
 * - les nouvelles du jour sont tirées par drawNewCards (plafond 10/jour)
 *   et arrivent ici avec due = maintenant ;
 * - les mastered n'apparaissent JAMAIS.
 * Règle anti-acharnement : consecutiveFails >= 3 → mode "assisté"
 * (contexte + exemple affichés avant la réponse).
 */
export const reviewQueue = query({
  args: { language: v.optional(languageValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    const statusOf = (c: (typeof rows)[number]): string => c.status ?? "learning";

    // learning/confirming arrivées à échéance — jamais de mastered/new.
    const due = rows
      .filter(
        (c) =>
          (statusOf(c) === "learning" || statusOf(c) === "confirming") &&
          (c.due ?? c.nextReview) <= now &&
          (args.language ? c.language === args.language : true),
      )
      .sort((a, b) => (a.due ?? a.nextReview) - (b.due ?? b.nextReview))
      .slice(0, 60);

    const withSlang = await Promise.all(
      due.map(async (card) => {
        const slang = await ctx.db.get(card.slangId);
        if (!slang) return null;
        return {
          card: {
            _id: card._id,
            language: card.language,
            slangId: card.slangId,
            easeFactor: card.easeFactor,
            intervalDays: card.intervalDays,
            repetitions: card.repetitions,
            nextReview: card.nextReview,
            lastReview: card.lastReview,
            createdAt: card.createdAt,
            status: card.status,
            due: card.due,
            consecutiveFails: card.consecutiveFails,
            lastRating: card.lastRating,
            firstSeenAt: card.firstSeenAt,
          },
          slang: {
            _id: slang._id,
            language: slang.language,
            expression: slang.expression,
            literal: slang.literal,
            meaning: slang.meaning,
            context: slang.context,
            register: slang.register,
            region: slang.region,
            popularity: slang.popularity,
            mediaRefs: slang.mediaRefs,
            validated: slang.validated,
            isAdult: slang.isAdult,
          },
          assisted: (card.consecutiveFails ?? 0) >= 3,
          status: statusOf(card),
        };
      }),
    );
    return withSlang.filter((x) => x !== null);
  },
});

/**
 * Révise une carte via la machine à états learning → confirming → mastered.
 * Retourne le résultat pour le feedback inline animé de l'UI.
 *
 * Idempotence (anti double-soumission côté backend) : le client peut
 * transmettre `expectedLastReview` — la valeur de `lastReview` qu'il a vue
 * dans la file de révision au moment où il a affiché la carte. Si la carte
 * a déjà été revue entre-temps, `lastReview` a changé → la mutation refuse
 * (code `stale_review`) sans avancer l'état ni créditer de XP.
 *
 * Deux revues légitimes d'une carte restent toujours possibles : chaque
 * revue repousse l'échéance d'au moins un jour, donc la seconde survient
 * après l'échéance, quand le client détient une file rafraîchie portant le
 * `lastReview` à jour. Le garde ne rejette qu'une soumission construite sur
 * un état périmé (clic dupliqué, mutation fantôme rejouée).
 */
export const reviewCardMutation = mutation({
  args: {
    cardId: v.id("srsCards"),
    rating: ratingValidator,
    expectedLastReview: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const card = await ctx.db.get(args.cardId);
    if (!card || card.userId !== userId) throw new Error("Card not found");

    // Compare-and-swap sur lastReview — AVANT toute écriture (XP, statut).
    // `undefined` = appelant legacy sans garde ; `null` = carte jamais revue.
    if (
      args.expectedLastReview !== undefined &&
      (card.lastReview ?? null) !== args.expectedLastReview
    ) {
      throw new Error(
        JSON.stringify({ ok: false, reason: "stale_review" }),
      );
    }

    const now = Date.now();
    const currentStatus = (card.status ?? "learning") as CardStatus;
    const outcome = advanceCard(currentStatus, args.rating, now);
    const legacy = reviewCard(
      {
        easeFactor: card.easeFactor,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
      },
      args.rating,
      now,
    );
    const consecutiveFails =
      args.rating === "again"
        ? (card.consecutiveFails ?? 0) + 1
        : 0;
    await ctx.db.patch(args.cardId, {
      easeFactor: legacy.easeFactor,
      intervalDays: outcome.intervalDays,
      repetitions: legacy.repetitions,
      nextReview: outcome.due ?? legacy.nextReview,
      lastReview: now,
      status: outcome.status,
      due: outcome.due,
      consecutiveFails,
      lastRating: args.rating,
      firstSeenAt: card.firstSeenAt ?? now,
    });

    // award XP for the language, bump streak if last activity was yesterday
    const langRows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", userId).eq("language", card.language),
      )
      .collect();
    const langRow = langRows[0];
    const xpGain = args.rating === "again" ? 2 : 5;
    if (langRow) {
      const last = langRow.lastActivity ?? 0;
      const dayMs = 86_400_000;
      const sameDay = now - last < dayMs && new Date(last).getDate() === new Date(now).getDate();
      let streak = langRow.streak;
      if (!sameDay) {
        const yesterday =
          now - last < 2 * dayMs &&
          new Date(last).getDate() === new Date(now).getDate() - 1;
        streak = yesterday ? streak + 1 : 1;
      }
      await ctx.db.patch(langRow._id, {
        xp: langRow.xp + xpGain,
        streak,
        lastActivity: now,
      });
    }
    return {
      status: outcome.status,
      intervalDays: outcome.intervalDays,
      due: outcome.due,
      justMastered: outcome.justMastered,
      xpGain,
    };
  },
  returns: v.object({
    status: v.string(),
    intervalDays: v.number(),
    due: v.union(v.number(), v.null()),
    justMastered: v.boolean(),
    xpGain: v.number(),
  }),
});

/** Add an expression to the user's SRS (from discovery, media, sleep...). */
export const addToSrs = mutation({
  args: { slangId: v.id("slangExpressions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const slang = await ctx.db.get(args.slangId);
    if (!slang) throw new Error("Expression not found");
    // "fr" rows are translation-target vocabulary — not part of any SRS deck.
    if (slang.language === "fr") {
      return { ok: false, reason: "translation_only" as const };
    }
    const existing = await ctx.db
      .query("srsCards")
      .withIndex("by_user_slang", (q) =>
        q.eq("userId", userId).eq("slangId", args.slangId),
      )
      .collect();
    if (existing.length > 0) return { ok: false, reason: "already" as const };

    await ctx.db.insert("srsCards", {
      userId,
      language: slang.language,
      slangId: args.slangId,
      // Dénormalisé (anti-quota R6) : getMasteryData regroupe par registre
      // sans relire la table slang pour chaque carte.
      register: slang.register,
      ...newCardDefaults(Date.now()),
    });
    return { ok: true as const };
  },
});

/**
 * Self-heal one-shot (anti-quota R6) : complète `register` sur les cartes
 * créées avant la dénormalisation. Idempotent — sans cartes à corriger,
 * ne fait que lire les cartes de l'appelant (index by_user).
 */
export const backfillMyCardRegisters = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { patched: 0 };
    const cards = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    let patched = 0;
    for (const card of cards) {
      if (card.register !== undefined) continue;
      const slang = await ctx.db.get(card.slangId);
      if (!slang) continue;
      await ctx.db.patch(card._id, { register: slang.register });
      patched += 1;
    }
    return { patched };
  },
});

export const removeFromSrs = mutation({
  args: { slangId: v.id("slangExpressions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("srsCards")
      .withIndex("by_user_slang", (q) =>
        q.eq("userId", userId).eq("slangId", args.slangId),
      )
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

/**
 * Clé d'idempotence d'une session SRS : identifiant d'OPÉRATION, jamais une
 * preuve d'identité. On refuse les clés vides, trop longues ou contenant des
 * caractères hors de l'alphabet UUID/opaque attendu, pour éviter qu'une
 * valeur accidentellement vide ne désactive silencieusement la protection.
 */
const SESSION_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

function readSessionKey(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (!SESSION_KEY_RE.test(raw)) throw new Error("Invalid sessionKey");
  return raw;
}

/** Record a completed session (shadowing / discovery / sleep / srs). */
export const recordSession = mutation({
  args: {
    language: languageValidator,
    kind: v.string(),
    durationSeconds: v.optional(v.number()),
    itemsLearned: v.optional(v.number()),
    /** Présent pour les sessions SRS ; les autres appelants restent legacy. */
    sessionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const sessionKey = readSessionKey(args.sessionKey);

    // Idempotence : une même clé, pour le même utilisateur, désigne UNE
    // session logique. Le lookup et toutes les écritures ci-dessous vivent
    // dans la même transaction Convex : un retry après réponse perdue ne
    // recrée rien et ne recrédite aucun XP/streak. L'index composé est la
    // seule source de vérité ; le client ne peut pas contourner ce contrôle.
    //
    // Les appels sans clé (découverte, sleep, shadowing, flowcheck et
    // clients historiques) conservent exactement l'ancien contrat : ils ne
    // bénéficient pas de cette protection.
    if (sessionKey !== undefined) {
      const existing = await ctx.db
        .query("learningSessions")
        .withIndex("by_user_session_key", (q) =>
          q.eq("userId", userId).eq("sessionKey", sessionKey),
        )
        .unique();
      if (existing) {
        // Résultat de la première exécution, pas le streak courant : un
        // retry tardif ne doit pas réécrire l'histoire de la session.
        return {
          xpGain: existing.xpAwarded ?? 0,
          streak: existing.streakAfter ?? 0,
        };
      }
    }

    const now = Date.now();
    // XP + streak for the language. On calcule AVANT l'insertion pour
    // stocker le résultat original avec la clé, dans la même transaction.
    const langRows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", userId).eq("language", args.language),
      )
      .collect();
    const row = langRows[0];
    // Une session SRS keyed doit avoir une ligne de langue : c'est cette
    // ligne que la transaction patche, ce qui force la sérialisation OCC de
    // deux appels concurrents portant la même clé. Sans elle, on refuse
    // d'écrire une session que rien ne protégerait d'un doublon.
    if (sessionKey !== undefined && !row) {
      throw new Error("Language not initialized");
    }
    let xpGain = 0;
    let streak = 0;
    if (row) {
      const last = row.lastActivity ?? 0;
      const dayMs = 86_400_000;
      const sameDay =
        now - last < dayMs && new Date(last).getDate() === new Date(now).getDate();
      streak = row.streak;
      if (!sameDay) {
        const yesterday =
          now - last < 2 * dayMs &&
          new Date(last).getDate() === new Date(now).getDate() - 1;
        streak = yesterday ? streak + 1 : 1;
      }
      xpGain = 10 + (args.itemsLearned ?? 0) * 2;
    }

    await ctx.db.insert("learningSessions", {
      userId,
      language: args.language,
      kind: args.kind,
      durationSeconds: args.durationSeconds,
      itemsLearned: args.itemsLearned ?? 0,
      completedAt: now,
      ...(sessionKey !== undefined
        ? { sessionKey, xpAwarded: xpGain, streakAfter: streak }
        : {}),
    });

    if (row) {
      await ctx.db.patch(row._id, {
        xp: row.xp + xpGain,
        streak,
        lastActivity: now,
      });
    }
    return { xpGain, streak };
  },
});

// ─── Stats ─────────────────────────────────────────────────────────

export const myStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const langRows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const cards = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    const sessions = await ctx.db
      .query("learningSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    const dueCount = cards.filter((c) => c.nextReview <= now).length;
    const masteredCount = cards.filter((c) => c.repetitions >= 3).length;

    const perLanguage = langRows.map((row) => {
      const langCards = cards.filter((c) => c.language === row.language);
      const langSessions = sessions.filter((s) => s.language === row.language);
      const minutes = Math.round(
        langSessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0) / 60,
      );
      return {
        language: row.language as LanguageCode,
        active: row.active,
        xp: row.xp,
        streak: row.streak,
        level: levelFromXp(row.xp) as CEFRLevel,
        progress: levelProgress(row.xp),
        cards: langCards.length,
        due: langCards.filter((c) => c.nextReview <= now).length,
        minutes,
        sessions: langSessions.length,
      };
    });

    const totalXp = langRows.reduce((a, r) => a + r.xp, 0);
    const totalMinutes = Math.round(
      sessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0) / 60,
    );
    const bestStreak = langRows.reduce((a, r) => Math.max(a, r.streak), 0);

    return {
      perLanguage,
      totalXp,
      totalMinutes,
      totalSessions: sessions.length,
      bestStreak,
      dueCount,
      masteredCount,
      totalCards: cards.length,
    };
  },
});

/** All cards (deck viewer) with slang joined. */
export const myDeck = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    const out = await Promise.all(
      rows
        .sort((a, b) => a.nextReview - b.nextReview)
        .slice(0, 200)
        .map(async (card) => {
          const slang = await ctx.db.get(card.slangId);
          return slang ? { card, slang } : null;
        }),
    );
    return out.filter((x) => x !== null);
  },
});
