"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  fuseSubtitles,
  type Subtitle,
  type WhisperSegment,
} from "./subtitles";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { selectAsrEndpoint, selectLocalTranslateUrl, resolveLangPair } from "./asrEngine";
import { translateWithGroq } from "./connectors/groqTranslate";

/** Groq speech-recognition model (free tier, generous daily quota). */
const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

/** Default translation target when a media record doesn't specify one. */
const TARGET_LANG_ISO = "fr";

// ─── Free translation (no API key anywhere) ───────────────────────

/**
 * Whisper (Groq inclus) rapporte la langue en nom complet ("english") — les
 * fournisseurs de traduction veulent l'ISO. Map étendue des noms courants.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  english: "en",
  "english (us)": "en",
  "english (uk)": "en",
  french: "fr",
  spanish: "es",
  chinese: "zh",
  mandarin: "zh",
  "mandarin chinese": "zh",
  arabic: "ar",
  russian: "ru",
  german: "de",
  italian: "it",
  portuguese: "pt",
  japanese: "ja",
  korean: "ko",
  dutch: "nl",
  turkish: "tr",
  polish: "pl",
  hindi: "hi",
  ukrainian: "uk",
  hebrew: "he",
  persian: "fa",
  farsi: "fa",
  indonesian: "id",
  vietnamese: "vi",
  thai: "th",
  swedish: "sv",
  norwegian: "no",
  danish: "da",
  finnish: "fi",
  greek: "el",
  czech: "cs",
  romanian: "ro",
  hungarian: "hu",
};

function normalizeLangCode(code: string): string {
  const base = code.toLowerCase().trim().split("-")[0] ?? code;
  return LANGUAGE_NAMES[code.toLowerCase().trim()] ?? base;
}

/**
 * Le produit est une paire « colonne source / colonne cible » : une cible
 * IDENTIQUE à la source ne peut pas produire de traduction (le pipeline
 * court-circuite et la colonne cible recopie la source — le bug « rien
 * n'est traduit »). On garantit donc une paire réellement différente : si
 * la cible demandée vaut la source, on bascule sur le français, ou sur
 * l'anglais quand la source EST le français. `switched` permet de
 * journaliser l'ajustement au lieu de le subir silencieusement.
 */
export function distinctTarget(
  source: string,
  target: string,
): { source: string; target: string; switched: boolean } {
  const src = normalizeLangCode(source);
  const wanted = normalizeLangCode(target);
  if (src !== wanted) return { source: src, target: wanted, switched: false };
  return {
    source: src,
    target: src === TARGET_LANG_ISO ? "en" : TARGET_LANG_ISO,
    switched: true,
  };
}

/**
 * Count « échos » — segments a provider returned *unchanged*. Some endpoints
 * (MyMemory quota-fallback, dead mirrors) answer 200 with the source text,
 * which reads as success while nothing was translated — the exact cause of
 * « Nobody → Nobody ». Providers with echoes above the tolerance lose to
 * the next one in the cascade.
 */
function countEchoes(translated: string[], originals: string[]): number {
  let echo = 0;
  for (let i = 0; i < translated.length; i++) {
    if (
      translated[i].trim().toLowerCase() ===
      (originals[i] ?? "").trim().toLowerCase()
    ) {
      echo++;
    }
  }
  return echo;
}

/**
 * MyMemory — keyless translation (verified live). One GET per segment,
 * 500-char query cap, anonymous daily quota. Returns per-segment
 * translations, keeping the original text where a query failed; null only
 * when nothing succeeded.
 */
async function translateViaMyMemory(
  texts: string[],
  source: string,
  target: string,
  deadline: number,
  onProgress?: (done: number) => void,
): Promise<string[] | null> {
  if (source === target) return texts;
  const m = (c: string) => (c === "zh" ? "zh-CN" : c);
  const langpair = `${m(source)}|${m(target)}`;

  const translateOne = async (text: string): Promise<string | null> => {
    // MyMemory rejects queries over 500 chars — split long segments on words.
    const chunks: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (line && `${line} ${word}`.length > 480) {
        chunks.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) chunks.push(line);

    const parts: string[] = [];
    for (const chunk of chunks) {
      const url =
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}` +
        `&langpair=${langpair}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          responseStatus?: number;
          quotaFinished?: boolean;
          responseData?: { translatedText?: string };
        };
        const t = json.responseData?.translatedText;
        if (
          json.responseStatus !== 200 ||
          json.quotaFinished ||
          !t ||
          t.startsWith("MYMEMORY WARNING")
        ) {
          return null;
        }
        parts.push(t);
      } catch {
        return null;
      }
    }
    return parts.join(" ") || null;
  };

  // Small worker pool so long transcripts stay inside the action time budget.
  const out: string[] = new Array(texts.length).fill("");
  let okCount = 0;
  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < texts.length) {
      // Global deadline: stop translating rather than stall the whole action.
      if (Date.now() > deadline) return;
      const i = cursor++;
      const translated = await translateOne(texts[i]);
      if (translated) {
        out[i] = translated;
        okCount++;
        onProgress?.(okCount);
      }
    }
  });
  await Promise.all(workers);
  console.log(
    `[shadow] MyMemory — ${okCount}/${texts.length} segments traduits`,
  );

  if (okCount === 0) return null;
  return out.map((t, i) => t || texts[i]);
}

/**
 * Community LibreTranslate instances, best effort. Verified live (2026-09):
 * libretranslate.com requires an API key and most public mirrors are dead —
 * MyMemory (below) is the reliable keyless path, these are the free bonus.
 */
const LIBRE_COMMUNITY_INSTANCES = [
  "https://lt.vern.cc",
  "https://translate.northboot.xyz",
];

/**
 * LibreTranslate (open source). One batched request for the whole transcript
 * (`q` accepts an array and returns one translation per element). Returns
 * null when no instance answers so the cascade can move on.
 */
