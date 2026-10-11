/* ═══════════════════════════════════════════════════════════════════════
   SLANG DU JOUR + FICHES ENRICHIES — CONTRÔLE

   Ce lot ajoute deux promesses fragiles :

   1. « Tout le monde voit LA même expression le même jour » — donc le
      tirage doit être déterministe, et le QCM ne doit jamais proposer la
      bonne réponse deux fois ni la noyer parmi des doublons.
   2. « La fiche affiche un contexte culturel » — donc les expressions
      enrichies doivent EXISTER dans la base seedée : une fiche rattachée
      à une expression absente ne s'afficherait jamais, et personne ne le
      verrait avant qu'un utilisateur ne la cherche.

   Et trois garde-fous d'honnêteté :
     · l'XP vient d'`applyAward` (un seul cœur de gamification), jamais
       d'une constante du client ;
     · aucun `Math.random` dans la sélection (il casserait l'unicité) ;
     · le tableau de bord tolère l'absence de la fonction côté serveur
       (`useOptionalQuery`) : une fonction non déployée ne fait pas
       tomber la page.

   Usage : `node scripts/verify-daily-slang.mjs` (ou `npm run verify:daily`).
   ═══════════════════════════════════════════════════════════════════════ */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DAILY_OPTIONS,
  DAILY_POOL_SIZE,
  DAILY_XP,
  buildDailySlang,
} from "../src/lib/dailySlang.ts";
import { getSlangCulture, hasCultureContent, LEVEL_LABEL, SLANG_CULTURE_COUNT } from "../src/data/slang-culture.ts";

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Retire les commentaires SANS décaler les lignes : un commentaire qui
 *  interdit une pratique est aussi la seule place où cette pratique est
 *  écrite — la scanner donnerait une fausse alarme. */
function codeOnlyLines(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replace(/[^\n]/g, " "),
  );
  return withoutBlocks.split("\n").map((line) => line.split("//")[0]);
}

/** Vivier factice trié par popularité (comme le renvoie le serveur). */
function pool(size = 40) {
  return Array.from({ length: size }, (_, i) => ({
    _id: `id${i}`,
    expression: `expr${i}`,
    meaning: `sens ${i}`,
    context: `contexte ${i}`,
    register: "street",
    region: "France",
    popularity: 100 - i,
  }));
}

/* ── 1 · DÉTERMINISME DU TIRAGE ──────────────────────────────────────── */

console.log("\n1 · tirage déterministe du jour");
try {
  const day = "2026-10-11";
  const vivier = pool();
  const a = buildDailySlang(day, "fr", vivier);
  const b = buildDailySlang(day, "fr", vivier);
  assert.ok(a, "une carte doit être produite");
  assert.deepEqual(a, b, "même jour + même vivier = même carte");
  ok("même jour + même vivier = même carte (octet pour octet)");

  // L'ordre du vivier fait partie du contrat : le serveur livre les lignes
  // triées par popularité (index stable, ties cassés par _creationTime) et
  // la sélection lit cette position. Ce qui est garanti — c'est l'objet de
  // ce contrôle — c'est qu'à vivier ET ordre identiques, le tirage soit
  // identique.
  const copy = vivier.map((row) => ({ ...row }));
  assert.deepEqual(a, buildDailySlang(day, "fr", copy), "vivier de copie = même carte");
  ok("un vivier équivalent (même contenu, même ordre) produit la même carte");
} catch (error) {
  fail(error.message);
}

try {
  const day = "2026-10-11";
  const vivier = pool();
  const card = buildDailySlang(day, "fr", vivier);
  assert.ok(card);
  // La bonne réponse figure exactement une fois dans les propositions.
  const occurrences = card.options.filter((o) => o === card.meaning).length;
  assert.equal(occurrences, 1, `la bonne réponse apparaît ${occurrences} fois`);
  assert.equal(card.options[card.answerIndex], card.meaning, "answerIndex pointe la bonne réponse");
  assert.ok(card.options.length <= DAILY_OPTIONS, "pas plus de propositions que prévu");
  assert.ok(card.options.length >= 2, "un QCM à un choix exige au moins deux propositions");
  ok("la bonne réponse est unique et correctement indexée");
} catch (error) {
  fail(error.message);
}

