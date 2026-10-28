import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES } from "@/convex/languages";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CloudOff, Eye, Layers, Loader2, RefreshCw } from "lucide-react";
import { displayContext } from "@/lib/pedagogicalContext";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { SpeakButton } from "./SpeakButton";
import { AdultContentBadge } from "./AdultContentBadge";
import { UnverifiedBadge } from "./UnverifiedBadge";
import { GoldBurst } from "@/components/fx/rewards";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  createReviewSessionSaver,
  createReviewSessionTracker,
  firstPendingCard,
  needsNewBatch,
  takeIfComplete,
} from "@/lib/reviewSessionTracker";
import { createUserReviewSessionPersistence } from "@/lib/reviewSessionPersistence";

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
    /** Dernière revue servie par reviewQueue — transmise à la mutation
        comme clé d'idempotence (compare-and-swap sur lastReview). */
    lastReview?: number;
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
    /** `false` = fiche à faire relire par un natif (voir UnverifiedBadge). */
    validated?: boolean;
    /** `true` = registre sexuel ou très cru (voir AdultContentBadge). */
    isAdult?: boolean;
  };
  assisted: boolean;
  status: string;
};

type Feedback = {
  kind: "again" | "hard" | "good" | "easy" | "mastered";
  text: string;
};

/** Référence stable : évite de recréer `cards` à chaque rendu avant le query. */
const EMPTY_QUEUE: QueueItem[] = [];

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
  // `RequireAuth` attend `users.currentUser` avant de monter cette vue : la
  // file persistée est donc toujours celle du compte réellement connecté.
  const { user } = useAuth();
  const sessionUserKey = user?._id ?? null;
  const queue = useQuery(api.learning.reviewQueue, {});
  const drawNew = useMutation(api.learning.drawNewCards);
  const reviewMutation = useMutation(api.learning.reviewCardMutation);
  const recordSession = useMutation(api.learning.recordSession);

  // Le tracker porte le compteur SYNCHRONE et l'identité de session : une
  // closure React `reviewed` ne peut plus sauvegarder N−1 (ou 0 pour une
  // session d'une seule carte).
  const [tracker] = useState(createReviewSessionTracker);
  // La file survit à un rechargement : un lot non confirmé est rejoué avec
  // la même clé, donc le serveur reconnaît l'opération au lieu de recréer
  // une session.
  const [saver] = useState(() =>
    createReviewSessionSaver(async (pending) => {
      // Le résultat serveur est conservé tel quel dans le reçu du saver :
      // l'interface n'a jamais à recalculer l'XP localement.
      return await recordSession({
        language: pending.language as never,
        kind: "srs",
        durationSeconds: pending.snapshot.durationSeconds,
        itemsLearned: pending.snapshot.itemsLearned,
        // Clé stable du lot : le saver peut rejouer CE snapshot après une
        // réponse perdue, le serveur reconnaîtra la même session logique.
        sessionKey: pending.snapshot.sessionKey,
      });
    }, sessionUserKey
      ? createUserReviewSessionPersistence(sessionUserKey)
      : undefined),
  );
  // `useSyncExternalStore` expose les états du saver sans dupliquer sa file
  // dans un state React : pending, requête en vol, erreur et reçus serveur.
  const saveState = useSyncExternalStore(
    saver.subscribe,
    saver.state,
    saver.state,
  );
  // La révélation appartient à UNE carte d'UNE session précise. Un booléen
  // global laissait la carte suivante apparaître déjà révélée si la file
  // était remplacée pendant que l'ancienne carte était ouverte.
  const [revealState, setRevealState] = useState<{
    cardId: string;
    sessionId: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionReceiptKey, setSessionReceiptKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [burst, setBurst] = useState(0);
  const [lastRated, setLastRated] = useState<QueueItem | null>(null);
  const drawAttempted = useRef(false);
  const mountedRef = useRef(true);
  const sessionLanguageRef = useRef<string | null>(null);
  // Garde anti double-soumission : un seul rate() en vol à la fois.
  // Un ref (et non un state) est synchrone : deux clics dans la même frame
  // ne peuvent pas cibler deux fois la même carte.
  const submittingRef = useRef(false);
  // Cartes du lot courant : permet de distinguer un rafraîchissement de la
  // file (cartes déjà revues qui disparaissent) d'un NOUVEAU lot, même si
  // Convex remplace la file sans rendre un état vide intermédiaire.
  const batchIdsRef = useRef<ReadonlySet<string> | null>(null);

  // Tire les nouvelles cartes du jour (plafond 10/jour) au montage.
  useEffect(() => {
    if (drawAttempted.current) return;
    drawAttempted.current = true;
    void drawNew({}).catch(() => undefined);
  }, [drawNew]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cards = queue ?? EMPTY_QUEUE;
  const acceptedIds = tracker.acceptedIds();
  const pendingCount = cards.reduce(
    (n, item) => n + (acceptedIds.has(item.card._id) ? 0 : 1),
    0,
  );
  const current = firstPendingCard(cards, acceptedIds);
  const finished = queue !== undefined && current === undefined;

  // Ouvre un lot : identité + horloge du tracker, remise à zéro du résumé
  // précédent. Le compteur affiché et le total final vivent dans le tracker.
  const beginSession = useCallback(
    (language: string, items: readonly QueueItem[]) => {
      tracker.start();
      batchIdsRef.current = new Set(items.map((item) => item.card._id));
      sessionLanguageRef.current = language;
      // Pas de setState ici : cette fonction est appelée depuis un effet.
      // La révélation est déjà invalidée par l'identité de carte/session, et
      // le reçu XP est remplacé dans `rate()` au moment d'enfiler le nouveau
      // lot — aucun reçu de la session précédente ne peut donc être réutilisé.
    },
    [tracker],
  );

  // Garantit qu'une session est ouverte pour `active`. Même lot → no-op ;
  // lot remplacé → nouvelle session si aucun résultat n'attend, sinon on
  // rattache le nouveau lot au compteur existant pour ne rien effacer.
  const ensureSessionFor = useCallback(
    (
      items: readonly QueueItem[],
      active: QueueItem,
      accepted: ReadonlySet<string>,
    ) => {
      if (
        !needsNewBatch(
          batchIdsRef.current,
          items,
          accepted,
          active.card._id,
        )
      ) {
        return;
      }
      // Des cartes acceptées ne sont pas encore persistées (file remplacée
      // par un autre onglet avant la fin du lot) : on les rattache au lot
      // suivant au lieu de les effacer avec un nouveau `start()`.
      if (tracker.count() > 0) {
        const merged = new Set(batchIdsRef.current ?? []);
        for (const item of items) merged.add(item.card._id);
        batchIdsRef.current = merged;
        return;
      }
      beginSession(active.card.language, items);
    },
    [beginSession, tracker],
  );

  // Restaure la file locale au montage, avec UNE tentative automatique.
  // Après un échec, aucune boucle : c'est le bouton de reprise qui rejoue
  // la même file et la même clé.
  useEffect(() => {
    void saver.flush();
  }, [saver]);

  // Une session commence quand une carte apparaît après une fin de session
  // (chargement initial ou nouveau lot). Une file vide clôt le lot : un lot
  // identique rechargé plus tard ne sera pas absorbé par l'ancienne session.
  useEffect(() => {
    if (queue === undefined) return;
    if (current === undefined) {
      batchIdsRef.current = null;
      return;
    }
    ensureSessionFor(cards, current, acceptedIds);
  }, [queue, cards, current, acceptedIds, ensureSessionFor]);

  const rate = async (rating: Rating) => {
    // Anti double-soumission : si une mutation est déjà en vol, on ignore
    // le clic. La carte déjà acceptée est également refusée, même si un
    // re-render n'a pas encore eu lieu.
    if (submittingRef.current) return;
    const card = current;
    if (!card || tracker.isAccepted(card.card._id)) return;
    // Filet de sécurité si l'utilisateur clique avant l'effet de démarrage :
    // la première revue d'un nouveau lot ouvre explicitement sa session.
    ensureSessionFor(cards, card, acceptedIds);
    submittingRef.current = true;
    setSubmitting(true);
    const sessionId = tracker.sessionId();
    try {
      const res = await reviewMutation({
        cardId: card.card._id as never,
        rating,
        // Idempotence backend : la mutation refuse si la carte a été revue
        // depuis que cette carte a été affichée (lastReview périmé).
        expectedLastReview: card.card.lastReview ?? null,
      });
      // Réponse tardive d'une session remplacée (ou composant démonté) :
      // ne jamais créditer la nouvelle session avec l'ancienne réponse.
      if (!mountedRef.current || sessionId !== tracker.sessionId()) return;
      const accepted = tracker.accept(card.card._id, sessionId);
      if (!accepted.counted) return;
      // Le compteur vient du tracker ; `setFeedback` provoque le re-rendu.
      setLastRated(card);
      setFeedback(feedbackText(t, rating, res.intervalDays, res.justMastered));
      if (res.justMastered) setBurst((b) => b + 1);
      // Une réponse tardive d'une autre carte ne doit jamais refermer la
      // révélation de la carte affichée à cet instant.
      setRevealState((state) =>
        state?.cardId === card.card._id ? null : state,
      );
      // Dernière carte du lot : takeIfComplete() consomme le compteur
      // synchrone exactement une fois et renvoie itemsLearned = N.
      const snapshot = takeIfComplete(cards, tracker);
      if (snapshot) {
        setSessionReceiptKey(snapshot.sessionKey);
        saver.enqueue({
          snapshot,
          language: sessionLanguageRef.current ?? card.card.language,
        });
        // Une seule tentative automatique après l'enqueue. En cas d'échec,
        // le bouton de reprise est le seul chemin de retry.
        void saver.flush();
      }
    } catch {
      if (!mountedRef.current) return;
      // Échec de la mutation principale : la carte reste courante (elle
      // n'entre pas dans acceptedIds), le compteur ne bouge pas, la garde
      // se libère dans finally et une nouvelle tentative est possible.
      setFeedback({ kind: "again", text: t("review.fbError") });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (queue === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-shimmer h-80 w-full max-w-md rounded-3xl" />
      </div>
    );
  }

  // Pendant un lot, le compteur affiché vient du tracker (synchrone) ; le
  // résumé final lit le total du dernier lot consommé, mémorisé par take().
  const reviewed = tracker.lastItemsLearned();
  const reviewedNow = current ? tracker.count() : reviewed;
  const totalNow = reviewedNow + pendingCount;
  // Reçu serveur de LA session affichée, jamais un total local recalculé.
  const activeReceipt = sessionReceiptKey
    ? saveState.receipts[sessionReceiptKey]
    : undefined;
  const saveError = saveState.error !== null;
  const savePending = saveState.pending > 0;
  // La révélation n'est valide que pour cette carte et cette identité de
  // session. Dès que `current` change, la nouvelle carte est masquée au
  // premier rendu, sans attendre un effet.
  const revealed =
    current !== undefined &&
    revealState !== null &&
    revealState.cardId === current.card._id &&
    revealState.sessionId === tracker.sessionId();
  // Le badge « carte précédente » n'a de sens qu'après au moins une réussite
  // du lot courant (pas de statut périmé au début d'un nouveau lot).
  const last = tracker.count() > 0 ? lastRated : null;
  /* BOUCLIER — l'indice assisté et la révélation affichent le contexte
     filtré (MIXED → exemple seul, PURE/DIRECTIVE/AMBIGUOUS → masqué).
     La logique SRS (queue, ratings,.breakpoints) reste sur les données
     brutes. */
  const shownContext = current ? displayContext(current.slang.context) : null;

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
            {Math.min(reviewedNow + 1, totalNow)} / {totalNow}
          </span>
        )}
      </div>

      {savePending && (
        <div
          role={saveError ? "alert" : "status"}
          aria-live="polite"
          data-save-state={
            saveError ? "error" : saveState.inFlight ? "saving" : "pending"
          }
          className={`mx-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            saveError
              ? "border-red-400/40 bg-red-400/5 text-red-200"
              : "border-amber-400/30 bg-amber-400/5 text-amber-200"
          }`}
        >
          {saveError ? (
            <CloudOff className="mt-0.5 size-4 shrink-0" />
          ) : saveState.inFlight ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          ) : (
            <CloudOff className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {saveError
                ? t("review.saveFailed")
                : t("review.savePending")}
            </p>
            <p className="mt-1 text-xs opacity-75">
              {t("review.savePendingCount", { n: saveState.pending })}
            </p>
          </div>
          {!saveState.inFlight && (
            <button
              type="button"
              onClick={() => void saver.retry()}
              data-qa="retry-save"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-current/30 px-3 py-1.5 text-xs font-medium hover:bg-current/10 disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" />
              {t("review.retrySave")}
            </button>
          )}
        </div>
      )}

      {feedback && (
        <motion.div
          key={`${feedback.kind}-${feedback.text}-${current?.card._id ?? "done"}`}
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
              {activeReceipt ? (
                <>
                  {/* Aucun XP inventé : si le serveur n'a pas renvoyé de
                      gain, on confirme la sauvegarde sans afficher de nombre. */}
                  {activeReceipt.xpGain !== null && (
                    <p
                      className="text-gradient-gold font-display text-5xl font-semibold"
                      data-qa="session-xp"
                      data-xp-gain={activeReceipt.xpGain}
                    >
                      +{activeReceipt.xpGain} XP
                    </p>
                  )}
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-300">
                    <CheckCircle2 className="size-3.5" />
                    {t("review.saveConfirmed")}
                  </p>
                </>
              ) : (
                <p className="font-display text-2xl text-ink-2">
                  {saveError
                    ? t("review.saveNotConfirmed")
                    : t("review.savePending")}
                </p>
              )}
              <p className="mt-3 text-sm text-ink-2">
                {t("review.done", { n: reviewed })}
              </p>
            </>
          ) : savePending ? (
            <>
              <CloudOff className="mx-auto size-10 text-amber-300" />
              <p className="mt-4 font-display text-2xl">
                {t("review.savePending")}
              </p>
              <p className="mt-2 text-sm text-ink-2">
                {t("review.savePendingCount", { n: saveState.pending })}
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
              {/* Mode assisté anti-acharnement : contexte + exemple AVANT la réponse.
                  Bouclier : si displayContext() renvoie null, aucun indice n'est
                  affiché (ni template, ni chaîne vide). */}
              {current!.assisted && !revealed && shownContext && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mx-auto mb-4 max-w-xs rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90"
                >
                  {t("review.hintAssisted", { c: shownContext })}
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

              {/* Réserve sur le contenu : visible pendant la révision, au même
                  titre que dans la Découverte. Rendu conditionnel plutôt que
                  laissé au badge seul, pour ne pas insérer de bloc vide. */}
              {(current!.slang.validated === false ||
                current!.slang.isAdult === true) && (
                <div className="-mt-6 mb-6 flex flex-wrap justify-center gap-2">
                  <UnverifiedBadge validated={current!.slang.validated} />
                  <AdultContentBadge isAdult={current!.slang.isAdult} />
                </div>
              )}

              {revealed ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-lg font-medium text-gold">
                    {current!.slang.meaning}
                  </p>
                  {shownContext && (
                    <p className="text-sm text-ink-2">{shownContext}</p>
                  )}
                  <p className="text-xs italic text-ink-3">
                    litt. « {current!.slang.literal} »
                  </p>
                </motion.div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!current) return;
                    setRevealState({
                      cardId: current.card._id,
                      sessionId: tracker.sessionId(),
                    });
                  }}
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
                      type="button"
                      disabled={submitting}
                      aria-busy={submitting}
                      onClick={() => rate(r.key)}
                      className={`rounded-xl border px-3 py-2.5 text-sm transition-colors disabled:cursor-wait disabled:opacity-50 ${r.className}`}
                    >
                      <span className="block font-medium">{t(`review.rating${r.key === "again" ? "Again" : r.key === "hard" ? "Hard" : r.key === "good" ? "Good" : "Easy"}`)}</span>
                      <span className="block text-[0.625rem] opacity-70">
                        {t(`review.rating${r.key === "again" ? "Again" : r.key === "hard" ? "Hard" : r.key === "good" ? "Good" : "Easy"}Desc`)}
                      </span>
                    </button>
                  ))}
                  {submitting && (
                    <p
                      role="status"
                      className="col-span-2 flex items-center justify-center gap-1.5 text-xs text-ink-3"
                    >
                      <Loader2 className="size-3.5 animate-spin" />
                      {t("review.savingCard")}
                    </p>
                  )}
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