async function translateViaLibre(
  texts: string[],
  source: string,
  target: string,
  onProgress?: (done: number) => void,
): Promise<string[] | null> {
  if (source === target) return texts;
  if (LIBRE_COMMUNITY_INSTANCES.length === 0) return null;
  const instances = LIBRE_COMMUNITY_INSTANCES;

  for (const instance of instances) {
    try {
      const res = await fetch(`${instance}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: texts,
          source,
          target,
          format: "text",
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        translatedText?: string | string[];
      };
      const out = Array.isArray(json.translatedText)
        ? json.translatedText
        : json.translatedText != null
          ? [json.translatedText]
          : [];
      if (out.length === texts.length) {
        return out.map((t, i) => t || texts[i]);
      }
    } catch {
      // Instance dead, rate-limited or slow — try the next one.
    }
  }
  return null;
}

/**
 * Translation cascade: Groq LLM (free key, best slang register) → local
 * Argos/LibreTranslate server → community LibreTranslate → Google gtx →
 * MyMemory (keyless) → original text, flagged `translationFailed`.
 */
async function translatePipeline(
  segments: WhisperSegment[],
  sourceLang: string,
  targetLang: string,
  reportProgress?: (percent: number) => void,
): Promise<{ texts: string[]; failed: boolean }> {
  const originals = segments.map((s) => s.text.trim());
  const source = normalizeLangCode(sourceLang);
  const target = normalizeLangCode(targetLang);

  console.log(
    `[shadow] traduction — langues: source=${source}, target=${target} · premier segment: "${(originals[0] ?? "(aucun)").slice(0, 80)}"`,
  );

  // Transcript already in the target language: nothing to translate.
  if (source === target) {
    console.log("[shadow] traduction: transcript déjà dans la langue cible — ignorée");
    return { texts: originals, failed: false };
  }

  // Global deadline so one slow provider can never stall the whole action.
  const deadline = Date.now() + 90_000;
  // Echo count of the last provider result (see countEchoes).
  let echo = 0;

  const localUrl = selectLocalTranslateUrl(process.env);
  // Diagnostic sûr (aucun secret) : providers de traduction réellement
  // disponibles pour cette cascade.
  const localHost = (() => {
    if (!localUrl) return null;
    try {
      return new URL(localUrl).host;
    } catch {
      return "(url invalide)";
    }
  })();
  console.log(
    `[shadow] traduction providers — Groq LLM: ${
      process.env.GROQ_API_KEY?.trim() ? "configuré" : "absent"
    } · serveur local: ${localHost ?? "absent"} · cascade Groq → local → MyMemory`,
  );

  // 1. Groq LLM — moteur de traduction PRIORITAIRE : même clé gratuite que la
  // transcription (déjà configurée), le meilleur registre argot de la cascade
  // (le slang reste du slang) et fiable depuis les IP datacenter,
  // contrairement aux endpoints sans clé. Implémentation :
  // connectors/groqTranslate.ts (partagée avec OpenVerse Studio).
  const groqLlm = await translateViaGroqLlm(
    originals,
    source,
    target,
    deadline,
    (done) => reportProgress?.(Math.round((done / originals.length) * 100)),
  );
  if (groqLlm) {
    echo = await countEchoes(groqLlm, originals);
    if (echo < originals.length) {
      console.log(
        `[shadow] traduction Groq LLM OK — ${groqLlm.length} segments, ${echo} échos (${source} → ${target})`,
      );
      return { texts: groqLlm, failed: false };
    }
    console.warn("[shadow] Groq LLM — réponse en écho, provider suivante");
  }

  // 2. Serveur local Argos Translate / LibreTranslate (TRANSLATE_LOCAL_URL) —
  // open source, auto-hébergé : batch en UNE requête, timestamps inchangés
  // côté appelant (on ne renvoie que les textes). Aucune clé requise.
  // 90 % des déploiements sans worker sautent ce bloc — comportement inchangé.
  if (localUrl) {
    const pair = resolveLangPair(source, target);
    if (pair) {
      const local = await translateViaLocalServer(
        originals,
        pair.source,
        pair.target,
        localUrl,
        (done) => reportProgress?.(Math.round((done / originals.length) * 100)),
      );
      if (local) {
        echo = await countEchoes(local, originals);
        if (echo < originals.length) {
          console.log(
            `[shadow] traduction serveur local (Argos/LibreTranslate) OK — ${local.length} segments, ${echo} échos (${source} → ${target})`,
          );
          return { texts: local, failed: false };
        }
        console.warn("[shadow] serveur local — réponse en écho, cascade continue");
      }
    } else {
      console.log(
        `[shadow] traduction locale ignorée — paire ${source} → ${target} non servie par Argos/LibreTranslate`,
      );
    }
  }

  // 3. LibreTranslate — free and open source (community instances).
  const libre = await translateViaLibre(
    originals,
    source,
    target,
    (done) => reportProgress?.(Math.round((done / originals.length) * 100)),
  );
  if (libre) {
    echo = await countEchoes(libre, originals);
    if (echo < originals.length) {
      console.log(
        `[shadow] traduction LibreTranslate OK — ${libre.length} segments, ${echo} échos (${source} → ${target})`,
      );
      return { texts: libre, failed: false };
    }
    console.warn("[shadow] LibreTranslate — réponse en écho, provider suivante");
  }

  // 4. Google gtx — keyless, datacenter-IP friendly.
  const google = await translateViaGoogleGtx(
    originals,
    source,
    target,
    deadline,
    (done) => reportProgress?.(Math.round((done / originals.length) * 100)),
  );
  if (google) {
    echo = await countEchoes(google, originals);
    if (echo < originals.length) {
      console.log(
        `[shadow] traduction Google gtx OK — ${google.length} segments, ${echo} échos (${source} → ${target})`,
      );
      return { texts: google, failed: false };
    }
    console.warn("[shadow] Google gtx — réponse en écho, provider suivante");
  }

  // 5. MyMemory — keyless fallback. Its anonymous quota is per-IP and
  // Convex egress is shared, so treat it as best-effort only.
  const memory = await translateViaMyMemory(
    originals,
    source,
    target,
    deadline,
    (done) => reportProgress?.(Math.round((done / originals.length) * 100)),
  );
  if (memory) {
    echo = await countEchoes(memory, originals);
    if (echo < originals.length) {
      console.log(
        `[shadow] traduction MyMemory OK — ${memory.length} segments, ${echo} échos (${source} → ${target})`,
      );
      return { texts: memory, failed: false };
    }
    console.warn(
      "[shadow] MyMemory — réponse en écho (quota IP probablement épuisé), texte original conservé",
    );
    return { texts: memory, failed: true };
  }

  // 6. Nothing worked — keep the original text readable rather than broken.
  console.warn(
    `[shadow] traduction indisponible (${source} → ${target}) — texte original conservé, flag translationFailed`,
  );
  return { texts: originals, failed: true };
}

/**
 * Groq LLM translation — the same free key as transcription (already set),
 * batched: one chat completion translates ~40 numbered lines at once. Best
 * register handling in the cascade (slang stays slang) and reliable from
 * datacenter IPs, unlike the keyless endpoints. Returns null on failure so
 * the cascade moves on.
 */
async function translateViaGroqLlm(
  texts: string[],
  source: string,
  target: string,
  deadline: number,
  onProgress?: (done: number) => void,
): Promise<string[] | null> {
  // Implémentation unique dans le connecteur
  // src/convex/connectors/groqTranslate.ts (même clé Groq, même prompt
  // numéroté en lots de 40) : un seul code à maintenir pour la traduction
  // Groq, partagé avec OpenVerse Studio et les fiches média.
  return translateWithGroq(texts, source, target, { deadline, onProgress });
}

/**
 * Serveur de traduction local — Argos Translate (via serveur compatible
 * LibreTranslate : argos-translate-server expose exactement le contrat
 * `/translate` { q, source, target, format }) ou LibreTranslate
 * auto-hébergé. Un POST par lot (~40 segments, sous la limite des 5000
 * caractères de LibreTranslate) : latence bornée, timestamps préservés
 * (seuls les textes transitent). Retourne null en cas d'échec → cascade.
 */
async function translateViaLocalServer(
  texts: string[],
  source: string,
  target: string,
  baseUrl: string,
  onProgress?: (done: number) => void,
): Promise<string[] | null> {
  const BATCH = 40;
  const out: string[] = new Array(texts.length).fill("");
  let okCount = 0;

  for (let start = 0; start < texts.length; start += BATCH) {
    const batch = texts.slice(start, start + BATCH);
    try {
      const res = await raceTimeout(
        fetch(`${baseUrl}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: batch, source, target, format: "text" }),
        }),
        30_000,
        `traduction locale (lot ${Math.floor(start / BATCH) + 1})`,
      );
      if (!res.ok) {
        console.warn(
          `[shadow] serveur local : HTTP ${res.status} — cascade continue`,
        );
        return okCount > 0 ? out.map((t, i) => t || texts[i]) : null;
      }
      const json = (await res.json()) as {
        translatedText?: string | string[];
      };
      const list = Array.isArray(json.translatedText)
        ? json.translatedText
        : json.translatedText != null
          ? [json.translatedText]
          : [];
      if (list.length !== batch.length) {
        console.warn(
          `[shadow] serveur local : réponse incomplète (${list.length}/${batch.length}) — cascade continue`,
        );
        return okCount > 0 ? out.map((t, i) => t || texts[i]) : null;
      }
      batch.forEach((orig, i) => {
        const t = list[i];
        if (t && t.trim()) {
          out[start + i] = t;
          okCount++;
        }
      });
      onProgress?.(okCount);
    } catch (err) {
      console.warn(
        `[shadow] serveur local lot échoué: ${err instanceof Error ? err.message : err}`,
      );
      break;
    }
  }

  console.log(
    `[shadow] serveur local — ${okCount}/${texts.length} segments traduits`,
  );
  if (okCount === 0) return null;
  return out.map((t, i) => t || texts[i]);
}

