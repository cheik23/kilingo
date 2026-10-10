import { useMemo } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router";
import { ArrowRight, Sparkles, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useOptionalQuery } from "@/lib/optionalQuery";
import {
  UPGRADE_MOMENT_KEYS,
  type UpgradeMomentKey,
} from "@/lib/i18n.upgrade";

/* ═══════════════════════════════════════════════════════════════════
   MOMENTS POST-ENGAGEMENT (Module B du lot « conversion »)

   Trois moments où l'utilisateur vient de finir quelque chose :
     · `firstLesson` — au moins une leçon au quiz passée (`quizzesTaken`);
     · `avatar`      — un avatar a été enregistré (`getMyAvatarConfig`);
     · `streak3`     — trois jours d'affilée (`currentStreak`).

   Trois règles du brief tenues ici, et vérifiables :

   1. JAMAIS AVANT. Chaque moment a un seuil réel, mesuré par une requête
      Convex : le composant ne s'affiche pas tant que la condition n'est pas
      remplie. Aucun `setTimeout` ne déclenche l'affichage.

   2. JAMAIS DEUXIÈME FOIS. Un moment déjà montré (ou fermé) est écrit dans
      `localStorage` et ne revient plus — pour cet appareil. Fermer n'est pas
      « plus tard » : c'est « pas maintenant, merci ». Le rappel qui revient
      tous les jours est du bruit, et le bruit tue la conversion mieux que
      l'absence.

   3. UN SEUL BOUTON. Le CTA mène à la page des tarifs, où le prix, la durée
      de l'essai et le fait qu'aucun paiement n'est branché sont écrits en
      toutes lettres. Aucune inscription à une liste d'attente, aucun second
      bouton « voir la démo » qui partagerait le même poids : un seul chemin,
      et il est lisible.

   AUCUN compte à rebours, AUCUNE date limite, AUCUNE mention de stock ou de
   places. Le texte valorise l accomplishments accomplished, puis nomme un
   gain concret (« enlève le plafond du shadowing »), jamais une perte.
   ═══════════════════════════════════════════════════════════════════ */

/** Préfixe des clés de fermeture — versionné pour pouvoir invalider. */
const KEY_PREFIX = "ln.upgrade.seen.v1";

/** Seuil du moment « streak ». */
const STREAK_THRESHOLD = 3;

function seenKey(moment: UpgradeMomentKey): string {
  return `${KEY_PREFIX}.${moment}`;
}

function isSeen(moment: UpgradeMomentKey): boolean {
  try {
    return localStorage.getItem(seenKey(moment)) === "1";
  } catch {
    // Mode privé / stockage refusé : le moment reste visible pour cette
    // session. Un rappel en trop vaut mieux qu'un rappel absent à cause
    // d'une exception.
    return false;
  }
}

function markSeen(moment: UpgradeMomentKey): void {
  try {
    localStorage.setItem(seenKey(moment), "1");
  } catch {
    /* sans stockage : le moment réapparaîtra, sans crash */
  }
}

/**
 * Moment à afficher, le plusprioritaire si plusieurs seuils sont franchis.
 * L'ordre suit la progression naturelle : la première leçon, puis l'identité
 * (avatar), puis la régularité (streak).
 */
function pickMoment(ready: Record<UpgradeMomentKey, boolean>): UpgradeMomentKey | null {
  for (const key of UPGRADE_MOMENT_KEYS) {
    if (ready[key] && !isSeen(key)) return key;
  }
  return null;
}

export function UpgradeMoment() {
  const { t } = useI18n();
  const stats = useQuery(api.gamification.getUserStats);
  // Kilingo : l'avatar « créé ou changé » est l'avatar RPM enregistré par le
  // studio (`setRpmAvatar`) — c'est le seul artefact d'avatar persisté côté
  // compte, l'équivalent du `getMyAvatarConfig` de la source.
  const avatarUrl = useOptionalQuery(api.customization.getMyRpmAvatarUrl, {});

  // Tant qu'une des deux requêtes est en vol, on ne conclut rien : afficher
  // le moment « première leçon » à un utilisateur qui en a fait dix serait
  // faux, et se tromper de message ferait pire que ne rien afficher.
  //
  // Une fonction absente du déploiement (`unavailable`) ne vaut pas « en
  // vol » : sinon le moment resterait bloqué sur un chargement éternel. On
  // tranche alors sur ce qu'on SAIT — l'avatar est ignoré, faute de pouvoir
  // le lire — et les autres seuils (leçon, série) gardent leur mot à dire.
  const loaded =
    stats !== undefined && (avatarUrl.data !== undefined || avatarUrl.unavailable);

  const moment = useMemo<UpgradeMomentKey | null>(() => {
    if (!loaded || !stats) return null;
    return pickMoment({
      firstLesson: stats.quizzesTaken >= 1,
      avatar: avatarUrl.data != null,
      streak3: stats.currentStreak >= STREAK_THRESHOLD,
    });
  }, [loaded, stats, avatarUrl.data]);

  if (!moment) return null;

  const close = () => markSeen(moment);

  return (
    <AnimatePresence>
      <motion.aside
        key={moment}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        aria-labelledby="upgrade-moment-title"
        className="mx-4 mt-4 rounded-2xl border border-gold/30 bg-[#1A1F3A] p-4 lg:mx-8"
      >
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p id="upgrade-moment-title" className="text-sm font-semibold text-gold">
              {t("upgrade.badge")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              {t(`upgrade.moments.${moment}`)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">{t("upgrade.note")}</p>
            <Link
              to="/#pricing"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold to-gold-soft px-4 py-2 text-sm font-semibold text-noir transition-transform hover:scale-[1.02]"
            >
              {t("upgrade.cta")}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("upgrade.dismiss")}
            className="shrink-0 rounded-full p-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
