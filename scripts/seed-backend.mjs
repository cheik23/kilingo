#!/usr/bin/env node
/**
 * Pilote de semis — le catalogue dépasse désormais la limite de lecture
 * d'UNE transaction Convex (4 096 lectures). Chaque étape est donc une
 * exécution distincte, bornée, et l'enchaînement vit ici :
 *
 *   1. `slang:seedPlan`      → les langues réellement présentes dans le seed
 *                              (source de vérité unique, aucune liste à
 *                              maintenir dans ce script) — seule étape
 *                              PUBLIQUE, en lecture seule ;
 *   2. `internal.slang.seed` → UNE langue par appel (idempotent) ;
 *   3. `internal.slang.recomputeAggregates` → une langue par appel
 *                              (compteurs par langue + registres + total du
 *                              catalogue) ;
 *   4. rapport : compteurs par langue, mesurés par les agrégats.
 *
 * Depuis P0.2, les étapes d'ÉCRITURE (2 et 3) sont des fonctions INTERNES :
 * le CLI Convex authentifié par la clé admin du déploiement sait les
 * exécuter, un client HTTP de l'application non. Le script doit donc être
 * lancé avec les identifiants d'exploitation (`.env.local` / `.env.production`),
 * exactement comme l'étape 4 des ponts culturels.
 *
 * Ponts culturels (crossConcepts) : SAUTÉS par défaut — décision produit.
 * Ils ne sont semés qu'avec l'opt-in explicite `--include-cross-concepts`,
 * qui appelle la fonction INTERNE `internal.crossSeed.seedCrossConcepts`
 * (upsert purgent scoped à la table crossConcepts uniquement). Aucune
 * mutation publique équivalente n'existe : le CLI Convex authentifié sait
 * exécuter les fonctions internes, un client de l'application non — même
 * règle que pour les étapes de semis et d'agrégats.
 *
 * Usage :
 *   node scripts/seed-backend.mjs                 # backend local (.env.local)
 *   node scripts/seed-backend.mjs --prod          # production (.env.production)
 *   [--only a,b,c]                                # restreindre les langues
 *   [--include-cross-concepts]                    # OPT-IN : semer les ponts
 *
 * `--prod` passe `--env-file .env.production`, ET RIEN D'AUTRE n'est touché :
 * ce drapeau choisit la cible du CLI, il ne déploie pas de code (pour pousser
 * les fonctions : `npx convex deploy --env-file .env.production`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
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

/* Filtrage optionnel : `--only am,th,ig` ne sème (et ne recalcule les
 * agrégats) QUE ces langues. Sans ce drapeau, comportement historique :
 * toutes les langues du plan. */
const onlyArg = process.argv.find((a) => a.startsWith("--only"));
const only =
  onlyArg && onlyArg.split("=").pop()
    ? onlyArg.split("=").pop().split(",").filter(Boolean).map((s) => s.trim())
    : null;
/* Ponts culturels : OPT-IN STRICT (`--include-cross-concepts`). Sans ce
 * drapeau, AUCUNE fonction crossSeed n'est appelée — le semis ordinaire des
 * expressions ne touche jamais la table crossConcepts. */
const includeCross = process.argv.includes("--include-cross-concepts");
const reportArg = process.argv.findIndex((a) => a.startsWith("--report"));
const reportPath =
  reportArg >= 0 && process.argv[reportArg + 1]
    ? path.resolve(process.argv[reportArg + 1])
    : null;

// 1. Plan de semis --------------------------------------------------------
const planned = runFn("slang:seedPlan", {});
if (!Array.isArray(planned) || planned.length === 0) {
  console.error("slang:seedPlan n'a renvoyé aucune langue — seed introuvable ?");
  process.exit(1);
}
const languages = only ? planned.filter((l) => only.includes(l)) : planned;
if (languages.length === 0) {
  console.error(`Aucune langue du plan ne correspond à --only ${only.join(",")} — plan réel : ${planned.join(" ")}`);
  process.exit(1);
}
console.log(
  `${languages.length}/${planned.length} langues porteuses de contenu : ${languages.join(" ")}\n`,
);

// 2. Semis langue par langue ---------------------------------------------
let inserted = 0;
let updated = 0;
let skipped = 0;
const perLanguage = [];
for (const language of languages) {
  const r = runFn("internal.slang.seed", { language });
  inserted += r.inserted;
  updated += r.updated;
  skipped += r.skipped;
  perLanguage.push({ lang: language, seeded: r.seeded, inserted: r.inserted, updated: r.updated, skipped: r.skipped });
  console.log(
    `  seed ${language.padEnd(3)} ${String(r.seeded).padStart(4)} fiches ` +
      `(+${r.inserted} insérées, ${r.updated} rafraîchies, ${r.skipped} inchangées)`,
  );
}
console.log(`\nSemis : ${inserted} insérées, ${updated} rafraîchies, ${skipped} inchangées\n`);

// 3. Agrégats, langue par langue -----------------------------------------
const aggregates = new Map();
let catalogTotal = 0;
for (const language of languages) {
  const r = runFn("internal.slang.recomputeAggregates", { language });
  aggregates.set(language, r.inLanguage);
  catalogTotal = r.catalogTotal;
}
console.log(`Agrégats recalculés (${perLanguage.size} langues) — catalogue : ${catalogTotal} fiches\n`);

// 4. Ponts entre langues — OPT-IN STRICT (--include-cross-concepts) --------
/* Sans opt-in : AUCUN appel crossSeed (décision produit). Avec opt-in, on
 * appelle la fonction INTERNE `seedCrossConcepts` : le CLI Convex
 * authentifié exécute les fonctions internes (docs.convex.dev/cli/overview),
 * tandis qu'aucune mutation publique n'expose la purge à l'application.
 * Mêmes règles upsert + purge scoped à crossConcepts que l'historique. */
let cross = null;
if (includeCross) {
  cross = runFn("internal.crossSeed.seedCrossConcepts", {});
  console.log(
    `Ponts entre langues (crossSeed) : ${cross.concepts} concepts ` +
      `(+${cross.created} créés, ${cross.updated} rafraîchis)\n`,
  );
} else {
  console.log(
    `Ponts entre langues : SAUTÉS (opt-in --include-cross-concepts pour les semer)\n`,
  );
}

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

/* Bilan JSON optionnel : `--report <chemin>` (contrôle a posteriori). */
if (reportPath) {
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        target: prod ? "production" : "local",
        at: new Date().toISOString(),
        expected: { inserted, updated, skipped },
        perLanguage,
        catalogTotal,
        statsTotal: stats.total,
        includedCrossConcepts: includeCross,
        cross,
      },
      null,
      2,
    ),
  );
  console.log(`Rapport : ${reportPath}\n`);
}

console.log("✅ Backend semé et agrégats à jour.\n");
