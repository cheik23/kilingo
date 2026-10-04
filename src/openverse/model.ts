import { KIND_META, RIGHTS_META, type ContentKind, type RightsStatus } from "@/convex/ovRights";
import { LANGS } from "@/convex/ovLanguages";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — MODÈLE CLIENT
   Aucune logique de droits n'est dupliquée ici : l'interface se contente
   d'afficher la décision rendue par le Rights Engine côté serveur.
   ═══════════════════════════════════════════════════════════════════════ */

export { KIND_META, RIGHTS_META, LANGS };
export type Kind = ContentKind;

export type RightsMode = "stream" | "preview" | "embed" | "external" | "blocked";

export type Decision = {
  canStream: boolean;
  canPreview: boolean;
  canEmbed: boolean;
  canHost: boolean;
  canDownload: boolean;
  canTranslate: boolean;
  canDerive: boolean;
  externalOnly: boolean;
  unknown: boolean;
  blocked: boolean;
  commercialUseAllowed: boolean;
  mode: RightsMode;
  reasons: string[];
};

export type Content = {
  _id?: string;
  key: string;
  source: string;
  externalId?: string;
  kind: Kind;
  title: string;
  creator?: string;
  year?: number;
  language?: string;
  duration?: number;
  genres?: string[];
  description?: string;
  thumbnail?: string;
  rating?: number;
  /* ── Fraîcheur & facettes ── */
  country?: string;
  releaseDate?: number;
  publishedAt?: number;
  lastUpdatedAt?: number;
  popularity?: number;
  freshness?: number;
  mediaFormat?: string;
  creatorKind?: string;
  attributionRequired?: boolean;
  territory?: string;
  expiresAt?: number;
  externalUrl: string;
  streamUrl?: string;
  previewUrl?: string;
  embedUrl?: string;
  textUrl?: string;
  /** Texte court déjà récupéré (article sous licence libre). */
  body?: string;
  rssUrl?: string;
  subtype?: string;
  attribution?: string;
  rightsStatus: RightsStatus;
  licenseCode?: string;
  licenseName?: string;
  commercialUseAllowed: boolean;
  fullStreamAllowed?: boolean;
  downloadAllowed: boolean;
  hostingAllowed: boolean;
  translationAllowed: boolean;
  derivativeWorkAllowed: boolean;
  decision?: Decision;
  decisionLabels?: string[];
  blockedReason?: string;
  searchCount?: number;
  reason?: string;
  score?: number;
};

export type Segment = { start: number; end: number; text: string };
export type TranslatedSegment = { start: number; end: number; source: string; text: string };

/** Ligne de bibliothèque (favori, historique, marque-page, playlist). */
export type LibraryRow = {
  contentKey: string;
  kind: string;
  title: string;
  creator?: string;
  thumbnail?: string;
  externalUrl: string;
  rightsStatus: string;
  hostingAllowed: boolean;
};

/**
 * La bibliothèque ne conserve qu'un instantané : on le remet au format
 * `Content` pour que les mêmes cartes et le même lecteur s'appliquent.
 */
export function fromLibraryRow(row: LibraryRow): Content {
  return {
    key: row.contentKey,
    source: "bibliothèque",
    kind: row.kind as Kind,
    title: row.title,
    creator: row.creator,
    thumbnail: row.thumbnail,
    externalUrl: row.externalUrl,
    rightsStatus: row.rightsStatus as RightsStatus,
    commercialUseAllowed: false,
    downloadAllowed: false,
    hostingAllowed: row.hostingAllowed,
    fullStreamAllowed: row.hostingAllowed,
    // Une œuvre dérivée n'est jamais plus autorisée que la lecture.
    translationAllowed: false,
    derivativeWorkAllowed: false,
  };
}

/** Décision affichable pour un document stocké (sans le champ `decision`). */
export function decisionOf(content: Content): Decision {
  if (content.decision) return content.decision;
  const canStream = Boolean(content.fullStreamAllowed || content.hostingAllowed);
  const canPreview = Boolean(content.previewUrl);
  const canEmbed = Boolean(content.embedUrl);
  const blocked = content.rightsStatus === "UNKNOWN" || content.rightsStatus === "RESTRICTED";
  const mode: RightsMode = canStream
    ? "stream"
    : canPreview
      ? "preview"
      : canEmbed
        ? "embed"
        : blocked
          ? "blocked"
          : "external";
  return {
    canStream,
    canPreview,
    canEmbed,
    canHost: Boolean(content.hostingAllowed),
    canDownload: Boolean(content.downloadAllowed),
    canTranslate: Boolean(content.translationAllowed),
    canDerive: Boolean(content.derivativeWorkAllowed),
    externalOnly: mode === "external",
    unknown: content.rightsStatus === "UNKNOWN",
    blocked,
    commercialUseAllowed: Boolean(content.commercialUseAllowed),
    mode,
    reasons: content.decisionLabels ?? [],
  };
}

