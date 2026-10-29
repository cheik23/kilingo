#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   GARDE-FOU DU WORKFLOW P0.3.11 — avant toute requête vers la Preview.

   Entrées (posées par le workflow depuis l'événement `deployment_status`) :
     DEPLOY_STATE            état du statut de déploiement (« success » attendu)
     DEPLOY_ENVIRONMENT      environnement du statut (« Preview » attendu)
     DEPLOYMENT_ENVIRONMENT  environnement du déploiement (« Production » refusé)
     DEPLOY_URL              environment_url du statut
     DEPLOY_TARGET_URL       target_url (repli si environment_url est vide)
     DEPLOY_SHA              commit déployé (40 hex)
     AUTHORIZED_BRANCH       branche dont les Previews sont autorisées
     GITHUB_EVENT_NAME       doit valoir `deployment_status` si défini
     GITHUB_OUTPUT           fichier de sortie GitHub Actions

   Sorties : base_url (origine validée), host, sha, environment.
   Codes : 0 = cible acceptée · 2 = refusée (aucune requête émise).

   Aucun secret n'est lu ni journalisé ici.
   ═══════════════════════════════════════════════════════════════════════ */

import { appendFileSync } from "node:fs";

import {
  AUTHORIZED_BRANCH,
  PreviewTargetError,
  assertPreviewUrl,
} from "./preview-hosts.mjs";

class DeploymentGuardError extends Error {}

const env = process.env;

function fail(message) {
  console.error(`::error title=Cible Preview refusée::${message}`);
  console.error(`REFUS | ${message}`);
  process.exitCode = 2;
}

function requireValue(name) {
  const value = (env[name] ?? "").trim();
  if (!value) throw new DeploymentGuardError(`${name} absent de l'événement`);
  return value;
}

function assertPreviewEnvironment(value) {
  const trimmed = value.trim();
  // Vercel nomme l'environnement « Preview » ou « Preview – <projet> ».
  if (!/^Preview(?:\s+[–-]\s+.+)?$/.test(trimmed)) {
    throw new DeploymentGuardError(
      `environnement « ${trimmed || "(vide)"} » : seule une Preview est autorisée`,
    );
  }
}

function main() {
  const eventName = (env.GITHUB_EVENT_NAME ?? "").trim();
  if (eventName && eventName !== "deployment_status") {
    fail(`événement « ${eventName} » : ce garde-fou n'accepte que deployment_status`);
    return;
  }

  const state = requireValue("DEPLOY_STATE");
  if (state !== "success") {
    throw new DeploymentGuardError(`statut « ${state} » : seul un déploiement réussi déclenche les tests`);
  }

  assertPreviewEnvironment(requireValue("DEPLOY_ENVIRONMENT"));

  const deploymentEnvironment = (env.DEPLOYMENT_ENVIRONMENT ?? "").trim();
  if (/^Production(?:\s+[–-]\s+.+)?$/.test(deploymentEnvironment)) {
    throw new DeploymentGuardError(
      "le déploiement est marqué Production : aucune requête, aucun bypass",
    );
  }

  const rawUrl = (env.DEPLOY_URL ?? "").trim() || (env.DEPLOY_TARGET_URL ?? "").trim();
  if (!rawUrl) {
    throw new DeploymentGuardError(
      "environment_url et target_url vides : impossible de cibler ce déploiement",
    );
  }

  // L'URL d'un déploiement Preview est immuable (`kilingo-<id>-g-c35c`).
  // Le flag n'est accepté ici qu'après les contrôles d'environnement ci-dessus.
  const url = assertPreviewUrl(rawUrl, { allowDeploymentHost: true });

  const sha = requireValue("DEPLOY_SHA");
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new DeploymentGuardError(`commit déployé invalide (${sha.slice(0, 12)}…)`);
  }

  const branch = (env.AUTHORIZED_BRANCH ?? "").trim() || AUTHORIZED_BRANCH;
  const outputs = {
    base_url: url.origin,
    host: url.hostname,
    sha,
    environment: env.DEPLOY_ENVIRONMENT.trim(),
  };

  const outputFile = env.GITHUB_OUTPUT;
  if (outputFile) {
    const body = Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    appendFileSync(outputFile, `${body}\n`, "utf8");
  }

  console.log(
    `OK | ${url.origin} | environnement=${outputs.environment} | commit=${sha.slice(0, 7)} | branche=${branch}`,
  );
}

try {
  main();
} catch (error) {
  if (error instanceof PreviewTargetError || error instanceof DeploymentGuardError) {
    fail(error.message);
  } else {
    console.error(`::error title=Garde-fou en erreur::${String(error)}`);
    process.exitCode = 2;
  }
}
