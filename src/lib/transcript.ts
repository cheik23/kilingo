/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — COUCHE TRANSCRIPT (cœur pur, indépendante du player)

   Le transcript est DÉCOUPLÉ de la lecture : un média peut être
   lisible sans transcript (TikTok) ou transcriptable sans lecteur.
   Ce module ne connaît ni React, ni Convex, ni le réseau — il est
   testable par unit tests et réutilisable par tout provider.

   Format de segment unique pour TOUT KILINGO (karaoké, traduction,
   dictionnaire, clic-mot, sauvegarde, SRS, progression, shadowing) :

     { start, end, text, speaker?, confidence? }

   Priorité des sources (§7) :
     1. transcript natif réellement accessible
     2. captions/subtitles réellement accessibles
     3. source transcript externe légitime
     4. ASR sur une source audio légalement accessible
     5. transcript unavailable — JAMAIS de faux transcript

   Anti-patterns interdits (appliqués par TikTokTranscriptProvider) :
     scraper l'iframe TikTok, accéder au flux audio interne cross-origin,
     inventer des segments.
   ═══════════════════════════════════════════════════════════════════════ */

/** Raison honnête d'indisponibilité — affichée telle quelle à l'utilisateur. */
export type TranscriptUnavailableReason =
  | "NO_ACCESSIBLE_AUDIO" // aucun flux audio légalement accessible
  | "NO_CAPTIONS" // la plateforme n'expose pas de captions
  | "PLATFORM_RESTRICTION" // extraction interdite par la plateforme
  | "NETWORK_ERROR"
  | "UNSUPPORTED_PLATFORM"
  | "EXTRACTION_FAILED";

export type TranscriptSegment = {
  /** Identifiant optionnel (attribué par le backend dans KILINGO). */
  id?: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
};

export type TranscriptResult = {
  status: "AVAILABLE" | "UNAVAILABLE";
  segments: TranscriptSegment[];
  /** Origine du transcript — journalisée, jamais inventée. */
  source?: "native" | "captions" | "external" | "asr";
  reason?: TranscriptUnavailableReason;
  /** Message lisible si UNAVAILABLE. */
  message?: string;
};

/** Résultat UNAVAILABLE partagé — pas de transcript fantôme possible. */
export const TRANSCRIPT_UNAVAILABLE: TranscriptResult = {
  status: "UNAVAILABLE",
  segments: [],
  reason: "NO_ACCESSIBLE_AUDIO",
  message: "Aucune source de transcription accessible pour ce média.",
};

/** Contrat d'un provider (§6) — une implémentation par famille de source. */
export interface TranscriptProvider {
  readonly key: string;
  /** Ce provider sait-il traiter ce média ? (décision locale, sans réseau) */
  canProvide(media: TranscriptMediaInfo): boolean;
  /** Priorité dans le registre (plus petit = essayé d'abord). */
  readonly priority: number;
  getTranscript(media: TranscriptMediaInfo): Promise<TranscriptResult>;
}

/** Données minimales dont un provider a besoin — aucun import du resolver. */
export type TranscriptMediaInfo = {
  platform: string;
  originalUrl?: string;
  /** Id de plateforme (videoId YouTube, postId TikTok…). */
  platformId?: string;
  mediaType?: "video" | "audio" | "live" | "text" | "unknown";
  /** StorageId d'un fichier uploadé (source audio garantie → ASR possible). */
  storageId?: string;
};

// ─── Helpers purs — utilisés par les providers ET les tests ────────────

/**
 * Normalise une liste de segments : jette les entrées invalides (texte vide,
 * durée négative), trie chronologiquement, clamp les débuts négatifs et
 * borne chaque fin au début du segment suivant (fusion des chevauchements).
 */
