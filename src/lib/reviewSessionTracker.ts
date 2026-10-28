/**
 * Compteur de session de révision — source de vérité SYNCHRONE.
 *
 * Défauts corrigés dans ReviewView :
 *  1. closure `reviewed` périmée → off-by-one sur la dernière carte, session
 *     d'une seule carte jamais enregistrée (streak/XP perdus) ;
 *  2. `sessionSaved` jamais réarmé → les cartes rechargées dans la même vue
 *     (batch suivant) ne déclenchaient aucun recordSession ;
 *  3. index positionnel fragile : la file Convex se rétrécit dès qu'une carte
 *     est revue, donc `cards[index + 1]` pouvait sauter la carte suivante.
 *
 * Le tracker ne remplace pas la file : il porte les identifiants déjà
 * acceptés, le compteur du batch courant et son identité. `firstPendingCard`
 * dérive la carte à afficher de la file vivante, ce qui rend l'avancement
 * indépendant des re-renders et des réponses tardives.
 *
 * Cycle :
 *   tracker.start()                 // nouvelle session (identité + horloge)
 *   tracker.accept(cardId, session) // APRÈS succès backend uniquement
 *   const snapshot = takeIfComplete(cards, tracker)
 *   // snapshot == null tant qu'il reste une carte non acceptée
 *   // snapshot.itemsLearned est le total exact, dernière carte incluse
 *
 * `take()` consomme le batch une seule fois : un second appel renvoie 0.
 * Les identifiants acceptés restent connus pour ne pas réafficher une carte
 * déjà revue pendant que la requête Convex se rafraîchit.
 */

export interface ReviewSessionSnapshot {
  /** Identité de batch locale — protège les réponses tardives React. */
  sessionId: number;
  /**
   * Clé d'idempotence SERVEUR, générée une seule fois par `take()` et
   * conservée telle quelle dans toutes les tentatives de ce lot. Deux
   * sessions logiques distinctes ont des clés distinctes.
   */
  sessionKey: string;
  /** Cartes acceptées dans ce batch (0 si take() est rappelé). */
  itemsLearned: number;
  /** Durée du batch, minimum 1 s. */
  durationSeconds: number;
  /** Horodatage du début du batch. */
  startedAt: number;
}

export interface AcceptReviewResult {
  /** true uniquement si cette carte vient d'être comptée dans ce batch. */
  counted: boolean;
  /** true si la carte était déjà acceptée (double clic / rejeu). */
  duplicate: boolean;
  /** true si la réponse appartient à une session déjà remplacée. */
  staleSession: boolean;
  /** Compteur courant du batch après l'appel. */
  count: number;
}

export interface PendingSessionSave {
  snapshot: ReviewSessionSnapshot;
  language: string;
}

/** Résultat confirmé par `recordSession`, conservé avec le lot. */
export interface ReviewSessionSaveResult {
  xpGain: number;
  streak: number;
}

/** Reçu d'une session effectivement enregistrée par le serveur. */
export interface ReviewSessionReceipt {
  sessionKey: string;
  itemsLearned: number;
  /** `null` seulement si le callback de sauvegarde ne renvoyait rien. */
  xpGain: number | null;
  streak: number | null;
}

/**
 * Vue sérialisable du saver pour React. `error` n'est pas un texte destiné
 * à l'utilisateur : l'interface affiche une formulation traduite et utilise
 * cet état seulement pour distinguer attente / échec / reprise.
 */
export interface ReviewSessionSaverState {
  pending: number;
  inFlight: boolean;
  error: string | null;
  head: PendingSessionSave | null;
  receipts: Readonly<Record<string, ReviewSessionReceipt>>;
}

/**
 * Persistance optionnelle des lots en attente. L'implémentation ne doit
 * jamais lever : une indisponibilité de stockage dégrade le saver en mode
 * mémoire, elle ne bloque pas la sauvegarde réseau.
 */
export interface ReviewSessionPersistence {
  load(): PendingSessionSave[];
  save(pending: readonly PendingSessionSave[]): void;
}

/**
 * File de sauvegarde de sessions, strictement idempotente.
 *
 * Une tête de file n'est retirée qu'après succès de `save` : un échec de
 * `recordSession` ne perd aucun total accepté et sera retenté au prochain
 * `flush()`, y compris après un rechargement si une persistance est fournie.
 * L'identité de déduplication est la `sessionKey` (stable), jamais le
 * `sessionId` local qui peut être réutilisé par un nouveau tracker.
 */
export interface ReviewSessionSaver {
  enqueue(pending: PendingSessionSave): void;
  /** Tente la tête de file ; ne rejette jamais (l'état expose l'échec). */
  flush(): Promise<void>;
  /** Reprise explicite : rejoue la même file, sans nouvelle clé. */
  retry(): Promise<void>;
  /** Nombre de lots encore non persistés. */
  pending(): number;
  /** Vue stable pour `useSyncExternalStore`. */
  state(): ReviewSessionSaverState;
  subscribe(listener: () => void): () => void;
  /** Reçu serveur d'une clé donnée, s'il est connu. */
  receipt(sessionKey: string): ReviewSessionReceipt | undefined;
}

