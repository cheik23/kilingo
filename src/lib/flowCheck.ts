/* ═══════════════════════════════════════════════════════════════════════
   FLOW CHECK — ÉVALUATION D'UNE PRISE DE VOIX (couche PURE)

   Ce que ce module mesure VRAIMENT, et avec quoi :

     • RECONNAISSANCE — le pourcentage de l'expression attendue que le
       transcripteur (Whisper, moteur local du déploiement) a retrouvé
       dans la prise. Alignement mot à mot, donc actionnable : on sait
       QUELS mots n'ont pas été reconnus.
     • DÉBIT — mots/minute calculés sur les horodatages RÉELS des mots
       rendus par le moteur (`return_timestamps: "word"`), jamais sur une
       durée supposée.

   FORMULE DU SCORE — UN SEUL NOMBRE, UN SEUL SENS :

       score = mots de l'expression retrouvés / mots attendus

   C'est littéralement la réponse à « le moteur a-t-il compris ce que je
   disais ? ». Ce choix vient d'un cas RÉEL : un extrait de 11 s dont la
   prise commençait par « And so my fellow Americans… » faisait tomber une
   expression parfaitement prononcée à 41 % avec une distance d'édition.
   Les mots en trop ne doivent pas couler une prise (« euh… wesh reuf »),
   et ils sont déjà signalés nommément (`extra`). Une seconde dimension
   pondérée (précision) a été essayée puis retirée : elle ajoutait un
   chiffre que personne ne pouvait interpréter, et plus personne ne savait
   pourquoi deux prises identiques ne donnaient pas le même score.

   Ce que ce module ne mesure PAS, et ne doit donc jamais laisser croire :
   l'accent, l'intonation, la qualité des phonèmes. Un transcripteur texte
   ne fournit aucun de ces signaux — l'interface parle donc de
   « reconnaissance », pas d'« accent validé » (§11).

   Aucun import, aucun accès réseau, aucun DOM : testable tel quel.
   ═══════════════════════════════════════════════════════════════════════ */

/** Seuil de réussite d'une prise : 70 % de reconnaissance (règle §Flow). */
export const FLOW_PASS_THRESHOLD = 70;
/** Zone « presque » : entre 45 % et 69 %, on encourage sans valider. */
export const FLOW_CLOSE_THRESHOLD = 45;

/** Bornes du débit « naturel » (mots/minute). Hors bornes = indication,
 *  jamais une note : un débit lent n'est pas une faute. */
export const FLOW_SLOW_WPM = 70;
export const FLOW_FAST_WPM = 210;

export type FlowVerdict = "passed" | "close" | "failed";

export type FlowComparison = {
  /** Score 0-100 : part de l'expression effectivement reconnue. */
  coverage: number;
  /** Mots de l'expression attendue, normalisés. */
  expected: string[];
  /** Mots de la transcription, normalisés. */
  heard: string[];
  /** Mots attendus NON reconnus, dans l'ordre de l'expression. */
  missing: string[];
  /** Mots entendus qui n'appartiennent pas à l'expression. */
  extra: string[];
};

export type FlowTempo = {
  /** Durée entre le premier et le dernier mot horodaté (s). */
  seconds: number;
  /** Nombre de mots horodatés retenus pour le calcul. */
  words: number;
  /** Mots/minute estimés. */
  wpm: number;
  band: "slow" | "steady" | "fast";
};

/** Mot horodaté, tel que le moteur local le rend. */
export type FlowWord = { word: string; start: number; end: number };

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Normalisation partagée par la comparaison : minuscules, diacritiques
 * retirés, apostrophes et tirets traités comme des séparateurs (« t'as »
 * et « tas » restent comparables), ponctuation supprimée.
 */
