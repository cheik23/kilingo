/* ═══════════════════════════════════════════════════════════════════════
   MOOVY — MOTEURS LOCAUX EXÉCUTÉS DANS LE DÉPLOIEMENT FREEBUFF

   Le déploiement Freebuff sert l'application (Vite) et exécute les
   fonctions Convex. Il n'héberge NI processus Python, NI serveur
   faster-whisper, NI binaire whisper.cpp : un « localhost:8000 » configuré
   dans Convex désigne le loopback du runtime Convex, jamais la machine du
   développeur (prouvé au tour précédent : worker sain, 0 requête reçue).

   D'où cette architecture, 100 % contenue dans le déploiement :

     fichier uploadé
       ↓  decodeToPcm16k  (WebAudio, aucune donnée ne sort du navigateur)
     Float32Array 16 kHz
       ↓  transcribeLocal (Whisper ONNX, transformers.js — WASM/WebGPU)
     segments + WORD TIMESTAMPS réels du moteur
       ↓  translateLocal (OPUS-MT ONNX, open source)
     segments traduits
       ↓  action Convex `ingestLocalTranscript` → runSharedPipeline
     sous-titres → Shadow (karaoké mot par mot) → Memory

   Aucun service à lancer, aucun tunnel, aucun VPS, aucune clé, aucune API
   payante. Les poids des modèles sont des fichiers statiques libres
   (Hugging Face) téléchargés une fois puis mis en cache par le navigateur.

   Ce module n'importe JAMAIS de code Convex : il est appelable depuis un
   composant React ET depuis un test Node (les modèles ONNX s'exécutent
   aussi hors navigateur, ce qui rend le moteur testable pour de vrai).
   ═══════════════════════════════════════════════════════════════════════ */

/** Identifiant explicite du moteur — jamais « groq » sur ce chemin (§11). */
export const LOCAL_ASR_ENGINE = "browser_whisper_local";
/** Identifiant du moteur de traduction local (OPUS-MT, open source). */
export const LOCAL_MT_ENGINE = "browser_opus_mt_local";

/** Whisper exporté AVEC cross-attentions : seuls ces modèles donnent des
 *  word timestamps réels (`output_attentions=True` à l'export). */
export const LOCAL_ASR_MODEL =
  "onnx-community/whisper-base_timestamped";

/** Au-delà de cette taille, le chemin local est refusé : l'upload part sur
 *  le pipeline serveur découpé (mediaJobs) au lieu de figer un onglet. */
export const MAX_LOCAL_BYTES = 64 * 1024 * 1024;
/** Au-delà de cette durée d'audio, idem (une inférence navigateur d'une
 *  heure n'est pas raisonnable). */
export const MAX_LOCAL_SECONDS = 20 * 60;

export type LocalWord = {
  word: string;
  start: number;
  end: number;
  probability?: number;
};

export type LocalSegment = {
  start: number;
  end: number;
  text: string;
  /** Word timestamps RÉELS du moteur (jamais fabriqués). */
  words?: LocalWord[];
};

export type LocalTranscript = {
  text: string;
  language?: string;
  segments: LocalSegment[];
  engine: string;
  seconds: number;
};

export type LocalProgress = {
  stage: "model" | "transcribe" | "translate";
  percent?: number;
  message: string;
};

type ProgressFn = (p: LocalProgress) => void;

// ─── Langues ───────────────────────────────────────────────────────────

/** Whisper (transformers.js) attend le NOM anglais de la langue. */
const WHISPER_LANGUAGE_NAMES: Record<string, string> = {
  en: "english",
  fr: "french",
  es: "spanish",
  zh: "chinese",
  ar: "arabic",
  ru: "russian",
  de: "german",
  it: "italian",
  pt: "portuguese",
  nl: "dutch",
  ja: "japanese",
  ko: "korean",
  hi: "hindi",
  tr: "turkish",
  pl: "polish",
  uk: "ukrainian",
  vi: "vietnamese",
  th: "thai",
  sv: "swedish",
  da: "danish",
  fi: "finnish",
  no: "norwegian",
  cs: "czech",
  el: "greek",
  he: "hebrew",
  id: "indonesian",
  ro: "romanian",
  hu: "hungarian",
};

