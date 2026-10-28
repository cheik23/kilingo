import { envValue } from "./ovEnv";

/* ═══════════════════════════════════════════════════════════════════════
   POLITIQUE D'ADRESSE POUR LES SOURCES AUDIO (P0.2.3)

   Le backend TÉLÉCHARGE lui-même les adresses fournies par le client :
   `mediaJobs.create` → `mediaJobRun.transcribeLongAudio`,
   `mediaHub.audioSizeCheck`, `mediaHub2.transcribeRemoteAudio`. Une URL
   d'utilisateur est donc une entrée NON FIABLE qui peut viser le réseau
   interne du runtime (loopback, link-local, métadonnées cloud).

   CE QUI EST GARANTI ICI :
   • schéma `http(s)` uniquement, identifiants d'URL refusés ;
   • hôtes « locaux » refusés en mode normal : loopback, `0.0.0.0`,
     link-local, plages privées RFC 1918 et CGNAT, `*.localhost`,
     `*.internal`, noms de services de métadonnées, et résolveurs
     sauvages de type `nip.io`/`sslip.io`/`xip.io` qui encodent une IP
     dans un nom public ;
   • normalisation par le parseur WHATWG : formes IPv4 exotiques
     (`2130706433`, `0x7f.1`), point final (`localhost.`), majuscules et
     IPv4 mappée en IPv6 (`::ffff:127.0.0.1`) — toutes ramenées à une
     forme contrôlée ;
   • redirections suivies À LA MAIN (`redirect: "manual"`), chaque cible
     REVALIDÉE, nombre de sauts borné ; si le runtime n'expose pas la
     cible d'une redirection, le téléchargement est REFUSÉ (échec fermé)
     au lieu d'être poursuivi à l'aveugle ;
   • la réponse finale est recontrôlée via `Response.url` : une
     redirection suivie automatiquement vers une adresse interne est
     refusée AVANT lecture du corps.

   CE QUI N'EST PAS GARANTI (dit franchement) :
   • la résolution DNS : `fetch` résout le nom lui-même et rien n'est
     documenté côté Convex pour épingler l'IP résolue (pas de
     `node:dns`/undici custom dans le runtime V8). Un nom public qui
     résout vers une adresse privée (DNS rebinding) n'est donc PAS
     détecté ici : cette protection relève d'une politique réseau
     d'infrastructure (egress filtré) ;
   • l'atomicité du nombre de sauts si le runtime ignore `redirect` et
     suit lui-même : dans ce cas on ne voit que l'URL finale, qui est
     contrôlée, mais les sauts intermédiaires ne le sont pas ;
   • le mode développement explicite (voir ci-dessous) désactive
     volontairement les contrôles d'hôte locaux.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Interrupteur de développement : `"1"` autorise les adresses locales et
 * privées (essais locaux du dépôt, backend Docker atteignant l'hôte).
 * Lu À CHAQUE APPEL, jamais mis en cache : la valeur ne peut donc pas
 * rester active après un changement d'environnement, et un déploiement de
 * production ne doit jamais la définir.
 */
export const LOCAL_SOURCES_ENV = "KILINGO_MEDIA_ALLOW_LOCAL_SOURCES";

/** Les adresses locales/privées sont-elles explicitement autorisées ? */
export function localAudioSourcesAllowed(): boolean {
  return envValue(LOCAL_SOURCES_ENV) === "1";
}

/** Jamais des sources audio légitimes, quel que soit l'environnement. */
const METADATA_HOSTNAMES = new Set(["metadata", "metadata.google.internal", "instance-data"]);
/**
 * Résolveurs publics qui encodent une IP dans le nom (`127.0.0.1.nip.io`) :
 * un nom parfaitement public qui résout vers une adresse privée. Refusés
 * hors mode développement (où ils servent justement aux essais sur LAN).
 */
const WILDCARD_DNS_SUFFIXES = [".nip.io", ".sslip.io", ".xip.io"];

function octets(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map((part) => Number(part));
  return parts.every((part) => part <= 255) ? parts : null;
}

/** Link-local et métadonnées : refusés DANS TOUS LES CAS, même en dev. */
function isAlwaysBlocked(host: string): boolean {
  if (METADATA_HOSTNAMES.has(host)) return true;
  if (/^fe80:/i.test(host)) return true;
  const parts = octets(host);
  return parts !== null && parts[0] === 169 && parts[1] === 254;
}

/**
 * Adresses locales ou privées : refusées SAUF mode développement explicite.
 * Inclut le loopback, « toutes interfaces », les plages privées, les noms
 * `localhost` (avec ou sans point final) et `*.internal` (dont
 * `host.docker.internal`, le chemin Docker vers l'hôte).
 */
