import { describe, expect, test } from "bun:test";
import {
  createReviewSessionPersistence,
  createUserReviewSessionPersistence,
  REVIEW_PENDING_STORAGE_KEY,
  reviewPendingStorageKey,
  type ReviewSessionStorage,
} from "../src/lib/reviewSessionPersistence";
import {
  createReviewSessionSaver,
  type PendingSessionSave,
} from "../src/lib/reviewSessionTracker";

/** Stockage en mémoire, avec les mêmes trois opérations que localStorage. */
function memoryStorage() {
  const map = new Map<string, string>();
  const storage: ReviewSessionStorage & {
    read(key: string): string | null;
    size(): number;
  } = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    read: (key) => map.get(key) ?? null,
    size: () => map.size,
  };
  return storage;
}

function lot(
  key = "srs_test-session-0001",
  sessionId = 1,
  itemsLearned = 1,
): PendingSessionSave {
  return {
    snapshot: {
      sessionId,
      sessionKey: key,
      itemsLearned,
      durationSeconds: 3,
      startedAt: 0,
    },
    language: "en",
  };
}

describe("reviewSessionPersistence — stockage local validé", () => {
  test("un lot survit à un cycle save/load puis disparaît après succès", () => {
    const storage = memoryStorage();
    const persistence = createReviewSessionPersistence(storage);
    const pending = lot();

    persistence.save([pending]);
    expect(persistence.load()).toHaveLength(1);
    expect(persistence.load()[0]?.snapshot.sessionKey).toBe(
      pending.snapshot.sessionKey,
    );

    persistence.save([]);
    expect(storage.read(REVIEW_PENDING_STORAGE_KEY)).toBeNull();
    expect(persistence.load()).toEqual([]);
  });

  test("un JSON corrompu ou une forme invalide ne restaure aucun lot", () => {
    const storage = memoryStorage();
    const persistence = createReviewSessionPersistence(storage);

    storage.setItem(REVIEW_PENDING_STORAGE_KEY, "{pas du json");
    expect(persistence.load()).toEqual([]);

    storage.setItem(
      REVIEW_PENDING_STORAGE_KEY,
      JSON.stringify([
        null,
        { language: "en" },
        { language: "en", snapshot: { sessionKey: "court" } },
        lot("srs_valide-000001"),
        lot("srs_valide-000001"), // doublon de clé
      ]),
    );
    const restored = persistence.load();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.snapshot.sessionKey).toBe("srs_valide-000001");
  });

  test("les langues non prises en charge et les clés hors alphabet sont ignorées", () => {
    const storage = memoryStorage();
    const persistence = createReviewSessionPersistence(storage);

    storage.setItem(
      REVIEW_PENDING_STORAGE_KEY,
      JSON.stringify([
        // « zz » respecte le format mais n'est pas une langue du validateur.
        { ...lot("srs_langue-000001"), language: "zz" },
        lot("clé avec espaces"),
        lot("srs_ok-000000001"),
      ]),
    );
    const restored = persistence.load();
    expect(restored.map((p) => p.snapshot.sessionKey)).toEqual([
      "srs_ok-000000001",
    ]);
  });

  test("deux comptes ne partagent jamais la même file locale", async () => {
    const storage = memoryStorage();
    const first = createUserReviewSessionPersistence("user_a", storage);
    const second = createUserReviewSessionPersistence("user_b", storage);
    const firstLot = lot("srs_user-a-000001");

    first.save([firstLot]);
    expect(first.load()).toHaveLength(1);
    expect(second.load()).toEqual([]);
    expect(reviewPendingStorageKey("user_a")).not.toBe(
      reviewPendingStorageKey("user_b"),
    );

    // Un saver du compte B ne doit rien rejouer du lot laissé par A.
    const replayed: string[] = [];
    const saverB = createReviewSessionSaver(async (pending) => {
      replayed.push(pending.snapshot.sessionKey);
    }, second);
    expect(saverB.pending()).toBe(0);
    await saverB.flush();
    expect(replayed).toEqual([]);
    expect(first.load()[0]?.snapshot.sessionKey).toBe(
      firstLot.snapshot.sessionKey,
    );
  });

  test("un stockage indisponible dégrade en no-op sans lever", () => {
    const broken: ReviewSessionStorage = {
      getItem() {
        throw new Error("storage indisponible");
      },
      setItem() {
        throw new Error("quota");
      },
      removeItem() {
        throw new Error("storage indisponible");
      },
    };
    const persistence = createReviewSessionPersistence(broken);
    expect(persistence.load()).toEqual([]);
    expect(() => persistence.save([lot()])).not.toThrow();
    expect(() => persistence.save([])).not.toThrow();

    const absent = createReviewSessionPersistence(null);
    expect(absent.load()).toEqual([]);
    expect(() => absent.save([lot()])).not.toThrow();
  });
});

describe("reviewSessionSaver — reprise après rechargement", () => {
  test("un lot non confirmé est rechargé puis rejoué avec sa clé d'origine", async () => {
    const storage = memoryStorage();
    const persistence = createReviewSessionPersistence(storage);
    const first = lot("srs_reload-000001", 1);
    const keys: string[] = [];

    const failing = createReviewSessionSaver(async (pending) => {
      keys.push(pending.snapshot.sessionKey);
      throw new Error("réseau perdu");
    }, persistence);
    failing.enqueue(first);
    await failing.flush();
    expect(failing.pending()).toBe(1);
    expect(persistence.load()).toHaveLength(1);

    // Nouveau composant / nouvel onglet : le saver restaure la file avant
    // tout nouvel enqueue. Le retry doit porter EXACTEMENT la même clé.
    const retrying = createReviewSessionSaver(async (pending) => {
      keys.push(pending.snapshot.sessionKey);
    }, persistence);
    expect(retrying.pending()).toBe(1);
    await retrying.flush();
    expect(keys).toEqual([
      first.snapshot.sessionKey,
      first.snapshot.sessionKey,
    ]);
    expect(retrying.pending()).toBe(0);
    expect(persistence.load()).toEqual([]);
    expect(storage.read(REVIEW_PENDING_STORAGE_KEY)).toBeNull();
  });

  test("un sessionId local réutilisé ne déduplique pas une nouvelle clé", async () => {
    const storage = memoryStorage();
    const persistence = createReviewSessionPersistence(storage);
    const saved: string[] = [];
    const saver = createReviewSessionSaver(async (pending) => {
      saved.push(pending.snapshot.sessionKey);
    }, persistence);

    // Les deux lots portent sessionId=1 (le tracker local repart à 1 après
    // rechargement), mais ce sont deux sessions logiques distinctes.
    saver.enqueue(lot("srs_session-000001", 1));
    await saver.flush();
    saver.enqueue(lot("srs_session-000002", 1));
    await saver.flush();

    expect(saved).toEqual(["srs_session-000001", "srs_session-000002"]);
    expect(persistence.load()).toEqual([]);
  });

  test("un doublon de clé n'est enfilé et persisté qu'une fois", async () => {
    const storage = memoryStorage();
    const persistence = createReviewSessionPersistence(storage);
    let calls = 0;
    const saver = createReviewSessionSaver(async () => {
      calls += 1;
    }, persistence);
    const duplicate = lot("srs_doublon-000001");

    saver.enqueue(duplicate);
    saver.enqueue(duplicate);
    expect(saver.pending()).toBe(1);
    expect(persistence.load()).toHaveLength(1);
    await saver.flush();
    expect(calls).toBe(1);
    expect(saver.pending()).toBe(0);
  });
});
