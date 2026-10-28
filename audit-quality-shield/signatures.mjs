#!/usr/bin/env node
/**
 * AUDIT QUALITY SHIELD — P1.1/P1.2/P1.3
 * Mesure exhaustive sur les SOURCES ACTUELLES. La vérité provient du bundle
 * esbuild de `src/convex/slangSeed.ts` (export `SLANG_SEED`) : zéro regex
 * d'extraction fragile, les données sont exactement celles du semis.
 * Lecture seule des sources ; sorties JSON + CSV dans audit-quality-shield/.
 *
 * Catégories DISJOINTES (P1.2) — exactement une par fiche :
 *   PURE      — gabarit de provenance sans segment Ex exploitable.
 *   MIXED     — gabarit de provenance + un exemple complet extractible.
 *   DIRECTIVE — gabarit dont le segment Ex est une consigne interne
 *               (« à composer », « non fourni »…).
 *   EMPTY_EX  — gabarit avec segment Ex vide.
 *   LABEL     — label pédagogique légitime ou contexte libre : PAS un gabarit.
 *   AMBIGUOUS — tout le reste : revue humaine.
 *
 * Règle « exemple complet » (P1.3, STRUCTURALE — aucune validation
 * linguistique prétendue) :
 *   (a) ≥ 2 tokens Unicode (\p{L}/\p{M}/\p{N}) OU 1 token avec ponctuation
 *       finale ; ET (b) longueur ≥ 5 points de code après retrait des
 *       guillemets décoratifs ; ET (c) aucune directive connue.
 *   Cas douteux (1 token sans ponctuation finale, longueur < 5) → AMBIGUOUS.
 */

import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

// (pathToFileURL sert uniquement à charger le bundle en ESM)
import * as esbuild from "esbuild";

const ROOT = dirname(dirname(fileURLToPath(new URL(import.meta.url))));
const OUT_DIR = join(ROOT, "audit-quality-shield");
mkdirSync(OUT_DIR, { recursive: true });

/* ── 0. Bundle exact de la source combinée ───────────────────────────── */

