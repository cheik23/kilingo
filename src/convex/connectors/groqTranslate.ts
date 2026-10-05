import { v } from "convex/values";
import { action } from "../_generated/server";

/* ═══════════════════════════════════════════════════════════════════════
   TRADUCTION — Groq LLM → serveur local → MyMemory (clés côté serveur)

   Env (noms exacts de ce déploiement) :
     GROQ_API_KEY        → traduction LLM (même clé que Whisper)
     TRANSLATE_LOCAL_URL → Argos Translate / LibreTranslate auto-hébergé
     GROQ_TRANSLATE_MODEL → optionnel, force un modèle précis (sinon la
                            cascade de modèles ci-dessous est essayée)

   Contrat :
     - Groq LLM en tête : meilleur registre argot de la cascade (le slang
       reste du slang), fiable depuis les IP datacenter ;
     - erreur / quota / clé absente → TRANSLATE_LOCAL_URL (batch en une
       requête, aucun texte ne quitte le réseau local) ;
     - erreur / worker absent → MyMemory (sans clé, meilleur effort) ;
     - échec total → textes originaux + failed: true, jamais d'exception.

   Aucune clé n'est jamais journalisée ni renvoyée au client.
   ═══════════════════════════════════════════════════════════════════════ */

export type TranslationProvider = "groq" | "qwen" | "local" | "mymemory" | "none";

export type TranslationResult = {
  texts: string[];
  provider: TranslationProvider;
  failed: boolean;
};

/**
 * Modèles Groq de traduction, dans l'ordre : le premier est le modèle
 * principal. `llama-3.3-70b-versatile` est passé en Enterprise (404 sur les
 * plans développeur) — les modèles GPT-OSS le remplacent, la cascade
 * absorbe une décommission sans intervention.
 */
export const GROQ_TRANSLATE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

export const DEFAULT_GROQ_TRANSLATE_MODEL = GROQ_TRANSLATE_MODELS[0];

/** Cascade effective : GROQ_TRANSLATE_MODEL (si défini) en tête, puis les défauts. */
export function groqTranslateModels(env: TransEnv = process.env): string[] {
  const override = env.GROQ_TRANSLATE_MODEL?.trim();
  if (!override) return GROQ_TRANSLATE_MODELS;
  return [override, ...GROQ_TRANSLATE_MODELS.filter((m) => m !== override)];
}

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";

/** Nom complet exigé par le prompt (les petits modèles suivent mieux). */
const LANGUAGE_NAMES: Record<string, string> = {
  fr: "French",
  en: "English",
  es: "Spanish",
  zh: "Simplified Chinese",
  ar: "Modern Standard Arabic",
  ru: "Russian",
  sw: "Swahili",
  ln: "Lingala",
  ha: "Hausa",
  yo: "Yoruba",
  zu: "Zulu",
  wo: "Wolof",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
  tr: "Turkish",
  nl: "Dutch",
};

type TransEnv = Readonly<Record<string, string | undefined>>;

/** « pt-BR » → « pt » : format attendu par LibreTranslate/MyMemory. */
function baseLang(code: string): string {
  return code.toLowerCase().trim().split(/[-_]/)[0];
}

function groqKey(env: TransEnv = process.env): string | null {
  return env.GROQ_API_KEY?.trim() || null;
}

