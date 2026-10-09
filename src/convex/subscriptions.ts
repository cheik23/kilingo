/* ═══════════════════════════════════════════════════════════════════════
   ABONNEMENTS — MODULE A (lecture et écritures)

   Ce fichier ne contient QUE des queries et des mutations : il s'exécute
   dans le runtime Convex classique, où `process.env` n'existe pas. Tout ce
   qui parle à Lemon Squeezy (et donc lit les clés) vit dans
   `lemonsqueezy.ts`, en runtime Node, sous forme d'actions.

   La séparation n'est pas cosmétique : Convex n'accepte des queries et
   des mutations que hors runtime Node, et l'inverse non plus. Mélanger les
   deux dans un fichier est impossible, donc c'est une contrainte de la
   plateforme, pas un choix de style.

   ⚠ RÈGLE FONDATRICE DU LOT

   `isPremium` n'est STOCKÉ NULLE PART. Il se calcule ici, à partir de
   `status` + `currentPeriodEnd`, et nulle part ailleurs. Un booléen
   « isPremium » dupliqué dans la table serait une seconde vérité à
   resynchroniser : le jour où le webhook et cette query divergent, l'un
   des deux ment — et c'est toujours le client qui perd.
   ═══════════════════════════════════════════════════════════════════════ */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { PREMIUM } from "../lib/pricing";

/* ═══════════════════════════════════════════════════════════════════════
   TYPES PARTAGÉS
   ═══════════════════════════════════════════════════════════════════════ */

/** Statut NORMALISÉ — les cinq seuls états que la table connaît. */
export const PREMIUM_STATUSES = [
  "active",
  "cancelled",
  "past_due",
  "trialing",
  "expired",
] as const;
export type PremiumStatus = (typeof PREMIUM_STATUSES)[number];

export type Subscription = Doc<"subscriptions">;

/**
 * Règle d'accès, en un seul endroit.
 *
 * Elle est volontairement plus fine que `status === "active"` : un
 * abonnement résilié reste payé jusqu'à sa date de fin, et Lemon Squeezy
 * laisse un abonnement en `past_due` pendant toute la séquence de
 * recouvrement (« dunning »). Retirer l'accès dès la première échéance
 * échouée punirait l'abonné pour un simple problème de carte alors que le
 * prestataire considère toujours l'abonnement valide — on contredirait la
 * source de vérité.
 *
 * `currentPeriodEnd` ABSENT = « aucune fin connue » (l'API ne l'a pas
 * donné), PAS « expiré » : on ne retire jamais un accès sur une absence
 * d'information.
 */
export function isPremiumFor(
  status: PremiumStatus,
  currentPeriodEnd: number | undefined,
  now: number,
): boolean {
  if (status === "active" || status === "trialing") return true;
  if (status === "cancelled" || status === "past_due") {
    return typeof currentPeriodEnd === "number" && currentPeriodEnd > now;
  }
  return false; // "expired" — le seul état qui ferme l'accès sans délai.
}

/** Statut brut Lemon Squeezy → statut normalisé. */
export function normalizeStatus(raw: string | undefined | null): PremiumStatus {
  switch (raw) {
    case "on_trial":
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "cancelled":
    case "paused":
      return "cancelled";
    default:
      return "expired";
  }
}

/** Le compte connecté est-il Premium ? (réponse consommée par le client) */
export type PremiumStatusResult = {
  /** Règle d'accès ci-dessus. Jamais stocké, toujours recalculé. */
  isPremium: boolean;
  /** Statut normalisé, ou `null` si le compte n'a jamais d'abonnement. */
  status: PremiumStatus | null;
  /** Statut brut de l'API — affiché tel quel dans les diagnostics. */
  lemonSqueezyStatus: string | null;
  variantId: string | null;
  /** Fin de la période payée, en ms epoch (`null` = inconnue). */
  currentPeriodEnd: number | null;
  trialEndsAt: number | null;
  /** Abonnement bac à sable : il ne vaut pas argent réel. */
  testMode: boolean;
  /** Un abonnement existe, même expiré — sert à proposer le réabonnement. */
  hasSubscription: boolean;
};

