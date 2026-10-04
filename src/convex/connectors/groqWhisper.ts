import { v } from "convex/values";
import { action } from "../_generated/server";

/* ═══════════════════════════════════════════════════════════════════════
   TRANSCRIPTION — Groq Whisper (clé lue UNIQUEMENT côté serveur)

   Env (noms exacts de ce déploiement) :
     GROQ_API_KEY      → clé Groq (Whisper + traduction)
     WHISPER_LOCAL_URL → worker faster-whisper auto-hébergé (repli)
     WHISPER_MODEL     → modèle du worker local (défaut : large-v3)

   Contrat :
     - source = URL → téléchargement serveur d'abord, plafonné à 25 Mo
       (limite gratuite de l'API audio Groq) ;
     - Groq (whisper-large-v3, multipart) en moteur principal ;
     - erreur / quota / clé absente → worker local WHISPER_LOCAL_URL →
       pipeline existant ;
     - jamais d'exception : un échec total renvoie { ok: false, error },
       l'appelant décide (aucun crash).

   Ce module n'utilise que des API Web (fetch, Blob, FormData) : il tourne
   aussi bien dans le runtime Convex par défaut que dans un fichier
   « use node ».
   ═══════════════════════════════════════════════════════════════════════ */

export type AudioSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

export type TranscriptionResult =
  | {
      ok: true;
      text: string;
      segments: AudioSegment[];
      lang?: string;
      engine: "groq_whisper" | "local_whisper";
    }
  | { ok: false; error: string; reason: string };

const GROQ_TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

/** Modèle Whisper Groq (qualité maximale de la famille large-v3). */
export const GROQ_WHISPER_MODEL = "whisper-large-v3";

/** Limite de l'API audio Groq : 25 Mo par requête. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Au-delà de deux minutes d'audio, Groq passe devant le worker local :
 * débit constant et pas de risque de timeout sur un long fichier.
 */
export const LONG_AUDIO_SECONDS = 120;

type AsrEnv = Readonly<Record<string, string | undefined>>;

/** Clé Groq, ou null si absente (aucune clé n'est jamais journalisée). */
export function groqKey(env: AsrEnv = process.env): string | null {
  return env.GROQ_API_KEY?.trim() || null;
}

/** Endpoint du worker faster-whisper local (compatible OpenAI), ou null. */
export function localWhisperEndpoint(
  env: AsrEnv = process.env,
): { url: string; model: string } | null {
  const raw = env.WHISPER_LOCAL_URL?.trim();
  if (!raw) return null;
  const base = raw.replace(/\/+$/, "");
  return {
    url: /\/v1\/audio\/transcriptions$/.test(base)
      ? base
      : `${base}/v1/audio/transcriptions`,
    model: env.WHISPER_MODEL?.trim() || "large-v3",
  };
}

/** Quels moteurs sont configurés (aucun secret exposé). */
export function asrEngines(env: AsrEnv = process.env): {
  groq: boolean;
  local: boolean;
} {
  return { groq: groqKey(env) !== null, local: localWhisperEndpoint(env) !== null };
}

/* ── Téléchargement serveur plafonné ─────────────────────────────────── */

/**
 * Récupère une source audio côté serveur. Content-Length > 25 Mo → refus
 * immédiat (pas de téléchargement inutile). null ⇒ source injoignable ou
 * trop lourde — l'appelant garde la main.
 */
