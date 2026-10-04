import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { translateWithGroq } from "./connectors/groqTranslate";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — MOTEURS LOCAUX D'ABORD

   Ordre de priorité imposé (aucune API payante n'est obligatoire) :

   1. moteur LOCAL et gratuit :
        WHISPER_LOCAL_URL    → whisper.cpp / faster-whisper (endpoint
                               compatible OpenAI `/v1/audio/transcriptions`)
        TRANSLATE_LOCAL_URL  → LibreTranslate auto-hébergé
   2. API gratuite dans des limites raisonnables :
        GROQ_API_KEY         → whisper-large-v3 / whisper-large-v3-turbo
                               (repli ASR) et traduction LLM (Groq d'abord
                               hors mode `preferLocal`)
        MyMemory             → traduction de secours, sans clé
   3. sinon la fonctionnalité est annoncée comme indisponible : elle
      n'est jamais remplacée en silence par un service payant.

   Traduction : chaîne unifiée Groq → serveur local → MyMemory
   (connectors/groqTranslate), partagée avec le pipeline Shadow.
   ═══════════════════════════════════════════════════════════════════════ */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const MAX_CHUNK_BYTES = 20 * 1024 * 1024; // marge sous la limite serveur de 25 Mo

type Segment = { start: number; end: number; text: string };

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function whisperEndpoint(): { url: string; key?: string; model: string; engine: string } | undefined {
  const local = env("WHISPER_LOCAL_URL");
  if (local) {
    const base = local.replace(/\/+$/, "");
    return {
      url: /\/v1\/audio\/transcriptions$/.test(base) ? base : `${base}/v1/audio/transcriptions`,
      model: env("WHISPER_MODEL") ?? "whisper-large-v3-turbo",
      engine: "local_whisper",
    };
  }
  const key = env("GROQ_API_KEY");
  if (key) {
    return {
      url: GROQ_ENDPOINT,
      key,
      model: env("WHISPER_MODEL") ?? "whisper-large-v3-turbo",
      engine: "groq_whisper",
    };
  }
  return undefined;
}

const utf8 = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** Découpe un MP3 sur les sync words pour ne jamais couper une frame. */
function splitAudio(bytes: Uint8Array, chunkBytes: number, isMp3: boolean): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    let end = Math.min(offset + chunkBytes, bytes.length);
    if (isMp3 && end < bytes.length) {
      const limit = Math.min(end + 65536, bytes.length - 1);
      for (let i = end; i < limit; i++) {
        if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
          end = i;
          break;
        }
      }
    }
    parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  return parts;
}

