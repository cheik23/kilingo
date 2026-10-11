import { useState } from "react";
import { useMutation } from "convex/react";
import { CalendarDays, Flame, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useOptionalQuery } from "@/lib/optionalQuery";
import { cn } from "@/lib/utils";
import { SpeakButton } from "./SpeakButton";

/* ═══════════════════════════════════════════════════════════════════
   SLANG DU JOUR — la carte d'habitude quotidienne

   Une expression, son sens, et un QCM à un choix pour la retenir.
   Tout vient du serveur : le tirage du jour est DÉTERMINISTE (la même
   expression pour tout le monde, le même jour), la correction est faite
   côté serveur, et l'XP affichée est celle que `applyAward` a réellement
   créditée — jamais une constante du client.

   Deux états d'absence, distincts et explicites :
     · la fonction n'existe pas encore sur le serveur de production → une
       carte courte et honnête (pas une carte vide, pas un crash) ;
     · l'expression du jour n'existe pas pour la langue → on n'affiche
       rien du tout, plutôt qu'une carte sans expression.
   ═══════════════════════════════════════════════════════════════════ */

const COPY = {
  title: "Expression du jour",
  quiz: "Tester mes connaissances",
  masked: "Sens masqué — choisis la bonne réponse.",
  question: (expression: string) => `Que signifie « ${expression} » ?`,
  retry: "Réessayer",
  correct: "Exact !",
  incorrect: "Pas tout à fait — la bonne réponse était :",
  xp: (xp: number) => `+${xp} XP`,
  streak: (days: number) => `${days} jour${days > 1 ? "s" : ""} de suite`,
  again: "Déjà joué aujourd'hui — reviens demain.",
  unavailable:
    "Le slang du jour sera disponible dès la prochaine mise à jour du serveur.",
  error: "Impossible de récupérer l'expression du jour.",
  submitError: "Réponse non comptée — réessaie dans un instant.",
  loading: "Préparation de l'expression du jour…",
} as const;

type Outcome = {
  correct: boolean;
  xpGained: number;
  currentStreak: number;
  already: boolean;
};

export function DailySlangCard({ className }: { className?: string }) {
  const daily = useOptionalQuery(api.dailySlang.getDailySlang, {});
  const complete = useMutation(api.dailySlang.completeDailySlang);
  const [quizzing, setQuizzing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  // Fonction absente du serveur : carte courte et honnête, jamais un vide.
  if (daily.unavailable) {
    return (
      <section className={cn("ln-card p-4", className)} aria-label={COPY.title}>
        <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
          <CalendarDays className="size-3" /> {COPY.title}
        </p>
        <p className="mt-2 text-sm text-ink-3">{COPY.unavailable}</p>
      </section>
    );
  }

  if (!daily.data) {
    return (
      <section className={cn("ln-card p-4", className)} aria-label={COPY.title}>
        <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
          <CalendarDays className="size-3" /> {COPY.title}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-3">
          <Loader2 className="size-3.5 animate-spin" /> {COPY.loading}
        </p>
      </section>
    );
  }

  const card = daily.data;
  const answered = outcome !== null;

  const answer = async (index: number) => {
    if (busy || answered) return;
    setPicked(index);
    setBusy(true);
    try {
      const result = await complete({ answerIndex: index });
      setOutcome({
        correct: result.correct,
        xpGained: result.xpGained,
        currentStreak: result.currentStreak,
        already: result.already,
      });
      if (result.correct && result.xpGained > 0) {
        toast.success(COPY.xp(result.xpGained), {
          description: COPY.streak(result.currentStreak),
        });
      }
    } catch (error) {
      console.warn("[daily-slang] réponse refusée :", error);
      // Aucune réponse n'est créditée quand le serveur ne répond pas :
      // on le dit, on ne fait pas semblant.
      setPicked(null);
      toast.error(COPY.submitError);
    } finally {
      setBusy(false);
    }
  };

  // Le sens est masqué pendant le QCM : « Tester mes connaissances » doit
  // tester quelque chose. Il réapparaît dès la réponse donnée.
  const hideMeaning = quizzing && !answered;

  return (
    <section className={cn("ln-card p-4", className)} aria-label={COPY.title}>
      <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
        <CalendarDays className="size-3" /> {COPY.title}
      </p>

      {/* Expression + écoute */}
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl italic text-ink">{card.expression}</p>
          <p className="mt-0.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
            {card.region}
          </p>
        </div>
        <SpeakButton text={card.expression} language={card.language} size="lg" />
      </div>

      {/* Sens — visible par défaut, masqué pendant le QCM */}
      {hideMeaning ? (
        <p className="mt-2 text-sm text-ink-3 italic">{COPY.masked}</p>
      ) : (
        <p className="mt-2 text-sm">
          <span className="font-medium text-gold">{card.meaning}</span>
          {card.context && (
            <span className="mt-0.5 block text-xs text-ink-3 italic">
              « {card.context} »
            </span>
          )}
        </p>
      )}

      {/* QCM à un choix */}
      {quizzing && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-sm text-ink-2">{COPY.question(card.expression)}</p>
          <div className="mt-2 space-y-1.5">
            {card.options.map((option, index) => {
              const chosen = picked === index;
              const right = answered && index === card.answerIndex;
              const wrong = answered && chosen && !right;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => void answer(index)}
                  disabled={busy || answered}
                  className={cn(
                    "w-full rounded-xl border p-2.5 text-left text-sm transition-colors disabled:cursor-default",
                    right
                      ? "border-green-400/50 bg-green-400/10 text-green-200"
                      : wrong
                        ? "border-red-400/50 bg-red-400/10 text-red-200"
                        : chosen
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-white/10 text-ink-2 hover:border-gold/40 hover:text-ink",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Issue + XP réellement créditée */}
      {outcome && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {outcome.correct ? (
            <>
              <Sparkles className="size-3.5 text-gold" aria-hidden />
              <span className="text-green-300">{COPY.correct}</span>
              {outcome.xpGained > 0 && (
                <span className="font-semibold text-gold">
                  {COPY.xp(outcome.xpGained)}
                </span>
              )}
              {outcome.already && <span className="text-xs text-ink-3">{COPY.again}</span>}
            </>
          ) : (
            <>
              <span className="text-ink-2">{COPY.incorrect}</span>
              <span className="font-medium text-gold">{card.meaning}</span>
            </>
          )}
          {outcome.currentStreak > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-3">
              <Flame className="size-3" aria-hidden />
              {COPY.streak(outcome.currentStreak)}
            </span>
          )}
        </p>
      )}

      {/* Action */}
      {!quizzing && !answered && (
        <button
          type="button"
          onClick={() => setQuizzing(true)}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-2.5 text-sm font-semibold text-noir transition-opacity hover:opacity-90"
        >
          {COPY.quiz}
        </button>
      )}
    </section>
  );
}
