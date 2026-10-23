#!/usr/bin/env node
/**
 * Dry-run du semis — bilan SANS ÉCRITURE, exécutable avant chaque semis.
 *
 * Simule exactement ce que ferait `slang:seed` sur le backend ciblé, avec
 * l'identité du projet (slangSlug — MÊME fonction que la mutation) et les
 * mêmes règles de diff de champs (meaning, context, literal, register,
 * region, popularity ; validated/isAdult non comparables car non projetés).
 *
 * Lecture seule : partitions (language, country) de `slang:list` (chemin
 * non plafonné à 500) puis filet de sécurité `slang:knownWords` (batchs de
 * 40) pour séparer les vrais trous de catalogue des fiches « présentes
 * ailleurs » (autre région/langue) que le semis insérerait quand même.
 *
 * Un danger connu est signalé en tête : si le bundle de fonctions déployé
 * n'est pas à jour du code local, le semis réel insérera le catalogue de ce
 * bundle, PAS celui des sources. `slang:seedPlan` est donc comparé à la
 * vérité locale, et un écart de langue le fait savoir. Après semis,
 * `seed-verify.mjs` aboule le contrôle final (il couvre l'écart en fiches).
 *
 * Usage :
 *   npx bun run scripts/seed-dry-run.mjs                   # cible .env.local
 *   npx bun run scripts/seed-dry-run.mjs --lang am,th,ig   # reste sur ces langues
 *   npx bun run scripts/seed-dry-run.mjs --prod            # cible .env.production
 *
 * (bun est requis : le script importe les sources TypeScript du catalogue.)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (typeof Bun === "undefined") {
  console.error(
    "Ce script importe les sources TypeScript du catalogue — lance-le avec bun :\n" +
      "  npx bun run scripts/seed-dry-run.mjs",
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
  console.error(`VITE_CONVEX_URL introuvable dans ${envFile} — dry-run impossible.`);
  process.exit(1);
}
const onlyArg = process.argv.find((a) => a.startsWith("--lang"));
const onlyLangs =
  onlyArg && onlyArg.split("=").pop()
    ? onlyArg.split("=").pop().split(",").filter(Boolean).map((s) => s.trim())
    : null;

/* ── Vérité locale : SLANG_SEED complet + attribution par fichier ──
 * (bun est requis : les sources sont TypeScript.) */
const { SLANG_SEED, slangSlug } = await import("../src/convex/slangSeed.ts");
const { normalizeRegion } = await import("../src/convex/languages.ts");
void SLANG_SEED; // garde : bundler bun ok

const slugItem = new Map(); // slug -> première occurrence (règle du seed)
for (const item of SLANG_SEED) {
  const slug = slangSlug(item.language, item.expression);
  if (!slugItem.has(slug)) slugItem.set(slug, item);
}

const localDistinct = new Map(); // lang -> Set<slug>
for (const [slug, item] of slugItem) {
  if (!localDistinct.has(item.language)) localDistinct.set(item.language, new Set());
  localDistinct.get(item.language).add(slug);
}

