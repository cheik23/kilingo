import { describe, expect, test } from "bun:test";
import { activeSubtitle, formatTimestamp } from "../src/convex/subtitles";

describe("formatTimestamp", () => {
  test("mm:ss classiques", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(59)).toBe("0:59");
    expect(formatTimestamp(60)).toBe("1:00");
    expect(formatTimestamp(75.8)).toBe("1:15"); // floor sur les secondes
    expect(formatTimestamp(3600)).toBe("60:00");
  });
  test("clamp des valeurs pathologiques (pas de temps négatif affiché)", () => {
    expect(formatTimestamp(-3)).toBe("0:00");
    expect(formatTimestamp(Number.NaN)).toBe("0:00");
  });
});

describe("activeSubtitle", () => {
  const subs = [
    { id: 1, start: 0, end: 1.8, originalText: "Hello everyone", translatedText: "", isSlang: false },
    { id: 2, start: 1.8, end: 3.4, originalText: "Welcome back", translatedText: "", isSlang: false },
  ] as unknown as Parameters<typeof activeSubtitle>[0];

  test("segment 0 à 0.5", () => {
    expect(activeSubtitle(subs, 0.5)?.id).toBe(1);
  });
  test("segment 1 à 2.2", () => {
    expect(activeSubtitle(subs, 2.2)?.id).toBe(2);
  });
  test("aucun segment après la fin", () => {
    expect(activeSubtitle(subs, 3.5)).toBeUndefined();
  });
  test("seek direct au début du segment 2", () => {
    expect(activeSubtitle(subs, 1.8)?.id).toBe(2);
  });
  test("liste vide → undefined", () => {
    expect(activeSubtitle([], 1)).toBeUndefined();
  });
});