const tmp = mkdtempSync(join(tmpdir(), "kilingo-shield-"));
const outfile = join(tmp, "bundle.mjs");
await esbuild.build({
  entryPoints: [join(ROOT, "src/convex/slangSeed.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { SLANG_SEED } = await import(pathToFileURL(outfile).href);
rmSync(tmp, { recursive: true, force: true });
console.log(`Bundle esbuild OK — SLANG_SEED = ${SLANG_SEED.length} fiches.`);

/* ── 1. Règle « exemple complet » (P1.3) ─────────────────────────────── */

const DIRECTIVES_ANCHORED = [
  /^\s*à\s+.*\bcomposer/i,
  /^\s*à\s+compléter/i,
  /^\s*à\s+écrire/i,
  /^\s*à\s+ajouter/i,
  /^\s*non\s+fourni/i,
  /^\s*pas\s+fourni/i,
  /^\s*à\s+venir/i,
  /^\s*n\/?a(?:$|[\s.,!?;:、，。])/i,
  /^\s*none(?:$|[\s.,!?;:])/i,
  /^\s*todo/i,
  /^\s*\.\.\.\s*$/,
  /^xx+/i,
  /^\s*(usage|sens|définition|phrase)\b(?=[^\n]{0,60}(rapporté|sens|fournie|à valider|à compose|vierge|non|rien))/i,
];
// Marqueurs non ancrés : plus prudents, réservés aux gabarits confirmés
// (jamais appliqués à un contexte libre/LABEL).
const DIRECTIVES_UNANCHORED = [
  /phrase[\s-]?exemple\s+(?:non|pas)\s+fournie?s?/i,
  /phrase[\s-]?exemple\s+à\s+valide/i,
  /(non|pas)\s+fournie?s?\s+par\s+la\s+source/i,
  /à\s+composer\s+par\s+un\s+natif/i,
  /usage\s+courant\s+sans\s+exemple/i,
  /phrase[\s-]?exemple\s+à\s+rédiger/i,
  /à\s+rédiger\s+par\s+un\s+natif/i,
  /à\s+valide(?:r|z|ie)/i,
];
const DIRECTIVES = [...DIRECTIVES_ANCHORED, ...DIRECTIVES_UNANCHORED];

/**
 * Un segment Ex est un exemple complet SSI :
 *  (a) ≥ 2 tokens Unicode, OU 1 token avec ponctuation finale ; ET
 *  (b) longueur ≥ 5 points de code après retrait des guillemets ; ET
 *  (c) aucune directive connue.
 */
function isCompleteExample(s) {
  if (!s || typeof s !== "string") return false;
  const stripped = s
    .replace(/^['"«“`‘’]+/, "")
    .replace(/['"»”`‘’]+$/, "")
    .trim();
  if ([...stripped].length < 5) return false;
  if (DIRECTIVES.some((re) => re.test(stripped))) return false;
  const tokens = stripped.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\-_.]*/gu) ?? [];
  if (tokens.length >= 2) return true;
  if (tokens.length === 1 && /\p{P}$|[.!?…]/u.test(stripped)) return true;
  return false;
}

/* ── 2. Classification disjointe (P1.2) ─────────────────────────────── */

const PROVENANCE_KEYS = [
  "Époque", "Epoque", "Niveau", "Source", "Ex", "Exemple", "Période", "Periode",
  "Registre", "Origin", "Langue", "Note",
];
const PROV_SEGMENT_RE = new RegExp(
  `\\[\\s*(${PROVENANCE_KEYS.join("|")})\\s*:[^\\]]*\\]`,
  "gi",
);
const EX_EXTRACT_RE = /\[\s*Ex(?:emple)?\s*[:：]\s*([^\]]*)\]/i;

const CATS = { PURE: 0, MIXED: 0, DIRECTIVE: 0, EMPTY_EX: 0, LABEL: 0, AMBIGUOUS: 0 };

// Un gabarit est confirmé si, après découpe en parties « | », la TÊTE de la
// fiche est une suite de segments [Clé: …] de provenance (≥ 2) ; tout reste
// est du contenu libre accroché au gabarit.
const SEGMENT_FULL_RE = new RegExp(
  `^\\[\\s*(${PROVENANCE_KEYS.join("|")})\\s*:[^\\]]*\\]$`,
  "i",
);

/** Retire les crochets décoratifs qui enrobent une partie. */
const stripBrackets = (s) => s.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();

function classifyOnContent(content) {
  if (!content) return "EMPTY_EX";
  const body = stripBrackets(content);
  if (!body) return "EMPTY_EX";
  if (DIRECTIVES.some((re) => re.test(body))) return "DIRECTIVE";
  if (isCompleteExample(body)) return "MIXED";
  return "AMBIGUOUS";
}

function classify(fiche) {
  const raw = (fiche.context ?? "").trim();
  if (!raw) return "AMBIGUOUS"; // vide : masqué, sans statut affirmé.
  if (!raw.startsWith("[")) return "LABEL"; // libre / label thématique.
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  // Préfixe de segments de provenance stricts (≥ 2).
  let lead = 0;
  while (lead < parts.length && SEGMENT_FULL_RE.test(parts[lead])) lead++;
  if (lead >= 2) {
    const rest = parts.slice(lead);
    // Reste intégralement segmenté → segment Ex ([Ex: …]) éventuel.
    if (rest.length === 0) {
      const ex = raw.match(EX_EXTRACT_RE);
      if (!ex) return "PURE"; // gabarit sans segment Ex.
      return classifyOnContent(ex[1]);
    }
    // Une seule partie libre accrochée → « mêlée » (contenu + gabarit).
    if (rest.length === 1) return classifyOnContent(rest[0]);
    // Plusieurs parties libres : structure inattendue → revue humaine.
    return "AMBIGUOUS";
  }
  if (lead === parts.length && lead < 2) return "LABEL"; // un seul [Clé:] n'est pas un gabarit.
  return "LABEL"; // libre avec label légitime.
}

/* ── 3. Agrégation signatures × langue + exemples réels ──────────────── */

const signatureOf = (raw) => {
  const segs = [...raw.matchAll(/\[\s*([^\]:：]{1,24})\s*[:：][^\]]*\]/g)].map(
    (m) => m[1].trim(),
  );
  return segs.join("+") || "(sans segment)";
};

const perSignature = {};
const perLang = {};
const rows = [];

for (const fiche of SLANG_SEED) {
  const { language, expression, context } = fiche;
  const raw = (context ?? "").trim();
  const cat = classify(fiche);
  CATS[cat]++;
  const sig = raw.startsWith("[") ? signatureOf(raw) : "(non-gabarit)";
  if (!perSignature[sig]) perSignature[sig] = { total: 0, langs: {}, example: null };
  perSignature[sig].total++;
  perSignature[sig].langs[language] = (perSignature[sig].langs[language] ?? 0) + 1;
  if (!perSignature[sig].example) {
    perSignature[sig].example = `${language}:${expression} :: ${raw.slice(0, 180)}`;
  }
  perLang[language] ??= { total: 0 };
  perLang[language][cat] = (perLang[language][cat] ?? 0) + 1;
  perLang[language].total += 1;

  const ex = raw.match(EX_EXTRACT_RE)?.[1]?.trim() ?? "";
  rows.push({
    unique_key: `${language}:${expression}`,
    language,
    expression,
    category: cat,
    signature: sig,
    context: raw,
    ex_extracted: ex,
    ex_complete: isCompleteExample(ex) ? "oui" : "non",
  });
}

/* ── 4. Sorties ─────────────────────────────────────────────────────── */

const resume = {
  source: "bundle esbuild de src/convex/slangSeed.ts (SLANG_SEED)",
  fichesScannees: SLANG_SEED.length,
  categories: CATS,
  signatures: Object.fromEntries(
    Object.entries(perSignature).sort((a, b) => b[1].total - a[1].total),
  ),
  perLang,
};

writeFileSync(join(OUT_DIR, "signatures-resume.json"), JSON.stringify(resume, null, 2), "utf8");

const csv = [
  "unique_key,language,expression,category,signature,ex_extracted,ex_complete,context",
];
for (const r of rows) {
  csv.push(
    [
      r.unique_key, r.language, r.expression, r.category,
      r.signature, r.ex_extracted, r.ex_complete, r.context,
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
}
writeFileSync(join(OUT_DIR, "classification-v3.csv"), "\uFEFF" + csv.join("\n"), "utf8");

console.log(`Catégories : ${JSON.stringify(CATS)}`);
console.log(`Signatures distinctes : ${Object.keys(perSignature).length}`);
for (const [sig, info] of Object.entries(perSignature)
  .sort((a, b) => b[1].total - a[1].total)
  .slice(0, 14)) {
  console.log(`  ${String(info.total).padStart(5)} × [${sig}] langs=${Object.keys(info.langs).join(",")}`);
}
