export type SleepSpeechScheduler = {
  /** Start a new session and queue its first utterance. */
  start(): void;
  /** Pause scheduling and invalidate an utterance still in its pre-start gap. */
  pause(): void;
  /** Resume a suspended utterance or queue one utterance between phrases. */
  resume(): void;
  /** Replace pending speech after a session context change, such as language. */
  restart(delayMs: number): void;
  /** Stop the session and invalidate all delayed or active callbacks. */
  stop(): void;
  /** Replace the latest component-level speech launcher after each React commit. */
  setLaunchHandler(
    launch: (
      complete: (nextDelayMs: number | null) => void,
      isCurrent: () => boolean,
    ) => void,
  ): void;
  isRunning(): boolean;
  isPaused(): boolean;
  /** Une utterance acceptée est-elle encore active (lancée, jamais terminée) ?
   *  Sert à distinguer, à la reprise, une pause entre deux phrases d'un
   *  moteur qui a ignoré pause() (média coincé sans fin, cf. sleepTtsRecovery). */
  hasActiveUtterance(): boolean;
};

type CreateSleepSpeechSchedulerOptions = {
  /** Called once per accepted utterance with its completion and validity callbacks. */
  launch(
    complete: (nextDelayMs: number | null) => void,
    isCurrent: () => boolean,
  ): void;
  /** The quiet gap before an utterance; injectable for deterministic tests. */
  wait?(delayMs: number): Promise<void>;
  setTimeout?(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout?(timer: ReturnType<typeof setTimeout>): void;
  gapMs?: number;
};

/**
 * Owns Sleep Shadow's delayed utterance lifecycle independently of React renders.
 * Each delayed launch and quiet gap has a generation token. Pausing, restarting,
 * or stopping invalidates stale async continuations. An accepted utterance keeps
 * its identity while paused, so resuming it cannot enqueue a duplicate.
 */
export function createSleepSpeechScheduler({
  launch,
  wait = (delayMs) =>
    new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs)),
  setTimeout = globalThis.setTimeout.bind(globalThis),
  clearTimeout = globalThis.clearTimeout.bind(globalThis),
  gapMs = 1200,
}: CreateSleepSpeechSchedulerOptions): SleepSpeechScheduler {
  let launchHandler = launch;
  let running = false;
  let paused = false;
  let generation = 0;
  let nextSpeechId = 0;
  let activeSpeechId: number | null = null;
  let pendingLaunchToken: number | null = null;
  let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  let scheduledGeneration: number | null = null;

  const clearScheduledTimer = () => {
    if (scheduledTimer !== null) clearTimeout(scheduledTimer);
    scheduledTimer = null;
    scheduledGeneration = null;
  };

  const schedule = (delayMs: number) => {
    if (
      !running || paused || activeSpeechId !== null ||
      pendingLaunchToken !== null || scheduledTimer !== null
    ) return;

    const token = ++generation;
    scheduledGeneration = token;
    scheduledTimer = setTimeout(() => {
      if (scheduledGeneration === token) clearScheduledTimer();
      if (!running || paused || generation !== token || activeSpeechId !== null) return;
      pendingLaunchToken = token;
      void beginUtterance(token);
    }, delayMs);
  };

  const beginUtterance = async (token: number) => {
    await wait(gapMs);
    if (pendingLaunchToken === token) pendingLaunchToken = null;
    if (!running || paused || generation !== token || activeSpeechId !== null) return;

    const speechId = ++nextSpeechId;
    activeSpeechId = speechId;
    const complete = (nextDelayMs: number | null) => {
      if (!running || activeSpeechId !== speechId) return;
      activeSpeechId = null;
      if (nextDelayMs !== null && !paused) schedule(nextDelayMs);
    };

    launchHandler(
      complete,
      () => running && activeSpeechId === speechId,
    );
  };

  return {
    start() {
      if (running) return;
      running = true;
      paused = false;
      activeSpeechId = null;
      pendingLaunchToken = null;
      schedule(0);
    },
    pause() {
      if (!running || paused) return;
      paused = true;
      // Invalidate scheduled timers and in-flight quiet-gap continuations, but
      // retain an already launched speech id for an in-place media resume.
      generation += 1;
      clearScheduledTimer();
      pendingLaunchToken = null;
    },
    resume() {
      if (!running || !paused) return;
      paused = false;
      // Active media continues through its engine; only an idle gap needs a
      // single replacement launch.
      if (activeSpeechId === null) schedule(0);
    },
    restart(delayMs: number) {
      if (!running) return;
      generation += 1;
      clearScheduledTimer();
      pendingLaunchToken = null;
      activeSpeechId = null;
      paused = false;
      schedule(delayMs);
    },
    stop() {
      running = false;
      paused = false;
      generation += 1;
      clearScheduledTimer();
      pendingLaunchToken = null;
      activeSpeechId = null;
    },
    setLaunchHandler(nextLaunchHandler) {
      launchHandler = nextLaunchHandler;
    },
    isRunning: () => running,
    isPaused: () => paused,
    hasActiveUtterance: () => activeSpeechId !== null,
  };
}
