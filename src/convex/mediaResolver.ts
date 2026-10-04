/* ═══════════════════════════════════════════════════════════════════════
   MOOVY — MEDIA URL RESOLVER (couche universelle)

   Une seule logique pour TOUTES les plateformes — plus de hacks par
   plateforme dans Shadow :

     URL
      ↓ normalizeUrl()
      ↓ detectPlatform()          → PlatformAdapter
      ↓ adapter.resolve()         → détection locale (id, embed, mode)
      ↓ métadonnées oEmbed        → endpoint OFFICIEL en liste blanche
      ↓ return MediaResolution    → contrat unique consommé par Shadow

   Garanties :
     • module 100 % PUR (aucun import Convex) → isomorphe, testable,
       importable côté navigateur comme côté backend ;
     • aucun fetch arbitraire : l'URL utilisateur ne part JAMAIS vers un
       serveur quelconque — elle n'est passée que comme paramètre `url` aux
       endpoints oEmbed officiels listés ci-dessous (protection SSRF par
       construction) ;
     • les erreurs sont EXPLICITES : une plateforme indisponible renvoie
       `mode: "UNAVAILABLE"` avec sa raison — jamais un lecteur vide ni un
       faux succès ;
     • la résolution média et le transcript restent indépendants :
       `transcriptAvailable` décrit la transcription, pas la lecture.

   Politique de lecture Shadow (qui consomme ce contrat) :
     • EMBED_ALLOWED YouTube + sous-titres → lecteur embed synchronisé ;
     • EMBED_ALLOWED TikTok → lecteur officiel tiktok.com/player/v1
       (contrôle postMessage) — sans transcription : le karaoké reste
       indisponible, la lecture est réelle ;
     • DIRECT_STREAM → média direct : orienté vers l'upload (analyse
       complète garantie) ;
     • EXTERNAL_ONLY / UNAVAILABLE → carte honnête + « Ouvrir la source ».
   ═══════════════════════════════════════════════════════════════════════ */

/** Modes de lecture normalisés (contrat unique, sans types propriétaires). */
export type MediaMode =
  | "DIRECT_STREAM"
  | "EMBED_ALLOWED"
  | "EXTRACTABLE"
  | "OPEN_LICENSE"
  | "PUBLIC_DOMAIN"
  | "CATALOG_ONLY"
  | "EXTERNAL_ONLY"
  | "UNAVAILABLE";

/** Résolution normalisée d'une URL média — le seul contrat consommé par Shadow. */
export type MediaResolution = {
  originalUrl: string;
  canonicalUrl?: string;
  platform: string;
  mediaType?: "video" | "audio" | "live" | "unknown";
  mode: MediaMode;
  playableUrl?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  duration?: number;
  transcriptAvailable?: boolean;
  subtitlesAvailable?: boolean;
  /** Pourquoi la lecture est limitée — affiché tel quel à l'utilisateur. */
  reason?: string;
};

/** Clés de plateforme reconnues (extensible : ajouter un adapter suffit). */
export type MediaPlatform =
  | "youtube"
  | "tiktok"
  | "vimeo"
  | "dailymotion"
  | "archive"
  | "soundcloud"
  | "twitch"
  | "instagram"
  | "direct"
  | "external";

export const PLATFORM_LABELS: Record<MediaPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  vimeo: "Vimeo",
  dailymotion: "Dailymotion",
  archive: "Internet Archive",
  soundcloud: "SoundCloud",
  twitch: "Twitch",
  instagram: "Instagram",
  direct: "Fichier direct",
  external: "Lien externe",
};

/**
 * Un adapter par famille de plateforme. La couche commune (normalizeUrl →
 * detectPlatform → merge oEmbed) orchestre ; l'adapter décrit sa plateforme.
 */
export interface PlatformAdapter {
  key: MediaPlatform;
  label: string;
  /** Le hostname (sans www.) est-il le nôtre ? */
  canHandle(host: string): boolean;
  /** URL canonique (nettoyage des paramètres de suivi). */
  normalize(url: URL): string;
  /** Détection locale : id, embed, mode — sans réseau. */
  resolve(url: URL): {
    id?: string;
    mediaType?: MediaResolution["mediaType"];
    mode: MediaMode;
    embedUrl?: string;
    playableUrl?: string;
    transcriptAvailable?: boolean;
    reason?: string;
  };
  /** Endpoint oEmbed OFFICIEL (liste blanche) — l'URL n'y sert que de
      paramètre, jamais de destination fetch directe (anti-SSRF). */
  oembed?(canonical: string): string;
}