/* ═══════════════════════════════════════════════════════════════════════
   MODULE A — `getMyPremiumStatus`

   L'unique source de vérité du droit d'accès dans tout le dépôt. Tout ce
   qui veut savoir « cette personne est-elle Premium ? » passe par ici, et
   nulle part ailleurs.
   ═══════════════════════════════════════════════════════════════════════ */

/** Dernier abonnement connu d'un compte (le plus récemment mis à jour). */
function latestSubscription(rows: Subscription[]): Subscription | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => (row.updatedAt > best.updatedAt ? row : best));
}

/** Accès Premium d'un compte — version interne, réutilisée par le hook. */
export async function premiumStatusFor(
  // `QueryCtx | MutationCtx` : la même règle sert la query publique ET les
  // mutations de `convex/premium.ts`, qui doivent consommer la MÊME source
  // de vérité. Une fonction par contexte finirait par diverger.
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | null,
): Promise<PremiumStatusResult> {
  const empty: PremiumStatusResult = {
    isPremium: false,
    status: null,
    lemonSqueezyStatus: null,
    variantId: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
    testMode: false,
    hasSubscription: false,
  };
  if (!userId) return empty;

  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const sub = latestSubscription(rows);
  if (!sub) return empty;

  return {
    isPremium: isPremiumFor(sub.status, sub.currentPeriodEnd, Date.now()),
    status: sub.status,
    lemonSqueezyStatus: sub.lemonSqueezyStatus,
    variantId: sub.variantId ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    trialEndsAt: sub.trialEndsAt ?? null,
    testMode: sub.testMode === true,
    hasSubscription: true,
  };
}

export const getMyPremiumStatus = query({
  args: {},
  handler: async (ctx): Promise<PremiumStatusResult> => {
    const userId = await getAuthUserId(ctx);
    return await premiumStatusFor(ctx, userId);
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   ÉTAT DU PRESTATAIRE (ce que l'interface doit savoir AVANT de promettre)

   Une query Convex ne peut pas lire `process.env` (le runtime Node
   n'accepte que des actions). L'état de configuration transite donc par
   la table `lemonSqueezyProvider`, écrite par l'action
   `lemonsqueezy.syncPaymentsConfig` (runtime Node) que le client appelle au
   montage.

   Règle de lecture : ABSENT = « pas encore prêt ». Tant qu'aucune action
   n'a confirmé la présence de la clé, l'interface affiche « bientôt
   disponible ». On ne promet jamais une caisse qu'on n'a pas vérifiée.
   ═══════════════════════════════════════════════════════════════════════ */

export type PaymentsConfig = {
  /** Peut-on encaisser ? */
  checkoutReady: boolean;
  /** Une clé API a-t-elle été vue par le déploiement ? */
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  variantId: string | null;
  storeId: string | null;
  productName: string | null;
  /** Motif du refus — diagnostic. */
  reason: string | null;
  /** Mode bac à sable demandé par la configuration. */
  testMode: boolean;
  /** Tarif affiché — rappel de la source de vérité. */
  priceEur: number;
  trialDays: number;
  /** L'action de synchronisation a-t-elle déjà tourné ? */
  synced: boolean;
};

export const getPaymentsConfig = query({
  args: {},
  handler: async (ctx): Promise<PaymentsConfig> => {
    const row = await ctx.db
      .query("lemonSqueezyProvider")
      .withIndex("by_key", (q) => q.eq("key", "provider"))
      .unique();

    return {
      checkoutReady: row?.ready === true,
      hasApiKey: row?.hasApiKey === true,
      hasWebhookSecret: row?.hasWebhookSecret === true,
      variantId: row?.variantId ?? null,
      storeId: row?.storeId ?? null,
      productName: row?.productName ?? null,
      reason: row?.reason ?? null,
      testMode: row?.testMode === true,
      priceEur: PREMIUM.monthlyEur,
      trialDays: PREMIUM.trialDays,
      synced: row !== null,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   MUTATIONS INTERNES — appelées par le runtime Node
   ═══════════════════════════════════════════════════════════════════════ */

/** Variante résolue, en cache (une ligne). */
export const getCachedProvider = internalMutation({
  args: {},
  handler: async (ctx): Promise<Doc<"lemonSqueezyProvider"> | null> => {
    return await ctx.db
      .query("lemonSqueezyProvider")
      .withIndex("by_key", (q) => q.eq("key", "provider"))
      .unique();
  },
});

/** Écrit (ou met à jour) l'état du prestataire — une seule ligne. */
export const writeProviderStatus = internalMutation({
  args: {
    storeId: v.optional(v.string()),
    variantId: v.optional(v.string()),
    productName: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    hasApiKey: v.optional(v.boolean()),
    hasWebhookSecret: v.optional(v.boolean()),
    ready: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db
      .query("lemonSqueezyProvider")
      .withIndex("by_key", (q) => q.eq("key", "provider"))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, resolvedAt: now });
    } else {
      await ctx.db.insert("lemonSqueezyProvider", {
        key: "provider",
        ...args,
        resolvedAt: now,
      });
    }
  },
});

/** Utilisateur par e-mail — réconciliation quand `custom.user_id` manque. */
export const findUserByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<Id<"users"> | null> => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user?._id ?? null;
  },
});

/** Tous les abonnements d'un compte. */
export const listForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Subscription[]> => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/** E-mail du compte — pour pré-remplir la page de paiement. */
export const getUserEmail = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string | null> => {
    const user = await ctx.db.get(args.userId);
    return typeof user?.email === "string" ? user.email : null;
  },
});

/** Un webhook a-t-il déjà été traité ? (clé = empreinte du corps brut) */
export const webhookSeen = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const row = await ctx.db
      .query("lemonSqueezyWebhookEvents")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row !== null;
  },
});