function localTranslateUrl(env: TransEnv = process.env): string | null {
  const raw = env.TRANSLATE_LOCAL_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** Quels moteurs de traduction sont configurés (aucun secret exposé). */
export function translationEngines(env: TransEnv = process.env): {
  groq: boolean;
  local: boolean;
} {
  return { groq: groqKey(env) !== null, local: localTranslateUrl(env) !== null };
}

/* ── 1. Groq LLM (batch numéroté) ────────────────────────────────────── */

/**
 * Taille d'un lot de traduction LLM. 20 lignes : assez large pour amortir
 * la latence d'un aller-retour, assez court pour qu'un modèle rapide ne
 * « glisse » jamais sur la numérotation (cause n°1 des traductions
 * décalées). Partagée par Groq, Qwen et MyMemory.
 */
export const LLM_BATCH = 20;

/**
 * Traduit 20 lignes par requête, en conservant la numérotation : un lot
 * qui échoue n'invalide pas les autres. null ⇒ rien n'a été traduit.
 */
export async function translateWithGroq(
  texts: string[],
  source: string,
  target: string,
  opts: {
    deadline?: number;
    onProgress?: (done: number) => void;
    env?: TransEnv;
    model?: string;
  } = {},
): Promise<string[] | null> {
  const env = opts.env ?? process.env;
  const key = groqKey(env);
  const from = baseLang(source);
  const to = baseLang(target);
  if (!key) return null;
  if (texts.length === 0 || from === to) return texts;

  const targetName = LANGUAGE_NAMES[to] ?? to;
  const models = opts.model ? [opts.model] : groqTranslateModels(env);

  for (const model of models) {
    const attempt = await runGroqModel(
      { model, key, from, to, targetName, texts, opts },
    );
    if (attempt.texts) return attempt.texts;
    if (!attempt.modelMissing) return null;
    console.warn(
      `[groqTranslate] modèle « ${model} » indisponible — modèle suivant de la cascade`,
    );
  }
  return null;
}

/** Un lot de traduction avec UN modèle Groq (40 lignes par requête). */
async function runGroqModel(input: {
  model: string;
  key: string;
  from: string;
  to: string;
  targetName: string;
  texts: string[];
  opts: {
    deadline?: number;
    onProgress?: (done: number) => void;
  };
}): Promise<{ texts: string[] | null; modelMissing: boolean }> {
  const { model, key, targetName, texts, opts } = input;
  const BATCH = LLM_BATCH;
  const out: string[] = new Array(texts.length).fill("");
  let okCount = 0;

  for (let start = 0; start < texts.length; start += BATCH) {
    const remaining = opts.deadline != null ? opts.deadline - Date.now() : Infinity;
    if (remaining <= 0) break;
    const batch = texts.slice(start, start + BATCH);
    const numbered = batch.map((t, i) => `${i + 1}. ${t}`).join("\n");
    try {
      const res = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                `You are a professional subtitle translator. Translate each numbered line to ${targetName}. ` +
                `Keep the same register — slang stays slang, spoken language stays natural, never over-formalize. ` +
                `Keep lines already in ${targetName} unchanged. Return ONLY the translations as the same numbered list, ` +
                `one line per number, no commentary.`,
            },
            { role: "user", content: numbered },
          ],
        }),
        signal: AbortSignal.timeout(Math.min(60_000, Math.max(5_000, remaining))),
      });
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 160);
        // 404 / 400 « model_not_found » : le modèle a été décommissionné →
        // on tente le suivant de la cascade avant d'abandonner Groq.
        const modelMissing =
          res.status === 404 || /model_not_found|does not exist|decommissioned/i.test(body);
        console.warn(
          `[groqTranslate] ${model} HTTP ${res.status} ${body} — ${
            modelMissing ? "modèle suivant" : "repli provider suivant"
          }`,
        );
        return {
          texts: okCount > 0 ? out.map((t, i) => t || texts[i]) : null,
          modelMissing,
        };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const lines = content
        .split("\n")
        .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
        .filter(Boolean);
      batch.forEach((orig, i) => {
        const t = lines[i];
        if (t) {
          out[start + i] = t;
          okCount++;
        }
      });
      opts.onProgress?.(okCount);
    } catch (error) {
      console.warn(
        `[groqTranslate] lot ${Math.floor(start / BATCH) + 1} échoué : ${
          error instanceof Error ? error.message : error
        } — repli provider suivant`,
      );
      return {
        texts: okCount > 0 ? out.map((t, i) => t || texts[i]) : null,
        modelMissing: false,
      };
    }
  }

  if (okCount === 0) return { texts: null, modelMissing: false };
  console.log(
    `[groqTranslate] Groq ${model} — ${okCount}/${texts.length} segments traduits`,
  );
  return { texts: out.map((t, i) => t || texts[i]), modelMissing: false };
}

/* ── 2. Serveur local Argos / LibreTranslate ─────────────────────────── */

