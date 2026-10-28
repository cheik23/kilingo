/**
 * CORRECTION PONCTUELLE — کِرم ریختن (kerm rikhtan), ligne 22 de slangSeedEnrichmentFa.ts.
 *
 * Périmètre approuvé (autorisation humaine « go » + RAPPORT-REVUE-4-CAS.md, cas 2,
 * verdict « CORRECTION JUSTIFIÉE ») : traduction de l'exemple dans le champ context,
 * exactement :
 *   avant   : 'کرم نریز!' - Arrête de me chercher
 *   après   : 'کرم نریز!' - Arrête de m'embêter
 *
 * STRICT : un seul remplacement (occurrence unique exigée), aucun autre champ,
 * aucun autre caractère touché. DRY-RUN par défaut ; --write pour écrire.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "src", "convex", "slangSeedEnrichmentFa.ts");
const WRITE = process.argv.includes("--write");

const AVANT = "'کرم نریز!' - Arrête de me chercher";
const APRES = "'کرم نریز!' - Arrête de m'embêter";
const LIGNE_ATTENDUE = 22;

const raw = readFileSync(SRC, "utf8");
const sha = createHash("sha256").update(readFileSync(SRC)).digest("hex");

const lignes = raw.split(/\r?\n/);
const ligne = lignes[LIGNE_ATTENDUE - 1];
const nbAvant = ligne.split(AVANT).length - 1;
const contientFiche = ligne.includes("کِرم ریختن (kerm rikhtan)");

console.log("SHA avant :", sha.slice(0, 12) + "…");
console.log("Fiche sur la ligne", LIGNE_ATTENDUE, ":", contientFiche ? "OUI" : "NON — ABORT");
console.log("Occurrences du fragment avant :", nbAvant);

if (!contientFiche || nbAvant !== 1) {
  console.error("ABORT — l'état réel ne correspond pas à l'artefact approuvé. Aucune écriture.");
  process.exit(1);
}

const ligneApres = ligne.replace(AVANT, APRES);
if (ligneApres.split(APRES).length - 1 !== 1) {
  console.error("ABORT — après remplacement, fragment non unique. Aucune écriture.");
  process.exit(1);
}
// Garde : la seule différence entre les deux lignes est le fragment avant→après.
if (ligne.replace(AVANT, "").length !== ligneApres.replace(APRES, "").length) {
  console.error("ABORT — remplacement non strict. Aucune écriture.");
  process.exit(1);
}

console.log("DRY-RUN OK — fragment :");
console.log("  avant :", AVANT);
console.log("  après :", APRES);
console.log("Template de provenance de la fiche conservé :", ligneApres.includes("[Époque:") ? "[Époque… [Ex: …]] OUI" : "?");

if (WRITE) {
  lignes[LIGNE_ATTENDUE - 1] = ligneApres;
  const CRLF = raw.includes("\r\n");
  writeFileSync(SRC, lignes.join(CRLF ? "\r\n" : "\n"), "utf8");
  const shaApres = createHash("sha256").update(readFileSync(SRC)).digest("hex");
  writeFileSync(join(HERE, "kerm-rikhtan-applique.json"), JSON.stringify({
    genere_le: new Date().toISOString(),
    mode: "APPLIQUÉ (--write)",
    fiche: "fa:کِرم ریختن (kerm rikhtan)",
    ligne: LIGNE_ATTENDUE,
    champ_modifie: "context (sous-chaîne traduction de l'exemple uniquement)",
    fragment_avant: AVANT,
    fragment_apres: APRES,
    sha256_avant: sha,
    sha256_apres: shaApres,
    champs_intacts: ["language", "expression", "literal", "meaning", "register", "region", "popularity", "validated", "template provenance [Époque|Niveau|Source]"],
  }, null, 2) + "\n");
  console.log("Écriture faite. SHA après :", shaApres.slice(0, 12) + "…");
  console.log("Traçabilité : kerm-rikhtan-applique.json");
} else {
  console.log("Aucune écriture (lancer avec --write pour appliquer).");
}