/**
 * Google gtx (translate.googleapis.com) — keyless machine translation,
 * tolerant of slang/colloquial register. One request per segment with a hard
 * deadline; returns null when nothing succeeded so the cascade moves on.
 * Batching is impossible on this endpoint; a 90 s deadline caps the cost.
 */
async function translateViaGoogleGtx(
  texts: string[],
  source: string,
  target: string,
  deadline: number,
  onProgress?: (done: number) => void,
): Promise<string[] | null> {
  if (source === target) return texts;

  const translateOne = async (text: string): Promise<string | null> => {
    if (Date.now() > deadline) return null;
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=` +
      encodeURIComponent(text);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      // Response: [[["traduction","original",null,null,...], ...], ...]
      const data = (await res.json()) as [
        [string, string, ...unknown[]][],
        ...unknown[],
      ];
      const translated = data[0]?.map((seg) => seg[0]).join("");
      return translated && translated.trim() ? translated : null;
    } catch {
      return null;
    }
  };

  // Same 4-worker pool pattern as MyMemory — bounded latency.
  const out: string[] = new Array(texts.length).fill("");
  let okCount = 0;
  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < texts.length) {
      if (Date.now() > deadline) return;
      const i = cursor++;
      const translated = await translateOne(texts[i]);
      if (translated) {
        out[i] = translated;
        okCount++;
        onProgress?.(okCount);
      }
    }
  });
  await Promise.all(workers);
  console.log(
    `[shadow] Google gtx — ${okCount}/${texts.length} segments traduits`,
  );
  if (okCount === 0) return null;
  return out.map((t, i) => t || texts[i]);
}

// ─── Slang detection from the local database ──────────────────────

/**
 * Flag subtitle lines containing expressions from the app's own slang
 * database (queried via an internal mutation-free helper in slang.ts).
 * Runs entirely locally — no API, no cost, and the detected hits reuse the
 * curated meanings/contexts the learner already studies in Découverte.
 */
async function detectSlangFromDatabase(
  ctx: ActionCtx,
  language: string,
  subtitles: Subtitle[],
): Promise<{ expression: string; meaning: string; context?: string }[]> {
  // Narrow to the focus languages the slang DB covers; anything else (e.g. a
  // French transcript) has no expression table to scan.
  const supported = ["en", "zh", "es", "ar", "ru"] as const;
  const focus = (supported as readonly string[]).includes(language)
    ? (language as (typeof supported)[number])
    : "en";
  const expressions = await ctx.runQuery(internal.slang.allForLanguage, {
    language: focus,
  });
  const hits: {
    expression: string;
    meaning: string;
    context?: string;
  }[] = [];

  for (const entry of expressions) {
    const needle = entry.expression.toLowerCase();
    if (!needle) continue;
    // Match inside either the original transcript or the translation so a
    // line like « pas de cap » in the French translation still flags.
    const touched = subtitles.filter((sub) => {
      const haystack =
        `${sub.originalText} ${sub.translatedText}`.toLowerCase();
      return haystack.includes(needle);
    });
    if (touched.length > 0) {
      hits.push({
        expression: entry.expression,
        meaning: entry.meaning,
        context: entry.context,
      });
    }
  }
  return hits;
}

// ─── Shared completion: translation → fusion → slang → DB ─────────

type PipelineInput = {
  mediaId: Id<"userMedia">;
  language: string;
  /** Language the transcript is actually in (captions track / detected),
   * which can differ from the user's focus `language`. */
  sourceLangOverride?: string;
  /** Language subtitles are translated into (defaults to French). */
  targetLanguage?: string;
  text: string;
  segments: WhisperSegment[];
  duration?: number;
  transcriptSource: string;
  /**
   * Traductions DÉJÀ calculées par un moteur local du déploiement (OPUS-MT
   * exécuté dans l'onglet de l'utilisateur, §6-§7) : indexées comme
   * `segments`. Quand elles sont fournies en nombre suffisant, la cascade
   * distante (Groq / LibreTranslate / gtx / MyMemory) n'est PAS appelée.
   */
  translations?: string[];
};

/**
 * Completion shared by file uploads and YouTube links: synchronized
 * subtitles, translation and database slang detection, written to the media
 * record the client subscribes to.
 */
export async function runSharedPipeline(ctx: ActionCtx, input: PipelineInput) {
  let lastProgressWrite = 0;
  // Progress checkpoint 1 — publish the transcript as soon as it exists so
  // the UI's step tracker advances off « Transcription » while translation
  // (the longest stage) runs. Without this the tracker sat on step 1 for the
  // whole pipeline, which read as "bloqué".
  await safePatch(ctx, input.mediaId, {
    status: "processing",
    transcription: input.text,
    transcriptSource: input.transcriptSource,
    translationProgress: 0,
    segmentCount: input.segments.length,
    durationSeconds:
      input.duration ?? Math.max(...input.segments.map((s) => s.end), 0),
  });
  console.log(
    `[shadow] progression — transcription publiée (${input.segments.length} segments), traduction en cours…`,
  );

  // 1. Translation cascade. Serveur local Argos/LibreTranslate d'abord
  // (open source, auto-hébergé), puis cascade gratuite existante — rien ne
  // change pour un déploiement sans worker.
  const localTranslate = selectLocalTranslateUrl(process.env);
  // Paire réellement utilisée — jamais source === cible (voir distinctTarget).
  const pair = distinctTarget(
    input.sourceLangOverride ?? input.language,
    input.targetLanguage ?? TARGET_LANG_ISO,
  );
  if (pair.switched) {
    console.warn(
      `[shadow] cible identique à la langue du média (${pair.source}) — bascule automatique sur ${pair.target} pour que la colonne cible soit une vraie traduction`,
    );
  }
  // Log the resolved source→target pair — the #1 debugging question when
  // translations "don't apply" is which pair the cascade was told to use.
  console.log(
    `[shadow] traduction — ${pair.source} → ${pair.target} (${input.segments.length} segments)`,
  );
  const tTranslate = Date.now();
  const localTranslations =
    input.translations && input.translations.length === input.segments.length
      ? input.translations
      : null;
  if (localTranslations) {
    console.log(
      `[shadow] traduction fournie par le moteur local du déploiement — ${localTranslations.length} segments (aucune requête distante)`,
    );
  }
  const { texts: translations, failed: translationFailed } = localTranslations
    ? { texts: localTranslations, failed: false }
    : await translatePipeline(
      input.segments,
      pair.source,
      pair.target,
      // Throttled DB publish: at most one patch per 2 s so a 200-segment
      // transcript doesn't hammer the mutation log while the UI still sees
      // smooth progress.
      (percent) => {
        const now = Date.now();
        if (now - lastProgressWrite < 2_000) return;
        lastProgressWrite = now;
        void safePatch(ctx, input.mediaId, {
          status: "processing",
          translationProgress: Math.min(100, Math.max(0, percent)),
        });
      },
    );
  // The one-line answer to « la traduction ne s'applique pas » : compare the
  // first translated segment against the source logged above.
  console.log(
    `[shadow] traduction résultat — premier segment traduit: "${(translations[0] ?? "(aucun)").slice(0, 80)}"`,
  );
  console.log(
    `[shadow] progression — traduction terminée en ${((Date.now() - tTranslate) / 1000).toFixed(1)} s`,
  );

  // 2. Reconstruct synchronized subtitles.
  const subtitles: Subtitle[] = fuseSubtitles({
    segments: input.segments,
    translations,
    slangPhrases: [],
  });

  // Progress checkpoint 2 — publish translated subtitles so the UI advances
  // to the slang step while detection runs.
  await safePatch(ctx, input.mediaId, {
    status: "processing",
    translation: translations.join(" "),
    subtitles,
  });

  // 3. Slang detection against the local expressions database. Cosmetic
  // stage: if it fails, the transcript still ships — never block a completed
  // transcription on an enrichment step.
  let slangHits: { expression: string; meaning: string; context?: string }[] =
    [];
  try {
    slangHits = await detectSlangFromDatabase(
      ctx,
      input.language,
      subtitles,
    );
  } catch (err) {
    console.warn(
      `[shadow] détection d'argot ignorée (échec non bloquant): ${
        err instanceof Error ? err.message : err
      }`,
    );
  }

  // 4. Flag the matching subtitle lines.
  for (const hit of slangHits) {
    const needle = hit.expression.toLowerCase();
    for (const sub of subtitles) {
      const haystack = `${sub.originalText} ${sub.translatedText}`.toLowerCase();
      if (haystack.includes(needle)) sub.isSlang = true;
    }
  }

  console.log(
    `[shadow] finalisation — ${subtitles.length} sous-titres, ${slangHits.length} expressions d'argot`,
  );
  await safePatch(ctx, input.mediaId, {
    status: "completed",
    transcription: input.text,
    translation: translations.join(" "),
    translationFailed,
    translationProgress: 100,
    subtitles,
    slangDetected: slangHits.map((s) => ({
      ...s,
      subtitleIds: subtitles
        .filter((sub) =>
          `${sub.originalText} ${sub.translatedText}`
            .toLowerCase()
            .includes(s.expression.toLowerCase()),
        )
        .map((sub) => sub.id),
    })),
    durationSeconds:
      input.duration ?? Math.max(...input.segments.map((s) => s.end), 0),
    transcriptSource: input.transcriptSource,
  });

  return slangHits.length;
}

