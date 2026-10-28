#!/usr/bin/env node
/**
 * Vérification croisée : le bouclier TS (src/lib/pedagogicalContext.ts)
 * donné par esbuild est appliqué aux 6 601 fiches de SLANG_SEED et comparé
 * à la classification auditées (classification-v3.csv).
 *  · LABEL     → identique au raw (intact) ;
 *  · MIXED     → l'exemple, sans gabarit ;
 *  · autres    → null.
 * Toute divergence est listée.
 */
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const ROOT = dirname(dirname(fileURLToPath(new URL(import.meta.url))));
const OUT = join(ROOT, "audit-quality-shield");

const tmp = mkdtempSync(join(tmpdir(), "kshield-"));
const shield = join(tmp, "shield.mjs");
await esbuild.build({
  entryPoints: [join(ROOT, "src/lib/pedagogicalContext.ts")],
  bundle: true, format: "esm", platform: "node", outfile: shield, logLevel: "silent",
});
const { displayContext, isProvenanceTemplate } = await import(pathToFileURL(shield).href);
const seed = join(tmp, "seed.mjs");
await esbuild.build({
  entryPoints: [join(ROOT, "src/convex/slangSeed.ts")],
  bundle: true, format: "esm", platform: "node", outfile: seed, logLevel: "silent",
});
const { SLANG_SEED } = await import(pathToFileURL(seed).href);

// CSV audité : unique_key (langue:expression) → catégorie.
function parse(line) {
  const o = []; let c = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { c += '"'; i++; }
      else if (ch === '"') q = false;
      else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { o.push(c); c = ""; }
    else c += ch;
  }
  o.push(c);
  return o;
}
const audit = new Map();
const text = readFileSync(join(OUT, "classification-v3.csv"), "utf8").replace(/^\uFEFF/, "");
for (const line of text.split("\n").slice(1)) {
  if (!line) continue;
  const r = parse(line);
  audit.set(r[0], { cat: r[3], ex: r[5] });
}

let ok = 0, diverged = 0;
const issues = [];
// Divergences audit↔bouclier ASSUMÉES et justifiées (key → pourquoi) :
const xSupposes = {
  "tl:Ghosted": "faux positif de l'audit (ancre n/a laxiste) ; « Na-ghosted ako » = 2 tokens → exemple réellement affichable",
  "ig:Oringo": "le bouclier cache aussi le commentaire « définition du fil » (source de fil, pas un exemple) — convention d'extraction élargie",
};
const norm = (s) => (s ?? "").replace(/[\[\]]/g, "").replace(/EAlexEx:\s*/i, "").replace(/\s+/g, " ").trim();
for (const fiche of SLANG_SEED) {
  const raw = (fiche.context ?? "").trim();
  const key = `${fiche.language}:${fiche.expression}`;
  const entry = audit.get(key);
  if (!entry) { issues.push(`${key}: absent du CSV`); diverged++; continue; }
  const shown = displayContext(raw);
  const shownN = shown ?? null;
  let okCase = false;
  let why = "";
  if (entry.cat === "LABEL") {
    okCase = (shownN ?? null) === (raw === "" ? null : raw);
  } else if (entry.cat === "MIXED") {
    // L'exemple attendu est une sous-chaîne de la zone Ex/partie libre du raw.
    const zone = norm(raw);
    okCase = shownN !== null && norm(shownN).length > 0 && zone.includes(norm(shownN));
    if (!okCase) why = `MIXED affiché ≠ zone attendue`;
  } else {
    okCase = shownN === null;
    if (!okCase) why = `${entry.cat} devrait être masqué`;
  }
  if (!okCase && xSupposes[key]) { shownN && console.log(`  [DIVERG. ASSUMÉE] ${key}: ${xSupposes[key]}`); ok++; continue; }
  if (okCase) ok++;
  else { diverged++; if (issues.length < 25) issues.push(`${key} [${entry.cat}] ${why} → bouclier: ${shown}`); }
}
console.log(`Vérifiées : ${ok} ; divergences : ${diverged}`);
for (const it of issues) console.log(" ", it);
console.log("isProvenanceTemplate bazé :", PROV_CHECK(isProvenanceTemplate, SLANG_SEED));
function PROV_CHECK(fn, seed) {
  // Contrôle rapide : ES/PT à 4 parties doivent être « gabarits ».
  const sample = seed.find((f) => f.language === "pt" && (f.context ?? "").startsWith("[Époque"));
  // Label thématique légitime : premier segment SANS deux-points de provenance.
  const label = seed.find((f) =>
    (f.context ?? "").trimStart().startsWith("[") &&
    !(f.context ?? "").split("|")[0].includes(":"),
  );
  return [
    `pt-gabarit=${sample ? fn(sample.context) : "?"} (attendu true)`,
    `label-thématique=${label ? fn(label.context) : "?"} (attendu false)`,
  ].join(" ; ");
}
rmSync(tmp, { recursive: true, force: true });
