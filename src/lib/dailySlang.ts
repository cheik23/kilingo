/* ═══════════════════════════════════════════════════════════════════════
   SLANG DU JOUR — SÉLECTION DÉTERMINISTE (couche PURE)

   L'habitude quotidienne repose sur une certitude : tout le monde voit
   LA même expression le même jour. Le tirage ne peut donc PAS dépendre
   d'un `Math.random` (chaque utilisateur aurait son propre tirage) ni de
   l'heure locale du joueur.

   D'où cette couche pure, sans Convex, sans réseau, sans horloge :
   `buildDailySlang(today, language, candidates)` est une fonction
   déterministe — même jour + même langue + même vivier ⇒ carte
   IDENTIQUE, octet pour octet. `convex/dailySlang.ts` l'appelle deux
   fois : une pour afficher, une pour corriger. Les deux ne peuvent donc
   pas diverger, et une réponse juste ne peut pas être inventée côté
   client (il n'y en a rien à inventer : le serveur recalcule).

   Testable tel quel (`scripts/verify-daily-slang.mjs`), comme
   `flowCheck.ts` et `asrEngine.ts`.
   ═════════════════════════════════════════════════════════════════════ */

/** Taille du vivier quotidien (exprimé en lignes les plus populaires). */
export const DAILY_POOL_SIZE = 100;
/** XP de base d'une réussite — passe ensuite par `applyAward`. */
export const DAILY_XP = 5;
/** Nombre de propositions du QCM (dont la bonne). */
export const DAILY_OPTIONS = 4;

/** Ligne du vivier — structure minimale dont la sélection a besoin. */
export type DailyCandidate = {
  _id: string;
  expression: string;
  meaning: string;
  context: string;
  literal?: string;
  register: string;
  region: string;
};

export type DailySlangCard = {
  dayKey: string;
  language: string;
  slangId: string;
  expression: string;
  meaning: string;
  context: string;
  literal?: string;
  register: string;
  region: string;
  options: string[];
  answerIndex: number;
};

/** FNV-1a : graine déterministe pour le tirage du jour. */
function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mélange déterministe (Fisher-Yates mû par la graine du jour). */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * Construit la carte du jour à partir du vivier (trié par popularité
 * décroissante, déjà borné côté serveur).
 *
 * `null` quand le vivier ne porte aucune expression traduisible : l'appelant
 * n'affiche alors RIEN, plutôt qu'une carte sans expression.
 */
export function buildDailySlang(
  today: string,
  language: string,
  candidates: DailyCandidate[],
): DailySlangCard | null {
  const pool = candidates.filter((c) => c.meaning.trim().length > 0);
  if (pool.length === 0) return null;

  const base = seedOf(`${today}|${language}`);
  const head = pool[base % pool.length];

  // Distracteurs : les suivants du vivier, jamais le même sens, jamais le
  // bon. Ordre déterministe — identique pour tous les utilisateurs.
  const options = [head.meaning];
  let cursor = 1;
  while (options.length < DAILY_OPTIONS && cursor < pool.length) {
    const candidate = pool[(base + cursor) % pool.length];
    cursor += 1;
    if (candidate._id === head._id) continue;
    if (options.includes(candidate.meaning)) continue;
    options.push(candidate.meaning);
  }
  // Vivier petit ou sens très partagés : le QCM est rendu quand même, avec
  // ce qui existe — jamais de fausses propositions fabriquées.
  const shuffled = seededShuffle(options, base ^ 0x9e3779b9);

  return {
    dayKey: today,
    language,
    slangId: head._id,
    expression: head.expression,
    meaning: head.meaning,
    context: head.context,
    ...(head.literal ? { literal: head.literal } : {}),
    register: head.register,
    region: head.region,
    options: shuffled,
    answerIndex: shuffled.indexOf(head.meaning),
  };
}
