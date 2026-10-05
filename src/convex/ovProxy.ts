import { httpAction } from "./_generated/server";

/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — PROXY DOCUMENTAIRE (liste blanche)

   À quoi il sert : récupérer le TEXTE de documents dont le navigateur ne
   peut pas lire la réponse directement (fetch + CORS) — djvu.txt de
   Gutenberg, textes d'Internet Archive, fichiers de sous-titres.

   À quoi il ne sert PAS : la lecture audio/vidéo. Un élément média n'a pas
   besoin de CORS pour jouer un flux, et le proxy étant limité à une liste
   blanche d'hôtes, il bloquerait podcasts, webradios et extraits officiels.
   Les lecteurs lisent donc directement la source autorisée par le Rights
   Engine (voir Players.tsx).

   Garanties conservées :
     • liste blanche d'hôtes (protection SSRF) ;
     • HTTPS obligatoire ;
     • relais de l'en-tête Range ;
     • en-têtes CORS et cache.

   Aucune clé API ne transite ici : ce endpoint ne lit que des URL publiques.
   ═══════════════════════════════════════════════════════════════════════ */

const ALLOWED_HOSTS = new Set([
  "archive.org",
  "www.archive.org",
  "ia800000.us.archive.org",
  "ia600000.us.archive.org",
  "www.gutenberg.org",
  "gutenberg.org",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "www.openverse.org",
  "audio.archive.org",
]);

/** Les sous-domaines `ia*.us.archive.org` servent les fichiers de l'IA. */
function isAllowed(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  return /^ia\d+\.us\.archive\.org$/.test(hostname);
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

function problem(status: number, error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const proxyOptions = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS });
});

export const proxy = httpAction(async (_ctx, request) => {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return problem(400, "missing_url");

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return problem(400, "invalid_url");
  }
  if (parsed.protocol !== "https:") return problem(400, "https_required");
  if (!isAllowed(parsed.hostname)) {
    return problem(403, "host_not_allowed", { host: parsed.hostname });
  }

  const range = request.headers.get("Range");
  const headOnly = request.method === "HEAD";
  const upstream = await fetch(parsed.toString(), {
    method: headOnly ? "HEAD" : "GET",
    headers: {
      "User-Agent": "OpenVerseMedia/0.1 (+https://openverse.media)",
      Accept: "*/*",
      ...(range ? { Range: range } : {}),
    },
  });

  const headers = new Headers(CORS);
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
    "etag",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");
  // Les œuvres du domaine public ne bougent pas : cache long côté navigateur.
  headers.set("Cache-Control", "public, max-age=21600");

  return new Response(headOnly ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
});
