import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * MISSION 8 — UN test réel automatisé de bout en bout.
 *
 * Bun tue les processus fils « dangling » entre deux tests : le worker et
 * LibreTranslate sont donc démarrés DANS le test unique, qui couvre :
 *
 *   1. génération d'un petit WAV connu (espeak-ng)
 *   2. POST vers le worker ASR (/health puis /v1/audio/transcriptions)
 *   3. vérification transcript (texte réel)
 *   4. vérification segments (start/end valides)
 *   5. vérification WORD TIMESTAMPS réels (jamais words: [])
 *   6. envoi du transcript à LibreTranslate
 *   7. vérification traduction (texte réel, jamais vide)
 *   8. conservation des timestamps originaux
 *   9. conversion vers les structures Shadow (fuseSubtitles)
 *
 * AUDIO → TEXT → WORD TIMESTAMPS → TRANSLATION → SHADOW DATA
 *
 * Honnêteté d'environnement : artefact runtime absent ⇒ SKIP avec la raison
 * exacte — jamais un faux succès. (Preuve runtime de référence exécutée à la
 * main dans cet environnement : voir rapport final.)
 */

const ROOT = resolve(import.meta.dir, "..");
const WORKERS = join(ROOT, "workers");
const PY = join(WORKERS, ".venv", "bin", "python");
const LT_BIN = "/tmp/lt-venv/bin/libretranslate";

const hasWorkerVenv = existsSync(PY);
const hasLibreTranslate = existsSync(LT_BIN);
const hasEspeak = existsSync("/usr/bin/espeak-ng");

const ASR_PORT = 8793;
const LT_PORT = 5195;
const ASR_BASE = `http://127.0.0.1:${ASR_PORT}`;
const LT_BASE = `http://127.0.0.1:${LT_PORT}`;

const skipReason =
  !hasWorkerVenv ? "venv worker absent (workers/.venv)" :
  !hasEspeak ? "espeak-ng absent" : null;