/**
 * État affiché — vocabulaire 100 % interne à MOOVY (R4 : ni pastille
 * colorée, ni mention de source externe, ni jargon) :
 * « lisible ici » (flux, extrait ou lecteur intégré) ou « indisponible
 * pour le moment ».
 */
export function availability(decision: Decision): {
  dot: string;
  tone: "ok" | "warn" | "info" | "danger";
  label: string;
} {
  if (decision.canStream || decision.canPreview || decision.canEmbed || decision.canHost) {
    return { dot: "", tone: "ok", label: "Lisible dans MOOVY" };
  }
  return { dot: "", tone: "danger", label: "Indisponible pour le moment." };
}

/**
 * Explication grand public de la décision — uniquement ce que la personne
 * peut faire ici. Les motifs internes (licences, territoires) ne sortent
 * jamais côté interface.
 */
export function whyExplanation(decision: Decision): string[] {
  switch (decision.mode) {
    case "stream":
      return [
        "Tu peux regarder, écouter ou lire ce contenu directement ici.",
      ];
    case "preview":
      return [
        "Un extrait officiel est disponible ici.",
      ];
    case "embed":
      return [
        "Le lecteur est intégré : tu restes dans MOOVY.",
      ];
    default:
      return [
        "Lecture indisponible pour le moment.",
        "Cette fonctionnalité n'est pas disponible pour ce contenu.",
      ];
  }
}

/** Provenance lisible (`internet_archive` → Internet Archive). */
export function sourceLabel(source: string): string {
  return source.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const TONE_CLASS: Record<string, string> = {
  ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  danger: "border-red-400/30 bg-red-400/10 text-red-300",
};

export const KIND_TINT: Record<Kind, string> = {
  movie: "from-amber-500/25",
  series: "from-orange-500/25",
  video: "from-rose-500/25",
  music: "from-fuchsia-500/25",
  podcast: "from-emerald-500/25",
  audio: "from-teal-500/25",
  book: "from-sky-500/25",
  article: "from-cyan-500/25",
  social: "from-indigo-500/25",
  image: "from-violet-500/25",
};

/** Un contenu « large » (pochette, visuel, vidéo) vs affiche portrait. */
export function isWide(content: Content): boolean {
  return KIND_META[content.kind].wide;
}

/**
 * Date d'actualité d'un contenu, si la source en fournit une.
 * Aucune date n'est inventée : sans donnée, on renvoie `undefined`.
 */
export function dateOf(content: Content): number | undefined {
  return content.publishedAt ?? content.releaseDate ?? content.lastUpdatedAt;
}

/** « il y a 3 j », « il y a 2 mois », « 2019 » — jamais de date inventée. */
export function ageLabel(publishedAt: number | undefined): string | null {
  if (!publishedAt || !Number.isFinite(publishedAt)) return null;
  const days = Math.floor((Date.now() - publishedAt) / 86_400_000);
  if (days < 0) return "à venir";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  if (days < 31) return `il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `${Math.floor(days / 365)} an${days >= 730 ? "s" : ""}`;
}

/** Étiquette de pays lisible (drapeau + code), sans inventer de valeur. */
export function countryLabel(code: string | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const flag = upper
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
  return `${flag} ${upper}`;
}

/* ── Proxy média ────────────────────────────────────────────────────── */

const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "";

export const SITE_URL =
  (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ??
  CONVEX_URL.replace(".convex.cloud", ".convex.site");

/** Toute lecture passe par le proxy serveur (liste blanche + Range). */
export function proxied(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (!SITE_URL) return url;
  return `${SITE_URL}/ov/proxy?url=${encodeURIComponent(url)}`;
}

/* ── Formats ────────────────────────────────────────────────────────── */

export function fmtDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function langLabel(code: string | undefined): string {
  if (!code) return "—";
  const meta = LANGS.find((l) => l.code === code.slice(0, 2).toLowerCase());
  return meta ? `${meta.flag} ${meta.label}` : code.toUpperCase();
}

/* ── Sous-titres ────────────────────────────────────────────────────── */

function stamp(seconds: number, vtt: boolean): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  const rest = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s}${vtt ? "." : ","}${rest}`;
}

export function toSrt(segments: { start: number; end: number; text: string }[]): string {
  return segments
    .map((seg, i) => `${i + 1}\n${stamp(seg.start, false)} --> ${stamp(seg.end, false)}\n${seg.text.trim()}\n`)
    .join("\n");
}

export function toVtt(segments: { start: number; end: number; text: string }[]): string {
  return `WEBVTT\n\n${segments
    .map((seg, i) => `${i + 1}\n${stamp(seg.start, true)} --> ${stamp(seg.end, true)}\n${seg.text.trim()}\n`)
    .join("\n")}`;
}

export function download(filename: string, body: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Nom de fichier sûr pour un contenu. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