export const recordWebhook = internalMutation({
  args: {
    key: v.string(),
    eventName: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    resolved: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.insert("lemonSqueezyWebhookEvents", {
      ...args,
      receivedAt: Date.now(),
    });
  },
});

/**
 * Écrit (ou réécrit) l'abonnement. UPSERT par identifiant Lemon Squeezy —
 * c'est ce qui rend le rejeu d'un webhook inoffensif.
 */
export const upsertSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    lemonSqueezySubscriptionId: v.string(),
    lemonSqueezyStatus: v.string(),
    lemonSqueezyCustomerId: v.optional(v.string()),
    variantId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    email: v.optional(v.string()),
    testMode: v.optional(v.boolean()),
    lemonSqueezyUpdatedAt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ action: "inserted" | "updated" | "stale" }> => {
    const now = Date.now();
    const status = normalizeStatus(args.lemonSqueezyStatus);

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_lemon_subscription", (q) =>
        q.eq("lemonSqueezySubscriptionId", args.lemonSqueezySubscriptionId),
      )
      .unique();

    if (existing) {
      // Garde-fou d'ordre : Lemon Squeezy peut réémettre un événement
      // ancien après un plus récent (rejeu, réseau). Sans cette
      // comparaison, un `subscription_created` arrivant après un
      // `subscription_cancelled` ressusciterait un abonnement résilié.
      if (
        typeof args.lemonSqueezyUpdatedAt === "number" &&
        typeof existing.lemonSqueezyUpdatedAt === "number" &&
        args.lemonSqueezyUpdatedAt < existing.lemonSqueezyUpdatedAt
      ) {
        return { action: "stale" };
      }
      await ctx.db.patch(existing._id, {
        status,
        lemonSqueezyStatus: args.lemonSqueezyStatus,
        lemonSqueezyCustomerId: args.lemonSqueezyCustomerId,
        variantId: args.variantId,
        currentPeriodEnd: args.currentPeriodEnd,
        trialEndsAt: args.trialEndsAt,
        email: args.email,
        testMode: args.testMode,
        lemonSqueezyUpdatedAt: args.lemonSqueezyUpdatedAt,
        updatedAt: now,
      });
      return { action: "updated" };
    }

    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      status,
      lemonSqueezyStatus: args.lemonSqueezyStatus,
      lemonSqueezySubscriptionId: args.lemonSqueezySubscriptionId,
      lemonSqueezyCustomerId: args.lemonSqueezyCustomerId,
      variantId: args.variantId,
      currentPeriodEnd: args.currentPeriodEnd,
      trialEndsAt: args.trialEndsAt,
      email: args.email,
      testMode: args.testMode,
      lemonSqueezyUpdatedAt: args.lemonSqueezyUpdatedAt,
      createdAt: now,
      updatedAt: now,
    });
    return { action: "inserted" };
  },
});
