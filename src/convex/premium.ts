/* ═══════════════════════════════════════════════════════════════════════
   VERROUS PREMIUM — CÔTÉ SERVEUR

   Ce module ne décide rien seul : il applique les règles pures de
   `lib/premiumLimits.ts` et va chercher l'état d'abonnement auprès de
   `subscriptions.getMyPremiumStatus` — la source unique de vérité. Aucun
   `isPremium` n'est recalculé ici, aucun n'est lu depuis le client.

   Trois surfaces verrouillées, et trois seulement :

     · `consumeShadowSlot`  — quota d'analyses Shadow (Module B)
     · `guardCharacters`     — personnages IA (Module C)
     · (Module A vit dans `learning.ts`, qui possède déjà les mutations
       de langue ; la règle y est importée, pas dupliquée.)

   ⚠ CE QUI N'EST PAS ICI, ET C'EST VOLONTAIRE

   Aucune vérification dans `learning.reviewCardMutation`, `recordSession`,
   `addToSrs`, `gamification.*`, `achievements.*`, `dailyChallenge.*` :
   la boucle d'apprentissage reste gratuite à 100 %. C'est vérifié par
   `scripts/verify-premium-locks.mjs`, qui échoue si un jour quelqu'un
   ajoute un appel à ce module dans l'un de ces fichiers.
   ═══════════════════════════════════════════════════════════════════════ */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { premiumStatusFor } from "./subscriptions";
import {
  FREE_SHADOW_PER_DAY,
  isCharacterLocked,
  localDayKey,
  quotaKey,
  shadowQuotaState,
  type ShadowQuota,
} from "../lib/premiumLimits";

/* ═══════════════════════════════════════════════════════════════════════
   FUSEAU HORAIRE
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Le fuseau est fourni par le client, donc il est traité comme une
 * ENTRÉE non fiable : on ne le stocke que si `Intl` sait le calculer.
 * Sans cette validation, une chaîne arbitraire stockée ferait échouer
 * `Intl.DateTimeFormat` à chaque lecture de quota — et donc casser la
 * page entière pour une simple analyse Shadow.
 */