/** « pt-BR » → « pt ». Renvoie undefined si le code est inconnu. */
export function baseLang(code?: string | null): string | undefined {
  if (!code) return undefined;
  const base = code.toLowerCase().trim().split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(base) ? base : undefined;
}

/** Hint de langue pour l'ASR. Inconnu ⇒ undefined (auto-détection). */
export function whisperLanguageName(code?: string | null): string | undefined {
  const base = baseLang(code);
  return base ? WHISPER_LANGUAGE_NAMES[base] : undefined;
}

// ─── Routes de traduction OPUS-MT ──────────────────────────────────────

/** Paires servies directement par un modèle ONNX (vérifiées sur le Hub). */
const MT_DIRECT = new Set([
  "fr>en",
  "en>fr",
  "es>en",
  "en>es",
  "es>fr",
  "fr>es",
  "ar>en",
  "ru>en",
  "en>ru",
  "zh>en",
  "en>zh",
  "de>en",
  "en>de",
  "it>en",
  "en>it",
  "nl>en",
  "en>nl",
]);

/**
 * Route de traduction : paire directe, sinon pivot par l'anglais (comme le
 * pivot Argos déjà utilisé côté serveur), sinon null ⇒ l'appelant garde la
 * cascade serveur existante (jamais une traduction vide présentée comme
 * réussie).
 */
export function resolveMtRoute(
  source: string,
  target: string,
): { models: string[] } | null {
  const from = baseLang(source);
  const to = baseLang(target);
  if (!from || !to || from === to) return null;
  if (MT_DIRECT.has(`${from}>${to}`)) {
    return { models: [`Xenova/opus-mt-${from}-${to}`] };
  }
  if (MT_DIRECT.has(`${from}>en`) && MT_DIRECT.has(`en>${to}`)) {
    return { models: [`Xenova/opus-mt-${from}-en`, `Xenova/opus-mt-en-${to}`] };
  }
  return null;
}

// ─── Poids des modèles : chargés UNE fois par page ─────────────────────
// Étape 13 : modèle chargé une seule fois, jamais deux chargements
// simultanés (la promesse est mémorisée avant tout await), inférence
// sérialisée pour ne pas multiplier la mémoire.

type AsrFn = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{
  text?: string;
  chunks?: { text?: string; timestamp?: [number | null, number | null] }[];
}>;

type MtFn = (text: string | string[]) => Promise<
  { translation_text?: string } | { translation_text?: string }[]
>;

let asrPromise: Promise<AsrFn> | null = null;
const mtPromises = new Map<string, Promise<MtFn>>();
let inferenceQueue: Promise<unknown> = Promise.resolve();

async function loadTransformers() {
  const mod = await import("@huggingface/transformers");
  // Le Hub est la seule source : évite des 404 sur /models/… en dev, et
  // active le cache du navigateur (les poids ne sont téléchargés qu'une fois).
  mod.env.allowLocalModels = false;
  // Cache du navigateur uniquement là où il existe (les tests Node
  // exécutent le même moteur sans l'API Cache Storage).
  if (typeof caches !== "undefined") mod.env.useBrowserCache = true;
  return mod;
}

/** Charge (ou réutilise) le pipeline Whisper. */
async function getAsrPipeline(onProgress?: ProgressFn): Promise<AsrFn> {
  if (!asrPromise) {
    asrPromise = (async () => {
      const { pipeline } = await loadTransformers();
      onProgress?.({
        stage: "model",
        message: "Chargement du moteur de transcription local…",
      });
      return (await pipeline("automatic-speech-recognition", LOCAL_ASR_MODEL, {
        ...DEVICE_OPTION,
        dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
        progress_callback: (p: {
          status?: string;
          progress?: number;
          file?: string;
        }) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            onProgress?.({
              stage: "model",
              percent: Math.round(p.progress),
              message: `Moteur local — ${p.file ?? "poids"} ${Math.round(p.progress)} %`,
            });
          }
        },
      })) as unknown as AsrFn;
    })().catch((err) => {
      // Échec de chargement (réseau, WASM indisponible) : on autorise une
      // nouvelle tentative au prochain appel au lieu de mémoriser l'échec.
      asrPromise = null;
      throw err;
    });
  }
  return asrPromise;
}