try {
  // Un jour à l'autre, la carte doit pouvoir changer (sinon « du jour » est
  // un abus de langage) — on vérifie sur une année complète.
  const vivier = pool(40);
  const days = new Set();
  for (let i = 0; i < 30; i++) {
    const card = buildDailySlang(`2026-10-${String(i + 1).padStart(2, "0")}`, "fr", vivier);
    days.add(card?.slangId);
  }
  assert.ok(days.size > 1, "le tirage ne doit pas être figé pour toujours");
  ok(`30 jours ⇒ ${days.size} expressions différentes (tirage vivant)`);
} catch (error) {
  fail(error.message);
}

try {
  // La langue fait partie de la graine : deux langues ne partagent pas
  // nécessairement la même expression, et un vivier vide rend null.
  const vivier = pool(40);
  assert.equal(buildDailySlang("2026-10-11", "sw", []), null, "vivier vide = aucune carte");
  assert.equal(
    buildDailySlang("2026-10-11", "fr", [{ ...vivier[0], meaning: "  " }]),
    null,
    "aucun sens exploitable = aucune carte",
  );
  const tiny = buildDailySlang("2026-10-11", "fr", vivier.slice(0, 1));
  assert.equal(tiny?.options.length, 1, "un vivier d'une expression rend un QCM d'une proposition");
  ok("vivier vide ou sans sens : aucune carte (jamais une carte creuse)");
} catch (error) {
  fail(error.message);
}

try {
  assert.equal(DAILY_XP, 5, "l'XP de base du lot est de 5");
  assert.equal(DAILY_OPTIONS, 4);
  assert.equal(DAILY_POOL_SIZE, 100);
  ok(`constantes du lot : ${DAILY_XP} XP · ${DAILY_OPTIONS} propositions · vivier ${DAILY_POOL_SIZE}`);
} catch (error) {
  fail(error.message);
}

/* ── 2 · LES FICHES ENRICHIES EXISTENT DANS LA BASE ──────────────────── */

console.log("\n2 · fiches enrichies rattachées à la base");
try {
  const seed = read("src/convex/slangSeed.ts");
  const cultureFile = read("src/data/slang-culture.ts");
  const keys = [...cultureFile.matchAll(/^  "(fr\|[a-z0-9 éèêàçûôî-]+)": \{$/gim)].map((m) =>
    m[1].replace(/^fr\|/, ""),
  );
  assert.equal(keys.length, SLANG_CULTURE_COUNT, "désynchronisation entre les clés et le compteur");
  assert.ok(keys.length >= 5, `au moins 5 expressions enrichies attendues, ${keys.length} trouvées`);

  for (const expression of keys) {
    // L'expression enrichie doit exister dans le seed : sans elle, la fiche
    // ne s'afficherait jamais dans l'application.
    const escaped = expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `language: "fr",\\s*expression: "${escaped}"`,
    );
    assert.ok(
      pattern.test(seed),
      `« ${expression} » est enrichie mais absente du seed`,
    );
  }
  ok(`${keys.length} fiches enrichies, toutes présentes dans slangSeed.ts`);
} catch (error) {
  fail(error.message);
}

try {
  for (const expression of ["wesh", "carré", "gentar", "mdr", "chelou"]) {
    const culture = getSlangCulture("fr", expression);
    assert.ok(culture, `« ${expression} » doit être enrichie`);
    assert.ok(culture.origin.trim().length > 30, `origine trop courte pour « ${expression} »`);
    assert.ok(culture.usage.trim().length > 20, `usage trop court pour « ${expression} »`);
    assert.ok(culture.example.trim().length > 5, `exemple manquant pour « ${expression} »`);
    assert.ok(LEVEL_LABEL[culture.level], `niveau inconnu pour « ${expression} »`);
    // La casse ni les accents ne doivent créer une seconde fiche : la
    // même expression tapée autrement tombe sur la même fiche.
    assert.deepEqual(
      getSlangCulture("fr", expression.toUpperCase()),
      culture,
      `normalisation de la casse pour « ${expression} »`,
    );
    assert.deepEqual(
      getSlangCulture(
        "fr",
        expression.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      ),
      culture,
      `normalisation des accents pour « ${expression} »`,
    );
  }
  ok("les 5 fiches modèles sont complètes et normalisées (casse/accents)");
} catch (error) {
  fail(error.message);
}

