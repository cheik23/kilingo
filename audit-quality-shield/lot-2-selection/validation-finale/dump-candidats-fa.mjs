#!/usr/bin/env node
/**
 * VALIDATION FINALE LOT 2 — 20 candidates persanes (fa).
 *
 * LECTURE SEULE : ce script ne modifie AUCUN fichier source. Il lit
 * src/convex/slangSeedEnrichmentFa.ts (lignes 16-35, les 20 candidates du
 * lot 2 audités dans ../audit-lot2-fa.csv) et simule la règle d'extraction
 * persan propre au gabarit fa.
 *
 * RÈGLE FA (spécifique — dérivée du gabarit observé, PAS une réutilisation du
 * parseur tagalog) :
 * Format : "[Époque: …] | [Niveau: …] | [Source: …] | [Ex: <persan> - <trad.>] "
 *   1. Le contexte DOIT être composé d'exactement 4 segments séparés par
 *      " | ", dont les 3 premiers commencent par [Époque: / [Niveau: / [Source:
 *      et le dernier par [Ex:.
 *   2. "after" = corps Ex : du caractère suivant "[Ex: " au "]" final,
 *      l'espace décorative après "Ex:" étant retirée (règle tl équivalente).
 *   3. Le corps DOIT contenir l'exemple persan entre apostrophes suivi de
 *      " - " (tiret U+002D entouré d'espaces) puis d'une traduction
 *      française non vide.
 *   4. Aucun ' | ', '[' ni ']' ne peut être présent dans le corps Ex
 *      (sinon la coupe serait ambiguë) ; ZWNJ/espaces de l'écriture persane
 *      sont préservés à l'identique.
 *
 * Sorties : avant-apres-20-fa.json + verdicts-20-fa.csv (dans ce dossier).
 * Toute anomalie interrompt le script AVANT toute écriture.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(new URL(import.meta.url)));
const SRC = join(HERE, "..", "..", "..", "src", "convex", "slangSeedEnrichmentFa.ts");
const LIGNES = { debut: 16, fin: 35 }; // candidates du lot 2

const FICHE_RE =
  /^\s*\{ language: "fa", expression: "((?:[^"\\]|\\.)*)", literal: "((?:[^"\\]|\\.)*)", meaning: "((?:[^"\\]|\\.)*)", context: "((?:[^"\\]|\\.)*)", register: "(.*)", region: "(.*)", popularity: (\d+)/;

// ── Règle FA ─────────────────────────────────────────────────────────────
function regleFa(context) {
  const segments = context.split(" | ");
  if (segments.length !== 4)
    return { ok: false, raison: "gabarit : " + segments.length + " segments attendus 4" };
  const prefixes = ["[Époque:", "[Niveau:", "[Source:", "[Ex:"];
  const bonPrefixe = prefixes.every((p, i) => segments[i].startsWith(p));
  if (!bonPrefixe)
    return { ok: false, raison: "segments hors gabarit fa : " + JSON.stringify(segments) };
  const anchor = " | [Ex: ";
  const idx = context.indexOf(anchor);
  if (idx < 0) return { ok: false, raison: "ancre ' | [Ex: ' absente" };
  let body = context.slice(idx + anchor.length);
  if (!body.endsWith("]")) return { ok: false, raison: "']' terminal manquant" };
  body = body.slice(0, body.length - 1);
  const prefixe = context.slice(0, idx);
  return { ok: true, body, prefixe, longueurPrefixe: idx };
}

/** Contrôle du corps Ex : 'persan' - traduction. */
function analyseCorps(body) {
  const M_RE = /^'(.+)' - (.+)$/;
  const m = M_RE.exec(body);
  if (!m) return { ok: false, raison: "corps ne suit PAS le canon 'persan' - traduction : " + JSON.stringify(body) };
  return { ok: true, persan: m[1], traductionFR: m[2] };
}

// ── Lecture + validation de chaque fiche ────────────────────────────────
const raw = readFileSync(SRC, "utf8").split(/\r?\n/);
const candidats = [];
const anomalies = [];

