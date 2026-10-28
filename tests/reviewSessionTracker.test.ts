import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createReviewSessionSaver,
  createReviewSessionTracker,
  firstPendingCard,
  needsNewBatch,
  takeIfComplete,
  type PendingSessionSave,
} from "../src/lib/reviewSessionTracker";

/**
 * Défauts corrigés dans ReviewView :
 *  1. closure `reviewed` périmée → off-by-one sur la dernière carte, et
 *     session d'exactement une carte jamais enregistrée ;
 *  2. `sessionSaved` jamais réarmé → les cartes rechargées dans la même vue
 *     ne déclenchaient aucun recordSession ;
 *  3. avancement par index dans une file Convex vivante → la carte suivante
 *     pouvait être sautée quand la file se rétrécissait.
 *
 * Les tests ci-dessous exercent les primitives RÉELLEMENT utilisées par le
 * composant : `accept`, `firstPendingCard`, `takeIfComplete`, `take`.
 */

type Card = { card: { _id: string; language?: string } };

const card = (id: string, language = "en"): Card => ({
  card: { _id: id, language },
});

describe("reviewSessionTracker — comptage synchrone", () => {
  test("accept() compte immédiatement, sans attendre un re-render React", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const result = tracker.accept("a", tracker.sessionId());
    expect(result.counted).toBe(true);
    expect(result.count).toBe(1);
    expect(tracker.count()).toBe(1);
  });

  test("une seule carte acceptée donne itemsLearned=1 (pas 0)", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    expect(takeIfComplete([card("a")], tracker)?.itemsLearned).toBe(1);
  });

  test("N cartes acceptées : la dernière est incluse dans le total", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = [card("a"), card("b"), card("c")];
    for (const item of cards.slice(0, 2)) {
      tracker.accept(item.card._id, tracker.sessionId());
      expect(takeIfComplete(cards, tracker)).toBeNull();
    }
    tracker.accept("c", tracker.sessionId());
    expect(takeIfComplete(cards, tracker)?.itemsLearned).toBe(3);
  });

  test("une revue refusée (non acceptée) ne compte pas et ne consomme pas", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = [card("a"), card("b")];
    // Échec backend : le composant n'appelle pas accept().
    expect(tracker.count()).toBe(0);
    expect(takeIfComplete(cards, tracker)).toBeNull();
    expect(tracker.count()).toBe(0);
  });

  test("après un échec, une tentative réussie sur la MÊME carte compte 1", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = [card("a")];
    // Échec : aucun accept, pas de consommation, la carte reste courante.
    expect(takeIfComplete(cards, tracker)).toBeNull();
    expect(firstPendingCard(cards, tracker.acceptedIds())?.card._id).toBe("a");
    // Nouvelle tentative réussie sur la même carte.
    tracker.accept("a", tracker.sessionId());
    expect(firstPendingCard(cards, tracker.acceptedIds())).toBeUndefined();
    expect(takeIfComplete(cards, tracker)?.itemsLearned).toBe(1);
  });

  test("un rating « again » accepté reste une révision comptée", () => {
    // Le rating décrit la qualité de la réponse, pas le succès de l'écriture :
    // une revue « again » persistée par le backend est bien une carte revue.
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    expect(takeIfComplete([card("a")], tracker)?.itemsLearned).toBe(1);
  });

  test("une carte déjà acceptée n'est jamais comptée deux fois", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const id = tracker.sessionId();
    expect(tracker.accept("a", id).count).toBe(1);
    const duplicate = tracker.accept("a", id);
    expect(duplicate.counted).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(tracker.count()).toBe(1);
  });
});

