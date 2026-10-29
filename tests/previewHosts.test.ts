/* Garde-fous de cible — P0.3.11.

   Vérifie la liste blanche partagée ET le CLI utilisé par le workflow
   (`scripts/preview/guard-deployment.mjs`), y compris son code de sortie :
   un refus doit être un code 2, jamais un succès silencieux. */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  STATIC_PREVIEW_HOSTS,
  assertPreviewBackendUrl,
  assertPreviewUrl,
  isAllowedPreviewHost,
} from "../scripts/preview/preview-hosts.mjs";

const ROOT = resolve(import.meta.dir, "..");
const GUARD = join(ROOT, "scripts/preview/guard-deployment.mjs");
const DEPLOYMENT_HOST = "kilingo-abcdefghi-g-c35c.vercel.app";

describe("liste blanche Preview", () => {
  test("accepte les hôtes figés en local", () => {
    for (const host of STATIC_PREVIEW_HOSTS) {
      expect(assertPreviewUrl(`https://${host}/app`).origin).toBe(`https://${host}`);
      expect(isAllowedPreviewHost(host)).toBe(true);
    }
  });

  test("refuse Production, y compris son URL de déploiement immuable", () => {
    expect(() => assertPreviewUrl("https://kilingo-ten.vercel.app/")).toThrow(/interdite/i);
    expect(() => assertPreviewUrl("https://kilingo.app/")).toThrow(/interdite/i);
    // Un hôte de déploiement valide reste refusé si l'appelant ne l'a pas
    // explicitement autorisé (cas local).
    expect(() => assertPreviewUrl(`https://${DEPLOYMENT_HOST}/`)).toThrow(/non autorisé/i);
    expect(isAllowedPreviewHost(DEPLOYMENT_HOST)).toBe(false);
  });

  test("accepte un hôte de déploiement seulement avec l'option CI", () => {
    const url = assertPreviewUrl(`https://${DEPLOYMENT_HOST}/app`, {
      allowDeploymentHost: true,
    });
    expect(url.origin).toBe(`https://${DEPLOYMENT_HOST}`);
  });

  test("refuse les alias d'autres branches et les hôtes inconnus", () => {
    for (const host of [
      "kilingo-git-main-g-c35c.vercel.app",
      "kilingo-git-other-branch-g-c35c.vercel.app",
      "kilingo.example.com",
      "kilingo-abcdefghi-g-c35c.vercel.app.evil.test",
      "kilingo--g-c35c.vercel.app",
    ]) {
      expect(isAllowedPreviewHost(host, { allowDeploymentHost: true })).toBe(false);
    }
  });

  test("refuse le HTTP, les identifiants et les URL illisibles", () => {
    expect(() => assertPreviewUrl(`http://${STATIC_PREVIEW_HOSTS[0]}/`)).toThrow(
      /HTTPS requis/i,
    );
    expect(() =>
      assertPreviewUrl(`https://user:pass@${STATIC_PREVIEW_HOSTS[0]}/`),
    ).toThrow(/identifiants/i);
    expect(() => assertPreviewUrl("pas une url")).toThrow(/invalide/i);
  });

  test("le backend accepté est uniquement la Preview", () => {
    expect(assertPreviewBackendUrl("https://neat-wombat-556.convex.cloud").hostname).toBe(
      "neat-wombat-556.convex.cloud",
    );
    expect(() =>
      assertPreviewBackendUrl("https://formal-vulture-518.convex.cloud"),
    ).toThrow(/interdite/i);
    expect(() => assertPreviewBackendUrl("https://impartial-pony-692.convex.cloud")).toThrow(
      /interdite/i,
    );
    expect(() => assertPreviewBackendUrl("https://autre-projet.convex.cloud")).toThrow(
      /backend inattendu/i,
    );
    expect(() => assertPreviewBackendUrl("http://neat-wombat-556.convex.cloud")).toThrow(
      /HTTPS/,
    );
  });
});

type GuardRun = { status: number; stdout: string; output: string };

function runGuard(overrides: Record<string, string>): GuardRun {
  const dir = mkdtempSync(join(tmpdir(), "kilingo-guard-"));
  const outputFile = join(dir, "output.txt");
  try {
    const result = spawnSync(process.execPath, [GUARD], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "deployment_status",
        DEPLOY_STATE: "success",
        DEPLOY_ENVIRONMENT: "Preview",
        DEPLOYMENT_ENVIRONMENT: "Preview",
        DEPLOY_URL: `https://${DEPLOYMENT_HOST}`,
        DEPLOY_TARGET_URL: `https://${DEPLOYMENT_HOST}`,
        DEPLOY_SHA: "5c6a2ad725f80a29cfb8d65fbded58c1a52b4499",
        AUTHORIZED_BRANCH: "work/p034-shadow-privacy",
        GITHUB_OUTPUT: outputFile,
        ...overrides,
      },
    });
    let output = "";
    try {
      output = readFileSync(outputFile, "utf8");
    } catch {
      /* aucun fichier : refus avant écriture */
    }
    return {
      status: result.status ?? -1,
      stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`,
      output,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("garde-fou du déploiement (CI)", () => {
  test("accepte une Preview réussie et publie l'origine validée", () => {
    const run = runGuard({});
    expect(run.status).toBe(0);
    expect(run.output).toContain(`base_url=https://${DEPLOYMENT_HOST}`);
    expect(run.output).toContain("sha=5c6a2ad725f80a29cfb8d65fbded58c1a52b4499");
    expect(run.output).toContain("environment=Preview");
  });

  test("refuse Production avant toute requête", () => {
    const run = runGuard({
      DEPLOY_ENVIRONMENT: "Production",
      DEPLOYMENT_ENVIRONMENT: "Production",
      DEPLOY_URL: "https://kilingo-ten.vercel.app",
    });
    expect(run.status).toBe(2);
    expect(run.stdout).toMatch(/Production/);
    expect(run.output).toBe("");
  });

  test("refuse l'URL de Production même étiquetée Preview", () => {
    const run = runGuard({ DEPLOY_URL: "https://kilingo-ten.vercel.app" });
    expect(run.status).toBe(2);
    expect(run.stdout).toMatch(/interdite/i);
  });

  test("refuse un hôte inconnu, le HTTP et un statut non réussi", () => {
    expect(runGuard({ DEPLOY_URL: "https://kilingo.example.com" }).status).toBe(2);
    expect(runGuard({ DEPLOY_URL: `http://${DEPLOYMENT_HOST}` }).status).toBe(2);
    expect(runGuard({ DEPLOY_STATE: "failure" }).status).toBe(2);
    expect(runGuard({ DEPLOY_SHA: "abc" }).status).toBe(2);
    expect(runGuard({ GITHUB_EVENT_NAME: "push" }).status).toBe(2);
  });
});
