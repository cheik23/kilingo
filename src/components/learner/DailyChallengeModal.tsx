import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, Clock3, Loader2, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DailyChallenge = {
  _id: Id<"dailyChallenges">;
  dayKey: string;
  type: "quiz" | "mcq" | "listen";
  payload: {
    slangId: Id<"slangExpressions">;
    question: string;
    options: string[];
    answerIndex: number;
    language: string;
    expression: string;
  };
  expiresAt: number;
  completedAt: number | null;
};

const DURATION_MS = 30_000;
const SPEECH_LANGUAGES: Record<string, string> = {
  en: "en-US", es: "es-ES", zh: "zh-CN", ar: "ar-SA", ru: "ru-RU",
  sw: "sw-KE", ln: "ln-CD", ha: "ha-NG", yo: "yo-NG", zu: "zu-ZA", wo: "wo-SN",
};

type Phase = "intro" | "playing" | "won" | "lost";

export function DailyChallengeModal({
  challenge,
  open,
  onClose,
  onCompleted,
}: {
  challenge: DailyChallenge | null;
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}) {
  const { t } = useI18n();
  const complete = useMutation(api.dailyChallenge.completeDailyChallenge);
  const [phase, setPhase] = useState<Phase>("intro");
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const settled = useRef(false);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const source = challenge?.payload;
    if (!source) return;
    const utterance = new SpeechSynthesisUtterance(source.expression);
    utterance.lang = SPEECH_LANGUAGES[source.language] ?? "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [challenge, t]);

  useEffect(() => {
    if (!open) return;
    settled.current = false;
    setPhase("intro");
    setRemaining(DURATION_MS);
    setPicked(null);
  }, [open, challenge?._id]);

  useEffect(() => {
    if (!open || phase !== "playing") return;
    const deadline = Date.now() + remaining;
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0 && !settled.current) {
        void finish(false);
      }
    }, 250);
    return () => window.clearInterval(id);
    // Le timer d'une partie est volontairement stable pour une seule question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  const finish = useCallback(async (success: boolean) => {
    if (!challenge || settled.current) return;
    settled.current = true;
    setBusy(true);
    try {
      const result = await complete({ challengeId: challenge._id, success });
      if (result.ok) {
        onCompleted?.();
        setPhase(success ? "won" : "lost");
        toast.success(`${result.xpGained} XP${result.gemsEarned ? ` · +${result.gemsEarned} 💎` : ""}`);
      } else {
        setPhase("lost");
      }
    } catch (error) {
      setPhase(success ? "won" : "lost");
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }, [challenge, complete, onCompleted, t]);

  if (!open || !challenge) return null;
  const urgent = remaining < 10_000;
  const answerIndex = challenge.payload.answerIndex;

  const pick = (index: number) => {
    if (phase !== "playing" || picked !== null || busy) return;
    setPicked(index);
    void finish(index === answerIndex);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-noir/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl border border-gold/30 bg-noir-2 p-6 shadow-[0_0_80px_rgba(212,165,116,0.14)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.25em] text-gold">🎯 {t("daily.modalTitle")}</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">{t("daily.modalHeadline")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-lg p-1 text-ink-3 hover:text-ink"><X className="size-4" /></button>
        </div>

        {phase === "intro" && (
          <div className="mt-6 text-center">
            <p className="text-sm text-ink-2">{t("daily.modalIntro")}</p>
            <button type="button" onClick={() => { setPhase("playing"); setRemaining(DURATION_MS); if (challenge.type === "listen") window.setTimeout(speak, 150); }} className="mt-5 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir hover:-translate-y-0.5">
              {t("daily.start")}
            </button>
          </div>
        )}

        {phase === "playing" && (
          <div className="mt-5">
            <div className="flex items-center justify-between font-mono text-xs text-ink-3">
              <span>{challenge.type === "listen" ? t("daily.listen") : t("daily.quick")}</span>
              <span className={cn("flex items-center gap-1", urgent && "text-red-400")}><Clock3 className="size-3.5" />{Math.ceil(remaining / 1000)}s</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={cn("h-full rounded-full", urgent ? "bg-red-400" : "bg-gold")} style={{ width: `${(remaining / DURATION_MS) * 100}%` }} /></div>
            <p className="mt-5 font-display text-xl">{challenge.payload.question}</p>
            {challenge.type === "listen" && <button type="button" onClick={speak} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold/30 px-3 py-2 text-sm text-gold"><Volume2 className="size-4" />{t("daily.listenAgain")}</button>}
            <div className="mt-5 space-y-2">
              {challenge.payload.options.map((option, index) => {
                const correct = index === answerIndex;
                const selected = index === picked;
                return <button key={option} type="button" onClick={() => pick(index)} disabled={picked !== null || busy} className={cn("w-full rounded-xl border p-3 text-left text-sm transition-colors", selected ? (correct ? "border-gold bg-gold/15 text-gold" : "border-red-400/50 bg-red-400/10 text-red-200") : "border-white/10 text-ink hover:border-gold/40")}>{selected && correct ? <Check className="mr-2 inline size-4" /> : null}{option}</button>;
              })}
            </div>
          </div>
        )}

        {(phase === "won" || phase === "lost") && <div className="mt-6 text-center"><p className="font-display text-3xl">{phase === "won" ? "✨" : "💔"}</p><p className="mt-3 text-sm text-ink-2">{phase === "won" ? t("daily.success") : t("daily.participation")}</p><button type="button" onClick={onClose} className="mt-5 w-full rounded-xl border border-gold/30 py-3 font-semibold text-gold">{t("common.close")}</button></div>}
        {busy && <Loader2 className="mx-auto mt-3 size-4 animate-spin text-gold" />}
      </motion.div>
    </div>
  );
}
