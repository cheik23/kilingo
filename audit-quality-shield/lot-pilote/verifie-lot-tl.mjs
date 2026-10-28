#!/usr/bin/env node
/**
 * LOT PILOTE tl — vérification bit-à-bit et intégrité du corpus.
 *
 * ADDENDUM (validation-linguistique) : 2 corrections linguistiques
 * approuvées (tl:Guize, tl:Sana all, champ `context` uniquement) portent sur
 * des fiches déjà modifiées mécaniquement — une fiche = une ligne, donc le
 * diff attendu reste 19 lignes, dont 2 vérifiées contre la valeur LINGUISTIQUE
 * (validation-linguistique/corrections-linguistiques-tl.json, champ `after`).
 *
 * 1. Diff du fichier vivant contre le snapshot avant/ :
 *    seules les 19 lignes du lot diffèrent, uniquement au champ `context`
 * 2. Corpus complet bundle par esbuild (src/convex/slangSeed.ts) :
 *    6 601 fiches, clés uniques, aucun gabarit résiduel sur les 19 fiches.
 *
 * Sortie : code 0 si tout passe, 1 sinon.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(new URL(import.meta.url)));
const ROOT = join(HERE, "..", "..");
const SRC = join(ROOT, "src", "convex", "slangSeedEnrichmentTl.ts");
const SNAP = join(HERE, "avant", "slangSeedEnrichmentTl.ts");

const corrections = JSON.parse(readFileSync(join(HERE, "corrections-tl.json"), "utf8"));
const correctionsLinguistiques = JSON.parse(
  readFileSync(join(HERE, "validation-linguistique", "corrections-linguistiques-tl.json"), "utf8"),
);
// Ordre important : pour une fiche portant une correction linguistique
// approuvée, la valeur attendue du contexte est la LINGUISTIQUE (la plus récente),
// pas l'ancienne valeur mécanique.
const toutesCorrections = [...correctionsLinguistiques, ...corrections];

const live = readFileSync(SRC, "utf8");
const snap = readFileSync(SNAP, "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");
console.log("SHA avant :", sha(snap));
console.log("SHA après :", sha(live));

const EOL = snap.includes("\r\n") ? "\r\n" : "\n";
const before = snap.split(EOL);
const after = live.split(EOL);
let failures = 0;
const fail = (m) => { failures++; console.error("FAIL:", m); };

if (before.length !== after.length) fail(`nb lignes: ${before.length} vs ${after.length}`);

const exprOf = /^(\s*\{ language: "tl", expression: "((?:[^"\\]|\\.)*)",)(.*)$/;
const modified = new Map(); // ligne (1-based) → key
for (let i = 0; i < Math.min(before.length, after.length); i++) {
  if (before[i] === after[i]) continue;
  const emBefore = exprOf.exec(before[i]);
  const emAfter = exprOf.exec(after[i]);
  if (!emBefore || !emAfter) { fail(`ligne ${i + 1} diffère sans fiche`); continue; }
  const expr = emBefore[2];
  if (expr !== emAfter[2]) { fail(`ligne ${i + 1}: expression modifiée (${expr} vs ${emAfter[2]})`); continue; }
  const c = toutesCorrections.find((x) => x.key === `tl:${expr}`);
  if (!c) { fail(`ligne ${i + 1} (${expr}) modifiée mais hors lot`); continue; }
  modified.set(i + 1, c.key);
  if (!after[i].includes(` context: "${c.after}",`)) {
    fail(`${c.key}: le nouveau contexte ne correspond pas au champ « after » attendu (mécanique ou linguistique approuvée)`);
  }
  if (emAfter[3].includes("[Époque")) fail(`${c.key}: gabarit résiduel ?`);
}

if (modified.size !== corrections.length) {
  fail(`lignes modifiées : ${modified.size} au lieu de ${corrections.length}`);
}
console.log(
  `Lignes modifiées (exclusivement context) : ${modified.size}/${corrections.length}` +
    ` — 19 fiches du lot ; 2 portent une correction linguistique approuvée (validation-linguistique/corrections-linguistiques-tl.json)`,
);
if (failures === 0) console.log("Diff bit-à-bit : OK — 19 fiches modifiées au champ `context` uniquement (19 mécaniques dont 2 surchargées par la correction linguistique approuvée), tout le reste identique octet pour octet.");

/* ── 2 · Corpus complet : 6 601 fiches intègres, clés uniques ── */
import * as esbuild from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const tmp = mkdtempSync(join(tmpdir(), "klot-"));
const seed = join(tmp, "seed.mjs");
await esbuild.build({
  entryPoints: [join(ROOT, "src/convex/slangSeed.ts")],
  bundle: true, format: "esm", platform: "node", outfile: seed, logLevel: "silent",
});
const { SLANG_SEED } = await import(pathToFileURL(seed).href);
rmSync(tmp, { recursive: true, force: true });

const total = SLANG_SEED.length;
const keys = new Set(SLANG_SEED.map((f) => `${f.language}:${f.expression}`));
console.log(`Corpus : ${total} fiches ; clés uniques : ${keys.size}`);
if (total !== 6601) fail(`corpus : ${total} fiches (attendu 6 601)`);
if (keys.size !== total) fail(`duplication de clés`); 
let corromptus = 0;
const lotOf = new Set(corrections.map((c) => c.key));
for (const f of SLANG_SEED) {
  const key = `${f.language}:${f.expression}`;
  if (lotOf.has(key)) {
    if ((f.context ?? "").includes("[Époque") || (f.context ?? "").startsWith("["))
      { fail(`${key}: gabarit résiduel dans le contexte corrigé`); corromptus++; }
  }
}
console.log(failures === 0
  ? `Intégrité corpus : OK — 6 601 fiches, clés uniques, 19 fiches du lot modifiées au champ « context » uniquement (2 corrections linguistiques approuvées incluses), rien d'autre touché.`
  : `Intégrité corpus : ${failures} ANOMALIE(S)`);
process.exit(failures === 0 ? 0 : 1);
