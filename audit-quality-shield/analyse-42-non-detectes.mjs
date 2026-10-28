import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(HERE, "sonde-urdu-cases.json"), "utf8"));
const parsed = JSON.parse(readFileSync(join(HERE, "sonde-urdu-bilan.json"), "utf8"));

// Le bilan n'a gardé que 8 non-détectés : recompte par fichier pas sur les cas complets
// en repassant par le harnais ? Non : re-détection légère à partir du bilan initial est
// impossible ; on refait le traitement avec la même logique via le CSV du harnais précédent.
// Ici, on se limite à : classer les non-détectés documentés + compter les gabarits par fichier.
const parFichier = {};
for (const c of cases) {
  const f = c.id.split(":")[0];
  parFichier[f] ??= { total: 0, gabarits: 0, libres: 0 };
  parFichier[f].total++;
  if (c.context.trimStart().startsWith("["))
    parFichier[f].gabarits++;
  else parFichier[f].libres++;
}
console.log(JSON.stringify(parFichier, null, 2));

// Non-détectés documentés dans le bilan (8 exemples) → catégorisation manuelle contrôlée
const nd = parsed.nonDetectes ?? [];
for (const r of nd) {
  const gabaritProbable = /\[E(?:¹|é|)poque[^|\]]*\]\s*\|/.test(r.affiche ?? "");
  console.log(r.id, "| gabarit probable :", gabaritProbable, "| affiche 60c :", (r.affiche ?? "").slice(0, 60));
}
