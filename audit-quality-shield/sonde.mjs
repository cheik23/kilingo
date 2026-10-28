#!/usr/bin/env node
/** Sonde d'analyse du CSV classification-v3.csv (lecture seule). */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(new URL(import.meta.url))));
const text = readFileSync(join(OUT_DIR, "classification-v3.csv"), "utf8")
  .replace(/^\uFEFF/, "");
const lines = text.split("\n").slice(1);
// Petit décodeur CSV (10 colonnes, guillemets doublés).
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const rows = lines.filter(Boolean).map(parseCsvLine).map((r) => ({
  key: r[0], lang: r[1], expr: r[2], cat: r[3], sig: r[4],
  ex: r[5], complete: r[6], ctx: r[7],
}));

const arg = process.argv[2] ?? "resumer";
if (arg === "resumer") {
  console.log("rows:", rows.length);
  for (const cat of ["PURE", "MIXED", "DIRECTIVE", "EMPTY_EX", "AMBIGUOUS"]) {
    const sel = rows.filter((r) => r.cat === cat);
    const byLang = {};
    for (const r of sel) byLang[r.lang] = (byLang[r.lang] ?? 0) + 1;
    console.log(`\n== ${cat} (${sel.length}) ==`);
    console.log(JSON.stringify(byLang));
    for (const r of sel.slice(0, 6)) console.log(`  ${r.lang} | ${r.expr} | ${r.ctx.slice(0, 150)}`);
  }
} else {
  const sel = rows.filter((r) => r.lang === arg);
  const byCat = {};
  for (const r of sel) byCat[r.cat] = (byCat[r.cat] ?? 0) + 1;
  console.log(`Langue ${arg} — ${sel.length} fiches :`, JSON.stringify(byCat));
  const wanted = process.argv[3] === "label" ? [] : sel.filter((x) => x.cat !== "LABEL");
  for (const r of (process.argv[3] === "label" ? sel : wanted).slice(0, 25)) {
    console.log(`  [${r.cat}] ${r.expr} :: ${r.ctx.slice(0, 200)}`);
  }
}