export function createReviewSessionSaver(
  save: (pending: PendingSessionSave) => Promise<ReviewSessionSaveResult | void>,
  persistence?: ReviewSessionPersistence,
): ReviewSessionSaver {
  const queue: PendingSessionSave[] = [];
  const saved = new Set<string>();
  const listeners = new Set<() => void>();
  let receipts: Record<string, ReviewSessionReceipt> = {};
  let error: string | null = null;
  let draining: Promise<void> | null = null;
  let snapshot: ReviewSessionSaverState = {
    pending: 0,
    inFlight: false,
    error: null,
    head: null,
    receipts,
  };

  const publish = () => {
    snapshot = {
      pending: queue.length,
      inFlight: draining !== null,
      error,
      head: queue[0] ?? null,
      receipts,
    };
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Un abonné défectueux ne doit pas casser la file.
      }
    }
  };

  const persist = () => {
    try {
      persistence?.save(queue);
    } catch {
      // Une implémentation défectueuse ne doit pas casser le drain.
    }
  };

  const enqueueUnique = (pending: PendingSessionSave) => {
    const key = pending.snapshot.sessionKey;
    if (saved.has(key) || queue.some((item) => item.snapshot.sessionKey === key)) {
      return false;
    }
    queue.push(pending);
    return true;
  };

  // Restaure les lots d'un onglet précédent AVANT que le premier flush ne
  // parte : ils seront rejoués avec leur clé d'origine, dans l'ordre.
  if (persistence) {
    try {
      for (const pending of persistence.load()) enqueueUnique(pending);
    } catch {
      // Persistance illisible : on repart simplement avec une file vide.
    }
  }
  publish();

  const flush = () => {
    // Un seul drain à la fois ; les appels concurrents partagent la même
    // promesse (ils attendent donc la vraie fin, pas un retour immédiat).
    if (draining) return draining;
    // Une nouvelle tentative repart d'un état d'erreur propre ; elle ne
    // fabrique aucun nouveau snapshot et réutilise les clés de la file.
    error = null;
    const run = (async () => {
      while (queue.length > 0) {
        const head = queue[0]!;
        if (saved.has(head.snapshot.sessionKey)) {
          queue.shift();
          persist();
          publish();
          continue;
        }
        let result: ReviewSessionSaveResult | void;
        try {
          result = await save(head);
        } catch (cause) {
          // La tête reste dans la file : aucun résultat accepté n'est
          // effacé par un échec, et le retry repartira de CETTE clé.
          error =
            cause instanceof Error && cause.message
              ? cause.message
              : "session_save_failed";
          publish();
          break;
        }
        saved.add(head.snapshot.sessionKey);
        receipts = {
          ...receipts,
          [head.snapshot.sessionKey]: {
            sessionKey: head.snapshot.sessionKey,
            itemsLearned: head.snapshot.itemsLearned,
            xpGain: result?.xpGain ?? null,
            streak: result?.streak ?? null,
          },
        };
        queue.shift();
        persist();
        publish();
      }
    })();
    draining = run.finally(() => {
      draining = null;
      publish();
    });
    publish();
    return draining;
  };

  return {
    enqueue(pending) {
      if (!enqueueUnique(pending)) return;
      persist();
      publish();
    },
    pending() {
      return queue.length;
    },
    flush,
    retry: flush,
    state() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    receipt(sessionKey) {
      return receipts[sessionKey];
    },
  };
}

export interface ReviewSessionTracker {
  /** Démarre une nouvelle session : nouvelle identité, compteur à zéro. */
  start(): void;
  /**
   * Crédite une carte acceptée par le backend.
   * `expectedSessionId` permet d'ignorer une réponse tardive d'une ancienne
   * session. Une carte déjà acceptée n'est jamais comptée deux fois.
   */
  accept(cardId: string, expectedSessionId?: number): AcceptReviewResult;
  /** Nombre de cartes acceptées dans le batch courant. */
  count(): number;
  /**
   * Total du dernier batch consommé par take() (0 après start()). Permet au
   * résumé de fin d'afficher N sans état React séparé, donc sans risque de
   * valeur périmée quand une nouvelle session démarre.
   */
  lastItemsLearned(): number;
  /** Identité du batch courant. */
  sessionId(): number;
  /** Identifiants acceptés depuis le montage (filtrés de la file). */
  acceptedIds(): ReadonlySet<string>;
  /** true si la carte a déjà été acceptée (batch courant ou précédent). */
  isAccepted(cardId: string): boolean;
  /**
   * Consomme le batch courant : renvoie son total exact puis le remet à zéro
   * et lui donne une nouvelle identité. Un second take() renvoie 0.
   */
  take(): ReviewSessionSnapshot;
}