/** Charge (ou réutilise) un modèle de traduction OPUS-MT. */
async function getMtPipeline(model: string): Promise<MtFn> {
  let p = mtPromises.get(model);
  if (!p) {
    p = (async () => {
      const { pipeline } = await loadTransformers();
      return (await pipeline("translation", model, {
        ...DEVICE_OPTION,
        dtype: "q8",
      })) as unknown as MtFn;
    })().catch((err) => {
      mtPromises.delete(model);
      throw err;
    });
    mtPromises.set(model, p);
  }
  return p;
}

/**
 * Backend d'exécution des modèles. "wasm" par défaut (profil prouvé :
 * quantifié q8, fonctionne partout) ; "webgpu" est une optimisation
 * activable quand le navigateur l'expose.
 */
export const LOCAL_ASR_DEVICE: "wasm" | "webgpu" = "wasm";

/**
 * Backend passé à transformers.js uniquement DANS un navigateur : hors
 * navigateur (tests Node) l'implémentation Node n'accepte que cpu/cuda, et
 * les mêmes modèles y tournent nativement — le moteur testé reste le même.
 */
const DEVICE_OPTION: Record<string, unknown> =
  typeof window !== "undefined" && typeof document !== "undefined"
    ? { device: LOCAL_ASR_DEVICE }
    : {};

/**
 * Diagnostic : charge réellement le moteur (poids + backend) et exécute une
 * inférence courte. Sert au bouton « Tester le moteur de transcription » —
 * preuve que le moteur local du déploiement fonctionne, dans le navigateur
 * de l'utilisateur, sans aucun service à lancer.
 */
export async function probeLocalAsr(onProgress?: ProgressFn): Promise<{
  engine: string;
  model: string;
  device: string;
  seconds: number;
}> {
  const asr = await getAsrPipeline(onProgress);
  const t0 = Date.now();
  // 1,5 s de silence : on vérifie que le pipeline EXÉCUTE réellement.
  await asr(new Float32Array(16_000 * 1.5), { return_timestamps: "word" });
  return {
    engine: LOCAL_ASR_ENGINE,
    model: LOCAL_ASR_MODEL,
    device: LOCAL_ASR_DEVICE,
    seconds: (Date.now() - t0) / 1000,
  };
}

/** Sérialise les inférences (une seule à la fois : mémoire bornée). */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = inferenceQueue.then(job, job);
  inferenceQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ─── Décodage audio ────────────────────────────────────────────────────

/** Ré-échantillonnage linéaire (repli quand le contexte n'honore pas 16 kHz). */
export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate = 16000,
): Float32Array {
  if (Math.abs(fromRate - toRate) < 1) return input;
  const ratio = toRate / fromRate;
  const out = new Float32Array(Math.max(1, Math.round(input.length * ratio)));
  for (let i = 0; i < out.length; i++) {
    const s = i / ratio;
    const i0 = Math.floor(s);
    const i1 = Math.min(i0 + 1, input.length - 1);
    out[i] = input[i0] + (input[i1] - input[i0]) * (s - i0);
  }
  return out;
}

