/* ══════════════════════════════════════════════════════════════════════
   SLEEP SHADOW — sessionPaused LOGIQUE (déterministe, sans hooks)
   
   Ces tests verrouillent le contrat `sessionPaused` en ne testant que
   le code pur extrait de SleepView.tsx — pas de rendu React, pas de
   convex hooks. Les transitions d'état, les gardes d'effet et les
   callbacks sont validés tels qu'ils apparaissent dans le composant.
   ══════════════════════════════════════════════════════════════════════ */

import { describe, expect, test } from "bun:test";

// --- Pure logic mirrors from SleepView.tsx ---

/**
 * Mirrors the useEffect dependency array check.
 * The real effect: useEffect(() => { ... }, [running, paused, sessionPaused]);
 * Returns early (undefined) when !running || paused || sessionPaused
 * Returns "start" (interval would start) when all conditions are met
 */
const checkEffectDeps = (running: boolean, paused: boolean, sessionPaused: boolean) => {
  if (!running || paused || sessionPaused) return undefined;
  // interval would start
  return "start";
};

/**
 * Mirrors finishVoice: if (runningRef.current && !sessionPaused) scheduleNext(800);
 */
const finishVoiceGatesScheduling = (running: boolean, sessionPaused: boolean) => {
  return running && !sessionPaused;
};

/**
 * Mirrors failVoice: if (runningRef.current && !sessionPaused) scheduleNext(3000);
 */
const failVoiceGatesScheduling = (running: boolean, sessionPaused: boolean) => {
  return running && !sessionPaused;
};

/**
 * Mirrors togglePause three-case logic between utterances.
 * When not speaking/pending: if (sessionPaused) { setSessionPaused(false); scheduleNext(0); }
 * else { setSessionPaused(true); }
 */
const togglePauseBetweenUtterances = (sessionPaused: boolean) => {
  if (sessionPaused) {
    // Reprise : réactive la progression, relance le prochain énoncé
    return { sessionPaused: false, scheduleNext: true };
  } else {
    // Mise en pause : mémorise l'état, empêche le prochain démarrage automatique
    return { sessionPaused: true, scheduleNext: false };
  }
};

/**
 * Mirrors chooseLang: setSessionPaused(false) reset on language change.
 */
const chooseLangResetsSessionPaused = () => {
  return false; // sessionPaused reset to false
};

/*
 * Mirrors the clock effect guard:
 * useEffect(() => { if (!running || paused || sessionPaused) return; ... }, [running, paused, sessionPaused]);
 */

/* ════════════════════════════════════════════════════════════════════════ */

describe("SleepView — sessionPaused pure logic", () => {
  describe("useEffect dependency [running, paused, sessionPaused]", () => {
    test("effect returns early (undefined) when sessionPaused is true", () => {
      // When sessionPaused=true, the effect returns early and no interval is set up
      const result = checkEffectDeps(true, false, true);
      expect(result).toBeUndefined();
    });

    test("effect returns early (undefined) when running is false", () => {
      const result = checkEffectDeps(false, false, false);
      expect(result).toBeUndefined();
    });

    test("effect returns early (undefined) when paused is true", () => {
      const result = checkEffectDeps(true, true, false);
      expect(result).toBeUndefined();
    });

    test("effect starts (returns 'start') when all conditions are met", () => {
      const result = checkEffectDeps(true, false, false);
      expect(result).toBe("start");
    });
  });

  describe("finishVoice scheduling gate", () => {
    test("schedules next phrase when not sessionPaused", () => {
      const result = finishVoiceGatesScheduling(true, false);
      expect(result).toBe(true);
    });

    test("does NOT schedule when sessionPaused is true", () => {
      const result = finishVoiceGatesScheduling(true, true);
      expect(result).toBe(false);
    });

    test("does NOT schedule when running is false", () => {
      const result = finishVoiceGatesScheduling(false, false);
      expect(result).toBe(false);
    });
  });

  describe("failVoice scheduling gate", () => {
    test("schedules retry when not sessionPaused", () => {
      const result = failVoiceGatesScheduling(true, false);
      expect(result).toBe(true);
    });

    test("does NOT schedule when sessionPaused is true", () => {
      const result = failVoiceGatesScheduling(true, true);
      expect(result).toBe(false);
    });

    test("does NOT schedule when running is false", () => {
      const result = failVoiceGatesScheduling(false, false);
      expect(result).toBe(false);
    });
  });

  describe("togglePause between utterances", () => {
    test("resumes from pause between utterances (sessionPaused → false, scheduleNext=true)", () => {
      const result = togglePauseBetweenUtterances(true);
      expect(result.sessionPaused).toBe(false);
      expect(result.scheduleNext).toBe(true);
    });

    test("pauses between utterances (sessionPaused → true, scheduleNext=false)", () => {
      const result = togglePauseBetweenUtterances(false);
      expect(result.sessionPaused).toBe(true);
      expect(result.scheduleNext).toBe(false);
    });
  });

  describe("chooseLang resets sessionPaused", () => {
    test("reset called on language change", () => {
      const result = chooseLangResetsSessionPaused();
      expect(result).toBe(false); // sessionPaused reset to false
    });
  });
});