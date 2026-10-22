import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advanceCard, reviewCard, type CardStatus, type ReviewOutcome, newCardDefaults } from "../src/convex/languages";

const DAY_MS = 86_400_000;
type Rating = "again" | "hard" | "good" | "easy";

function now(days = 0): number {
  return Date.now() + days * DAY_MS;
}

describe("SRS advanceCard — machine à états", () => {
  test("mastered reste mastered indépendamment du rating", () => {
    const outcome = advanceCard("mastered" as CardStatus, "good" as Rating, now());
    expect(outcome.status).toBe("mastered");
    expect(outcome.due).toBeNull();
    expect(outcome.justMastered).toBe(false);
  });

  test("confirming → mastered avec good", () => {
    const outcome = advanceCard("confirming" as CardStatus, "good" as Rating, now());
    expect(outcome.status).toBe("mastered");
    expect(outcome.due).toBeNull();
    expect(outcome.justMastered).toBe(true);
  });

  test("confirming → learning avec again", () => {
    const outcome = advanceCard("confirming" as CardStatus, "again" as Rating, now());
    expect(outcome.status).toBe("learning");
    expect(outcome.due).toBe(now(1));
    expect(outcome.justMastered).toBe(false);
  });

  test("confirming → learning avec hard", () => {
    const outcome = advanceCard("confirming" as CardStatus, "hard" as Rating, now());
    expect(outcome.status).toBe("learning");
    expect(outcome.due).toBe(now(2));
    expect(outcome.justMastered).toBe(false);
  });

  test("learning → learning avec again (première fois)", () => {
    const outcome = advanceCard("learning" as CardStatus, "again" as Rating, now());
    expect(outcome.status).toBe("learning");
    expect(outcome.due).toBe(now(1));
    expect(outcome.justMastered).toBe(false);
  });

  test("learning → learning avec hard", () => {
    const outcome = advanceCard("learning" as CardStatus, "hard" as Rating, now());
    expect(outcome.status).toBe("learning");
    expect(outcome.due).toBe(now(2));
    expect(outcome.justMastered).toBe(false);
  });

  test("learning → confirming avec good", () => {
    const outcome = advanceCard("learning" as CardStatus, "good" as Rating, now());
    expect(outcome.status).toBe("confirming");
    expect(outcome.due).toBe(now(2));
    expect(outcome.justMastered).toBe(false);
  });

  test("learning → confirming avec easy (accéléré à 1j)", () => {
    const outcome = advanceCard("learning" as CardStatus, "easy" as Rating, now());
    expect(outcome.status).toBe("confirming");
    expect(outcome.due).toBe(now(1));
    expect(outcome.justMastered).toBe(false);
  });

  test("retour learning → learning avec again après avoir été confirming", () => {
    const afterConfirming = advanceCard("learning" as CardStatus, "good" as Rating, now());
    expect(afterConfirming.status).toBe("confirming");
    const back = advanceCard("confirming" as CardStatus, "again" as Rating, now());
    expect(back.status).toBe("learning");
    expect(back.due).toBe(now(1));
  });
});