/** WAV PCM (8/16/32 bits) → mono 16 kHz. Pur : testable hors navigateur. */
export function decodeWavToPcm16k(data: ArrayBuffer): Float32Array {
  const view = new DataView(data);
  const buf = new Uint8Array(data);
  if (buf.length < 44) throw new Error("INVALID_AUDIO — fichier trop court");
  const ascii = (o: number, n: number) =>
    String.fromCharCode(...buf.subarray(o, o + n));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") {
    throw new Error("INVALID_AUDIO — conteneur WAV attendu");
  }
  let pos = 12;
  let fmt: { channels: number; sampleRate: number; bits: number } | null = null;
  let payload: Uint8Array | null = null;
  while (pos + 8 <= buf.length) {
    const id = ascii(pos, 4);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === "fmt ") {
      fmt = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      payload = buf.subarray(body, Math.min(body + size, buf.length));
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !payload || fmt.channels < 1) {
    throw new Error("INVALID_AUDIO — en-tête WAV illisible");
  }
  const bytes = fmt.bits / 8;
  const frames = Math.floor(payload.length / (bytes * fmt.channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const o = (i * fmt.channels + c) * bytes;
      acc +=
        fmt.bits === 16
          ? view.getInt16(o, true) / 32768
          : fmt.bits === 32
            ? view.getFloat32(o, true)
            : (payload[o] - 128) / 128;
    }
    mono[i] = acc / fmt.channels;
  }
  return resampleLinear(mono, fmt.sampleRate, 16000);
}

/**
 * Décode un fichier uploadé (MP3, WAV, M4A, OGG, MP4…) en mono 16 kHz,
 * entièrement dans le navigateur. WebAudio d'abord (tous les formats du
 * navigateur), repli WAV pur pour les environnements sans WebAudio.
 */
export async function decodeToPcm16k(data: ArrayBuffer): Promise<Float32Array> {
  const g = globalThis as unknown as {
    OfflineAudioContext?: new (c: number, l: number, r: number) => {
      decodeAudioData(b: ArrayBuffer): Promise<AudioBuffer>;
    };
    AudioContext?: new (o?: { sampleRate?: number }) => {
      decodeAudioData(b: ArrayBuffer): Promise<AudioBuffer>;
      close(): Promise<void>;
    };
  };
  const Offline = g.OfflineAudioContext;
  if (Offline) {
    try {
      const ctx = new Offline(1, 1, 16000);
      const decoded = await ctx.decodeAudioData(data.slice(0));
      return downmix(decoded);
    } catch {
      /* repli ci-dessous */
    }
  }
  const Ctx = g.AudioContext;
  if (Ctx) {
    let ctx: { decodeAudioData(b: ArrayBuffer): Promise<AudioBuffer>; close(): Promise<void> } | null =
      null;
    try {
      try {
        ctx = new Ctx({ sampleRate: 16000 });
      } catch {
        ctx = new Ctx();
      }
      const decoded = await ctx.decodeAudioData(data.slice(0));
      return downmix(decoded);
    } catch {
      /* repli WAV ci-dessous */
    } finally {
      if (ctx) void ctx.close().catch(() => undefined);
    }
  }
  return decodeWavToPcm16k(data);
}

function downmix(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const len = buffer.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
  }
  return resampleLinear(mono, buffer.sampleRate, 16000);
}

// ─── ASR local ─────────────────────────────────────────────────────────

/** Regroupe les mots en segments lisibles (fin de phrase ou silence). */
export function groupWordsIntoSegments(
  words: LocalWord[],
  { maxWords = 12, maxGap = 0.7, maxDuration = 8 } = {},
): LocalSegment[] {
  const segments: LocalSegment[] = [];
  let current: LocalWord[] = [];
  const flush = () => {
    if (current.length === 0) return;
    const text = current
      .map((w) => w.word)
      .join(" ")
      .replace(/\s+([,.;:!?…])/g, "$1")
      .trim();
    if (text) {
      segments.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        text,
        words: current,
      });
    }
    current = [];
  };
  for (const w of words) {
    const prev = current[current.length - 1];
    const sentenceEnd = /[.!?…]$/.test(prev?.word ?? "");
    const gapTooBig = prev ? w.start - prev.end > maxGap : false;
    const tooLong = prev
      ? w.end - current[0].start > maxDuration ||
        current.length >= maxWords
      : false;
    if (prev && (sentenceEnd || gapTooBig || tooLong)) flush();
    current.push(w);
  }
  flush();
  return segments;
}