describe("reviewSessionTracker — sélection de carte (file vivante)", () => {
  test("après un échec, la carte courante reste la même", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = [card("a"), card("b")];
    expect(firstPendingCard(cards, tracker.acceptedIds())?.card._id).toBe("a");
    // Échec : aucun accept. La carte reste disponible pour une tentative.
    expect(firstPendingCard(cards, tracker.acceptedIds())?.card._id).toBe("a");
  });

  test("après une réussite, la carte suivante est affichée sans index périmé", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = [card("a"), card("b")];
    tracker.accept("a", tracker.sessionId());
    expect(firstPendingCard(cards, tracker.acceptedIds())?.card._id).toBe("b");
  });

  test("la file qui se rétrécit ne fait pas sauter la carte suivante", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    // File affichée au clic : [a, b, c]. Après revue de a, Convex retire a.
    const liveAfterReview = [card("b"), card("c")];
    tracker.accept("a", tracker.sessionId());
    expect(firstPendingCard(liveAfterReview, tracker.acceptedIds())?.card._id).toBe(
      "b",
    );
  });

  test("une carte acceptée dans un batch précédent n'est pas réaffichée", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    const taken = takeIfComplete([card("a")], tracker);
    expect(taken?.itemsLearned).toBe(1);
    // La requête Convex n'a pas encore retiré a : la file le contient encore.
    expect(firstPendingCard([card("a"), card("b")], tracker.acceptedIds())?.card._id).toBe(
      "b",
    );
  });
});

describe("reviewSessionTracker — identification d'un nouveau lot", () => {
  test("lot inconnu (montage) → nouvelle session", () => {
    expect(needsNewBatch(null, [card("a")], new Set(), "a")).toBe(true);
  });

  test("carte du lot courant → même session (pas de reset parasite)", () => {
    expect(
      needsNewBatch(new Set(["a", "b"]), [card("a"), card("b")], new Set(), "a"),
    ).toBe(false);
  });

  test("lot précédent entièrement accepté, nouveau lot → nouvelle session", () => {
    // Convex remplace la file sans rendre d'état vide intermédiaire.
    expect(
      needsNewBatch(
        new Set(["a", "b"]),
        [card("c"), card("d")],
        new Set(["a", "b"]),
        "c",
      ),
    ).toBe(true);
  });

  test("carte injectée alors qu'une carte du lot attend → pas de coupure", () => {
    expect(
      needsNewBatch(
        new Set(["a", "b"]),
        [card("a"), card("b"), card("x")],
        new Set(["a"]),
        "x",
      ),
    ).toBe(false);
  });

  test("lot vidé puis lot identique rechargé → nouvelle session", () => {
    // ReviewView remet batchIdsRef à null quand la file devient vide : un lot
    // identique rechargé plus tard ne doit pas être absorbé par l'ancienne.
    expect(needsNewBatch(null, [card("a")], new Set(["a"]), "a")).toBe(true);
  });
});

describe("reviewSessionTracker — consommation unique", () => {
  test("take() renvoie le total puis remet le compteur à zéro", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    expect(tracker.lastItemsLearned()).toBe(0);
    for (const id of ["a", "b", "c"]) tracker.accept(id, tracker.sessionId());
    const first = tracker.take();
    expect(first.itemsLearned).toBe(3);
    expect(tracker.count()).toBe(0);
    expect(tracker.lastItemsLearned()).toBe(3);
    expect(tracker.take().itemsLearned).toBe(0);
  });

  test("start() efface le total du lot précédent (pas de résumé périmé)", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    tracker.take();
    expect(tracker.lastItemsLearned()).toBe(1);
    tracker.start();
    expect(tracker.lastItemsLearned()).toBe(0);
  });

  test("takeIfComplete() ne consomme pas deux fois le même lot", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    const first = takeIfComplete([card("a")], tracker);
    expect(first?.itemsLearned).toBe(1);
    const second = takeIfComplete([card("a")], tracker);
    expect(second).toBeNull();
  });

  test("take() change l'identité de session", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const id = tracker.sessionId();
    tracker.accept("a", id);
    const snapshot = tracker.take();
    expect(snapshot.sessionId).toBe(id);
    expect(tracker.sessionId()).not.toBe(id);
  });
});

