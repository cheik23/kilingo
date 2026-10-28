import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  commitDeckSwipe,
  createCommitGuard,
  filterExcludedFavorites,
  initialExcludeList,
  withSwipedRight,
  shuffledExclusion,
  type DeckSwipeCommit,
} from "../src/lib/discoverDeckState";

/**
 * Défauts corrigés (DiscoverView.commitSwipe) :
 *  D-B : le swipe droit n'excluait JAMAIS la carte du deck affiché —
 *        après Remélanger / changement de filtre, la carte mise de côté
 *        réapparaissait en tête de deck et le second cœur SUPPRIMAIT le
 *        favori (toggle silencieux).
 *  D-T : deux commits rapides sur la même carte = deux toggles en vol =
 *        le second annule le premier (favori créé puis supprimé), ou
 *        deux avances de deck (carte sautée).
 */

const isExcluded = (deck: { _id: string }[], excluded: ReadonlySet<string>) =>
  filterExcludedFavorites(deck, excluded);

describe("discoverDeckState — deck sans favoris remis (D-B)", () => {
  test("withSwipedRight est idempotent et immuable (pas de mutation de l'entrée)", () => {
    const base = new Set<string>(["a"]);
    const once = withSwipedRight(base, "c");
    // Nouveau Set, entrée inchangée.
    expect([...once]).toEqual(["a", "c"]);
    expect([...base]).toEqual(["a"]);
    // Idempotent : le même id renvoie le même Set (identité préservée).
    expect(withSwipedRight(once, "c")).toBe(once);
  });

  test("scénario du défaut : favori swipé → remélange → il ne revient PAS dans le deck", () => {
    // Deck initial trié popularité : c le plus populaire, puis d, e.
    const deck = [{ _id: "c" }, { _id: "d" }, { _id: "e" }];
    let sessionExcluded: ReadonlySet<string> = new Set<string>();

    // 1. L'utilisateur met c de côté (cœur) — le deck affiché la perd.
    sessionExcluded = withSwipedRight(sessionExcluded, "c");
    expect(isExcluded(deck, sessionExcluded).map((i) => i._id)).toEqual(["d", "e"]);

    // 2. Remélanger : rotation FIFO de l'exclusion persistée (comme reshuffle).
    const persisted = ["a", "b", "c"];
    expect(shuffledExclusion(persisted)).toEqual(persisted); // ≤ 40 : rien libéré

    // 3. Nouveau deck (refetch Convex) : c n'y figure MÊME PAS après
    //    remélange — deuxième cœur impossible, favori préservé.
    const refetchedDeck = [{ _id: "c" }, { _id: "d" }, { _id: "e" }];
    expect(isExcluded(refetchedDeck, sessionExcluded).map((i) => i._id)).toEqual(["d", "e"]);
  });

  test("changement de filtre : le deck rechargé n'inclut pas le favori swipé", () => {
    const sessionExcluded = withSwipedRight(new Set<string>(), "c");
    const deckRecharged = [{ _id: "c" }, { _id: "f" }];
    expect(isExcluded(deckRecharged, sessionExcluded).map((i) => i._id)).toEqual(["f"]);
  });

  test("deck inchangé si aucune exclusion", () => {
    const deck = [{ _id: "a" }, { _id: "b" }];
    expect(isExcluded(deck, new Set())).toEqual(deck);
  });

  test("initialExcludeList recharge le FIFO persisté (discover_swiped + shown)", () => {
    const storage = { getItem: (k: string) => (k === "discover_swiped" ? JSON.stringify(["x"]) : null) };
    expect(initialExcludeList(storage as Storage)).toEqual(["x"]);
    // Sans localStorage : liste vide, pas de crash.
    const broken = (() => { throw new Error("no storage"); }) as unknown as Storage;
    expect(() => initialExcludeList(broken)).not.toThrow();
    expect(initialExcludeList(broken)).toEqual([]);
  });

  test("shuffledExclusion libère les 20 plus anciennes au-delà de 40", () => {
    const big = Array.from({ length: 45 }, (_, i) => `id-${i}`);
    expect(shuffledExclusion(big)).toEqual(big.slice(20));
  });
});

describe("discoverDeckState — garde anti double-commit (D-T)", () => {
  test("tryAcquire bloque le second clic sur la même carte en vol", () => {
    const guard = createCommitGuard();
    expect(guard.tryAcquire("id-1")).toBe(true);
    // Second clic (double) pendant la mutation : rejeté, pas de toggle,
    // pas de double avance de deck.
    expect(guard.tryAcquire("id-1")).toBe(false);
    // Autre carte : indépendante.
    expect(guard.tryAcquire("id-2")).toBe(true);
  });

  test("release() réautorise la carte une fois la mutation résolue", () => {
    const guard = createCommitGuard();
    guard.tryAcquire("id-1");
    guard.release("id-1");
    expect(guard.has("id-1")).toBe(false);
    expect(guard.tryAcquire("id-1")).toBe(true);
    guard.release("id-1");
  });

  test("release() est sûr même sans acquire préalable", () => {
    const guard = createCommitGuard();
    expect(() => guard.release("inconnu")).not.toThrow();
  });
});

