/**
 * SRS — test d'INTÉGRATION de la vraie mutation Convex `reviewCardMutation`.
 *
 * Contrairement à `tests/srs.test.ts` (audit statique + unités pures), ce
 * fichier EXÉCUTE la mutation réelle de `src/convex/learning.ts` dans un
 * environnement Convex de test isolé (`convex-test`), avec une vraie base
 * de données, un vrai schéma et une vraie identité d'utilisateur.
 *
 * Ce que cela prouve (et que les tests unitaires ne prouvent pas) :
 *  - le garde `expectedLastReview` (compare-and-swap) rejette bien la
 *    soumission périmée AVANT toute écriture ;
 *  - un rejet ne touche ni le statut, ni l'échéance, ni l'XP, ni le
 *    streak, ni les sessions ;
 *  - la mutation Convex sérialise les soumissions concurrentes et que la
 *    seconde relit l'état déjà à jour (donc elle est refusée).
 *
 * Aucun déploiement n'est contacté : `convex-test` est un émulateur local
 * (base en mémoire), jamais une instance Convex distante.
 */
import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import { newCardDefaults } from "../src/convex/languages";
import {
  createReviewSessionTracker,
  takeIfComplete,
} from "../src/lib/reviewSessionTracker";
import type { Id } from "../src/convex/_generated/dataModel";

const DAY_MS = 86_400_000;

/**
 * Modules Convex exposés à l'émulateur. La clé `_generated/api.ts` ancre la
 * racine des modules (convex-test la cherche pour calculer le préfixe) ;
 * les autres clés sont les chemins des fichiers de fonctions, extension
 * retirée par convex-test lors de la résolution.
 */
const modules = {
  "_generated/api.ts": () => import("../src/convex/_generated/api"),
  "learning.ts": () => import("../src/convex/learning"),
};

function makeApp() {
  return convexTest(schema, modules);
}

type App = ReturnType<typeof makeApp>;

type Seeds = {
  userId: Id<"users">;
  cardId: Id<"srsCards">;
  slangId: Id<"slangExpressions">;
};

/** Jeu de données minimal : un utilisateur, sa langue, une expression, une carte SRS neuve. */
async function seedDeck(t: App): Promise<Seeds> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Testeur SRS" });
    const slangId = await ctx.db.insert("slangExpressions", {
      language: "en",
      expression: "deadass",
      meaning: "vraiment, carrément",
      context: "Intensifier in casual American English.",
      register: "street",
      region: "US",
      popularity: 80,
    });
    await ctx.db.insert("userLanguages", {
      userId,
      language: "en",
      active: true,
      level: "A1",
      xp: 0,
      streak: 0,
    });
    const cardId = await ctx.db.insert("srsCards", {
      userId,
      language: "en",
      slangId,
      register: "street",
      ...newCardDefaults(Date.now() - 60_000),
    });
    return { userId, cardId, slangId };
  });
}

/** Relit l'état réel en base (carte + ligne langue + nombre de sessions). */
async function readState(t: App, cardId: Id<"srsCards">) {
  return await t.run(async (ctx) => {
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("carte absente de la base de test");
    const langRow = await ctx.db
      .query("userLanguages")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", card.userId).eq("language", card.language),
      )
      .unique();
    const sessions = await ctx.db.query("learningSessions").collect();
    return {
      card,
      xp: langRow?.xp ?? null,
      streak: langRow?.streak ?? null,
      lastActivity: langRow?.lastActivity ?? null,
      sessionsCount: sessions.length,
    };
  });
}

