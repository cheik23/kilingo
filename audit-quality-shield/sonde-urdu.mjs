import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// 1. Écrire le harnais temporaire (TS, exécuté par bun)
const harness = `
import { isProvenanceTemplate, displayContext } from "../src/lib/pedagogicalContext";
import { readFileSync } from "node:fs";
const cases = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = [];
for (const c of cases) {
  const det = isProvenanceTemplate(c.context);
  const disp = displayContext(c.context);
  const leak = det && /\\[[^\\]]*:/u.test(disp ?? "") ? "FUITE_BLOC_" + JSON.stringify((disp ?? "").slice(0, 60)) : null;
  out.push({ id: c.id, detecte: det, affiche: disp, fuite: leak });
}
console.log(JSON.stringify(out));
`;
writeFileSync(join(HERE, "harnais-sonde.tmp.ts"), harness);

// 2. Extraire les contextes des sources urdu (tous fichiers)
const files = ["Ur", "Ur2", "Ur3", "Ur4"].map((s) => join(ROOT, "src/convex/slangSeedEnrichment" + s + ".ts"));
const cases = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = line.match(/context: "((?:[^"\\]|\\.)*)"/);
    if (!m) return;
    const context = JSON.parse('"' + m[1] + '"');
    cases.push({ id: f.split(/[/\\]/).pop() + ":" + (i + 1), context });
  });
}
writeFileSync(join(HERE, "sonde-urdu-cases.json"), JSON.stringify(cases));

// 3. Exécuter via bun
const result = execFileSync(
  `npx bun run "${join(HERE, "harnais-sonde.tmp.ts")}" "${join(HERE, "sonde-urdu-cases.json")}"`,
  { shell: true, encoding: "utf8", cwd: ROOT, maxBuffer: 1 << 26 },
);
const parsed = JSON.parse(result);
unlinkSync(join(HERE, "harnais-sonde.tmp.ts"));

// 4. Bilan par catégorie
const bilan = { total: 0, detecte: 0, non_detecte: 0, fuite: 0, masque: 0 };
const nonDetectes = [];
for (const r of parsed) {
  bilan.total++;
  if (r.detecte) bilan.detecte++;
  else { bilan.non_detecte++; if (nonDetectes.length < 12) nonDetectes.push(r); }
  if (r.fuite) bilan.fuite++;
}
console.log(JSON.stringify({ bilan, nonDetectes: nonDetectes.slice(0, 8) }, null, 2));
writeFileSync(join(HERE, "sonde-urdu-bilan.json"), JSON.stringify({ bilan, nonDetectes: nonDetectes.slice(0, 8) }, null, 2) + "\n");