describe("discoverDeckState — commit asynchrone du swipe (D1)", () => {
  type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
  };

  function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  function makeCommit(overrides: Partial<DeckSwipeCommit> = {}): DeckSwipeCommit {
    return {
      id: "card-a",
      direction: "right",
      guard: createCommitGuard(),
      toggleFavorite: async () => ({ favorite: true }),
      isStillCurrent: () => true,
      onFavorite: () => {},
      onNotFavorite: () => {},
      onError: () => {},
      advance: () => {},
      ...overrides,
    };
  }

  test("swipe gauche : avance immédiatement, sans mutation de favori", async () => {
    let toggles = 0;
    let advances = 0;
    let favorites = 0;
    let errors = 0;
    const deps = makeCommit({
      direction: "left",
      toggleFavorite: async () => {
        toggles++;
        return { favorite: true };
      },
      onFavorite: () => {
        favorites++;
      },
      onError: () => {
        errors++;
      },
      advance: () => {
        advances++;
      },
    });

    const outcome = await commitDeckSwipe(deps);

    expect(outcome).toBe("left");
    expect(toggles).toBe(0);
    expect(advances).toBe(1);
    expect(favorites).toBe(0);
    expect(errors).toBe(0);
    expect(deps.guard.has("card-a")).toBe(false);
  });

  test("swipe droit confirmé favori : exclusion, aucune avance d'index (pas de carte sautée)", async () => {
    let favorites = 0;
    let advances = 0;
    const deps = makeCommit({
      onFavorite: () => {
        favorites++;
      },
      advance: () => {
        advances++;
      },
    });

    const outcome = await commitDeckSwipe(deps);

    expect(outcome).toBe("favorite");
    expect(favorites).toBe(1);
    // La carte est retirée par le filtre : l'index reste sur la suivante.
    expect(advances).toBe(0);
    expect(deps.guard.has("card-a")).toBe(false);
  });

  test("mutation rejetée : ni exclusion ni avance, garde libérée", async () => {
    let favorites = 0;
    let advances = 0;
    let errors = 0;
    const deps = makeCommit({
      toggleFavorite: async () => {
        throw new Error("offline");
      },
      onFavorite: () => {
        favorites++;
      },
      onError: () => {
        errors++;
      },
      advance: () => {
        advances++;
      },
    });

    const outcome = await commitDeckSwipe(deps);

    expect(outcome).toBe("error");
    expect(favorites).toBe(0);
    expect(advances).toBe(0);
    expect(errors).toBe(1);
    expect(deps.guard.has("card-a")).toBe(false);
  });

  test("après une erreur, la même carte peut être réessayée et réussir", async () => {
    let attempts = 0;
    let favorites = 0;
    let errors = 0;
    let advances = 0;
    const deps = makeCommit({
      toggleFavorite: async () => {
        attempts++;
        if (attempts === 1) throw new Error("offline");
        return { favorite: true };
      },
      onFavorite: () => {
        favorites++;
      },
      onError: () => {
        errors++;
      },
      advance: () => {
        advances++;
      },
    });

    expect(await commitDeckSwipe(deps)).toBe("error");
    expect(deps.guard.has("card-a")).toBe(false);

    expect(await commitDeckSwipe(deps)).toBe("favorite");
    expect(attempts).toBe(2);
    expect(favorites).toBe(1);
    expect(errors).toBe(1);
    expect(advances).toBe(0);
  });

  test("deux interactions rapprochées : une seule mutation pour la même carte", async () => {
    const pending = deferred<{ favorite: boolean }>();
    let toggles = 0;
    let favorites = 0;
    const deps = makeCommit({
      toggleFavorite: () => {
        toggles++;
        return pending.promise;
      },
      onFavorite: () => {
        favorites++;
      },
    });

    const first = commitDeckSwipe(deps);
    const second = await commitDeckSwipe(deps);

    expect(second).toBe("skipped");
    expect(toggles).toBe(1);
    // Le « skipped » ne doit pas libérer la garde du commit en vol.
    expect(deps.guard.has("card-a")).toBe(true);

    pending.resolve({ favorite: true });
    expect(await first).toBe("favorite");
    expect(favorites).toBe(1);
    expect(deps.guard.has("card-a")).toBe(false);
  });

  test("réponse tardive après changement de deck : pas d'avance d'index", async () => {
    const pending = deferred<{ favorite: boolean }>();
    let stillCurrent = true;
    let advances = 0;
    let notFavorites = 0;
    const deps = makeCommit({
      toggleFavorite: () => pending.promise,
      isStillCurrent: () => stillCurrent,
      onNotFavorite: () => {
        notFavorites++;
      },
      advance: () => {
        advances++;
      },
    });

    const first = commitDeckSwipe(deps);
    // Filtre changé/remélangé pendant l'attente : l'index a été remis à zéro.
    stillCurrent = false;
    pending.resolve({ favorite: false });

    expect(await first).toBe("not-favorite");
    expect(advances).toBe(0);
    expect(notFavorites).toBe(1);
    expect(deps.guard.has("card-a")).toBe(false);
  });

  test("retrait du favori : avance si la carte est toujours celle du deck", async () => {
    let advances = 0;
    let notFavorites = 0;
    const deps = makeCommit({
      toggleFavorite: async () => ({ favorite: false }),
      onNotFavorite: () => {
        notFavorites++;
      },
      advance: () => {
        advances++;
      },
    });

    expect(await commitDeckSwipe(deps)).toBe("not-favorite");
    expect(advances).toBe(1);
    expect(notFavorites).toBe(1);
    expect(deps.guard.has("card-a")).toBe(false);
  });
});