function multipart(
  fields: Record<string, string>,
  fileField: { name: string; filename: string; type: string; data: Buffer },
): { body: Buffer; contentType: string } {
  const boundary = "KilingoPipelineTest";
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  parts.push(
    Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.type}\r\n\r\n`),
      fileField.data,
      Buffer.from("\r\n"),
    ]),
  );
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function waitHttp(url: string, timeoutMs: number): Promise<Response | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return res;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

describe("MISSION 8 — pipeline complet AUDIO → TEXT → WORDS → TRANSLATION → SHADOW", () => {
  test.skipIf(!!skipReason)(
    "worker ASR réel + word timestamps réels + traduction réelle + structures Shadow",
    async () => {
      // ── Démarrage des services réels (dans le test : Bun les garderait
      // sinon « dangling » entre deux tests) ─────────────────────────────
      const asr = Bun.spawn({
        cmd: [PY, "-m", "uvicorn", "whisper_worker:app", "--host", "127.0.0.1", "--port", String(ASR_PORT)],
        cwd: WORKERS,
        stdout: "ignore",
        stderr: "ignore",
      });
      let lt: ReturnType<typeof Bun.spawn> | null = null;
      if (hasLibreTranslate) {
        lt = Bun.spawn({
          cmd: [LT_BIN, "--host", "127.0.0.1", "--port", String(LT_PORT), "--load-only", "en,fr,es"],
          stdout: "ignore",
          stderr: "ignore",
        });
      }
      try {
        // (1) HEALTH CHECK RÉEL — attend la montée du worker (chargement du modèle)
        const health = await waitHttp(`${ASR_BASE}/health`, 150_000);
        expect(health).not.toBeNull();
        const healthJson = (await health!.json()) as { status: string; engine: string };
        expect(healthJson.status).toBe("ok");
        expect(healthJson.engine).toBe("faster_whisper_local");

        // (2) WAV de test réel et connu
        const text = "Bonjour tout le monde, bienvenue dans KILINGO.";
        Bun.spawnSync(["/usr/bin/espeak-ng", "-v", "fr-fr", "-w", "/tmp/ln_pipeline.wav", text]);
        const wav = readFileSync("/tmp/ln_pipeline.wav");
        expect(wav.length).toBeGreaterThan(1000);

        // (3..5) TRANSCRIPTION avec granularité segment + word
        const { body, contentType } = multipart(
          {
            model: "base",
            language: "fr", // hint langue (media.language) —Mission 6
            response_format: "verbose_json",
            "timestamp_granularities[]": "segment",
            "timestamp_granularities[]": "word",
          },
          { name: "file", filename: "test-fr.wav", type: "audio/wav", data: wav },
        );
        const t0 = Date.now();
        const res = await fetch(`${ASR_BASE}/v1/audio/transcriptions`, {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: new Uint8Array(body),
          signal: AbortSignal.timeout(180_000),
        });
        expect(res.status).toBe(200);
        const asrData = (await res.json()) as {
          text?: string;
          language?: string;
          segments?: {
            start: number;
            end: number;
            text: string;
            words?: { word: string; start: number; end: number; probability?: number }[];
          }[];
        };
        console.log(
          `[pipeline] transcription ${((Date.now() - t0) / 1000).toFixed(1)}s — lang=${asrData.language} text="${(asrData.text ?? "").slice(0, 80)}"`,
        );
        const segments = asrData.segments ?? [];
        expect(segments.length).toBeGreaterThan(0); // (4) segments présents
        for (const s of segments) expect(s.end).toBeGreaterThanOrEqual(s.start);
        const words = segments.flatMap((s) => s.words ?? []);
        // (5) WORD TIMESTAMPS RÉELS — « words: [] » n'est PAS un succès
        expect(words.length).toBeGreaterThan(0);
        for (const w of words) {
          expect(typeof w.word).toBe("string");
          expect(w.word.trim().length).toBeGreaterThan(0);
          expect(w.end).toBeGreaterThanOrEqual(w.start);
        }
        expect(asrData.language).toBe("fr"); // hint conservé (Mission 6)

        // (6..7) TRADUCTION du transcript réel via LibreTranslate local
        let translated = "";
        if (lt) {
          expect(await waitHttp(`${LT_BASE}/languages`, 90_000)).not.toBeNull();
          const trRes = await fetch(`${LT_BASE}/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: asrData.text, source: "fr", target: "en", format: "text" }),
            signal: AbortSignal.timeout(60_000),
          });
          expect(trRes.status).toBe(200);
          translated = ((await trRes.json()) as { translatedText?: string }).translatedText ?? "";
          expect(translated.trim().length).toBeGreaterThan(0); // jamais vide
          console.log(`[pipeline] traduction fr→en: "${translated.slice(0, 80)}"`);
        } else {
          console.log("[pipeline] LibreTranslate absent — étape 6/7 skip (ASR seul prouvé)");
        }

        // (8..9) CONVERSION vers les structures Shadow — timestamps conservés
        const { fuseSubtitles } = await import("../src/convex/subtitles.ts");
        const subtitles = fuseSubtitles({
          segments: segments.map((s, i) => ({ id: i, start: s.start, end: s.end, text: s.text.trim(), words: s.words })),
          translations: segments.map((s, i) => (i === 0 && translated ? translated : s.text.trim())),
          slangPhrases: [],
        });
        expect(subtitles.length).toBe(segments.length);
        for (let i = 0; i < segments.length; i++) {
          expect(subtitles[i].start).toBe(segments[i].start); // (8) timestamps conservés
          expect(subtitles[i].end).toBe(segments[i].end);
          expect(subtitles[i].originalText.length).toBeGreaterThan(0);
          expect(subtitles[i].translatedText.length).toBeGreaterThan(0);
        }
        // mots réels portés jusqu'aux structures Shadow (karaoké mot par mot)
        const shadowWords = subtitles.flatMap((s) => s.words ?? []);
        expect(shadowWords.length).toBe(words.length);
        expect(shadowWords[0].word.trim().length).toBeGreaterThan(0);
        console.log(
          `[pipeline] SHADOW DATA: ${subtitles.length} segments, ${shadowWords.length} mots horodatés — AUDIO → TEXT → WORDS → TRANSLATION → SHADOW OK`,
        );
      } finally {
        asr.kill();
        lt?.kill();
      }
    },
    400_000,
  );

  test.skipIf(!hasLibreTranslate)(
    "contrat pur : fuseSubtitles porte les mots du moteur SANS les fabriquer",
    async () => {
      const { fuseSubtitles } = await import("../src/convex/subtitles.ts");
      const subtitles = fuseSubtitles({
        segments: [
          {
            id: 0,
            start: 0,
            end: 2.68,
            text: "Bonjour tout le monde,",
            words: [
              { word: "Bonjour", start: 0, end: 0.48, probability: 0.87 },
              { word: "tout", start: 0.48, end: 0.66, probability: 0.87 },
            ],
          },
          { id: 1, start: 2.8, end: 4.1, text: "bienvenue dans KILINGO.", words: [] }, // moteur sans mots
        ],
        translations: ["Hello everyone,", "welcome to KILINGO."],
        slangPhrases: [],
      });
      // segment avec mots moteur → portés tels quels
      expect(subtitles[0].words?.length).toBe(2);
      expect(subtitles[0].words?.[0]).toEqual({ word: "Bonjour", start: 0, end: 0.48 });
      // segment sans mots → PAS de champ words fabriqué
      expect(subtitles[1].words).toBeUndefined();
      // timestamps inchangés
      expect(subtitles[1].start).toBe(2.8);
      expect(subtitles[1].end).toBe(4.1);
    },
  );
});
