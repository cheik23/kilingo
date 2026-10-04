import { v, type Infer } from "convex/values";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — RIGHTS ENGINE
   Décide ce que la plateforme a le droit de faire d'un contenu :
   streamer, intégrer, héberger, télécharger, traduire, dériver.

   Règle fondatrice : dans le doute, on ne fait rien de risqué.
   Un contenu dont les droits sont UNKNOWN ou RESTRICTED n'est jamais
   hébergé, téléchargé, contourné ou streamé — uniquement documenté,
   avec un lien vers la source officielle.
   ═══════════════════════════════════════════════════════════════════════ */

export const RIGHTS_STATUS = [
  "PUBLIC_DOMAIN",
  "CC_ALLOWED",
  "RIGHTS_GRANTED",
  "EMBED_ALLOWED",
  "EXTERNAL_ONLY",
  "UNKNOWN",
  "RESTRICTED",
] as const;

export const rightsStatusValidator = v.union(
  v.literal("PUBLIC_DOMAIN"),
  v.literal("CC_ALLOWED"),
  v.literal("RIGHTS_GRANTED"),
  v.literal("EMBED_ALLOWED"),
  v.literal("EXTERNAL_ONLY"),
  v.literal("UNKNOWN"),
  v.literal("RESTRICTED"),
);

export type RightsStatus = (typeof RIGHTS_STATUS)[number];

/** Libellés admin (espaces système uniquement — R4 : aucune pastille
 *  colorée ni jargon ne sort côté utilisateur). */
export const RIGHTS_META: Record<
  RightsStatus,
  { short: string; dot: string; tone: string }
> = {
  PUBLIC_DOMAIN: { short: "Domaine public", dot: "·", tone: "ok" },
  CC_ALLOWED: { short: "Catalogue libre", dot: "·", tone: "ok" },
  RIGHTS_GRANTED: { short: "Catalogue partenaire", dot: "·", tone: "ok" },
  EMBED_ALLOWED: { short: "Lecteur intégré", dot: "·", tone: "warn" },
  EXTERNAL_ONLY: { short: "Non lisible ici", dot: "·", tone: "info" },
  UNKNOWN: { short: "Non lisible ici", dot: "·", tone: "danger" },
  RESTRICTED: { short: "Non lisible ici", dot: "·", tone: "danger" },
};

/*
 * Vocabulaire de contenus.
 *
 * Volontairement large : le moteur doit pouvoir accueillir des dizaines de
 * connecteurs sans que l'on retouche le schéma à chaque fois. Un même film
 * (`movie`) et une série (`series`) ne se lisent pas de la même façon, un
 * podcast n'est pas un livre audio (`audio`), un article n'est pas un livre.
 */
export const contentKindValidator = v.union(
  v.literal("movie"),
  v.literal("series"),
  v.literal("video"),
  v.literal("music"),
  v.literal("podcast"),
  v.literal("audio"),
  v.literal("book"),
  v.literal("article"),
  v.literal("social"),
  v.literal("image"),
);

export type ContentKind = Infer<typeof contentKindValidator>;

export const KINDS: ContentKind[] = [
  "movie",
  "series",
  "video",
  "music",
  "podcast",
  "audio",
  "book",
  "article",
  "social",
  "image",
];

type KindMeta = {
  label: string;
  plural: string;
  icon: string;
  /** Route de la coquille où ce type est présenté. */
  path: string;
  /** Vignette carrée (pochettes, visuels) plutôt qu'affiche portrait. */
  wide: boolean;
};

export const KIND_META: Record<ContentKind, KindMeta> = {
  movie: { label: "Film", plural: "Films", icon: "🎬", path: "/app/screen", wide: false },
  series: { label: "Série", plural: "Séries", icon: "📺", path: "/app/screen", wide: false },
  video: { label: "Vidéo", plural: "Vidéos", icon: "▶️", path: "/app/screen", wide: true },
  music: { label: "Musique", plural: "Musiques", icon: "🎵", path: "/app/music", wide: true },
  podcast: { label: "Podcast", plural: "Podcasts", icon: "🎙️", path: "/app/talk", wide: true },
  audio: { label: "Audio", plural: "Audio", icon: "🔊", path: "/app/talk", wide: true },
  book: { label: "Livre", plural: "Livres", icon: "📚", path: "/app/books", wide: false },
  article: { label: "Article", plural: "Articles", icon: "📰", path: "/app/explore", wide: true },
  social: { label: "Social", plural: "Social", icon: "💬", path: "/app/explore", wide: true },
  image: { label: "Visuel", plural: "Visuels", icon: "🖼️", path: "/app/explore", wide: true },
};

