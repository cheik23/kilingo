import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { HeartCrack, Loader2, Sparkles, Timer } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { soundEngine } from "@/lib/soundEngine";

/* ═══════════════════════════════════════════════════════════════════
   LAST CHANCE (MOD 1 — C) — « Dernière chance ».

   Monté par AppShell au 1er chargement si lastActiveAt > 24 h.
   Timer 2 minutes (rouge sous 30 s), quiz express de 3 questions
   généré par quizEngine (langue au hasard parmi celles qui ont du
   contenu) et corrigé côté serveur via revealAnswer — le correctIndex
   ne quitte jamais la base avant la réponse. Réussite (≥ 50 %) →
   gamification:completeLastChance : streak sauvé + 50 XP + confettis
   dorés CSS. Échec/timeout → streak reset + animation « 💔 Streak
   perdu ». Zéro crash sur base vide (issue sans quiz possible).
   ═══════════════════════════════════════════════════════════════════ */

const GOLD = "var(--gold-primary)";
const DURATION_MS = 2 * 60 * 1000;

type PublicQuestion = {
  id: string;
  type: "mcq" | "fill" | "reverse";
  prompt: string;
  hint?: string;
  options: string[];
  example?: string;
  expression: string;
  meaning: string;
};

type Phase = "intro" | "playing" | "won" | "lost";

