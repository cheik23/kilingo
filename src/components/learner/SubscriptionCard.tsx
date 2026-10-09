import { useQuery } from "convex/react";
import { CalendarClock, ExternalLink, Loader2, Sparkles } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { useCustomerPortal } from "@/lib/payments";

/* ═══════════════════════════════════════════════════════════════════════
   ABONNEMENT — MODULE D

   La FAQ de la landing promet « l'annulation est en un clic, exactement
   comme l'inscription ». Cette carte est la moitié de cette promesse : elle
   rend le bouton « Gérer mon abonnement » accessible, et il mène au
   portail officiel de Lemon Squeezy.

   Pourquoi ne pas construire NOTRE formulaire de résiliation ? Parce que
   Lemon Squeezy est le Marchand of Record : c'est lui qui détient la
   carte bancaire et la comptabilité. Un formulaire maison devrait
   PRODUIRE une demande, attendre un traitement humain, et pendant ce temps
   l'abonnement continuerait de facturer — c'est-à-dire exactement le
   parcours que la landing refuse de promettre. Le portail, lui, est
   immédiat, et il est le seul à faire foi.

   L'URL du portail est signée et expire : elle n'est jamais stockée, elle
   est demandée au clic. `getMyPremiumStatus` reste la seule source de
   vérité de l'accès — cette carte ne la recalcule pas, elle la LIT.
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_FR: Record<string, string> = {
  active: "Abonnement actif",
  trialing: "Essai gratuit en cours",
  past_due: "Paiement en attente — ton accès est conservé le temps qu'on règle ça",
  cancelled: "Résilié — tu gardes l'accès jusqu'à la fin de la période payée",
  expired: "Abonnement terminé",
};

const STATUS_EN: Record<string, string> = {
  active: "Active subscription",
  trialing: "Free trial in progress",
  past_due: "Payment pending — your access is kept while we sort it out",
  cancelled: "Cancelled — you keep access until the end of the paid period",
  expired: "Subscription ended",
};

const LABELS_FR = {
  title: "Abonnement",
  manage: "Gérer mon abonnement",
  manageHint:
    "Ouvre le portail Lemon Squeezy : tu y changes de formule, mets à jour ta carte, ou tu résilies en deux clics.",
  loading: "Chargement…",
  open: "Ouvrir le portail",
  renews: "Prochaine échéance",
  until: "Accès jusqu'au",
  trialEnd: "Fin de l'essai",
  none: "Aucun abonnement. La version gratuite reste active pour toujours.",
  sandbox: "Abonnement de test : aucun montant réel n'a été débité.",
  signedOut: "Connecte-toi pour gérer ton abonnement.",
};

const LABELS_EN = {
  title: "Subscription",
  manage: "Manage my subscription",
  manageHint:
    "Opens the Lemon Squeezy portal: change plan, update your card, or cancel in two clicks.",
  loading: "Loading…",
  open: "Open the portal",
  renews: "Next billing date",
  until: "Access until",
  trialEnd: "Trial ends",
  none: "No subscription. The free version stays active for good.",
  sandbox: "Test subscription: no real amount was charged.",
  signedOut: "Sign in to manage your subscription.",
};

function formatDate(ms: number | null, lang: string): string | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function SubscriptionCard({ lang = "fr" }: { lang?: string }) {
  const en = lang.startsWith("en");
  const L = en ? LABELS_EN : LABELS_FR;
  const S = en ? STATUS_EN : STATUS_FR;

  const status = useQuery(api.subscriptions.getMyPremiumStatus);
  const { open, loading, error } = useCustomerPortal();

  // `undefined` = la query est en vol. On ne conclut rien : afficher
  // « aucun abonnement » à quelqu'un qui en a un serait faux.
  if (status === undefined) {
    return (
      <section className="ln-card p-5">
        <h2 className="text-sm font-semibold text-ink">{L.title}</h2>
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-3">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {L.loading}
        </p>
      </section>
    );
  }

  const statusLabel = status.status ? (S[status.status] ?? status.lemonSqueezyStatus) : null;
  const periodEnd = formatDate(status.currentPeriodEnd, lang);
  const trialEnd = formatDate(status.trialEndsAt, lang);

  return (
    <section className="ln-card p-5" aria-labelledby="subscription-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="subscription-title" className="text-sm font-semibold text-ink">
          {L.title}
        </h2>
        {status.isPremium ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[0.6875rem] font-medium text-gold">
            <Sparkles className="size-3" aria-hidden="true" />
            Premium
          </span>
        ) : null}
      </div>

      {status.testMode ? (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-xs leading-relaxed text-ink-3">
          {L.sandbox}
        </p>
      ) : null}

      {!status.hasSubscription ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">{L.none}</p>
          {/* Pas d'abonnement → pas de portail : afficher « gérer mon
              abonnement » serait promettre une page qui n'existe pas. */}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink">{statusLabel}</p>

          <dl className="mt-3 space-y-1.5 text-xs text-ink-3">
            {status.status === "trialing" && trialEnd ? (
              <div className="flex items-center gap-2">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                <dt className="sr-only">{L.trialEnd}</dt>
                <dd>{trialEnd}</dd>
              </div>
            ) : null}
            {periodEnd ? (
              <div className="flex items-center gap-2">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                <dt className="sr-only">
                  {status.status === "cancelled" ? L.until : L.renews}
                </dt>
                <dd>{periodEnd}</dd>
              </div>
            ) : null}
          </dl>

          <button
            type="button"
            onClick={() => void open()}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gold/40 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="size-4" aria-hidden="true" />
            )}
            {loading ? L.loading : L.manage}
          </button>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-3">{L.manageHint}</p>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
