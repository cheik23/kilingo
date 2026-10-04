import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES } from "@/convex/languages";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SpeakButton } from "./SpeakButton";
import { GoldBurst } from "@/components/fx/rewards";
import { useI18n } from "@/lib/i18n";

type Rating = "again" | "hard" | "good" | "easy";

const RATING_META: {
  key: Rating;
  label: string;
  desc: string;
  className: string;
}[] = [
  {
    key: "again",
    label: "À revoir",
    desc: "oublié",
    className:
      "border-red-400/40 bg-red-400/10 text-red-300 hover:bg-red-400/20",
  },
  {
    key: "hard",
    label: "Difficile",
    desc: "laborieux",
    className:
      "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20",
  },
  {
    key: "good",
    label: "Acquis",
    desc: "réussi",
    className:
      "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20",
  },
  {
    key: "easy",
    label: "Facile",
    desc: "instantané",
    className:
      "border-sky-400/40 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20",
  },
];

type QueueItem = {
  card: {
    _id: string;
    language: string;
    status?: string;
    consecutiveFails?: number;
  };
  slang: {
    _id: string;
    language: string;
    expression: string;
    literal?: string;
    meaning: string;
    context: string;
    register: string;
    region: string;
  };
  assisted: boolean;
  status: string;
};

type Feedback = {
  kind: "again" | "hard" | "good" | "easy" | "mastered";
  text: string;
};

function feedbackText(
  t: (k: string, p?: Record<string, string | number>) => string,
  rating: Rating,
  intervalDays: number,
  justMastered: boolean,
): Feedback {
  if (justMastered) {
    return { kind: "mastered", text: t("review.fbMastered") };
  }
  const j = (d: number) =>
    d < 1
      ? t("review.tToday")
      : d === 1
        ? t("review.tTomorrow")
        : t("review.tDays", { n: Math.round(d) });
  switch (rating) {
    case "again":
      return { kind: "again", text: t("review.fbAgain", { t: j(intervalDays) }) };
    case "hard":
      return { kind: "hard", text: t("review.fbHard", { t: j(intervalDays) }) };
    case "good":
      return { kind: "good", text: t("review.fbGood", { t: j(intervalDays) }) };
    case "easy":
      return { kind: "easy", text: t("review.fbGood", { t: j(intervalDays) }) };
  }
}

const FEEDBACK_STYLES: Record<Feedback["kind"], string> = {
  again: "border-red-400/40 text-red-300",
  hard: "border-amber-400/40 text-amber-300",
  good: "border-emerald-400/40 text-emerald-300",
  easy: "border-sky-400/40 text-sky-300",
  mastered: "border-gold/60 text-gold",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: "nouvelle", className: "border-white/15 text-ink-3" },
  learning: {
    label: "apprentissage",
    className: "border-sky-400/30 text-sky-300/80",
  },
  confirming: {
    label: "confirmation",
    className: "border-violet-400/30 text-violet-300/80",
  },
};

