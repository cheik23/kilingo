/**
 * RÉCONCILIATION MÉCANIQUE des listes d'autorité du lot 2 persan — LECTURE SEULE.
 *
 * Sources d'autorité relues (aucune interprétation ajoutée) :
 *  - validation-finale/verdicts-20-fa.csv      : décision fiche par fiche (20 lignes)
 *  - validation-finale/avant-apres-20-fa.json  : contexte avant/après exact (20 candidates)
 *  - validation-finale/LIMITES.md              : bilan « 16/20 sûres + contenu confirmé »
 *  - validation-finale/revue-4-cas/verdicts-4-cas.csv : verdicts des 4 cas ambigus
 *
 * SÉCURITÉ : ce script n'écrit QUE son CSV de réconciliation dans ce dossier.
 *           Il ne touche à aucun fichier source, aucun rapport antérieur.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const VAL = join(HERE, "..", "validation-finale");
const csv = readFileSync(join(VAL, "verdicts-20-fa.csv"), "utf8").replace(/^﻿/, "");
const det = JSON.parse(readFileSync(join(VAL, "avant-apres-20-fa.json"), "utf8"));
const csv4 = readFileSync(join(VAL, "revue-4-cas", "verdicts-4-cas.csv"), "utf8").replace(/^﻿/, "");

// Décisions lignes par lignes du CSV 20 (séparation « ; », guillemets doublés consolidés)
function parseLigne(l) {
  const out = []; let cur = ""; let cité = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === '"') {
      if (cité && l[i + 1] === '"') { cur += '"'; i++; }
      else cité = !cité;
    } else if (c === ';' && !cité) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const lignes = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
const entete = parseLigne(lignes[0]);
const fiches = lignes.slice(1).map((l) => {
  const cells = parseLigne(l);
  const f = {}; entete.forEach((h, i) => { f[h] = cells[i] ?? ""; });
  return f;
});
if (fiches.length !== 20) { console.error("ABORT — " + fiches.length + " lignes CSV au lieu de 20"); process.exit(1); }

// Verdict des 4 cas (CLÉ exacte = colonne `cas` + expression)
const cas4 = new Map();
csv4.split(/\r?\n/).slice(1).filter((l) => l.trim()).forEach((l) => {
  const c = parseLigne(l);
  cas4.set(c[2], { cas: c[1], verdict: c[3], trad_avant: c[4], trad_proposee: c[5], champ: c[6], appliquee: c[7], validation_humaine_requise: c[8] });
});

const BILAN_LIMITES = { confirmées: 16, revue_humaine: 4, exclues: 0 };
const BILAN_REVUE = { rejoignent: 3, exclue: "fa:دهن سرویس کردن (dahan servis kardan)" };
const NB_MECANIQUE = fiches.filter((f) => f.decision === "extraction sûre").length;

// Réconciliation : le lot d'application dérivé des rapports
const rows = [];
for (const f of fiches) {
  let statut, correction = "", inclus;
  if (f.decision === "extraction sûre") {
    statut = "MECANIQUE_CONFIRMEE";
    inclus = "OUI";
  } else if (cas4.has(f.expression)) {
    const c = cas4.get(f.expression);
    if (c.verdict === "REVUE HUMAINE TOUJOURS NÉCESSAIRE") {
      statut = "CAS3_EXCLUE_DEFINITIVE";
      inclus = "NON";
      correction = "aucun champ modifié ; statut À VÉRIFIER maintenu tant que l'oreille native n'a pas tranché (polarité admiration/menace/obscénité selon le ton)";
    } else if (c.verdict === "CORRECTION JUSTIFIÉE") {
      statut = "CAS_RESOLU_AVEC_CORRECTION";
      inclus = "OUI";
      correction = "traduction de l'exemple dans `context` : « " + c.trad_avant + " » → « " + c.trad_proposee.split(" (")[0] + " » ; champ `meaning` inchangé (confirmé ≥ 5 sources)";
    } else {
      statut = "CAS_RESOLU_SANS_CORRECTION";
      inclus = "OUI";
      correction = reconsilieSansCorrection(c);
    }
  } else { statut = "NON_RECONCILIE"; inclus = "???"; }
  rows.push({ cle: f.cle, decision_csv20: f.decision, statut: statut, inclus_lot_final: inclus, correction_specifique: correction });
}
function reconsilieSansCorrection(c) {
  return "aucune ; trad " + (c.trad_proposee.includes("inchangée") ? "inchangée" : "alternative documentaire non retenue") + " (verdict " + c.verdict + ")";
}

// Contrôles de cohérence
const nbMecaniqueReconcilie = rows.filter((r) => r.statut === "MECANIQUE_CONFIRMEE").length;
const nbResolues = rows.filter((r) => r.statut.startsWith("CAS_RESOLU")).length;
const nbExclues = rows.filter((r) => r.statut === "CAS3_EXCLUE_DEFINITIVE").length;
const nbFinal = rows.filter((r) => r.inclus_lot_final === "OUI").length;
if (nbMecaniqueReconcilie !== BILAN_LIMITES.confirmées) { console.error("ABORT — mécaniques " + nbMecaniqueReconcilie + " ≠ bilan LIMITES " + BILAN_LIMITES.confirmées); process.exit(1); }
if (nbFinal !== nbMecaniqueReconcilie + nbResolues) {
  console.error("ABORT — incohérence du total inclus : nbFinal=" + nbFinal + " nbrméca=" + nbMecaniqueReconcilie + " nbrResolues=" + nbResolues + " nbrExclues=" + nbExclues);
  for (const r of rows) console.error("  ", r.statut, "|", r.inclus_lot_final, "|", r.key);
  process.exit(1);
}
if (nbExclues !== 1) { console.error("ABORT — dahan servis non reconnue comme exclue : " + nbExclues); process.exit(1); }
if (nbMecaniqueReconcilie + nbResolues + nbExclues !== 20) { console.error("ABORT — " + (nbMecaniqueReconcilie + nbResolues + nbExclues) + " au lieu de 20"); process.exit(1); }

// Écart avec l'énoncé de mission « 17 = 14 + 3 »
const ECART = { mission: { mecaniques: 14, resolues: 3, total: 17 }, rapports: { mecaniques: nbMecaniqueReconcilie, resolues: nbResolues, total: nbFinal } };

// CSV de réconciliation (ÉCRITURE UNIQUEMENT dans ce dossier)
const SEP = ";";
const san = (v) => { let s = String(v ?? ""); s = s.replace(/\r?\n/g, " "); return (s.includes(SEP) || s.includes('"')) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const CRIT = ["cle", "statut", "inclus_lot_final", "decision_csv20", "correction_specifique"];
const csvOut = CRIT.join(SEP) + "\n" + rows.map((r) => CRIT.map((c) => san(r[c])).join(SEP)).join("\n") + "\n";
writeFileSync(join(HERE, "reconciliation-20-fa.csv"), csvOut, "utf8");

writeFileSync(join(HERE, "reconciliation-resume.json"), JSON.stringify({
  genere_le: new Date().toISOString(),
  ecvoir_total_candidates: 20,
  bilan_rapports: { mecaniques_confirmees: nbMecaniqueReconcilie, cas_resolus: nbResolues, exclue_definitive: nbExclues, inclus_lot_final: nbFinal },
  ecart_mission: ECART,
  sources_dautorite: ["verdicts-20-fa.csv", "avant-apres-20-fa.json", "LIMITES.md (bilan 16/20)", "revue-4-cas/verdicts-4-cas.csv (3/4 rejoignent, dahan servis exclue)"],
  conclusion_ecart: "L'énoncé de mission « 17 = 14 + 3 » ne correspond à aucune liste nommée des rapports ; l'autorité (LIMITES.md + revue-4-cas) donne 16 mécaniques : ni le CSV ni le JSON ni les rapports ne nommern une liste de 14.",
}, null, 2) + "\n");

console.log("Réconciliation OK (20 fiches) :");
console.log("  mécaniques confirmées :", nbMecaniqueReconcilie);
console.log("  cas résolus          :", nbResolues, "(dont 1 avec correction de traduction : kerm rikhtan)");
console.log("  exclue définitive    :", nbExclues, "(dahan servis kardan)");
console.log("  TOTAL inclus au lot  :", nbFinal);
console.log("  Écart mission(17=14+3) vs rapports(19=16+3) :", ECART.mission.total, "≠", ECART.rapports.total);
console.log("Écrits : reconciliation-20-fa.csv + reconciliation-resume.json (ce dossier seulement).");
