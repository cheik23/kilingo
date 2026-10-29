import { defineConfig } from "@playwright/test";

import { PREVIEW_BASE_URL } from "./tests/e2e-preview/target";

/* Rapport JSON uniquement quand le workflow CI le demande : hors CI, aucun
   fichier n'est écrit (les artefacts peuvent contenir une session). */
const jsonOut = (process.env.PREVIEW_E2E_JSON_OUT ?? "").trim();

/* Configuration E2E dédiée à la Preview Kɪ́LINGO.
   `PREVIEW_BASE_URL` est déjà validée à l'import (tests/e2e-preview/target.ts) :
   une cible Production ou inconnue empêche la suite de démarrer.

   Aucune trace, capture ni vidéo par défaut : ces artefacts peuvent contenir
   une session. Ils ne doivent jamais finir dans Git (voir .gitignore). */
export default defineConfig({
  testDir: "./tests/e2e-preview",
  // Les specs navigateur ne s'appellent pas `*.spec.ts` : `bun test` (suite
  // unitaire du dépôt) les ramasserait et échouerait hors Playwright.
  testMatch: "**/*.e2e.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: jsonOut
    ? [
        ["list"],
        ["json", { outputFile: jsonOut }],
      ]
    : [["list"]],
  use: {
    baseURL: PREVIEW_BASE_URL.origin,
    viewport: { width: 1280, height: 900 },
    locale: "fr-FR",
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