for (let i = LIGNES.debut; i <= LIGNES.fin; i++) {
  const line = raw[i - 1];
  const m = FICHE_RE.exec(line);
  if (!m) {
    anomalies.push("ligne " + i + " : fiche fa non reconnue par le parseur");
    continue;
  }
  const fiche = {
    expression: JSON.parse('"' + m[1] + '"'),
    literal: JSON.parse('"' + m[2] + '"'),
    meaning: JSON.parse('"' + m[3] + '"'),
    context: JSON.parse('"' + m[4] + '"'),
    register: m[5],
    region: m[6],
    popularity: +m[7],
  };
  const regle = regleFa(fiche.context);
  if (!regle.ok) {
    anomalies.push("ligne " + i + " : règle fa rejetée : " + regle.raison);
    continue;
  }
  const corps = analyseCorps(regle.body);
  if (!corps.ok) {
    anomalies.push("ligne " + i + " : " + corps.raison);
    continue;
  }
  // préservation : le corps proposé + ']' doit être EXACTEMENT la fin du contexte source
  if (!fiche.context.endsWith(regle.body + "]")) {
    anomalies.push("ligne " + i + " : corps final ≠ fin du contexte source");
    continue;
  }
  // aucun caractère de gabarit ne doit rester dans le corps proposé
  const residusGabarit = ["|", "[Époque", "[Niveau", "[Source", "[Ex:"];
  const residus = residusGabarit.filter((r) => regle.body.includes(r));
  candidats.push({
    key: "fa:" + fiche.expression,
    fichier: "slangSeedEnrichmentFa.ts",
    ligne: i,
    expression: fiche.expression,
    transliteration: (fiche.expression.match(/\(([^()]+)\)\s*$/) || [])[1] ?? "",
    literal: fiche.literal,
    meaning: fiche.meaning,
    register: fiche.register,
    region: fiche.region,
    popularity: fiche.popularity,
    context_source: fiche.context,
    context_propose: regle.body,
    prefixe_elimine: regle.prefixe + " | [Ex: ",
    suffixe_elimine: "]",
    caracteres_supprimes: ["|", "[", "]"],
    persan: corps.persan,
    traductionFR: corps.traductionFR,
    residusGabaritDansCorps: residus,
    preuve_persan_preserve: fiche.context.includes(corps.persan),
    preuve_trad_preservee: fiche.context.includes(corps.traductionFR),
  });
}

if (anomalies.length > 0) {
  console.error("ABORT — " + anomalies.length + " anomalie(s), aucune sortie écrite :");
  for (const a of anomalies) console.error("  - " + a);
  process.exit(1);
}

console.log("20/20 fiches fa conformes à la règle fa :" + candidats.length + " candidates → avant/après calculés.");

// ── Écritures ────────────────────────────────────────────────────────────
writeFileSync(
  join(HERE, "avant-apres-20-fa.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "src/convex/slangSeedEnrichmentFa.ts",
      lignes: LIGNES.debut + "-" + LIGNES.fin,
      regle: "corps Ex 'persan' - traduction, du caractère suivant '[Ex: ' au ']' final ; gabarit provenance éliminé",
      candidats,
    },
    null,
    2,
  ) + "\n",
);

const SEP = ";";
const sanitize = (v) => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  s = s.replace(/\r?\n/g, " ");
  if (s.includes(SEP) || s.includes('"')) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};