// ─── ASR : faster-whisper (open source) d'abord, Groq en repli ─────

/**
 * Timestamp-less transcript: slice the text into ~8-word segments timed on a
 * ~150 words/minute speaking rate so the subtitle timeline stays plausible.
 */
function chunkPlainText(text: string): WhisperSegment[] {
  const words = text.trim().split(/\s+/);
  const wordsPerSegment = 8;
  const wordsPerSecond = 2.5;
  const segments: WhisperSegment[] = [];
  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const chunk = words.slice(i, i + wordsPerSegment).join(" ");
    if (!chunk) continue;
    segments.push({
      id: segments.length,
      start: i / wordsPerSecond,
      end: (i + wordsPerSegment) / wordsPerSecond,
      text: chunk,
    });
  }
  return segments;
}

/**
 * Transcribe an audio/video buffer with the configured ASR engine —
 * faster-whisper (open source, self-hosted, endpoint OpenAI-compatible)
 * FIRST, Groq Whisper as the fallback so the free key is no longer the
 * mandatory path. With verbose_json + segment granularity both engines
 * ship ready-made segments with real timestamps — no VTT parsing needed.
 * Keep files under ~25 MB (free-tier request limit): trim uploads or pick
 * short clips.
 *
 * Aucun moteur configuré → ASR_WORKER_UNAVAILABLE : l'échec est EXPLICITE,
 * jamais un faux succès ni une erreur « internal » indéchiffrable.
 */