describe("reviewSessionTracker — sessions successives", () => {
  test("une deuxième session démarre à zéro et se sauvegarde indépendamment", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    const first = takeIfComplete([card("a")], tracker)!;
    expect(first.itemsLearned).toBe(1);

    tracker.start();
    expect(tracker.count()).toBe(0);
    tracker.accept("b", tracker.sessionId());
    const second = takeIfComplete([card("b")], tracker)!;
    expect(second.itemsLearned).toBe(1);
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  test("une réponse tardive d'une ancienne session ne modifie pas la nouvelle", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const oldSession = tracker.sessionId();
    tracker.accept("a", oldSession);
    takeIfComplete([card("a")], tracker);
    tracker.start();
    expect(tracker.count()).toBe(0);

    const late = tracker.accept("late", oldSession);
    expect(late.staleSession).toBe(true);
    expect(late.counted).toBe(false);
    expect(tracker.count()).toBe(0);
  });

  test("les identifiants acceptés survivent au batch mais le compteur non", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    takeIfComplete([card("a")], tracker);
    tracker.start();
    expect(tracker.isAccepted("a")).toBe(true);
    expect(tracker.count()).toBe(0);
  });

  test("take() fournit une clé d'idempotence propre à chaque session", () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    const first = takeIfComplete([card("a")], tracker)!;
    expect(first.sessionKey).toMatch(/^srs_[A-Za-z0-9_-]+$/);

    tracker.start();
    tracker.accept("b", tracker.sessionId());
    const second = takeIfComplete([card("b")], tracker)!;
    expect(second.sessionKey).toMatch(/^srs_[A-Za-z0-9_-]+$/);
    expect(second.sessionKey).not.toBe(first.sessionKey);
  });
});

