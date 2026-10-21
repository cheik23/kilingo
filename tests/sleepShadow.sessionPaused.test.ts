import { describe, expect, test } from "bun:test";
import {
  createSleepSpeechScheduler,
  type SleepSpeechScheduler,
} from "../src/lib/sleepSpeechScheduler";

type Deferred = {
  promise: Promise<void>;
  resolve(): void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHarness() {
  const waits: Deferred[] = [];
  const launched: Array<{
    complete(nextDelayMs: number | null): void;
    isCurrent(): boolean;
  }> = [];
  const timers: Array<() => void> = [];
  const scheduler: SleepSpeechScheduler = createSleepSpeechScheduler({
    wait: () => {
      const wait = deferred();
      waits.push(wait);
      return wait.promise;
    },
    setTimeout: (callback) => {
      timers.push(callback);
      return timers.length as unknown as ReturnType<typeof setTimeout>;
    },
    // Model a callback already queued by the event loop when cancellation occurs.
    clearTimeout: () => {},
    launch: (complete, isCurrent) => launched.push({ complete, isCurrent }),
  });

  return {
    scheduler,
    launched,
    runTimer(index = 0) {
      const timer = timers[index];
      if (!timer) throw new Error(`No scheduled timer at index ${index}`);
      timer();
    },
    async resolveWait(index = 0) {
      const wait = waits[index];
      if (!wait) throw new Error(`No pending wait at index ${index}`);
      wait.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe("Sleep Shadow — scheduler actually used by SleepView", () => {
  test("pause before the scheduled timeout fires invalidates that queued callback", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.scheduler.pause();
    h.runTimer(); // simulate a timeout callback already queued before clearTimeout
    await Promise.resolve();
    expect(h.launched).toHaveLength(0);
    expect(h.scheduler.isPaused()).toBe(true);

    h.scheduler.resume();
    h.runTimer(1);
    await h.resolveWait();
    expect(h.launched).toHaveLength(1);
  });

  test("pause during the quiet gap invalidates the pending utterance before it starts", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.runTimer(); // the timeout fires, then enters the 1200ms quiet gap
    expect(h.launched).toHaveLength(0);

    h.scheduler.pause();
    await h.resolveWait();
    expect(h.launched).toHaveLength(0);
    expect(h.scheduler.isPaused()).toBe(true);
  });

  test("resuming a suspended utterance resumes that same speech without launching a duplicate", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.runTimer();
    await h.resolveWait();
    expect(h.launched).toHaveLength(1);
    expect(h.launched[0].isCurrent()).toBe(true);

    h.scheduler.pause();
    h.scheduler.resume();
    expect(h.launched).toHaveLength(1);
    expect(h.launched[0].isCurrent()).toBe(true);

    h.launched[0].complete(800);
    expect(h.launched).toHaveLength(1);
    h.runTimer(1);
    await h.resolveWait(1);
    expect(h.launched).toHaveLength(2);
  });

  test("resuming between utterances schedules exactly one next utterance", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.runTimer();
    await h.resolveWait();
    h.launched[0].complete(null); // completed; do not automatically schedule

    h.scheduler.pause();
    h.scheduler.resume();
    // Repeated resume calls are idempotent and cannot add a second timer.
    h.scheduler.resume();
    h.runTimer(1);
    await h.resolveWait(1);
    expect(h.launched).toHaveLength(2);
  });

  test("stop during a scheduled delay prevents any utterance from starting", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.scheduler.stop();
    h.runTimer();
    await Promise.resolve();
    expect(h.launched).toHaveLength(0);
    expect(h.scheduler.isRunning()).toBe(false);
  });

  test("stop during the quiet gap invalidates the in-flight continuation", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.runTimer();
    expect(h.launched).toHaveLength(0);
    h.scheduler.stop();
    await h.resolveWait();
    expect(h.launched).toHaveLength(0);
  });

  test("a repeated completion or stale completion cannot schedule a double read", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.runTimer();
    await h.resolveWait();
    expect(h.launched).toHaveLength(1);

    h.launched[0].complete(800);
    h.launched[0].complete(800);
    h.runTimer(1);
    await h.resolveWait(1);
    expect(h.launched).toHaveLength(2);

    h.launched[0].complete(800); // callback from an already finished phrase
    expect(h.launched).toHaveLength(2);
  });

  test("completion while paused waits for Resume before queueing another utterance", async () => {
    const h = createHarness();
    h.scheduler.start();
    h.runTimer();
    await h.resolveWait();
    h.scheduler.pause();
    h.launched[0].complete(800);
    expect(h.launched).toHaveLength(1);

    h.scheduler.resume();
    h.runTimer(1);
    await h.resolveWait(1);
    expect(h.launched).toHaveLength(2);
  });
});