export async function transcribeAudio(
  buf: Buffer,
  filename = "audio.mp3",
  languageHint?: string,
  opts?: {
    /**
     * Audio long (> 2 min, chemin « fichier long » dèjà découpé) : Groq
     * passe DEVANT le worker local — débit constant, aucun timeout sur un
     * long extrait. Le worker local reste le repli.
     */
    preferGroq?: boolean;
  },
): Promise<{ text: string; segments: WhisperSegment[]; lang?: string; engine: string }> {
  const endpoint = selectAsrEndpoint(process.env);
  if (!endpoint) {
    throw new Error(
      "ASR_WORKER_UNAVAILABLE — Aucun moteur de transcription configuré. Déploie faster-whisper (WHISPER_LOCAL_URL, recommandé : open source et local) ou ajoute GROQ_API_KEY (clé gratuite sur console.groq.com) dans Convex Settings.",
    );
  }

  // Diagnostic sûr (aucun secret) : provider/endpoint réellement sélectionnés.
  const endpointHost = (() => {
    try {
      return new URL(endpoint.url).host;
    } catch {
      return "(url invalide)";
    }
  })();
  console.log(
    `[shadow] ASR provider sélectionné — ${endpoint.engine} @ ${endpointHost} (modèle ${endpoint.model})`,
  );

  const buildForm = (model: string): FormData => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)]), filename);
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    // §6 — demande aussi les word timestamps (supportés par Groq, Speaches,
    // faster-whisper-server) : consommés par le karaoké quand présents,
    // ignorés silencieusement par les moteurs qui ne les exposent pas.
    form.append("timestamp_granularities[]", "word");
    // Indice de langue quand le pipeline en connaît une (langue cible du
    // média) — prouvé en runtime : sur un clip court, l'auto-détection peut
    // se tromper (FR → "th") alors que le hint verrouille la bonne piste.
    // Optionnel : les autres appelants gardent l'auto-détection.
    if (languageHint && /^[a-z]{2}(-[A-Z]{2})?$/.test(languageHint)) {
      form.append("language", languageHint.split("-")[0]);
    }
    return form;
  };

  // Worker local d'abord. Le repli Groq n'intervient QUE si le worker configuré
  // est injoignable (erreur réseau/timeout : pas encore démarré, redémarrage) —
  // jamais sur une réponse HTTP du worker, qui reste une vraie erreur ASR.
  // Exception : audio > 2 min (opts.preferGroq) où Groq passe devant.
  const groqEndpoint =
    endpoint.kind === "groq"
      ? endpoint
      : selectAsrEndpoint({ GROQ_API_KEY: process.env.GROQ_API_KEY });
  const localEndpoint = endpoint.kind === "local_whisper" ? endpoint : null;
  const attempts = opts?.preferGroq && groqEndpoint
    ? localEndpoint
      ? [groqEndpoint, localEndpoint]
      : [groqEndpoint]
    : localEndpoint && groqEndpoint
      ? [localEndpoint, groqEndpoint]
      : [endpoint];
  if (opts?.preferGroq && groqEndpoint) {
    console.log(
      "[shadow] audio long (> 2 min) — Groq Whisper en moteur principal, worker local en repli",
    );
  }

  const t0 = Date.now();
  let res: Response | null = null;
  let used = endpoint;
  for (let i = 0; i < attempts.length; i++) {
    const ep = attempts[i];
    const headers: Record<string, string> =
      ep.kind === "groq" ? { Authorization: `Bearer ${ep.apiKey}` } : {};
    try {
      res = await raceTimeout(
        fetch(ep.url, { method: "POST", headers, body: buildForm(ep.model) }),
        150_000,
        `transcription ${ep.engine}`,
      );
      used = ep;
      if (i > 0) {
        console.log(
          `[shadow] repli ${ep.engine} utilisé — ${attempts[0].engine} injoignable (worker local arrêté ou en redémarrage)`,
        );
      }
      break;
    } catch (err) {
      // Réseau/timeout sur le worker local : on tente le repli configuré.
      const detail = err instanceof Error ? err.message : String(err);
      if (i + 1 < attempts.length) {
        console.log(`[shadow] ${ep.engine} injoignable — repli de sécurité : ${detail}`);
        continue;
      }
      // Aucun repli disponible → ASR_FAILED explicite, PAS un faux succès (§14).
      throw new Error(`ASR_FAILED — ${ep.engine} injoignable : ${detail}`);
    }
  }
  if (!res) {
    throw new Error(`ASR_FAILED — ${endpoint.engine} : aucune réponse`);
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    if (res.status >= 400 && res.status < 500) {
      // 4xx : la requête elle-même est en cause — le plus souvent l'audio
      // (format non décodable, fichier corrompu, vide).
      throw new Error(`INVALID_AUDIO — ${used.engine} ${res.status} : ${detail}`);
    }
    throw new Error(`ASR_FAILED — ${used.engine} ${res.status} : ${detail}`);
  }
  console.log(
    `[shadow] ${used.engine} — transcription reçue en ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  const data = (await res.json()) as {
    text?: string;
    language?: string;
    segments?:
      | {
          start: number;
          end: number;
          text: string;
          no_speech_prob?: number;
          avg_logprob?: number;
          words?: { start?: number; end?: number; word?: string }[] | null;
        }[]
      | null;
  };

  let segments: WhisperSegment[] = (data.segments ?? [])
    .filter((s) => s.text?.trim())
    .map((s, i) => ({
      id: i,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      // §6 — word timestamps quand le moteur les fournit (Speaches et
      // faster-whisper acceptent timestamp_granularities[]="word") : portés
      // tels quels, le contrat Shadow ne change pas.
      words: Array.isArray(s.words) && s.words.length > 0 ? s.words : undefined,
      // Confiance dérivée d'avg_logprob (ln-space) quand présent — optionnelle.
      confidence:
        typeof s.avg_logprob === "number" && !Number.isNaN(s.avg_logprob)
          ? Math.exp(s.avg_logprob)
          : undefined,
    }));
  if (segments.length === 0 && data.text?.trim()) {
    // verbose_json always carries segments; the plain-text chunker stays as a
    // belt-and-suspenders fallback so subtitles still map to the timeline.
    segments = chunkPlainText(data.text);
  }
  if (segments.length === 0) {
    throw new Error(
      `ASR_FAILED — ${used.engine} : la transcription n'a produit aucun segment`,
    );
  }
  return {
    text: data.text ?? segments.map((s) => s.text).join(" "),
    segments,
    lang: data.language ?? undefined,
    engine: used.engine,
  };
}

// ─── Fail-safe helpers ────────────────────────────────────────────

type MediaPatch = {
  status?: string;
  error?: string;
  errorKind?: string;
  transcription?: string;
  translation?: string;
  translationFailed?: boolean;
  translationProgress?: number;
  segmentCount?: number;
  subtitles?: Subtitle[];
  slangDetected?: {
    expression: string;
    meaning: string;
    context?: string;
    subtitleIds: number[];
  }[];
  durationSeconds?: number;
  transcriptSource?: string;
};

/** patchMedia that never throws (e.g. record deleted mid-pipeline). */
async function safePatch(
  ctx: ActionCtx,
  mediaId: Id<"userMedia">,
  patch: MediaPatch,
): Promise<void> {
  try {
    await ctx.runMutation(internal.media.patchMedia, { mediaId, ...patch });
  } catch (err) {
    console.error(
      "[shadow] patch DB impossible:",
      err instanceof Error ? err.message : err,
    );
  }
}