export function isValidTimezone(tz: string | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Fuseau du compte, ou `UTC` si jamais renseigné / invalide. */
export function timezoneOf(user: { timezone?: string } | null): string {
  return isValidTimezone(user?.timezone) ? user.timezone : "UTC";
}

/* ═══════════════════════════════════════════════════════════════════════
   MUTATIONS INTERNES
   ═══════════════════════════════════════════════════════════════════════ */

/** Enregistre le fuseau du compte, s'il est valide. Idempotent. */
export const saveTimezone = internalMutation({
  args: { userId: v.id("users"), timezone: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    if (!isValidTimezone(args.timezone)) return;
    const user = await ctx.db.get(args.userId);
    if (!user || user.timezone === args.timezone) return;
    await ctx.db.patch(user._id, { timezone: args.timezone });
  },
});

/** Mutation publique : le client annonce SON fuseau, une fois par session. */
export const registerTimezone = mutation({
  args: { timezone: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ timezone: string; stored: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { timezone: "UTC", stored: false };
    if (!isValidTimezone(args.timezone)) {
      return { timezone: timezoneOf(await ctx.db.get(userId)), stored: false };
    }
    await ctx.runMutation(internal.premium.saveTimezone, {
      userId,
      timezone: args.timezone,
    });
    return { timezone: args.timezone, stored: true };
  },
});

/** Incrémente le compteur du jour local, et RAPPORTE l'état après coup. */
export const bumpShadowQuota = internalMutation({
  args: { userId: v.id("users"), timezone: v.optional(v.string()), isPremium: v.boolean() },
  handler: async (ctx, args): Promise<{ allowed: boolean; used: number }> => {
    const now = Date.now();
    const user = await ctx.db.get(args.userId);
    const tz = timezoneOf(user);
    if (tz !== (user?.timezone ?? "UTC")) {
      // Le client a signalé un fuseau que le compte ne portait pas encore.
      if (isValidTimezone(args.timezone) && user) {
        await ctx.db.patch(user._id, { timezone: args.timezone });
      }
    }
    const day = localDayKey(now, tz);
    const key = quotaKey(String(args.userId), now, tz);
    const row = await ctx.db
      .query("shadowQuota")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    const used = (row?.used ?? 0) + 1;
    if (!args.isPremium && used > FREE_SHADOW_PER_DAY) {
      // On refuse SANS incrémenter : sinon un utilisateur qui force
      // l'appel en boucle épuiserait lui-même son compteur, et l'affichage
      // du « reste » mentirait. `used - 1` est l'état réel.
      return { allowed: false, used: row?.used ?? 0 };
    }

    if (row) {
      await ctx.db.patch(row._id, { used, day, timezone: tz, updatedAt: now });
    } else {
      await ctx.db.insert("shadowQuota", {
        key,
        userId: args.userId,
        day,
        timezone: tz,
        used,
        updatedAt: now,
      });
    }
    return { allowed: true, used };
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   MODULE B — QUOTA SHADOW
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Consomme un créneau d'analyse.
 *
 * `true` = l'analyse peut partir. `false` = quota épuisé ; l'appelant
 * lève alors une erreur de type `quota_shadow`, que l'interface traduit
 * par le message de gain prévu (« reviens demain, ou passe en Premium
 * pour continuer »).
 */
export async function consumeShadowSlot(
  ctx: MutationCtx,
  userId: Id<"users"> | null,
): Promise<{ allowed: boolean; isPremium: boolean }> {
  if (!userId) return { allowed: true, isPremium: false };
  const status = await premiumStatusFor(ctx, userId);
  const isPremium = status.isPremium;
  const user = await ctx.db.get(userId);
  const result = await ctx.runMutation(internal.premium.bumpShadowQuota, {
    userId,
    timezone: timezoneOf(user),
    isPremium,
  });
  return { allowed: result.allowed, isPremium };
}

/** Erreur typée : l'interface la reconnaît et affiche le bon message. */
export const SHADOW_QUOTA_ERROR = "quota_shadow";

/**
 * Garde à poser au début de chaque point d'entrée d'analyse Shadow.
 *
 * Le message est celui de l'ERREUR CONVEXE, donc il remonte tel quel au
 * client : l'interface affiche le bloc de gain prévu, et surtout elle ne
 * laisse passer AUCUNE analyse au-delà du quota. Une exception non
 * rattrapée ici laisserait un utilisateur gratuit dépasser son quota en
 * forçant l'appel — le compteur n'est pas une décoration.
 */
export async function guardShadowQuota(
  ctx: MutationCtx,
  userId: Id<"users"> | null,
): Promise<void> {
  const { allowed } = await consumeShadowSlot(ctx, userId);
  if (!allowed) {
    throw new Error(SHADOW_QUOTA_ERROR);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ÉTAT DU QUOTA (affiché avant le blocage, jamais à la surprise)
   ═══════════════════════════════════════════════════════════════════════ */

export const getShadowQuota = query({
  args: {},
  handler: async (ctx): Promise<ShadowQuota & { isPremium: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ...shadowQuotaState(true, 0, Date.now(), "UTC"),
        isPremium: false,
      };
    }
    const status = await premiumStatusFor(ctx, userId);
    const user = await ctx.db.get(userId);
    const tz = timezoneOf(user);
    const now = Date.now();
    const row = await ctx.db
      .query("shadowQuota")
      .withIndex("by_key", (q) => q.eq("key", quotaKey(String(userId), now, tz)))
      .unique();
    return { ...shadowQuotaState(status.isPremium, row?.used ?? 0, now, tz), isPremium: status.isPremium };
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   MODULE C — PERSONNAGES IA
   ═══════════════════════════════════════════════════════════════════════ */

/** Le personnage est-il verrouillé pour ce compte ? */
export async function guardCharacters(
  ctx: QueryCtx,
  userId: Id<"users"> | null,
  characterIds: string[],
): Promise<Set<string>> {
  const locked = new Set<string>();
  if (userId === null) return locked;
  const status = await premiumStatusFor(ctx, userId);
  for (const id of characterIds) {
    if (isCharacterLocked(id, status.isPremium)) locked.add(id);
  }
  return locked;
}
