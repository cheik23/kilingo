import type { SwipeDirection } from "@/hooks/useSwipe";

/**
 * État du deck de Découverte — logique extraite du composant pour être
 * testable (bun test) et verrouiller deux défauts de parcours.
 *
 * D-B — LE FAVORI RÉAPPARAÎT (perte de favori) :
 *   avant correction, le swipe droit poussait l'identifiant dans
 *   `discover_swiped` (localStorage, FIFO 300, lu au SEUL montage) mais ne
 *   touchait ni l'exclusion de session ni le deck affiché. Résultat :
 *   après « Remélanger » (état vide) ou un changement de filtre, la carte
 *   mise de côté réapparaissait en tête (deck trié popularité d'abord) et
 *   le SECOND clic sur le cœur = toggle = SUPPRESSION SILENCIEUSE du
 *   favori que l'utilisateur venait d'ajouter.
 * * Ici : `withSwipedRight` produit un NOUVEAU Set d'exclusion de session
 *   (state React, jamais lu dans un ref au rendu) et
 *   `filterExcludedFavorites` retire ces cartes du deck AFFICHÉ. Ce Set
 *   reste volontairement hors `deckArgs` : un refetch Convex en pleine
 *   session décalerait le deck à venir (carte sautée). L'exclusion n'est
 *   appliquée QUE si le backend a confirmé la création du favori
 *   (res.favorite) — un échec ou un retrait ne cache pas la carte, la
 *   réessai reste possible (mission parcours). La persistance
 *   inter-sessions reste celle qui existe déjà :
 *   `pushHistoryId("discover_swiped", id)` → `excludeList` du prochain
 *   montage exclude la carte côté serveur.
 *
 * D-T — DOUBLE COMMIT (favori créé puis supprimé) :
 *   deux clics rapides sur la MÊME carte exécutaient deux `commitSwipe`
 *   issus du même render : deux `toggleSlangFavorite` en vol (le second
 *   annulait le premier — favori immédiatement perdu, toasts
 *   contradictoires) ou deux avances de deck (carte sautée). La garde
 *   `createCommitGuard` bloque par carte : un seul commit en vol, release
 *   à la résolution de la mutation (ou aussitôt pour un swipe sans échange
 *   réseau comme le swipe gauche).
 */

export const DISCOVER_HISTORY_KEYS = ["discover_shown", "discover_swiped"] as const;
export type DiscoverHistoryKey = (typeof DISCOVER_HISTORY_KEYS)[number];

/** Storage factice pour assemblage sans navigateur (bun test). */
export const READONLY_STORAGE: Pick<Storage, "getItem"> = {
  getItem: () => null,
};

/** Lit une clé d'historique (FIFO 300). Silencieux sans localStorage. */
export function readHistoryIds(key: DiscoverHistoryKey): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-300) : [];
  } catch {
    return [];
  }
}

/** Pousse un id dans une clé d'historique (FIFO 300). */
export function pushHistoryId(key: DiscoverHistoryKey, id: string): void {
  try {
    const arr = readHistoryIds(key);
    const next = [...arr, id].slice(-300);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // localStorage indisponible — la variation sera moindre mais l'app tient.
  }
}

/** Exclusion initiale d'une session de deck : union FIFO des deux clés. */
export function initialExcludeList(storage: Pick<Storage, "getItem"> = localStorage): string[] {
  try {
    const ids: string[] = [];
    for (const key of DISCOVER_HISTORY_KEYS) {
      const raw = storage.getItem(key);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) ids.push(...arr.slice(-300));
    }
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

/** Rotation FIFO du remélange : libère les 20 plus anciennes au cycle. */
export function shuffledExclusion(prev: string[]): string[] {
  return prev.length > 40 ? prev.slice(20) : prev;
}

/**
 * Retourne un NOUVEAU Set = `prev` + la carte mise de côté (favori).
 * Idempotent : remettre la même carte ne crée aucun doublon ; si la
 * carte y est déjà, le Set d'origine est renvoyé tel quel (identité
 * préservée → aucun re-render React inutile).
 *
 * Pur et immuable : le composant l'utilique dans un setState
 * fonctionnel, ce qui garde la lecture de l'état en phase de rendu
 * sans accès à un ref (règle react-hooks).
 */
export function withSwipedRight(prev: ReadonlySet<string>, id: string): Set<string> {
  if (prev.has(id)) return prev as Set<string>;
  const next = new Set(prev);
  next.add(id);
  return next;
}

/** Le deck affiché ne contient JAMAIS une carte marquée mise de côté. */
export function filterExcludedFavorites<T extends { _id: string }>(
  items: readonly T[],
  excluded: ReadonlySet<string>,
): T[] {
  return items.filter((i) => !excluded.has(i._id));
}

export interface CommitGuard {
  /** true si le commit peut partir ; false (carte réservée) sinon. */
  tryAcquire(id: string): boolean;
  /** Libère la carte une fois la mutation résolue (toujours). */
  release(id: string): void;
  /** Diagnostic : true si un commit est en vol pour cette carte. */
  has(id: string): boolean;
}

/** Garde anti double-commit : un verrou par carte. */
export function createCommitGuard(): CommitGuard {
  const inFlight = new Set<string>();
  return {
    tryAcquire(id: string): boolean {
      if (inFlight.has(id)) return false;
      inFlight.add(id);
      return true;
    },
    release(id: string): void {
      inFlight.delete(id);
    },
    has(id: string): boolean {
      return inFlight.has(id);
    },
  };
}

/**
 * Commit d'un swipe de deck — chemin ASYNCHRONE isolé pour être testé sans
 * DOM (bun test). Le composant lui délègue la garde et les transitions.
 *
 * Invariants :
 *  · gauche : avance immédiatement, aucune mutation de favori ;
 *  · droite + `favorite: true` : `onFavorite` (exclusion de session), PAS
 *    d'avance d'index — la carte retirée laisse sa place à la suivante ;
 *  · droite + `favorite: false` : avance seulement si la carte est encore
 *    celle du deck (`isStillCurrent`), sinon une réponse tardive ferait
 *    sauter une carte du nouveau deck ;
 *  · erreur : `onError` seul, ni exclusion ni avance — la carte reste
 *    affichée et peut être réessayée ;
 *  · garde : acquise ici, libérée dans TOUS les chemins (y compris rejet).
 *    Un second commit sur la même carte pendant le vol est « skipped ».
 */
export type DeckSwipeOutcome =
  | "left"
  | "favorite"
  | "not-favorite"
  | "error"
  | "skipped";

export interface DeckSwipeCommit {
  id: string;
  direction: SwipeDirection;
  guard: CommitGuard;
  toggleFavorite: (id: string) => Promise<{ favorite: boolean }>;
  /** true si la carte est encore celle affichée au moment de la réponse. */
  isStillCurrent: () => boolean;
  onFavorite: () => void;
  onNotFavorite: () => void;
  onError: () => void;
  advance: () => void;
}

export async function commitDeckSwipe({
  id,
  direction,
  guard,
  toggleFavorite,
  isStillCurrent,
  onFavorite,
  onNotFavorite,
  onError,
  advance,
}: DeckSwipeCommit): Promise<DeckSwipeOutcome> {
  if (!guard.tryAcquire(id)) return "skipped";
  if (direction === "left") {
    guard.release(id);
    advance();
    return "left";
  }
  try {
    const res = await toggleFavorite(id);
    if (res.favorite) {
      onFavorite();
      return "favorite";
    }
    if (isStillCurrent()) advance();
    onNotFavorite();
    return "not-favorite";
  } catch {
    onError();
    return "error";
  } finally {
    guard.release(id);
  }
}
