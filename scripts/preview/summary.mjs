#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   RÉSUMÉ GITHUB ACTIONS — P0.3.11

   Agrège les deux recettes SÉPARÉMENT et écrit un Markdown dans
   `$GITHUB_STEP_SUMMARY` (ou sur stdout hors Actions).

   Règle de comptage : un test ignoré n'est jamais compté comme réussi, et
   une étape bloquée (secrets absents) est affichée « BLOQUÉE », jamais ✅.

   Entrées : fichiers écrits par le workflow dans `$PREVIEW_RESULTS_DIR`
     api.json / api.status       reçu et code de sortie de la recette API
     playwright.json             rapport JSON Playwright
     e2e.state / e2e.status      blocked|ran + code de sortie
   Métadonnées : PREVIEW_TARGET_HOST, PREVIEW_TARGET_SHA,
                 PREVIEW_TARGET_ENV, PREVIEW_ON_BRANCH, AUTHORIZED_BRANCH.

   Aucun secret n'est lu : les scripts de recette ne les journalisent pas.
   ═══════════════════════════════════════════════════════════════════════ */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const RESULTS_DIR = process.env.PREVIEW_RESULTS_DIR || process.env.RUNNER_TEMP || tmpdir();

function readText(name) {
  const path = join(RESULTS_DIR, name);
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}

