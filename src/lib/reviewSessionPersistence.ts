/* ═══════════════════════════════════════════════════════════════════════
   SRS — PERSISTANCE DES LOTS DE SESSION EN ATTENTE

   Le saver garde en mémoire une tête de file tant que `recordSession` n'a
   pas répondu. Sans persistance, un rechargement ou une fermeture d'onglet
   après une réponse perdue perdait ce lot — alors même que le serveur
   l'avait peut-être déjà enregistré.

   Ce module ne fait qu'une chose : sérialiser les snapshots DÉJÀ construits
   (clé d'idempotence incluse) dans localStorage. Il ne génère aucune clé,
   ne décide d'aucun XP et ne touche jamais au backend. Un lot rechargé est
   rejoué avec la même clé : le serveur reconnaît l'opération et restitue le
   résultat original.

   Aucune donnée de carte n'est stockée (pas d'identifiant de carte, pas de
   contenu pédagogique) : uniquement langue, durée, total et clé opaque.

   ÉCHECS DE STOCKAGE : localStorage peut être indisponible (navigation
   privée stricte, quota). load retourne [] et save est un no-op ; le saver
   continue alors en mémoire, comme avant.
   ═══════════════════════════════════════════════════════════════════════ */

import { LANGUAGE_CODES } from "../convex/languages";
import type {
  PendingSessionSave,
  ReviewSessionPersistence,
  ReviewSessionSnapshot,
} from "./reviewSessionTracker";

/** Une seule clé : la file locale est remplacée, jamais concaténée. */
export const REVIEW_PENDING_STORAGE_KEY = "kilingo.review.pendingSessions.v1";

/**
 * Chaque compte a sa propre file locale. Sans ce cloisonnement, un lot
 * laissé par l'utilisateur A serait rejoué sous l'identité de B après une
 * déconnexion — le serveur créditerait alors le mauvais compte.
 */
export function reviewPendingStorageKey(userId: string): string {
  return `${REVIEW_PENDING_STORAGE_KEY}.${userId}`;
}

/** Nombre maximal de lots restaurés (garde-fou contre un stockage altéré). */
const MAX_PENDING = 20;

/** Sous-ensemble de Storage utilisé — injectable dans les tests. */
export interface ReviewSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage peut lever à l'accès (Safari privé) : jamais de crash. */
function defaultStorage(): ReviewSessionStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Même alphabet que le validateur serveur — une clé invalide ne doit pas
    être rejouée indéfiniment par le client. */
const SESSION_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** Langues réellement acceptées par le validateur de `recordSession`. */
const SUPPORTED_LANGUAGES = new Set<string>(LANGUAGE_CODES);

function isSnapshot(value: unknown): value is ReviewSessionSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    typeof snapshot.sessionId === "number" &&
    Number.isFinite(snapshot.sessionId) &&
    typeof snapshot.sessionKey === "string" &&
    SESSION_KEY_RE.test(snapshot.sessionKey) &&
    typeof snapshot.itemsLearned === "number" &&
    Number.isFinite(snapshot.itemsLearned) &&
    snapshot.itemsLearned >= 0 &&
    typeof snapshot.durationSeconds === "number" &&
    Number.isFinite(snapshot.durationSeconds) &&
    snapshot.durationSeconds >= 0 &&
    typeof snapshot.startedAt === "number" &&
    Number.isFinite(snapshot.startedAt)
  );
}

function isPending(value: unknown): value is PendingSessionSave {
  if (typeof value !== "object" || value === null) return false;
  const pending = value as Record<string, unknown>;
  return (
    typeof pending.language === "string" &&
    SUPPORTED_LANGUAGES.has(pending.language) &&
    isSnapshot(pending.snapshot)
  );
}

/**
 * Persistance best-effort des lots en attente. Les entrées malformées sont
 * ignorées et les clés dupliquées ne sont conservées qu'une fois.
 */
export function createReviewSessionPersistence(
  storage: ReviewSessionStorage | null = defaultStorage(),
  storageKey: string = REVIEW_PENDING_STORAGE_KEY,
): ReviewSessionPersistence {
  return {
    load() {
      if (!storage) return [];
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        const pending: PendingSessionSave[] = [];
        for (const value of parsed) {
          if (pending.length >= MAX_PENDING) break;
          if (!isPending(value)) continue;
          if (seen.has(value.snapshot.sessionKey)) continue;
          seen.add(value.snapshot.sessionKey);
          pending.push(value);
        }
        return pending;
      } catch {
        // JSON corrompu, quota ou storage indisponible : aucun lot restauré.
        return [];
      }
    },
    save(pending) {
      if (!storage) return;
      try {
        if (pending.length === 0) {
          storage.removeItem(storageKey);
          return;
        }
        storage.setItem(storageKey, JSON.stringify(pending));
      } catch {
        // Le saver conserve sa file en mémoire ; la perte de persistance est
        // réelle et assumée, elle ne bloque pas la sauvegarde réseau.
      }
    },
  };
}

/**
 * File persistée propre à UN utilisateur. Le composant ne l'ouvre qu'une
 * fois le compte chargé (`RequireAuth` attend `users.currentUser`) : un lot
 * ne peut donc jamais migrer d'un compte à un autre via le stockage local.
 */
export function createUserReviewSessionPersistence(
  userId: string,
  storage: ReviewSessionStorage | null = defaultStorage(),
): ReviewSessionPersistence {
  return createReviewSessionPersistence(
    storage,
    reviewPendingStorageKey(userId),
  );
}
