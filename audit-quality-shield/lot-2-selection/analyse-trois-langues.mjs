#!/usr/bin/env node
/**
 * LOT 2 — Sélection comparative fa / bn / ur (Prompt lot 2, §2-4).
 *
 * Lecture seule : aucun fichier de données n'est modifié; aucune écriture réseau.
 * Sorties (dans ce dossier) :
 *   - analyse-langues.csv        : fiche par fiche (3 langues), décision
 *   - metrics-langues.json       : tableau comparatif par langue
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(new URL(import.meta.url)));
const ROOT = join(HERE, "..", "..");

const LANGS = ["fa", "bn", "ur"];
const FILES = {
  fa: [
    "src/convex/slangSeedEnrichmentFa.ts",
    "src/convex/slangSeedEnrichmentFa2.ts",
    "src/convex/slangSeedEnrichmentFa3.ts",
    "src/convex/slangSeedEnrichmentFa4.ts",
  ],
  bn: [
    "src/convex/slangSeedEnrichmentBn.ts",
    "src/convex/slangSeedEnrichmentBn2.ts",
    "src/convex/slangSeedEnrichmentBn3.ts",
    "src/convex/slangSeedEnrichmentBn4.ts",
  ],
  ur: [
    "src/convex/slangSeedEnrichmentUr.ts",
    "src/convex/slangSeedEnrichmentUr2.ts",
    "src/convex/slangSeedEnrichmentUr3.ts",
    "src/convex/slangSeedEnrichmentUr4.ts",
  ],
};

/** Parse une ligne de fiche seed : { language: "fa", expression: …, context: "…", … } */
const FICHE_RE =
  /^\s*\{ language: "([a-z]+)", expression: "((?:[^"\\]|\\.)*)", literal: "((?:[^"\\]|\\.)*)", meaning: "((?:[^"\\]|\\.)*)", context: ((?:"(?:[^"\\]|\\.)*")|(?:undefined))(, register: "([^"]*)")?(, region: "([^"]*)")?(, popularity: (\d+))?(, validated: (true|false))? },?\s*$/;

/** Signature du gabarit multi-segments (identique au bouclier). */
const GABARIT_RE = /^\[Époque: (?:[^|\]]*)\] \| (?:\[[^\]]*\] \| )*?/;

/** Corps Ex : du marqueur "| [Ex:" jusqu'au "]" terminal (règle du lot tl). */
function corpsEx(ctx) {
  const anchor = "| [Ex:";
  const idx = ctx.indexOf(anchor);
  if (idx < 0) return null;
  let body = ctx.slice(idx + anchor.length);
  const tail = /\](\s*)$/.exec(body);
  if (!tail) return null;
  body = body.slice(0, body.length - 1 - tail[1].length);
  if (body.startsWith(" ")) body = body.slice(1);
  return body;
}

/** Mesures qualité structurelle d'un corps Ex, par format observé. */
function mesure(ex) {
  if (ex === null) {
    return { extractible: false, format: "(non-extractible)", tradGuillemets: false, tradTiret: false, sansTraduction: true, noteMéta: false };
  }
  const m = { extractible: true };
  m.tradGuillemets = /«\s*[^»]+\s*»/.test(ex);
  // Format fa/bn : `'textr' - traduction` — tiret de séparation + texte non vide.
  m.tradTiret = /'\s*-\s*\S/.test(ex) && !m.tradGuillemets;
  m.sansTraduction = !m.tradGuillemets && !m.tradTiret;
  // Note méta : contenu persistant APRÈS une traduction guillemetée (ex. ur
  // "'...' « trad » - l'opposé de « scene on hai » déjà en base").
  m.noteMéta = m.tradGuillemets ? /[»\]\s]-\s*\S+(?!.*«)/.test(ex) || /[»]-\s*\S/.test(ex) : false;
  // Nombres multiténels : Ex à plusieurs segments (tours de parole).
  m.multitours = /\s\/\s/.test(ex);
  m.format = m.sansTraduction
    ? "sans_traduction"
    : m.noteMéta
      ? "trad_guillemets+note_méta"
      : m.tradGuillemets
        ? "trad_guillemets"
        : m.multitours
          ? "trad_tiret+multitours"
          : "trad_tiret";
  return m;
}

/* ── Lecture ─────────────────────────────────────────────── */
const fiches = []; // { lang, expr, file, line, literal, meaning, context, register, region }
for (const lang of LANGS) {
  for (const rel of FILES[lang]) {
    const raw = readFileSync(join(ROOT, rel), "utf8");
    const lines = raw.split("\n");
    lines.forEach((l, i) => {
      const m = FICHE_RE.exec(l);
      if (!m) return;
      const context = m[5] === "undefined" ? undefined : JSON.parse(m[5]);
      fiches.push({
        lang,
        expr: JSON.parse(`"${m[2]}"`),
        literal: JSON.parse(`"${m[3]}"`),
        meaning: JSON.parse(`"${m[4]}"`),
        context,
        register: m[7] ?? "",
        region: m[9] ?? "",
        file: rel.replace("src/convex/", ""),
        line: i + 1,
      });
    });
  }
}

