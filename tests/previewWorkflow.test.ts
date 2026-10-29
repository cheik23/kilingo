/* Invariants du workflow P0.3.11 — lus depuis le YAML réellement versionné.

   Ces assertions empêchent une régression silencieuse : un filtre retiré,
   un secret interpolé dans un `run:`, un déploiement ajouté ou une étape
   navigateur qui pourrait réussir sans avoir tourné doivent casser ce test. */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const WORKFLOW_PATH = join(ROOT, ".github/workflows/preview-e2e.yml");
const raw = readFileSync(WORKFLOW_PATH, "utf8");

type Step = {
  name?: string;
  id?: string;
  if?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number | boolean>;
};

type Workflow = {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  jobs?: {
    preview?: {
      if?: string;
      env?: Record<string, string>;
      steps?: Step[];
    };
  };
};

const doc = Bun.YAML.parse(raw) as Workflow;
const job = doc.jobs?.preview ?? {};
const steps = job.steps ?? [];
const stepById = (id: string) => steps.find((step) => step.id === id);

describe("workflow preview-e2e", () => {
  test("se déclenche uniquement sur deployment_status", () => {
    const triggers = Object.keys(doc.on ?? {});
    expect(triggers).toEqual(["deployment_status"]);
    expect(triggers).not.toContain("pull_request");
    expect(triggers).not.toContain("pull_request_target");
    expect(triggers).not.toContain("workflow_dispatch");
  });

  test("exclut Production et exige un déploiement réussi", () => {
    const condition = String(job.if ?? "");
    expect(condition).toContain("deployment_status.state == 'success'");
    expect(condition).toContain("startsWith(github.event.deployment_status.environment, 'Preview')");
    expect(condition).toContain("deployment.environment != 'Production'");
    expect(condition).toContain("deployment_status.environment != 'Production'");
  });

  test("n'accorde que la lecture et annule les exécutions obsolètes", () => {
    expect(Object.keys(doc.permissions ?? {})).toEqual(["contents"]);
    expect(doc.permissions.contents).toBe("read");
    expect(doc.concurrency?.["cancel-in-progress"]).toBe(true);
    expect(String(doc.concurrency?.group ?? "")).toContain("deployment.sha");
  });

  test("checkout le commit déployé sans laisser de jeton Git", () => {
    const checkout = steps.find((step) => String(step.uses ?? "").startsWith("actions/checkout"));
    expect(checkout).toBeDefined();
    expect(String(checkout?.with?.ref)).toContain("github.event.deployment.sha");
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
  });

  test("prouve l'appartenance à la branche par l'historique Git", () => {
    expect(steps[0]?.uses).toContain("actions/checkout");
    expect(String(steps[1]?.run ?? "")).toContain("scripts/preview/guard-deployment.mjs");
    const branch = stepById("branch");
    expect(branch?.if).toBeUndefined();
    expect(String(branch?.run ?? "")).toContain("git merge-base --is-ancestor");
    expect(String(branch?.run ?? "")).toContain("refs/heads/${ref}");
    expect(String(branch?.run ?? "")).toContain("refs/remotes/origin/${AUTHORIZED_BRANCH}");
    expect(String(job.env?.AUTHORIZED_BRANCH)).toBe("work/p034-shadow-privacy");
    expect(String(job.env?.DEFAULT_BRANCH)).toBe("main");
    expect(String(job.env?.PREVIEW_CONVEX_URL)).toBe("https://neat-wombat-556.convex.cloud");
    // Un commit déjà sur `main` ne prouve rien sur la branche autorisée.
    expect(String(branch?.run ?? "")).toContain("refs/remotes/origin/${DEFAULT_BRANCH}");
    expect(String(branch?.run ?? "")).toContain("on_branch=false");
  });

  test("exécute les deux recettes séparément", () => {
    const api = stepById("api");
    expect(String(api?.run ?? "")).toContain("verify:preview");
    expect(String(api?.run ?? "")).toContain("--api-only");
    expect(String(api?.env?.PREVIEW_CI)).toBe("1");

    const e2e = stepById("e2e");
    expect(String(e2e?.run ?? "")).toContain("test:e2e:preview");
    expect(String(e2e?.env?.PREVIEW_E2E_BASE_URL)).toContain("steps.guard.outputs.base_url");
    expect(String(e2e?.env?.PREVIEW_E2E_JSON_OUT)).toContain("playwright.json");
    expect(String(e2e?.if)).toContain("steps.branch.outputs.on_branch == 'true'");
  });

  test("bloque explicitement sans secrets au lieu de réussir à vide", () => {
    const e2e = stepById("e2e");
    const script = String(e2e?.run ?? "");
    expect(String(e2e?.if)).toContain("steps.branch.outputs.on_branch == 'true'");
    expect(script).toMatch(/steps\.secrets\.outputs\.state/);
    expect(script).toMatch(/BLOQUÉE/);
    expect(script).toMatch(/exit 1/);
    expect(stepById("secrets")?.id).toBe("secrets");
  });

  test("ne laisse aucun secret entrer dans un script ou une URL", () => {
    for (const step of steps) {
      expect(String(step.run ?? "")).not.toMatch(/\$\{\{\s*secrets\./);
    }
    expect(raw).not.toContain("x-vercel-protection-bypass");
    expect(raw).not.toContain(".env.preview.e2e.local");
    // Les secrets ne doivent apparaître que comme valeurs d'environnement
    // (`NOM: ${{ secrets.NOM }}`), jamais dans un `run:` ni une URL.
    for (const line of raw.split(/\r?\n/)) {
      if (!/\$\{\{\s*secrets\./.test(line)) continue;
      expect(line).toMatch(/^\s*[A-Z0-9_]+:\s*\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}\s*$/);
    }
  });

  test("ne déploie rien et ne publie aucun artefact", () => {
    const runs = steps.map((step) => String(step.run ?? "")).join("\n");
    expect(runs).not.toMatch(/\bvercel\s+(deploy|--prod)/);
    expect(runs).not.toMatch(/\bconvex\s+deploy/);
    expect(runs).not.toMatch(/\bgit\s+push/);
    expect(steps.some((step) => String(step.uses ?? "").includes("upload-artifact"))).toBe(false);
  });

  test("n'utilise le contexte runner qu'au niveau des étapes", () => {
    // `runner.temp` n'existe pas dans `jobs.<id>.env` : GitHub le laisserait vide.
    const jobEnv = Object.values(job.env ?? {}).map(String);
    expect(jobEnv.some((value) => value.includes("runner.temp"))).toBe(false);
    for (const id of ["api", "e2e"]) {
      expect(String(stepById(id)?.env?.PREVIEW_RESULTS_DIR)).toContain("runner.temp");
    }
    const summary = steps.find((step) => String(step.run ?? "").includes("summary.mjs"));
    expect(String(summary?.env?.PREVIEW_RESULTS_DIR)).toContain("runner.temp");
  });

  test("écrit toujours un résumé séparé API / navigateur", () => {
    const summary = steps.find((step) => String(step.run ?? "").includes("summary.mjs"));
    expect(summary).toBeDefined();
    expect(summary?.if).toContain("always()");
    expect(String(summary?.run)).toContain("$GITHUB_STEP_SUMMARY");
  });
});
