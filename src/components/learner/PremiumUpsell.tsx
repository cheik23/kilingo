import { Link } from "react-router";
import { Sparkles } from "lucide-react";

import { useI18n } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════
   INVITE PREMIUM — le même panneau pour les trois verrous

   Un composant, trois usages (langues, quota Shadow, personnages). Pas par
   goût de factoriser : parce que les trois blocages doivent avoir exactement
   la même forme, et parce qu'un ton différent selon le verrou est la
   manière la plus simple de faire douter de ce que vaut l'ensemble.

   CE QUE CE PANNEAU FAIT, ET CE QU'IL NE FAIT PAS

   · Il nomme un GAIN, jamais une perte. Le texte vient de
     `i18n.premium.ts`, pas d'ici : la formulation est donc vérifiable par
     `verify-premium-locks.mjs` et traduite dans les 12 langues.

   · Il ne simule pas l'urgence. Aucun compte à rebours, aucune date
     limite. Le quota Shadow, lui, affiche sa VRAIE heure de remise à
     zéro — laquelle est calculée par le serveur, pas comptée ici.

   · Il ne cache rien : il mène vers la page des tarifs, où le prix,
     l'essai et l'annulation sont écrits. Un bouton « découvrir » sans
     tarif serait une autre promesse creuse.

   · Il propose TOUJOURS une issue gratuite quand il y en a une
     (`freeAction`) : désactiver l'autre langue, attendre minuit, ou
     continuer avec les deux personnages déjà ouverts. Verrouiller
     sans échappatoire est un otage, pas une offre.
   ═══════════════════════════════════════════════════════════════════════ */

export type PremiumUpsellProps = {
  /** Titre du verrou (« Une langue à la fois… »). */
  title: string;
  /** Corps : le gain, en clair. */
  body: string;
  /** Libellé du bouton principal, orienté GAIN. */
  cta: string;
  /**
   * Issue gratuite, quand elle existe. Toujours rendue en premier : un
   * utilisateur bloqué doit voir la porte de sortie avant l'offre.
   */
  freeAction?: { label: string; onClick: () => void };
  /** `inline` dans une liste, `card` en pleine page. */
  variant?: "inline" | "card";
};

export function PremiumUpsell({
  title,
  body,
  cta,
  freeAction,
  variant = "inline",
}: PremiumUpsellProps) {
  const { t } = useI18n();

  return (
    <div
      className={
        variant === "card"
          ? "ln-card space-y-3 p-5"
          : "mt-3 space-y-2 rounded-xl border border-gold/25 bg-gold/[0.05] p-4"
      }
      // Le message est annoncé : il apparaît APRÈS une action de
      // l'utilisateur, donc il ne le surprend pas — mais il doit être lu
      // par un lecteur d'écran qui ne voit pas la zone de clic.
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-gold">{title}</p>
      <p className="text-xs leading-relaxed text-ink-2">{body}</p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          to="/#pricing"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold to-gold-soft px-3.5 py-1.5 text-xs font-semibold text-noir transition-transform hover:scale-[1.02]"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {cta}
        </Link>

        {freeAction ? (
          <button
            type="button"
            onClick={freeAction.onClick}
            className="text-xs text-ink-2 underline decoration-white/20 underline-offset-4 transition-colors hover:text-gold hover:decoration-gold/50"
          >
            {freeAction.label}
          </button>
        ) : null}
      </div>

      {variant === "card" ? (
        <p className="text-[0.6875rem] leading-relaxed text-ink-3">
          {t("premium.upsell.finePrint")}
        </p>
      ) : null}
    </div>
  );
}