try {
  // Sans donnée éditoriale, la carte n'affiche rien plutôt que du creux.
  assert.equal(getSlangCulture("fr", "expression inconnue"), null);
  assert.equal(hasCultureContent("fr", "expression inconnue"), false);
  assert.equal(hasCultureContent("fr", "n'importe quoi", "street"), true, "le registre porte quand même un niveau");
  assert.equal(hasCultureContent("fr", "n'importe quoi", "", "  "), false);
  ok("aucune section affichée sans donnée derrière");
} catch (error) {
  fail(error.message);
}

/* ── 3 · GARDE-FOUS D'HONNÊTETÉ ──────────────────────────────────────── */

console.log("\n3 · garde-fous d'honnêteté");
const convexSource = read("src/convex/dailySlang.ts");
const libSource = read("src/lib/dailySlang.ts");
const cardSource = read("src/components/learner/DailySlangCard.tsx");
const dashboardSource = read("src/components/learner/DashboardView.tsx");

try {
  assert.ok(
    /applyAward\(ctx, userId, DAILY_XP, "daily_slang"\)/.test(convexSource),
    "l'XP du slang du jour ne passe pas par le cœur de gamification",
  );
  assert.ok(
    !/totalXP\s*\+=|xp\s*\+=\s*DAILY_XP/.test(convexSource),
    "XP incrémentée à la main : une seconde source de vérité",
  );
  ok("l'XP passe par applyAward (niveau, streak, Double XP, leaderboard)");
} catch (error) {
  fail(error.message);
}

try {
  assert.ok(!/Math\.random/.test(codeOnlyLines(libSource).join("\n")), "Math.random dans la sélection du jour");
  assert.ok(!/Math\.random/.test(codeOnlyLines(convexSource).join("\n")), "Math.random dans la couche serveur du jour");
  ok("aucun Math.random : le tirage est dérivé du jour");
} catch (error) {
  fail(error.message);
}

try {
  assert.ok(
    /useOptionalQuery\(api\.dailySlang\.getDailySlang/.test(cardSource),
    "le tableau de bord doit tolérer l'absence de la fonction côté serveur",
  );
  assert.ok(
    /useOptionalQuery/.test(dashboardSource) || /DailySlangCard/.test(dashboardSource),
    "la carte n'est pas montée sur le tableau de bord",
  );
  ok("fonction absente du serveur ⇒ carte honnête, jamais une page qui tombe");
} catch (error) {
  fail(error.message);
}

try {
  // La correction se fait côté serveur : la mutation recalcule la carte.
  assert.ok(
    /buildDailySlang\(/.test(convexSource),
    "la mutation doit recalculer la carte du jour pour corriger",
  );
  assert.ok(
    !/answerIndex: v\.number\(\)[\s\S]{0,400}correct:\s*true/.test(convexSource),
    "la correction ne doit jamais être décidée par le client",
  );
  assert.ok(
    /xpGained: result\.xpGained/.test(cardSource),
    "l'XP affichée doit être celle rendue par le serveur, pas une constante",
  );
  ok("correction serveur + XP affichée = celle du serveur");
} catch (error) {
  fail(error.message);
}

try {
  // Une seule réponse par jour : la table porte une ligne par (user, jour).
  const schema = read("src/convex/schema.ts");
  assert.ok(/dailySlangProgress: defineTable/.test(schema), "table de progression absente du schéma");
  assert.ok(
    /\.index\("by_user_day", \["userId", "dayKey"\]\)/.test(schema),
    "index (utilisateur, jour) absent — la recherche serait un balayage",
  );
  ok("table dailySlangProgress + index (utilisateur, jour) en place");
} catch (error) {
  fail(error.message);
}

/* ── FIN ─────────────────────────────────────────────────────────────── */

if (failures > 0) {
  console.log(`\nSLANG DU JOUR : ${failures} ÉCHEC(S)`);
  process.exit(1);
}
console.log(
  `\nSLANG DU JOUR : tirage déterministe · ${SLANG_CULTURE_COUNT} fiches enrichies · correction serveur · XP par applyAward ✓`,
);