// ─── YouTube ───────────────────────────────────────────────────────────

// ─── Extracteurs purs (couverts par les tests unitaires) ───────────────

/** Hôtes YouTube reconnus (`www.` retiré en amont). */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);

/** Un identifiant YouTube fait TOUJOURS 11 caractères [A-Za-z0-9_-]. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Nettoie un identifiant candidat : coupe les paramètres collés
 * (`ID?si=…`, `ID&t=42`), valide la longueur/alphabet et renvoie null
 * plutôt qu'une chaîne tronquée — un id invalide ne doit JAMAIS produire
 * un lecteur vide.
 */
function cleanYouTubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim().split(/[?&#/\s]/)[0];
  return YT_ID.test(id) ? id : null;
}

/**
 * Identifiant de vidéo YouTube — watch?v=, /shorts/, /embed/, /live/, /v/,
 * youtu.be/{id} et attribution_link?u=%2Fwatch%3Fv%3D{id} (partages de
 * l'app mobile). null pour toute autre URL (y compris hors YouTube).
 */
export function extractYouTubeVideoId(url: URL | string): string | null {
  const u = typeof url === "string" ? normalizeUrl(url) : url;
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  // 1. Formes explicites : ?v=, /shorts/, /embed/, /live/, /v/.
  const direct =
    u.searchParams.get("v") ??
    u.pathname.match(/\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1];
  const cleaned = cleanYouTubeId(direct);
  if (cleaned) return cleaned;

  // 2. youtu.be/{id}
  if (host === "youtu.be") {
    const short = cleanYouTubeId(u.pathname.replace(/^\//, "").split("/")[0]);
    if (short) return short;
  }

  // 3. attribution_link?u=%2Fwatch%3Fv%3D{id} — lien généré par les
  //    partages mobiles, dont l'id est encodé dans le paramètre `u`.
  const nested = u.searchParams.get("u");
  if (nested) {
    let inner = nested;
    try {
      inner = decodeURIComponent(nested);
    } catch {
      /* déjà décodé : on tente tel quel */
    }
    const m =
      inner.match(/[?&]v=([^&#/]+)/) ??
      inner.match(/\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    const nestedId = cleanYouTubeId(m?.[1]);
    if (nestedId) return nestedId;
  }
  return null;
}

/**
 * Identifiant de post TikTok — /@user/video/{id}, /@user/photo/{id},
 * /v/{id} et les formats d'embed officiels /player/v1/{id} et
 * /embed/v2/{id}. null pour toute autre URL (dont les liens raccourcis).
 */
export function extractTikTokPostId(url: URL | string): string | null {
  const u = typeof url === "string" ? normalizeUrl(url) : url;
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) return null;
  return (
    u.pathname.match(/\/(?:video|v|photo)\/(\d+)/)?.[1] ??
    u.pathname.match(/\/player\/v1\/(\d+)/)?.[1] ??
    u.pathname.match(/\/embed(?:\/v2)?\/(\d+)/)?.[1] ??
    null
  );
}

/**
 * Lien TikTok RACCOURCI (vm.tiktok.com, vt.tiktok.com, tiktok.com/t/{code}) :
 * l'identifiant du post n'est lisible qu'en suivant la redirection. On ne
 * suit pas de redirection arbitraire (anti-SSRF) et le fetch navigateur est
 * bloqué par CORS — on le dit explicitement au lieu d'échouer en silence.
 */
export function isTikTokShortLink(url: URL | string): boolean {
  const u = typeof url === "string" ? normalizeUrl(url) : url;
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  return (
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com" ||
    /^\/t\/[A-Za-z0-9]+/.test(u.pathname)
  );
}

const youtube: PlatformAdapter = {
  key: "youtube",
  label: PLATFORM_LABELS.youtube,
  canHandle: (h) => YOUTUBE_HOSTS.has(h),
  normalize: (u) => {
    const id = extractYouTubeVideoId(u);
    return id ? `https://www.youtube.com/watch?v=${id}` : u.toString();
  },
  resolve: (u) => {
    const id = extractYouTubeVideoId(u);
    if (!id) {
      // Raison ACTIONNABLE : dire ce que le lien est réellement plutôt que
      // « URL invalide » — l'utilisateur sait quoi recopier.
      if (u.searchParams.has("list")) {
        return {
          mode: "UNAVAILABLE",
          mediaType: "video",
          reason:
            "Lien de playlist YouTube — ouvre la vidéo à analyser et recopie son adresse (…/watch?v=…).",
        };
      }
      if (/^\/(?:@|c\/|channel\/|user\/)/.test(u.pathname)) {
        return {
          mode: "UNAVAILABLE",
          mediaType: "video",
          reason:
            "Lien de chaîne YouTube — ouvre une vidéo précise, puis recopie son adresse (…/watch?v=…).",
        };
      }
      return {
        mode: "UNAVAILABLE",
        mediaType: "video",
        reason:
          "Ce lien YouTube ne contient pas d'identifiant de vidéo — ouvre la vidéo et recopie l'adresse complète (…/watch?v=…).",
      };
    }
    return {
      id,
      mediaType: "video",
      mode: "EMBED_ALLOWED",
      embedUrl: `https://www.youtube.com/embed/${id}`,
      transcriptAvailable: true,
    };
  },
  oembed: (canonical) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`,
};

// ─── TikTok ────────────────────────────────────────────────────────────

const tiktok: PlatformAdapter = {
  key: "tiktok",
  label: PLATFORM_LABELS.tiktok,
  canHandle: (h) => h === "tiktok.com" || h.endsWith(".tiktok.com"),
  normalize: (u) => {
    const id = extractTikTokPostId(u);
    return id ? `https://www.tiktok.com/@user/video/${id}` : u.toString();
  },
  resolve: (u) => {
    // Formats acceptés : /@user/video/{id}, /@user/photo/{id}, /v/{id},
    // /player/v1/{id}, /embed/v2/{id}.
    const id = extractTikTokPostId(u);
    if (id) {
      // Lecteur OFFICIEL TikTok (developer.tiktok.com/doc/embed-player) :
      // play/pause/seekTo/mute pilotables par postMessage. Pas de
      // transcription exposée par TikTok — `transcriptAvailable` reste
      // false, indépendamment de la lisibilité du média.
      return {
        id,
        mediaType: "video",
        mode: "EMBED_ALLOWED",
        embedUrl: `https://www.tiktok.com/player/v1/${id}`,
        transcriptAvailable: false,
      };
    }
    return {
      mode: "UNAVAILABLE",
      mediaType: "video",
      reason: isTikTokShortLink(u)
        ? "Lien TikTok raccourci : il faut suivre la redirection pour connaître la vidéo. Ouvre-le, recopie l'adresse finale (tiktok.com/@compte/video/…) — ou importe les sous-titres / le fichier vidéo."
        : "Ce lien TikTok ne contient pas d'identifiant de publication — ouvre la vidéo, recopie l'adresse complète (tiktok.com/@compte/video/…) — ou importe les sous-titres / le fichier vidéo.",
    };
  },
  oembed: (canonical) =>
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`,
};

// ─── Vimeo ─────────────────────────────────────────────────────────────

const vimeo: PlatformAdapter = {
  key: "vimeo",
  label: PLATFORM_LABELS.vimeo,
  canHandle: (h) => h === "vimeo.com" || h === "player.vimeo.com",
  normalize: (u) => {
    const id = vimeo.resolve(u).id;
    return id ? `https://vimeo.com/${id}` : u.toString();
  },
  resolve: (u) => {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    if (id) {
      return {
        id,
        mediaType: "video",
        mode: "EXTERNAL_ONLY",
        embedUrl: `https://player.vimeo.com/video/${id}`,
        transcriptAvailable: false,
        reason:
          "Vimeo n'expose pas de transcription accessible — analyse complète via « Upload fichier ».",
      };
    }
    return { mode: "UNAVAILABLE", mediaType: "video", reason: "URL Vimeo sans identifiant de vidéo." };
  },
  oembed: (canonical) =>
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(canonical)}`,
};

// ─── Dailymotion ───────────────────────────────────────────────────────

const dailymotion: PlatformAdapter = {
  key: "dailymotion",
  label: PLATFORM_LABELS.dailymotion,
  canHandle: (h) => h === "dailymotion.com" || h === "dai.ly",
  normalize: (u) => {
    const id = dailymotion.resolve(u).id;
    return id ? `https://www.dailymotion.com/video/${id}` : u.toString();
  },
  resolve: (u) => {
    const id =
      u.pathname.match(/\/video\/([a-z0-9]+)/i)?.[1] ??
      (u.hostname === "dai.ly" ? u.pathname.slice(1).split("/")[0] : undefined);
    if (id) {
      // Lecteur officiel dailymotion.com/embed — lecture DANS l'app, sans
      // redirection. Pas d'API de contrôle postMessage documentée : le
      // karaoké reste honnêtement indisponible pour cette plateforme.
      return {
        id,
        mediaType: "video",
        mode: "EMBED_ALLOWED",
        embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
        transcriptAvailable: false,
        reason:
          "Dailymotion n'expose pas de transcription accessible — analyse complète via « Upload fichier ».",
      };
    }
    return { mode: "UNAVAILABLE", mediaType: "video", reason: "URL Dailymotion sans identifiant de vidéo." };
  },
  oembed: (canonical) =>
    `https://www.dailymotion.com/services/oembed?format=json&url=${encodeURIComponent(canonical)}`,
};

// ─── SoundCloud ────────────────────────────────────────────────────────

const soundcloud: PlatformAdapter = {
  key: "soundcloud",
  label: PLATFORM_LABELS.soundcloud,
  canHandle: (h) => h === "soundcloud.com" || h.endsWith(".soundcloud.com"),
  normalize: (u) => `https://soundcloud.com${u.pathname}`,
  resolve: () => ({
    mediaType: "audio",
    mode: "EXTERNAL_ONLY",
    transcriptAvailable: false,
    reason:
      "SoundCloud n'expose pas de transcription accessible — analyse complète via « Upload fichier ».",
  }),
  oembed: (canonical) =>
    `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(canonical)}`,
};

// ─── Twitch ────────────────────────────────────────────────────────────

const twitch: PlatformAdapter = {
  key: "twitch",
  label: PLATFORM_LABELS.twitch,
  canHandle: (h) => h === "twitch.tv" || h === "clips.twitch.tv",
  normalize: (u) => `https://twitch.tv${u.pathname}`,
  resolve: (u) => {
    const vod = u.pathname.match(/\/videos\/(\d+)/)?.[1];
    return {
      id: vod,
      mediaType: "video",
      mode: "EXTERNAL_ONLY",
      transcriptAvailable: false,
      reason:
        u.hostname === "clips.twitch.tv"
          ? "Les clips Twitch exigent une configuration d'embed par domaine — lecture externe uniquement."
          : "Twitch exige une configuration d'embed par domaine — lecture externe uniquement.",
    };
  },
};

// ─── Instagram (reel/p/tv — historique conservé) ───────────────────────

const instagram: PlatformAdapter = {
  key: "instagram",
  label: PLATFORM_LABELS.instagram,
  canHandle: (h) => h === "instagram.com" || h.endsWith(".instagram.com"),
  normalize: (u) => `https://www.instagram.com${u.pathname}`,
  resolve: (u) => {
    const id = u.pathname.match(/\/(?:reel|reels|p|tv)\/([^/?#]+)/)?.[1];
    return {
      id,
      mediaType: "video",
      mode: "EXTERNAL_ONLY",
      transcriptAvailable: false,
      reason:
        "Instagram exige une connexion et interdit l'accès public — lecture externe uniquement.",
    };
  },
};

// ─── Internet Archive (archive.org) ───────────────────────────────
// Domaine public / licences libres : le Rights Engine (ovRights) porte la
// décision côté connecteur ; ici on rend le fichier LISIBLE via <video>/<audio>
// natif sur archive.org/download — lecture dans l'app, sans redirection.

const archive: PlatformAdapter = {
  key: "archive",
  label: "Internet Archive",
  canHandle: (h) =>
    h === "archive.org" || h.endsWith(".archive.org"),
  normalize: (u) => u.toString(),
  resolve: (u) => {
    // /download/{identifier}[/{filename}] — identifier seul ⇒ fiche catalogue.
    const m = u.pathname.match(/^\/(?:download|details|embed)\/([^/]+)(?:\/([^/]+))?/);
    const identifier = m?.[1];
    const filename = m?.[2];
    if (!identifier) {
      return {
        mode: "UNAVAILABLE",
        mediaType: "video",
        reason: "URL archive.org sans identifiant d'élément.",
      };
    }
    const playableUrl = filename
      ? `https://archive.org/download/${identifier}/${filename}`
      : undefined;
    const isAudio = /\.(mp3|ogg|oga|m4a|wav|flac|aac|opus)$/i.test(filename ?? "");
    if (!playableUrl) {
      return {
        id: identifier,
        mediaType: "video",
        // Details page sans fichier précis : consultable, pas lisible tel quel.
        mode: "CATALOG_ONLY",
        transcriptAvailable: false,
        reason:
          "Page Archive.org sans fichier média précis — ouvre un fichier /download/… ou utilise « Upload fichier ».",
      };
    }
    return {
      id: identifier,
      mediaType: isAudio ? "audio" : "video",
      // Archive sert ses fichiers en accès direct sans auth : lecture native.
      mode: "DIRECT_STREAM",
      playableUrl,
      transcriptAvailable: false,
      reason:
        "Média Archive.org lisible ici — pour la transcription, utilise « Upload fichier ».",
    };
  },
};

// ─── Fichier média direct (.mp3, .mp4…) ────────────────────────────────

const DIRECT_MEDIA_EXT =
  /\.(mp3|mp4|m4a|m4v|webm|ogg|oga|wav|aac|opus)(?:[?#]|$)/i;

const direct: PlatformAdapter = {
  key: "direct",
  label: PLATFORM_LABELS.direct,
  canHandle: (_h) => false, // reconnu par l'extension, pas le hostname — voir detectPlatform
  normalize: (u) => u.toString(),
  resolve: (u) => {
    const ext = u.pathname.match(DIRECT_MEDIA_EXT)?.[1]?.toLowerCase();
    const isAudio = ["mp3", "m4a", "ogg", "oga", "wav", "aac", "opus"].includes(ext ?? "");
    return {
      mediaType: ext ? (isAudio ? "audio" : "video") : "unknown",
      mode: "DIRECT_STREAM",
      playableUrl: u.toString(),
      transcriptAvailable: false,
      reason:
        "Fichier média direct — utilise « Upload fichier » pour l'analyse complète (transcription + argot garantis).",
    };
  },
};

// ─── Plateformes externes génériques ───────────────────────────────────

const EXTERNAL_HOSTS = new Set([
  "facebook.com", "fb.watch",
  "twitter.com", "x.com",
  "reddit.com", "redd.it",
  "linkedin.com",
  "pinterest.com",
  "snapchat.com",
  "dailymotion.fr",
]);

const external: PlatformAdapter = {
  key: "external",
  label: PLATFORM_LABELS.external,
  canHandle: (h) => EXTERNAL_HOSTS.has(h) || h.endsWith(".facebook.com"),
  normalize: (u) => u.toString(),
  resolve: () => ({
    mediaType: "video",
    mode: "EXTERNAL_ONLY",
    transcriptAvailable: false,
    reason:
      "Plateforme fermée (connexion requise ou accès restreint) — lecture externe uniquement.",
  }),
};

// ─── Orchestration ─────────────────────────────────────────────────────

/** Adapters déclarés — l'ordre n'a pas d'importance (hostnames disjoints). */
export const PLATFORM_ADAPTERS: PlatformAdapter[] = [
  youtube,
  tiktok,
  vimeo,
  dailymotion,
  archive,
  soundcloud,
  twitch,
  instagram,
  external,
];

/**
 * Normalise une URL saisie : trim, https:// implicite, parse strict.
 * Renvoie null si l'URL est invalide.
 */
export function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Durcissement anti-SSRF : toute URL portant un schéma explicite qui
  // n'est PAS http(s) (file:, ftp:, javascript:, data:…) est rejetée
  // immédiatement — sans ce garde, « file:///etc/passwd » était re-parse
  // en pseudo-https (host « file ») au lieu d'être refusée.
  if (/^[a-z][a-z0-9+.\-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Détecte l'adapter de plateforme d'une URL. Les fichiers médias directs
 * (.mp3, .mp4…) sont reconnus par extension avant la recherche par hostname.
 */
export function detectPlatform(raw: string): { adapter: PlatformAdapter; url: URL } | null {
  const url = normalizeUrl(raw);
  if (!url) return null;
  // Adapter par HOST d'abord : archive.org/download/…/file.mp4 doit être
  // résolu par l'adapter Archive (lecture intégrée), pas happé par la
  // règle « extension » — l'extension ne qualifie que les hosts inconnus.
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const adapter = PLATFORM_ADAPTERS.find((a) => a.canHandle(host));
  if (adapter) return { adapter, url };
  if (DIRECT_MEDIA_EXT.test(url.pathname)) return { adapter: direct, url };
  return null;
}

type OEmbedResponse = {
  title?: string;
  thumbnail_url?: string;
  duration?: number;
  author_name?: string;
};

/**
 * Métadonnées oEmbed — endpoint OFFICIEL uniquement (anti-SSRF : l'URL
 * utilisateur est un paramètre de requête, jamais la destination). Un échec
 * n'invente rien : il dégrade honnêtement la résolution.
 */
async function fetchOEmbed(endpoint: string): Promise<{
  ok: boolean;
  status?: number;
  data?: OEmbedResponse;
}> {
  // AbortController + timer plutôt que AbortSignal.timeout : supporté dans
  // les deux runtimes Convex (V8 et Node), alors que AbortSignal.timeout
  // n'est pas garanti côté V8.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as OEmbedResponse };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Raison lisible selon le statut oEmbed reçu. */
function oembedFailureReason(status: number | undefined): string {
  if (status === 404 || status === 400)
    return "Vidéo introuvable — supprimée, lien invalide ou ID erroné.";
  if (status === 401 || status === 403)
    return "Vidéo privée, restreinte ou interdite d'intégration.";
  if (status === 429)
    return "Trop de demandes vers la plateforme — réessaie dans un instant.";
  return "Vérification de disponibilité impossible (réseau) — le média peut quand même être lisible.";
}

/**
 * Résout une URL média quelconque vers le contrat unique MediaResolution.
 * C'est LA porte d'entrée de Shadow pour tout lien externe — plus aucune
 * logique spécifique à une plateforme en aval.
 */
export async function resolveMedia(rawUrl: string): Promise<MediaResolution> {
  const detected = detectPlatform(rawUrl);
  if (!detected) {
    return {
      originalUrl: rawUrl,
      platform: "unknown",
      mediaType: "unknown",
      mode: "UNAVAILABLE",
      reason:
        "Lien non reconnu. Liens lus directement : YouTube, TikTok, Vimeo, Dailymotion, SoundCloud, Twitch, Instagram, Internet Archive. Sinon : importe le fichier (audio/vidéo), importe les sous-titres (.srt/.vtt) ou colle le texte à étudier.",
    };
  }

  const { adapter, url } = detected;
  const base = adapter.resolve(url);
  const canonicalUrl = adapter.normalize(url);
  const resolution: MediaResolution = {
    originalUrl: rawUrl.trim(),
    canonicalUrl,
    platform: adapter.key,
    mode: base.mode,
    mediaType: base.mediaType,
    embedUrl: base.embedUrl,
    playableUrl: base.playableUrl,
    transcriptAvailable: base.transcriptAvailable,
    reason: base.reason,
  };

  // Fichier direct : le flux joue sans métadonnées tierces.
  if (adapter.key === "direct") return resolution;

  // Métadonnées + vérification d'existence via l'endpoint officiel.
  if (adapter.oembed) {
    const ores = await fetchOEmbed(adapter.oembed(canonicalUrl));
    if (ores.ok && ores.data) {
      resolution.title = ores.data.title ?? resolution.title;
      resolution.thumbnailUrl = ores.data.thumbnail_url ?? resolution.thumbnailUrl;
      if (typeof ores.data.duration === "number" && ores.data.duration > 0) {
        resolution.duration = ores.data.duration;
      }
      // Un média vérifié 200 est lisible côté plateforme (privé/supprimé
      // répondent 401/403/404) — la raison locale de limitation reste, et
      // uniquement s'il s'agit d'une vraie limitation de LECTURE
      // (EXTERNAL_ONLY). Un média EMBED_ALLOWED est lisible ici : pas de
      // raison (l'absence de transcript est déjà portée par le champ dédié).
      if (!resolution.reason && resolution.mode !== "EMBED_ALLOWED") {
        resolution.reason =
          "Lecture intégrée indisponible — analyse complète via « Upload fichier ».";
      }
    } else if (ores.status === 404 || ores.status === 400 || ores.status === 401 || ores.status === 403) {
      // La plateforme elle-même déclare le média inaccessible : ne JAMAIS
      // présenter un lecteur pour un média mort.
      resolution.mode = "UNAVAILABLE";
      resolution.embedUrl = undefined;
      resolution.playableUrl = undefined;
      resolution.transcriptAvailable = false;
      resolution.reason = oembedFailureReason(ores.status);
    } else {
      // Réseau/429 : on garde le mode local, la raison explique le doute.
      if (!resolution.reason) resolution.reason = oembedFailureReason(ores.status);
    }
  }

  return resolution;
}