export const processMedia = action({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    console.log(`[shadow] ▶ processMedia — média ${args.mediaId}`);
    try {
      const media = await ctx.runQuery(internal.media.getMediaInternal, {
        mediaId: args.mediaId,
      });
      if (media.status === "completed") return { ok: true as const };

      await safePatch(ctx, args.mediaId, { status: "processing" });

      if (!media.storageId) {
        throw new Error("Ce média n'a pas de fichier associé");
      }
      const blob = await ctx.storage.get(media.storageId);
      if (!blob) throw new Error("Fichier média vide ou illisible");
      const buf = Buffer.from(await blob.arrayBuffer());
      if (buf.length === 0) throw new Error("Fichier média vide");
      if (buf.length > 24 * 1024 * 1024) {
        throw new Error(
          "Fichier trop volumineux pour la transcription Groq (~25 Mo max). Découpe-le ou convertis-le en MP3.",
        );
      }

      // 1. Transcription with timestamps (faster-whisper → Groq fallback).
      console.log(
        `[shadow] transcription ASR (${Math.round(buf.length / 1024)} Ko)…`,
      );
      const { text, segments, lang, engine: asrEngine } = await transcribeAudio(
        buf,
        "audio.mp3",
        media.language,
      );
      console.log(
        `[shadow] transcription OK — ${segments.length} segments (langue: ${lang ?? "?"})`,
      );
      const duration = Math.max(...segments.map((s) => s.end), 0);

      // NOTE: XP is credited client-side when the user finishes the session —
      // scheduled actions run without user auth, so no getAuthUserId here.
      await runSharedPipeline(ctx, {
        mediaId: args.mediaId,
        language: media.language,
        targetLanguage: media.targetLanguage,
        sourceLangOverride: lang,
        text,
        segments,
        duration,
        transcriptSource: asrEngine,
      });

      console.log(`[shadow] ✔ processMedia terminé — média ${args.mediaId}`);
      return { ok: true as const };
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erreur inconnue";
      console.error(`[shadow] ✖ processMedia échoué: ${raw}`);
      const friendly = raw.startsWith("shadow-timeout")
        ? "La transcription a pris trop de temps. Essaie un fichier plus court (quelques minutes) et réessaie."
        : raw;
      await safePatch(ctx, args.mediaId, {
        status: "failed",
        error: friendly,
        errorKind: raw.startsWith("shadow-timeout")
          ? "timeout"
          : raw.includes("ASR_WORKER_UNAVAILABLE")
            ? "missing_key" // même carte UI « moteur indisponible », cause exacte dans `error`
            : raw.includes("faster_whisper_local") || raw.includes("groq_whisper")
              ? "groq_error"
              : "internal",
      });
      return { ok: false as const };
    }
  },
});

// ─── YouTube: captions only (audio extraction is blocked server-side) ──

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (host === "m.youtube.com" || host.endsWith("youtube.com")) {
      return (
        parsed.searchParams.get("v") ??
        parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ??
        null
      );
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * youtube-transcript returns seconds for the legacy XML format but
 * milliseconds for the srv3 format YouTube serves today (verified live). A
 * caption never lasts over a minute in seconds-units, while ms durations
 * regularly exceed 3600 — same idea for offsets past 2 h.
 */
function normalizeTranscriptUnits(
  entries: { text: string; duration: number; offset: number }[],
): WhisperSegment[] {
  const looksLikeMs = entries.some(
    (e) => e.duration > 60 || e.offset > 7200,
  );
  const div = looksLikeMs ? 1000 : 1;
  return entries.map((e, i) => ({
    id: i,
    start: e.offset / div,
    end: e.offset / div + e.duration / div,
    text: e.text,
  }));
}

/** Loose rate-limit detection — no eager import of the error class. */
function isRateLimitError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "YoutubeTranscriptTooManyRequestError") return true;
  return /429|too many requests/i.test(
    err instanceof Error ? err.message : String(err),
  );
}

/** Reject if `promise` is still pending after `ms` — no infinite hangs. */
function raceTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `shadow-timeout après ${Math.round(ms / 1000)} s (${label})`,
            ),
          ),
        ms,
      ),
    ),
  ]);
}

/** One caption-track fetch: lazy lib load, hard timeout, one brief retry on 429. */
async function fetchTrack(
  videoId: string,
  lang?: string,
): Promise<{
  entries: { text: string; duration: number; offset: number; lang?: string }[] | null;
  rateLimited: boolean;
  timedOut: boolean;
}> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Lazy load: a broken dependency becomes a catchable error instead of
      // a scheduled action dying at import (status frozen on "pending").
      const { YoutubeTranscript } = await import("youtube-transcript");
      const entries = await raceTimeout(
        YoutubeTranscript.fetchTranscript(
          videoId,
          lang ? { lang } : undefined,
        ),
        12_000,
        `sous-titres ${lang ?? "piste originale"}`,
      );
      return { entries, rateLimited: false, timedOut: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("shadow-timeout")) {
        console.warn(`[shadow] piste ${lang ?? "originale"}: ${msg}`);
        return { entries: null, rateLimited: false, timedOut: true };
      }
      if (isRateLimitError(err)) {
        if (attempt === 0) {
          // Back off briefly once — most 429s clear within seconds.
          await new Promise((r) => setTimeout(r, 1_500));
          continue;
        }
        console.warn(
          `[shadow] rate-limit YouTube (429) sur la piste ${lang ?? "originale"}`,
        );
        return { entries: null, rateLimited: true, timedOut: false };
      }
      // No caption track for this language / transient network error.
      return { entries: null, rateLimited: false, timedOut: false };
    }
  }
  return { entries: null, rateLimited: true, timedOut: false };
}

type CaptionResult =
  | { kind: "ok"; segments: WhisperSegment[]; lang?: string }
  | { kind: "rate_limited" }
  | { kind: "none" };

/**
 * ÉTAPE 1 — YouTube auto/manual captions. Free and instant. Returns the
 * winning track's language too, so translation knows the real source.
 *
 * Ordre de récupération (le cas asr était systématiquement manqué avant) :
 *   a. piste publiée dans la langue d'origine (le texte que l'on traduit) ;
 *   b. n'importe quelle piste accessible — y compris les AUTO-GÉNÉRÉES
 *      (kind=asr) : sans `lang`, la librairie renvoie la première piste,
 *      asr ou non ; avec `lang`, elle sélectionne aussi les asr ;
 *   c. piste d'une autre langue (sera traduite par la cascade).
 */
async function fetchYoutubeSubtitles(
  videoId: string,
): Promise<CaptionResult> {
  // a. The video's original track first — it is the text we translate FROM.
  const original = await fetchTrack(videoId);
  if (original.entries && original.entries.length > 0) {
    return { kind: "ok", segments: normalizeTranscriptUnits(original.entries) };
  }
  // YouTube hanging (not refusing): stop hammering the remaining tracks.
  if (original.timedOut) return { kind: "none" };
  // b. Any accessible track — auto-generated (asr) included. This call is
  // what makes caption-less videos work: their only track is asr, which
  // the language-keyed attempts below never matched.
  const bare = await fetchTrack(videoId);
  if (bare.entries && bare.entries.length > 0) {
    return {
      kind: "ok",
      segments: normalizeTranscriptUnits(bare.entries),
      lang: bare.entries[0]?.lang,
    };
  }
  if (bare.rateLimited) return { kind: "rate_limited" };
  if (bare.timedOut) return { kind: "none" };
  // c. A track in another language — the translation cascade takes over.
  for (const lang of ["en", "es", "zh", "ar", "ru", "fr"]) {
    const track = await fetchTrack(videoId, lang);
    if (track.entries && track.entries.length > 0) {
      return {
        kind: "ok",
        segments: normalizeTranscriptUnits(track.entries),
        lang,
      };
    }
    if (track.timedOut) return { kind: "none" };
  }
  return original.rateLimited || bare.rateLimited
    ? { kind: "rate_limited" }
    : { kind: "none" };
}

