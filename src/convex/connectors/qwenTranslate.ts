import { v } from "convex/values";
import { action } from "../_generated/server";

/* ═══════════════════════════════════════════════════════════════════════
   TRADUCTION — Qwen LLM (DashScope, mode compatible OpenAI) — étage 2

   POST https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions
   Modèle qwen-plus (repli qwen-turbo), env DASHSCOPE_API_KEY.

   Même signature que translateWithGroq (connectors/groqTranslate) :
   texte + batch, source, target, { deadline, onProgress, env, model }.
   Cascade : Groq → QWEN → local → MyMemory — une erreur, un quota ou une
   clé absente renvoie null (repli silencieux + console.warn) : JAMAIS
   d'exception, l'étage suivant prend le relais.
   Aucune clé n'est jamais journalisée ni renvoyée au client.
   ═══════════════════════════════════════════════════════════════════════ */

const QWEN_CHAT_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

/** qwen-plus principal ; qwen-turbo absorbe une décommission/ saturation. */
export const QWEN_MODELS = ["qwen-plus", "qwen-turbo"];

type QwenEnv = Readonly<Record<string, string | undefined>>;

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

/** « pt-BR » → « pt » — même normalisation que les autres étages. */
function baseLang(code: string): string {
  return code.toLowerCase().trim().split(/[-_]/)[0];
}

/** Clé DashScope — null si absente (l'étage est alors transparent). */
export function qwenKey(env: QwenEnv = process.env): string | null {
  return env.DASHSCOPE_API_KEY?.trim() || null;
}

/** Étage Qwen configuré ? (diagnostic, aucun secret exposé) */
export function qwenEngineConfigured(env: QwenEnv = process.env): boolean {
  return qwenKey(env) !== null;
}

/**
 * Traduit un lot de textes (même prompt numéroté en lots de 40 que Groq).
 * Retour : textes traduits, ou null si la clé est absente / l'API échoue /
 * en écho — le caller enchaîne alors sur l'étage suivant de la cascade.
 */
export async function translateWithQwen(
  texts: string[],
  source: string,
  target: string,
  opts: {
    deadline?: number;
    onProgress?: (done: number) => void;
    env?: QwenEnv;
    model?: string;
  } = {},
): Promise<string[] | null> {
  const env = opts.env ?? process.env;
  const key = qwenKey(env);
  if (!key) return null;
  const from = baseLang(source);
  const to = baseLang(target);
  if (texts.length === 0 || from === to) return texts;

  const targetName = LANGUAGE_NAMES[to] ?? to;
  const models = opts.model ? [opts.model] : QWEN_MODELS;

  for (const model of models) {
    const attempt = await runQwenModel({ model, key, from, to, targetName, texts, opts });
    if (attempt.texts) return attempt.texts;
    if (!attempt.modelMissing) return null;
    console.warn(
      `[qwenTranslate] modèle « ${model} » indisponible — modèle suivant de la cascade`,
    );
  }
  return null;
}

/** Un lot de traduction avec UN modèle Qwen (40 lignes numérotées max). */
async function runQwenModel(input: {
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
  // Lot aligné sur la cascade Groq/Qwen (voir groqTranslate.LLM_BATCH).
  const BATCH = 20;
  const out: string[] = new Array(texts.length).fill("");
  let okCount = 0;

  for (let start = 0; start < texts.length; start += BATCH) {
    const remaining =
      opts.deadline != null ? opts.deadline - Date.now() : Infinity;
    if (remaining <= 0) break;
    const batch = texts.slice(start, start + BATCH);
    const numbered = batch.map((t, i) => `${i + 1}. ${t}`).join("\n");
    try {
      const res = await fetch(QWEN_CHAT_URL, {
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
        const modelMissing =
          res.status === 404 ||
          res.status === 400 ||
          /model_not_found|does not exist|decommissioned|invalid model/i.test(body);
        console.warn(
          `[qwenTranslate] ${model} HTTP ${res.status} ${body} — ${
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
      batch.forEach((_orig, i) => {
        const t = lines[i];
        if (t) {
          out[start + i] = t;
          okCount++;
        }
      });
      opts.onProgress?.(okCount);
    } catch (error) {
      console.warn(
        `[qwenTranslate] lot ${Math.floor(start / BATCH) + 1} échoué : ${
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
    `[qwenTranslate] Qwen ${model} — ${okCount}/${texts.length} segments traduits`,
  );
  return { texts: out.map((t, i) => t || texts[i]), modelMissing: false };
}

/* ── Action de diagnostic (CLI : bunx convex run) ────────────────────── */

/**
 * Test réel : `bunx convex run connectors/qwenTranslate:translate
 * '{"text":"the weather is nice today","source":"en","target":"es"}'`.
 * Rapporte keyPresent (booléen, jamais la clé) — sans clé, ok:false sans
 * exception, ce qui prouve que la cascade passe proprement à l'étage suivant.
 */
export const translate = action({
  args: {
    text: v.string(),
    source: v.string(),
    target: v.string(),
  },
  handler: async (_ctx, args) => {
    const keyPresent = qwenEngineConfigured();
    const out = await translateWithQwen([args.text], args.source, args.target);
    return {
      keyPresent,
      ok: out !== null && out[0] !== args.text,
      translated: out?.[0] ?? null,
      models: QWEN_MODELS,
    };
  },
});
