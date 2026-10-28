/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — SERVICE WORKER (vanilla, zéro dépendance)

   Installable + lisible hors ligne. Deux stratégies, une liste d'exclusion.

   1. NAVIGATION (documents HTML) → NETWORK-FIRST
      Le réseau d'abord : l'app est un SPA servie par index.html, et un cache
      trop agressif servirait un shell périmé. On ne retombe sur le cache
      qu'en échec réseau réel.

   2. ASSETS STATIQUES (/assets/*, hashés par Vite) → CACHE-FIRST
      Le nom du fichier contient son hash de contenu : la réponse est
      immuable, donc le cache ne peut pas être périmé. Servir depuis le
      cache est donc correct, et le premier chargement rend l'app
      instantanée hors ligne.

   3. JAMAIS DE CACHE — la liste NEVER_CACHE
      Convex, le studio Ready Player Me, les CDNs : ce sont des données
      vivantes ou des sources tierces. Les mettre en cache promettrait des
      scores périmés ou un avatar fantôme, et gonfleraient le quota pour rien.
      On les laisse toujours passer au réseau.

   Le nom du cache porte un TIMESTAMP : changer la version suffit à purger
   l'ancien cache (cf. `activate`).
   ═══════════════════════════════════════════════════════════════════════ */

/** Préfixe de tous nos caches. VERSION en dérive : impossible de faire diverger
 *  le nom du cache courant et le filtre de purge (cf. `activate`). */
const CACHE_PREFIX = "kilingo-";
const VERSION = `${CACHE_PREFIX}v1-2026-10-24`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;

/** Caches creations avant le renommage de la marque : purges une seule fois,
 *  a la premiere activation de cette version, puis plus jamais rencontres. */
const LEGACY_CACHE_PREFIXES = ["linguanoir-"];

/** Précharge la coquille applicative à l'installation : l'app démarre
 *  hors ligne même si le premier visit n'a rien pu mettre en cache. */
const PRECACHE_URLS = ["/offline.html", "/manifest.webmanifest", "/mascot.svg", "/icons/icon-192.png"];

/* ── Liste d'exclusion : jamais intercepté, jamais stocké ────────────── */

const NEVER_CACHE_HOSTS = [
  ".convex.cloud", // API Convex : scores, gems, quizzes
  ".convex.site",
  "readyplayer.me", // studio avatar 3D
  "cdn.jsdelivr.net", // librairies externes
  "huggingface.co", // modèles de traduction locaux
  "cdn-lfs.hf.co",
  "groq.com", // IA conversationnelle
  "dashscope.aliyuncs.com",
];

/** Préfixes de chemin jamais mis en cache (API + médias volumineux). */
const NEVER_CACHE_PATHS = ["/api/", "/_next/"];

/**
 * Un média (vidéo, audio) n'est pas un « asset » : le mettre en cache
 * ferait exploser le quota et bloquerait le streaming.
 */
function isMedia(url) {
  return /\.(mp4|webm|mov|m4v|mp3|m4a|wav|ogg|webm)$/i.test(url.pathname);
}

function isNeverCache(url) {
  if (url.origin === self.location.origin) {
    return NEVER_CACHE_PATHS.some((p) => url.pathname.startsWith(p));
  }
  return NEVER_CACHE_HOSTS.some((h) => url.hostname.endsWith(h));
}

/* ── Installation ────────────────────────────────────────────────────── */

/* ON NE SAUTE PAS EN ATTENTE ICI.
 *
 * Ancien comportement : `skipWaiting()` à l'installation. Un SW remplaçant
 * prenait alors le contrôle TOUT DE SUITE, purgeait les anciens caches
 * (cf. `activate`) pendant qu'un onglet ouvert exécutait encore l'ancien
 * bundle → les chunks paresseux (hash obsolète) disparaissaient du cache
 * et le serveur ne les sert plus : écran blanc pendant une mise à jour.
 *
 * Nouveau comportement : le SW remplaçant reste en ATTENTE. L'ancien SW
 * continue de servir un cache cohérent (même VERSION) indéfiniment, sans
 * blocage : l'app déployée reste disponible et le client détecte le SW en
 * attente (PwaRuntime → bandeau « nouvelle version »). L'activation ne se
 * fait que si l'utilisateur le demande (message SKIP_WAITING, cf. plus bas)
 * — auquel cas on recharge aussitôt, à la demande, jamais en pleine
 * session d'apprentissage.
 *
 * Premier install (aucun SW actif) : le navigateur active le SW directement
 * — `skipWaiting()` n'était donc jamais nécessaire à l'installation.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      // `Promise.allSettled` : si UN précharge échoue (réseau coupé au
      // premier lancement), l'installation ne doit pas être annulée — on
      // reste installable, l'app se remplira au fur et à mesure.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    })(),
  );
});

/* ── Activation : purge des anciens caches ──────────────────────────── */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              (name.startsWith(CACHE_PREFIX) ||
                LEGACY_CACHE_PREFIXES.some((p) => name.startsWith(p))) &&
              name !== ASSET_CACHE &&
              name !== PAGE_CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ── Stratégies ─────────────────────────────────────────────────────── */

/** Document HTML : réseau d'abord, cache en secours. */
async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    const cached = (await cache.match("/index.html")) || (await cache.match(request));
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}

/** Asset immuable : cache d'abord, réseau en complément. */
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // On ne stocke que les réponses valides et complètes : un 206 ou une
    // réponse opaque (cross-origin sans CORS) polluerait le cache.
    if (response && response.ok && response.status === 200 && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

/* ── Routage ────────────────────────────────────────────────────────── */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ni GET ni HEAD : ne jamais intercepter un POST (Convex mutations).
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Hors périmètre : on laisse le navigateur faire son travail.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (isNeverCache(url) || isMedia(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

/* ── Message depuis l'app (bandeau « Mettre à jour ») ─────────────────────
 *
 * SEULE porte d'activation d'un SW remplaçant. `PwaRuntime` n'envoie ce
 * message qu'après un clic explicite de l'utilisateur, puis recharge la
 * page sur `controllerchange` : la purge des anciens caches et le nouveau
 * bundle ne rencontrent jamais un onglet qui exécute l'ancien code.
 */

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