export function normalizeFlowText(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/['\u2019`\u2011-]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe une chaîne en mots normalisés (tableau vide si rien à comparer). */
export function flowTokens(text: string): string[] {
  const normalized = normalizeFlowText(text);
  return normalized.length > 0 ? normalized.split(" ") : [];
}

/**
 * Alignement par plus longue sous-séquence commune : renvoie quels mots
 * attendus ont été retrouvés et lesquels ne l'ont pas été. C'est ce qui
 * permet de dire « il manque CE mot », au lieu d'un score muet.
 */
function alignLcs(
  expected: string[],
  heard: string[],
): { matchedExpected: boolean[]; matchedHeard: boolean[] } {
  const n = expected.length;
  const m = heard.length;
  const matchedExpected = new Array<boolean>(n).fill(false);
  const matchedHeard = new Array<boolean>(m).fill(false);
  if (n === 0 || m === 0) return { matchedExpected, matchedHeard };

  // Table des longueurs de sous-séquence commune.
  const table: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        expected[i] === heard[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === heard[j]) {
      matchedExpected[i] = true;
      matchedHeard[j] = true;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return { matchedExpected, matchedHeard };
}

/**
 * Compare l'expression attendue à la transcription de la prise.
 *
 * `expected` vide ⇒ aucun score n'a de sens : tous les compteurs restent à
 * zéro et l'appelant ne doit rien afficher (jamais un faux 100 %).
 */
export function compareFlow(
  expected: string,
  transcript: string,
): FlowComparison {
  const expectedTokens = flowTokens(expected);
  const heardTokens = flowTokens(transcript);
  if (expectedTokens.length === 0) {
    return {
      coverage: 0,
      expected: [],
      heard: heardTokens,
      missing: [],
      extra: heardTokens,
    };
  }
  const { matchedExpected, matchedHeard } = alignLcs(expectedTokens, heardTokens);
  const matched = matchedExpected.filter(Boolean).length;
  const missing = expectedTokens.filter((_, index) => !matchedExpected[index]);
  const extra = heardTokens.filter((_, index) => !matchedHeard[index]);
  const coverage = Math.round((matched / expectedTokens.length) * 100);
  return {
    coverage,
    expected: expectedTokens,
    heard: heardTokens,
    missing,
    extra,
  };
}

/** Verdict d'un score (la reconnaissance, en %) : réussite, « presque »,
 *  ou à retravailler. */
export function flowVerdict(score: number): FlowVerdict {
  if (score >= FLOW_PASS_THRESHOLD) return "passed";
  if (score >= FLOW_CLOSE_THRESHOLD) return "close";
  return "failed";
}

/**
 * Débit de parole, calculé sur les horodatages réels du moteur.
 * Moins de deux mots horodatés ⇒ `null` : aucun débit ne peut être
 * annoncé, et l'interface n'en affiche pas.
 */
export function flowTempo(words: FlowWord[]): FlowTempo | null {
  const usable = words.filter(
    (w) =>
      Number.isFinite(w.start) &&
      Number.isFinite(w.end) &&
      w.end >= w.start &&
      w.start >= 0,
  );
  if (usable.length < 2) return null;
  const start = Math.min(...usable.map((w) => w.start));
  const end = Math.max(...usable.map((w) => w.end));
  const seconds = end - start;
  if (!(seconds > 0)) return null;
  const wpm = Math.round((usable.length / seconds) * 60);
  const band: FlowTempo["band"] =
    wpm < FLOW_SLOW_WPM ? "slow" : wpm > FLOW_FAST_WPM ? "fast" : "steady";
  return {
    seconds: Math.round(seconds * 10) / 10,
    words: usable.length,
    wpm,
    band,
  };
}

/** Aplatit les mots horodatés d'une transcription en segments. */
export function flowWordsFromSegments(
  segments: { words?: FlowWord[] }[],
): FlowWord[] {
  const out: FlowWord[] = [];
  for (const segment of segments) {
    for (const word of segment.words ?? []) out.push(word);
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * État d'une prise, tel que l'interface doit le présenter. Une transcription
 * vide est un ÉCHEC EXPLICITE (`no-speech`), jamais un score de 0 % : le
 * moteur n'a rien jugé du tout.
 */
export type FlowOutcome =
  | { kind: "scored"; comparison: FlowComparison; tempo: FlowTempo | null; verdict: FlowVerdict }
  | { kind: "no-speech" };

export function evaluateFlow(
  expected: string,
  transcript: string,
  words: FlowWord[] = [],
): FlowOutcome {
  if (flowTokens(transcript).length === 0) return { kind: "no-speech" };
  const comparison = compareFlow(expected, transcript);
  return {
    kind: "scored",
    comparison,
    tempo: flowTempo(words),
    verdict: flowVerdict(comparison.coverage),
  };
}