/** Forme minimale d'une carte de file, compatible avec ReviewView. */
export interface ReviewCardRef {
  card: { _id: string };
}

/**
 * Première carte de la file qui n'a pas encore été acceptée. La file peut
 * rétrécir après chaque mutation : on ne dépend donc jamais d'un index
 * positionnel dans un tableau vivant.
 */
export function firstPendingCard<T extends ReviewCardRef>(
  cards: readonly T[],
  accepted: ReadonlySet<string>,
): T | undefined {
  return cards.find((item) => !accepted.has(item.card._id));
}

/**
 * true si `activeCardId` n'appartient pas au lot courant et qu'aucune carte
 * de ce lot n'attend encore. Sert à ouvrir une nouvelle session quand Convex
 * remplace la file par un nouveau lot SANS passer par un rendu vide
 * intermédiaire (un simple état React « terminé » ne suffirait pas).
 *
 * - lot inconnu (montage, premier lot) → true ;
 * - carte du lot courant → false ;
 * - carte injectée alors qu'une carte du lot attend encore → false
 *   (on ne coupe pas une session en cours) ;
 * - toutes les cartes du lot sont acceptées → true (nouveau lot).
 */
export function needsNewBatch<T extends ReviewCardRef>(
  batchIds: ReadonlySet<string> | null,
  cards: readonly T[],
  accepted: ReadonlySet<string>,
  activeCardId: string,
): boolean {
  if (batchIds === null) return true;
  if (batchIds.has(activeCardId)) return false;
  return !cards.some(
    (item) => !accepted.has(item.card._id) && batchIds.has(item.card._id),
  );
}

/**
 * Consomme la session UNIQUEMENT si au moins une carte a été acceptée et
 * qu'il ne reste aucune carte non acceptée dans la file fournie.
 *
 * - échec de mutation : `count() === 0` → null, aucune consommation ;
 * - dernière carte : retourne le snapshot complet (N incluse) ;
 * - second appel après take() : `count() === 0` → null, pas de double lot.
 */
export function takeIfComplete<T extends ReviewCardRef>(
  cards: readonly T[],
  tracker: ReviewSessionTracker,
): ReviewSessionSnapshot | null {
  if (tracker.count() === 0) return null;
  if (firstPendingCard(cards, tracker.acceptedIds()) !== undefined) return null;
  return tracker.take();
}

/**
 * Clé d'opération UUID opaque. `crypto.randomUUID()` est disponible dans
 * les navigateurs modernes et dans Bun ; le fallback `getRandomValues`
 * couvre les contextes non sécurisés, sans dépendance supplémentaire.
 * L'heure seule n'est jamais utilisée comme identifiant.
 */
function createSessionKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `srs_${cryptoApi.randomUUID()}`;
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return `srs_${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
  }
  // Dernier recours (très vieux runtime) : temps + deux tirages aléatoires.
  return `srs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function createReviewSessionTracker(
  now: () => number = Date.now,
): ReviewSessionTracker {
  let batchStart = now();
  let items = 0;
  let lastItems = 0;
  let session = 0;
  const accepted = new Set<string>();

  return {
    start() {
      session += 1;
      items = 0;
      lastItems = 0;
      batchStart = now();
    },
    accept(cardId, expectedSessionId) {
      if (expectedSessionId !== undefined && expectedSessionId !== session) {
        return {
          counted: false,
          duplicate: false,
          staleSession: true,
          count: items,
        };
      }
      if (accepted.has(cardId)) {
        return {
          counted: false,
          duplicate: true,
          staleSession: false,
          count: items,
        };
      }
      accepted.add(cardId);
      items += 1;
      return {
        counted: true,
        duplicate: false,
        staleSession: false,
        count: items,
      };
    },
    count() {
      return items;
    },
    lastItemsLearned() {
      return lastItems;
    },
    sessionId() {
      return session;
    },
    acceptedIds() {
      return accepted;
    },
    isAccepted(cardId) {
      return accepted.has(cardId);
    },
    take() {
      const snapshot: ReviewSessionSnapshot = {
        sessionId: session,
        // Une clé par lot consommé : le saver peut rejouer CE snapshot
        // autant de fois que nécessaire, la clé ne change jamais.
        sessionKey: createSessionKey(),
        itemsLearned: items,
        durationSeconds: Math.max(
          1,
          Math.round((now() - batchStart) / 1000),
        ),
        startedAt: batchStart,
      };
      // Le batch est consommé : le suivant part d'un compteur à zéro et
      // d'une identité différente (une réponse tardive de l'ancien batch
      // sera refusée par accept()). Le total reste lisible pour le résumé.
      lastItems = items;
      items = 0;
      batchStart = now();
      session += 1;
      return snapshot;
    },
  };
}