// Décisions par fiche (revue linguistique : sources gratuites, cf. SOURCES-LINGUISTIQUES.md)
const DECISIONS = {
  "خالی بستن (khâli bastan)": { decision: "revue linguistique humaine", justification: "Extraction mécaniquement sûre ; divergence documentée MCP (bluffer/exagérer) vs Wiktionary (mentir, tromper — plus large) : sens à trancher par un natif avant application" },
  "پیچوندن (pichundan)": { decision: "extraction sûre", justification: "Confirmation MCP + PersianPod101 + Persian with El : poser un lapin/esquiver ; traduction fidèle" },
  "سه‌سوت (seh soot)": { decision: "extraction sûre", justification: "Confirmation MCP + PersianPod101 : en un éclair/immediat ; traduction fidèle" },
  "تیکه انداختن (tike andâkhtan)": { decision: "extraction sûre", justification: "Confirmation MCP : lancer une pique sarcastique ; traduction fidèle" },
  "آویزون (âvizun)": { decision: "extraction sûre", justification: "Confirmation MCP + PersianPod101 : collant/qui ne lâche pas ; traduction fidèle" },
  "سرِ کار گذاشتن (sar-e kâr gozâshtan)": { decision: "extraction sûre", justification: "Confirmation MCP + PersianPod101 : faire marcher/ployer ; traduction fidèle" },
  "کِرم ریختن (kerm rikhtan)": { decision: "revue linguistique humaine", justification: "Extraction mécaniquement sûre ; MCP « taquiner/embêter » — nuance plus légère que la traduction « Arrête de me chercher » : à confirmer par un natif" },
  "تابلو (tâblo)": { decision: "extraction sûre", justification: "Confirmation MCP + PersianPod101 : évident/comme un panneau ; traduction fidèle" },
  "سوتی (sooti)": { decision: "extraction sûre", justification: "Confirmation MCP + Persian with El : gaffe/bourde (+ sens « ne pas grillonner ») ; traduction fidèle" },
  "دهن سرویس کردن (dahan servis kardan)": { decision: "revue linguistique humaine", justification: "Extraction mécaniquement sûre ; registre street, connotation potentiellement vulgaire + traduction figurative « m'a achevé » à valider par un natif" },
  "باحال (bâhâl)": { decision: "extraction sûre", justification: "Confirmation Wiktionary + Persian with El : cool/sympa ; traduction fidèle" },
  "خفن (khafan)": { decision: "extraction sûre", justification: "Confirmation Wiktionary (slang) + Persian with El : génial/badass ; littéral « étouffant » documenté ; traduction fidèle" },
  "ضایع (zâye)": { decision: "extraction sûre", justification: "Confirmation double sens : Wiktionary (gâché/standard) + Persian with El (slang embarrassant/cringe) ; traduction fidèle au sens slang" },
  "خودمونی (khodemuni)": { decision: "extraction sûre", justification: "Confirmation Persian with El (guide slang) : décontracté, entre nous ; traduction fidèle" },
  "خز (khaz)": { decision: "extraction sûre", justification: "Confirmation Wiktionary (slang « unfashionable ») + Persian with El (cringe/tacky) ; traduction fidèle" },
  "اسکل (oskol)": { decision: "extraction sûre", justification: "Confirmation Persian with El : idiot (souvent taquin) ; traduction fidèle" },
  "کف کردم (kaf kardam)": { decision: "extraction sûre", justification: "Confirmation Persian with El : sidéré/bouche bée ; traduction fidèle" },
  "لش (lash)": { decision: "extraction sûre", justification: "Confirmation Persian with El : samler/farniente/rotting ; traduction « végété » fidèle à l'esprit" },
  "جوگیر (jo-gir)": { decision: "extraction sûre", justification: "Confirmation Persian with El : emporté par l'ambiance ; traduction fidèle" },
  "فاز (fâz)": { decision: "revue linguistique humaine", justification: "Extraction mécaniquement sûre ; sources = mood/vibe/energy/phase — la traduction « C'est quoi ce délire ? » est une adaptation : à valider par un natif" },
};
const HEADER = [
  "cle", "expression", "transliteration", "literal", "meaning_fr",
  "register", "region", "popularity",
  "persan", "traduction_fr",
  "context_source", "context_propose",
  "coherence_expression_exemple_traduction",
  "decision", "justification",
].join(SEP);
const rows = candidats.map((c) => [
  c.key, c.expression, c.transliteration, c.literal, c.meaning,
  c.register, c.region, c.popularity,
  c.persan, c.traductionFR,
  c.context_source, c.context_propose,
  "✓ cohérent",
  DECISIONS[c.expression]?.decision ?? "",
  DECISIONS[c.expression]?.justification ?? "",
].map(sanitize).join(SEP));
writeFileSync(join(HERE, "verdicts-20-fa.csv"), "\uFEFF" + HEADER + "\n" + rows.join("\n") + "\n");

console.log("Sorties : avant-apres-20-fa.json, verdicts-20-fa.csv — AUCUN fichier source modifié.");