/** Batch unique (~40 lignes, sous la limite des 5000 caractères). */
export async function translateWithLocal(
  texts: string[],
  source: string,
  target: string,
  opts: { env?: TransEnv; onProgress?: (done: number) => void } = {},
): Promise<string[] | null> {
  const env = opts.env ?? process.env;
  const base = localTranslateUrl(env);
  const from = baseLang(source);
  const to = baseLang(target);
  if (!base || from === to || texts.length === 0) return null;

  const BATCH = 40;
  const out: string[] = new Array(texts.length).fill("");
  let okCount = 0;

  for (let start = 0; start < texts.length; start += BATCH) {
    const batch = texts.slice(start, start + BATCH);
    try {
      const res = await fetch(`${base}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: batch, source: from, target: to, format: "text" }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        console.warn(`[groqTranslate] serveur local HTTP ${res.status} — repli`);
        break;
      }
      const json = (await res.json()) as { translatedText?: string | string[] };
      const list = Array.isArray(json.translatedText)
        ? json.translatedText
        : json.translatedText != null
          ? [json.translatedText]
          : [];
      if (list.length !== batch.length) {
        console.warn(
          `[groqTranslate] serveur local : réponse incomplète (${list.length}/${batch.length}) — repli`,
        );
        break;
      }
      batch.forEach((_orig, i) => {
        const t = list[i];
        if (t && t.trim()) {
          out[start + i] = t.trim();
          okCount++;
        }
      });
      opts.onProgress?.(okCount);
    } catch (error) {
      console.warn(
        `[groqTranslate] serveur local injoignable : ${
          error instanceof Error ? error.message : error
        } — repli`,
      );
      break;
    }
  }

  if (okCount === 0) return null;
  console.log(`[groqTranslate] local — ${okCount}/${texts.length} segments traduits`);
  return out.map((t, i) => t || texts[i]);
}

/* ── 3. MyMemory (sans clé, meilleur effort) ─────────────────────────── */

/** MyMemory refuse les requêtes > 500 caractères : découpe sur les mots. */
function splitLong(text: string, limit = 480): string[] {
  if (text.length <= limit) return [text];
  const words = text.split(/\s+/);
  const parts: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > limit) {
      if (current) parts.push(current.trim());
      current = word;
    } else {
      current += (current ? " " : "") + word;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export async function translateWithMyMemory(
  texts: string[],
  source: string,
  target: string,
): Promise<string[] | null> {
  const from = baseLang(source);
  const to = baseLang(target);
  if (from === to || texts.length === 0) return null;

  const out: string[] = new Array(texts.length).fill("");
  let okCount = 0;
  const CONCURRENCY = 4;

  for (let start = 0; start < texts.length; start += CONCURRENCY) {
    const slice = texts.slice(start, start + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (text) => {
        const parts = splitLong(text);
        const pieces: string[] = [];
        for (const part of parts) {
          try {
            const res = await fetch(
              `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(part)}&langpair=${from}|${to}`,
              {
                headers: { "User-Agent": "KILINGO/1.0" },
                signal: AbortSignal.timeout(20_000),
              },
            );
            if (!res.ok) return null;
            const data = (await res.json()) as {
              responseData?: { translatedText?: unknown };
            };
            const value = data.responseData?.translatedText;
            if (typeof value !== "string" || !value.trim()) return null;
            pieces.push(value.trim());
          } catch {
            return null;
          }
        }
        return pieces.length > 0 ? pieces.join(" ") : null;
      }),
    );
    results.forEach((value, i) => {
      if (value) {
        out[start + i] = value;
        okCount++;
      }
    });
  }

  if (okCount === 0) return null;
  console.log(
    `[groqTranslate] MyMemory — ${okCount}/${texts.length} segments traduits`,
  );
  return out.map((t, i) => t || texts[i]);
}

/* ── Chaîne complète ─────────────────────────────────────────────────── */

/**
 * Groq → serveur local → MyMemory. Les textes déjà traduits par un moteur
 * sont conservés si le suivant échoue partiellement.
 */
export async function translateTexts(
  texts: string[],
  source: string,
  target: string,
  opts: {
    deadline?: number;
    onProgress?: (done: number) => void;
    env?: TransEnv;
    skipGroq?: boolean;
  } = {},
): Promise<TranslationResult> {
  if (baseLang(source) === baseLang(target) || texts.length === 0) {
    return { texts, provider: "none", failed: false };
  }

  if (!opts.skipGroq) {
    const groq = await translateWithGroq(texts, source, target, opts);
    if (groq) return { texts: groq, provider: "groq", failed: false };
  }

  const local = await translateWithLocal(texts, source, target, opts);
  if (local) return { texts: local, provider: "local", failed: false };

  const memory = await translateWithMyMemory(texts, source, target);
  if (memory) {
    const unchanged = memory.every((t, i) => t === texts[i]);
    return { texts: memory, provider: "mymemory", failed: unchanged };
  }

  return { texts, provider: "none", failed: true };
}

/* ── Action de diagnostic (CLI : bunx convex run) ────────────────────── */

/**
 * Test réel : `bunx convex run connectors/groqTranslate:translate
 * '{"text":"hello","source":"en","target":"es"}'`.
 */
export const translate = action({
  args: {
    text: v.string(),
    source: v.string(),
    target: v.string(),
  },
  handler: async (_ctx, args) => {
    const engines = translationEngines();
    const result = await translateTexts([args.text], args.source, args.target);
    return {
      ok: result.provider !== "none" && !result.failed,
      provider: result.provider,
      translated: result.texts[0],
      engines,
      models: groqTranslateModels(),
    };
  },
});
