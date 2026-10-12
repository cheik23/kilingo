#!/usr/bin/env node
/**
 * Pilote de semis — le catalogue dépasse désormais la limite de lecture
 * d'UNE transaction Convex (4 096 lectures). Chaque étape est donc une
 * exécution distincte, bornée, et l'enchaînement vit ici :
 *
 *   1. `slang:seedPlan`      → les langues réellement présentes dans le seed
 *                              (source de vérité unique, aucune liste à
 *                              maintenir dans ce script) ;
 *   2. `slang:seed`          → UNE langue par appel (idempotent) ;
 *   3. `slang:recomputeAggregates` → une langue par appel (compteurs par
 *                              langue + registres + total du catalogue) ;
 *   4. `crossSeed:seedCrossConcepts` → les ponts entre langues ;
 *   5. rapport : compteurs par langue, mesurés par les agrégats.
 *
 * Usage :
 *   node scripts/seed-backend.mjs                 # backend local (.env.local)
 *   node scripts/seed-backend.mjs --prod          # production (.env.production)
 *
 * `--prod` passe `--env-file .env.production`, ET RIEN D'AUTRE n'est touché :
 * ce drapeau choisit la cible du CLI, il ne déploie pas de code (pour pousser
 * les fonctions : `npx convex deploy --env-file .env.production`).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.argv.includes("--prod");
const envFile = prod ? ".env.production" : ".env.local";

if (prod && !existsSync(path.join(projectDir, envFile))) {
  console.error(`\n${envFile} est absent : impossible de viser la production.\n`);
  process.exit(1);
}
const targetArgs = prod ? ["--env-file", envFile] : [];

/**
 * Entrée du CLI Convex, appelée via `node` (aucun shell).
 * Les arguments JSON contiennent des guillemets : sur Windows,
 * `execFileSync` avec `shell: true` passe par cmd.exe, qui ROGNE ces
 * guillemets et transforme `{"language":"de"}` en `{language:de}` — le CLI
 * reçoit alors du JSON invalide. Appeler `bin/main.js` directement préserve
 * chaque argument octet pour octet, sur les deux plateformes.
 */
const CONVEX_CLI = path.join(projectDir, "node_modules", "convex", "bin", "main.js");
if (!existsSync(CONVEX_CLI)) {
  console.error(`\nCLI Convex introuvable: ${CONVEX_CLI}\nLance d'abord l'installation des dépendances.\n`);
  process.exit(1);
}

function run(args) {
  return execFileSync(process.execPath, [CONVEX_CLI, ...args], {
    cwd: projectDir,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** `convex run <fn> '<json>' [--env-file f]` → objet de retour parsé. */
function runFn(fn, jsonArgs) {
  const out = run(["run", fn, JSON.stringify(jsonArgs), ...targetArgs]);
  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`Réponse non-JSON de ${fn} : ${out.slice(0, 400)}`);
  }
}

const label = prod ? "PRODUCTION (formal-vulture-518)" : "local";
console.log(`\n=== Semis du backend ${label} ===\n`);

// 1. Plan de semis --------------------------------------------------------
const languages = runFn("slang:seedPlan", {});
if (!Array.isArray(languages) || languages.length === 0) {
  console.error("slang:seedPlan n'a renvoyé aucune langue — seed introuvable ?");
  process.exit(1);
}
console.log(`${languages.length} langues porteuses de contenu : ${languages.join(" ")}\n`);

// 2. Semis langue par langue ---------------------------------------------
let inserted = 0;
let updated = 0;
let skipped = 0;
for (const language of languages) {
  const r = runFn("slang:seed", { language });
  inserted += r.inserted;
  updated += r.updated;
  skipped += r.skipped;
  console.log(
    `  seed ${language.padEnd(3)} ${String(r.seeded).padStart(4)} fiches ` +
      `(+${r.inserted} insérées, ${r.updated} rafraîchies, ${r.skipped} inchangées)`,
  );
}
console.log(`\nSemis : ${inserted} insérées, ${updated} rafraîchies, ${skipped} inchangées\n`);

// 3. Agrégats, langue par langue -----------------------------------------
const perLanguage = new Map();
let catalogTotal = 0;
for (const language of languages) {
  const r = runFn("slang:recomputeAggregates", { language });
  perLanguage.set(language, r.inLanguage);
  catalogTotal = r.catalogTotal;
}
console.log(`Agrégats recalculés (${perLanguage.size} langues) — catalogue : ${catalogTotal} fiches\n`);

// 4. Ponts entre langues --------------------------------------------------
runFn("crossSeed:seedCrossConcepts", {});
console.log("Ponts entre langues (crossSeed) : OK\n");

// 5. Rapport --------------------------------------------------------------
const stats = runFn("slang:stats", {});
const byLanguage = stats.byLanguage ?? {};
const rows = Object.entries(byLanguage).sort((a, b) => b[1] - a[1]);
console.log("── Expressions par langue (agrégats) ──");
for (const [code, n] of rows) console.log(`  ${code.padEnd(3)} ${String(n).padStart(5)}`);
console.log(`  ${"".padEnd(3)} ${"─".repeat(5)}`);
console.log(`  total ${String(stats.total).padStart(4)} fiches\n`);

if (stats.total !== catalogTotal) {
  console.error(
    `INCOHÉRENCE : slang:stats annonce ${stats.total} fiches, ` +
      `total:catalog en annonce ${catalogTotal}.\n`,
  );
  process.exit(1);
}

console.log("✅ Backend semé et agrégats à jour.\n");
