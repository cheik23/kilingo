import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";

import { api } from "@/convex/_generated/api";

/* ═══════════════════════════════════════════════════════════════════════
   PAIEMENT — CÔTÉ NAVIGATEUR

   Ce fichier ne contient QUE de la présentation et un appel d'action. Il ne
   connaît ni clé, ni identifiant de formule, ni montant : tout vient du
   serveur, qui est la seule autorité (voir `convex/lemonsqueezy.ts`).

   ⚠ RÈGLE D'HONNÊTETÉ, ET ELLE EST LA RAISON D'ÊTRE DE CE FICHIER

   L'interface ne promet un paiement que si le serveur a CONFIRMÉ qu'il
   peut encaisser (`getPaymentsConfig.checkoutReady`). Tant que ce n'est
   pas le cas — clé absente, formule pas encore rattachée, déploiement pas
   synchronisé — le bouton affiche « bientôt disponible » au lieu de
   mener à une caisse. Un bouton « payer » qui ne paie pas est le pire des
   deux mondes : l'utilisateur découvre le problème au moment de sortir
   sa carte.
   ═══════════════════════════════════════════════════════════════════════ */

/** État du bouton pendant une tentative d'achat. */
export type CheckoutPhase = "idle" | "loading" | "redirecting";

/** Ce que l'action `createCheckoutSession` peut répondre. */
export type CheckoutOutcome =
  | { ok: true; url: string; testMode: boolean }
  | { ok: false; reason: string; message: string };

/**
 * Message affiché quand le paiement n'est pas encore possible.
 *
 * Volontairement court et daté plutôt que vague : « bientôt » sans
 * échéance reassure celui qui attend, mais n-help pas celui qui veut
 * savoir s'il peut payer MAINTENANT. La formulation dit les deux.
 */
export const SOON_AVAILABLE_FR =
  "Paiement bientôt disponible : l'offre n'est pas encore ouverte. Ta création de compte, elle, est gratuite et immédiate.";

export const SOON_AVAILABLE_EN =
  "Payment coming soon: the plan isn't open yet. Creating your account, on the other hand, is free and instant.";

/** Messages d'erreur déjà rédigés par l'action, donc dans la bonne langue. */
function pick(lang: string, fr: string, en: string): string {
  return lang.startsWith("en") ? en : fr;
}

/** Repli générique quand la langue d'interface est inconnue. */
export function soonMessageFor(lang: string | undefined): string {
  return pick(lang ?? "fr", SOON_AVAILABLE_FR, SOON_AVAILABLE_EN);
}

/**
 * Déclenche une caisse Lemon Squeezy.
 *
 * `origin` est transmis au serveur pour qu'il puisse construire l'URL de
 * retour : le serveur ne connaît pas le domaine de la preview, et le
 * deviner serait inventer. Le serveur refuse de toute façon une origine
 * qui n'est pas une URL web.
 */
export function useCheckout() {
  const createCheckout = useAction(api.lemonsqueezy.createCheckoutSession);
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (locale: string): Promise<CheckoutOutcome> => {
      setError(null);
      setPhase("loading");
      try {
        const result = (await createCheckout({
          origin: typeof window === "undefined" ? undefined : window.location.origin,
          locale,
        })) as CheckoutOutcome;

        if (result.ok) {
          setPhase("redirecting");
          // Redirection ENTIÈRE : la page de paiement est hébergée par le
          // prestataire et n'a rien à voir avec notre application. Un
          // `fetch` ne conviendrait pas, et laisser l'onglet actuel
          // affairé par une modale de paiement est une mauvaise idée.
          if (typeof window !== "undefined") window.location.assign(result.url);
          return result;
        }

        setPhase("idle");
        setError(result.message);
        return result;
      } catch (err) {
        setPhase("idle");
        setError(
          err instanceof Error
            ? err.message
            : "Le paiement n'a pas pu démarrer. Réessaie dans un instant.",
        );
        return { ok: false, reason: "exception", message: "Paiement indisponible." };
      }
    },
    [createCheckout],
  );

  return { start, phase, error, setError };
}

/**
 * Ouvre le portail client Lemon Squeezy.
 *
 * L'URL est SIGNÉE et expire : elle n'est jamais stockée, seulement
 * demandée au moment du clic. C'est ce qui permet à l'annulation
 * d'être réellement « en un clic », et pas une promesse de plus.
 */
export function useCustomerPortal() {
  const createPortal = useAction(api.lemonsqueezy.createPortalSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const result = (await createPortal({})) as
        | { ok: true; url: string }
        | { ok: false; reason: string; message: string };
      if (result.ok) {
        if (typeof window !== "undefined") window.location.assign(result.url);
        return true;
      }
      setError(result.message);
      return false;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Le portail n'a pas répondu. Réessaie.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [createPortal]);

  return { open, loading, error };
}

/* ═══════════════════════════════════════════════════════════════════════
   ÉTAT « LE PAIEMENT EST-IL POSSIBLE ? »
   ═══════════════════════════════════════════════════════════════════════ */

export type PaymentsReadiness = {
  /** `undefined` = la synchronisation n'a pas encore répondu. */
  ready: boolean | undefined;
  /** Une clé API a-t-elle été vue par le déploiement ? */
  hasApiKey: boolean;
  variantId: string | null;
  productName: string | null;
  testMode: boolean;
  priceEur: number;
  trialDays: number;
  /** Message « bientôt disponible » dans la langue de l'interface. */
  soonMessage: string;
};

const SOON: Record<string, string> = {
  fr: SOON_AVAILABLE_FR,
  en: SOON_AVAILABLE_EN,
};

/**
 * Lit l'état du prestataire et déclenche une synchronisation au montage.
 *
 * `undefined` = « on ne sait pas encore ». L'interface traite cet état
 * comme « pas prêt » : afficher un bouton de paiement avant d'avoir la
 * confirmation du serveur serait promettre ce qu'on n'a pas vérifié.
 */
export function usePaymentsReady(lang: string): PaymentsReadiness {
  const config = useQuery(api.subscriptions.getPaymentsConfig);
  const sync = useAction(api.lemonsqueezy.syncPaymentsConfig);

  // Une seule synchronisation par page montée : c'est la SEULE action qui
  // lit les variables d'environnement, et l'y rappeler à chaque rendu
  // serait du trafic inutile. Son résultat est écrit en base, donc la query
  // se rafraîchit toute seule et le composant n'a plus rien à demander.
  useEffect(() => {
    let cancelled = false;
    void sync()
      .catch(() => {
        /* Sans clé, l'action répond « non configuré » au lieu de lever ;
           une erreur ici ne doit jamais casser la page. */
      })
      .finally(() => {
        void cancelled;
      });
    return () => {
      cancelled = true;
    };
  }, [sync]);

  const soonMessage = SOON[lang] ?? SOON_AVAILABLE_FR;
  return {
    // `undefined` = « pas encore de réponse » → traité comme « pas prêt ».
    ready: config?.checkoutReady,
    hasApiKey: config?.hasApiKey === true,
    variantId: config?.variantId ?? null,
    productName: config?.productName ?? null,
    testMode: config?.testMode === true,
    priceEur: config?.priceEur ?? 0,
    trialDays: config?.trialDays ?? 0,
    soonMessage,
  };
}