export async function downloadAudio(
  url: string,
  maxBytes: number = MAX_AUDIO_BYTES,
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
      headers: { "User-Agent": "MOOVY/1.0" },
    });
    if (!res.ok) {
      console.warn(`[groqWhisper] téléchargement HTTP ${res.status} — abandon`);
      return null;
    }
    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > maxBytes) {
      console.warn(
        `[groqWhisper] audio trop lourd (${Math.round(declared / 1024 / 1024)} Mo > ${Math.round(maxBytes / 1024 / 1024)} Mo) — découpage requis`,
      );
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) {
      console.warn("[groqWhisper] audio vide — abandon");
      return null;
    }
    if (bytes.byteLength > maxBytes) {
      console.warn("[groqWhisper] audio trop lourd après téléchargement — abandon");
      return null;
    }
    return bytes;
  } catch (error) {
    console.warn(
      `[groqWhisper] téléchargement impossible :`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/* ── Appel Whisper (un POST multipart) ───────────────────────────────── */

type WhisperJson = {
  text?: string;
  language?: string;
  segments?: { start: number; end: number; text: string }[] | null;
};

function parseWhisper(data: WhisperJson): {
  text: string;
  segments: AudioSegment[];
  lang?: string;
} {
  const segments: AudioSegment[] = (data.segments ?? [])
    .filter((s) => s.text?.trim())
    .map((s, i) => ({
      id: i,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }));
  return {
    text: data.text?.trim() ?? segments.map((s) => s.text).join(" "),
    segments,
    lang: data.language ?? undefined,
  };
}

async function postWhisper(
  endpoint: { url: string; model: string; apiKey?: string },
  bytes: Uint8Array,
  filename: string,
  languageHint: string | undefined,
  timeoutMs: number,
): Promise<
  | { ok: true; text: string; segments: AudioSegment[]; lang?: string }
  | { ok: false; detail: string }
> {
  const form = new FormData();
  // `new Uint8Array(bytes)` (copie) : garantit un ArrayBuffer concret,
  // accepté comme BlobPart quel que soit le buffer d'origine.
  form.append("file", new Blob([new Uint8Array(bytes)]), filename);
  form.append("model", endpoint.model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (languageHint && /^[a-z]{2}(-[A-Z]{2})?$/.test(languageHint)) {
    form.append("language", languageHint.split("-")[0]);
  }

  const res = await fetch(endpoint.url, {
    method: "POST",
    headers: endpoint.apiKey
      ? { Authorization: `Bearer ${endpoint.apiKey}` }
      : {},
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 160);
    return { ok: false, detail: `HTTP ${res.status} ${body}`.trim() };
  }
  const data = (await res.json()) as WhisperJson;
  const parsed = parseWhisper(data);
  if (parsed.segments.length === 0 && !parsed.text) {
    return { ok: false, detail: "réponse vide" };
  }
  return { ok: true, ...parsed };
}

/* ── Chaîne Groq → worker local ──────────────────────────────────────── */

/**
 * Transcription d'un buffer : Groq d'abord (rapide, quota gratuit),
 * worker faster-whisper local en repli. Jamais d'exception.
 */
export async function transcribeBytes(
  bytes: Uint8Array,
  filename = "audio.mp3",
  opts: { preferGroq?: boolean; languageHint?: string; env?: AsrEnv } = {},
): Promise<TranscriptionResult> {
  const env = opts.env ?? process.env;
  const key = groqKey(env);
  const local = localWhisperEndpoint(env);

  const groqAttempt = key
    ? {
        kind: "groq_whisper" as const,
        endpoint: { url: GROQ_TRANSCRIPTIONS_URL, model: GROQ_WHISPER_MODEL, apiKey: key },
        timeoutMs: 150_000,
      }
    : null;
  const localAttempt = local
    ? {
        kind: "local_whisper" as const,
        endpoint: { url: local.url, model: local.model },
        timeoutMs: 150_000,
      }
    : null;

  // Audio long → Groq devant le worker local ; sinon ordre demandé :
  // moteur principal d'abord, repli ensuite.
  const attempts = (
    opts.preferGroq === false
      ? [localAttempt, groqAttempt]
      : [groqAttempt, localAttempt]
  ).filter((a): a is NonNullable<typeof a> => a !== null);

  if (attempts.length === 0) {
    return {
      ok: false,
      reason: "ASR_WORKER_UNAVAILABLE",
      error:
        "ASR_WORKER_UNAVAILABLE — Aucun moteur de transcription configuré. Ajoute GROQ_API_KEY (clé gratuite sur console.groq.com) ou déploie faster-whisper (WHISPER_LOCAL_URL, recommandé : open source et local).",
    };
  }

  let lastDetail = "";
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const started = Date.now();
    try {
      const out = await postWhisper(
        attempt.endpoint,
        bytes,
        filename,
        opts.languageHint,
        attempt.timeoutMs,
      );
      if (out.ok) {
        if (i > 0) {
          console.log(
            `[groqWhisper] repli ${attempt.kind} utilisé — ${attempts[0].kind} indisponible`,
          );
        }
        console.log(
          `[groqWhisper] ${attempt.kind} OK — ${out.segments.length} segments en ${((Date.now() - started) / 1000).toFixed(1)} s`,
        );
        return {
          ok: true,
          text: out.text,
          segments: out.segments,
          lang: out.lang,
          engine: attempt.kind,
        };
      }
      lastDetail = `${attempt.kind} : ${out.detail}`;
      console.warn(`[groqWhisper] ${lastDetail} — moteur suivant`);
    } catch (error) {
      lastDetail = `${attempt.kind} : ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.warn(`[groqWhisper] ${lastDetail} — moteur suivant`);
    }
  }

  return {
    ok: false,
    reason: "ASR_FAILED",
    error: `ASR_FAILED — aucun moteur n'a répondu (${lastDetail})`,
  };
}

/**
 * Transcription d'une source distante : téléchargement serveur (≤ 25 Mo)
 * puis chaîne Groq → worker local.
 */
export async function transcribeUrl(
  audioUrl: string,
  opts: { preferGroq?: boolean; languageHint?: string; env?: AsrEnv } = {},
): Promise<TranscriptionResult & { bytes?: number }> {
  const bytes = await downloadAudio(audioUrl);
  if (!bytes) {
    return {
      ok: false,
      reason: "SOURCE_TOO_LARGE",
      error: `Source audio injoignable ou supérieure à ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} Mo — utilise « Transcrire (fichier long) » pour le découpage automatique.`,
    };
  }
  const filename = (() => {
    try {
      const last = new URL(audioUrl).pathname.split("/").filter(Boolean).pop();
      return last && /\.[a-z0-9]{2,5}$/i.test(last) ? last : "audio.mp3";
    } catch {
      return "audio.mp3";
    }
  })();
  const result = await transcribeBytes(bytes, filename, opts);
  return { ...result, bytes: bytes.byteLength };
}

/* ── Action de diagnostic (CLI : bunx convex run) ────────────────────── */

/**
 * Test réel du connecteur : `bunx convex run
 * connectors/groqWhisper:transcribeSource '{"audioUrl":"https://….wav"}'`.
 * Renvoie le transcript (tronqué), l'extrait de segments et le moteur.
 */
export const transcribeSource = action({
  args: {
    audioUrl: v.string(),
    languageHint: v.optional(v.string()),
    preferGroq: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const engines = asrEngines();
    const result = await transcribeUrl(args.audioUrl, {
      languageHint: args.languageHint,
      preferGroq: args.preferGroq,
    });
    if (!result.ok) {
      return { ...result, engines };
    }
    return {
      ok: true as const,
      engine: result.engine,
      bytes: result.bytes,
      lang: result.lang,
      segmentCount: result.segments.length,
      text: result.text.slice(0, 400),
      segments: result.segments.slice(0, 5),
      engines,
    };
  },
});