describe("reviewSessionSaver — sauvegarde idempotente", () => {
  const pending = (sessionId: number, itemsLearned = 1): PendingSessionSave => ({
    snapshot: {
      sessionId,
      sessionKey: `test-session-${sessionId}`,
      itemsLearned,
      durationSeconds: 3,
      startedAt: 0,
    },
    language: "en",
  });

  test("une session terminée n'est sauvegardée qu'une fois", async () => {
    const saved: number[] = [];
    const saver = createReviewSessionSaver(async (p) => {
      saved.push(p.snapshot.sessionId);
    });
    saver.enqueue(pending(1));
    await saver.flush();
    await saver.flush(); // re-render / effet réexécuté
    expect(saved).toEqual([1]);
    expect(saver.pending()).toBe(0);
  });

  test("un même sessionId ré-enfilé n'est jamais rejoué", async () => {
    const saved: number[] = [];
    const saver = createReviewSessionSaver(async (p) => {
      saved.push(p.snapshot.sessionId);
    });
    saver.enqueue(pending(7));
    await saver.flush();
    saver.enqueue(pending(7));
    await saver.flush();
    expect(saved).toEqual([7]);
    expect(saver.pending()).toBe(0);
  });

  test("un échec conserve le lot et la tentative suivante le sauvegarde", async () => {
    let attempts = 0;
    const saved: number[] = [];
    const saver = createReviewSessionSaver(async (p) => {
      attempts += 1;
      if (attempts === 1) throw new Error("réseau");
      saved.push(p.snapshot.sessionId);
    });
    const lot = pending(4, 2);
    saver.enqueue(lot);
    await saver.flush();
    expect(saved).toEqual([]);
    expect(saver.pending()).toBe(1); // total non perdu
    await saver.flush();
    expect(saved).toEqual([4]);
    expect(saver.pending()).toBe(0);
  });

  test("un retry réutilise la clé d'idempotence du snapshot", async () => {
    let attempts = 0;
    const keys: string[] = [];
    const saver = createReviewSessionSaver(async (p) => {
      attempts += 1;
      keys.push(p.snapshot.sessionKey);
      // Première tentative : le serveur a peut-être écrit, mais la réponse
      // est perdue. La seconde doit rejouer EXACTEMENT la même clé.
      if (attempts === 1) throw new Error("réseau");
    });
    const lot = pending(12);
    saver.enqueue(lot);
    await saver.flush();
    await saver.flush();
    expect(keys).toEqual([
      lot.snapshot.sessionKey,
      lot.snapshot.sessionKey,
    ]);
    expect(saver.pending()).toBe(0);
  });

  test("deux sessions successives sont persistées séparément", async () => {
    const saved: number[] = [];
    const saver = createReviewSessionSaver(async (p) => {
      saved.push(p.snapshot.sessionId);
    });
    saver.enqueue(pending(1, 1));
    await saver.flush();
    saver.enqueue(pending(2, 3));
    await saver.flush();
    expect(saved).toEqual([1, 2]);
  });

  test("deux flush concurrents ne doublent pas la sauvegarde", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const saver = createReviewSessionSaver(async () => {
      calls += 1;
      await gate;
    });
    saver.enqueue(pending(9));
    const first = saver.flush();
    const second = saver.flush();
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(saver.pending()).toBe(0);
  });

  test("un succès expose le reçu serveur exact et un état stable", async () => {
    const lot = pending(21, 3);
    const saver = createReviewSessionSaver(async () => ({
      xpGain: 16,
      streak: 4,
    }));
    saver.enqueue(lot);
    expect(saver.state().pending).toBe(1);
    expect(saver.state().inFlight).toBe(false);
    await saver.flush();

    const state = saver.state();
    expect(state.pending).toBe(0);
    expect(state.inFlight).toBe(false);
    expect(state.error).toBeNull();
    expect(state.head).toBeNull();
    expect(state.receipts[lot.snapshot.sessionKey]).toEqual({
      sessionKey: lot.snapshot.sessionKey,
      itemsLearned: 3,
      xpGain: 16,
      streak: 4,
    });
    expect(saver.receipt(lot.snapshot.sessionKey)?.xpGain).toBe(16);
  });

  test("inFlight est visible pendant la requête puis retombe", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const saver = createReviewSessionSaver(async () => {
      await gate;
      return { xpGain: 12, streak: 1 };
    });
    saver.enqueue(pending(22));
    const flight = saver.flush();
    expect(saver.state().inFlight).toBe(true);
    release();
    await flight;
    expect(saver.state().inFlight).toBe(false);
  });

  test("un échec expose l'erreur, garde la tête, puis retry réutilise la même clé", async () => {
    const lot = pending(23, 2);
    const keys: string[] = [];
    let attempts = 0;
    const saver = createReviewSessionSaver(async (current) => {
      keys.push(current.snapshot.sessionKey);
      attempts += 1;
      if (attempts === 1) throw new Error("réseau perdu");
      return { xpGain: 14, streak: 2 };
    });
    saver.enqueue(lot);
    await saver.flush();

    expect(saver.state().error).toBe("réseau perdu");
    expect(saver.state().pending).toBe(1);
    expect(saver.state().head?.snapshot.sessionKey).toBe(
      lot.snapshot.sessionKey,
    );
    expect(saver.state().receipts).toEqual({});

    await saver.retry();
    expect(keys).toEqual([
      lot.snapshot.sessionKey,
      lot.snapshot.sessionKey,
    ]);
    expect(saver.state().error).toBeNull();
    expect(saver.state().pending).toBe(0);
    expect(saver.receipt(lot.snapshot.sessionKey)?.xpGain).toBe(14);
  });

  test("deux reprises concurrentes ne produisent qu'un seul appel", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const saver = createReviewSessionSaver(async () => {
      calls += 1;
      await gate;
      return { xpGain: 12, streak: 1 };
    });
    saver.enqueue(pending(24));
    const first = saver.retry();
    const second = saver.retry();
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  test("les lots en attente sont traités dans l'ordre avec des reçus séparés", async () => {
    const first = pending(25, 1);
    const second = pending(26, 3);
    const seen: string[] = [];
    const saver = createReviewSessionSaver(async (current) => {
      seen.push(current.snapshot.sessionKey);
      return {
        xpGain: current.snapshot.itemsLearned === 1 ? 12 : 16,
        streak: 1,
      };
    });
    saver.enqueue(first);
    saver.enqueue(second);
    await saver.flush();

    expect(seen).toEqual([
      first.snapshot.sessionKey,
      second.snapshot.sessionKey,
    ]);
    expect(saver.receipt(first.snapshot.sessionKey)?.xpGain).toBe(12);
    expect(saver.receipt(second.snapshot.sessionKey)?.xpGain).toBe(16);
    expect(saver.state().receipts[first.snapshot.sessionKey]?.itemsLearned).toBe(1);
    expect(saver.state().receipts[second.snapshot.sessionKey]?.itemsLearned).toBe(3);
  });
});

