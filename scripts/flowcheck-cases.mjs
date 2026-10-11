/* ═══════════════════════════════════════════════════════════════════════
   FLOW CHECK — CAS D'ÉPREUVE PARTAGÉS

   Une seule source de vérité, exécutée par deux coureurs :
     • `scripts/verify-flowcheck.mjs` (Node, intégré à `verify:honesty`,
       donc exécuté à chaque push par le workflow `verify`) ;
     • `tests/flowCheck.test.ts` (bun test, pour les développeurs).

   Chaque cas porte sur le module PUR `src/lib/flowCheck.ts` : aucun
   navigateur, aucun réseau, aucun modèle à télécharger.

   Le score n'a qu'un sens — « quelle part de l'expression le moteur a
   reconnue ? » — donc les cas s'écrivent en couverture : 4 mots sur 5
   reconnus valent 80 %, un mot en trop ne retire rien.
   ═══════════════════════════════════════════════════════════════════════ */

import assert from "node:assert/strict";
import {
  FLOW_CLOSE_THRESHOLD,
  FLOW_PASS_THRESHOLD,
  compareFlow,
  evaluateFlow,
  flowTokens,
  flowTempo,
  flowVerdict,
  flowWordsFromSegments,
  normalizeFlowText,
} from "../src/lib/flowCheck.ts";

