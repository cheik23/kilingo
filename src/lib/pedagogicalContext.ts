/**
 * BOUCLIER D'AFFICHAGE — contextes pédagogiques (v3, audité P1.1–P1.4)
 *
 * Mesure exacte sur le bundle des sources (6 601 fiches, audit
 * `audit-quality-shield/signatures.mjs`) — 7 signatures de gabarits, une
 * classification DISJOINTE :
 *
 *   PURE(1) / MIXED(1184) / DIRECTIVE(13) / EMPTY_EX(0) /
 *   LABEL(5397) / AMBIGUOUS(6)
 *
 *   · PURE : gabarit de provenance
 *     `[Époque: …] | [Niveau: …] | [Source: …]` sans segment Ex —
 *     scaffolding interne de catalogue, JAMAIS pédagogique.
 *   · MIXED : gabarit de provenance + un exemple complet extractible
 *     (2 familles : segment `[Ex: …]`, ou partie finale libre
 *     `[« citation » — explication]` du format es/pt).
 *   · DIRECTIVE : le segment Ex est une consigne interne (« phrase-exemple
 *     non fournie ; à composer par un natif ») — rien d'exploitable.
 *   · LABEL : label pédagogique légitime (crochet SANS deux-points) suivi
 *     de vrai contenu (`[Télétravail] | Travail depuis son domicile…`,
 *     format des fiches id/am/ig) OU une partie libre à en-tête — à
 *     AFFICHER INTACT (mission : « ne pas considérer chaque paire de
 *     crochets comme une erreur »).
 *   · AMBIGUOUS : gabarit dont l'Ex est un simple token non ponctué
 *     (« GG », « Teaser », « BTS », « Nakaka-lag ») ou un texte tronqué
 *     (segment contenant un « | » interne) — revue humaine, ne rien
 *     inventer.
 *
 * Ce module ne fait que la PRÉSENTATION : il ne touche jamais la donnée
 * stockée ni les objets Convex. Passage garanti sur Unicode complet
 * (arabe, chinois, thaï, bengali, vietnamien — tokenization \p{L}/\p{M}/
 * \p{N}) : les gabarits s'y emploient aussi, le rendu reste intact.
 */

/** Clés de provenance réellement présentes dans le scaffolding (audit). */
const PROVENANCE_KEYS = [
  "Époque", "Epoque", "Niveau", "Source", "Ex", "Exemple", "Période",
  "Periode", "Registre", "Origin", "Langue", "Note",
] as const;

/** Un segment de provenance : `[Clé: …]` en une seule partie « | ».
 * Durcissement audité (variante documentée) : les deux-points ASCII « : »
 * et pleine-largeur « : » (CJK, déjà acceptés par EX_EXTRACT_RE) sont
 * équivalents ; la clé est insensible à la casse et aux diacritiques
 * É/E, é/e (Époque/Epoque, Période/Periode déjà listées).
 */
const SEGMENT_FULL_RE = new RegExp(
  `^\\[\\s*(${PROVENANCE_KEYS.join("|")})\\s*[:\\uFF1A][^\\]]*\\]$`,
  "i",
);
/** Retire les crochets décoratifs autour d'une partie (AFFICHAGE : les
 * guillemets « … » sont conservés à l'identique). */
function removeBrackets(s: string): string {
  return s.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();
}

/**
 * Consignes internes repérées dans le champ Ex (source : ig, audit). Les
 * gabarits confirmés y tombent ; un contexte libre n'est JAMAIS soumis à
 * ces marqueurs non ancrés.
 */
const DIRECTIVE_RE = [
  // — Ancrées (mêmes règles que le classifier d'audit) —
  /^\s*à\s+.*\bcomposer/i,
  /^\s*à\s+compléter/i,
  /^\s*à\s+écrire/i,
  /^\s*à\s+ajouter/i,
  /^\s*non\s+fourni/i,
  /^\s*pas\s+fourni/i,
  /^\s*à\s+venir/i,
  // Ancre resserrée : « n/a » seul ou suivi d'un signe, PAS « Na-ghosted ».
  /^\s*n\/?a(?:$|[\s.,!?;:、，。])/i,
  /^\s*none(?:$|[\s.,!?;:])/i,
  /^\s*todo/i,
  /^\s*\.\.\.\s*$/,
  /^xx+/i,
  /^\s*(usage|sens|définition|phrase)\b(?=[^\n]{0,60}(rapporté|sens|fournie|à valider|à compose|vierge|non|rien))/i,
  // — Non ancrées : ne s'appliquent qu'à un contenu de gabarit confirmé —
  /phrase[\s-]?exemple\s+(?:non|pas)\s+fournie?s?/i,
  /phrase[\s-]?exemple\s+à\s+(?:valide|compose|rédiger)/i,
  /(?:non|pas)\s+fournie?s?\s+par\s+la\s+source/i,
  /à\s+(?:composer|rédiger)(?:\s+par\s+un\s+natif)?/i,
  /usage\s+courant\s+sans\s+exemple/i,
  /\b(usage|sens|définition)\s+(rapporté\b|du\s+(?:fil|thread))/i,
  /à\s+valide(?:r|z|ie)/i,
];