/* ── Backend ciblé ── */
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
function normKey(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/* ── seedPlan déployé :quelle version du catalogue connaît le backend ? ── */
const deployedLangs = new Set(await runQuery("slang:seedPlan", {}));
const localLangs = new Set(localDistinct.keys());
const bundleMissing = [...localLangs].filter((l) => !deployedLangs.has(l));
const bundleExtra = [...deployedLangs].filter((l) => !localLangs.has(l));

/* ── Lecture des partitions DB (language, country) ── */
const regionsByLang = new Map();
for (const item of SLANG_SEED.length ? SLANG_SEED : []) {
  const k = normalizeRegion(item.region);
  if (!regionsByLang.has(item.language)) regionsByLang.set(item.language, new Set());
  regionsByLang.get(item.language).add(k);
}

const langsToCheck = (onlyLangs ?? [...localLangs]).filter((l) => localDistinct.has(l));
const dbRows = new Map(); // lang -> Map(slug -> row projetée)
const t0 = Date.now();
for (const lang of langsToCheck) {
  const map = new Map();
  for (const rg of regionsByLang.get(lang) ?? []) {
    const rows = await runQuery("slang:list", { language: lang, country: rg, limit: 100000 });
    for (const row of rows) {
      const slug = slangSlug(lang, row.expression);
      if (!map.has(slug)) map.set(slug, row);
    }
  }
  dbRows.set(lang, map);
}
const stats = await runQuery("slang:stats", {});
const dbCounts = stats.byLanguage ?? {};

/* ── Filet de sécurité : les manquants sont-ils présents ailleurs ? ── */
const missingByLang = new Map();
for (const lang of langsToCheck) {
  const lset = localDistinct.get(lang);
  const have = dbRows.get(lang) ?? new Map();
  const missing = [];
  for (const slug of lset) if (!have.has(slug)) missing.push(slug);
  if (missing.length) missingByLang.set(lang, missing);
}
const normExprPresent = new Set();
const allMissingWords = [...missingByLang.values()].flat()
  .map((slug) => slugItem.get(slug).expression);
for (let i = 0; i < allMissingWords.length; i += 40) {
  const slice = allMissingWords.slice(i, i + 40);
  if (slice.length === 0) continue;
  const found = await runQuery("slang:knownWords", { words: slice });
  for (const w of found) normExprPresent.add(w);
}

/* ── Simulation du diff de slang:seed ── */
const perLanguage = [];
let willInsert = 0, wouldUpdate = 0, unchanged = 0, foundElsewhere = 0;
for (const lang of langsToCheck) {
  const have = dbRows.get(lang) ?? new Map();
  let ins = 0, upd = 0, skp = 0, elsewhere = 0;
  for (const slug of localDistinct.get(lang)) {
    const row = have.get(slug);
    if (!row) {
      const expr = slugItem.get(slug).expression;
      if (normExprPresent.has(normKey(expr))) elsewhere += 1;
      else ins += 1;
      continue;
    }
    const item = slugItem.get(slug);
    const differs =
      row.meaning !== item.meaning ||
      row.context !== item.context ||
      (row.literal ?? "") !== (item.literal ?? "") ||
      row.register !== item.register ||
      row.region !== item.region ||
      row.popularity !== item.popularity;
    if (differs) upd += 1;
    else skp += 1;
  }
  willInsert += ins;
  wouldUpdate += upd;
  unchanged += skp;
  foundElsewhere += elsewhere;
  perLanguage.push({
    lang,
    deployedBundle: deployedLangs.has(lang),
    dbCount: dbCounts[lang] ?? 0,
    seedDistinct: localDistinct.get(lang).size,
    wouldInsert: ins,
    wouldUpdate: upd,
    unchanged: skp,
    foundElsewhere: elsewhere,
    dbRowsRead: have.size,
  });
}
perLanguage.sort((a, b) => b.wouldInsert - a.wouldInsert);

/* ── Rapport ── */
console.log(`Backend visé (dry-run, aucune écriture) : ${CONVEX_URL}`);
console.log(`seedPlan déployé : langues=${deployedLangs.size}${bundleMissing.length ? ` — ABSENT du bundle déployé : ${bundleMissing.join(" ")}` : ""}${bundleExtra.length ? ` — en trop : ${bundleExtra.join(" ")}` : ""}`);
console.log(
  `\nSIMUL. diff du semis sur ${langsToCheck.length} langues :` +
    `\n  insertions≈${willInsert}` +
    `  mises-à-jour≈${wouldUpdate}` +
    `  inchangées≈${unchanged}` +
    `  présentes-ailleurs (insérées tout de même)≈${foundElsewhere}`,
);
console.log("\nlang |  db | seed | +ins | ~upd | =same | ailleurs");
for (const r of perLanguage) {
  console.log(
    `${r.lang.padEnd(4)} | ${String(r.dbCount).padStart(3)} | ${String(r.seedDistinct).padStart(4)} | ${String(r.wouldInsert).padStart(4)} | ${String(r.wouldUpdate).padStart(4)} | ${String(r.unchanged).padStart(5)} | ${String(r.foundElsewhere).padStart(8)}`,
  );
}

const reportPath = path.join(projectDir, "scripts", "seed-dry-run-report.json");
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      backend: CONVEX_URL,
      at: new Date().toISOString(),
      bundleCheck: { count: deployedLangs.size, missing: bundleMissing, extra: bundleExtra },
      totals: { willInsert, wouldUpdate, unchanged, foundElsewhere },
      perLanguage,
    },
    null,
    2,
  ),
);
console.log(`\nRapport : ${reportPath}`);

/* Un écart de langue dans le bundle déployé = le semis réel n'insérera pas
 * ce catalogue — signal fort AVANT d'écrire (exit 3). Un semis à faire
 * n'est pas une erreur : exit 0, le JSON est l'artefact consulté. */
if (bundleMissing.length > 0) process.exit(3);