/** Un contenu est-il visuel-large (vignette carrée) dans les grilles ? */
export function isWideKind(kind: ContentKind): boolean {
  return KIND_META[kind].wide;
}

export const segmentValidator = v.object({
  start: v.number(),
  end: v.number(),
  text: v.string(),
});

export type Segment = Infer<typeof segmentValidator>;

/* ── Catalogue de licences ──────────────────────────────────────────── */

export type LicenseFacts = {
  code: string;
  name: string;
  url: string;
  commercialUseAllowed: boolean;
  derivativeWorkAllowed: boolean;
  shareAlike: boolean;
  attributionRequired: boolean;
  translationAllowed: boolean;
  redistributionAllowed: boolean;
};

const lic = (
  code: string,
  name: string,
  url: string,
  o: Partial<Omit<LicenseFacts, "code" | "name" | "url">> = {},
): LicenseFacts => ({
  code,
  name,
  url,
  commercialUseAllowed: o.commercialUseAllowed ?? false,
  derivativeWorkAllowed: o.derivativeWorkAllowed ?? false,
  shareAlike: o.shareAlike ?? false,
  attributionRequired: o.attributionRequired ?? true,
  translationAllowed: o.translationAllowed ?? o.derivativeWorkAllowed ?? false,
  redistributionAllowed: o.redistributionAllowed ?? false,
});

export const LICENSE_CATALOG: LicenseFacts[] = [
  lic("PD", "Domaine public", "https://creativecommons.org/publicdomain/mark/1.0/", {
    commercialUseAllowed: true,
    derivativeWorkAllowed: true,
    attributionRequired: false,
    translationAllowed: true,
    redistributionAllowed: true,
  }),
  lic("CC0", "CC0 1.0 — Domaine public", "https://creativecommons.org/publicdomain/zero/1.0/", {
    commercialUseAllowed: true,
    derivativeWorkAllowed: true,
    attributionRequired: false,
    translationAllowed: true,
    redistributionAllowed: true,
  }),
  lic("CC-BY", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/", {
    commercialUseAllowed: true,
    derivativeWorkAllowed: true,
    translationAllowed: true,
    redistributionAllowed: true,
  }),
  lic("CC-BY-SA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/", {
    commercialUseAllowed: true,
    derivativeWorkAllowed: true,
    shareAlike: true,
    translationAllowed: true,
    redistributionAllowed: true,
  }),
  lic("CC-BY-NC", "CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0/", {
    derivativeWorkAllowed: true,
    translationAllowed: true,
    redistributionAllowed: false,
  }),
  lic("CC-BY-NC-SA", "CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/", {
    derivativeWorkAllowed: true,
    shareAlike: true,
    translationAllowed: true,
    redistributionAllowed: false,
  }),
  lic("CC-BY-ND", "CC BY-ND 4.0", "https://creativecommons.org/licenses/by-nd/4.0/", {
    commercialUseAllowed: true,
    derivativeWorkAllowed: false,
    translationAllowed: false,
    redistributionAllowed: true,
  }),
  lic("CC-BY-NC-ND", "CC BY-NC-ND 4.0", "https://creativecommons.org/licenses/by-nc-nd/4.0/", {
    derivativeWorkAllowed: false,
    translationAllowed: false,
    redistributionAllowed: false,
  }),
  lic(
    "BSD",
    "Licence libre type BSD / MIT",
    "https://opensource.org/licenses/MIT",
    { commercialUseAllowed: true, derivativeWorkAllowed: true, translationAllowed: true, redistributionAllowed: true },
  ),
  lic(
    "US-GOV",
    "Œuvre du gouvernement américain (public domain)",
    "https://www.usa.gov/government-copyright",
    { commercialUseAllowed: true, derivativeWorkAllowed: true, attributionRequired: false, translationAllowed: true, redistributionAllowed: true },
  ),
  lic(
    "APPLE-PREVIEW",
    "Extrait promotionnel officiel (Apple)",
    "https://www.apple.com/legal/internet-services/itunes/",
    { attributionRequired: false },
  ),
  lic(
    "OFFICIAL-PREVIEW",
    "Extrait ou aperçu officiel publié pour l'écoute publique",
    "https://developers.deezer.com/api",
    { attributionRequired: false },
  ),
  lic(
    "IA-LENDING",
    "Prêt numérique contrôlé (Internet Archive)",
    "https://help.archive.org/help/borrowing-from-the-lending-library/",
    { attributionRequired: false },
  ),
  lic(
    "PROPRIETARY",
    "Tous droits réservés",
    "https://www.wipo.int/copyright/en/",
    { attributionRequired: false },
  ),
];

