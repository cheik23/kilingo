/* ═══════════════════════════════════════════════════════════════════════
   LISTE BLANCHE DES CIBLES PREVIEW — source unique.

   Utilisée par :
     - scripts/verify-preview.mjs            (recette API P0.3.9)
     - tests/e2e-preview/target.ts           (recette navigateur P0.3.10)
     - scripts/preview/guard-deployment.mjs  (workflow P0.3.11)

   Règle : une URL n'est acceptée que si son hôte est explicitement connu
   (déploiement figé ou alias de branche). En CI uniquement, l'hôte
   immuable du déploiement (`kilingo-<id>-g-c35c.vercel.app`) est accepté
   quand `PREVIEW_CI=1` : le workflow ne le transmet qu'après avoir vérifié
   que l'événement Vercel est bien un déploiement **Preview** de la branche
   autorisée.

   Pourquoi ce flag : un déploiement **Production** expose lui aussi une URL
   immuable du type `kilingo-<id>-g-c35c.vercel.app` (constaté le 29/10/2026
   sur le déploiement 7169470077). L'hôte seul ne distingue donc pas une
   Preview d'une Production : c'est l'environnement de l'événement Vercel
   qui le fait, et lui seul. En local (sans `PREVIEW_CI=1`), seuls les
   hôtes figés ci-dessous sont acceptés.
   ═══════════════════════════════════════════════════════════════════════ */

/** Branche dont les Previews peuvent être testées. */
export const AUTHORIZED_BRANCH = "work/p034-shadow-privacy";

/** Hôtes de Preview figés (déploiement de référence P0.3.9 + alias de branche). */
export const STATIC_PREVIEW_HOSTS = Object.freeze([
  "kilingo-50xuh7gpo-g-c35c.vercel.app",
  "kilingo-git-work-p034-shadow-privacy-g-c35c.vercel.app",
]);

/**
 * Hôte immuable d'un déploiement du projet Kɪ́LINGO (équipe `g-c35c`).
 * Volontairement strict : identifiant sans tiret, donc les alias
 * `kilingo-git-main-…` ou `kilingo-git-<autre-branche>-…` ne passent pas.
 */
export const DEPLOYMENT_HOST_PATTERN = /^kilingo-[a-z0-9]{7,16}-g-c35c\.vercel\.app$/;

/** Backend Convex Preview attendu. */
export const PREVIEW_CONVEX_HOST = "neat-wombat-556.convex.cloud";
export const PREVIEW_CONVEX_ORIGIN = `https://${PREVIEW_CONVEX_HOST}`;

/** Production et anciens backends : refusés partout, sans exception. */
export const FORBIDDEN_HOSTS = Object.freeze([
  "kilingo-ten.vercel.app",
  "www.kilingo-ten.vercel.app",
  "kilingo.app",
  "www.kilingo.app",
  "formal-vulture-518.convex.cloud",
  "impartial-pony-692.convex.cloud",
]);

export class PreviewTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = "PreviewTargetError";
  }
}

export function isForbiddenHost(host) {
  return FORBIDDEN_HOSTS.includes(host);
}

export function isStaticPreviewHost(host) {
  return STATIC_PREVIEW_HOSTS.includes(host);
}

export function isDeploymentPreviewHost(host) {
  return DEPLOYMENT_HOST_PATTERN.test(host);
}

/**
 * Un hôte est-il autorisé ?
 * @param {string} host
 * @param {{ allowDeploymentHost?: boolean }} [options]
 */
export function isAllowedPreviewHost(host, options = {}) {
  if (!host || isForbiddenHost(host)) return false;
  if (isStaticPreviewHost(host)) return true;
  return options.allowDeploymentHost === true && isDeploymentPreviewHost(host);
}

/**
 * Valide une URL de Preview et renvoie l'objet `URL` (l'appelant utilise
 * `.origin`). Échoue fermé : protocole, identifiants, hôtes.
 * @param {string} raw
 * @param {{ allowDeploymentHost?: boolean }} [options]
 */
export function assertPreviewUrl(raw, options = {}) {
  const candidate = String(raw ?? "").trim();
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new PreviewTargetError(`URL de Preview invalide : ${candidate || "(vide)"}`);
  }
  if (url.username || url.password) {
    throw new PreviewTargetError("URL de Preview refusée : identifiants dans l'URL");
  }
  if (url.protocol !== "https:") {
    throw new PreviewTargetError("URL de Preview refusée : HTTPS requis");
  }
  if (isForbiddenHost(url.hostname)) {
    throw new PreviewTargetError(
      `URL de Preview refusée : cible interdite (${url.hostname})`,
    );
  }
  if (!isAllowedPreviewHost(url.hostname, options)) {
    const expected = options.allowDeploymentHost
      ? `${STATIC_PREVIEW_HOSTS.join(" ou ")} ou un déploiement ${DEPLOYMENT_HOST_PATTERN}`
      : STATIC_PREVIEW_HOSTS.join(" ou ");
    throw new PreviewTargetError(
      `URL de Preview refusée : hôte non autorisé (${url.hostname}) — attendu ${expected}`,
    );
  }
  return url;
}

/** Valide l'URL du backend Convex Preview (jamais un autre déploiement). */
export function assertPreviewBackendUrl(raw) {
  const candidate = String(raw ?? "").trim();
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new PreviewTargetError(`URL de backend invalide : ${candidate || "(vide)"}`);
  }
  if (url.protocol !== "https:") {
    throw new PreviewTargetError("le backend doit être en HTTPS");
  }
  if (isForbiddenHost(url.hostname)) {
    throw new PreviewTargetError(`cible interdite : ${url.hostname}`);
  }
  if (url.hostname !== PREVIEW_CONVEX_HOST) {
    throw new PreviewTargetError(
      `backend inattendu (${url.hostname}) — ${PREVIEW_CONVEX_HOST} attendu`,
    );
  }
  return url;
}