function readJson(name) {
  const text = readText(name);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseExit(name) {
  const raw = readText(name);
  if (!/^-?\d+$/.test(raw)) return null;
  return Number(raw);
}

function verdict(exitCode) {
  if (exitCode === null) return "— (non exécutée)";
  if (exitCode === 0) return "✅ réussie";
  if (exitCode === 2) return "⛔ refusée par le garde-fou";
  if (exitCode === 3) return "⏸️ bloquée";
  return "❌ échec";
}

/** Un code 0 avec des scénarios ignorés n'est pas un succès complet. */
function e2eVerdict(exitCode, counts) {
  if (exitCode === null) return "— (non exécutée)";
  if (exitCode !== 0) return verdict(exitCode);
  if (counts.expected === 0) return "⏭️ aucun test exécuté";
  if (counts.skipped > 0) return "⚠️ partielle (scénarios ignorés)";
  return "✅ réussie";
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/* ── Recette API ──────────────────────────────────────────────────── */

function apiSection() {
  const receipt = readJson("api.json");
  const exitCode = parseExit("api.status");
  if (!receipt && exitCode === null) {
    return ["### Recette API (`verify:preview --api-only`)", "", "Non exécutée.", ""];
  }

  const results = Array.isArray(receipt?.results) ? receipt.results : [];
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;

  const lines = [
    "### Recette API (`verify:preview --api-only`)",
    "",
    `- Verdict : **${verdict(exitCode)}** (code ${exitCode ?? "?"})`,
    `- Réussis : **${pass}** · Échoués : **${fail}** · Ignorés : **${skip}**`,
    "",
  ];

  if (fail > 0) {
    lines.push("| Test en échec | Détail |", "|---|---|");
    for (const row of results.filter((r) => r.status === "FAIL")) {
      lines.push(`| ${escapeCell(row.name)} | ${escapeCell(row.detail || "—").slice(0, 200)} |`);
    }
    lines.push("");
  }
  const blocked = results.filter(
    (r) => r.status === "SKIP" && /absent|indisponible|--api-only/i.test(r.detail ?? ""),
  );
  if (blocked.length > 0) {
    lines.push(
      `Tests non exécutés (ignorés, donc **non comptés comme réussis**) : ` +
        blocked.map((r) => `\`${r.name}\``).join(", "),
      "",
    );
  }
  return lines;
}

/* ── Recette navigateur ───────────────────────────────────────────── */

function walkSpecs(suite, trail, rows) {
  const path = [...trail, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? []) {
    const tests = spec.tests ?? [];
    const status = tests[0]?.status ?? (spec.ok ? "expected" : "unexpected");
    rows.push({ title: [...path, spec.title].filter(Boolean).join(" › "), status });
  }
  for (const child of suite.suites ?? []) walkSpecs(child, path, rows);
}

function e2eSection() {
  const state = readText("e2e.state");
  const exitCode = parseExit("e2e.status");
  const report = readJson("playwright.json");

  const lines = ["### Recette navigateur (`test:e2e:preview`)", ""];

  if (state === "blocked") {
    lines.push(
      "- Statut : **⏸️ BLOQUÉE — aucun test exécuté**",
      "- Cause : secrets CI absents (`VERCEL_AUTOMATION_BYPASS_SECRET`, `PREVIEW_TEST_EMAIL`,",
      "  `MAILTM_ADDRESS`/`MAILTM_PASSWORD`). Voir `docs/ci-preview-e2e.md`.",
      "- Un statut bloqué **n'est pas** un succès : le job échoue volontairement.",
      "",
    );
    return lines;
  }

  if (!report) {
    lines.push(
      `- Statut : ${exitCode === null ? "non exécutée" : verdict(exitCode)}`,
      exitCode === null ? "" : "- Aucun rapport Playwright produit.",
      "",
    );
    return lines;
  }

  const rows = [];
  for (const suite of report.suites ?? []) walkSpecs(suite, [], rows);

  const counts = { expected: 0, skipped: 0, unexpected: 0, flaky: 0 };
  for (const row of rows) {
    if (row.status in counts) counts[row.status] += 1;
    else counts.unexpected += 1;
  }

  lines.push(
    `- Verdict : **${e2eVerdict(exitCode, counts)}** (code ${exitCode ?? "?"})`,
    `- Réussis : **${counts.expected}** · Échoués : **${counts.unexpected}** · ` +
      `Ignorés : **${counts.skipped}** · Instables : **${counts.flaky}**`,
    "",
  );

  if (counts.expected === 0) {
    lines.push(
      "> Aucun test navigateur n'a réellement abouti : ce résultat ne vaut pas validation.",
      "",
    );
  }

  const notPassed = rows.filter((row) => row.status !== "expected" && row.status !== "skipped");
  if (notPassed.length > 0) {
    lines.push("| Scénario en échec | Statut |", "|---|---|");
    for (const row of notPassed) {
      lines.push(`| ${escapeCell(row.title)} | ${row.status} |`);
    }
    lines.push("");
  }

  const skipped = rows.filter((row) => row.status === "skipped");
  if (skipped.length > 0) {
    lines.push(
      "Scénarios ignorés (non comptés comme réussis) : " +
        skipped.map((row) => `\`${row.title}\``).join(", "),
      "",
    );
  }
  return lines;
}

/* ── Rapport ──────────────────────────────────────────────────────── */

function build() {
  const host = process.env.PREVIEW_TARGET_HOST || "(inconnu)";
  const sha = (process.env.PREVIEW_TARGET_SHA || "").slice(0, 7) || "(inconnu)";
  const environment = process.env.PREVIEW_TARGET_ENV || "(inconnu)";
  const onBranch = process.env.PREVIEW_ON_BRANCH === "true";
  const branch = process.env.AUTHORIZED_BRANCH || "work/p034-shadow-privacy";
  const branchReason = process.env.PREVIEW_BRANCH_REASON || "";

  const lines = [
    "## Recette Preview — Kɪ́LINGO",
    "",
    "| | |",
    "|---|---|",
    `| Hôte testé | \`${escapeCell(host)}\` |`,
    `| Environnement Vercel | ${escapeCell(environment)} |`,
    `| Commit déployé | \`${escapeCell(sha)}\` |`,
    `| Branche autorisée | \`${escapeCell(branch)}\` |`,
    "",
  ];

  if (!onBranch) {
    lines.push(
      `**Aucun test exécuté** : ${escapeCell(branchReason || "le commit déployé n'appartient pas à la branche autorisée")}.`,
      "",
      "_Aucun déploiement, commit, push ou merge n'a été effectué par ce workflow._",
      "",
    );
    return lines.join("\n");
  }

  lines.push(...apiSection(), ...e2eSection());
  lines.push(
    "---",
    "",
    "_Aucun déploiement, commit, push ou merge n'a été effectué par ce workflow._",
    "",
  );
  return lines.join("\n");
}

const markdown = build();
const target = process.env.GITHUB_STEP_SUMMARY;
if (target) {
  // `append` : le résumé peut cohabiter avec d'autres étapes.
  const { appendFileSync } = await import("node:fs");
  appendFileSync(target, `${markdown}\n`, "utf8");
  console.log("Résumé écrit dans GITHUB_STEP_SUMMARY.");
} else {
  console.log(markdown);
}