/** Capture le message d'erreur d'une mutation rejetée (null si elle passe). */
async function captureError(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe("SRS intégration — reviewCardMutation réelle (convex-test)", () => {
  test("scénario 1 — une revue valide est enregistrée une seule fois", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const before = await readState(t, seeds.cardId);
    expect(before.xp).toBe(0);
    expect(before.streak).toBe(0);
    expect(before.card.lastReview).toBeUndefined();
    expect(before.card.status).toBe("learning");

    const res = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: null,
    });

    expect(res.status).toBe("confirming");
    expect(res.justMastered).toBe(false);
    expect(res.xpGain).toBe(5);
    expect(res.due).not.toBeNull();
    expect(res.due ?? 0).toBeGreaterThan(Date.now() + DAY_MS);

    const after = await readState(t, seeds.cardId);
    // Une seule application : statut + XP + streak advanced une fois.
    expect(after.card.status).toBe("confirming");
    expect(after.card.lastRating).toBe("good");
    expect(after.card.due).toBe(res.due);
    expect(typeof after.card.lastReview).toBe("number");
    expect(after.xp).toBe(5);
    expect(after.streak).toBe(1);
    expect(after.lastActivity).not.toBeNull();
    expect(after.sessionsCount).toBe(0);
  });

  test("scénario 2 — deux soumissions sur le même lastReview : la 2e est rejetée (stale_review)", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    // 1re soumission : acceptée.
    await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: null,
    });
    const afterFirst = await readState(t, seeds.cardId);

    // 2e soumission REJOUÉE sur la même clé (clic dupliqué / mutation fantôme).
    const message = await captureError(
      asUser.mutation(api.learning.reviewCardMutation, {
        cardId: seeds.cardId,
        rating: "good",
        expectedLastReview: null,
      }),
    );
    expect(message).not.toBeNull();
    expect(message ?? "").toContain("stale_review");

    // Aucun second avancement, aucun second crédit XP.
    const afterSecond = await readState(t, seeds.cardId);
    expect(afterSecond.card.status).toBe(afterFirst.card.status);
    expect(afterSecond.card.due).toBe(afterFirst.card.due);
    expect(afterSecond.card.lastReview).toBe(afterFirst.card.lastReview);
    expect(afterSecond.xp).toBe(afterFirst.xp);
    expect(afterSecond.streak).toBe(afterFirst.streak);
  });

  test("scénario 3 — une soumission périmée ne modifie ni statut, ni échéance, ni XP, ni streak, ni statistiques", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: null,
    });
    const before = await readState(t, seeds.cardId);

    // Soumission bâtie sur un état périmé (clé inventée antérieure à la revue).
    const message = await captureError(
      asUser.mutation(api.learning.reviewCardMutation, {
        cardId: seeds.cardId,
        rating: "easy",
        expectedLastReview: before.card.lastReview! - 1,
      }),
    );
    expect(message ?? "").toContain("stale_review");

    const after = await readState(t, seeds.cardId);
    // La carte est INTÉGRALEMENT inchangée.
    expect(after.card.status).toBe(before.card.status);
    expect(after.card.due).toBe(before.card.due);
    expect(after.card.nextReview).toBe(before.card.nextReview);
    expect(after.card.lastReview).toBe(before.card.lastReview);
    expect(after.card.lastRating).toBe(before.card.lastRating);
    expect(after.card.easeFactor).toBe(before.card.easeFactor);
    expect(after.card.intervalDays).toBe(before.card.intervalDays);
    expect(after.card.repetitions).toBe(before.card.repetitions);
    expect(after.card.consecutiveFails).toBe(before.card.consecutiveFails);
    // XP, streak, date d'activité et sessions : rien n'a bougé.
    expect(after.xp).toBe(before.xp);
    expect(after.streak).toBe(before.streak);
    expect(after.lastActivity).toBe(before.lastActivity);
    expect(after.sessionsCount).toBe(before.sessionsCount);
  });

  test("scénario 4 — une nouvelle revue légitime, bâtie sur l'état actualisé, est acceptée", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: null,
    });
    const refreshed = await readState(t, seeds.cardId);

    // Le client relit la carte (file rafraîchie) et renvoie le lastReview actuel.
    const res = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: refreshed.card.lastReview ?? null,
    });
    expect(res.status).toBe("mastered");
    expect(res.justMastered).toBe(true);
    expect(res.due).toBeNull();

    const after = await readState(t, seeds.cardId);
    expect(after.card.status).toBe("mastered");
    expect(after.card.due).toBeNull();
    expect(after.card.lastReview).not.toBe(refreshed.card.lastReview);
    expect(after.xp).toBe(10); // 5 + 5
    expect(after.streak).toBe(1); // même jour : streak inchangé
  });

  test("scénario 5 — une carte inconnue est rejetée sans effet de bord", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    // Identifiant bien formé (donc valide pour le validateur Convex) mais
    // pointant sur aucun document : on insère puis on supprime.
    const ghostId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("srsCards", {
        userId: seeds.userId,
        language: "en",
        slangId: seeds.slangId,
        register: "street",
        ...newCardDefaults(Date.now() - 60_000),
      });
      await ctx.db.delete(id);
      return id;
    });

    const before = await readState(t, seeds.cardId);
    const message = await captureError(
      asUser.mutation(api.learning.reviewCardMutation, {
        cardId: ghostId,
        rating: "good",
        expectedLastReview: null,
      }),
    );
    expect(message).not.toBeNull();
    expect(message ?? "").toContain("Card not found");

    const after = await readState(t, seeds.cardId);
    expect(after.xp).toBe(before.xp);
    expect(after.streak).toBe(before.streak);
    expect(after.card.status).toBe(before.card.status);
    expect(after.card.lastReview).toBe(before.card.lastReview);
  });

  test("scénario 6 — après une erreur récupérable, une nouvelle tentative réussit (carte non bloquée)", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);

    // a) Mutation sans identité : refus « Not signed in », aucun effet.
    const anonymous = await captureError(
      t.mutation(api.learning.reviewCardMutation, {
        cardId: seeds.cardId,
        rating: "good",
        expectedLastReview: null,
      }),
    );
    expect(anonymous ?? "").toContain("Not signed in");
    const afterAnon = await readState(t, seeds.cardId);
    expect(afterAnon.xp).toBe(0);
    expect(afterAnon.card.lastReview).toBeUndefined();
    expect(afterAnon.card.status).toBe("learning");

    // b) Le même refus de permissions ne bloque PAS la carte : la tentative
    //    authentifiée avec la bonne clé passe.
    const asUser = t.withIdentity({ subject: seeds.userId });
    const res = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: null,
    });
    expect(res.status).toBe("confirming");
    const afterOk = await readState(t, seeds.cardId);
    expect(afterOk.xp).toBe(5);
    expect(afterOk.card.lastReview).toBeTypeOf("number");

    // c) Mutation fantôme : la réponse a été perdue, le client rejoue la
    //    soumission avec la même clé → refusée, MAIS la carte n'est pas
    //    bloquée : une reprise sur l'état rafraîchi réussit.
    const replay = await captureError(
      asUser.mutation(api.learning.reviewCardMutation, {
        cardId: seeds.cardId,
        rating: "good",
        expectedLastReview: null,
      }),
    );
    expect(replay ?? "").toContain("stale_review");
    const res2 = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: afterOk.card.lastReview ?? null,
    });
    expect(res2.status).toBe("mastered");
    const after2 = await readState(t, seeds.cardId);
    expect(after2.card.status).toBe("mastered");
    expect(after2.xp).toBe(10);
  });

  test("scénario 7 — la file de révision et la mutation restent cohérentes après relecture en base", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    // La carte neuve est due : elle apparaît dans la file avec son lastReview.
    const queueBefore = await asUser.query(api.learning.reviewQueue, {});
    expect(queueBefore).toHaveLength(1);
    expect(queueBefore[0]?.card._id).toBe(seeds.cardId);
    expect(queueBefore[0]?.card.lastReview).toBeUndefined();

    // Revue → la carte part dans le futur, elle disparaît de la file.
    const res = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: queueBefore[0]?.card.lastReview ?? null,
    });
    expect(res.status).toBe("confirming");
    const queueAfter = await asUser.query(api.learning.reviewQueue, {});
    expect(queueAfter).toHaveLength(0);

    // Le temps passe (l'échéance est rattrapée) : la file la repropose, et
    // elle repart avec le lastReview à jour → la mutation l'accepte.
    await t.run(async (ctx) => {
      const past = Date.now() - 1_000;
      await ctx.db.patch(seeds.cardId, { due: past, nextReview: past });
    });
    const queueLater = await asUser.query(api.learning.reviewQueue, {});
    expect(queueLater).toHaveLength(1);
    const servedKey = queueLater[0]?.card.lastReview ?? null;
    expect(servedKey).toBeTypeOf("number");

    const res2 = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: servedKey,
    });
    expect(res2.status).toBe("mastered");
    expect(res2.justMastered).toBe(true);

    // Cohérence finale : la carte maîtrisée n'est plus jamais servie.
    const queueEnd = await asUser.query(api.learning.reviewQueue, {});
    expect(queueEnd).toHaveLength(0);
  });

  test("scénario 8 — deux mutations concurrentes : une seule appliquée, l'autre refusée", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    // convex-test sérialise les transactions de premier niveau (le second
    // appel attend la validation du premier, puis relit l'état à jour).
    // En production, Convex applique un contrôle de concurrence optimiste :
    // la transaction en conflit est rejouée sur l'état frais. Le résultat
    // observable est identique — la 2e soumission est refusée — mais le
    // mécanisme interne diffère (verrou FIFO local vs. OCC + rejeu).
    const results = await Promise.allSettled([
      asUser.mutation(api.learning.reviewCardMutation, {
        cardId: seeds.cardId,
        rating: "good",
        expectedLastReview: null,
      }),
      asUser.mutation(api.learning.reviewCardMutation, {
        cardId: seeds.cardId,
        rating: "good",
        expectedLastReview: null,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason =
      rejected[0]?.status === "rejected" ? String(rejected[0].reason) : "";
    expect(reason).toContain("stale_review");

    const after = await readState(t, seeds.cardId);
    // Un seul avancement de la machine à états (learning → confirming, PAS
    // → mastered) et un seul crédit XP.
    expect(after.card.status).toBe("confirming");
    expect(after.xp).toBe(5);
  });

  test("scénario 9 — compatibilité : un appelant legacy sans expectedLastReview reste accepté", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    // L'argument reste optionnel (client ancien déployé avant le garde) :
    // l'absence de clé ne déclenche pas le refus, la revue s'applique.
    const res = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
    });
    expect(res.status).toBe("confirming");
    const after = await readState(t, seeds.cardId);
    expect(after.card.status).toBe("confirming");
    expect(after.xp).toBe(5);
  });

  test("scénario 10 — persistance : le résultat survit à une nouvelle lecture de la base", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const res = await asUser.mutation(api.learning.reviewCardMutation, {
      cardId: seeds.cardId,
      rating: "good",
      expectedLastReview: null,
    });

    // Nouvelle transaction de lecture : l'état est bien celui écrit.
    const persisted = await readState(t, seeds.cardId);
    expect(persisted.card.status).toBe("confirming");
    expect(persisted.card.due).toBe(res.due);
    expect(persisted.card.lastRating).toBe("good");
    expect(persisted.xp).toBe(5);
    expect(persisted.streak).toBe(1);

    // Et la lecture via la vraie query de file renvoie la même carte.
    await t.run(async (ctx) => {
      const past = Date.now() - 1_000;
      await ctx.db.patch(seeds.cardId, { due: past, nextReview: past });
    });
    const queue = await asUser.query(api.learning.reviewQueue, {});
    expect(queue).toHaveLength(1);
    expect(queue[0]?.card.status).toBe("confirming");
    expect(queue[0]?.card.lastReview).toBe(persisted.card.lastReview);
  });
});