export function normalizeSegments(
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  const cleaned = segments
    .map((s) => ({
      ...s,
      start: Math.max(0, Number(s.start) || 0),
      end: Number(s.end) || 0,
      text: (s.text ?? "").trim(),
    }))
    .filter((s) => s.text.length > 0 && s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  // Borne chaque fin au début du segment suivant (pas de chevauchement).
  return cleaned.map((s, i) => {
    const next = cleaned[i + 1];
    return next && s.end > next.start ? { ...s, end: next.start } : s;
  });
}

/**
 * Fusionne deux passes de transcript (ex. captions + ASR) : les segments de
 * `preferred` gagnent sur leur intervalle, les segments de `fallback` ne
 * restent que dans les zones non couvertes. Tri + normalisation garantis.
 */
export function mergeTranscriptSegments(
  preferred: TranscriptSegment[],
  fallback: TranscriptSegment[],
): TranscriptSegment[] {
  const keep = normalizeSegments(preferred);
  const extra = normalizeSegments(fallback).filter(
    (f) => !keep.some((k) => f.start < k.end && k.start < f.end),
  );
  return normalizeSegments([...keep, ...extra]);
}

/** Segment actif à l'instant t (karaoké) — null entre deux segments. */
export function activeSegmentAt(
  segments: TranscriptSegment[],
  t: number,
): TranscriptSegment | null {
  return (
    segments.find((s) => t >= s.start && t < s.end) ?? null
  );
}

/**
 * Cible de saut de segment (transport) : t ± marge, d'après les seuls débuts.
 * Retourne undefined quand il n'y a rien avant/après — le caller garde le
 * comportement actuel (rien ne bouge).
 */
export function findSegmentJump(
  starts: number[],
  t: number,
  dir: "prev" | "next",
): number | undefined {
  if (dir === "prev") {
    return [...starts].reverse().find((s) => s < t - 0.4);
  }
  return starts.find((s) => s > t + 0.2);
}

/** Durée de médias sans métadonnée (embed sans duration) — borne honnête. */
export function mediaDurationFromSegments(segments: TranscriptSegment[]): number {
  return segments.length === 0
    ? 0
    : Math.max(...segments.map((s) => s.end));
}

/** Statut lisible pour la UI (badge « lecteur officiel — sans transcript »). */
export function describeTranscriptStatus(result: TranscriptResult): string {
  if (result.status === "AVAILABLE") {
    switch (result.source) {
      case "native":
        return "transcription native";
      case "captions":
        return "sous-titres de la plateforme";
      case "external":
        return "source externe légitime";
      case "asr":
        return "transcription automatique (ASR)";
    }
  }
  switch (result.reason) {
    case "NO_CAPTIONS":
      return "aucun sous-titre exposé par la plateforme";
    case "NO_ACCESSIBLE_AUDIO":
      return "aucune source audio accessible pour transcrire";
    case "PLATFORM_RESTRICTION":
      return "extraction interdite par la plateforme";
    case "NETWORK_ERROR":
      return "réseau indisponible";
    case "EXTRACTION_FAILED":
      return "la transcription a échoué";
    case "UNSUPPORTED_PLATFORM":
      return "plateforme non prise en charge pour la transcription";
  }
  return "transcription indisponible";
}

// ─── Registre (ordre de priorité §7) ───────────────────────────────────

/**
 * Providers enregistrés — l'ordre du tableau est l'ordre de priorité.
 * Aujourd'hui : captions YouTube (légitime), ASR sur fichier uploadé
 * (source audio garantie — moteur configurable : faster-whisper local
 * d'abord, Groq en repli). TikTokTranscriptProvider est enregistré aussi :
 * il répond honnêtement UNAVAILABLE — la preuve par le contrat, pas par un
 * silence.
 */
const REGISTRY: TranscriptProvider[] = [];

export function registerTranscriptProvider(provider: TranscriptProvider): void {
  REGISTRY.push(provider);
  REGISTRY.sort((a, b) => a.priority - b.priority);
}

export function transcriptProviders(): readonly TranscriptProvider[] {
  return REGISTRY;
}

/**
 * Résout le transcript d'un média en essayant les providers dans l'ordre.
 * Un provider qui jette ne tue pas la chaîne : il est journalisé et le
 * suivant prend la main. Si personne ne répond : UNAVAILABLE explicite.
 *
 * Verdict explicite : le premier provider compatible qui rend un verdict
 * UNAVAILABLE motivé (raison + message) l'emporte sur la raison générique —
 * sinon « extraction interdite par la plateforme » serait écrasé par un
 * vague « aucune source audio », ce qui mentirait à l'utilisateur.
 */
export async function resolveTranscript(
  media: TranscriptMediaInfo,
): Promise<TranscriptResult> {
  let explicitVerdict: TranscriptResult | null = null;
  for (const provider of REGISTRY) {
    if (!provider.canProvide(media)) continue;
    try {
      const result = await provider.getTranscript(media);
      if (result.status === "AVAILABLE" && result.segments.length > 0) {
        return { ...result, segments: normalizeSegments(result.segments) };
      }
      if (result.reason && explicitVerdict === null) {
        explicitVerdict = result;
      }
    } catch (err) {
      console.error(
        `[transcript] provider ${provider.key} en échec :`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return explicitVerdict ?? TRANSCRIPT_UNAVAILABLE;
}
