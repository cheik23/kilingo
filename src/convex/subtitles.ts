import { v } from "convex/values";

/**
 * One synchronized subtitle line. Whisper supplies the original text and the
 * `start`/`end` timestamps; the translation step supplies `translatedText`.
 * `words` est présent quand le moteur ASR a fourni de VRAIS timestamps de
 * mots (faster-whisper word_timestamps=True) — jamais fabriqués côté app.
 */
export const subtitleValidator = v.object({
  id: v.number(),
  start: v.number(), // seconds
  end: v.number(), // seconds
  originalText: v.string(),
  translatedText: v.string(),
  isSlang: v.boolean(),
  words: v.optional(
    v.array(
      v.object({
        word: v.string(),
        start: v.number(),
        end: v.number(),
        probability: v.optional(v.number()),
      }),
    ),
  ),
});

/** Timestamp de mot RÉEL produit par le moteur ASR (karaoké mot par mot). */
export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
  probability?: number;
};

export type Subtitle = {
  id: number;
  start: number;
  end: number;
  originalText: string;
  translatedText: string;
  isSlang: boolean;
  context?: string;
  /** Mots horodatés par le moteur — absent si l'ASR ne les fournit pas. */
  words?: WordTimestamp[];
};

/** A slang expression detected inside the media. */
export const slangHitValidator = v.object({
  expression: v.string(),
  meaning: v.string(),
  context: v.optional(v.string()),
  subtitleIds: v.array(v.number()),
});

export type SlangHit = {
  expression: string;
  meaning: string;
  context?: string;
  subtitleIds: number[];
};

/** Array validators reused by schema and function returns. */
export const subtitleArrayValidator = v.array(subtitleValidator);
export const slangHitArrayValidator = v.array(slangHitValidator);

/**
 * Whisper `response_format: "verbose_json"` segment shape (subset we rely on).
 * `words`/`confidence` sont optionnels : portés tels quels quand le moteur
 * ASR les fournit (faster-whisper word timestamps), jamais fabriqués — le
 * contrat Shadow ne change pas.
 */
export type WhisperSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
  /** Word timestamps du moteur (quand timestamp_granularities[]="word"). */
  words?: { start?: number; end?: number; word?: string }[];
  /** Confiance optionnelle (exp(avg_logprob) pour Whisper). */
  confidence?: number;
};

type FusionInput = {
  segments: WhisperSegment[];
  translations: string[]; // one per segment, same order
  slangPhrases: string[]; // lowercase surface forms of slang to flag
};

/**
 * Fuse Whisper timestamps with per-segment translations and flag lines that
 * contain slang. The subtitle ids are the Whisper segment ids so the two
 * arrays can always be re-aligned if needed.
 */
export function fuseSubtitles({
  segments,
  translations,
  slangPhrases,
}: FusionInput): Subtitle[] {
  const phrases = slangPhrases
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);

  return segments.map((seg, i) => {
    // LOT D — une traduction ABSENTE reste vide. L'ancien repli
    // (`|| seg.text.trim()`) recopiait la source dans la colonne traduction :
    // l'utilisateur voyait « traduction = original » et croyait à un bug de
    // câblage. Vide = « pas encore traduit », un état que l'UI affiche
    // explicitement au lieu de dupliquer la ligne source.
    const translated = translations[i]?.trim() ?? "";
    const haystack = `${seg.text} ${translated}`.toLowerCase();
    const isSlang = phrases.some((p) => haystack.includes(p));
    // Word timestamps du moteur : filtrage strict (word/start/end valides,
    // end >= start) puis portage tel quel — jamais de timestamps inventés.
    const words: WordTimestamp[] | undefined = (seg.words ?? [])
      .filter(
        (w): w is { word: string; start: number; end: number } =>
          typeof w.word === "string" &&
          w.word.trim().length > 0 &&
          typeof w.start === "number" &&
          typeof w.end === "number" &&
          w.end >= w.start,
      )
      .map((w) => ({ word: w.word, start: w.start, end: w.end }));
    return {
      id: seg.id,
      start: seg.start,
      end: seg.end,
      originalText: seg.text.trim(),
      translatedText: translated,
      isSlang,
      ...(words.length > 0 ? { words } : {}),
    };
  });
}

/** Format seconds as an `m:ss` display string. */
export function formatTimestamp(seconds: number): string {
  // Clamp : un temps négatif/NaN (course de clock, seek pendant buffering)
  // ne doit jamais s'afficher « -1:-3 » — borne à 0.
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Sous-titre actif à l'instant t (karaoké). Fonction PURE partagée par
 * ShadowView (auto-scroll) et SubtitlePanel (surlignage) — remplace les deux
 * recherches inline dupliquées. undefined entre deux segments : comportement
 * attendu hors plage, pas un bug.
 */
export function activeSubtitle(
  subtitles: readonly Subtitle[],
  t: number,
): Subtitle | undefined {
  return subtitles.find((s) => t >= s.start && t < s.end);
}
