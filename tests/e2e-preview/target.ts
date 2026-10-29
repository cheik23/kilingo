/* CIBLE E2E — un seul endroit décide quelle Preview peut être ouverte.
   Toute URL hors liste blanche (Production incluse) fait échouer la suite
   AVANT la moindre navigation.

   La liste blanche est partagée avec la recette API et le workflow CI
   (`scripts/preview/preview-hosts.mjs`) : une seule règle, trois usages. */

import { loadLocalPreviewEnv } from "../../scripts/preview/load-local-env.mjs";
import {
  FORBIDDEN_HOSTS as SHARED_FORBIDDEN_HOSTS,
  PREVIEW_CONVEX_HOST,
  PREVIEW_CONVEX_ORIGIN,
  STATIC_PREVIEW_HOSTS,
  assertPreviewUrl,
} from "../../scripts/preview/preview-hosts.mjs";

/** Fichier local ignoré par Git : jamais versionné, jamais affiché. */
loadLocalPreviewEnv();

/** Hôtes de Preview figés (déploiement de référence + alias de branche). */
export const PREVIEW_HOSTS = new Set(STATIC_PREVIEW_HOSTS);

/** Backend Convex Preview attendu. */
export { PREVIEW_CONVEX_HOST, PREVIEW_CONVEX_ORIGIN };

/** Toute requête vers ces hôtes fait échouer le test immédiatement. */
export const FORBIDDEN_HOSTS = new Set(SHARED_FORBIDDEN_HOSTS);

/**
 * Accepte l'hôte immuable du déploiement testé **uniquement** lorsque le
 * workflow l'a posé après validation de l'événement Vercel (`PREVIEW_CI=1`).
 * En local, les deux hôtes figés restent les seuls autorisés : une URL
 * arbitrary ne peut pas être substituée.
 */
const ALLOW_DEPLOYMENT_HOST = process.env.PREVIEW_CI === "1";

const DEFAULT_PREVIEW = "https://kilingo-50xuh7gpo-g-c35c.vercel.app";

/**
 * Valide une URL de Preview. Refuse tout ce qui n'est pas explicitement
 * autorisé : Production, hôte inconnu, http, identifiants dans l'URL.
 */
export function resolvePreviewTarget(raw?: string): URL {
  const candidate = (raw ?? "").trim() || DEFAULT_PREVIEW;
  return assertPreviewUrl(candidate, { allowDeploymentHost: ALLOW_DEPLOYMENT_HOST });
}

/** Cible effective de la suite (validée à l'import : échec immédiat sinon). */
export const PREVIEW_BASE_URL = resolvePreviewTarget(process.env.PREVIEW_E2E_BASE_URL);
export const PREVIEW_ORIGIN = PREVIEW_BASE_URL.origin;

/** Bypass Vercel : lu depuis l'environnement ou `.env.preview.e2e.local`. */
export const BYPASS_SECRET =
  (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim() || null;

/** Compte de test (adresse jamais journalisée en clair). */
export const TEST_EMAIL = (process.env.PREVIEW_TEST_EMAIL ?? "").trim();

export function maskedEmail(email: string): string {
  return email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}
