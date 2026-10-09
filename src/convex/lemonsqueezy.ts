"use node";

/* ═══════════════════════════════════════════════════════════════════════
   PAIEMENT — LEMON SQUEEZY (Merchant of Record) · runtime Node

   Lemon Squeezy est le *Merchant of Record* : c'est LUI qui encaisse, qui
   collecte et qui reverse la TVA de l'Union européenne. Conséquence
   directe, et c'est ce qui rend ce choix cohérent avec la promesse de la
   landing (« tes données de carte ne passent jamais par nos serveurs ») :
   aucune donnée de carte ne transite par Convex. Le navigateur est redirigé
   vers une page de paiement hébergée par Lemon Squeezy, qui revient nous
   prévenir par webhook signé. On ne « reçoit » donc jamais de numéro de
   carte — on ne stocke qu'un statut d'abonnement.

   ⚠ CE FICHIER NE CONTIENT QUE DES ACTIONS

   Convex n'exécute des `query` et `mutation` que dans son runtime
   classique ; le runtime Node (`"use node"`) n'accepte QUE des actions.
   D'où la séparation : ici tout ce qui parle au prestataire (et lit donc
   `process.env`), dans `subscriptions.ts` tout ce qui se lit et s'écrit
   en base. Ce n'est pas un choix de style, c'est une contrainte de la
   plateforme.

   ⚠ RÉGLES NON NÉGOCIABLES

   1. AUCUNE CLÉ EN DUR, AUCUN MONTANT EN DUR, AUCUN `variantId` EN DUR.
      La clé vient de `LEMONSQUEEZY_API_KEY`, le prix affiché vient de
      `lib/pricing.ts`, la variante est LUE à l'API. Un identifiant
      recopié depuis un ticket de support finit toujours par viser le
      mauvais produit : mieux vaut un refus franc qu'un encaissement sur la
      mauvaise offre.

   2. SANS CLÉ, RIEN NE CASSE. Chaque point d'entrée renvoie un état
      exploitable (`reason`, `message`), jamais une exception. Le module doit
      pouvoir être déployé sur une instance sans prestataire configuré.

   3. LE WEBHOOK EST VÉRIFIÉ, TOUJOURS. Sans `X-Signature` valide, la
      requête est rejetée 401. C'est la seule porte d'entrée du statut
      d'abonnement : une requête non signée pourrait activer Premium
      n'importe qui, gratuitement.

   4. `isPremium` N'EST STOCKÉ NULLE PART — voir `subscriptions.ts`.
   ═══════════════════════════════════════════════════════════════════════ */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { envValue } from "./ovEnv";
import { PREMIUM } from "../lib/pricing";
import { normalizeStatus, type PremiumStatus, type Subscription } from "./subscriptions";

/**
 * Auto-référence du module, sans dépendance statique à l'API générée.
 *
 * Ce module s'appelle LUI-MÊME : `lemonsqueezy.upsertSubscription` est
 * invoqué depuis `createCheckoutSession`. Or `internal` englobe tous les
 * modules, y compris celui-ci, et la chaîne
 * `handler → internal.lemonsqueezy.X → API générée → handler` est
 * circulaire : le type de sortie du handler devient inférable, ce qui
 * contamine l'API générée puis TOUS les composants qui la consomment. Le
 * cast local coupe la boucle. Il ne perd rien à l'exécution : les
 * validateurs Convex s'appliquent toujours, et chaque fonction visée est
 * bien définie dans `subscriptions.ts`.
 */
const ls = internal as unknown as { subscriptions: Record<string, any> };

/* ═══════════════════════════════════════════════════════════════════════
   ACCÈS AUX VARIABLES D'ENVIRONNEMENT

   Aucune clé n'est renvoyée au client : ces fonctions ne servent qu'à
   décider « est-ce configuré ? » et à lire la valeur côté serveur.
   ═══════════════════════════════════════════════════════════════════════ */