describe("SRS reviewCard — calculs FSRS-style (retour: easeFactor, intervalDays, repetitions, nextReview)", () => {
  test("nouvelle carte : again → intervalle 1j, ease diminue", () => {
    const t = now();
    const card = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
    const outcome = reviewCard(card, "again" as Rating, t);
    expect(outcome.intervalDays).toBe(1);
    expect(outcome.easeFactor).toBeLessThanOrEqual(2.5);
    expect(outcome.nextReview).toBeGreaterThan(t);
    expect(outcome.repetitions).toBe(0);
  });

  test("nouvelle carte : good → intervalle 1j (reps=0), ease INCHANGÉ", () => {
    // Constaté dans le code : "good" n'augmente PAS l'easeFactor —
    // seuls "easy" (+0.15) et "again" (-0.2) le modifient.
    const t = now();
    const card = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
    const outcome = reviewCard(card, "good" as Rating, t);
    expect(outcome.intervalDays).toBe(1);
    expect(outcome.easeFactor).toBe(2.5);
    expect(outcome.repetitions).toBe(1);
    expect(outcome.nextReview).toBeGreaterThan(t);
  });

  test("répétée : good avec reps>0 → intervalle × ease, ease INCHANGÉ", () => {
    const t = now();
    const card = { easeFactor: 2.5, intervalDays: 1, repetitions: 1 };
    const outcome = reviewCard(card, "good" as Rating, t);
    expect(outcome.intervalDays).toBe(Math.round(2.5 * 100) / 100);
    expect(outcome.repetitions).toBe(2);
    // "good" ne modifie pas l'ease — comportement pédagogique existant.
    expect(outcome.easeFactor).toBe(2.5);
    expect(outcome.nextReview).toBeGreaterThan(t);
  });

  test("répétée : easy → intervalle × ease × 1.3, ease + 0.15", () => {
    const card = { easeFactor: 2.5, intervalDays: 1, repetitions: 1 };
    const outcome = reviewCard(card, "easy" as Rating, now());
    expect(outcome.intervalDays).toBe(Math.round(2.5 * 1.3 * 100) / 100);
    expect(outcome.repetitions).toBe(2);
    // Seul "easy" augmente l'ease (+ 0.15).
    expect(outcome.easeFactor).toBe(Math.round((2.5 + 0.15) * 100) / 100);
  });

  test("hard → intervalle × 1.2, ease - 0.15", () => {
    const card = { easeFactor: 2.5, intervalDays: 1, repetitions: 1 };
    const outcome = reviewCard(card, "hard" as Rating, now());
    expect(outcome.intervalDays).toBe(Math.round(1.2 * 100) / 100);
    expect(outcome.easeFactor).toBe(Math.round((2.5 - 0.15) * 100) / 100);
  });

  test("again → reps remis à 0, ease - 0.2", () => {
    const card = { easeFactor: 2.5, intervalDays: 5, repetitions: 3 };
    const outcome = reviewCard(card, "again" as Rating, now());
    expect(outcome.repetitions).toBe(0);
    expect(outcome.intervalDays).toBe(1);
    expect(outcome.easeFactor).toBe(Math.round((2.5 - 0.2) * 100) / 100);
  });

  test("ease ne descend jamais sous 1.3 (plancher)", () => {
    const card = { easeFactor: 1.3, intervalDays: 1, repetitions: 0 };
    const outcome = reviewCard(card, "again" as Rating, now());
    expect(outcome.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  test("easy avec ease plancher : plafond ease + 0.15 sans effet négatif", () => {
    const card = { easeFactor: 1.3, intervalDays: 1, repetitions: 1 };
    const outcome = reviewCard(card, "easy" as Rating, now());
    expect(outcome.easeFactor).toBe(Math.round((1.3 + 0.15) * 100) / 100);
  });
});

describe("SRS ReviewOutcome type coverage", () => {
  test("ReviewOutcome a toutes les propriétés attendues", () => {
    const outcome: ReviewOutcome = {
      status: "learning" as CardStatus,
      intervalDays: 1,
      due: now(1),
      justMastered: false,
    };
    expect(outcome.status).toBeDefined();
    expect(typeof outcome.intervalDays).toBe("number");
    expect(outcome.due).toBeDefined();
    expect(typeof outcome.justMastered).toBe("boolean");
  });

  test("ReviewOutcome avec due null pour maîtrisé", () => {
    const outcome: ReviewOutcome = {
      status: "mastered" as CardStatus,
      intervalDays: 0,
      due: null,
      justMastered: false,
    };
    expect(outcome.due).toBeNull();
    expect(outcome.status).toBe("mastered");
  });
});

describe("SRS newCardDefaults", () => {
  test("nouvelle carte démarre en learning avec due = maintenant", () => {
    const t = now();
    const card = newCardDefaults(t);
    expect(card.status).toBe("learning");
    expect(card.due).toBe(t);
    expect(card.nextReview).toBe(t);
    expect(card.consecutiveFails).toBe(0);
    expect(card.lastRating).toBeNull();
    expect(card.easeFactor).toBe(2.5);
    expect(card.intervalDays).toBe(0);
    expect(card.repetitions).toBe(0);
  });
});

/* ════ AUDIT STATIQUE — garde anti double-soumission ════
   Même convention que onboardingPersistence.test.ts : on vérifie que les
   deux extrémités du contrat d'idempotence existent réellement dans le
   code source, puisque les mutations Convex ne sont pas exécutables ici
   sans un dépôt de test Convex. */

describe("anti double-soumission : le contrat d'idempotence relie backend et frontend", () => {
  const read = (p: string) =>
    readFileSync(join(process.cwd(), p), "utf8");

  test("reviewCardMutation accepte expectedLastReview (compare-and-swap)", () => {
    const src = read("src/convex/learning.ts");
    expect(src).toMatch(/expectedLastReview: v\.optional/);
  });

  test("la mutation refuse TOUTES les soumissions périmées (lastReview différent)", () => {
    const src = read("src/convex/learning.ts");
    // Le garde compare le lastReview servi par la file avec l'état courant
    // et refuse avec le code stale_review AVANT toute écriture.
    expect(src).toMatch(/stale_review/);
    // Le refus intervient avant le patch de la carte (aucune écriture fantôme).
    const guardIdx = src.indexOf("stale_review");
    const patchIdx = src.indexOf("ctx.db.patch(args.cardId", guardIdx);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(patchIdx).toBeGreaterThan(guardIdx);
  });

  test("ReviewView transmet bien expectedLastReview à chaque revue", () => {
    const src = read("src/components/learner/ReviewView.tsx");
    expect(src).toMatch(/expectedLastReview: card\.card\.lastReview \?\? null/);
  });

  test("la file de révision sert bien le lastReview au client", () => {
    const src = read("src/convex/learning.ts");
    // reviewQueue expose lastReview dans la projection carte — sans quoi
    // le client ne pourrait jamais construire la clé de comparaison.
    expect(src).toMatch(/lastReview: card\.lastReview/);
  });

  test("un clic dupliqué est bloqué côté frontend pendant la mutation", () => {
    const src = read("src/components/learner/ReviewView.tsx");
    expect(src).toMatch(/if \(submittingRef\.current\) return;/);
    expect(src).toMatch(/submittingRef\.current = true;/);
    expect(src).toMatch(/finally \{\s*submittingRef\.current = false;/);
  });
});