export function ReviewView() {
  const { t } = useI18n();
  const queue = useQuery(api.learning.reviewQueue, {});
  const drawNew = useMutation(api.learning.drawNewCards);
  const reviewMutation = useMutation(api.learning.reviewCardMutation);
  const recordSession = useMutation(api.learning.recordSession);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [burst, setBurst] = useState(0);
  const startedAt = useRef(Date.now());
  const sessionSaved = useRef(false);
  const drawAttempted = useRef(false);

  // Tire les nouvelles cartes du jour (plafond 10/jour) au montage.
  useEffect(() => {
    if (drawAttempted.current) return;
    drawAttempted.current = true;
    void drawNew({}).catch(() => undefined);
  }, [drawNew]);

  const cards = queue ?? [];

  const saveSession = async () => {
    if (sessionSaved.current || reviewed === 0) return;
    sessionSaved.current = true;
    const first = cards[0];
    if (!first) return;
    const duration = Math.max(
      1,
      Math.round((Date.now() - startedAt.current) / 1000),
    );
    try {
      await recordSession({
        language: first.card.language as never,
        kind: "srs",
        durationSeconds: duration,
        itemsLearned: reviewed,
      });
    } catch {
      // ignore
    }
  };

  const rate = async (rating: Rating) => {
    const card = cards[index];
    if (!card) return;
    try {
      const res = await reviewMutation({
        cardId: card.card._id as never,
        rating,
      });
      setFeedback(feedbackText(t, rating, res.intervalDays, res.justMastered));
      if (res.justMastered) setBurst((b) => b + 1);
    } catch {
      setFeedback({ kind: "again", text: t("review.fbError") });
    }
    setReviewed((r) => r + 1);
    setRevealed(false);
    const next = index + 1;
    setIndex(next);
    if (next >= cards.length) {
      await saveSession();
    }
  };

  if (queue === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-shimmer h-80 w-full max-w-md rounded-3xl" />
      </div>
    );
  }

  const finished = index >= cards.length;
  const current: QueueItem | undefined = cards[index];
  const last = index > 0 ? cards[index - 1] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-gold uppercase">
            {t("review.brand")}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {t("review.title")}
          </h1>
        </div>
        {cards.length > 0 && (
          <span className="rounded-full border border-white/10 px-4 py-1.5 font-mono text-xs text-ink-2">
            {Math.min(index + 1, cards.length)} / {cards.length}
          </span>
        )}
      </div>

      {feedback && (
        <motion.div
          key={`${feedback.kind}-${feedback.text}-${index}`}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`ln-feedback-in mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-center text-sm font-medium ${FEEDBACK_STYLES[feedback.kind]} ${
            feedback.kind === "mastered"
              ? "shadow-[0_0_24px_rgba(212,165,116,0.25)]"
              : ""
          }`}
        >
          {feedback.kind === "mastered" && (
            <GoldBurst trigger={burst}>
              <span />
            </GoldBurst>
          )}
          {feedback.text}
        </motion.div>
      )}

      {finished || cards.length === 0 ? (
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-noir-2 p-10 text-center">
          {reviewed > 0 ? (
            <>
              <p className="text-gradient-gold font-display text-5xl font-semibold">
                +{reviewed * 5} XP
              </p>
              <p className="mt-3 text-sm text-ink-2">
                {reviewed} carte{reviewed > 1 ? "s" : ""} consolidée
                {reviewed > 1 ? "s" : ""}. Ton cerveau fait le reste cette nuit.
              </p>
            </>
          ) : (
            <>
              <Layers className="mx-auto size-10 text-gold" />
              <p className="mt-4 font-display text-2xl">{t("review.nothing")}</p>
              <p className="mt-2 text-sm text-ink-2">
                {t("review.nothingHint")}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={current!.card._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="ln-glow rounded-3xl border border-gold/20 bg-gradient-to-br from-noir-3 via-noir-2 to-noir p-8 text-center"
            >
              {/* Mode assisté anti-acharnement : contexte + exemple AVANT la réponse */}
              {current!.assisted && !revealed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mx-auto mb-4 max-w-xs rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90"
                >
                  {t("review.hintAssisted", { c: current!.slang.context })}
                </motion.p>
              )}

              <span className="rounded-full border border-white/10 bg-noir/60 px-3 py-1 font-mono text-[0.625rem] tracking-widest text-ink-2 uppercase">
                {
                  LANGUAGES.find(
                    (l) => l.code === current!.slang.language,
                  )?.flag
                }{" "}
                {current!.slang.region} · {current!.slang.register}
              </span>

              <div className="mt-10 mb-8 flex items-center justify-center gap-3">
                <p className="font-display text-4xl italic">
                  {current!.slang.expression}
                </p>
                <SpeakButton
                  text={current!.slang.expression}
                  language={current!.slang.language}
                  size="lg"
                />
              </div>

              {revealed ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-lg font-medium text-gold">
                    {current!.slang.meaning}
                  </p>
                  <p className="text-sm text-ink-2">{current!.slang.context}</p>
                  <p className="text-xs italic text-ink-3">
                    litt. « {current!.slang.literal} »
                  </p>
                </motion.div>
              ) : (
                <button
                  onClick={() => setRevealed(true)}
                  className="mx-auto flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-sm text-gold hover:bg-gold/20"
                >
                  <Eye className="size-4" /> {t("review.reveal")}
                </button>
              )}

              {revealed && (
                <div className="mt-8 grid grid-cols-2 gap-2">
                  {RATING_META.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => rate(r.key)}
                      className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${r.className}`}
                    >
                      <span className="block font-medium">{t(`review.rating${r.key === "again" ? "Again" : r.key === "hard" ? "Hard" : r.key === "good" ? "Good" : "Easy"}`)}</span>
                      <span className="block text-[0.625rem] opacity-70">
                        {t(`review.rating${r.key === "again" ? "Again" : r.key === "hard" ? "Hard" : r.key === "good" ? "Good" : "Easy"}Desc`)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Badge de status discret sous la carte */}
              {last && STATUS_BADGE[last.status] && (
                <p className="mt-3 font-mono text-[0.625rem] text-ink-3">
                  {t("review.badgePrev")}{" "}
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[0.5625rem] ${STATUS_BADGE[last.status]!.className}`}
                  >
                    {STATUS_BADGE[last.status]!.label}
                  </span>
                </p>
              )}
            </motion.div>
          </AnimatePresence>
          <p className="mt-4 text-center font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
            {t("review.fsrsNote")}
          </p>
        </div>
      )}
    </div>
  );
}
