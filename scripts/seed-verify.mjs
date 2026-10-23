#!/usr/bin/env node
/**
 * Vérification APRÈS semis — relit la base et la compare aux sources.
 *
 * Contrôles (lecture seule) :
 *   1. pour chaque langue du seed local : nombre de fiches lues dans les
 *      partitions (language, country) vs nombre de slugs distincts source ;
 *   2. slugs manquants exacts (mêmes règles d'identité que `slang:seed`) ;
 *   3. agreement des agrégats (`slang:stats`) avec le relevé partitions ;
 *   4. fraction des slugs source absents de la base (+/- présents-ailleurs).
 *
 * Exit :
 *   0 — catalogue complet (aucun manquant, à la faute de lecture près) ;
 *   2 — manquants détectés (le JSON liste les slugs manquants d'exemple) ;
 *   3 — incohérence d'agrégats ou langue absente du bundle déployé.
 *
 * Usage :
 *   npx bun run scripts/seed-verify.mjs                   # cible .env.local
 *   npx bun run scripts/seed-verify.mjs --lang am,th,ig
 *   npx bun run scripts/seed-verify.mjs --prod            # cible .env.production
 *
 * (bun est requis : le script importe les sources TypeScript du catalogue.)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (typeof Bun === "undefined") {
  console.error(
    "Ce script importe les sources TypeScript du catalogue — lance-le avec bun :\n" +
      "  npx bun run scripts/seed-verify.mjs",
  );
  process.exit(1);
}
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.argv.includes("--prod");
const envFile = prod ? ".env.production" : ".env.local";
if (prod && !existsSync(path.join(projectDir, envFile))) {
  console.error(`\n${envFile} est absent : impossible de viser la production.\n`);
  process.exit(1);
}
const envRaw = readFileSync(path.join(projectDir, envFile), "utf8");
const CONVEX_URL = envRaw.match(/^VITE_CONVEX_URL=(.*)$/m)?.[1]?.trim();
if (!CONVEX_URL) {
  console.error(`VITE_CONVEX_URL introuvable dans ${envFile} — vérification impossible.`);
  process.exit(1);
}
const onlyArg = process.argv.find((a) => a.startsWith("--lang"));
const onlyLangs =
  onlyArg && onlyArg.split("=").pop()
    ? onlyArg.split("=").pop().split(",").filter(Boolean).map((s) => s.trim())
    : null;

const { SLANG_SEED, slangSlug } = await import("../src/convex/slangSeed.ts");
const { normalizeRegion } = await import("../src/convex/languages.ts");

const slugItem = new Map();
for (const item of SLANG_SEED) {
  const slug = slangSlug(item.language, item.expression);
  if (!slugItem.has(slug)) slugItem.set(slug, item);
}
const localDistinct = new Map();
for (const [, item] of slugItem) {
  if (!localDistinct.has(item.language)) localDistinct.set(item.language, new Set());
  localDistinct.get(item.language).add(slug);
}

async function runQuery(fn, args) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fn, args, format: "json" }),
  });
  const body = await res.json();
  if (body.status !== "success") {
    throw new Error(`${fn} : ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body.value;
}

const deployedLangs = new Set(await runQuery("slang:seedPlan", {}));
const localLangs = new Set(localDistinct.keys());
const bundleMissing = [...localLangs].filter((l) => !deployedLangs.has(l));

const regionsByLang = new Map();
for (const item of SLANG_SEED) {
  const k = normalizeRegion(item.region);
  if (!regionsByLang.has(item.language)) regionsByLang.set(item.language, new Set());
  regionsByLang.get(item.language).add(k);
}

const langsToCheck = (onlyLangs ?? [...localLangs]).filter((l) => localDistinct.has(l));
const results = [];
const samplesOfMissing = {};
let totalMissing = 0;
let totalElsewhereGap = 0; // présents-ailleurs : le semis les insérerait
const t0 = Date.now();
for (const lang of langsToCheck) {
  const have = new Map();
  for (const rg of regionsByLang.get(lang) ?? []) {
    const rows = await runQuery("slang:list", { language: lang, country: rg, limit: 100000 });
    for (const row of rows) {
      const slug = slangSlug(lang, row.expression);
      if (!have.has(slug)) have.set(slug, row);
    }
  }
  const missing = [];
  for (const slug of localDistinct.get(lang)) {
    if (!have.has(slug)) missing.push(slug);
  }
  totalMissing += missing.length;
  if (missing.length > 0) {
    samplesOfMissing[lang] = missing.slice(0, 8).map((slug) => ({
      slug,
      expression: slugItem.get(slug).expression,
      from: slugItem.get(slug).region,
    }));
  }
  results.push({
    lang,
    inBundle: deployedLangs.has(lang),
    dbRowsRead: have.size,
    seedDistinct: localDistinct.get(lang).size,
    missing: missing.length,
  });
}

/* Agrégats : cohérence totals vs relevé partitions */
const stats = await runQuery("slang:stats", {});
const dbCounts = stats.byLanguage ?? {};
let aggregateMismatch = [];
for (const r of results) {
  const agg = dbCounts[r.lang] ?? 0;
  if (Math.abs(agg - r.dbRowsRead) > 1) {
    aggregateMismatch.push({ lang: r.lang, aggregate: agg, read: r.dbRowsRead });
  }
}
void totalElsewhereGap;

const reportPath = path.join(projectDir, "scripts", "seed-verify-report.json");
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      backend: CONVEX_URL,
      at: new Date().toISOString(),
      executionMs: Date.now() - t0,
      varsTotals: { slugsSource: slugItem.size, presentesEnBase: null, manquants: totalMissing },
      bundleMissing,
      aggregateMismatch,
      perLanguage: results,
      samplesOfMissing,
    },
    null,
    2,
  ),
);

console.log(`Backend vérifié (lecture seule) : ${CONVEX_URL} (${Date.now() - t0} ms)`);
let exitCode = 0;
if (bundleMissing.length > 0) {
  console.error(`\n✗ Langues absentes du bundle déployé : ${bundleMissing.join(" ")}`);
  exitCode = 3;
}
if (aggregateMismatch.length > 0) {
  console.error("\n✗ Incohérence agrégats vs partitions relevées :");
  for (const m of aggregateMismatch)
    console.error(`   ${m.lang}: aggregate=${m.aggregate} != lu=${m.read}`);
  exitCode = Math.max(exitCode, 3);
}
if (totalMissing > 0) {
  console.error(`\n✗ ${totalMissing} slugs source absents de la base :`);
  for (const r of results) {
    if (r.missing > 0)
      console.error(`   ${r.lang}: manquants=${r.missing} (seed distinct=${r.seedDistinct}, base=${r.dbRowsRead})`);
  }
  exitCode = Math.max(exitCode, 2);
} else {
  console.log(`\n✓ Catalogue complet : ${results.length} langues vérifiées, 0 manquant.`);
}
console.log(`\nRapport : ${reportPath}`);
process.exit(exitCode);