function isLocalOnly(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal")) return true;
  if (WILDCARD_DNS_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (isPrivateIpv4(host)) return true;
  if (host === "::1" || host === "::") return true;
  const parts = octets(host);
  return parts !== null && (parts[0] === 127 || parts[0] === 0);
}

/** RFC 1918 + CGNAT (100.64/10) : jamais joignables depuis un backend public. */
function isPrivateIpv4(host: string): boolean {
  const parts = octets(host);
  if (!parts) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** `true` si l'hôte est une adresse IPv4 mappée en IPv6 (`::ffff:…`). */
function mappedIpv4(host: string): string | null {
  const match = /^::ffff:(.+)$/i.exec(host);
  if (!match) return null;
  const rest = match[1];
  if (octets(rest)) return rest;
  const quads = rest.split(":");
  if (quads.length === 2 && quads.every((quad) => /^[0-9a-f]{1,4}$/i.test(quad))) {
    const [high, low] = quads.map((quad) => parseInt(quad, 16));
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return null;
}

/** Hôte réellement contrôlé : minuscules, sans point final, sans crochets. */
function normalizedHost(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
}

/**
 * Valide une adresse de source audio et rend l'URL NORMALISÉE à utiliser
 * pour la requête (même chaîne que celle réellement contactée : aucun écart
 * possible entre la validation et le téléchargement).
 */
export function assertAudioSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Lien audio invalide : adresse http(s) attendue.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Lien audio invalide : adresse http(s) attendue.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("Lien audio invalide : identifiants refusés dans l'adresse.");
  }
  const host = normalizedHost(url);
  if (host.length === 0) {
    throw new Error("Lien audio invalide : hôte manquant.");
  }
  const mapped = mappedIpv4(host);
  const candidate = mapped ?? host;

  // Refusé dans tous les cas : métadonnées d'instance, link-local, noms
  // publics qui encodent une IP (résolveurs « wildcard DNS »).
  if (isAlwaysBlocked(candidate)) {
    throw new Error(
      "Lien audio invalide : adresse interne au réseau du serveur refusée " +
        "(link-local, métadonnées ou nom de résolution automatique).",
    );
  }

  if (localAudioSourcesAllowed()) return url.toString();

  if (isLocalOnly(candidate)) {
    throw new Error(
      "Lien audio invalide : adresse locale ou privée refusée " +
        `(les essais locaux exigent ${LOCAL_SOURCES_ENV}=1).`,
    );
  }
  return url.toString();
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Nombre maximal de redirections suivies avant refus. */
export const MAX_AUDIO_REDIRECTS = 4;

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Télécharge une source audio en suivant les redirections À LA MAIN, en
 * revalidant chaque cible. Échec fermé : toute redirection dont la cible
 * n'est pas inspectable (réponse opaque, en-tête `Location` absente)
 * interrompt le téléchargement.
 *
 * `deps.fetchImpl` permet d'injecter un `fetch` de test ; en usage réel
 * c'est le `fetch` global du runtime.
 */
export async function fetchAudioSource(
  rawUrl: string,
  init: RequestInit = {},
  deps: { fetchImpl?: FetchLike } = {},
): Promise<Response> {
  const doFetch: FetchLike = deps.fetchImpl ?? ((input, options) => fetch(input, options));
  let current = assertAudioSourceUrl(rawUrl);

  for (let hop = 0; hop <= MAX_AUDIO_REDIRECTS; hop += 1) {
    const response = await doFetch(current, { ...init, redirect: "manual" });

    // Le runtime a-t-il suivi une redirection lui-même ? L'URL finale est
    // alors celle réellement contactée : elle doit passer la politique.
    const reached = typeof response.url === "string" && response.url.length > 0 ? response.url : null;
    if (reached !== null && reached !== current) {
      assertAudioSourceUrl(reached);
    }

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          "Redirection audio non vérifiable (cible absente) : téléchargement refusé.",
        );
      }
      let next: string;
      try {
        next = new URL(location, current).toString();
      } catch {
        throw new Error("Redirection audio invalide : téléchargement refusé.");
      }
      void response.body?.cancel?.().catch(() => undefined);
      current = assertAudioSourceUrl(next);
      continue;
    }

    // `status === 0` = réponse opaque : la cible d'une éventuelle
    // redirection n'est pas inspectable, donc on refuse plutôt que de
    // lire un corps dont on ne sait pas d'où il vient.
    if (response.status === 0) {
      throw new Error(
        "Réponse audio opaque (redirection non vérifiable) : téléchargement refusé.",
      );
    }
    return response;
  }

  throw new Error(`Trop de redirections pour cette adresse audio (max ${MAX_AUDIO_REDIRECTS}).`);
}
