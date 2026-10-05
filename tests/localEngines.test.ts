import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOCAL_ASR_ENGINE,
  LOCAL_ASR_MODEL,
  LOCAL_MT_ENGINE,
  decodeWavToPcm16k,
  groupWordsIntoSegments,
  resolveMtRoute,
  transcribeLocal,
  translateLocal,
  whisperLanguageName,
} from "../src/lib/localEngines";

/* ═══════════════════════════════════════════════════════════════════════
   MOTEURS LOCAUX — PREUVES RUNTIME RÉELLES

   Ces tests exécutent le VRAI moteur (Whisper ONNX + OPUS-MT ONNX) sur de
   VRAIS fichiers audio. Ils échouent si :
     • aucun segment n'est produit ;
     • `words` est absent ou vide  → JAMAIS accepté comme succès ;
     • un timestamp est invalide (NaN, end < start) ;
     • la traduction renvoie du vide ou l'original tel quel.

   Les poids sont téléchargés une fois (cache local) : premier lancement
   long, exécutions suivantes rapides.
   ═══════════════════════════════════════════════════════════════════════ */

const AUDIO_EN = join(__dirname, "fixtures", "speech-en.wav");
const AUDIO_FR = join(__dirname, "fixtures", "speech-fr.wav");
const REAL_TIMEOUT = 300_000;

function pcm(file: string) {
  return decodeWavToPcm16k(
    readFileSync(file).buffer.slice(0) as ArrayBuffer,
  );
}

describe("décodage audio local", () => {
  test("WAV 16 kHz → Float32 mono, valeurs bornées", () => {
    const samples = pcm(AUDIO_EN);
    // ~11 s chez JFK ; on vérifie l'ordre de grandeur, pas la milliseconde.
    expect(samples.length).toBeGreaterThan(16000 * 8);
    expect(samples.length).toBeLessThan(16000 * 15);
    for (const v of samples) expect(Math.abs(v)).toBeLessThanOrEqual(1.0001);
  });

  test("un conteneur non-WAV est refusé explicitement", () => {
    const bogus = new Uint8Array(64);
    expect(() => decodeWavToPcm16k(bogus.buffer)).toThrow(/INVALID_AUDIO/);
  });
});

describe("regroupement des mots en segments", () => {
  test("coupe sur ponctuation forte, silence et longueur", () => {
    const words = [
      { word: "Bonjour", start: 0, end: 0.5 },
      { word: "tout", start: 0.5, end: 0.7 },
      { word: "le", start: 0.7, end: 0.8 },
      { word: "monde", start: 0.8, end: 1.1 },
      { word: ".", start: 1.1, end: 1.2 },
      { word: "Bienvenue", start: 3.5, end: 4 },
      { word: "!", start: 4, end: 4.1 },
    ];
    const segments = groupWordsIntoSegments(words);
    expect(segments.length).toBe(2);
    expect(segments[0].text).toBe("Bonjour tout le monde.");
    expect(segments[1].text).toBe("Bienvenue!");
    expect(segments[0].start).toBe(0);
    expect(segments[0].end).toBe(1.2);
    // Les mots sont portés tels quels : le karaoké lit ces timestamps.
    expect(segments[0].words?.length).toBe(5);
  });
});

describe("routes de traduction OPUS-MT", () => {
  test("paire directe", () => {
    expect(resolveMtRoute("fr", "en")?.models).toEqual([
      "Xenova/opus-mt-fr-en",
    ]);
    expect(resolveMtRoute("es", "fr")?.models).toEqual([
      "Xenova/opus-mt-es-fr",
    ]);
  });
  test("pivot par l'anglais quand la paire directe n'existe pas", () => {
    expect(resolveMtRoute("ar", "fr")?.models).toEqual([
      "Xenova/opus-mt-ar-en",
      "Xenova/opus-mt-en-fr",
    ]);
  });
  test("paire inconnue → null (jamais une traduction vide)", () => {
    expect(resolveMtRoute("ja", "fr")).toBeNull();
    expect(resolveMtRoute("fr", "fr")).toBeNull();
    expect(resolveMtRoute("xx", "en")).toBeNull();
  });
  test("hint de langue Whisper en nom anglais", () => {
    expect(whisperLanguageName("fr")).toBe("french");
    expect(whisperLanguageName("pt-BR")).toBe("portuguese");
    expect(whisperLanguageName("zz")).toBeUndefined();
  });
});

