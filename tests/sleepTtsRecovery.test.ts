import { describe, expect, test } from "bun:test";
import {
  createStallRetryTracker,
  createUtteranceWatchdog,
  decideResumeAction,
} from "../src/lib/sleepTtsRecovery";

/* File de timers déterministe : chaque setTimeout pousse un retour
   identificable, clearTimeout le retire — les tests pilotent les ticks
   manuellement, exactement dans l'esprit du harness du scheduler. */
function createTimerQueue() {
  let nextId = 1;
  const pending = new Map<number, () => void>();
  return {
    setTimeout(callback: () => void): ReturnType<typeof setTimeout> {
      const id = nextId++;
      pending.set(id, callback);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(timerId: unknown): void {
      pending.delete(timerId as number);
    },
    tick(times = 1) {
      for (let i = 0; i < times; i++) {
        const oldestId = Math.min(...pending.keys());
        const callback = pending.get(oldestId);
        if (!callback) throw new Error("aucun timer de vigie armé");
        pending.delete(oldestId);
        callback();
      }
    },
    countPending(): number {
      return pending.size;
    },
  };
}

function createTestWatchdog(config: {
  isPaused: () => boolean;
  isCurrent?: () => boolean;
  hasStarted?: () => boolean;
  hasEnded?: () => boolean;
  hasEngineActivity?: () => boolean;
  onStall?: () => void;
}) {
  const q = createTimerQueue();
  let stalled = 0;
  const watchdog = createUtteranceWatchdog({
    tickMs: 1000,
    startBudgetMs: 8000,
    endBudgetMs: 20000,
    isPaused: config.isPaused,
    isCurrent: config.isCurrent ?? (() => true),
    hasStarted: config.hasStarted ?? (() => false),
    hasEnded: config.hasEnded ?? (() => false),
    hasEngineActivity: config.hasEngineActivity,
    onStall: () => {
      stalled += 1;
      config.onStall?.();
    },
    setTimeout: q.setTimeout as unknown as (
      callback: () => void,
      delayMs: number,
    ) => ReturnType<typeof setTimeout>,
    clearTimeout: q.clearTimeout as unknown as (
      timer: ReturnType<typeof setTimeout>,
    ) => void,
  });
  return {
    watchdog,
    tick: q.tick,
    countPending: q.countPending,
    stallCount: () => stalled,
  };
}

describe("decideResumeAction — reprise fondée sur l'état de session explicite", () => {
  test("pause pendant une phrase acceptée par le moteur → reprise en place, même phrase", () => {
    expect(
      decideResumeAction({ enginePaused: true, hasActiveUtterance: true }),
    ).toBe("resume-engine");
  });

  test("moteur dont paused reste false après pause() (média wedgé) → récupération", () => {
    expect(
      decideResumeAction({ enginePaused: false, hasActiveUtterance: true }),
    ).toBe("recover-wedge");
  });

  test("pause entre deux phrases (aucun média actif) → relance unique par le scheduler", () => {
    expect(
      decideResumeAction({ enginePaused: false, hasActiveUtterance: false }),
    ).toBe("resume-idle");
  });

  test("drapeau moteur collant (paused vrai sans média actif) → resume-engine débloque", () => {
    expect(
      decideResumeAction({ enginePaused: true, hasActiveUtterance: false }),
    ).toBe("resume-engine");
  });
});

describe("createUtteranceWatchdog — vigie d'utterance perdue", () => {
  test("sans onstart, onStall part après le budget hors pause, une seule fois", () => {
    const h = createTestWatchdog({ isPaused: () => false });
    for (let i = 0; i < 7; i++) {
      h.tick(1);
      expect(h.stallCount()).toBe(0);
    }
    h.tick(1); // 8 s hors pause sans onstart -> stall
    expect(h.stallCount()).toBe(1);
    expect(h.countPending()).toBe(0); // la vigie s'est désarmée seule
  });

  test("pause légitime (moteur suspendu ou session explicite) : budget gelé, faux positif impossible", () => {
    let paused = true;
    const h = createTestWatchdog({ isPaused: () => paused });
    h.tick(30); // passé le budget… mais en pause : aucun stall
    expect(h.stallCount()).toBe(0);
    expect(h.countPending()).toBe(1); // la vigie surveille toujours
    paused = false;
    h.tick(7); // 7 s hors pause : encore sous le budget
    expect(h.stallCount()).toBe(0);
    h.tick(1); // 8e s hors pause -> stall, exactement au budget reprend où il était
    expect(h.stallCount()).toBe(1);
  });

  test("onstart tiré mais jamais onend : le budget de fin se rapporte au stall", () => {
    const h = createTestWatchdog({
      isPaused: () => false,
      hasStarted: () => true,
    });
    h.tick(19);
    expect(h.stallCount()).toBe(0);
    h.tick(1); // 20 s hors pause avec onstart mais sans onend
    expect(h.stallCount()).toBe(1);
  });

  test("utterance terminée (onend) : la vigie se désarme sans stall", () => {
    const h = createTestWatchdog({
      isPaused: () => false,
      hasEnded: () => true,
    });
    h.tick(1);
    expect(h.stallCount()).toBe(0);
    expect(h.countPending()).toBe(0);
  });

  test("utterance invalidée (plus current) : nettoyage sans invoquer onStall", () => {
    const h = createTestWatchdog({
      isPaused: () => false,
      isCurrent: () => false,
    });
    h.tick(1);
    expect(h.stallCount()).toBe(0);
    expect(h.countPending()).toBe(0);
  });

  test("cas 1 — onstart arrive avant le délai : aucune récupération, la réussite désarme simplement la vigie", () => {
    const started = true;
    let ended = false;
    const h = createTestWatchdog({
      isPaused: () => false,
      hasStarted: () => started,
      hasEnded: () => ended,
    });
    h.tick(5); // 5 s < budget de fin (20 s) : verdict non émis
    expect(h.stallCount()).toBe(0);
    ended = true; // onend naturel arrive ensuite
    h.tick(1);
    expect(h.stallCount()).toBe(0);
    expect(h.countPending()).toBe(0); // désarmée, aucun verdict
  });

  test("cas 2 — onstart jamais tiré, activité moteur présente : UNE grâce, puis verdict de blocage", () => {
    let engineActive = true;
    const h = createTestWatchdog({
      isPaused: () => false,
      hasEngineActivity: () => engineActive,
    });
    h.tick(8); // 1re échéance : activité apparente → grâce (jamais le verdict)
    expect(h.stallCount()).toBe(0);
    expect(h.countPending()).toBe(1); // toujours en surveillance
    h.tick(7); // fenêtre de grâce : 7 s écoulées
    expect(h.stallCount()).toBe(0);
    h.tick(1); // 2e échéance : la grâce est unique → verdict
    expect(h.stallCount()).toBe(1);
    expect(h.countPending()).toBe(0);
    engineActive = false; // post-verdict : plus aucun effet
  });

  test("cas 2 bis — activité moteur tombée pendant la grâce : verdict à la 2e échéance, sans repasser une 2e grâce", () => {
    let engineActive = true;
    const h = createTestWatchdog({
      isPaused: () => false,
      hasEngineActivity: () => engineActive,
    });
    h.tick(8); // 1re échéance → grâce accordée
    engineActive = false; // le moteur ne parle plus du tout
    h.tick(8); // 2e échéance avec un moteur muet → verdict
    expect(h.stallCount()).toBe(1);
  });

  test("cas 2 ter — onstart jamais tiré et moteur muet : verdict direct au délai sans grâce", () => {
    const h = createTestWatchdog({
      isPaused: () => false,
      hasEngineActivity: () => false,
    });
    h.tick(8);
    expect(h.stallCount()).toBe(1);
  });

  test("cas 3 — pause légitime pendant tout le délai : aucune récupération intempestive", () => {
    const h = createTestWatchdog({ isPaused: () => true });
    h.tick(40); // plus que le double du budget, budget gelé
    expect(h.stallCount()).toBe(0);
    expect(h.countPending()).toBe(1);
  });

  test("cas 6 — createStallRetryTracker : tentatives bornées, sans boucle infinie", () => {
    const tracker = createStallRetryTracker(); // borne par défaut : 3
    expect(tracker.record()).toEqual({ canRetry: true, exhausted: false });
    expect(tracker.record()).toEqual({ canRetry: true, exhausted: false });
    expect(tracker.count()).toBe(2);
    const third = tracker.record();
    expect(third.canRetry).toBe(false);
    expect(third.exhausted).toBe(true);
    expect(tracker.exhausted()).toBe(true);
    expect(tracker.record().exhausted).toBe(true); // 4e échec : toujours épuisé
    expect(tracker.count()).toBe(4);
    tracker.reset(); // succès réel ou relance utilisateur
    expect(tracker.count()).toBe(0);
    expect(tracker.exhausted()).toBe(false);
    expect(tracker.record().canRetry).toBe(true);
  });

  test("stop() désarme immédiatement", () => {
    const h = createTestWatchdog({ isPaused: () => false });
    h.tick(2);
    h.watchdog.stop();
    expect(h.countPending()).toBe(0);
  });
});
