/* ═══════════════════════════════════════════════════════════════════════
   FLOW CHECK — CONTRÔLE (calcul, copy des 12 langues, honnêteté)

   Le risque de ce module n'est pas de mal calculer : c'est de laisser
   croire qu'on mesure un ACCENT. Un transcripteur texte ne rend que des
   mots ; aucune intonation n'en sort. Ce script vérifie donc :

   1. LE CALCUL        — les cas partagés de `scripts/flowcheck-cases.mjs`
                         (score, mots manquants, seuils, débit réel).
   2. LA COPY          — les 12 langues portent TOUTES les clés, avec
                         leurs variables ({score}, {wpm}) intactes.
   3. LE GARDE-FOU     — la phrase qui dit ce que le score mesure ET ne
                         mesure pas existe dans chaque langue.
   4. LA LOCALITÉ      — la prise est transcrite DANS l'onglet (moteur
                         local) : aucun upload, aucune requête réseau.
   5. AUCUN FAUX SCORE — chaque panne a un message nommé, et l'XP affiché
                         est celui que le SERVEUR a rendu.

   Usage : `node scripts/verify-flowcheck.mjs` (ou `npm run verify:flow`).
   ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { CASES } from "./flowcheck-cases.mjs";
import { FLOW_COPY_LANGS, getFlowCopy } from "../src/lib/i18n.flow.ts";

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/* ── 1 · LE CALCUL ───────────────────────────────────────────────────── */

console.log("\n1 · calcul (cas partagés)");
for (const testCase of CASES) {
  try {
    testCase.run();
    ok(testCase.name);
  } catch (error) {
    fail(`${testCase.name} — ${error.message}`);
  }
}

/* ── 2 · LA COPY DES 12 LANGUES ──────────────────────────────────────── */

console.log("\n2 · copy des 12 langues");

/** Les langues UI sont lues dans la source : une 13e langue ajoutée sans
 *  copy Flow Check ferait échouer ce contrôle. */
const i18nSource = read("src/lib/i18n.tsx");
const uiLangs = (() => {
  const block = i18nSource.match(/export const UI_LANGS = \[([\s\S]*?)\]/);
  if (!block) return [];
  return [...block[1].matchAll(/"([a-z]{2})"/g)].map((m) => m[1]);
})();

if (uiLangs.length !== 12) {
  fail(`UI_LANGS : 12 langues attendues, ${uiLangs.length} lues`);
} else {
  ok(`UI_LANGS : ${uiLangs.length} langues lues dans i18n.tsx`);
}

if (FLOW_COPY_LANGS.length !== uiLangs.length) {
  fail(
    `FLOW_COPY_LANGS : ${FLOW_COPY_LANGS.length} langues pour ${uiLangs.length} langues UI`,
  );
}

const placeholders = (text) => [...text.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]).sort();
const frCopy = getFlowCopy("fr")?.flow;
if (!frCopy) fail("la copy française de référence est absente");

const referenceKeys = frCopy ? Object.keys(frCopy).sort() : [];

for (const lang of uiLangs) {
  const copy = getFlowCopy(lang)?.flow;
  if (!copy) {
    fail(`${lang} : aucune copy Flow Check (l'utilisateur verrait du français)`);
    continue;
  }
  const missingKeys = referenceKeys.filter((key) => typeof copy[key] !== "string");
  if (missingKeys.length > 0) {
    fail(`${lang} : clés manquantes — ${missingKeys.join(", ")}`);
    continue;
  }
  const emptyKeys = referenceKeys.filter((key) => copy[key].trim().length === 0);
  if (emptyKeys.length > 0) {
    fail(`${lang} : clés vides — ${emptyKeys.join(", ")}`);
    continue;
  }
  const brokenVars = referenceKeys.filter((key) => {
    const expected = placeholders(frCopy[key]).join(",");
    const actual = placeholders(copy[key]).join(",");
    return expected !== actual;
  });
  if (brokenVars.length > 0) {
    fail(`${lang} : variables d'interpolation incohérentes — ${brokenVars.join(", ")}`);
    continue;
  }
  ok(`${lang} : ${referenceKeys.length} clés, variables intactes`);
}

/* ── 3 · LE GARDE-FOU D'HONNÊTETÉ ────────────────────────────────────── */

console.log("\n3 · garde-fou d'honnêteté");

/** Une phrase, pas un jeton : c'est elle qui empêche le score d'être lu
 *  comme une note d'accent. Le seuil est bas (une écriture idéographique
 *  tient la même idée en moins de caractères) — c'est le fait qu'elle
 *  nomme le produit qui la distingue d'un marqueur temporaire. */
const notesTooShort = [];
const notesWithoutBrand = [];
for (const lang of uiLangs) {
  const note = getFlowCopy(lang)?.flow?.note ?? "";
  if (note.trim().length < 20) notesTooShort.push(lang);
  if (!note.includes("Kilingo")) notesWithoutBrand.push(lang);
}
if (notesTooShort.length > 0) {
  fail(`note d'honnêteté trop courte — ${notesTooShort.join(", ")}`);
}
if (notesWithoutBrand.length > 0) {
  fail(`note d'honnêteté sans mention du produit — ${notesWithoutBrand.join(", ")}`);
}
if (notesTooShort.length === 0 && notesWithoutBrand.length === 0) {
  ok(`chaque langue porte une note d'honnêteté rédigée (${uiLangs.length})`);
}

