import { describe, test } from "bun:test";
import { CASES } from "../scripts/flowcheck-cases.mjs";
import {
  FLOW_PASS_THRESHOLD,
  compareFlow,
  evaluateFlow,
  flowVerdict,
} from "../src/lib/flowCheck";

/* ═══════════════════════════════════════════════════════════════════════
   FLOW CHECK — SUITE BUN

   Les cas eux-mêmes vivent dans `scripts/flowcheck-cases.mjs` : le même
   jeu tourne ici (`bun test`) et dans `scripts/verify-flowcheck.mjs`
   (Node, appelé par `verify:honesty`, donc par le workflow `verify`).
   Une seule source de vérité, deux coureurs — pas deux jeux d'assertions
   qui divergent en silence.

   Aucun modèle n'est téléchargé ici : le module testé est PUR. La
   transcription réelle (Whisper ONNX) est couverte par
   `tests/localEngines.test.ts`.
   ═══════════════════════════════════════════════════════════════════════ */

describe("Flow Check — calcul de la reconnaissance", () => {
  for (const testCase of CASES) {
    test(testCase.name, () => {
      testCase.run();
    });
  }
});

describe("Flow Check — invariants de lecture", () => {
  test("le seuil de réussite est unique et vaut 70 %", () => {
    if (FLOW_PASS_THRESHOLD !== 70) {
      throw new Error(`seuil dérivé : ${FLOW_PASS_THRESHOLD}`);
    }
  });

  test("une transcription vide ou blanche ne produit jamais de score", () => {
    /* Contrat réel : FlowComparison expose le score sous `coverage` (0-100).
       Le calcul pur sur une transcription vide reste à 0 : aucun compteur
       n'est inventé, `extra` est vide (on ne peut pas reprocher à un moteur
       muet des mots en trop), et le verdict dérivé ne peut jamais être
       « réussi ». */
    const empty = compareFlow("wesh reuf", "");
    if (empty.coverage !== 0) {
      throw new Error(`un score a été inventé sur une transcription vide : ${empty.coverage}`);
    }
    if (empty.extra.length !== 0) {
      throw new Error("des mots « entendus » ont été inventés sur une prise vide");
    }
    if (flowVerdict(empty.coverage) !== "failed") {
      throw new Error("une prise vide ne peut pas être déclarée réussie");
    }

    /* Point d'entrée réel de l'interface (celui que PronunciationCheck
       consomme) : une transcription vide ou composée d'espaces/tabulations
       est un « aucune parole » (kind: "no-speech") — jamais un score, réel
       ou nul. La séparation absence-de-score / score-numérique est portée
       par le discriminant `kind`, pas par une valeur magique. */
    for (const blank of ["", "   ", "\t\t", " \t \n "]) {
      const outcome = evaluateFlow("wesh reuf", blank);
      if (outcome.kind !== "no-speech") {
        throw new Error(
          `un score a été inventé pour une transcription « ${JSON.stringify(blank)} »`,
        );
      }
    }

    /* Contre-preuve : une transcription réelle reste évaluable, avec son
       scoring complet — la garde « blanc » ne mange pas les prises valides. */
    const ok = evaluateFlow("wesh reuf", "wesh reuf t'as capté");
    if (ok.kind !== "scored") {
      throw new Error("une prise valide est tombée dans le cas « aucune parole »");
    }
    if (ok.comparison.coverage !== 100 || ok.verdict !== "passed") {
      throw new Error(
        `scoring valide dégradé : coverage ${ok.comparison.coverage} / ${ok.verdict}`,
      );
    }
  });
});