/* ── Audit fiche par fiche ───────────────────────────────── */
const rows = [];
const excluded = { no_gabarit: 0, non_extractible: 0, pas_de_traduction: 0, meta_mele: 0 };
const stats = {}; // par langue
const fileTotals = {};
for (const f of fiches) {
  fileTotals[f.lang] = (fileTotals[f.lang] ?? 0) + 1;
  const ctx = f.context ?? "";
  const gabarit = ctx.startsWith("[Époque");
  const ex = gabarit ? corpsEx(ctx) : null;
  const m = mesure(ex);

  let decision = "candidate";
  let risque = "faible — corps Ex (exemple + traduction) copié verbatim, gabarit retiré (règle tl validée)";
  if (!gabarit) {
    decision = "exclue";
    risque = "pas de gabarit technique — rien à nettoyer";
    excluded.no_gabarit++;
  } else if (ex === null) {
    decision = "exclue";
    risque = "corps Ex non extractible sans ambiguïté (ancre ou ']' terminal manquants)";
    excluded.non_extractible++;
  } else if (m.sansTraduction) {
    decision = "exclue";
    risque = "l'exemple n'a ni traduction guillemetée ni traduction après tiret — risque de contenu inutilisable";
    excluded.pas_de_traduction++;
  } else if (m.noteMéta) {
    decision = "revue humaine";
    risque = "note méta mêlée après la traduction — l'extraction risque de perdre une explication";
    excluded.meta_mele++;
  } else if (m.multitours) {
    decision = "revue humaine";
    risque = "exemple à plusieurs segments (tours) — coupe ambiguë possible";
    excluded.multitours = (excluded.multitours ?? 0) + 1;
  }
  rows.push({ ...f, gabarit, ex, decision, risque, ...m });
  const s = (stats[f.lang] ??= {
    fiches: 0, gabarit: 0, extractibles: 0, tradGuillemets: 0, tradTiret: 0, sansTraduction: 0,
    avecNoteMéta: 0, multitours: 0, candidates: 0, revueHumaine: 0, exclues: 0,
    formats: {},
  });
  s.fiches++;
  s.gabarit += gabarit ? 1 : 0;
  s.extractibles += m.extractible ? 1 : 0;
  s.tradGuillemets += m.tradGuillemets ? 1 : 0;
  s.tradTiret += m.tradTiret ? 1 : 0;
  s.sansTraduction += m.sansTraduction ? 1 : 0;
  s.avecNoteMéta += m.noteMéta ? 1 : 0;
  s.multitours += m.multitours ? 1 : 0;
  s.candidates += decision === "candidate" ? 1 : 0;
  s.revueHumaine += decision === "revue humaine" ? 1 : 0;
  s.exclues += decision === "exclue" ? 1 : 0;
  s.formats[m.format] = (s.formats[m.format] ?? 0) + 1;
}

/* ── Sorties ─────────────────────────────────────────────── */
const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = [
  "cle","expression","fichier_source","ligne","gabarit","exemple_extrait","format",
  "trad_guillemets","trad_tiret","note_meta","multitours","decision","risque","literal","meaning","register","region",
].join(";");
const q = (v) => csvEscape(v);
const csvAll = [header, ...rows.map((r) => [
  `${r.lang}:${r.expr}`, r.expr, r.file, r.line,
  r.gabarit ? "oui" : "non", r.ex ?? "", r.format ?? "",
  r.tradGuillemets ? "oui" : "non", r.tradTiret ? "oui" : "non",
  r.noteMéta ? "oui" : "non", r.multitours ? "oui" : "non",
  r.decision, r.risque, r.literal, r.meaning, r.register, r.region,
].map(q).join(";"))].join("\n");
writeFileSync(join(HERE, "analyse-langues.csv"), "\uFEFF" + csvAll + "\n");

const metrics = {
  totalParLangue: fileTotals,
  parLangue: stats,
  exclusionsGlobales: excluded,
};
writeFileSync(join(HERE, "metrics-langues.json"), JSON.stringify(metrics, null, 2) + "\n");

/* ── Audit lot 2 : ≤ 20 candidates pour la langue retenue ────────────── */
/* Règle de sélection (documentée) : francs-tirets « candidate » de la langue
 * retenue (fa), triés par popularity décroissante, capacité maximale fixée
 * à 20 fiches ; décision et risque intégrés pour chaque candidate. */
const LANGUE_RETOENUE = "fa"; // (orthographe corrigée pour la relecture : langue_retenue)
const candidat = rows
  .filter((r) => r.lang === LANGUE_RETOENUE && r.decision === "candidate")
  .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
  .slice(0, 20);
const auditHeader = [
  "cle","expression","fichier_source","ligne","contexte_original","exemple_propose",
  "traduction_disponible","champs_modifies","risque","decision","popularity","register","region",
].join(";");
const auditCsv = [auditHeader, ...candidat.map((r) => [
  `${r.lang}:${r.expr}`, r.expr, r.file, r.line, r.context ?? "", r.ex ?? "",
  r.ex ?? "", "context (conservant le gabarit retiré)", r.risque, r.decision,
  r.popularity ?? "", r.register, r.region,
].map(q).join(";"))].join("\n");
writeFileSync(join(HERE, "audit-lot2-fa.csv"), "\uFEFF" + auditCsv + "\n");
console.log(`Audit lot 2 (${LANGUE_RETOENUE}) : ${candidat.length} candidates (${candidat.map((r) => `${r.lang}:${r.expr}`).join(" ; ")})`);

console.log("Total fiches analysées :", fiches.length, "— répartition :", JSON.stringify(fileTotals));
for (const lang of LANGS) {
  const s = stats[lang];
  console.log(`${lang} : ${s.fiches} fiches ; gabarit=${s.gabarit} ; tradGuillemets=${s.tradGuillemets} ; tradTiret=${s.tradTiret} ; sansTrad=${s.sansTraduction} ; noteMéta=${s.avecNoteMéta} ; multitours=${s.multitours} ; candidates=${s.candidates} ; revue=${s.revueHumaine} ; exclues=${s.exclues}`);
  console.log(`   formats : ${JSON.stringify(s.formats)}`);
}
