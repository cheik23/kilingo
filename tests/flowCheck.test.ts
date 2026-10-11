import { describe, test } from "bun:test";
import { CASES } from "../scripts/flowcheck-cases.mjs";
import {
  FLOW_PASS_THRESHOLD,
  compareFlow,
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

  test("une transcription vide ne produit jamais de score", () => {
    const empty = compareFlow("wesh reuf", "");
    // Le calcul pur reste à 0 ; c'est `evaluateFlow` qui renvoie
    // « aucune parole » et l'interface qui n'affiche alors AUCUN score.
    if (empty.score !== 0 || empty.coverage !== 0) {
      throw new Error("un score a été inventé sur une transcription vide");
    }
    if (flowVerdict(empty.score) !== "failed") {
      throw new Error("une prise vide ne peut pas être déclarée réussie");
    }
  });
});