export function licenseByCode(code: string | undefined | null): LicenseFacts | undefined {
  if (!code) return undefined;
  return LICENSE_CATALOG.find((l) => l.code === code);
}

/**
 * Déduit la licence depuis une URL de licence ou des conditions d'usage
 * renvoyées par un connecteur (Internet Archive, Wikimedia…).
 * Retourne `undefined` quand rien n'est exploitable → statut UNKNOWN.
 */
export function detectLicense(input: {
  licenseUrl?: string | null;
  usageTerms?: string | null;
  licenseName?: string | null;
}): LicenseFacts | undefined {
  const hay = [input.licenseUrl, input.usageTerms, input.licenseName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!hay) return undefined;

  if (/publicdomain|public domain|pd-|no known copyright|cc0|zero/.test(hay)) {
    if (/cc0|zero/.test(hay)) return licenseByCode("CC0");
    return licenseByCode("PD");
  }
  if (/by-nc-nd|by nc nd/.test(hay)) return licenseByCode("CC-BY-NC-ND");
  if (/by-nc-sa|by nc sa/.test(hay)) return licenseByCode("CC-BY-NC-SA");
  if (/by-nc|by nc|noncommercial|non-commercial/.test(hay)) return licenseByCode("CC-BY-NC");
  if (/by-nd|by nd/.test(hay)) return licenseByCode("CC-BY-ND");
  if (/by-sa|by sa|sharealike|share-alike/.test(hay)) return licenseByCode("CC-BY-SA");
  if (/creativecommons|\bcc[- ]?by\b|cc-by/.test(hay)) return licenseByCode("CC-BY");
  if (/gfdl|bsd|mit license|apache license/.test(hay)) return licenseByCode("BSD");
  if (/all rights reserved|copyright|\(c\)|©/.test(hay)) return licenseByCode("PROPRIETARY");
  return undefined;
}

/* ── Décision ───────────────────────────────────────────────────────── */

export const RIGHTS_MODES = ["stream", "preview", "embed", "external", "blocked"] as const;
export type RightsMode = (typeof RIGHTS_MODES)[number];

export const decisionValidator = v.object({
  canStream: v.boolean(),
  canPreview: v.boolean(),
  canEmbed: v.boolean(),
  canHost: v.boolean(),
  canDownload: v.boolean(),
  canTranslate: v.boolean(),
  canDerive: v.boolean(),
  externalOnly: v.boolean(),
  unknown: v.boolean(),
  blocked: v.boolean(),
  commercialUseAllowed: v.boolean(),
  /** Option de lecture retenue par le moteur. */
  mode: v.union(
    v.literal("stream"),
    v.literal("preview"),
    v.literal("embed"),
    v.literal("external"),
    v.literal("blocked"),
  ),
  reasons: v.array(v.string()),
});

export type RightsDecision = Infer<typeof decisionValidator>;

