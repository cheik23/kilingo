import { GROQ_TRANSLATE_MODELS, translationEngines } from "./groqTranslate";

/** Même forme que TransEnv dans groqTranslate (non exporté). */
type TransEnv = Readonly<Record<string, string | undefined>>;

/* ═══════════════════════════════════════════════════════════════════════
   CHAT IA — Groq, cascade de modèles (base : connectors/groqTranslate.ts)

   - llama-3.3-70b-versatile est Enterprise (404 sur les plans développeur)
     → réutilise la cascade éprouvée de groqTranslate
     (gpt-oss-120b → gpt-oss-20b → llama-3.1-8b-instant).
   - Erreur / quota / clé absente → null (jamais d'exception) : le moteur
     de conversation affiche son fallback « IA indisponible ».
   - Aucune clé n'est jamais journalisée ni renvoyée au client.
   ═══════════════════════════════════════════════════════════════════════ */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatTurnResult = {
  reply: string;
  model: string;
  failed: boolean;
};

/** Appel chat complet avec cascade de modèles ; null ⇒ IA indisponible. */
export async function chatWithGroq(
  messages: ChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    deadline?: number;
    env?: TransEnv;
  } = {},
): Promise<ChatTurnResult | null> {
  const env = opts.env ?? process.env;
  if (!translationEngines(env).groq) return null;

  const key = env.GROQ_API_KEY?.trim();
  if (!key) return null;

  for (const model of GROQ_TRANSLATE_MODELS) {
    const attempt = await runModel(model, key, messages, opts);
    if (attempt !== null) {
      return { reply: attempt, model, failed: false };
    }
  }
  return null;
}

/** Un appel avec UN modèle ; null ⇒ réessayer avec le suivant. */
async function runModel(
  model: string,
  key: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; deadline?: number },
): Promise<string | null> {
  const deadline = opts.deadline ?? Date.now() + 25_000;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.8,
        // Les modèles gpt-oss consomment max_tokens avec leur raisonnement
        // caché : budget large + effort réduit pour une réponse visible
        // complète (~300 tokens utiles) malgré tout.
        max_tokens: opts.maxTokens ?? 1500,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
      signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
    });
    if (res.status === 404) return null; // modèle indisponible → cascade
    if (res.status === 429 || res.status === 401) return null; // quota/clé
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    return reply && reply.length > 0 ? reply : null;
  } catch {
    return null; // timeout/réseau → cascade, puis fallback silencieux
  }
}

/** Libre (niveau 0) ↔ verrouillé : une conversation IA = « libre ». */
export function chatAvailable(env: TransEnv = process.env): boolean {
  return translationEngines(env).groq;
}