describe("SRS intégration — session de révision (tracker + recordSession)", () => {
  type SessionCard = { card: { _id: string; language: string } };
  const sessionCards = (ids: string[]): SessionCard[] =>
    ids.map((id) => ({ card: { _id: id, language: "en" } }));

  async function savedSessions(t: App) {
    return await t.run(async (ctx) =>
      await ctx.db.query("learningSessions").collect(),
    );
  }

  test("une session d'une seule carte enregistre exactement itemsLearned=1", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = sessionCards(["a"]);
    tracker.accept("a", tracker.sessionId());
    const snapshot = takeIfComplete(cards, tracker);
    expect(snapshot?.itemsLearned).toBe(1);

    await asUser.mutation(api.learning.recordSession, {
      language: "en",
      kind: "srs",
      durationSeconds: snapshot!.durationSeconds,
      itemsLearned: snapshot!.itemsLearned,
      sessionKey: snapshot!.sessionKey,
    });

    const rows = await savedSessions(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("srs");
    expect(rows[0]?.itemsLearned).toBe(1);
    // recordSession : 10 XP + 2 XP par carte consolidée.
    const state = await readState(t, seeds.cardId);
    expect(state.xp).toBe(12);
    expect(state.streak).toBe(1);
  });

  test("une session de N cartes enregistre le total N, dernière incluse", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = sessionCards(["a", "b", "c"]);
    tracker.accept("a", tracker.sessionId());
    tracker.accept("b", tracker.sessionId());
    expect(takeIfComplete(cards, tracker)).toBeNull();
    tracker.accept("c", tracker.sessionId());
    const snapshot = takeIfComplete(cards, tracker);
    expect(snapshot?.itemsLearned).toBe(3);

    await asUser.mutation(api.learning.recordSession, {
      language: "en",
      kind: "srs",
      durationSeconds: snapshot!.durationSeconds,
      itemsLearned: snapshot!.itemsLearned,
      sessionKey: snapshot!.sessionKey,
    });

    const rows = await savedSessions(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.itemsLearned).toBe(3);
    const state = await readState(t, seeds.cardId);
    expect(state.xp).toBe(16); // 10 + 3 × 2
  });

  test("un échec de revue ne sauvegarde aucune session et ne consomme pas le lot", async () => {
    const t = makeApp();

    const tracker = createReviewSessionTracker();
    tracker.start();
    const cards = sessionCards(["a", "b"]);
    // Aucun accept : la mutation a rejeté.
    expect(takeIfComplete(cards, tracker)).toBeNull();
    expect(tracker.count()).toBe(0);
    expect(await savedSessions(t)).toHaveLength(0);

    // La même carte reste la carte courante et une tentative réussie compte 1.
    tracker.accept("a", tracker.sessionId());
    const snapshot = takeIfComplete(cards, tracker);
    expect(snapshot).toBeNull(); // b reste à revoir
    tracker.accept("b", tracker.sessionId());
    expect(takeIfComplete(cards, tracker)?.itemsLearned).toBe(2);
  });

  test("deux clics sur la même carte ne comptent qu'une seule révision", async () => {
    const tracker = createReviewSessionTracker();
    tracker.start();
    const id = tracker.sessionId();
    expect(tracker.accept("a", id).count).toBe(1);
    expect(tracker.accept("a", id).counted).toBe(false);
    expect(takeIfComplete(sessionCards(["a"]), tracker)?.itemsLearned).toBe(1);

    const snapshot = tracker.take();
    expect(snapshot.itemsLearned).toBe(0); // lot déjà consommé
  });

  test("deux sessions successives restent indépendantes", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const tracker = createReviewSessionTracker();
    tracker.start();
    tracker.accept("a", tracker.sessionId());
    const first = takeIfComplete(sessionCards(["a"]), tracker)!;
    await asUser.mutation(api.learning.recordSession, {
      language: "en",
      kind: "srs",
      durationSeconds: first.durationSeconds,
      itemsLearned: first.itemsLearned,
      sessionKey: first.sessionKey,
    });

    tracker.start();
    expect(tracker.count()).toBe(0);
    tracker.accept("b", tracker.sessionId());
    const second = takeIfComplete(sessionCards(["b"]), tracker)!;
    expect(second.itemsLearned).toBe(1);
    expect(second.sessionId).not.toBe(first.sessionId);
    await asUser.mutation(api.learning.recordSession, {
      language: "en",
      kind: "srs",
      durationSeconds: second.durationSeconds,
      itemsLearned: second.itemsLearned,
      sessionKey: second.sessionKey,
    });

    const rows = await savedSessions(t);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.itemsLearned).sort()).toEqual([1, 1]);
  });

  test("une réponse tardive d'une ancienne session ne crédite pas la nouvelle", async () => {
    const t = makeApp();

    const tracker = createReviewSessionTracker();
    tracker.start();
    const oldSession = tracker.sessionId();
    tracker.accept("a", oldSession);
    takeIfComplete(sessionCards(["a"]), tracker);
    tracker.start();

    const late = tracker.accept("late", oldSession);
    expect(late.staleSession).toBe(true);
    expect(tracker.count()).toBe(0);
    expect(takeIfComplete(sessionCards(["late"]), tracker)).toBeNull();
    expect(await savedSessions(t)).toHaveLength(0);
  });
});

