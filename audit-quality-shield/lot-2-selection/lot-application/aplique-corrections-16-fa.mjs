/**
 * LOT PERSAN — Application contrôlée des 16 corrections sûres (champ context uniquement)
 * SÉCURITÉ : par défaut DRY-RUN, aucune écriture dans la source.
 *           Écriture réelle seulement avec l'option CLI --write.
 *
 * Source  : src/convex/slangSeedEnrichmentFa.ts
 * Détail  : corrections-16-fa.json (présent dossier)
 * Garde   : SHA-256 de la source comparé au SHA figé dans corrections-16-fa.json.
 *           Divergence → ABORT, aucune écriture.
 * Stratégie : remplacement de chaîne exact pour exact (occurrence unique exigée),
 *            ligne par ligne, sans reconstruction du persan.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "src", "convex", "slangSeedEnrichmentFa.ts");
const JSON_ = join(HERE, "corrections-16-fa.json");
const WRITE = process.argv.includes("--write");

const det = JSON.parse(readFileSync(JSON_, "utf8"));
const sourceBuf = readFileSync(SRC);
const shaPrep = det.sha256_source_avant;
const shaReel = createHash("sha256").update(sourceBuf).digest("hex");
if (shaReel !== shaPrep) {
  console.error("ABORT — SHA-256 de la source a changé depuis la préparation.");
  console.error("  figé     :", shaPrep);
  console.error("  constaté :", shaReel);
  process.exit(1);
}
console.log("Garde SHA : OK (" + shaReel.slice(0, 12) + "…)");

const raw = sourceBuf.toString("utf8");
const CRLF = raw.includes("\r\n");
const lignes = raw.split(/\r?\n/);

const simulation = [];
const ecritures = [];
let nbAborts = 0;

for (const c of det.corrections) {
  const li = c.ligne - 1;
  if (li < 0 || li >= lignes.length) {
    console.error("ABORT — ligne " + c.ligne + " hors bornes."); process.exit(1);
  }
  const ligne = lignes[li];
  const nbAvant = ligne.split(c.context_avant).length - 1;
  if (nbAvant !== 1) {
    simulation.push({ key: c.key, statut: "ABORT", raison: "context_avant présent " + nbAvant + " fois (≠ 1)" });
    nbAborts++; continue;
  }
  // NB : context_apres est un suffixe strict de context_avant (invariant démontré par
  // dump-candidats-fa.mjs : fiche.context.endsWith(corpsEx + "]")) ; sa présence dans
  // la ligne avant remplacement est donc ATTENDUE et ne constitue pas une anomalie.
  const ligneApres = ligne.replace(c.context_avant, c.context_apres);
  const nbApres = ligneApres.split(c.context_apres).length - 1;
  if (nbApres !== 1) {
    simulation.push({ key: c.key, statut: "ABORT", raison: "context_apres présent " + nbApres + " fois après remplacement (≠ 1)" });
    nbAborts++; continue;
  }
  simulation.push({
    key: c.key, statut: "OK", ligne: c.ligne,
    ancienne_longueur: c.context_avant.length,
    nouvelle_longueur: c.context_apres.length,
    delta: c.context_apres.length - c.context_avant.length,
    gabarit_elimine: c.corrections_ok.prefixe_elimine + c.corrections_ok.suffixe_elimine,
    persan_verbatim: c.corrections_ok.persan_verbatim,
    traduction_verbatim: c.corrections_ok.traduction_verbatim,
  });
  ecritures.push({ ligneIndex: li, texte: ligneApres });
}

console.log("--- " + (WRITE ? "APPLICATION (--write)" : "DRY-RUN (aucune écriture)") + " ---");
console.log("Fiches OK       :", ecritures.length);
console.log("Fiches en ABORT :", nbAborts);

if (WRITE) {
  if (nbAborts > 0 || ecritures.length !== det.corrections.length) {
    console.error("ABORT — divergences en simulation, aucune écriture.");
    process.exit(1);
  }
  for (const e of ecritures) lignes[e.ligneIndex] = e.texte;
  writeFileSync(SRC, lignes.join(CRLF ? "\r\n" : "\n"), "utf8");
  const shaApres = createHash("sha256").update(readFileSync(SRC)).digest("hex");
  writeFileSync(join(HERE, "corrections-16-fa-applique.json"), JSON.stringify({
    genere_le: new Date().toISOString(),
    mode: "APPLIQUÉ (--write)",
    sha256_avant: shaReel,
    sha256_apres: shaApres,
    nb_fiches_modifiees: ecritures.length,
    simulation,
  }, null, 2) + "\n");
  console.log("Écriture faite. SHA après : " + shaApres.slice(0, 12) + "…");
  console.log("Traçabilité : corrections-16-fa-applique.json");
} else {
  writeFileSync(join(HERE, "corrections-16-fa-dryrun.json"), JSON.stringify({
    genere_le: new Date().toISOString(),
    mode: "DRY-RUN",
    sha256_source: shaReel,
    nb_fiches_testees: det.corrections.length,
    nb_fiches_OK: ecritures.length,
    nb_aborts: nbAborts,
    remplacements_simules: simulation,
  }, null, 2) + "\n");
  console.log("Rapport de simulation : corrections-16-fa-dryrun.json (aucun fichier source modifié)");
}
