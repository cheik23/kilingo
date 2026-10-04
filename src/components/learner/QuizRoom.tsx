import { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BrainCircuit,
  Eye,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react";

import { api } from "@/convex/_generated/api";

/* MODULE 4 — la scène de montée de niveau vit dans un chunk séparé :
   three.js n'est chargé qu'au premier passage de niveau. */
const LevelScene = lazy(() => import("@/components/three/LevelUp3D"));
import type { Id } from "@/convex/_generated/dataModel";
import { LANGUAGES } from "@/convex/languages";
import { BADGES, badgeLabel } from "@/lib/badges";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LootBoxModal } from "./LootBoxModal";
import { showAchievementFeedback } from "@/lib/achievementFeedback";
import { soundEngine } from "@/lib/soundEngine";
import { MascotStage, useMascotSafe } from "@/components/three/MascotProvider";

/* ═══════════════════════════════════════════════════════════════════
   QUIZ ROOM (Phase 2/4) — « Défis »

   3 écrans : accueil (langues + stats), jeu (feedback immédiat via
   quizEngine:revealAnswer — le correctIndex ne quitte jamais le serveur
   avant la réponse), résultats (score, XP, badges, revoir les erreurs).
   Thème or/noir, zéro crash sur données vides.
   ═══════════════════════════════════════════════════════════════════ */

type Phase = "home" | "playing" | "results";

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

type GenerateResult = {
  sessionId: Id<"quizSessions">;
  questions: PublicQuestion[];
  totalQuestions: number;
};

type SubmitResult = {
  score: number;
  xpEarned: number;
  totalQuestions: number;
  correctCount: number;
  levelUp: boolean;
  newLevel: number;
  currentStreak: number;
  streakUpdated: boolean;
  newBadges: string[];
  /** MOD 2 — économie gems + loot. */
  gemsEarned: number;
  lootBoxId?: Id<"userLootBoxes">;
  doubleXp: boolean;
  wrongAnswers: {
    expression: string;
    meaning: string;
    example?: string;
    correctOption: string;
  }[];
};

type TFn = (k: string, p?: Record<string, string | number>) => string;

/** Union exacte attendue par generateQuiz (langues d'apprentissage). */
type QuizLang =
  | "en" | "zh" | "es" | "ar" | "ru"
  | "sw" | "ln" | "ha" | "yo" | "zu" | "wo";

const GOLD = "var(--gold-primary)";

export function QuizRoom() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("home");
  const [language, setLanguage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);
  // MOD 2 — loot box gagnée sur quiz 5/5 (modal d'ouverture).
  const [lootId, setLootId] = useState<Id<"userLootBoxes"> | null>(null);
  const checkAchievements = useAction(api.achievements.checkAchievements);

  const stats = useQuery(api.gamification.getUserStats);
  const badgeProgress = useQuery(api.gamification.getBadgeProgress);

  /** Expressions disponibles par langue (même plafond de 80 que le moteur). */
  const counts = useQuery(api.slang.stats);
  const countsByLanguage = useMemo(
    () => counts?.byLanguage ?? {},
    [counts],
  );

  const startQuiz = (lang: string) => {
    setLanguage(lang);
    setPhase("playing");
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      {phase === "home" && (
        <QuizHome
          stats={
            stats ?? { level: 0, totalXP: 0, currentStreak: 0, badges: [] }
          }
          counts={countsByLanguage}
          badgeProgress={badgeProgress}
          onStart={startQuiz}
          t={t}
        />
      )}
      {phase === "playing" && language && (
        <QuizGame
          language={language}
          onExit={() => {
            setPhase("home");
            setLanguage(null);
          }}
          onFinish={(r) => {
            void checkAchievements({}).then((result) => { showAchievementFeedback(result); if (result.completed.length > 0) soundEngine.play("achievement"); }).catch(() => undefined);
            setLastResult(r);
            setPhase("results");
            if (r.lootBoxId) setLootId(r.lootBoxId);
          }}
          t={t}
        />
      )}
      {phase === "results" && language && (
        <QuizResults
          language={language}
          result={lastResult}
          onReplay={() => setPhase("playing")}
          onHome={() => {
            setPhase("home");
            setLanguage(null);
          }}
          t={t}
        />
      )}
      <LootBoxModal lootId={lootId} onClose={() => setLootId(null)} />
    </div>
  );
}

