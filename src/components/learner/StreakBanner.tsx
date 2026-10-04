import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Flame, Snowflake, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { soundEngine } from "@/lib/soundEngine";
import { useMascotSafe } from "@/components/three/MascotProvider";
import { MascotSprite } from "@/components/three/MascotSprite";

/* Les cristaux de glace ne sont chargés qu'au moment où un gel est
   réellement utilisé — three.js ne doit pas peser sur une simple pilule. */
const FreezeCrystals3D = lazy(
  () =>
    import("@/components/three/FreezeCrystals3D").then((m) => ({
      default: m.FreezeCrystals3D,
    })),
);

/* ═════════════════════════════════════════ « Dernière chance » (MOD 1 — A.5/A.6)

   Pilule flottante affichée au-dessus de TOUTES les pages /app quand le
   streak est sur le point d'expirer (dernière activité il y a 20-24 h).
   Elle ne prend aucune place dans le flux : posée en bas à droite sur
   desktop, centrée au-dessus de la barre d'onglets sur mobile.
   Bouton « Geler » → gamification:freezeStreak ; le streak est gelé à la
   veille, plus aucune pression pour aujourd'hui. Notification push Web si
   la permission est déjà accordée (aucune demande de permission ne part de
   ce composant). Fermeture manuelle possible — elle n'empêche pas le
   recalcul automatique au re-render.
   ═══════════════════════════════════════════════════════════════════ */

const WINDOW_START = 20 * 3_600_000; // 20 h
const WINDOW_END = 24 * 3_600_000; // 24 h

/** Fermeture valable pour la JOURNÉE en cours (clé datée) : fermer la
    pilule ne la fait plus réapparaître à chaque changement de page, mais
    elle revient le lendemain — le rappel reste un service, pas un bruit. */
const DISMISS_KEY = "ln.streak.pill.dismissed";

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === dayKey();
  } catch {
    return false;
  }
}

function writeDismissedToday(): void {
  try {
    localStorage.setItem(DISMISS_KEY, dayKey());
  } catch {
    /* mode privé : la fermeture ne vaut que pour la session */
  }
}

/** Mouvement réduit : la pilule apparaît sans glissement. */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function StreakBanner() {
  const { t } = useI18n();
  // Jabari porte le rappel : sa tête annonce la threatens, sa bulle dit pourquoi.
  const mascot = useMascotSafe();
  const stats = useQuery(api.gamification.getUserStats);
  const useFreeze = useMutation(api.gamification.freezeStreak);
  const notifyStreak = useMutation(api.notifications.notifyStreak);
  const [dismissed, setDismissed] = useState(readDismissedToday);
  // Les cristaux de glace ne poussent qu'après un gel RÉELLEMENT réussi,
  // et disparaissent 3 s plus tard. Un boolean + un timeout nettoyé au
  // démontage : pas d'horloge murale evaluated dans le rendu, qui
  // laisserait le cristal bloqué indéfiniment.
  const [crystals, setCrystals] = useState(false);
  const crystalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (crystalTimer.current) clearTimeout(crystalTimer.current);
    },
    [],
  );
  // Tick d'une minute : le compteur d'heures restantes se met à jour tout
  // seul (avant, il fallait un re-render pour voir le décompte bouger).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const streak = stats?.currentStreak ?? 0;
  const lastActiveAt = stats?.lastActiveAt ?? 0;
  const hoursLeft = Math.ceil((WINDOW_END - (Date.now() - lastActiveAt)) / 3_600_000);

  const visible =
    stats !== undefined &&
    stats !== null &&
    !dismissed &&
    streak > 0 &&
    lastActiveAt > 0 &&
    Date.now() - lastActiveAt >= WINDOW_START &&
    Date.now() - lastActiveAt < WINDOW_END;

  useEffect(() => {
    if (visible) {
      void notifyStreak({}).catch(() => undefined);
      try {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          const n = new Notification(t("lastChance.pushTitle"), {
            body: t("lastChance.pushBody", { n: streak }),
          });
          n.onclick = () => self.focus();
        }
      } catch {
        /* notifications indisponibles : la pilule suffit */
      }
    }
  }, [visible, streak, t, notifyStreak]);

  const freeze = () => {
    toast.promise(
      useFreeze({}),
      {
        loading: t("freeze.working"),
        success: (r) => {
          if (r.ok) {
            soundEngine.play("streak");
            // Le gel réussi fait pousser les cristaux : la récompense se voit.
            setCrystals(true);
            if (crystalTimer.current) clearTimeout(crystalTimer.current);
            crystalTimer.current = setTimeout(() => setCrystals(false), 3000);
            return t("freeze.saved");
          }
          if (r.reason === "already_today") return t("freeze.alreadyToday");
          return t("freeze.none");
        },
        error: (e: Error) => e.message,
      },
    );
  };

  // L'humeur de Jabari suit la pilule : il râle tant que le streak
  // est en sursis, et redevient calme dès qu'elle se referme.
  const mascotState = visible ? "nag" : "idle";
  useEffect(() => {
    if (!mascot) return;
    if (visible) mascot.setState("nag");
    else mascot.dismiss();
  }, [visible, mascot]);

  const reduce = typeof window !== "undefined" && prefersReducedMotion();
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.94 };
  const shown = { opacity: 1, y: 0, scale: 1 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 26 }}
          className="fixed bottom-20 inset-x-0 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full border border-gold/30 bg-noir-2/70 py-2 ps-4 pe-2 shadow-lg backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:mx-0 lg:bottom-6"
        >
          <MascotSprite
            state={mascotState}
            className="size-8 shrink-0"
            rounded={false}
          />
          <p className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-ink">
            <Flame className="size-4 animate-pulse text-gold" aria-hidden />
            <span className="font-mono font-semibold text-gold">{streak}</span>
            <span className="text-ink-2">
              {t("streakPill.text", { x: Math.max(1, hoursLeft) })}
            </span>
          </p>
          {/* Cristaux de glace : seulement pendant 3 s après un gel réussi. */}
          {crystals && (
            <span className="relative size-8 shrink-0">
              <Snowflake
                className="absolute inset-0 m-auto size-4 text-[#9FD8FF]"
                aria-hidden
              />
              <Suspense fallback={null}>
                <FreezeCrystals3D
                  className="absolute inset-0 size-full"
                  fallback={null}
                />
              </Suspense>
            </span>
          )}
          {stats.freezes > 0 && (
            <button
              type="button"
              onClick={freeze}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold transition-colors hover:bg-gold/20"
            >
              <Snowflake className="size-3.5" aria-hidden />
              {t("streakPill.freeze")}
              <span className="font-mono">{stats.freezes}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              // Fermeture mémorisée pour la journée (voir DISMISS_KEY).
              writeDismissedToday();
              setDismissed(true);
            }}
            aria-label={t("streakPill.dismiss")}
            className="shrink-0 rounded-full p-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Heures restantes avant expiration — exporté pour tests/affichage. */
export function hoursUntilExpiry(lastActiveAt: number): number {
  return Math.ceil((WINDOW_END - (Date.now() - lastActiveAt)) / 3_600_000);
}