/**
 * Transcription 100 % locale : Whisper ONNX (poids libres) exécuté dans
 * l'onglet de l'utilisateur. Les timestamps de mots viennent du moteur
 * (`return_timestamps: "word"`), jamais d'une approximation côté app.
 */
export async function transcribeLocal(
  pcm: Float32Array,
  options: { language?: string | null; onProgress?: ProgressFn } = {},
): Promise<LocalTranscript> {
  const { language, onProgress } = options;
  if (pcm.length < 1600) {
    throw new Error("INVALID_AUDIO — audio trop court (moins de 0,1 s)");
  }
  return enqueue(async () => {
    const asr = await getAsrPipeline(onProgress);
    const seconds = pcm.length / 16000;
    onProgress?.({
      stage: "transcribe",
      message: `Transcription locale de ${seconds.toFixed(1)} s d'audio…`,
    });
    const langName = whisperLanguageName(language);
    const out = await asr(pcm, {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(langName ? { language: langName, task: "transcribe" } : {}),
    });

    const words: LocalWord[] = [];
    let seen = "";
    for (const chunk of out.chunks ?? []) {
      const start = chunk.timestamp?.[0];
      if (typeof start !== "number") continue;
      // Certaines versions renvoient un texte cumulatif : on ne garde que
      // la partie nouvelle, sinon les mots seraient dupliqués.
      let text = chunk.text ?? "";
      if (seen && text.startsWith(seen)) text = text.slice(seen.length);
      seen += text;
      const cleaned = text.trim();
      if (!cleaned) continue;
      const end = chunk.timestamp?.[1];
      words.push({
        word: cleaned,
        start,
        end: typeof end === "number" && end >= start ? end : start,
      });
    }

    const segments = groupWordsIntoSegments(words);
    if (segments.length === 0) {
      // Aucun segment exploitable : échec EXPLICITE, jamais un faux succès.
      throw new Error(
        "ASR_FAILED — le moteur local n'a produit aucun segment exploitable.",
      );
    }
    const text = (out.text ?? "").trim() || segments.map((s) => s.text).join(" ");
    return {
      text,
      language: baseLang(language),
      segments,
      engine: LOCAL_ASR_ENGINE,
      seconds,
    };
  });
}

// ─── Traduction locale (OPUS-MT) ───────────────────────────────────────

/**
 * Traduit une liste de segments avec OPUS-MT (Helsinki-NLP, open source),
 * en conservant strictement les timestamps d'origine. Retourne null quand
 * aucune route n'existe pour la paire : l'appelant garde alors la cascade
 * serveur (LibreTranslate/Argos) — jamais une traduction vide déguisée.
 */
export async function translateLocal(
  texts: string[],
  source: string,
  target: string,
  onProgress?: ProgressFn,
): Promise<string[] | null> {
  const route = resolveMtRoute(source, target);
  if (!route) return null;
  return enqueue(async () => {
    let working = [...texts];
    for (let leg = 0; leg < route.models.length; leg++) {
      const model = route.models[leg];
      if (leg === 0)
        onProgress?.({
          stage: "translate",
          percent: 0,
          message: "Traduction locale (OPUS-MT)…",
        });
      const mt = await getMtPipeline(model);
      const batchSize = 8;
      const next: string[] = new Array(working.length).fill("");
      for (let i = 0; i < working.length; i += batchSize) {
        const slice = working.slice(i, i + batchSize);
        const res = await mt(slice);
        const arr = Array.isArray(res) ? res : [res];
        arr.forEach((item, k) => {
          const value = item?.translation_text?.trim();
          next[i + k] = value && value.length > 0 ? value : slice[k];
        });
        onProgress?.({
          stage: "translate",
          percent: Math.round(
            ((leg + Math.min(1, (i + batchSize) / working.length)) /
              route.models.length) *
              100,
          ),
          message: `Traduction locale — ${Math.min(i + batchSize, working.length)}/${working.length} segments`,
        });
      }
      working = next;
    }
    return working;
  });
}