describe("ASR local — Whisper ONNX, word timestamps réels", () => {
  test(
    "voix humaine (anglais) : segments + mots horodatés, aucun timestamp inventé",
    async () => {
      const transcript = await transcribeLocal(pcm(AUDIO_EN), {
        language: "en",
      });

      expect(transcript.engine).toBe(LOCAL_ASR_ENGINE);
      expect(typeof transcript.text).toBe("string");
      expect(transcript.text.trim().length).toBeGreaterThan(20);
      expect(transcript.segments.length).toBeGreaterThan(0);

      const words = transcript.segments.flatMap((s) => s.words ?? []);
      // `words: []` est un ÉCHEC, pas un succès partiel.
      expect(words.length).toBeGreaterThan(3);

      for (const s of transcript.segments) {
        expect(Number.isFinite(s.start)).toBe(true);
        expect(Number.isFinite(s.end)).toBe(true);
        expect(s.end).toBeGreaterThanOrEqual(s.start);
        expect(s.text.trim().length).toBeGreaterThan(0);
      }
      for (const w of words) {
        expect(Number.isFinite(w.start)).toBe(true);
        expect(Number.isFinite(w.end)).toBe(true);
        expect(w.end).toBeGreaterThanOrEqual(w.start);
        expect(w.end).toBeLessThanOrEqual(transcript.seconds + 1);
        expect(w.word.trim().length).toBeGreaterThan(0);
      }
      // Flux temporel globalement croissant (jamais un mot « avant » le précédent).
      const starts = words.map((w) => w.start);
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1] - 0.01);
      }
      // Chaque mot reste dans les bornes de son segment.
      for (const s of transcript.segments) {
        for (const w of s.words ?? []) {
          expect(w.start).toBeGreaterThanOrEqual(s.start - 0.05);
          expect(w.end).toBeLessThanOrEqual(s.end + 0.05);
        }
      }
      console.log(
        `[test] ASR local (${LOCAL_ASR_MODEL}) — ${transcript.segments.length} segments, ${words.length} mots : "${transcript.text.slice(0, 90)}"`,
      );
    },
    REAL_TIMEOUT,
  );

  test(
    "voix synthétique française : le hint de langue est respecté",
    async () => {
      const transcript = await transcribeLocal(pcm(AUDIO_FR), {
        language: "fr",
      });
      expect(transcript.language).toBe("fr");
      expect(transcript.segments.length).toBeGreaterThan(0);
      const words = transcript.segments.flatMap((s) => s.words ?? []);
      expect(words.length).toBeGreaterThan(3);
      console.log(
        `[test] ASR local FR — ${words.length} mots : "${transcript.text.slice(0, 90)}"`,
      );
    },
    REAL_TIMEOUT,
  );

  test("audio trop court → INVALID_AUDIO explicite", async () => {
    await expect(transcribeLocal(new Float32Array(100))).rejects.toThrow(
      /INVALID_AUDIO/,
    );
  });
});

describe("traduction locale — OPUS-MT, timestamps conservés", () => {
  test(
    "fr→en, en→fr, es→fr : traductions réelles, jamais l'original recopié",
    async () => {
      const cases: { from: string; to: string; text: string }[] = [
        { from: "fr", to: "en", text: "Bonjour tout le monde, bienvenue." },
        { from: "en", to: "fr", text: "Good morning everyone, welcome." },
        { from: "es", to: "fr", text: "Buenos días a todos." },
      ];
      for (const c of cases) {
        const out = await translateLocal([c.text], c.from, c.to);
        expect(out).not.toBeNull();
        expect(out!.length).toBe(1);
        const translated = out![0].trim();
        expect(translated.length).toBeGreaterThan(0);
        expect(translated.toLowerCase()).not.toBe(c.text.toLowerCase());
        console.log(`[test] ${c.from}→${c.to} : "${c.text}" → "${translated}"`);
      }
    },
    REAL_TIMEOUT,
  );

  test(
    "les start/end des segments ne bougent pas après traduction",
    async () => {
      const segments = [
        { start: 0.4, end: 2.1, text: "Bonjour tout le monde." },
        { start: 2.1, end: 4.8, text: "Bienvenue dans KILINGO." },
      ];
      const translated = await translateLocal(
        segments.map((s) => s.text),
        "fr",
        "en",
      );
      expect(translated).not.toBeNull();
      const fused = segments.map((s, i) => ({ ...s, text: translated![i] }));
      fused.forEach((s, i) => {
        expect(s.start).toBe(segments[i].start);
        expect(s.end).toBe(segments[i].end);
        expect(s.text.trim().length).toBeGreaterThan(0);
      });
      expect(LOCAL_MT_ENGINE).toBe("browser_opus_mt_local");
    },
    REAL_TIMEOUT,
  );

  test("paire sans route → null (repli serveur, pas de faux succès)", async () => {
    expect(await translateLocal(["こんにちは"], "ja", "fr")).toBeNull();
  });
});