/* ── Écran d'accueil ──────────────────────────────────────────────── */

function QuizHome({
  stats,
  counts,
  badgeProgress,
  onStart,
  t,
}: {
  stats: { level: number; totalXP: number; currentStreak: number; badges: string[] };
  counts: Record<string, number>;
  badgeProgress?: { id: string; current: number; target: number; unlocked: boolean }[];
  onStart: (lang: string) => void;
  t: TFn;
}) {
  const { lang } = useI18n();
  const achievements = useQuery(api.achievements.getMyAchievements, { lang });
  return (
    <div className="space-y-6">
      {achievements?.items.find((item) => item.achievementId === "perfection-10") && (
        <div className="flex items-center justify-between rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3 text-xs text-ink-2">
          <span>🧠 Plus que <strong className="text-gold">{Math.max(0, 10 - (achievements.items.find((item) => item.achievementId === "perfection-10")?.progress ?? 0))} quiz 5/5</strong> pour Perfectionniste Bronze</span>
          <span className="font-mono text-[0.625rem] text-ink-3">{achievements.items.find((item) => item.achievementId === "perfection-10")?.progress ?? 0}/10</span>
        </div>
      )}
      {achievements?.items.find((item) => item.achievementId === "perfection-10") && (
        <div className="flex items-center justify-between rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3 text-xs text-ink-2">
          <span>🧠 Plus que <strong className="text-gold">{Math.max(0, 10 - (achievements.items.find((item) => item.achievementId === "perfection-10")?.progress ?? 0))} quiz 5/5</strong> pour Perfectionniste Bronze</span>
          <span className="font-mono text-[0.625rem] text-ink-3">{achievements.items.find((item) => item.achievementId === "perfection-10")?.progress ?? 0}/10</span>
        </div>
      )}
      {/* Stats rapides : niveau, XP, streak, badges */}
      <div className="ln-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <BrainCircuit className="h-5 w-5 text-gold" />
          </div>
          <div>
            <p className="font-display text-lg text-ink">
              {t("quiz.level")} {stats.level}
            </p>
            <p className="text-xs text-ink-2">{stats.totalXP} XP</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-gold/30 px-3 py-1.5">
          <Flame className="h-4 w-4 text-gold" />
          <span className="text-sm text-ink">
            {stats.currentStreak} {t("quiz.streak")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {BADGES.map((b) => {
            const owned = stats.badges.includes(b.id);
            const Icon = b.icon;
            return (
              <span
                key={b.id}
                title={`${b.label} — ${b.description}`}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border",
                  owned
                    ? "border-gold/60 bg-gold/15 text-gold"
                    : "border-white/10 text-ink-2/40",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            );
          })}
        </div>
      </div>

      {/* Grille de langues */}
      <div>
        <h2 className="font-display text-xl text-ink">{t("quiz.pickLanguage")}</h2>
        <p className="mt-1 text-sm text-ink-2">{t("quiz.pickLanguageHint")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {LANGUAGES.map((l) => {
            const n = counts[l.code] ?? 0;
            const disabled = n < 4; // minimum pour construire un quiz + leurres
            return (
              <button
                key={l.code}
                type="button"
                disabled={disabled}
                onClick={() => onStart(l.code)}
                className={cn(
                  "ln-card group flex flex-col items-start gap-1 p-4 text-left transition-all",
                  disabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:border-gold/60 hover:shadow-[0_0_24px_rgba(212,165,116,0.12)]",
                )}
              >
                <span className="text-2xl">{l.flag}</span>
                <span className="text-sm font-medium text-ink">{l.name}</span>
                <span className="text-xs text-ink-2">
                  {n} {t("quiz.expressions")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Badges — progression détaillée */}
      <div>
        <h3 className="font-display text-lg text-ink">{t("quiz.badges")}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BADGES.map((def) => {
            const Icon = def.icon;
            const owned = stats.badges.includes(def.id);
            const prog = badgeProgress?.find((p) => p.id === def.id);
            const pct = prog
              ? Math.min(100, Math.round((prog.current / Math.max(1, prog.target)) * 100))
              : owned
                ? 100
                : 0;
            return (
              <div
                key={def.id}
                className={cn(
                  "ln-card flex items-center gap-3 p-4",
                  owned && "border-gold/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                    owned
                      ? "border-gold/60 bg-gold/15 text-gold"
                      : "border-white/10 text-ink-2",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{def.label}</p>
                    <span className="text-[0.6875rem] text-ink-2">
                      +{def.xpReward} XP
                    </span>
                  </div>
                  <p className="truncate text-xs text-ink-2">
                    {def.description}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: GOLD }}
                    />
                  </div>
                </div>
                {owned && (
                  <span className="rounded-full border border-gold/50 px-2 py-0.5 text-[0.625rem] uppercase tracking-wide text-gold">
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Écran de jeu ─────────────────────────────────────────────────── */

function QuizGame({
  language,
  onExit,
  onFinish,
  t,
}: {
  language: string;
  onExit: () => void;
  onFinish: (r: SubmitResult) => void;
  t: TFn;
}) {
  const generate = useMutation(api.quizEngine.generateQuiz);
  const reveal = useMutation(api.quizEngine.revealAnswer);
  const submit = useMutation(api.quizEngine.submitQuiz);
  // MOD 2 — Double XP affiché (+20 XP ⚡×2) et token « Révéler ».
  const doubleXp = useQuery(api.gamification.hasDoubleXp);
  const stats = useQuery(api.gamification.getUserStats);
  const consumeToken = useMutation(api.gamification.consumeRevealToken);
  const [tokenHint, setTokenHint] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<GenerateResult | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<
    { questionId: string; choice: number }[]
  >([]);
  const startedAt = useRef(Date.now());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const regen = () => {
    setLoading(true);
    setError(null);
    setSession(null);
    setIndex(0);
    setPicked(null);
    setCorrectIndex(null);
    setAnswers([]);
    generate({ language: language as QuizLang, count: 5, context: "recent" })
      .then((res) => {
        setSession(res as GenerateResult);
        startedAt.current = Date.now();
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    regen();
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const q = session?.questions[index];
  // Jabari réagit à chaque réponse ; la bulle suit l'état (voir provider).
  const mascot = useMascotSafe();

  const pick = (choice: number) => {
    if (!session || !q || picked !== null) return;
    setPicked(choice);
    reveal({ sessionId: session.sessionId, questionId: q.id })
      .then((res) => {
        const right = choice === res.correctIndex;
        soundEngine.play(right ? "correct" : "error");
        // Jabari commente : il saute quand c'est bon, il reste doux sinon.
        mascot?.play(right ? "celebrate" : "think", 2000);
        setCorrectIndex(res.correctIndex);
        setAnswers((prev) => [
          ...prev.filter((a) => a.questionId !== q.id),
          { questionId: q.id, choice },
        ]);
        advanceTimer.current = setTimeout(() => {
          if (index + 1 < session.questions.length) {
            setIndex((i) => i + 1);
            setPicked(null);
            setCorrectIndex(null);
            setTokenHint(null);
          } else {
            const durationMs = Date.now() - startedAt.current;
            submit({
              sessionId: session.sessionId,
              answers: [...answers, { questionId: q.id, choice }],
              durationMs,
            })
              .then((r) => {
                if (r.xpEarned > 0) soundEngine.play("reward");
                if (r.newBadges.length > 0) {
                  toast.success(
                    `${t("quiz.newBadges")} · ${r.newBadges
                      .map(badgeLabel)
                      .join(", ")}`,
                  );
                }
                // MOD 2 — toasts récompenses (or, jamais rouge ici).
                if (r.gemsEarned > 0) {
                  toast.success(`💎 +${r.gemsEarned} ${t("quiz.gemsWon")}`);
                }
                if (r.doubleXp) {
                  toast.success(`⚡ ×2 ${t("quiz.xpDoubled")}`);
                }
                onFinish(r as unknown as SubmitResult);
              })
              .catch((e: Error) => {
                toast.error(e.message);
                onExit();
              });
          }
        }, 2000);
      })
      .catch((e: Error) => {
        toast.error(e.message);
        setPicked(null);
      });
  };

  if (loading) {
    return (
      <div className="ln-card flex flex-col items-center gap-3 p-10">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
        <p className="text-sm text-ink-2">{t("quiz.generating")}</p>
      </div>
    );
  }

  if (error || !session || !q) {
    return (
      <div className="ln-card space-y-4 p-6">
        <p className="text-sm text-ink">{error ?? t("quiz.error")}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={regen}
            className="border-gold/40 text-gold hover:bg-gold/10"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> {t("quiz.retry")}
          </Button>
          <Button variant="ghost" onClick={onExit} className="text-ink-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("quiz.back")}
          </Button>
        </div>
      </div>
    );
  }

  const typeBadge =
    q.type === "fill"
      ? t("quiz.typeFill")
      : q.type === "reverse"
        ? t("quiz.typeReverse")
        : t("quiz.typeMcq");

  return (
    <div className="space-y-4">
      {/* Barre de progression */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onExit}
          className="text-ink-2 hover:text-gold"
          aria-label={t("quiz.back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((index + 1) / session.questions.length) * 100}%`,
              background: GOLD,
            }}
          />
        </div>
        <span className="text-xs text-ink-2">
          {index + 1}/{session.questions.length}
        </span>
      </div>

      {/* Carte question */}
      <div className="ln-card relative p-6 pt-16 sm:p-8 sm:pt-16">
        {/* Jabari réagit en haut à droite de la carte. */}
        <MascotStage
          variant="auto"
          className="absolute end-4 top-3 h-20 w-20 sm:h-24 sm:w-24"
          bubble
        />
        <span className="inline-block rounded-full border border-gold/40 px-2.5 py-0.5 text-[0.6875rem] uppercase tracking-wider text-gold">
          {typeBadge}
        </span>
        <p className="mt-4 font-display text-2xl leading-snug text-ink sm:text-3xl">
          {q.prompt}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {q.options.map((opt, i) => {
            const revealed = correctIndex !== null;
            const isCorrect = revealed && i === correctIndex;
            const isPicked = picked === i;
            return (
              <button
                key={`${q.id}-${i}`}
                type="button"
                disabled={picked !== null}
                onClick={() => pick(i)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm transition-all",
                  "border-white/10 text-ink hover:border-gold/60 hover:bg-gold/5",
                  picked !== null && "cursor-default",
                  isPicked && !revealed && "border-gold bg-gold/15 text-ink",
                  isCorrect && "border-emerald-400/80 bg-emerald-400/10 text-ink",
                  revealed && !isCorrect && isPicked && "border-red-400/80 bg-red-400/10 text-ink",
                  revealed && !isCorrect && !isPicked && "opacity-50",
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Feedback immédiat */}
        {correctIndex !== null && (
          <div className="mt-5 space-y-2">
            {picked === correctIndex ? (
              <p className="flex items-center gap-2 text-sm text-emerald-400">
                <Sparkles className="h-4 w-4" /> +
                {(doubleXp?.active ?? false) ? 20 : 10} XP
                {(doubleXp?.active ?? false) ? " ⚡×2" : ""}
              </p>
            ) : (
              <p className="text-sm text-red-400">{t("quiz.wrong")}</p>
            )}
            {/* MOD 2 — token « Révéler » : consomme 1 révélation servie
                par consumeRevealToken (débité côté serveur). */}
            {picked !== correctIndex &&
              tokenHint === null &&
              (stats?.revealTokens ?? 0) > 0 &&
              session &&
              q && (
                <button
                  type="button"
                  onClick={() => {
                    consumeToken({ sessionId: session.sessionId, questionId: q.id })
                      .then((r) => {
                        if (r.ok) setTokenHint(r.correctIndex);
                        else toast.error(t("store.insufficient"));
                      })
                      .catch((e: Error) => toast.error(e.message));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20"
                >
                  <Eye className="size-3.5" /> {t("quiz.reveal")} (💎50)
                </button>
              )}
            {tokenHint !== null && tokenHint !== picked && q && (
              <p className="text-xs text-gold">
                💡 {t("quiz.revealHint")} : {q.options[tokenHint]}
              </p>
            )}
            <p className="text-xs text-ink-2">
              <span className="font-medium text-ink">{q.expression}</span>
              {q.meaning ? ` — ${q.meaning}` : ""}
            </p>
            {q.example && (
              <p className="text-xs italic text-ink-2">« {q.example} »</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Écran de résultats ───────────────────────────────────────────── */

function QuizResults({
  language,
  result,
  onReplay,
  onHome,
  t,
}: {
  language: string;
  result: SubmitResult | null;
  onReplay: () => void;
  onHome: () => void;
  t: TFn;
}) {
  void language;
  if (!result) {
    return (
      <div className="ln-card space-y-4 p-6">
        <p className="text-sm text-ink">{t("quiz.error")}</p>
        <Button
          variant="outline"
          onClick={onHome}
          className="border-gold/40 text-gold hover:bg-gold/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("quiz.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Score + XP */}
      <div className="ln-card p-8 text-center">
        {/* MODULE 4 — scène 3D du niveau (anneaux, titre, particules).
            Décorative : le libellé texte juste au-dessous reste la source
            de vérité. Repli automatique si le 3D est indisponible. */}
        {result.levelUp && (
          <Suspense fallback={null}>
            <LevelScene
              level={result.newLevel}
              fallback={null}
              className="mx-auto mb-3 size-40"
            />
          </Suspense>
        )}
        {result.levelUp && (
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs uppercase tracking-wider text-gold">
            <Star className="h-3.5 w-3.5" /> {t("quiz.levelUp")} {result.newLevel}
          </p>
        )}
        <p className="font-display text-5xl text-ink">
          {result.correctCount}/{result.totalQuestions}
        </p>
        <p className="mt-1 text-sm text-ink-2">{result.score}%</p>
        <p className="mt-4 font-display text-2xl text-gold">
          +{result.xpEarned} XP
        </p>
        {result.streakUpdated && (
          <p className="mt-2 text-xs text-ink-2">
            🔥 {result.currentStreak} {t("quiz.streak")}
          </p>
        )}
      </div>

      {/* Badges débloqués */}
      {result.newBadges.length > 0 && (
        <div>
          <h3 className="font-display text-lg text-ink">{t("quiz.newBadges")}</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {result.newBadges.map((id) => {
              const def = BADGES.find((b) => b.id === id);
              const Icon = def?.icon ?? Star;
              return (
                <div
                  key={id}
                  className="ln-card flex items-center gap-3 border-gold/50 p-4"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/60 bg-gold/15 text-gold">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {badgeLabel(id)}
                    </p>
                    {def && (
                      <p className="text-xs text-ink-2">{def.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revoir les erreurs */}
      {result.wrongAnswers.length > 0 && (
        <div>
          <h3 className="font-display text-lg text-ink">{t("quiz.review")}</h3>
          <div className="mt-3 space-y-2">
            {result.wrongAnswers.map((w, i) => (
              <div
                key={`${w.expression}-${i}`}
                className="ln-card border-red-400/20 p-4"
              >
                <p className="text-sm font-medium text-ink">{w.expression}</p>
                <p className="text-xs text-ink-2">{w.meaning}</p>
                <p className="mt-1 text-xs text-gold">
                  ✓ {w.correctOption}
                </p>
                {w.example && (
                  <p className="mt-1 text-xs italic text-ink-2">
                    « {w.example} »
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onReplay}
          className="bg-gold text-black hover:bg-gold/85"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> {t("quiz.replay")}
        </Button>
        <Button
          variant="outline"
          onClick={onHome}
          className="border-gold/40 text-gold hover:bg-gold/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("quiz.backToHub")}
        </Button>
      </div>
    </div>
  );
}
