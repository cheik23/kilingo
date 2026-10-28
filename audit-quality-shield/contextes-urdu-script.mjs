import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const found = [];
for (const f of ["Ur", "Ur2", "Ur3", "Ur4"]) {
  const t = readFileSync(join(ROOT, "src/convex/slangSeedEnrichment" + f + ".ts"), "utf8");
  const re = /context: "((?:[^"\\\\]|\\\\.)*)"/g;
  let m;
  while ((m = re.exec(t))) {
    const c = JSON.parse('"' + m[1] + '"');
    if (/[\u0600-\u06FF]/u.test(c)) found.push({ fichier: f, contexte: c.slice(0, 160) });
  }
}
console.log("contextes ur avec écriture ourdoue native :", found.length);
for (const x of found.slice(0, 6)) console.log(x.fichier, "|", x.contexte);