describe("reviewSessionTracker — duration par batch", () => {
  test("durationSeconds mesuré par batch, minimum 1 s", () => {
    let t = 0;
    const tracker = createReviewSessionTracker(() => t);
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    t = 5_000;
    expect(tracker.take().durationSeconds).toBe(5);

    t = 9_000;
    tracker.start();
    tracker.accept("b", tracker.sessionId());
    expect(tracker.take().durationSeconds).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Branchement réel dans ReviewView — vérification statique ciblée.
   Aucun environnement DOM/React n'est installé dans le dépôt : ces
   assertions prouvent la structure du câblage, pas le rendu visuel. Les
   primitives exécutées ci-dessus sont celles que le composant appelle.
   ═══════════════════════════════════════════════════════════════════════ */
describe("ReviewView — branchement réel du tracker", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/learner/ReviewView.tsx"),
    "utf8",
  );
  const rateStart = src.indexOf("const rate = async (rating: Rating)");
  const rateEnd = src.indexOf("if (queue === undefined)", rateStart);
  const rate = src.slice(rateStart, rateEnd);

  test("importe et utilise le tracker (pas un compteur isolé)", () => {
    expect(src).toContain('from "@/lib/reviewSessionTracker"');
    expect(src).toMatch(/useState\(createReviewSessionTracker\)/);
    expect(src).toMatch(/tracker\.accept\(/);
    expect(src).toMatch(/takeIfComplete\(cards, tracker\)/);
    expect(src).toMatch(/firstPendingCard\(cards, acceptedIds\)/);
    expect(src).toMatch(/needsNewBatch\(/);
  });

  test("une réponse tardive est rejetée par l'identité de session et le montage", () => {
    expect(src).toMatch(/sessionId !== tracker\.sessionId\(\)/);
    expect(src).toMatch(/!mountedRef\.current/);
    expect(src).toMatch(/tracker\.accept\(card\.card\._id, sessionId\)/);
  });

  test("le compteur de sauvegarde vient du snapshot, jamais de la closure reviewed", () => {
    expect(src).not.toMatch(/itemsLearned:\s*reviewed/);
    expect(src).not.toMatch(/sessionSaved/);
    expect(src).not.toMatch(/setReviewed/);
    expect(src).not.toMatch(/setIndex/);
    expect(src).toMatch(/itemsLearned:\s*pending\.snapshot\.itemsLearned/);
    expect(src).toMatch(/createReviewSessionSaver\(/);
    expect(src).toMatch(/saver\.enqueue\(/);
  });

  test("la clé d'idempotence du snapshot est transmise à recordSession", () => {
    expect(src).toMatch(/sessionKey:\s*pending\.snapshot\.sessionKey/);
  });

  test("la file de sauvegarde est persistée localement et par compte", () => {
    expect(src).toContain('from "@/lib/reviewSessionPersistence"');
    expect(src).toMatch(/const sessionUserKey = user\?\._id/);
    expect(src).toMatch(
      /sessionUserKey\s*\?\s*createUserReviewSessionPersistence\(sessionUserKey\)/,
    );
  });

  test("accept() intervient APRÈS la réussite de reviewMutation", () => {
    const awaitIdx = rate.indexOf("await reviewMutation");
    const acceptIdx = rate.indexOf("tracker.accept(");
    expect(awaitIdx).toBeGreaterThan(-1);
    expect(acceptIdx).toBeGreaterThan(awaitIdx);
  });

  test("la branche d'échec ne crédite ni n'avance ni ne consomme", () => {
    const catchIdx = rate.indexOf("} catch {");
    const finallyIdx = rate.indexOf("} finally {", catchIdx);
    const catchBlock = rate.slice(catchIdx, finallyIdx);
    expect(catchBlock).toContain("setFeedback");
    expect(catchBlock).not.toMatch(/accept\(/);
    expect(catchBlock).not.toMatch(/takeIfComplete|tracker\.take\(/);
    expect(catchBlock).not.toMatch(/setReviewed/);
    expect(catchBlock).not.toMatch(/setRevealed/);
    expect(catchBlock).not.toMatch(/saver\.flush|saver\.enqueue/);
  });

  test("la garde anti double-soumission se libère dans finally", () => {
    expect(src).toMatch(/if \(submittingRef\.current\) return;/);
    expect(src).toMatch(/submittingRef\.current = true;/);
    expect(rate).toMatch(/finally \{\s*submittingRef\.current = false;/);
    expect(src).toMatch(/tracker\.isAccepted\(card\.card\._id\)/);
  });

  test("le bouclier pédagogique displayContext reste intact et utilisé", () => {
    expect(src).toMatch(
      /const shownContext = current \? displayContext\(current\.slang\.context\) : null;/,
    );
    expect(src.match(/displayContext\(current\.slang\.context\)/g)?.length).toBe(1);
    expect(src).toContain("{shownContext && (");
  });

  test("la révélation est liée à la carte ET à l'identité de session", () => {
    expect(src).toMatch(/const \[revealState, setRevealState\] = useState</);
    expect(src).toMatch(/revealState\.cardId === current\.card\._id/);
    expect(src).toMatch(/revealState\.sessionId === tracker\.sessionId\(\)/);
    expect(src).not.toMatch(/setRevealed\(/);
    expect(src).not.toMatch(/\[revealed, setRevealed\]/);
  });

  test("l'XP du résumé vient du reçu serveur, jamais d'une formule locale", () => {
    expect(src).toMatch(/saveState\.receipts\[sessionReceiptKey\]/);
    expect(src).toMatch(/activeReceipt\.xpGain/);
    expect(src).not.toMatch(/reviewed\s*\*\s*5/);
  });

  test("l'échec de sauvegarde est visible et la reprise passe par le saver", () => {
    expect(src).toMatch(/data-save-state/);
    expect(src).toMatch(/t\("review\.saveFailed"\)/);
    expect(src).toMatch(/t\("review\.retrySave"\)/);
    expect(src).toMatch(/saver\.retry\(\)/);
    expect(src).toMatch(/saveState\.inFlight/);
  });
});

describe("ReviewView — i18n des états de sauvegarde", () => {
  const i18n = readFileSync(join(process.cwd(), "src/lib/i18n.tsx"), "utf8");
  const keys = [
    "savingCard",
    "savePending",
    "saveFailed",
    "savePendingCount",
    "retrySave",
    "saveConfirmed",
    "saveNotConfirmed",
  ];

  test("les six dictionnaires complets exposent toutes les clés", () => {
    for (const key of keys) {
      const count = i18n.match(new RegExp(`\\b${key}:`, "g"))?.length ?? 0;
      expect(count).toBe(6);
    }
  });

  test("les six dictionnaires africains exposent aussi toutes les clés", () => {
    const african = readFileSync(
      join(process.cwd(), "src/lib/i18n.african.ts"),
      "utf8",
    );
    for (const key of keys) {
      const count = african.match(new RegExp(`\\b${key}:`, "g"))?.length ?? 0;
      expect(count).toBe(6);
    }
  });
});