export function LastChanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const completeLastChance = useMutation(api.gamification.completeLastChance);
  const [phase, setPhase] = useState<Phase>("intro");
  const [deadline, setDeadline] = useState(0);
  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [busy, setBusy] = useState(false);
  const slotRef = useRef<QuizSlot | null>(null);
  const settledRef = useRef(false);

  // Réinitialisation à chaque ouverture : l'épreuve repart de zéro.
  useEffect(() => {
    if (open) {
      settledRef.current = false;
      slotRef.current = null;
      setPhase("intro");
      setRemainingMs(DURATION_MS);
    }
  }, [open]);

  const settle = useCallback(
    async (success: boolean) => {
      if (settledRef.current) return; // le sort ne peut être tranché qu'une fois
      settledRef.current = true;
      setBusy(true);
      try {
        await completeLastChance({
          success,
          quizId: slotRef.current?.sessionId,
        });
      } catch {
        // Même en cas d'échec réseau : l'issue est jouée côté client, on
        // n'enferme jamais l'utilisateur dans le modal.
      } finally {
        setBusy(false);
        if (success) soundEngine.play("achievement");
        setPhase(success ? "won" : "lost");
      }
    },
    [completeLastChance],
  );

  const start = () => {
    setPhase("playing");
    setDeadline(Date.now() + DURATION_MS);
    setRemainingMs(DURATION_MS);
  };

  // Timeout : à 0, le streak est perdu (le quiz en cours devient sans objet).
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const left = deadline - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        void settle(false);
      } else {
        setRemainingMs(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, deadline, settle]);

  if (!open) return null;

  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = Math.floor(total / 60);
  const ss = String(total % 60).padStart(2, "0");
  const ratio = Math.max(0, remainingMs / DURATION_MS);
  const urgent = remainingMs < 30_000;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-noir/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("lastChance.title")}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="ln-modal-safe max-w-md rounded-2xl border border-gold/30 bg-noir-2 p-5 shadow-[0_0_80px_rgba(212,165,116,0.15)] sm:p-6"
      >
        {phase === "intro" && (
          <div className="text-center">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.25em] text-gold">
              {t("lastChance.title")}
            </p>
            <p className="mt-3 font-display text-3xl font-bold text-ink">
              {t("lastChance.headline")}
            </p>
            <p className="mt-3 text-sm text-ink-2">{t("lastChance.intro")}</p>
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir transition-transform hover:-translate-y-0.5"
            >
              {t("lastChance.start")}
            </button>
            <button
              type="button"
              onClick={() => void settle(false)}
              disabled={busy}
              className="mt-3 w-full rounded-lg py-2 text-xs text-ink-3 hover:text-ink"
            >
              {t("lastChance.giveUp")}
            </button>
          </div>
        )}

        {phase === "playing" && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.25em] text-gold">
                {t("lastChance.title")}
              </p>
              <span
                className={cn(
                  "flex items-center gap-1.5 font-mono text-lg font-bold",
                  urgent ? "animate-pulse text-red-400" : "text-ink",
                )}
              >
                <Timer className="size-4 text-red-400" />
                {mm}:{ss}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${ratio * 100}%`,
                  background: urgent ? "#f87171" : GOLD,
                }}
              />
            </div>
            <ExpressQuiz
              slotRef={slotRef}
              onFinish={(scorePercent) => void settle(scorePercent >= 50)}
            />
          </div>
        )}

        {phase === "won" && <WinView onClose={onClose} />}
        {phase === "lost" && <LoseView onClose={onClose} />}
      </motion.div>
    </div>
  );
}

/* ── Quiz express 3 questions (logique serveur, anti-triche) ──────── */

type QuizSlot = {
  sessionId: Id<"quizSessions">;
};

type Revealed = { choice: number; correctIndex: number };

/**
 * Un unique quiz 3 questions ; chaque réponse est validée par
 * quizEngine:revealAnswer (source de vérité serveur). Le score final
 * compte les réponses réellement révélées avant la fin du timer — si
 * le timer expire pendant un feedback, c'est le timeout qui tranche
 * (completeLastChance n'est appelé qu'une fois, garanti côté parent).
 */
function ExpressQuiz({
  slotRef,
  onFinish,
}: {
  slotRef: React.MutableRefObject<QuizSlot | null>;
  onFinish: (scorePercent: number) => void;
}) {
  const { t } = useI18n();
  const generate = useMutation(api.quizEngine.generateQuiz);
  const reveal = useMutation(api.quizEngine.revealAnswer);

  /* Langues tirables : uniquement celles avec assez d'expressions (≥ 4,
     le plancher du moteur de quiz) — un tirage perdant serait injuste. */
  const counts = useQuery(api.slang.stats);
  const langs = useMemo(() => {
    const all = ["en", "es", "zh", "ar", "ru", "sw", "ln", "ha", "yo", "zu", "wo"] as const;
    const by = counts?.byLanguage ?? {};
    const viable = all.filter((l) => (by[l] ?? 0) >= 4);
    return viable.length > 0 ? viable : [...all];
  }, [counts]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<Id<"quizSessions"> | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [revealed, setRevealed] = useState<Revealed[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [generated, setGenerated] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // On attend que les compteurs de langue soient chargés pour ne pas
    // tirer une langue vide, puis on génère exactement UNE session.
    if (generated || counts === undefined) return;
    let alive = true;
    setGenerated(true);
    generate({
      language: langs[Math.floor(Math.random() * langs.length)],
      count: 3,
      context: "random",
    })
      .then((res) => {
        if (!alive) return;
        slotRef.current = { sessionId: res.sessionId };
        setSessionId(res.sessionId);
        setQuestions(res.questions as PublicQuestion[]);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, generated, langs]);

  const q = questions[index];

  const pick = (choice: number) => {
    if (!sessionId || !q || picked !== null) return;
    setPicked(choice);
    reveal({ sessionId, questionId: q.id })
      .then((res) => {
        soundEngine.play(choice === res.correctIndex ? "correct" : "error");
        setCorrectIndex(res.correctIndex);
        const nextRevealed = [...revealed, { choice, correctIndex: res.correctIndex }];
        setRevealed(nextRevealed);
        advanceTimer.current = setTimeout(() => {
          if (index + 1 < questions.length) {
            setIndex((i) => i + 1);
            setPicked(null);
            setCorrectIndex(null);
          } else {
            const correct = nextRevealed.filter((r) => r.choice === r.correctIndex).length;
            onFinish(Math.round((correct / Math.max(1, questions.length)) * 100));
          }
        }, 1400);
      })
      .catch(() => setPicked(null));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <Loader2 className="size-5 animate-spin text-gold" />
        <p className="text-xs text-ink-2">{t("lastChance.loading")}</p>
      </div>
    );
  }

  if (error || !q) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-ink-2">{t("lastChance.quizError")}</p>
        <button
          type="button"
          onClick={() => onFinish(0)}
          className="mt-3 text-xs text-ink-3 underline hover:text-gold"
        >
          {t("lastChance.giveUp")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
        {index + 1} / {questions.length}
      </p>
      <p className="mt-1 font-display text-lg leading-snug text-ink">{q.prompt}</p>
      <div className="mt-4 grid gap-2">
        {q.options.map((opt, i) => (
          <button
            key={`${q.id}-${i}`}
            type="button"
            disabled={picked !== null}
            onClick={() => pick(i)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-left text-sm transition-all",
              "border-white/10 text-ink hover:border-gold/60 hover:bg-gold/5",
              picked === i && correctIndex === null && "border-gold bg-gold/15",
              correctIndex !== null && i === correctIndex && "border-gold bg-gold/20 text-ink",
              correctIndex !== null &&
                picked === i &&
                i !== correctIndex &&
                "border-red-400/80 bg-red-400/10",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Écrans d'issue ───────────────────────────────────────────────── */

function WinView({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="relative text-center">
      {/* Confettis dorés — CSS/motion pur, aucune dépendance ajoutée */}
      {Array.from({ length: 18 }, (_, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute left-1/2 top-6 size-1.5 rounded-full"
          style={{ background: i % 2 ? GOLD : "#F5E7B8" }}
          initial={{ opacity: 1, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            x: Math.cos((i / 18) * Math.PI * 2) * (60 + (i % 5) * 22),
            y: 90 + (i % 7) * 16,
          }}
          transition={{ duration: 1.4, delay: (i % 6) * 0.08, ease: "easeOut" }}
        />
      ))}
      <Sparkles className="mx-auto size-10 text-gold" />
      <p className="mt-3 font-display text-2xl font-bold text-gold">
        {t("lastChance.wonTitle")}
      </p>
      <p className="mt-2 text-sm text-ink-2">{t("lastChance.wonBody")}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir"
      >
        {t("lastChance.continue")}
      </button>
    </div>
  );
}

function LoseView({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <HeartCrack className="mx-auto size-10 text-red-400" />
      </motion.div>
      <p className="mt-3 font-display text-2xl font-bold text-ink">
        💔 {t("lastChance.lostTitle")}
      </p>
      <p className="mt-2 text-sm text-ink-2">{t("lastChance.lostBody")}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full rounded-xl border border-white/15 py-3 text-sm text-ink-2 hover:border-gold/40 hover:text-gold"
      >
        {t("lastChance.continue")}
      </button>
    </div>
  );
}
