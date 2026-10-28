#!/usr/bin/env node
/** Localisation source des 20 candidats : fichier + ligne, unicité du tring. */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const sel = JSON.parse(readFileSync(join(HERE, "selection-tl.json"), "utf8"));

// Localisation via git grep -n (chaque motif contenu : les 12 premiers et les 2 derniers caractères du context source)
const results = [];
for (const f of sel.lot) {
  const head = f.raw.slice(0, 60).replace(/["\\\[\]]/g, m => "\\" + m);
  let grep = "";
  try {
    grep = execSync(`grep -rn --include='*.ts' -F ${JSON.stringify(f.raw.replace(/"/g, '\\"'))} src/convex`, { cwd: ROOT, stdio: ["pipe", "pipe", "ignore"] }).toString();
  } catch (e) { grep = ""; }
  const lines = grep.split("\n").filter(Boolean);
  const fiche = {
    key: f.key, tokens: f.tokens, ex: f.ex,
    occurrences: lines.length,
    file: lines.length === 1 ? lines[0].split(":")[0] : null,
    line: lines.length === 1 ? Number(lines[0].split(":")[1]) : null,
  };
  results.push(fiche);
}
const bad = results.filter(r => r.occurrences !== 1);
console.log(`localisés nativement: ${results.length - bad.length}/${results.length}`);
for (const r of results.slice(0, 3)) console.log(`  ${r.key} → ${r.file}:${r.line}`);
if (bad.length) { console.log("— PROBLÈMES D'UNICITÉ:"); for (const b of bad) console.log(`  ${b.key} → ${b.occurrences} occurrences`); }
writeFileSync(join(HERE, "localisation-tl.json"), JSON.stringify(results, null, 1));
