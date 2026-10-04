/* ═══════════════════════════════════════════════════════════════════════
   LINGUA NOIR — SERVICE WORKER (vanilla, zéro dépendance)

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
      vivantes ou desqsources tierces. Les mettre en cache promettrait des
      scores périmés ou un avatar fantôme, et gonflerait le quota pour rien.
      On les laisse toujours passer au réseau.

   Le nom du cache porte un TIMESTAMP : changer la version suffit à purger
   l'ancien cache (cf. `activate`).
   ═══════════════════════════════════════════════════════════════════════ */

const VERSION = "linguanoir-v1-2026-09-26";
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;

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

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      // `Promise.allSettled` : si UN précharge échoue (réseau coupé au
      // premier lancement), l'installation ne doit pas être annulée — on
      // reste installable, l'app se remplira au fur et à mesure.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
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
          .filter((name) => name.startsWith("linguanoir-") && name !== ASSET_CACHE && name !== PAGE_CACHE)
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

/* ── Message depuis l'app (bouton « Mettre à jour ») ────────────────── */

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