describe("SRS intégration — idempotence de recordSession", () => {
  const KEY_A = "srs-test-idem-session-0001";
  const KEY_B = "srs-test-idem-session-0002";

  async function sessionsOf(t: App) {
    return await t.run(async (ctx) =>
      await ctx.db.query("learningSessions").collect(),
    );
  }

  function args(sessionKey: string, overrides: Record<string, unknown> = {}) {
    return {
      language: "en" as const,
      kind: "srs",
      durationSeconds: 3,
      itemsLearned: 1,
      sessionKey,
      ...overrides,
    };
  }

  async function secondUser(t: App) {
    return await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Second testeur" });
      await ctx.db.insert("userLanguages", {
        userId,
        language: "en",
        active: true,
        level: "A1",
        xp: 0,
        streak: 0,
      });
      return userId;
    });
  }

  test("test 1 — une première sauvegarde avec clé crée une seule session et crédite une fois", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const res = await asUser.mutation(api.learning.recordSession, args(KEY_A));
    expect(res).toEqual({ xpGain: 12, streak: 1 });

    const rows = await sessionsOf(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sessionKey).toBe(KEY_A);
    expect(rows[0]?.itemsLearned).toBe(1);
    expect(rows[0]?.xpAwarded).toBe(12);
    expect(rows[0]?.streakAfter).toBe(1);

    const state = await readState(t, seeds.cardId);
    expect(state.xp).toBe(12);
    expect(state.streak).toBe(1);
    expect(state.sessionsCount).toBe(1);
  });

  test("test 2 — un retry avec la même clé ne recrée rien et restitue le résultat original", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const first = await asUser.mutation(api.learning.recordSession, args(KEY_A));
    const before = await readState(t, seeds.cardId);
    const firstRow = (await sessionsOf(t))[0];

    // Simule un client qui n'a pas reçu la première réponse et rejoue le lot.
    const retry = await asUser.mutation(api.learning.recordSession, args(KEY_A));
    const after = await readState(t, seeds.cardId);
    const rows = await sessionsOf(t);

    expect(retry).toEqual(first);
    expect(rows).toHaveLength(1);
    expect(rows[0]?._id).toBe(firstRow?._id);
    expect(rows[0]?.completedAt).toBe(firstRow?.completedAt);
    expect(after.xp).toBe(before.xp);
    expect(after.streak).toBe(before.streak);
    expect(after.lastActivity).toBe(before.lastActivity);
    expect(after.sessionsCount).toBe(1);
  });

  test("test 3 — une nouvelle clé crée une seconde session et crédite ses XP une fois", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const first = await asUser.mutation(api.learning.recordSession, args(KEY_A));
    const second = await asUser.mutation(api.learning.recordSession, args(KEY_B));
    const rows = await sessionsOf(t);
    const state = await readState(t, seeds.cardId);

    expect(first).toEqual({ xpGain: 12, streak: 1 });
    expect(second).toEqual({ xpGain: 12, streak: 1 });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.sessionKey).sort()).toEqual([KEY_A, KEY_B]);
    expect(state.xp).toBe(24); // 12 + 12, une seule fois par session
    expect(state.streak).toBe(1); // même journée
    expect(state.sessionsCount).toBe(2);
  });

  test("test 4 — deux utilisateurs peuvent réutiliser la même clé sans se bloquer", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asFirst = t.withIdentity({ subject: seeds.userId });
    const userIdB = await secondUser(t);
    const asSecond = t.withIdentity({ subject: userIdB });

    const first = await asFirst.mutation(api.learning.recordSession, args(KEY_A));
    const second = await asSecond.mutation(api.learning.recordSession, args(KEY_A));
    const rows = await sessionsOf(t);

    expect(first).toEqual({ xpGain: 12, streak: 1 });
    expect(second).toEqual({ xpGain: 12, streak: 1 });
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.userId === seeds.userId)).toHaveLength(1);
    expect(rows.filter((row) => row.userId === userIdB)).toHaveLength(1);

    const stateB = await t.run(async (ctx) =>
      await ctx.db
        .query("userLanguages")
        .withIndex("by_user_language", (q) =>
          q.eq("userId", userIdB).eq("language", "en"),
        )
        .unique(),
    );
    expect(stateB?.xp).toBe(12);
    expect(stateB?.streak).toBe(1);
  });

  test("test 5 — deux appels concurrents avec la même clé restent une seule session", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    // convex-test sérialise les mutations de premier niveau ; en production,
    // Convex rejoue la transaction en conflit sur un état frais. Dans les deux
    // cas le handler relit la clé avant d'écrire et restitue le même résultat.
    const settled = await Promise.allSettled([
      asUser.mutation(api.learning.recordSession, args(KEY_A)),
      asUser.mutation(api.learning.recordSession, args(KEY_A)),
    ]);
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);

    const values = settled.map((result) =>
      result.status === "fulfilled" ? result.value : null,
    );
    expect(values[0]).toEqual(values[1]);
    expect(values[0]).toEqual({ xpGain: 12, streak: 1 });

    const rows = await sessionsOf(t);
    expect(rows).toHaveLength(1);
    const state = await readState(t, seeds.cardId);
    expect(state.xp).toBe(12);
    expect(state.streak).toBe(1);
  });

  test("test 6 — clé absente ou invalide : legacy explicite, clé malformée refusée", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const short = await captureError(
      asUser.mutation(api.learning.recordSession, args("short")),
    );
    expect(short).toContain("Invalid sessionKey");

    const malformed = await captureError(
      asUser.mutation(api.learning.recordSession, args("bad key with spaces")),
    );
    expect(malformed).toContain("Invalid sessionKey");
    expect(await sessionsOf(t)).toHaveLength(0);

    // Appel historique explicitement supporté, mais SANS protection retry.
    const legacy = await asUser.mutation(api.learning.recordSession, {
      language: "en",
      kind: "srs",
      durationSeconds: 3,
      itemsLearned: 1,
    });
    expect(legacy).toEqual({ xpGain: 12, streak: 1 });
    const rows = await sessionsOf(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sessionKey).toBeUndefined();
    expect(rows[0]?.xpAwarded).toBeUndefined();
  });

  test("test 7 — les sessions historiques sans clé restent lisibles et intactes", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const historical = await t.run(async (ctx) =>
      await ctx.db.insert("learningSessions", {
        userId: seeds.userId,
        language: "en",
        kind: "srs",
        durationSeconds: 2,
        itemsLearned: 1,
        completedAt: 1,
      }),
    );

    const res = await asUser.mutation(api.learning.recordSession, args(KEY_A));
    expect(res).toEqual({ xpGain: 12, streak: 1 });

    const rows = await sessionsOf(t);
    expect(rows).toHaveLength(2);
    const old = rows.find((row) => row._id === historical);
    expect(old?.sessionKey).toBeUndefined();
    expect(old?.itemsLearned).toBe(1);
    expect(old?.completedAt).toBe(1);

    const stats = await asUser.query(api.learning.myStats, {});
    expect(stats?.totalSessions).toBe(2);
  });

  test("test 8 — XP, streak, lastActivity et compteurs restent cohérents", async () => {
    const t = makeApp();
    const seeds = await seedDeck(t);
    const asUser = t.withIdentity({ subject: seeds.userId });

    const first = await asUser.mutation(api.learning.recordSession, args(KEY_A));
    const retry = await asUser.mutation(api.learning.recordSession, args(KEY_A));
    const second = await asUser.mutation(api.learning.recordSession, args(KEY_B));
    const state = await readState(t, seeds.cardId);

    expect(first).toEqual(retry);
    expect(second).toEqual({ xpGain: 12, streak: 1 });
    expect(state.xp).toBe(24);
    expect(state.streak).toBe(1);
    expect(state.sessionsCount).toBe(2);
    expect(state.lastActivity).not.toBeNull();

    const rows = await sessionsOf(t);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.xpAwarded === 12)).toBe(true);
    expect(rows.every((row) => row.streakAfter === 1)).toBe(true);
  });

  test("test 9 — une clé sans ligne de langue est refusée sans écriture", async () => {
    const t = makeApp();
    const userId = await t.run(async (ctx) =>
      await ctx.db.insert("users", { name: "Sans focus" }),
    );
    const asUser = t.withIdentity({ subject: userId });

    // Sans `userLanguages`, le patch concurrent qui sérialise deux appels
    // portant la même clé n'existe pas : on refuse plutôt que d'écrire une
    // session non protégée. L'appel legacy sans clé reste, lui, accepté.
    const err = await captureError(
      asUser.mutation(api.learning.recordSession, args(KEY_A)),
    );
    expect(err).toContain("Language not initialized");
    expect(await sessionsOf(t)).toHaveLength(0);

    // Le contrat historique sans clé n'est pas modifié par ce garde.
    const legacy = await asUser.mutation(api.learning.recordSession, {
      language: "en",
      kind: "sleep",
      durationSeconds: 60,
      itemsLearned: 0,
    });
    expect(legacy).toEqual({ xpGain: 0, streak: 0 });
    expect(await sessionsOf(t)).toHaveLength(1);
  });
});