export const CASES = [
  {
    name: "normalisation : casse, accents, ponctuation, apostrophes",
    run() {
      assert.equal(normalizeFlowText("Ça  va   l'aller !"), "ca va l aller");
      assert.equal(normalizeFlowText("Wesh Reuf, t'as capté ?"), "wesh reuf t as capte");
      assert.deepEqual(flowTokens("Wesh Reuf, t'as capté ?"), [
        "wesh",
        "reuf",
        "t",
        "as",
        "capte",
      ]);
      // Une chaîne sans mot ne produit aucun jeton (jamais un faux match).
      assert.deepEqual(flowTokens("   ,, !! "), []);
    },
  },
  {
    name: "expression identique ⇒ 100 %, rien à retravailler",
    run() {
      const r = compareFlow("Wesh reuf, t'as capté ?", "Wesh reuf t'as capté");
      assert.equal(r.coverage, 100);
      assert.deepEqual(r.missing, []);
      assert.deepEqual(r.extra, []);
      assert.equal(flowVerdict(r.coverage), "passed");
    },
  },
  {
    name: "un mot sur cinq mal reconnu ⇒ 80 %, le mot manquant est NOMMÉ",
    run() {
      const r = compareFlow("Wesh reuf t'as capté", "Wesh reuf t'as mangé");
      assert.equal(r.coverage, 80);
      assert.deepEqual(r.missing, ["capte"]);
      assert.deepEqual(r.extra, ["mange"]);
      assert.equal(flowVerdict(r.coverage), "passed");
    },
  },
  {
    name: "moitié de la phrase ⇒ score bas ET détail des mots manquants",
    run() {
      const r = compareFlow("wesh reuf t'as capté le délire", "wesh reuf");
      assert.equal(r.coverage, 29);
      assert.deepEqual(r.missing, ["t", "as", "capte", "le", "delire"]);
      assert.equal(flowVerdict(r.coverage), "failed");
    },
  },
  {
    name: "mots en trop ⇒ signalés, mais ils ne coulent pas la prise",
    run() {
      const r = compareFlow("wesh", "wesh wesh wesh");
      assert.equal(r.coverage, 100);
      assert.deepEqual(r.missing, []);
      assert.deepEqual(r.extra, ["wesh", "wesh"]);
      assert.equal(flowVerdict(r.coverage), "passed");
    },
  },
  {
    name: "expression noyée dans une phrase plus longue ⇒ toujours validée",
    run() {
      // Cas RÉEL : sur un extrait de 11 s, la prise commençait par « And so
      // my fellow Americans… » et une expression parfaitement prononcée
      // était refusée (41 %) tant que le score était une distance d'édition.
      const r = compareFlow(
        "wesh reuf t'as capté",
        "bon alors euh wesh reuf t'as capté quoi",
      );
      assert.equal(r.coverage, 100);
      assert.deepEqual(r.missing, []);
      assert.deepEqual(r.extra, ["bon", "alors", "euh", "quoi"]);
      assert.equal(flowVerdict(r.coverage), "passed");
    },
  },
  {
    name: "phrase sans rapport ⇒ 0 %, tout est manquant",
    run() {
      const r = compareFlow("wesh reuf", "bonjour madame");
      assert.equal(r.coverage, 0);
      assert.deepEqual(r.missing, ["wesh", "reuf"]);
      assert.deepEqual(r.extra, ["bonjour", "madame"]);
      assert.equal(flowVerdict(r.coverage), "failed");
    },
  },
  {
    name: "expression vide ⇒ aucun score inventé",
    run() {
      const r = compareFlow("", "wesh");
      assert.equal(r.coverage, 0);
      assert.deepEqual(r.expected, []);
      assert.deepEqual(r.missing, []);
    },
  },
  {
    name: "transcription vide ⇒ « aucune parole », JAMAIS un score de 0 %",
    run() {
      assert.equal(evaluateFlow("wesh reuf", "").kind, "no-speech");
      assert.equal(evaluateFlow("wesh reuf", "  ,, … ").kind, "no-speech");
      const scored = evaluateFlow("wesh reuf", "wesh reuf");
      assert.equal(scored.kind, "scored");
      if (scored.kind !== "scored") return;
      assert.equal(scored.comparison.coverage, 100);
      assert.equal(scored.verdict, "passed");
    },
  },
  {
    name: "le score suit la couverture : 5/5, 4/5, 2/5, 1/5",
    run() {
      const cobertura = (taken) =>
        compareFlow("wesh reuf t'as capte", taken).coverage;
      const scores = [
        cobertura("wesh reuf t'as capte"),
        cobertura("wesh reuf t'as"),
        cobertura("wesh reuf"),
        cobertura("wesh"),
      ];
      assert.deepEqual(scores, [100, 80, 40, 20]);
      for (let i = 1; i < scores.length; i++) {
        assert.ok(scores[i] < scores[i - 1], "la couverture doit décroître");
      }
    },
  },
  {
    name: "seuil de réussite : 70 passe, 69 reste « presque », 44 échoue",
    run() {
      assert.equal(FLOW_PASS_THRESHOLD, 70);
      assert.equal(FLOW_CLOSE_THRESHOLD, 45);
      assert.equal(flowVerdict(100), "passed");
      assert.equal(flowVerdict(70), "passed");
      assert.equal(flowVerdict(69), "close");
      assert.equal(flowVerdict(45), "close");
      assert.equal(flowVerdict(44), "failed");
      assert.equal(flowVerdict(0), "failed");
    },
  },
  {
    name: "débit : calculé sur les horodatages réels, jamais estimé",
    run() {
      const steady = flowTempo([
        { word: "a", start: 0, end: 0.5 },
        { word: "b", start: 0.5, end: 1 },
        { word: "c", start: 1, end: 1.5 },
      ]);
      assert.deepEqual(steady, { seconds: 1.5, words: 3, wpm: 120, band: "steady" });

      const slow = flowTempo([
        { word: "a", start: 0, end: 1 },
        { word: "b", start: 2, end: 3 },
      ]);
      assert.equal(slow?.band, "slow");
      assert.equal(slow?.wpm, 40);

      const fast = flowTempo([
        { word: "a", start: 0, end: 0.2 },
        { word: "b", start: 0.2, end: 0.4 },
        { word: "c", start: 0.4, end: 0.6 },
        { word: "d", start: 0.6, end: 0.8 },
        { word: "e", start: 0.8, end: 1 },
      ]);
      assert.equal(fast?.band, "fast");
      assert.equal(fast?.wpm, 300);
    },
  },
  {
    name: "débit : rien à annoncer ⇒ null (aucun chiffre fabriqué)",
    run() {
      assert.equal(flowTempo([]), null);
      assert.equal(flowTempo([{ word: "seul", start: 0, end: 1 }]), null);
      // Durée nulle : deux mots au même instant ne font pas un débit.
      assert.equal(
        flowTempo([
          { word: "a", start: 1, end: 1 },
          { word: "b", start: 1, end: 1 },
        ]),
        null,
      );
      // Horodatage incohérent (end < start) écarté du calcul.
      assert.equal(
        flowTempo([
          { word: "a", start: 0, end: 1 },
          { word: "b", start: 0.2, end: 0.1 },
        ]),
        null,
      );
      assert.equal(flowTempo([{ word: "a", start: NaN, end: 1 }]), null);
    },
  },
  {
    name: "mots horodatés : aplatis dans l'ordre, même entre segments",
    run() {
      const words = flowWordsFromSegments([
        { words: [{ word: "b", start: 1, end: 1.2 }] },
        {},
        { words: [{ word: "a", start: 0, end: 0.5 }] },
      ]);
      assert.deepEqual(words.map((w) => w.word), ["a", "b"]);
    },
  },
  {
    name: "verdict intégré : la prise porte son débit et son issue",
    run() {
      const out = evaluateFlow("wesh reuf", "wesh reuf", [
        { word: "wesh", start: 0, end: 0.4 },
        { word: "reuf", start: 0.4, end: 0.8 },
      ]);
      assert.equal(out.kind, "scored");
      if (out.kind !== "scored") return;
      assert.equal(out.verdict, "passed");
      assert.equal(out.tempo?.wpm, 150);
    },
  },
];