const ENV_API_KEY = "LEMONSQUEEZY_API_KEY";
const ENV_WEBHOOK_SECRET = "LEMONSQUEEZY_WEBHOOK_SECRET";
const ENV_VARIANT_ID = "LEMONSQUEEZY_VARIANT_ID";
const ENV_STORE_ID = "LEMONSQUEEZY_STORE_ID";
const ENV_TEST_MODE = "LEMONSQUEEZY_TEST_MODE";
/** URL de retour de repli — l'origine du navigateur a la priorité. */
const ENV_APP_URL = "APP_URL";

const API_BASE = "https://api.lemonsqueezy.com/v1";

/** Le prestataire est-il configuré pour encaisser ? */
export function paymentsConfigured(): boolean {
  return Boolean(envValue(ENV_API_KEY));
}

/** Le mode bac à sable est-il demandé explicitement ? */
function testModeRequested(): boolean {
  const raw = envValue(ENV_TEST_MODE)?.toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/* ═══════════════════════════════════════════════════════════════════════
   CLIENT API LEMON SQUEEZY
   ═══════════════════════════════════════════════════════════════════════ */

type LsResponse = { status: number; body: any; ok: boolean };

/**
 * Appel authentifié de l'API. Ne lève jamais : renvoie `{ ok: false }` pour
 * que l'appelant décide quoi afficher. Une erreur HTTP ne doit pas devenir
 * une page blanche côté utilisateur.
 */
async function lsFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<LsResponse> {
  const key = envValue(ENV_API_KEY);
  if (!key) return { ok: false, status: 0, body: null };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${key}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { message: String(err) } };
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   DÉCOUVERTE DE LA VARIANTE (Module B)

   On ne devine pas l'identifiant du produit Premium : on demande à l'API
   quelle variante « vaut exactement le tarif affiché sur la page, en euros,
   au mois ». Réponse unique → on l'utilise. Réponse ambiguë ou aucune
   correspondance → refus, et l'interface affiche « bientôt disponible ».

   C'est aussi ce qui permet au projet de fonctionner avec les DEUX seules
   variables configurées : le `variantId` peut être ajouté plus tard, il
   n'est pas nécessaire pour démarrer.
   ═══════════════════════════════════════════════════════════════════════ */

type ResolvedVariant = {
  storeId: string;
  variantId: string;
  productName: string;
  priceCents: number;
};

/** Prix attendu, en centimes — calculé depuis `lib/pricing.ts`, jamais écrit. */
const EXPECTED_PRICE_CENTS = Math.round(PREMIUM.monthlyEur * 100);

function displayName(variant: any, product: any): string {
  const productName = product?.attributes?.name;
  const variantName = variant?.attributes?.name;
  if (productName && variantName && productName !== variantName) {
    return `${productName} — ${variantName}`;
  }
  return (productName || variantName || "Premium") as string;
}

/**
 * Cherche la variante correspondant au tarif affiché. `null` si elle n'est
 * pas déterminable sans ambiguïté.
 */
async function discoverVariant(): Promise<ResolvedVariant | null> {
  const stores = await lsFetch("/stores?page[number]=1");
  if (!stores.ok || !Array.isArray(stores.body?.data)) return null;

  const matches: ResolvedVariant[] = [];

  for (const store of stores.body.data) {
    const storeId = String(store?.id ?? "");
    if (!storeId) continue;
    const products = await lsFetch(
      `/products?filter[store_id]=${encodeURIComponent(storeId)}&page[number]=1`,
    );
    if (!products.ok || !Array.isArray(products.body?.data)) continue;

    for (const product of products.body.data) {
      const productId = String(product?.id ?? "");
      if (!productId) continue;
      const variants = await lsFetch(
        `/variants?filter[product_id]=${encodeURIComponent(productId)}&page[number]=1`,
      );
      if (!variants.ok || !Array.isArray(variants.body?.data)) continue;

      for (const variant of variants.body.data) {
        const a = variant?.attributes;
        // Filtres STRICTS, tous trois : le prix affiché, la devise
        // affichée, et la périodicité affichée (« par mois »). Un produit
        // annuel au même prix ne doit pas pouvoir être encaissé.
        if (!a || typeof a.price !== "number") continue;
        if (a.price !== EXPECTED_PRICE_CENTS) continue;
        if (a.currency !== "EUR") continue;
        if (a.interval !== "month") continue;
        matches.push({
          storeId,
          variantId: String(variant.id),
          productName: displayName(variant, product),
          priceCents: a.price,
        });
      }
    }
  }

  // Ambiguïté = refus. Deux produits au même tarif mensuel : choisir le
  // premier serait une loterie, et il ne peut pas y avoir de loterie sur un
  // encaissement.
  return matches.length === 1 ? matches[0] : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   SYNCHRONISATION DE L'ÉTAT DU PRESTATAIRE

   Une query Convex ne peut pas lire `process.env`. L'état de configuration
   transite donc par la table `lemonSqueezyProvider`, écrite ici et lue par
   `subscriptions.getPaymentsConfig`. Le client appelle cette action au
   montage de la page des tarifs et des paramètres.
   ═══════════════════════════════════════════════════════════════════════ */

export type SyncResult = {
  ready: boolean;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  variantId: string | null;
  storeId: string | null;
  productName: string | null;
  priceCents: number | null;
  reason: string | null;
  testMode: boolean;
};

async function sync(ctx: { runMutation: (fn: any, args: any) => Promise<any> }): Promise<SyncResult> {
  const hasApiKey = paymentsConfigured();
  const hasWebhookSecret = Boolean(envValue(ENV_WEBHOOK_SECRET));
  const testMode = testModeRequested();

  if (!hasApiKey) {
    await ctx.runMutation(ls.subscriptions.writeProviderStatus, {
      hasApiKey: false,
      hasWebhookSecret,
      ready: false,
      reason: "no_api_key",
      testMode,
    });
    return {
      ready: false,
      hasApiKey,
      hasWebhookSecret,
      variantId: null,
      storeId: null,
      productName: null,
      priceCents: null,
      reason: "no_api_key",
      testMode,
    };
  }

  // 1 · Variable d'environnement d'abord : c'est l'intention explicite.
  let storeId = envValue(ENV_STORE_ID) ?? null;
  let variantId = envValue(ENV_VARIANT_ID) ?? null;
  let productName: string | null = null;
  let priceCents: number | null = null;
  let reason: string | null = null;

  if (variantId && storeId) {
    const res = await lsFetch(`/variants/${encodeURIComponent(variantId)}`);
    const a = res.ok ? res.body?.data?.attributes : null;
    productName = displayName({ attributes: a }, null);
    priceCents = typeof a?.price === "number" ? a.price : null;
    // Le prix renvoyé par l'API doit être celui affiché par l'app : sinon
    // on refuse, plutôt que d'encaisser un montant que la page n'annonce pas.
    if (priceCents !== null && priceCents !== EXPECTED_PRICE_CENTS) {
      reason = "price_mismatch";
    }
  } else {
    // 2 · Sinon on demande à l'API, et on met en cache.
    const discovered = await discoverVariant();
    if (discovered) {
      storeId = discovered.storeId;
      variantId = discovered.variantId;
      productName = discovered.productName;
      priceCents = discovered.priceCents;
    } else {
      const cached = await ctx.runMutation(ls.subscriptions.getCachedProvider, {});
      if (cached?.variantId && cached?.storeId) {
        variantId = cached.variantId;
        storeId = cached.storeId;
        productName = cached.productName ?? null;
        priceCents = cached.priceCents ?? null;
      } else {
        reason = "no_variant";
      }
    }
  }

  const ready = reason === null && Boolean(variantId) && Boolean(storeId);

  await ctx.runMutation(ls.subscriptions.writeProviderStatus, {
    storeId: storeId ?? undefined,
    variantId: variantId ?? undefined,
    productName: productName ?? undefined,
    priceCents: priceCents ?? undefined,
    hasApiKey: true,
    hasWebhookSecret,
    ready,
    reason: reason ?? undefined,
    testMode,
  });

  return {
    ready,
    hasApiKey,
    hasWebhookSecret,
    variantId,
    storeId,
    productName,
    priceCents,
    reason,
    testMode,
  };
}

export const syncPaymentsConfig = action({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    return await sync(ctx);
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   MODULE B — CAISSE
   ═══════════════════════════════════════════════════════════════════════ */

export type CheckoutResult =
  | { ok: true; url: string; testMode: boolean }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "not_signed_in"
        | "no_variant"
        | "price_mismatch"
        | "provider_error";
      /** Message affichable tel quel, déjà rédigé en français. */
      message: string;
    };

/**
 * Origine de retour après paiement.
 *
 * `origin` vient du client (`window.location.origin`) : le serveur ne
 * connaît pas le domaine de la preview, et le deviner serait inventer. On
 * refuse malgré tout une origine qui n'est pas une URL web — un
 * `redirect_url` malveillant est un vecteur d'open redirect depuis la
 * page de paiement du prestataire.
 */
function safeOrigin(origin: string | undefined): string | null {
  if (!origin) return envValue(ENV_APP_URL) ?? null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const createCheckoutSession = action({
  args: {
    /** Origine du navigateur — sert à construire l'URL de retour. */
    origin: v.optional(v.string()),
    /** Langue de la page de paiement (`fr` | `en`, support Lemon Squeezy). */
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CheckoutResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ok: false,
        reason: "not_signed_in",
        message: "Crée ton compte avant de passer au paiement.",
      };
    }

    // On synchronise d'abord : c'est le même chemin de code que la page
    // des tarifs, donc le bouton et l'affichage ne peuvent pas diverger.
    const state = await sync(ctx);

    if (!state.hasApiKey) {
      return {
        ok: false,
        reason: "not_configured",
        message: "Paiement bientôt disponible.",
      };
    }
    if (state.reason === "price_mismatch") {
      return {
        ok: false,
        reason: "price_mismatch",
        message:
          "Le paiement est momentanément indisponible : le tarif affiché ne correspond pas à la formule enregistrée. Écris-nous, on te répond.",
      };
    }
    if (!state.variantId || !state.storeId) {
      return {
        ok: false,
        reason: "no_variant",
        message:
          "Paiement bientôt disponible : l'offre Premium n'est pas encore rattachée à une formule.",
      };
    }

    // 2 · L'e-mail du compte, pré-rempli. Ce n'est qu'un confort : la page
    //     de paiement la redemande et la vérifie elle-même.
    let email: string | null = null;
    try {
      email = await ctx.runMutation(ls.subscriptions.getUserEmail, { userId });
    } catch {
      // Pas bloquant : l'e-mail pré-rempli n'est qu'un gain de temps.
    }

    const origin = safeOrigin(args.origin);

    // 3 · Création de la caisse. L'essai de 7 jours, le prix et sa
    //     périodicité sont configurés DANS Lemon Squeezy, sur la variante :
    //     on ne les redéfinit pas ici, sinon la page de paiement et l'API
    //     divergeraient le jour où le tarif change.
    const created = await lsFetch("/checkouts", {
      method: "POST",
      body: {
        data: {
          type: "checkouts",
          attributes: {
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
              desc: true,
              discount: true,
              subscription_preview: true,
              locale: args.locale === "en" ? "en" : "fr",
              // Palette de l'application (or / nuit).
              background_color: "#1A1F3A",
              headings_color: "#F5C542",
              primary_text_color: "#F5C542",
              secondary_text_color: "#C9CEDF",
              links_color: "#F7DE9B",
              borders_color: "#2B3154",
              button_color: "#F5C542",
              button_text_color: "#1A1F3A",
              checkbox_color: "#F5C542",
              active_state_color: "#F7DE9B",
              terms_privacy_color: "#C9CEDF",
            },
            ...(origin
              ? {
                  product_options: {
                    redirect_url: `${origin}/app/space?abonnement=active`,
                  },
                }
              : {}),
            checkout_data: {
              ...(email ? { email } : {}),
              // `custom.user_id` est ce qui permet au webhook de rattacher
              // l'abonnement au bon compte, sans deviner.
              custom: { user_id: userId },
            },
            test_mode: testModeRequested(),
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
          relationships: {
            store: { data: { type: "stores", id: state.storeId } },
            variant: { data: { type: "variants", id: state.variantId } },
          },
        },
      },
    });

    const url = created.body?.data?.attributes?.url;
    if (!created.ok || typeof url !== "string" || url.length === 0) {
      return {
        ok: false,
        reason: "provider_error",
        message:
          "Le paiement n'a pas pu démarrer. Réessaie dans un instant, ou écris-nous.",
      };
    }

    return {
      ok: true,
      url,
      // La réponse fait foi : c'est elle qui dit si la caisse est en mode
      // test, pas notre configuration.
      testMode: created.body?.data?.attributes?.test_mode === true,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   MODULE D — PORTAIL CLIENT

   L'URL du portail est SIGNÉE et expire (24 h par défaut). Elle ne doit
   donc JAMAIS être stockée en base : on la demande à chaque clic, et c'est
   Lemon Squeezy qui la rend. C'est ce qui rend la promesse de la landing
   (« l'annulation est en un clic, exactement comme l'inscription ») vraie
   plutôt qu'écrite.
   ═══════════════════════════════════════════════════════════════════════ */

export type PortalResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "not_signed_in"
        | "not_subscribed"
        | "provider_error";
      message: string;
    };

export const createPortalSession = action({
  args: {},
  handler: async (ctx): Promise<PortalResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ok: false,
        reason: "not_signed_in",
        message: "Connecte-toi pour gérer ton abonnement.",
      };
    }
    if (!paymentsConfigured()) {
      return {
        ok: false,
        reason: "not_configured",
        message: "La gestion d'abonnement n'est pas encore disponible.",
      };
    }

    const subs: Subscription[] = await ctx.runMutation(ls.subscriptions.listForUser, {
      userId,
    });
    if (subs.length === 0) {
      return {
        ok: false,
        reason: "not_subscribed",
        message: "Tu n'as pas encore d'abonnement.",
      };
    }
    const sub = subs.reduce((best, row) =>
      row.updatedAt > best.updatedAt ? row : best,
    );

    const res = await lsFetch(
      `/subscriptions/${encodeURIComponent(sub.lemonSqueezySubscriptionId)}`,
    );
    const url = res.body?.data?.attributes?.urls?.customer_portal;
    if (!res.ok || typeof url !== "string" || url.length === 0) {
      return {
        ok: false,
        reason: "provider_error",
        message: "Le portail d'abonnement n'a pas répondu. Réessaie dans un instant.",
      };
    }
    return { ok: true, url };
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   MODULE C — WEBHOOK
   ═══════════════════════════════════════════════════════════════════════ */

/** Empreinte SHA-256 du corps brut — clé d'idempotence. */
function digest(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Comparaison à temps constant. `timingSafeEqual` lève si les deux tampons
 * n'ont pas la même LONGUEUR : on compare donc les longueurs d'abord, puis
 * le contenu.
 */
function signatureMatches(raw: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** ISO 8601 → ms epoch, ou `undefined`. */
function isoMs(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Les cinq événements que ce projet traite. */
export const HANDLED_EVENTS = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_payment_failed",
] as const;

type Applied = "applied" | "duplicate" | "unresolved" | "ignored" | "replayed";

/** Codes renvoyés à la route HTTP, avec le statut associé. */
type WebhookCode = Applied | "no_secret" | "missing_signature" | "bad_signature" | "bad_json";

/**
 * Statut déduit de l'ÉVÉNEMENT seul, quand la ressource envoyée n'est pas
 * un abonnement. `subscription_payment_failed` transporte un OBJECTIF DE
 * FACTURE (`subscription-invoices`), pas l'abonnement : sans l'API pour
 * aller le lire, on retient `past_due` — exactement ce que Lemon Squeezy
 * retient de son côté pendant le recouvrement.
 */
function statusForEvent(eventName: string, fallback?: string): PremiumStatus {
  switch (eventName) {
    case "subscription_cancelled":
      return "cancelled";
    case "subscription_expired":
      return "expired";
    case "subscription_payment_failed":
      return "past_due";
    default:
      return normalizeStatus(fallback);
  }
}

type WebhookOutcome = { httpStatus: number; result: Applied; detail: string };

/** Réponse de l'action `processWebhook`, consommée par la route HTTP. */
export type WebhookActionResult = {
  ok: boolean;
  code: WebhookCode;
  detail: string;
  httpStatus: number;
};

async function handleWebhookPayload(
  runMutation: (fn: any, args: any) => Promise<any>,
  raw: string,
): Promise<WebhookOutcome> {
  const key = digest(raw);

  // ── 1 · Idempotence ────────────────────────────────────────────────
  // Un rejeu est acquitté 200 SANS réécrire : c'est ce qu'attend Lemon
  // Squeezy, et c'est ce qui rend le handler rejouable sans effet de bord.
  if (await runMutation(ls.subscriptions.webhookSeen, { key })) {
    return {
      httpStatus: 200,
      result: "duplicate",
      detail: "charge utile déjà traitée (rejeu)",
    };
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Un corps illisible ne sera jamais plus lisible : on refuse sans
    // l'enregistrer, pour ne pas faire rejouer le webhook sans fin.
    return { httpStatus: 400, result: "ignored", detail: "corps JSON illisible" };
  }

  const meta = payload?.meta ?? {};
  const eventName = typeof meta.event_name === "string" ? meta.event_name : "";
  const data = payload?.data ?? {};
  const attributes = data?.attributes ?? {};
  const resourceType = typeof data?.type === "string" ? data.type : undefined;
  const resourceId =
    data?.id === undefined || data?.id === null ? undefined : String(data.id);

  const record = async (resolved: boolean, resId?: string) => {
    await runMutation(ls.subscriptions.recordWebhook, {
      key,
      eventName: eventName || "unknown",
      resourceType,
      resourceId: resId ?? resourceId,
      resolved,
    });
  };

  if (!HANDLED_EVENTS.includes(eventName as (typeof HANDLED_EVENTS)[number])) {
    await record(false);
    return {
      httpStatus: 200,
      result: "ignored",
      detail: `événement non traité : ${eventName || "sans nom"}`,
    };
  }

  // ── 2 · Retrouver le compte Kilingo ───────────────────────────────
  // Deux voies, dans cet ordre :
  //   a) `meta.custom_data.user_id`, posé par NOUS à la création de la
  //      caisse : infallible et instantané ;
  //   b) à défaut, l'e-mail de l'abonné, réconcilié sur la table `users`.
  //      C'est lent et fragile, mais mieux que perdre un paiement : un
  //      client qui a payé doit avoir accès.
  let userId: Id<"users"> | null = null;
  const customUserId = meta?.custom_data?.user_id;
  if (typeof customUserId === "string" && customUserId.length > 0) {
    userId = customUserId as Id<"users">;
  }
  const email =
    typeof attributes.user_email === "string" ? attributes.user_email : undefined;
  if (!userId && email) {
    userId = await runMutation(ls.subscriptions.findUserByEmail, { email });
  }

  if (!userId) {
    await record(false);
    return {
      httpStatus: 200,
      result: "unresolved",
      detail: "aucun compte Kilingo ne correspond à cet abonnement",
    };
  }

  // ── 3 · Charger l'abonnement, même quand l'événement est une facture ──
  let subAttributes = attributes;
  let subscriptionId: string | null = resourceId ?? null;
  if (resourceType !== "subscriptions") {
    const fromInvoice = attributes.subscription_id;
    if (fromInvoice !== undefined && fromInvoice !== null) {
      subscriptionId = String(fromInvoice);
    }
    // Une facture ne porte pas le statut de l'abonnement : on va le lire
    // à la source. Si l'API ne répond pas, on retombe sur l'événement.
    if (subscriptionId) {
      const res = await lsFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
      if (res.ok && res.body?.data?.attributes) {
        subAttributes = res.body.data.attributes;
      }
    }
  }
  if (!subscriptionId) {
    await record(true);
    return {
      httpStatus: 200,
      result: "ignored",
      detail: "aucun identifiant d'abonnement dans la charge utile",
    };
  }

  // ── 4 · Écrire (upsert) ───────────────────────────────────────────
  const rawStatus =
    typeof subAttributes.status === "string"
      ? subAttributes.status
      : statusForEvent(eventName);
  const status = statusForEvent(
    eventName,
    typeof subAttributes.status === "string" ? subAttributes.status : undefined,
  );

  // Pour un abonnement résilié, Lemon Squeezy expose `ends_at` (fin de
  // grâce) et laisse `renews_at` sur l'ancienne échéance : c'est `ends_at`
  // qui fait foi pour l'accès restant.
  const periodEnd =
    eventName === "subscription_cancelled"
      ? (isoMs(subAttributes.ends_at) ?? isoMs(subAttributes.renews_at))
      : (isoMs(subAttributes.renews_at) ?? isoMs(subAttributes.ends_at));

  const written = await runMutation(ls.subscriptions.upsertSubscription, {
    userId,
    lemonSqueezySubscriptionId: subscriptionId,
    lemonSqueezyStatus: rawStatus,
    lemonSqueezyCustomerId:
      attributes.customer_id === undefined || attributes.customer_id === null
        ? undefined
        : String(attributes.customer_id),
    variantId:
      subAttributes.variant_id === undefined || subAttributes.variant_id === null
        ? undefined
        : String(subAttributes.variant_id),
    currentPeriodEnd: periodEnd,
    trialEndsAt: isoMs(subAttributes.trial_ends_at),
    email:
      typeof subAttributes.user_email === "string" ? subAttributes.user_email : email,
    testMode: subAttributes.test_mode === true,
    lemonSqueezyUpdatedAt: isoMs(subAttributes.updated_at),
  });

  await record(true, subscriptionId);

  const action = written?.action === "stale" ? "replayed" : "applied";
  return {
    httpStatus: 200,
    result: action,
    detail: `${eventName} → ${status}${
      action === "replayed" ? " (événement antérieur ignoré)" : ""
    }`,
  };
}

/**
 * MODULE C — vérification + traitement d'un webhook Lemon Squeezy.
 *
 * Action PUBLIQUE, et c'est délibéré : elle est le seul endroit où le
 * secret de signature existe, et elle est la seule à pouvoir l'utiliser.
 * Being publique n'ouvre rien, puisque la première chose qu'elle fait est
 * de refuser toute charge utile dont la signature ne correspond pas. La
 * route HTTP (`lemonsqueezyWebhook.ts`, runtime classique) lui transmet le
 * corps BRUT et l'en-tête, et traduit le résultat en code HTTP.
 *
 * Ordre STRICT, et il compte :
 *   1. le secret doit exister        (sinon 503) ;
 *   2. la signature doit être présente (sinon 401) ;
 *   3. la signature doit correspondre (sinon 401) ;
 *   4. seulement ensuite on parse et on écrit.
 * Analyser avant de vérifier ferait travailler la route sur une charge
 * utile forgée.
 */
export const processWebhook = action({
  args: {
    /** Corps BRUT de la requête, tel que Lemon Squeezy l'a envoyé. */
    payload: v.string(),
    /** Valeur de l'en-tête `X-Signature`. */
    signature: v.string(),
  },
  handler: async (ctx, args): Promise<WebhookActionResult> => {
    const secret = envValue(ENV_WEBHOOK_SECRET);
    if (!secret) {
      // Pas de secret = pas de vérification possible. Refuser est la seule
      // réponse défendable : accepter sans vérifier ouvrirait l'activation
      // de Premium à qui veut envoyer une requête.
      return {
        ok: false,
        code: "no_secret",
        detail: "webhook non configuré (LEMONSQUEEZY_WEBHOOK_SECRET absent)",
        httpStatus: 503,
      };
    }

    if (!args.signature || args.signature.length === 0) {
      return {
        ok: false,
        code: "missing_signature",
        detail: "X-Signature absente",
        httpStatus: 401,
      };
    }

    if (!signatureMatches(args.payload, args.signature, secret)) {
      return {
        ok: false,
        code: "bad_signature",
        detail: "signature invalide",
        httpStatus: 401,
      };
    }

    const outcome = await handleWebhookPayload(
      async (fn, mutationArgs) => {
        return await ctx.runMutation(fn, mutationArgs);
      },
      args.payload,
    );

    return {
      ok: outcome.result === "applied" || outcome.result === "duplicate",
      code: outcome.result,
      detail: outcome.detail,
      httpStatus: outcome.httpStatus,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   DIAGNOSTIC (Paramètres + outillage de déploiement)

   Relit l'API pour confirmer que la clé fonctionne et que la variante visée
   existe vraiment. Ne renvoie AUCUNE clé, aucun secret : uniquement des
   identifiants publics et des drapeaux.
   ═══════════════════════════════════════════════════════════════════════ */

export type ProviderReport = {
  ok: boolean;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  /** La clé est-elle acceptée par l'API ? */
  apiReachable: boolean;
  apiStatus: number;
  variantId: string | null;
  storeId: string | null;
  priceCents: number | null;
  currency: string | null;
  interval: string | null;
  matchesDisplayedPrice: boolean | null;
  expectedPriceCents: number;
  testMode: boolean;
  /** Message court, affichable tel quel. */
  message: string;
};

export const inspectProvider = action({
  args: {},
  handler: async (): Promise<ProviderReport> => {
    const hasApiKey = paymentsConfigured();
    const expectedPriceCents = EXPECTED_PRICE_CENTS;
    const base: ProviderReport = {
      ok: false,
      hasApiKey,
      hasWebhookSecret: Boolean(envValue(ENV_WEBHOOK_SECRET)),
      apiReachable: false,
      apiStatus: 0,
      variantId: envValue(ENV_VARIANT_ID) ?? null,
      storeId: envValue(ENV_STORE_ID) ?? null,
      priceCents: null,
      currency: null,
      interval: null,
      matchesDisplayedPrice: null,
      expectedPriceCents,
      testMode: testModeRequested(),
      message: "Paiement non configuré.",
    };
    if (!hasApiKey) return base;

    const stores = await lsFetch("/stores?page[number]=1");
    if (!stores.ok) {
      return {
        ...base,
        apiReachable: false,
        apiStatus: stores.status,
        message: "Clé API refusée par Lemon Squeezy.",
      };
    }

    // Variante visée : variable d'environnement d'abord, sinon découverte.
    let variantId = envValue(ENV_VARIANT_ID) ?? null;
    let storeId = envValue(ENV_STORE_ID) ?? null;
    if (!variantId) {
      const discovered = await discoverVariant();
      if (discovered) {
        variantId = discovered.variantId;
        storeId = discovered.storeId;
      }
    }
    if (!variantId) {
      return {
        ...base,
        apiReachable: true,
        apiStatus: stores.status,
        storeId,
        message:
          "Aucune variante ne correspond au tarif affiché : vérifie que le produit Premium existe chez Lemon Squeezy, ou renseigne LEMONSQUEEZY_VARIANT_ID.",
      };
    }

    const res = await lsFetch(`/variants/${encodeURIComponent(variantId)}`);
    const attrs = res.ok ? res.body?.data?.attributes : null;
    const priceCents = typeof attrs?.price === "number" ? attrs.price : null;

    return {
      ok: true,
      hasApiKey,
      hasWebhookSecret: Boolean(envValue(ENV_WEBHOOK_SECRET)),
      apiReachable: true,
      apiStatus: stores.status,
      variantId,
      storeId,
      priceCents,
      currency: typeof attrs?.currency === "string" ? attrs.currency : null,
      interval: typeof attrs?.interval === "string" ? attrs.interval : null,
      matchesDisplayedPrice: priceCents === expectedPriceCents,
      expectedPriceCents,
      testMode: testModeRequested(),
      message:
        priceCents === expectedPriceCents
          ? "Prestataire opérationnel."
          : `ATTENTION : la variante vaut ${priceCents ?? "?"} centimes, l'application affiche ${expectedPriceCents}.`,
    };
  },
});