/** Markers so the action can surface actionable messages to the user. */
const NO_TRANSCRIPT_MSG = "NO_YOUTUBE_TRANSCRIPT";
const RATE_LIMITED_MSG = "RATE_LIMITED_YOUTUBE";

/**
 * YouTube pipeline: captions via the youtube-transcript library — free,
 * instant, keyless. Videos without captions (or while YouTube throttles the
 * server IP) fail with an actionable message; the reliable free audio path
 * is the upload flow, which runs the same Groq transcription.
 */
export const processYouTube = action({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    console.log(`[shadow] ▶ processYouTube — média ${args.mediaId}`);
    try {
      const media = await ctx.runQuery(internal.media.getMediaInternal, {
        mediaId: args.mediaId,
      });
      if (media.status === "completed") return { ok: true as const };

      await safePatch(ctx, args.mediaId, { status: "processing" });

      const videoId = media.sourceUrl ? extractYouTubeId(media.sourceUrl) : null;
      if (!videoId) {
        await safePatch(ctx, args.mediaId, {
          status: "failed",
          error: "URL YouTube invalide ou non reconnue",
          errorKind: "internal",
        });
        return { ok: false as const };
      }

      // ÉTAPE 1 — YouTube auto-generated captions (free, instant). The
      // winning track's language feeds the translation step.
      const tCaptions = Date.now();
      console.log(`[shadow] ÉTAPE 1 — sous-titres YouTube (${videoId})…`);
      const captions = await fetchYoutubeSubtitles(videoId);
      console.log(
        `[shadow] ÉTAPE 1 — terminée en ${((Date.now() - tCaptions) / 1000).toFixed(1)} s`,
      );
      if (captions.kind === "rate_limited") {
        throw new Error(RATE_LIMITED_MSG);
      }
      const segments = captions.kind === "ok" ? captions.segments : null;
      const detectedLang: string | undefined =
        captions.kind === "ok" ? captions.lang : undefined;
      console.log(
        captions.kind === "ok"
          ? `[shadow] sous-titres OK — ${segments?.length} segments (langue: ${detectedLang ?? "originale"})`
          : "[shadow] aucune piste de sous-titres accessible",
      );

      if (!segments || segments.length === 0) {
        // Aucune piste accessible (asr compris) : la vidéo reste LISIBLE via
        // son lecteur officiel — statut « completed » sans sous-titres,
        // jamais un échec. L'interface affiche un bandeau discret et garde
        // toutes les actions actives ; l'upload reste proposé plus bas.
        console.log("[shadow] aucune piste de sous-titres — lecture sans karaoké");
        await safePatch(ctx, args.mediaId, {
          status: "completed",
          transcriptSource: "youtube_embed_only",
          subtitles: [],
          slangDetected: [],
        });
        console.log(
          `[shadow] ✔ processYouTube terminé (sans sous-titres) — média ${args.mediaId}`,
        );
        return { ok: true as const };
      }

      const text = segments.map((s) => s.text.trim()).join(" ");
      const duration = Math.max(...segments.map((s) => s.end), 0);

      await runSharedPipeline(ctx, {
        mediaId: args.mediaId,
        language: media.language,
        targetLanguage: media.targetLanguage,
        sourceLangOverride: detectedLang,
        text,
        segments,
        duration,
        transcriptSource: "youtube_subtitles",
      });

      console.log(`[shadow] ✔ processYouTube terminé — média ${args.mediaId}`);
      // (translation: la cascade Groq LLM → LibreTranslate → Google →
      // MyMemory reste le repli ; le serveur local Argos/LibreTranslate est
      // essayé en premier dans translatePipeline — voir selectLocalTranslateUrl.)
      return { ok: true as const };
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erreur inconnue";
      console.error(`[shadow] ✖ processYouTube échoué: ${raw}`);
      const friendly = raw.includes(NO_TRANSCRIPT_MSG)
        ? "Transcription indisponible pour ce contenu — la vidéo reste lisible."
        : raw.includes(RATE_LIMITED_MSG)
          ? "YouTube a temporairement limité les demandes de sous-titres. Réessaie dans une minute, ou télécharge la vidéo et utilise « Upload fichier »."
          : raw;
      await safePatch(ctx, args.mediaId, {
        status: "failed",
        error: friendly,
        errorKind: raw.includes(RATE_LIMITED_MSG)
          ? "rate_limited"
          : raw.includes(NO_TRANSCRIPT_MSG)
            ? "no_transcript"
            : raw.startsWith("shadow-timeout")
              ? "timeout"
              : raw.includes("GROQ_API_KEY")
                ? "missing_key"
                : "internal",
      });
      return { ok: false as const };
    }
  },
});

/**
 * Pasted-text pipeline: the source IS text, so there is no transcription
 * stage — segmentation → translation → slang, sharing the completion path
 * (and its resilience) with the media pipelines. The text is read via the
 * internal getMediaInternal — it must be readable by this action, hence the
 * textContent passthrough added to it.
 */
export const processTextMedia = action({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    console.log(`[shadow] ▶ processTextMedia — média ${args.mediaId}`);
    try {
      const media = await ctx.runQuery(internal.media.getMediaInternal, {
        mediaId: args.mediaId,
      });
      if (media.status === "completed") return { ok: true as const };

      await safePatch(ctx, args.mediaId, { status: "processing" });

      const text = (media.textContent ?? "").trim();
      if (!text) {
        throw new Error("Ce média texte est vide");
      }

      // One timed segment per paragraph (long paragraphs are split on
      // sentence ends so the karaoke panel keeps a readable rhythm). The
      // virtual clock gives every segment a stable, clickable position.
      const paragraphs = text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      const sentences: string[] = [];
      for (const p of paragraphs) {
        const parts = p.split(/(?<=[.!?…])\s+/);
        for (const s of parts) {
          const t = s.trim();
          if (t) sentences.push(t);
          if (sentences.length >= 400) break;
        }
        if (sentences.length >= 400) break;
      }
      const sentencesPerSegment = 2;
      const wordsPerSecond = 2.5;
      const segments: WhisperSegment[] = [];
      for (let i = 0; i < sentences.length; i += sentencesPerSegment) {
        const chunk = sentences.slice(i, i + sentencesPerSegment).join(" ");
        const wordCount = chunk.split(/\s+/).length;
        const start = segments.length === 0 ? 0 : segments[segments.length - 1].end;
        const end = start + Math.max(1, wordCount / wordsPerSecond);
        segments.push({ id: segments.length, start, end, text: chunk });
      }
      if (segments.length === 0) {
        throw new Error("Segmentation du texte impossible");
      }
      const duration = segments[segments.length - 1].end;

      await runSharedPipeline(ctx, {
        mediaId: args.mediaId,
        language: media.language,
        targetLanguage: media.targetLanguage,
        text,
        segments,
        duration,
        transcriptSource: "pasted_text",
      });

      console.log(`[shadow] ✔ processTextMedia terminé — média ${args.mediaId}`);
      return { ok: true as const };
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erreur inconnue";
      console.error(`[shadow] ✖ processTextMedia échoué: ${raw}`);
      await safePatch(ctx, args.mediaId, {
        status: "failed",
        error: raw,
        errorKind: "internal",
      });
      return { ok: false as const };
    }
  },
});