export type RightsInput = {
  rightsStatus: RightsStatus;
  license?: LicenseFacts | null;
  /** Un fichier réel existe et la licence autorise sa redistribution. */
  hostable?: boolean;
  /** La source expose un lecteur officiel intégrable (iframe / oEmbed). */
  embeddable?: boolean;
  /** La source expose un extrait promotionnel officiel. */
  previewable?: boolean;
  /**
   * Flux ou lecteur publié par l'ayant droit lui-même pour une écoute
   * publique (enclosure RSS d'un podcast, flux d'une webradio).
   * Autorise le *streaming* du flux officiel — jamais une copie, jamais un
   * hébergement, jamais un téléchargement par la plateforme.
   */
  officialFeed?: boolean;
  /** Usage commercial côté plateforme (freemium = oui). */
  commercialIntent?: boolean;
  /** Territoire d'exploitation (ISO 3166-1 alpha-2, "WORLD" par défaut). */
  territory?: string;
};

const EMPTY: Omit<RightsDecision, "mode" | "reasons"> = {
  canStream: false,
  canPreview: false,
  canEmbed: false,
  canHost: false,
  canDownload: false,
  canTranslate: false,
  canDerive: false,
  externalOnly: false,
  unknown: false,
  blocked: false,
  commercialUseAllowed: false,
};

/**
 * Cœur du Rights Engine. Fonction pure : (source, contenu, licence,
 * territoire, usage, mode) → ce que la plateforme peut faire.
 *
 * Tout ce qui n'est pas explicitement autorisé reste à `false`.
 */
export function evaluateRights(input: RightsInput): RightsDecision {
  const commercialIntent = input.commercialIntent ?? true;
  const l = input.license ?? undefined;
  const reasons: string[] = [];
  const base = { ...EMPTY };

  const finish = (
    patch: Partial<RightsDecision>,
    mode: RightsMode,
  ): RightsDecision => {
    const merged: RightsDecision = {
      ...base,
      ...patch,
      mode: "external",
      reasons,
      commercialUseAllowed: patch.commercialUseAllowed ?? false,
    };
    if (mode === "external") {
      merged.externalOnly = merged.externalOnly || patch.externalOnly === true;
    }
    if (mode === "blocked") merged.blocked = true;
    return { ...merged, mode };
  };

  switch (input.rightsStatus) {
    case "PUBLIC_DOMAIN": {
      if (l) reasons.push(`Licence : ${l.name}`);
      else reasons.push("Œuvre dans le domaine public");
      const stream = Boolean(input.hostable);
      const embed = Boolean(input.embeddable);
      return finish(
        {
          canStream: stream,
          canHost: stream,
          canDownload: stream,
          canEmbed: embed,
          canTranslate: true,
          canDerive: true,
          canPreview: Boolean(input.previewable),
          commercialUseAllowed: true,
        },
        stream ? "stream" : embed ? "embed" : "external",
      );
    }

    case "CC_ALLOWED": {
      if (!l) {
        reasons.push("Licence libre annoncée mais non identifiée → vérification manuelle requise");
        return finish({ unknown: true }, "blocked");
      }
      reasons.push(`Licence : ${l.name}`);
      if (l.attributionRequired) reasons.push("Attribution de l'auteur obligatoire");
      if (l.shareAlike) reasons.push("Partage à l'identique (ShareAlike) imposé aux dérivés");

      const commercialOk = l.commercialUseAllowed || !commercialIntent;
      if (!commercialOk) {
        reasons.push(
          "Licence non commerciale : incompatible avec l'exploitation commerciale de la plateforme",
        );
        return finish({ blocked: true, canTranslate: false, canDerive: false }, "blocked");
      }

      const stream = Boolean(input.hostable) && l.redistributionAllowed;
      if (input.hostable && !l.redistributionAllowed) {
        reasons.push("La licence n'autorise pas la redistribution du fichier");
      }
      const embed = Boolean(input.embeddable);
      return finish(
        {
          canStream: stream,
          canHost: stream,
          canDownload: stream,
          canEmbed: embed,
          canPreview: Boolean(input.previewable),
          canTranslate: l.translationAllowed,
          canDerive: l.derivativeWorkAllowed,
          commercialUseAllowed: true,
        },
        stream ? "stream" : embed ? "embed" : "external",
      );
    }

    case "RIGHTS_GRANTED": {
      reasons.push("Droits explicitement accordés par le titulaire");
      if (input.territory && input.territory !== "WORLD") {
        reasons.push(`Droits limités au territoire : ${input.territory}`);
      }
      const stream = Boolean(input.hostable);
      const embed = Boolean(input.embeddable);
      return finish(
        {
          canStream: stream,
          canHost: stream,
          canDownload: stream,
          canEmbed: embed,
          canPreview: Boolean(input.previewable) || stream || embed,
          canTranslate: true,
          canDerive: true,
          commercialUseAllowed: true,
        },
        stream ? "stream" : embed ? "embed" : "external",
      );
    }

    case "EMBED_ALLOWED": {
      reasons.push("La source autorise l'intégration de son lecteur officiel");
      reasons.push("Aucun fichier n'est copié ni hébergé par la plateforme");
      const feed = Boolean(input.officialFeed);
      if (feed) {
        reasons.push(
          "Flux publié par l'éditeur pour une écoute publique : lecture en streaming depuis sa source, sans copie ni hébergement",
        );
      }
      return finish(
        {
          canEmbed: Boolean(input.embeddable),
          canPreview: Boolean(input.previewable),
          canStream: feed,
          externalOnly: !input.embeddable && !input.previewable && !feed,
        },
        feed
          ? "stream"
          : input.previewable
            ? "preview"
            : input.embeddable
              ? "embed"
              : "external",
      );
    }

    case "EXTERNAL_ONLY": {
      reasons.push("Consultation possible uniquement sur la source officielle");
      return finish({ externalOnly: true }, "external");
    }

    case "RESTRICTED": {
      reasons.push("Contenu protégé par le droit d'auteur ou par un DRM");
      reasons.push("La plateforme ne copie, n'héberge ni ne contourne ce contenu");
      return finish({ blocked: true }, "blocked");
    }

    case "UNKNOWN":
    default: {
      reasons.push("Aucune information fiable sur la licence");
      reasons.push("Opérations bloquées jusqu'à vérification humaine des droits");
      return finish({ unknown: true, blocked: true, externalOnly: true }, "blocked");
    }
  }
}

