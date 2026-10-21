/**
 * Récupération TTS pour Sleep Shadow — pause pendant une phrase.
 *
 * Recette navigateur démontrée (Edge, build :4599) : `speechSynthesis.pause()`
 * est parfois IGNORÉ par le moteur sur une utterance en cours — `paused` reste
 * `false`, l'utterance ne tire jamais `onend`, et `speaking` reste bloqué à
 * `true`. La matrice in-page (pause à +50/150/300/600 ms après `onstart`,
 * voix network et locale) reproduit le défaut de façon voix/langue/timing
 * dépendante. Conséquence : une décision de reprise dérivée de la seule
 * ligne `synth.paused` classe « Reprendre » dans le chemin pause → session
 * figée pour toujours (le comportement reproché, corrigé ici).
 *
 * Deux briques pures et testables :
 *  - decideResumeAction : mode de reprise fondé sur l'ÉTAT DE SESSION
 *    explicite (le composant porte « en pause », jamais le moteur seul) ;
 *  - createUtteranceWatchdog : vigie d'une utterance qui ne démarre jamais
 *    (`onstart` absent) ou ne termine jamais (`onend` absent) — le budget
 *    est gelé pendant une pause légitime (moteur réellement suspendu ou
 *    session explicitement en pause), jamais de faux positif sous pause.
 *    Si le moteur rapporte encore de l'activité sans `onstart`, une seule
 *    fenêtre de grâce est accordée (retard de démarrage / callback raté)
 *    avant le verdict « véritable blocage ».
 *  - createStallRetryTracker : borne les réessais consécutifs pour qu'une
 *    voix défaillante ne boucle jamais à l'infini.
 */

export type ResumeAction =
  /** Le média a réellement été suspendu : reprise en place de la même phrase. */
  | "resume-engine"
  /** Pause ignorée par le moteur : média coincé sans `onend`, il faut
      l'annuler et relancer UNE nouvelle phrase (jamais un doublon). */
  | "recover-wedge"
  /** Pause entre deux phrases : le scheduler relance exactement une fois. */
  | "resume-idle";

export function decideResumeAction({
  enginePaused,
  hasActiveUtterance,
}: {
  enginePaused: boolean;
  hasActiveUtterance: boolean;
}): ResumeAction {
  if (enginePaused) return "resume-engine";
  if (hasActiveUtterance) return "recover-wedge";
  return "resume-idle";
}

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type UtteranceWatchdog = { stop(): void };

export type UtteranceWatchdogOptions = {
  /** Rythme de la vigie (défaut 1 s). */
  tickMs?: number;
  /** Hors pause, sans `onstart` : le moteur ne démarre pas (ms). */
  startBudgetMs?: number;
  /** Hors pause, `onstart` tiré mais jamais `onend` (ms). */
  endBudgetMs?: number;
  /** Suspend toute vigilance pendant une pause légitime (budget gelé). */
  isPaused(): boolean;
  /** Utterance toujours la session active (scheduler). */
  isCurrent(): boolean;
  hasStarted(): boolean;
  hasEnded(): boolean;
  /** Déclenché une fois : l'utterance est perdue, la relance est au caller. */
  onStall(): void;
  /** Activité moteur apparente (ex. `speechSynthesis.speaking === true`) à
   *  l'instant du verdict : l'utterance a peut-être RÉELLEMENT démarré
   *  (callback `onstart` raté) — si renseigné, UNE fenêtre de grâce est
   *  accordée avant le verdict de blocage. Absent : verdict direct. */
  hasEngineActivity?(): boolean;
  /** Injectables pour des tests déterministes. */
  setTimeout?(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout?(timer: TimerHandle): void;
};

/**
 * Vigie à timer auto-réarmé : chaque tick vérifie si l'utterance est morte,
 * gelée par une pause (aucun budget consommé) ou encore en vie. Au dépassement
 * de budget hors pause, `onStall` part UNE fois et la vigie se désarme seule.
 * Le caller relance ensuite (le `cancel()` préalable de `speakText` nettoie
 * naturellement le moteur bloqué).
 */
export function createUtteranceWatchdog({
  tickMs = 1000,
  startBudgetMs = 8000,
  endBudgetMs = 20000,
  isPaused,
  isCurrent,
  hasStarted,
  hasEnded,
  onStall,
  hasEngineActivity,
  setTimeout = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout = (timer) => globalThis.clearTimeout(timer),
}: UtteranceWatchdogOptions): UtteranceWatchdog {
  let stopped = false;
  let unpausedMs = 0;
  let graceUsed = false;
  let timer: TimerHandle | null = setTimeout(tick, tickMs);

  const disarm = () => {
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  function tick() {
    if (stopped) return;
    if (!isCurrent() || hasEnded()) {
      disarm();
      return;
    }
    if (isPaused()) {
      // Pause légitime (suspension moteur réelle ou session explicite) :
      // la vigilance est suspendue, le budget ne tourne pas.
      timer = setTimeout(tick, tickMs);
      return;
    }
    unpausedMs += tickMs;
    const budgetMs = hasStarted() ? endBudgetMs : startBudgetMs;
    if (unpausedMs >= budgetMs) {
      /* Verdict : le délai vient d'expirer SANS `onstart`. Avant de proclamer
         le blocage, regarder si le navigateur accorde de l'activité à cette
         utterance (ex. `speaking === true`) : elle est peut-être réellement
         en train de jouer avec un `onstart` raté — UNE seule grâce, jamais
         deux : un retard légitime est honoré, un blocage finit toujours
         par être proclamé (pas de silence infini). */
      if (!hasStarted() && !graceUsed && hasEngineActivity?.() === true) {
        graceUsed = true;
        unpausedMs = 0;
        timer = setTimeout(tick, tickMs);
        return;
      }
      disarm();
      onStall();
      return;
    }
    timer = setTimeout(tick, tickMs);
  }

  return {
    stop: disarm,
  };
}

export type StallRetryVerdict = { canRetry: boolean; exhausted: boolean };
export type StallRetryTracker = {
  /** Un échec supplémentaire. La borne vaut N tentatives consécutives :
   *  record() N-1 fois → canRetry, Nᵉ fois → exhausted. */
  record(): StallRetryVerdict;
  /** Une utterance a réussi (onend naturel, ou nouvelle session/nouvelle
   *  langue) : le compteur repart de zéro. */
  reset(): void;
  count(): number;
  exhausted(): boolean;
};

/**
 * Borne les réessais consécutifs d'une voie défaillante (défaut 3) — le
 * même contract que le repli Piper de SleepView : après épuisement, la
 * relance s'arrête net (verdict `exhausted`), le composant affiche un
 * avertissement récupérable et ne boucle plus à l'infini.
 */
export function createStallRetryTracker(maxConsecutive = 3): StallRetryTracker {
  let failures = 0;
  return {
    record(): StallRetryVerdict {
      failures += 1;
      return {
        canRetry: failures < maxConsecutive,
        exhausted: failures >= maxConsecutive,
      };
    },
    reset() {
      failures = 0;
    },
    count: () => failures,
    exhausted: () => failures >= maxConsecutive,
  };
}