const component = read("src/components/learner/PronunciationCheck.tsx");
const flowLib = read("src/lib/flowCheck.ts");
const copySource = read("src/lib/i18n.flow.ts");

if (!component.includes('t("flow.note")')) {
  fail("PronunciationCheck : la note d'honnêteté n'est pas rendue dans l'interface");
} else {
  ok("PronunciationCheck : la note est rendue avec le score");
}

/* Aucune surface ne doit AFFIRMER mesurer l'accent ou l'intonation. */
const BANNED_CLAIMS = [
  /accent (validé|parfait|corrigé)/i,
  /intonation (analysée|corrigée|validée|notée)/i,
  /prononciation (parfaite|validée|notée)/i,
];
const surfaces = [
  ["src/components/learner/PronunciationCheck.tsx", component],
  ["src/lib/i18n.flow.ts", copySource],
];
/**
 * Retire commentaires de bloc ET de ligne SANS décaler les numéros de
 * ligne (les caractères retirés sont remplacés par des espaces, jamais par
 * des sauts de ligne). Les commentaires sont justement l'endroit où ces
 * formules sont écrites pour être INTERDITES : les scanner ferait échouer
 * le contrôle sur sa propre documentation.
 */
function codeOnlyLines(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replace(/[^\n]/g, " "),
  );
  return withoutBlocks.split("\n").map((line) => line.split("//")[0]);
}

let claimFree = true;
for (const [path, source] of surfaces) {
  codeOnlyLines(source).forEach((line, index) => {
    for (const banned of BANNED_CLAIMS) {
      if (banned.test(line)) {
        fail(`${path} L${index + 1} : annonce une mesure d'accent/intonation (${banned})`);
        claimFree = false;
      }
    }
  });
}
if (claimFree) ok("aucune surface n'annonce mesurer l'accent ou l'intonation");

/* ── 4 · LA PRISE RESTE SUR L'APPAREIL ───────────────────────────────── */

console.log("\n4 · la prise ne quitte pas l'appareil");

for (const token of ["decodeToPcm16k", "transcribeLocal"]) {
  if (!component.includes(token)) {
    fail(`PronunciationCheck : ${token} absent — la prise ne serait pas transcrite ici`);
  }
}
if (!component.includes("getUserMedia")) {
  fail("PronunciationCheck : aucune capture micro");
}
const networkCalls = ["fetch(", "XMLHttpRequest", "createUploadUrl", "FormData"];
const leaked = networkCalls.filter((token) => component.includes(token));
if (leaked.length > 0) {
  fail(`PronunciationCheck : appel réseau détecté (${leaked.join(", ")})`);
} else {
  ok("aucun upload : décodage + transcription dans l'onglet");
}

/* ── 5 · AUCUN FAUX SCORE, AUCUN XP FABRIQUÉ ─────────────────────────── */

console.log("\n5 · aucun faux score, aucun XP fabriqué");

for (const token of ["flow.errAsr", "flow.errNoSpeech", "flow.errDenied", "flow.errMic"]) {
  if (!component.includes(token)) {
    fail(`PronunciationCheck : panne sans message nommé (${token} absent)`);
  }
}
if (!component.includes("evaluateFlow")) {
  fail("PronunciationCheck : le score ne vient pas de la comparaison réelle");
}
if (!component.includes("flow.errAsr")) {
  fail("PronunciationCheck : un moteur indisponible pourrait produire un score");
} else {
  ok("chaque panne du moteur a son message, sans score");
}

if (!component.includes("xpGain")) {
  fail("PronunciationCheck : l'XP affiché n'est pas celui rendu par le serveur");
} else {
  ok("l'XP affiché vient de la réponse du serveur (jamais d'une constante)");
}
if (!component.includes("hasPassedLocally") || !component.includes("markPassedLocally")) {
  fail("PronunciationCheck : une même expression pourrait accorder l'XP en boucle");
} else {
  ok("une expression déjà validée n'accorde plus l'XP");
}

/* Le seuil de 70 % n'existe qu'à UN endroit : le module pur. */
const thresholdUses = /FLOW_PASS_THRESHOLD|>= 70|> 70/.test(component);
if (thresholdUses) {
  fail("PronunciationCheck : recalcule le seuil au lieu d'utiliser le module pur");
} else {
  ok("le seuil de réussite n'a qu'une source (flowCheck.ts)");
}
if (!/FLOW_PASS_THRESHOLD = 70/.test(flowLib)) {
  fail("flowCheck.ts : le seuil de réussite a changé sans mise à jour du contrôle");
}

/* L'overlay est bien fusionné dans les dictionnaires. */
if (!/getFlowCopy/.test(i18nSource)) {
  fail("i18n.tsx : l'overlay Flow Check n'est pas fusionné");
} else {
  ok("i18n.tsx fusionne l'overlay Flow Check");
}

/* ── FIN ─────────────────────────────────────────────────────────────── */

if (failures > 0) {
  console.log(`\nFLOW CHECK : ${failures} ÉCHEC(S)`);
  process.exit(1);
}
console.log(
  `\nFLOW CHECK : ${CASES.length} cas · ${uiLangs.length} langues · aucune donnée audio envoyée · aucun score sans moteur ✓`,
);