/**
 * Contrôle STATIQUE de câblage (comme tests/srs.test.ts qui lit le src) :
 * composant pour les callbacks, module lib pour le commit asynchrone.
 * il vérifie que le composant applique l'exclusion UNIQUEMENT une fois le
 * favori confirmé par le backend. Ce n'est PAS une validation navigateur :
 * les scénarios d'exécution sont couverts par les tests de logique pure
 * ci-dessus (withSwipedRight/filterExcludedFavorites/createCommitGuard).
 */
describe("discoverDeckState — câblage composant (contrôle statique)", () => {
  const src = readFileSync(
    path.join(process.cwd(), "src/components/learner/DiscoverView.tsx"),
    "utf8",
  );
  // Le commit asynchrone vit désormais dans le module testable : les
  // invariants de la garde et de la branche favori se lisent là-bas.
  const libSrc = readFileSync(
    path.join(process.cwd(), "src/lib/discoverDeckState.ts"),
    "utf8",
  );

  test("l'exclusion de session n'est posée QUE dans la branche favori confirmé", () => {
    // Le helper n'appelle `onFavorite` que dans la branche `res.favorite`.
    const successBranch = libSrc.indexOf("if (res.favorite) {");
    const onFavoriteCall = libSrc.indexOf("onFavorite();", successBranch);
    const catchBranch = libSrc.indexOf("} catch {", successBranch);
    expect(successBranch).toBeGreaterThan(-1);
    expect(onFavoriteCall).toBeGreaterThan(successBranch);
    expect(onFavoriteCall).toBeLessThan(catchBranch);

    // Le callback fourni par le composant porte l'exclusion ET la persistance.
    const callbackStart = src.indexOf("onFavorite: () => {");
    const markCall = src.indexOf("withSwipedRight(prev, id)", callbackStart);
    const persistCall = src.indexOf('pushHistoryId("discover_swiped"', callbackStart);
    expect(markCall).toBeGreaterThan(callbackStart);
    expect(persistCall).toBeGreaterThan(callbackStart);

    // Le catch ne doit ni exclure ni avancer : la carte reste réessayable.
    const finallyBranch = libSrc.indexOf("} finally {", catchBranch);
    const errorBlock = libSrc.slice(catchBranch, finallyBranch);
    expect(errorBlock).toContain("onError();");
    expect(errorBlock).not.toContain("withSwipedRight");
    expect(errorBlock).not.toContain("advance();");
  });

  test("le deck affiché est filtré par le Set de session (état React, pas un ref)", () => {
    // On vérifie que le filtre lit l'état favoritedSwiped (state) — la
    // lecture d'un ref.current dans le useMemo serait une violation
    // react-hooks "Cannot access refs during render".
    expect(src).toMatch(
      /filterExcludedFavorites\(deck \?\? \[\], favoritedSwiped\),/,
    );
    // La mise à jour passe par un setState fonctionnel immuable.
    expect(src).toMatch(
      /setFavoritedSwiped\(\(prev\) => withSwipedRight\(prev, id\)\);/,
    );
  });

  test("la garde anti double-commit est déléguée au commit asynchrone", () => {
    // Le helper acquiert une seule fois par carte et refuse le second commit.
    expect(libSrc).toMatch(/if \(!guard\.tryAcquire\(id\)\) return "skipped";/);
    // La garde est libérée après le succès comme après un rejet.
    expect(libSrc).toMatch(/finally \{\s*guard\.release\(id\);/);
    // Le composant fournit bien le verrou partagé, pas un nouveau verrou.
    expect(src).toMatch(/guard: commitGuardRef\.current/);
    expect(src).not.toMatch(/commitGuardRef\.current\.tryAcquire\(current\._id\)/);
  });

  test("une réponse tardive vérifie la carte ET la génération du deck", () => {
    expect(src).toMatch(
      /currentIdRef\.current === id && deckEpochRef\.current === deckEpoch/,
    );
    expect(src).toMatch(
      /deckEpochRef\.current \+= 1;\s*\}, \[filtersKey\]\);/,
    );
  });
});