// ─── Liens non résolus : échec explicite, jamais de lecteur vide ──────

/**
 * Pipeline des liens que le MediaUrlResolver n'a pas rendus lisibles
 * (TikTok, Vimeo, SoundCloud, plateformes fermées…) : le média existe —
 * l'URL reste consultable et le flux d'upload reste proposé — mais le
 * traitement se termine par un échec EXPLICITE au lieu de prétendre que
 * l'extracteur YouTube peut tout traiter (qui répondait « no transcript »
 * et induisait l'utilisateur en erreur).
 */
/**
 * Plateforme EMBED_ALLOWED sans transcript (TikTok aujourd'hui) : le média
 * EST lisible via son lecteur officiel côté frontend, mais aucun pipeline
 * de sous-titres n'existe. L'action matérialise ce contrat : statut
 * « completed » SANS sous-titres — jamais un échec, jamais un faux transcript.
 * Le panneau Shadow affiche alors le lecteur + la notice « karaoké
 * indisponible » (indépendance transcript ↔ playabilité).
 */
export const completeEmbedOnlyMedia = action({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    console.log(`[shadow] ▶ completeEmbedOnlyMedia — média ${args.mediaId}`);
    const media = await ctx.runQuery(internal.media.getMediaInternal, {
      mediaId: args.mediaId,
    });
    const platform = media.platform ?? "cette plateforme";
    await safePatch(ctx, args.mediaId, {
      status: "completed",
      transcriptSource: `${platform}_embed_only`,
      subtitles: [],
      slangDetected: [],
    });
    return { ok: true as const };
  },
});

export const processUnresolvedUrl = action({
  args: { mediaId: v.id("userMedia") },
  handler: async (ctx, args) => {
    console.log(`[shadow] ▶ processUnresolvedUrl — média ${args.mediaId}`);
    const media = await ctx.runQuery(internal.media.getMediaInternal, {
      mediaId: args.mediaId,
    });
    const platform = media.platform ?? "cette plateforme";
    const withTranscript = ["vimeo", "soundcloud"];
    const reason = withTranscript.includes(platform)
      ? "cette plateforme n'expose pas de transcription accessible"
      : "cette plateforme n'est pas lisible directement dans MOOVY";
    await safePatch(ctx, args.mediaId, {
      status: "failed",
      errorKind: "unsupported_platform",
      error: `Lecture directe impossible : ${reason}. Utilise « Upload fichier » (MP3/MP4) pour l'analyse complète — transcription garantie — ou colle directement un texte.`,
    });
    return { ok: false as const };
  },
});

/**
 * Diagnostic action: verifies the configured ASR engine end-to-end —
 * faster-whisper local first (WHISPER_LOCAL_URL), Groq second. The response
 * names the engine actually tested and never echoes any key.
 */
export const testAsrEngine = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const endpoint = selectAsrEndpoint(process.env);
    if (!endpoint) {
      return {
        success: false as const,
        error:
          "ASR_WORKER_UNAVAILABLE — Aucun moteur de transcription configuré. Déploie faster-whisper (WHISPER_LOCAL_URL, recommandé) ou ajoute GROQ_API_KEY (clé gratuite sur console.groq.com).",
      };
    }

    try {
      // End-to-end check of the exact endpoint transcription uses: a valid
      // 1-second silent WAV. Silence transcribes to an empty (but 200 OK)
      // result — which alone proves the endpoint and model access work.
      const res = await raceTimeout(
        fetch(endpoint.url, {
          method: "POST",
          headers:
            endpoint.kind === "groq"
              ? { Authorization: `Bearer ${endpoint.apiKey}` }
              : {},
          body: buildTestAudioBlob(endpoint.model),
        }),
        15_000,
        `test ${endpoint.engine}`,
      );

      if (res.status === 401 || res.status === 403) {
        return {
          success: false as const,
          error:
            endpoint.kind === "groq"
              ? `HTTP ${res.status} : clé refusée — vérifie GROQ_API_KEY sur console.groq.com.`
              : `HTTP ${res.status} : accès refusé par le worker faster-whisper (WHISPER_LOCAL_URL).`,
        };
      }
      if (!res.ok) {
        return {
          success: false as const,
          error: `HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`,
        };
      }
      return {
        success: true as const,
        message:
          endpoint.kind === "groq"
            ? `Groq ${endpoint.model} disponible (repli).`
            : `Worker faster-whisper ${endpoint.model} disponible (moteur principal).`,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Erreur réseau inconnue vers le moteur ASR";
      const host = (() => {
        try {
          return new URL(endpoint.url).host;
        } catch {
          return endpoint.url;
        }
      })();
      // Diagnostic de cause : un worker en localhost/127.0.0.1 est injoignable
      // dès que les fonctions Convex s'exécutent ailleurs (Convex Cloud) —
      // « localhost » y désigne le runtime Convex, pas la machine du worker.
      const loopbackHint =
        endpoint.kind === "local_whisper" &&
        /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?)(?::\d+)?$/.test(host)
          ? ` — « ${host} » est le loopback du runtime Convex : si le worker tourne sur ta machine, WHISPER_LOCAL_URL doit être une URL PUBLIQUE (tunnel/VPS) joignable depuis ce runtime.`
          : "";
      return {
        success: false as const,
        error: `${endpoint.engine} @ ${host} injoignable : ${raw}${loopbackHint}`,
      };
    }
  },
});

/**
 * A minimal valid WAV (silence, 1 s) so the Whisper run executes instead of
 * failing on a malformed upload — enough to prove auth + model access.
 */
function buildTestAudioBlob(model: string): FormData {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 s of silence
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const w = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, dataBytes, true);
  // Samples stay zero — silence.

  const formData = new FormData();
  formData.append("file", new Blob([buffer]), "test.wav");
  formData.append("model", GROQ_WHISPER_MODEL);
  formData.append("response_format", "verbose_json");
  return formData;
}


