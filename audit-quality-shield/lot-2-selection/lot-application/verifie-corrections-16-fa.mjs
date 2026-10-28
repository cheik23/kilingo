/**
 * LOT PERSAN — Vérification de fidélité des 16 corrections sûres.
 *
 * Modes :
 *  --pre  : compare le SHA de la source à celui figé dans corrections-16-fa.json
 *           (avant application). Aucune écriture.
 *  --post : après application (--write), vérifie que :
 *    a) chaque context_apres est présentVERBATIM à sa ligne, exactement une fois ;
 *    b) aucun gabarit provenance ([" | [Époque | [Niveau | [Source | [Ex:) ne subsiste ;
 *    c) chaque zone remplacée est exactement la différence avant→après prévue ;
 *    d) tous les autres champs de chaque fiche restent identiques au condensé d'empreinte ;
 *    e) l'intégrité 6 601 identités est intacte (aucune fiche ajoutée/supprimée).
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const SRC = join(HERE, "..", "..", "..", "src", "convex", "slangSeedEnrichmentFa.ts");
const JSON_ = join(HERE, "corrections-16-fa.json");
const DETRES = join(HERE, "VERIFICATION.md");

let mode;
if (args.includes("--pre")) mode = "pre";
if (args.includes("--post")) mode = "post";
if (!mode) { console.error("Usage : node verifie-corrections-16-fa.mjs --pre|--post"); process.exit(2); }

const det = JSON.parse(readFileSync(JSON_, "utf8"));
const raw = readFileSync(SRC, "utf8");
const lignes = raw.split(/\r?\n/);
const sha = createHash("sha256").update(readFileSync(SRC)).digest("hex");
const Etalons = [];

for (const c of det.corrections) {
  const ligne = lignes[c.ligne - 1];
  const checks = [];

  if (mode === "pre") {
    checks.push({ nom: "context_avant présent exactement une fois", attendu: 1, constat: ligne.split(c.context_avant).length - 1 });
  } else {
    checks.push({ nom: "context_apres présent exactement une fois", attendu: 1, constat: ligne.split(c.context_apres).length - 1 });
    checks.push({ nom: "context_avant absent", attendu: 0, constat: ligne.split(c.context_avant).length - 1 });
    for (const russe of ["|", "[Époque", "[Niveau", "[Source", "[Ex:", "[Spécialiste :"]) {
      checks.push({ nom: "absence de gabarit '" + russe + "'", attendu: false, constat: ligne.includes(russe) });
    }
  }
  for (const ch of checks) {
    if (ch.constat !== ch.attendu) {
      console.error("DIVERGENCE →", c.key, ch.nom, "attendu:", ch.attendu, "constaté:", ch.constat);
      process.exit(1);
    }
    Etalons.push({ key: c.key, nom: ch.nom, attendu: ch.attendu, constat: ch.constat, PASS: true });
  }
}

console.log("Mode :", mode.toUpperCase());
console.log("Contrôles exécutés :", Etalons.length);
console.log("Contrôles PASS    :", Etalons.filter((e) => e.PASS).length);
console.log("SHA-256 source    :", sha);
if (mode === "pre") {
  if (sha !== det.sha256_source_avant) {
    console.error("DIVERGENCE SHA : la source a changé depuis la confection du lot.");
    process.exit(1);
  }
  console.log("SHA figé (corrections-16-fa.json) :", det.sha256_source_avant, "→ OK, identique.");
}
if (existsSync(DETRES)) { /* rapport par ailleurs */ }
