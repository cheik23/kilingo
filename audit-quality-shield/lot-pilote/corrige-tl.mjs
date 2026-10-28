#!/usr/bin/env node
/**
 * LOT PILOTE tl — correction des 19 fiches sûres de slangSeedEnrichmentTl.ts.
 *
 * Règles (Prompt 2, §4) :
 *  · supprimer UNIQUEMENT le gabarit de provenance confirmé
 *    `[Époque: …] | [Niveau: …] | [Source: …] ` du champ `context` ;
 *  · conserver le corps de `[Ex: …]` VERBATIM (exemple + traduction + note
 *    déjà intégrée) : nouveau contexte = corps du segment Ex, un seul
 *    espacement final retiré (le bouclier le retirait déjà) ;
 *  · ne rien inventer ; ne toucher AUCUN autre champ ni aucune autre fiche.
 *
 * Précautions : snapshot SHA-256 contrôlé ; une seule occurrence par
 * expression ; tout échec arête le script AVANT toute écriture.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(new URL(import.meta.url)));
const ROOT = join(HERE, "..", "..");
const SRC = join(ROOT, "src", "convex", "slangSeedEnrichmentTl.ts");
const SNAP = join(HERE, "avant", "slangSeedEnrichmentTl.ts");

const RETENUES = new Set([
  "Teks", "Wer na u?", "Hir na me", "Guize", "OTW / OMW", "OL ka ba?",
  "SLR", "Kyah", "PM is the key", "LP", "SKL", "FKL", "Ge", "Kati",
  "Sharks", "Sags", "Scoobs", "Forda ang ferson", "Sana all",
]);

/* 0 · Pré-conduite : la source vivante doit être identique au snapshot. */
const raw = readFileSync(SRC, "utf8");
const snap = readFileSync(SNAP, "utf8");
if (raw !== snap) {
  console.error("ABORT : la source vivante diffère du snapshot avant/.");
  process.exit(1);
}
if (createHash("sha256").update(raw).digest("hex") !==
    "7ea1f28f1c23f2a65dfd710bcf9500538316efcbe8900cf48d90ceeb6439d68b") {
  console.error("ABORT : SHA de référence inattendu.");
  process.exit(1);
}

const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(EOL);

const EXPR_RE = /^\s*\{ language: "tl", expression: "((?:[^"\\]|\\.)*)",/;
const CTX_RE = / context: "((?:[^"\\]|\\.)*)",/;

/** Extraction du corps Ex d'un gabarit — règle de l'audit v3, sans le
 * crochet fermant ni les espaces décoratifs de part et d'autre du contenu. */
function corpsEx(old) {
  const anchor = "| [Ex:";
  const idx = old.indexOf(anchor);
  if (idx < 0) return null;
  let body = old.slice(idx + anchor.length);
  const tail = /\](\s*)$/.exec(body);
  if (!tail) return null;
  if (tail[1].length > 1) return null;
  // retirer le « ] » final ET l'espacement final, puis UNE espace en tête
  // (celle qui sépare « Ex: » du contenu dans le gabarit).
  body = body.slice(0, body.length - 1 - tail[1].length);
  if (body.startsWith(" ")) body = body.slice(1);
  return body;
}

let done = 0;
const corrections = [];
const rapides = []; // dossier d'audit
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const em = EXPR_RE.exec(line);
  if (!em) continue;
  const expr = em[1];
  if (!RETENUES.has(expr)) continue;
  const cm = CTX_RE.exec(line);
  if (!cm) { console.error(`ABORT : contexte introuvable — ${expr}`); process.exit(1); }
  const old = cm[1];
  if (!old.startsWith("[Époque")) {
    console.error(`ABORT : ${expr} — pas le gabarit attendu.`); process.exit(1);
  }
  const body = corpsEx(old);
  if (!body || !body.trim()) {
    console.error(`ABORT : ${expr} — corps Ex absent ou vide.`); process.exit(1);
  }
  const OLDCTXTOKEN = ` context: "${old}",`;
  if (line.split(OLDCTXTOKEN).length !== 2) {
    console.error(`ABORT : ${expr} — contexte non unique sur la ligne.`);
    process.exit(1);
  }
  lines[i] = line.replace(OLDCTXTOKEN, ` context: "${body}",`);
  corrections.push({ key: `tl:${expr}`, line: i + 1, before: old, after: body });
  done++;
}

if (done !== 19) {
  console.error(`ABORT : ${done} fiches modificables trouvées au lieu de 19.`);
  process.exit(1);
}

/* Écriture — uniquement si tout a réussi. */
writeFileSync(SRC, lines.join(EOL), "utf8");
writeFileSync(join(HERE, "corrections-tl.json"), JSON.stringify(corrections, null, 1), "utf8");

/* Tableau d'audit CSV (Prompt 2 §3) — avant/après verbatim, + la fiche exclue. */
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;

function ficheRapsi() {
  for (let i = 0; i < lines.length; i++) {
    const em = EXPR_RE.exec(lines[i]);
    if (em && em[1] === "Rapsi") {
      const cm = CTX_RE.exec(lines[i]);
      return { key: "tl:Rapsi", line: i + 1, before: cm ? cm[1] : "", after: null };
    }
  }
  return null;
}
const rapsi = ficheRapsi();
if (!rapsi) { console.error("ABORT : fiche Rapsi introuvable pour l'audit CSV."); process.exit(1); }

const rows = [];
for (const c of corrections) {
  const expr = c.key.slice(3);
  rows.push([
    "tl", expr, c.key, "src/convex/slangSeedEnrichmentTl.ts", String(c.line),
    c.before, c.after,
    "[Époque] [Niveau] [Source] [Ex] — 4 segments de provenance",
    corpsEx(c.before),
    "corps du segment Ex copié à l'identique ; une seule espace finale supprimée",
    "aucun : exemple + traduction + note copiés tels quels, aucune donnée utile supprimée",
    "CORRIGER (valid. structurelle OK ; fidélité OK — test bit-à-bit ; qualité linguistique : non vérifiée)",
  ]  );
}
rows.push([
  "tl", "Rapsi", rapsi.key, "src/convex/slangSeedEnrichmentTl.ts", String(rapsi.line),
  rapsi.before, rapsi.before,
  "[Époque] [Niveau] [Source] [Ex]",
  corpsEx(rapsi.before),
  "fiche laissée telle quelle",
  "risque : la traduction « bmw » contredit l'exemple (armor) — exporter cette incohérence dans le contexte nettoyé serait un défaut pédagogique",
  "EXCLUE (revue humaine requise sur la traduction source)",
]);

const header = "langue,expression,slug,fichier,ligne,contexte_avant,contexte_après,métadonnées_identifiées,exemple_candidat,méthode_d_extraction,risque_de_perte,décision";
const csv = [header, ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
writeFileSync(join(HERE, "audit-lot-tl.csv"), csv, "utf8");

console.log(`OK — ${done} fiches corrigées ; audit CSV + corrections JSON écrits.`);
console.log(`  Rapsi (exclue) : ligne ${rapsi.line}, corps Ex : ${corpsEx(rapsi.before)}`);
