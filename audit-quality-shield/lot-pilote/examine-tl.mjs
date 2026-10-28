#!/usr/bin/env node
/** Analyse du lot pilote tl — sélection des fiches candidates à correction. */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

const csv = readFileSync(join(ROOT, "audit-quality-shield", "classification-v3.csv"), "utf8")
  .replace(/^\uFEFF/, "").split("\n").slice(1).filter(l => l.trim());

const RAW_HEAD = /^\[Époque: [^\]]*\] \| \[Niveau: [^\]]*\] \| \[Source: [^\]]*\] \| \[Ex: (.*)\]$/s;
const EX_CANON = /^'[^']*'\s«[^«]*»$/;

const canon = [], atypical = [];
for (const l of csv) {
  const r = parse(l);
  if (r[1] !== "tl" || r[3] !== "MIXED") continue;
  const m = r[7].match(RAW_HEAD);
  if (!m) { atypical.push({ key: `tl:${r[2]}`, raw: r[7], motif: "gabarit non 4-segments" }); continue; }
  const ex = m[1];
  if (!EX_CANON.test(ex)) { atypical.push({ key: `tl:${r[2]}`, raw: r[7], motif: `Ex atypique: ${ex.slice(0, 70)}…` }); continue; }
  const tokens = (ex.replace(/ «.*$/s, "").match(/[\p{L}\p{N}]+/gu) || []).length;
  canon.push({ key: `tl:${r[2]}`, raw: r[7], ex, tokens });
}

// Exclusions dans les canoniques :
//  · tl:Ghosted — divergence assumée du Prompt 1 (masquée volontairement) ;
//  · exemples de 2 tokens ou moins (« Hi, besh! », « Ingat. GBU. ») → trop courts.
const EXCLUSIONS_COURTES = new Set(["tl:Besh", "tl:GBU"]);
const EXCLUSIONS_DIVERGENCE = new Set(["tl:Ghosted"]);

const retenus = [];
const exclus = [];
for (const c of canon) {
  if (EXCLUSIONS_DIVERGENCE.has(c.key)) exclus.push({ ...c, motif: "divergence assumée Prompt 1 (revue humaine)" });
  else if (c.tokens < 3) exclus.push({ ...c, motif: "exemple trop court (< 3 tokens)" });
  else retenus.push(c);
}

// Limite : 20 acquises max
const lot = retenus.slice(0, 20);
const presentes = retenus.slice(20);

console.log(`tl MIXED canoniques: ${canon.length} | retenus: ${retenus.length} | exclus: ${exclus.length} | atypiques: ${atypical.length}`);
console.log(`— LOT BUDGETÉ (${lot.length} fiches, ≤ 20):`);
for (const c of lot) console.log(`  ${c.key} [${c.tokens} tok]`);
console.log("— PRÉSENTÉS (non retenus au-delà de 20):");
for (const c of presentes) console.log(`  ${c.key} [${c.tokens} tok]`);
console.log("— EXCLUS canoniques:");
for (const c of exclus) console.log(`  ${c.key} [${c.tokens} tok] → ${c.motif}`);
console.log("— EXCLUS atypiques (Ex législis/note/sic… → risque d'exploiter l'info utile):");
for (const c of atypical.slice(0, 12)) console.log(`  ${c.key} → ${c.motif}`);

// Localisation: chaque raw apparaît-il exactement une fois dans src/convex ?
writeFileSync(
  join(ROOT, "audit-quality-shield", "lot-pilote", "selection-tl.json"),
  JSON.stringify({ lot, presentes, exclus, atypical }, null, 1),
);
console.log("selection-tl.json écrit.");
