/* ═══════════════════════════════════════════════════════════════════════
   PARSEUR DE SOUS-TITRES UNIVERSEL — SRT / VTT / texte nu (LOT C → LOT B2)

   Pur et sans dépendance : une entrée texte, une sortie segments
   {start, end, text} aux SHAPES du pipeline sous-titres existant —
   l'aval (cascade de traduction, argot, UI synchronisée) est exactement
   le même que pour les sous-titres YouTube. Aucun appel réseau.

   Limites : entrée ≤ 2 Mo (SubtitleParseError au-delà), 5 000 segments
   max (au-delà : tronqué + flag truncated).
   ═══════════════════════════════════════════════════════════════════════ */

export type ParsedSubtitleSegment = {
  start: number;
  end: number;
  text: string;
};

export type ParseSubtitlesResult = {
  segments: ParsedSubtitleSegment[];
  /** true = timestamps détectés (synchro sur l'horloge du player). */
  synced: boolean;
  /** true = au-delà de 5 000 segments, l'entrée a été tronquée. */
  truncated?: boolean;
};

export type SubtitleParseErrorReason =
  | "empty" // entrée vide
  | "too_large" // > 2 Mo
  | "no_segments"; // pas SRT, pas VTT, rien d'exploitable

export class SubtitleParseError extends Error {
  readonly reason: SubtitleParseErrorReason;
  constructor(reason: SubtitleParseErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "SubtitleParseError";
    this.reason = reason;
  }
}

const MAX_CHARS = 2_000_000; // ~2 Mo de texte
const MAX_SEGMENTS = 5_000;

/** HH:MM:SS,mmm | HH:MM:SS.mmm | MM:SS.mmm | M:SS.mmm — virgule OU point. */
const TS_PATTERN =
  /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/g;
const ARROW_PATTERN = new RegExp(
  String.raw`(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?`,
);

function toSeconds(
  h: string | undefined,
  m: string,
  s: string,
  ms: string | undefined,
): number {
  const millis = ms ? Number(ms.padEnd(3, "0")) : 0;
  return (h ? Number(h) * 3600 : 0) + Number(m) * 60 + Number(s) + millis / 1000;
}

/** Nettoie une ligne de texte de cue : tags inline, entités, espaces. */
function cleanCueText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "") // <i>, <c.line>, <v Jean>, vtt voice spans…
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&") // en dernier : &amp;lt; → &lt; (littéral)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse SRT, WebVTT ou texte nu.
 * - VTT : en-tête WEBVTT, blocs NOTE/STYLE/REGION ignorés, cue settings
 *   (line:, position:, align:) strip, MM:SS.mmm accepté.
 * - SRT : numéros de cue strip, séparateur `-->`, virgule des ms.
 * - Texte nu (aucun timestamp) : une ligne = un segment, synced: false.
 */
export function parseSubtitles(input: string): ParseSubtitlesResult {
  if (input.length > MAX_CHARS) {
    throw new SubtitleParseError("too_large");
  }
  // BOM + fins de ligne Windows.
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!text.trim()) {
    throw new SubtitleParseError("empty");
  }

  const lines = text.split("\n");
  const hasArrow = lines.some((l) => l.includes("-->"));
  if (!hasArrow) {
    // Texte nu : mode liste, pas de synchro (times factices stables).
    const raw = lines
      .map((l) => cleanCueText(l))
      .filter((l) => l.length > 0);
    if (raw.length === 0) throw new SubtitleParseError("no_segments");
    const truncated = raw.length > MAX_SEGMENTS;
    return {
      synced: false,
      ...(truncated ? { truncated: true } : {}),
      segments: raw.slice(0, MAX_SEGMENTS).map((l, i) => ({
        start: i,
        end: i + 1,
        text: l,
      })),
    };
  }

  const segments: ParsedSubtitleSegment[] = [];
  let i = 0;
  while (i < lines.length && segments.length <= MAX_SEGMENTS) {
    const line = lines[i];

    // En-têtes / blocs ignorés du VTT (NOTE, STYLE, REGION…).
    if (
      i === 0 && /^WEBVTT/i.test(line.trim())
    ) {
      i += 1;
      continue;
    }
    if (/^\s*(NOTE|STYLE|REGION)\b/i.test(line)) {
      i += 1;
      while (i < lines.length && lines[i].trim() !== "") i += 1; // jusqu'à la ligne vide
      continue;
    }

    const arrow = ARROW_PATTERN.exec(line);
    if (!arrow) {
      i += 1; // numéro de cue, ligne vide, bruit
      continue;
    }
    const start = toSeconds(arrow[1], arrow[2], arrow[3], arrow[4]);
    const end = toSeconds(arrow[5], arrow[6], arrow[7], arrow[8]);
    // Cue settings VTT éventuels après le second timestamp : sur la même
    // ligne, déjà ignorés par la regex (on ne lit que les groupes).

    i += 1;
    const cueLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      cueLines.push(lines[i]);
      i += 1;
    }
    const cleaned = cleanCueText(cueLines.join(" "));
    if (!cleaned) continue; // cue vide (musique, jingle) — on saute

    segments.push({
      start,
      // Fin manquante ou nulle : 2 s lisibles plutôt qu'un segment fantôme.
      end: end > start ? end : start + 2,
      text: cleaned,
    });
  }

  if (segments.length === 0) {
    throw new SubtitleParseError("no_segments");
  }
  const truncated = segments.length > MAX_SEGMENTS;
  return {
    synced: true,
    ...(truncated ? { truncated: true } : {}),
    segments: segments.slice(0, MAX_SEGMENTS),
  };
}