/** Étiquette affichée (les 4 pastilles demandées). */
/** Étiquette interne (administration uniquement — jamais affichée dans
 *  l'expérience utilisateur : R4 zéro jargon, zéro pastille). */
export function badgeFor(decision: RightsDecision): {
  dot: string;
  tone: "ok" | "warn" | "info" | "danger";
  label: string;
} {
  if (decision.canStream || decision.canHost || decision.canPreview || decision.canEmbed) {
    return { dot: "·", tone: "ok", label: "Lisible dans l'app" };
  }
  return { dot: "·", tone: "danger", label: "Indisponible pour le moment." };
}

/** Le contenu peut-il faire l'objet d'une transcription / traduction ? */
export function studioAllowed(decision: RightsDecision): boolean {
  return decision.canDerive || decision.canTranslate;
}

/** Vérifie qu'un mode de lecture est autorisé avant d'ouvrir un lecteur. */
export function assertModeAllowed(decision: RightsDecision, mode: RightsMode): void {
  const allowed =
    (mode === "stream" && decision.canStream) ||
    (mode === "preview" && decision.canPreview) ||
    (mode === "embed" && decision.canEmbed) ||
    (mode === "external" && true);
  if (!allowed) {
    throw new Error(
      "Lecture refusée par le Rights Engine : cette source ne l'autorise pas.",
    );
  }
}

/** Statut déduit d'un fichier trouvé dans une source ouverte. */
export function statusFromLicense(
  facts: LicenseFacts | undefined,
  opts: { gutenberg?: boolean; lending?: boolean } = {},
): RightsStatus {
  if (opts.lending) return "EXTERNAL_ONLY";
  if (opts.gutenberg) return "PUBLIC_DOMAIN";
  if (!facts) return "UNKNOWN";
  if (facts.code === "PD" || facts.code === "CC0" || facts.code === "US-GOV") {
    return "PUBLIC_DOMAIN";
  }
  if (facts.code === "PROPRIETARY") return "RESTRICTED";
  if (facts.code === "APPLE-PREVIEW" || facts.code === "OFFICIAL-PREVIEW") return "EMBED_ALLOWED";
  if (facts.code === "IA-LENDING") return "EXTERNAL_ONLY";
  return "CC_ALLOWED";
}