async function callWhisper(
  audio: Uint8Array,
  filename: string,
  mime: string,
  language: string | undefined,
  endpoint: { url: string; key?: string; model: string; engine: string },
) {
  const form = new FormData();
  form.append("file", new Blob([audio as BlobPart], { type: mime }), filename);
  form.append("model", endpoint.model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (language) form.append("language", language);

  const res = await fetch(endpoint.url, {
    method: "POST",
    headers: endpoint.key ? { Authorization: `Bearer ${endpoint.key}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${endpoint.engine} : HTTP ${res.status} — ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    text?: unknown;
    duration?: unknown;
    segments?: { start?: unknown; end?: unknown; text?: unknown }[];
  };
  const segments: Segment[] = (data.segments ?? []).map((s) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: utf8(s.text)?.trim() ?? "",
  }));
  return {
    text: utf8(data.text) ?? segments.map((s) => s.text).join(" "),
    duration: Number(data.duration) || segments[segments.length - 1]?.end || 0,
    engine: endpoint.engine,
    segments,
  };
}

/** Transcrit un média. Chunké au-delà de ~20 Mo : aucune erreur « trop long ». */
export const transcribeRemote = internalAction({
  args: {
    audioUrl: v.string(),
    language: v.optional(v.string()),
    filename: v.optional(v.string()),
    mime: v.optional(v.string()),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{
    ok: boolean;
    engine: string;
    reason?: string;
    segments: Segment[];
    text?: string;
    chunked?: number;
    warnings?: string[];
  }> => {
    const endpoint = whisperEndpoint();
    if (!endpoint) {
      return { ok: false, engine: "unavailable", reason: "no_engine", segments: [] };
    }

    const source = await fetch(args.audioUrl, {
      headers: { "User-Agent": "OpenVerseMedia/0.1 (+https://openverse.media)" },
    });
    if (!source.ok) {
      return {
        ok: false,
        engine: endpoint.engine,
        reason: `source_inaccessible (HTTP ${source.status})`,
        segments: [],
      };
    }

    const bytes = new Uint8Array(await source.arrayBuffer());
    const mime = args.mime ?? source.headers.get("content-type") ?? "audio/mpeg";
    const filename = args.filename ?? `audio.${mime.includes("mp4") ? "m4a" : "mp3"}`;

    // Cas simple : un seul appel suffit.
    if (bytes.length <= MAX_CHUNK_BYTES) {
      try {
        const out = await callWhisper(bytes, filename, mime, args.language, endpoint);
        return { ok: true, engine: out.engine, segments: out.segments, text: out.text, chunked: 1 };
      } catch (error) {
        return {
          ok: false,
          engine: endpoint.engine,
          reason: String((error as Error).message ?? error),
          segments: [],
        };
      }
    }

    // Gros fichier : découpe, transcription séquentielle, offsets cumulés.
    const isMp3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    const parts = splitAudio(bytes, MAX_CHUNK_BYTES, isMp3);
    const merged: Segment[] = [];
    const warnings: string[] = [];
    let offset = 0;

    for (let i = 0; i < parts.length; i++) {
      let done = false;
      for (let attempt = 1; attempt <= 3 && !done; attempt++) {
        try {
          const out = await callWhisper(parts[i], filename, mime, args.language, endpoint);
          for (const seg of out.segments) {
            merged.push({ start: seg.start + offset, end: seg.end + offset, text: seg.text });
          }
          offset += out.duration;
          done = true;
        } catch (error) {
          if (attempt === 3) {
            warnings.push(`tronçon ${i + 1} ignoré : ${String((error as Error).message)}`);
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          }
        }
      }
    }

    return {
      ok: merged.length > 0,
      engine: endpoint.engine,
      segments: merged.sort((a, b) => a.start - b.start),
      text: merged.map((s) => s.text).join(" "),
      chunked: parts.length,
      warnings,
    };
  },
});

/**
 * Traduit une liste de segments — cascade Groq → serveur local → MyMemory :
 *   - `preferLocal` (défaut vrai, passé par les appelants du Studio) garde le
 *     moteur local en tête, Groq prend la main dès qu'il échoue ou qu'aucun
 *     worker n'est configuré ;
 *   - `preferLocal: false` → Groq LLM d'abord (meilleur registre argot),
 *     serveur local ensuite ;
 *   - MyMemory reste le dernier recours sans clé.
 */
export const translateRemote = internalAction({
  args: {
    texts: v.array(v.string()),
    source: v.optional(v.string()),
    target: v.string(),
    preferLocal: v.optional(v.boolean()),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{ ok: boolean; engine: string; translations: string[]; reason?: string }> => {
    const local = env("TRANSLATE_LOCAL_URL");
    const preferLocal = args.preferLocal ?? true;
    const source = args.source && args.source !== "auto" ? args.source.slice(0, 2) : "en";
    const target = args.target.slice(0, 2);

    /** Groq LLM (connectors/groqTranslate) — même clé que la transcription. */
    const tryGroq = async (): Promise<{
      ok: boolean;
      engine: string;
      translations: string[];
    } | null> => {
      const groq = await translateWithGroq(args.texts, source, target, {
        env: process.env,
      });
      return groq ? { ok: true, engine: "groq_llm", translations: groq } : null;
    };

    let groqTried = false;
    if (!preferLocal) {
      groqTried = true;
      const groq = await tryGroq();
      if (groq) return groq;
    }

    if (local) {
      try {
        const res = await fetch(local.replace(/\/+$/, "") + "/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: args.texts, source, target, format: "text" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { translatedText?: unknown };
        const raw = data.translatedText;
        const list = Array.isArray(raw) ? raw.map((t) => String(t)) : [String(raw ?? "")];
        if (list.length === args.texts.length) {
          return { ok: true, engine: "libretranslate_local", translations: list };
        }
        throw new Error("réponse locale incomplète");
      } catch {
        // On bascule proprement sur l'API gratuite ci-dessous.
      }
    }

    // Groq LLM avant MyMemory : le meilleur registre de la cascade.
    if (!groqTried) {
      const groq = await tryGroq();
      if (groq) return groq;
    }

    // MyMemory : gratuit, sans clé, ~500 caractères par appel.
    const out: string[] = [];
    let batch = "";
    let indexes: number[] = [];

    const flush = async () => {
      if (!batch.trim()) return;
      const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(batch.trim().slice(0, 480))}&langpair=${source}|${target}`;
      const res = await fetch(url, { headers: { "User-Agent": "OpenVerseMedia/0.1" } });
      const data = res.ok
        ? ((await res.json()) as { responseData?: { translatedText?: unknown } })
        : undefined;
      const translated = utf8(data?.responseData?.translatedText);
      for (const index of indexes) out[index] = translated ?? args.texts[index];
      batch = "";
      indexes = [];
    };

    for (let i = 0; i < args.texts.length; i++) {
      const line = args.texts[i];
      if ((batch + " " + line).length > 420) await flush();
      batch += (batch ? "\n" : "") + line;
      indexes.push(i);
    }
    await flush();

    const filled = args.texts.map((text, i) => out[i] ?? text);
    const failed = filled.every((text, i) => text === args.texts[i]);
    return {
      ok: !failed,
      engine: "mymemory",
      translations: filled,
      reason: failed ? "Traduction indisponible (limite gratuite atteinte)." : undefined,
    };
  },
});

/** Récupère un texte source (Project Gutenberg, Internet Archive…). */
export const fetchTextRemote = internalAction({
  args: { textUrl: v.string() },
  handler: async (_ctx, args): Promise<{ ok: boolean; text: string; reason?: string }> => {
    const res = await fetch(args.textUrl, {
      headers: { "User-Agent": "OpenVerseMedia/0.1 (+https://openverse.media)" },
    });
    if (!res.ok) return { ok: false, text: "", reason: `HTTP ${res.status}` };
    const raw = await res.text();
    const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return { ok: true, text: text.slice(0, 400_000) };
  },
});
