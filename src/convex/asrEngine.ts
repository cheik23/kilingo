/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — SÉLECTION DES MOTEURS ASR / TRADUCTION (couche pure)

   Objectif (dossier §2-§7) : le chemin principal de Shadow ne dépend
   d'AUCUN provider distant propriétaire :

     ASR          1. faster-whisper auto-hébergé (WHISPER_LOCAL_URL,
                     endpoint compatible OpenAI /v1/audio/transcriptions)
                  2. Groq Whisper en repli (GROQ_API_KEY) — gratuit mais
                     distant : plus jamais la seule option
                  3. sinon ASR_WORKER_UNAVAILABLE — explicite, jamais un
                     faux échec « internal »
                  Exception : audio > 2 min (preferGroq) → Groq Whisper
                  passe devant le worker local, repli local derrière.

     TRADUCTION   1. Groq LLM (GROQ_API_KEY) — même clé que la
                     transcription, meilleur registre argot, fiable depuis
                     les IP datacenter (connectors/groqTranslate)
                  2. Argos Translate / LibreTranslate auto-hébergé
                     (TRANSLATE_LOCAL_URL, API compatible LibreTranslate —
                     Argos Translate expose exactement ce contrat via
                     argos-translate-server / argostranslate.api)
                  3. cascade gratuite restante (LibreTranslate
                     communautaire → Google gtx → MyMemory)

   Ce module est 100 % PUR (aucun import Convex, aucun réseau) : les
   décisions de routage sont testées par unit tests, l'exécution réseau
   reste dans youtubePipeline.ts ("use node").
   ═══════════════════════════════════════════════════════════════════════ */

/** Environnement minimal lu par les sélecteurs (injection → tests sans globals). */
export type EngineEnv = Readonly<Record<string, string | undefined>>;

// ─── ASR ───────────────────────────────────────────────────────────────

export type AsrEndpoint =
  | {
      kind: "local_whisper";
      url: string;
      model: string;
      engine: "faster_whisper_local";
    }
  | {
      kind: "groq";
      url: string;
      model: string;
      apiKey: string;
      engine: "groq_whisper";
    };

const GROQ_ASR_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/**
 * Endpoint ASR à utiliser : faster-whisper local d'abord (open source,
 * gratuit, aucune donnée envoyée à un tiers), Groq ensuite en repli.
 * null ⇒ aucun moteur configuré : l'appelant remonte
 * ASR_WORKER_UNAVAILABLE au lieu de faire semblant.
 */
export function selectAsrEndpoint(
  env: EngineEnv,
  modelOverride?: string,
): AsrEndpoint | null {
  const local = env.WHISPER_LOCAL_URL?.trim();
  if (local) {
    const base = local.replace(/\/+$/, "");
    return {
      kind: "local_whisper",
      // Tolère une URL déjà complète (utile pour un worker derrière un proxy).
      url: /\/v1\/audio\/transcriptions$/.test(base)
        ? base
        : `${base}/v1/audio/transcriptions`,
      model: modelOverride ?? env.WHISPER_MODEL?.trim() ?? "large-v3",
      engine: "faster_whisper_local",
    };
  }
  const groqKey = env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      kind: "groq",
      url: GROQ_ASR_URL,
      model: modelOverride ?? env.WHISPER_MODEL?.trim() ?? "whisper-large-v3-turbo",
      apiKey: groqKey,
      engine: "groq_whisper",
    };
  }
  return null;
}

// ─── Traduction ────────────────────────────────────────────────────────

/**
 * URL du serveur de traduction local (Argos Translate via serveur
 * compatible LibreTranslate). null ⇒ la cascade gratuite existante prend
 * la main (comportement inchangé pour les déploiements sans worker).
 */
export function selectLocalTranslateUrl(env: EngineEnv): string | null {
  const local = env.TRANSLATE_LOCAL_URL?.trim();
  return local ? local.replace(/\/+$/, "") : null;
}

/**
 * Langue au format LibreTranslate/Argos : ISO-639-1 base, « zh » → « zh »
 * (Argos sert le chinois simplifié sous « zh » ; le qualifiant régional
 * est déposé — « pt-BR » → « pt »).
 */
export function resolveLangPair(
  source: string,
  target: string,
): { source: string; target: string } | null {
  const iso = (code: string): string | null => {
    const base = code.toLowerCase().trim().split(/[-_]/)[0];
    return /^[a-z]{2}$/.test(base) ? base : null;
  };
  const from = iso(source);
  const to = iso(target);
  if (!from || !to || from === to) return null;
  return { source: from, target: to };
}
