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
  setTimeout = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout = (timer) => globalThis.clearTimeout(timer),
}: UtteranceWatchdogOptions): UtteranceWatchdog {
  let stopped = false;
  let unpausedMs = 0;
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
