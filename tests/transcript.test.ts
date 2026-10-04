import { describe, expect, test } from "bun:test";
import fixture from "./fixtures/tiktok-transcript.json";
import {
  activeSegmentAt,
  describeTranscriptStatus,
  findSegmentJump,
  mediaDurationFromSegments,
  mergeTranscriptSegments,
  normalizeSegments,
  registerTranscriptProvider,
  resolveTranscript,
  transcriptProviders,
  TRANSCRIPT_UNAVAILABLE,
  type TranscriptProvider,
  type TranscriptSegment,
} from "../src/lib/transcript";
import { registerBuiltinTranscriptProviders } from "../src/lib/transcriptProviders";

const FIXTURE_SEGMENTS = fixture.segments as TranscriptSegment[];

describe("normalizeSegments", () => {
  test("garde les segments valides du fixture", () => {
    const out = normalizeSegments(FIXTURE_SEGMENTS);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("Hello everyone");
    expect(out[1].text).toBe("Welcome back");
  });
  test("jette texte vide et durées invalides", () => {
    const out = normalizeSegments([
      { start: 0, end: 1, text: "  " },
      { start: 2, end: 2, text: "durée nulle" },
      { start: 3, end: 1, text: "négatif" },
      { start: 5, end: 6, text: "valide" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("valide");
  });
  test("trie chronologiquement et clamp les débuts négatifs", () => {
    const out = normalizeSegments([
      { start: 4, end: 6, text: "b" },
      { start: -2, end: 2, text: "a" },
    ]);
    expect(out.map((s) => s.text)).toEqual(["a", "b"]);
    expect(out[0].start).toBe(0);
  });
  test("borne les fins au segment suivant (chevauchements)", () => {
    const out = normalizeSegments([
      { start: 0, end: 5, text: "long" },
      { start: 2, end: 3, text: "court" },
    ]);
    expect(out[0].end).toBe(2);
    expect(out[1].end).toBe(3);
  });
  test("liste vide → liste vide", () => {
    expect(normalizeSegments([])).toEqual([]);
  });
});

describe("mergeTranscriptSegments", () => {
  test("le transcript préféré gagne, le repli complète les trous", () => {
    const merged = mergeTranscriptSegments(
      [{ start: 0, end: 2, text: "captions" }],
      [
        { start: 1, end: 3, text: "asr-chevauche" },
        { start: 4, end: 5, text: "asr-trou" },
      ],
    );
    expect(merged.map((s) => s.text)).toEqual(["captions", "asr-trou"]);
  });
  test("deux vides → vide", () => {
    expect(mergeTranscriptSegments([], [])).toEqual([]);
  });
});

describe("activeSegmentAt (karaoké)", () => {
  test("segment 0 à 0.5 s (fixture §12)", () => {
    expect(activeSegmentAt(FIXTURE_SEGMENTS, 0.5)?.text).toBe("Hello everyone");
  });
  test("segment 1 à 2.2 s (fixture §12)", () => {
    expect(activeSegmentAt(FIXTURE_SEGMENTS, 2.2)?.text).toBe("Welcome back");
  });
  test("aucun segment après la fin (fixture §12, t=3.5)", () => {
    expect(activeSegmentAt(FIXTURE_SEGMENTS, 3.5)).toBeNull();
  });
  test("aucun segment avant le début (t=-1)", () => {
    expect(activeSegmentAt(FIXTURE_SEGMENTS, -1)).toBeNull();
  });
  test("liste vide → null (player READY + transcript UNAVAILABLE)", () => {
    expect(activeSegmentAt([], 10)).toBeNull();
  });
});

describe("findSegmentJump (transport)", () => {
  const starts = FIXTURE_SEGMENTS.map((s) => s.start); // [0, 1.8]
  test("prev depuis 2.2 → 1.8", () => {
    expect(findSegmentJump(starts, 2.2, "prev")).toBe(1.8);
  });
  test("prev au début → undefined (rien ne bouge)", () => {
    expect(findSegmentJump(starts, 0.2, "prev")).toBeUndefined();
  });
  test("next depuis 0.5 → 1.8", () => {
    expect(findSegmentJump(starts, 0.5, "next")).toBe(1.8);
  });
  test("next après le dernier → undefined", () => {
    expect(findSegmentJump(starts, 3.3, "next")).toBeUndefined();
  });
});

describe("durée & statut", () => {
  test("durée issue des segments = dernière fin", () => {
    expect(mediaDurationFromSegments(FIXTURE_SEGMENTS)).toBe(3.4);
    expect(mediaDurationFromSegments([])).toBe(0);
  });
  test("statut lisible par source et par raison", () => {
    expect(describeTranscriptStatus({ ...TRANSCRIPT_UNAVAILABLE })).toContain("audio");
    expect(
      describeTranscriptStatus({
        status: "UNAVAILABLE",
        segments: [],
        reason: "PLATFORM_RESTRICTION",
      }),
    ).toContain("plateforme");
  });
});

describe("registre + providers", () => {
  test("resolveTranscript essaye dans l'ordre de priorité", async () => {
    const calls: string[] = [];
    const low: TranscriptProvider = {
      key: "low",
      priority: 100,
      canProvide: (m) => m.platform === "multi",
      getTranscript: async () => {
        calls.push("low");
        return { status: "AVAILABLE", segments: [{ start: 0, end: 1, text: "low" }] };
      },
    };
    const high: TranscriptProvider = {
      key: "high",
      priority: 1,
      canProvide: (m) => m.platform === "multi",
      getTranscript: async () => {
        calls.push("high");
        return { status: "UNAVAILABLE", segments: [] };
      },
    };
    registerTranscriptProvider(low);
    registerTranscriptProvider(high);
    const r = await resolveTranscript({ platform: "multi" });
    expect(calls[0]).toBe("high"); // priorité la plus petite d'abord
    expect(calls).toContain("low");
    expect(r.status).toBe("AVAILABLE");
    expect(r.segments[0].text).toBe("low");
  });
  test("un provider qui jette ne tue pas la chaîne", async () => {
    const broken: TranscriptProvider = {
      key: "broken",
      priority: 0,
      canProvide: (m) => m.platform === "multi",
      getTranscript: async () => {
        throw new Error("boom");
      },
    };
    const safe: TranscriptProvider = {
      key: "safe",
      priority: 2,
      canProvide: (m) => m.platform === "multi",
      getTranscript: async () => ({
        status: "AVAILABLE",
        segments: [{ start: 0, end: 1, text: "ok" }],
      }),
    };
    registerTranscriptProvider(broken);
    registerTranscriptProvider(safe);
    const r = await resolveTranscript({ platform: "multi" });
    expect(r.status).toBe("AVAILABLE");
    expect(r.segments[0].text).toBe("ok");
  });
  test("personne ne répond → UNAVAILABLE explicite (jamais de faux transcript)", async () => {
    const r = await resolveTranscript({ platform: "jamais-vu" });
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.segments).toEqual([]);
    expect(r.reason).toBe("NO_ACCESSIBLE_AUDIO");
  });
  test("providers builtin enregistrés — TikTok couvert par son provider", () => {
    registerBuiltinTranscriptProviders();
    const keys = transcriptProviders().map((p) => p.key);
    expect(keys).toContain("youtube-captions");
    expect(keys).toContain("tiktok-official");
    expect(keys).toContain("uploaded-asr");
  });
  test("TikTok → UNAVAILABLE PLATFORM_RESTRICTION (verdict honnête, pas de scraping)", async () => {
    registerBuiltinTranscriptProviders();
    const r = await resolveTranscript({ platform: "tiktok", platformId: "6718335390845095173" });
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.reason).toBe("PLATFORM_RESTRICTION");
    expect(r.segments).toEqual([]);
  });
  test("segments d'un AVAILABLE sont normalisés en sortie", async () => {
    const messy: TranscriptProvider = {
      key: "messy",
      priority: 0,
      canProvide: (m) => m.platform === "segments-test",
      getTranscript: async () => ({
        status: "AVAILABLE",
        segments: [
          { start: 3, end: 4, text: "b" },
          { start: 0, end: 2.5, text: "a" },
          { start: 2.4, end: 4, text: "a-bis" },
        ],
      }),
    };
    registerTranscriptProvider(messy);
    const r = await resolveTranscript({ platform: "segments-test" });
    expect(r.segments[0].text).toBe("a");
    // Le segment chevauchant est borné par le suivant :
    expect(r.segments[0].end).toBeLessThanOrEqual(r.segments[1].start);
  });
});

describe("intégration §13 (purs) — TikTok : player prêt, transcript indisponible", () => {
  test("currentTime suit, karaoké reste éteint, seek propre", () => {
    // Player TikTok « ready » pousse currentTime=1.2 :
    const t = 1.2;
    // Transcript UNAVAILABLE → segments [] :
    const segments = TRANSCRIPT_UNAVAILABLE.segments;
    expect(activeSegmentAt(segments, t)).toBeNull(); // karaoké éteint, pas de crash
    // Le transport utilise les starts du média actif uniquement :
    expect(findSegmentJump([], t, "next")).toBeUndefined();
    // Fixture (média AVEC transcript) : le seek saute au segment suivant :
    expect(findSegmentJump(FIXTURE_SEGMENTS.map((s) => s.start), t, "next")).toBe(1.8);
  });
  test("A → B → A : le verdict de B n'hérite jamais de A (état React réinitialisé côté effet)", async () => {
    registerBuiltinTranscriptProviders();
    const a = await resolveTranscript({ platform: "tiktok", platformId: "A" });
    const b = await resolveTranscript({ platform: "youtube" }); // captions backend → message dédié
    const a2 = await resolveTranscript({ platform: "tiktok", platformId: "A" });
    expect(a.status).toBe("UNAVAILABLE");
    expect(a2.status).toBe("UNAVAILABLE");
    expect(a2.reason).toBe(a.reason);
    // YouTube répond avec SA raison (pas de fuite du verdict TikTok) :
    expect(b.reason).not.toBe(a.reason);
  });
});