/**
 * « Exemple complet » — indices STRUCTURAUX mesurés (aucune validation
 * linguistique) :
 *   (a) ≥ 2 tokens Unicode OU 1 token avec ponctuation finale ; ET
 *   (b) longueur ≥ 5 points de code après retrait des guillemets ;
 *   les cas douteux (token unique non ponctué, < 5 pts) ne passent PAS :
 *   ils vont en AMBIGUOUS → l'apprenant ne voit rien d'inventé.
 */
function isCompleteExample(s: string | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  const stripped = removeBrackets(s);
  if ([...stripped].length < 5) return false;
  if (DIRECTIVE_RE.some((re) => re.test(stripped))) return false;
  // La mesure (longueur, tokens, ponctuation) se fait SANS les guillemets
  // décoratifs : un guillemet fermant n'est pas une fin de phrase.
  const bare = stripped
    .replace(/^['"«“`‘’]+/, "")
    .replace(/['"»”`‘’]+$/, "")
    .trim();
  if ([...bare].length < 5) return false;
  const tokens = bare.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\-_.]*/gu) ?? [];
  if (tokens.length >= 2) return true;
  if (tokens.length === 1 && /\p{P}$|[.!?…؛؟।。！]/u.test(bare)) return true;
  return false;
}

/**
 * Contenu d'un segment ou partie du gabarit → verdict d'affichage :
 *  · MIXED      → le contenu (ex. de la citation + explication), SANS gabarit ;
 *  · DIRECTIVE  → null (masquage : aucune consigne interne) ;
 *  · AMBIGUOUS  → null (pas d'invention, pas de tronquage silencieux) ;
 *  · EMPTY      → null.
 */
function displayContent(content: string | undefined): string | null {
  if (!content) return null;
  const body = removeBrackets(content);
  if (!body) return null;
  if (DIRECTIVE_RE.some((re) => re.test(body))) return null; // DIRECTIVE
  if (isCompleteExample(body)) return body; // MIXED
  return null; // AMBIGUOUS
}

/**
 * Détecte un gabarit de provenance de catalogue (utilisé aussi dans les
 * tests de non-régression) : le texte commence par un crochet et la TÊTE de
 * la découpe en parties « | » porte ≥ 2 segments `[Clé: …]` de
 * provenance. Un seul `[Clé: …]` en milieu de phrase → pas un gabarit.
 */
export function isProvenanceTemplate(
  text: string | null | undefined,
): boolean {
  const raw = (text ?? "").trim();
  if (!raw.startsWith("[")) return false;
  let lead = 0;
  for (const part of raw.split("|").map((p) => p.trim())) {
    if (!part) continue;
    if (SEGMENT_FULL_RE.test(part)) lead++;
    else break;
  }
  return lead >= 2;
}

/**
 * Le point d'entrée partagé : renvoie le texte AFFICHABLE, ou `null` s'il
 * faut masquer le bloc (repli le plus discret — aucun statut faux, aucun
 * exemple inventé, aucun tronquage silencieux).
 *
 * · PURE (gabarit sans Ex) → null ;
 * · MIXED (gabarit + exemple complet) → l'exemple SEUL, sans le gabarit ;
 * · DIRECTIVE / EMPTY / AMBIGUOUS (Ex douteux) → null ;
 * · LABEL / libre / écritures non latines → RENVOYÉ INTACT.
 */
export function displayContext(
  text: string | null | undefined,
): string | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  if (!raw.startsWith("[")) return raw; // libre / label sans crochet en tête.
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  let lead = 0;
  while (lead < parts.length && SEGMENT_FULL_RE.test(parts[lead])) lead++;
  if (lead < 2) return raw; // un seul [Clé:] (ou label libre) → intact.
  // Gabarit confirmé. Trois cas de contenu :
  if (lead === parts.length) {
    // TOUT le texte est segmenté → le contenu est dans le segment Ex.
    const last = removeBrackets(parts[lead - 1]);
    if (!/^(?:Ex(?:emple)?)\s*[:：]/i.test(last)) return null; // PURE.
    const body = last.replace(/^(?:Ex(?:emple)?)\s*[:：]\s*/i, "");
    return displayContent(body);
  }
  if (lead === parts.length - 1) {
    // Une seule partie libre accrochée au gabarit → format es/pt
    // [ Clé… | Clé… | Clé… | [« citation » — explication] ].
    return displayContent(parts[lead]);
  }
  // Plusieurs parties libres : structure inattendue → revue humaine.
  return null;
}
