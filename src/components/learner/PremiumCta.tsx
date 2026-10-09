import { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Lock, Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCheckout, usePaymentsReady } from "@/lib/payments";

/* ═══════════════════════════════════════════════════════════════════════
   BOUTON « ESSAYER PREMIUM » — MODULE B

   Un seul composant, utilisé par la landing ET par l'application, parce
   qu'il n'y a qu'une seule décision à prendre : le paiement est-il
   possible ? Si oui, on crée la caisse et on redirige vers Lemon
   Squeezy. Si non, on le DIT — « bientôt disponible » — au lieu de
   mener à une caisse qui échouerait au moment de sortir la carte.

   Trois règles, chacune vérifiable :

   1. PAS DE COMPTE, PAS DE CAISSE. Un visiteur non connecté est d'abord
      envoyé vers l'inscription, avec `returnTo` pour revenir ici. Créer
      une caisse pour quelqu'un qui n'a pas de compte produirait un
      abonnement qu'on ne pourrait rattacher à personne.

   2. PAS DE MONTANT ICI. Le prix affiché vient de `lib/pricing.ts`, le
      prix encaissé vient de la formule chez Lemon Squeezy. Ce composant
      ne connaît ni l'un ni l'autre : il ne fait qu'ouvrir une page.

   3. L'ÉCHEC EST DIT. Si la caisse ne se crée pas, le message du serveur
      s'affiche sous le bouton. On n'affiche jamais un « ça a marché »
      qui n'a pas eu lieu.
   ═══════════════════════════════════════════════════════════════════════ */

export type PremiumCtaProps = {
  /** Libellé du bouton — la copy est traduite, jamais écrite ici. */
  label: string;
  /** Code de langue de l'interface, pour la page de paiement. */
  lang: string;
  /** Destination de retour si l'utilisateur doit s'inscrire. */
  returnTo?: string;
  /** `href` de secours quand la caisse n'est pas possible. */
  fallbackHref?: string;
  className?: string;
  /** Version courte, pour un emplacement secondary. */
  size?: "primary" | "secondary";
};

export function PremiumCta({
  label,
  lang,
  returnTo = "/#pricing",
  fallbackHref,
  className = "ln-cta-primary mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold",
  size = "primary",
}: PremiumCtaProps) {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const payments = usePaymentsReady(lang);
  const { start, phase, error } = useCheckout();
  const [showNotice, setShowNotice] = useState(false);

  const busy = phase !== "idle";
  const ready = payments.ready === true;
  /**
   * Le message « bientôt disponible » s'affiche DÈS QUE le serveur a
   * répondu, sans attendre un clic.
   *
   * C'est la différence entre une information et une devinette : laisser
   * l'utilisateur découvrir l'indisponibilité en sortant sa carte serait
   * exactement le manque d'honnêteté que ce lot répare ailleurs. Tant que
   * la réponse est en vol (`undefined`), on n'affiche rien — on ne peut
   * pas annoncer une absence avant de l'avoir constatée.
   */
  const noticeVisible = showNotice || payments.ready === false;

  const onClick = () => {
    // 1 · Sans compte : inscription d'abord, retour ici ensuite. Créer
    // une caisse pour quelqu'un qui n'a pas de compte produirait un
    // abonnement qu'on ne pourrait rattacher à personne.
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    // 2 · Prestataire non confirmé : on le dit, on ne redirige pas.
    if (!ready) {
      setShowNotice(true);
      return;
    }
    // 3 · Caisse possible : on la crée, et c'est Lemon Squeezy qui encaisse.
    void start(lang);
  };

  return (
    <div className={size === "primary" ? "" : "w-full"}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || authLoading}
        aria-busy={busy}
        className={`${className} disabled:cursor-progress disabled:opacity-70 ${
          size === "secondary"
            ? "rounded-lg border border-gold/40 px-4 py-2 text-sm"
            : ""
        }`}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {phase === "redirecting" ? "Redirection…" : "Préparation…"}
          </>
        ) : (
          <>
            {size === "primary" ? (
              <Sparkles className="size-4" aria-hidden="true" />
            ) : (
              <Lock className="size-3.5" aria-hidden="true" />
            )}
            {label}
          </>
        )}
      </button>

      {/* L'information qui décide : si on ne peut pas payer, on le dit ICI,
          sous le bouton, dans le corps du texte — pas en 10 px en bas de
          section. C'est exactement l'information que la règle du Module C
          (« pas de dissimulation ») impose. */}
      {noticeVisible ? (
        <p
          role="status"
          className="mt-3 max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-ink-2"
        >
          {payments.soonMessage}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 max-w-md rounded-xl border border-red-400/25 bg-red-500/[0.06] p-3 text-xs leading-relaxed text-red-200"
        >
          {error}
        </p>
      ) : null}

      {/* Repli discret quand la caisse est impossible : on ne supprime pas
          le chemin, on le déplace vers l'inscription, qui est gratuit. */}
      {!ready && !noticeVisible && fallbackHref ? (
        <a
          href={fallbackHref}
          className="mt-3 inline-block text-xs text-ink-3 underline underline-offset-4 transition-colors hover:text-gold"
        >
          Créer un compte gratuit d'abord
        </a>
      ) : null}
    </div>
  );
}
