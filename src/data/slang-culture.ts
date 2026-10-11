/* ═══════════════════════════════════════════════════════════════════════
   ARGOT — CONTEXTE CULTUREL DES EXPRESSIONS

   La table `slangExpressions` porte le sens, le registre, la région et
   l'exemple. Ce fichier ajoute ce que la base ne peut pas savoir :
   l'ORIGINE (d'où vient le mot), l'UTILISATION (qui le dit, dans quelle
   situation) et la VARIATION (les formes voisines).

   Contrat :
     · `getSlangCulture(langue, expression)` renvoie l'enrichissement ou
       `null` — JAMAIS un objet partiel inventé : sans donnée éditoriale,
       la carte n'affiche simplement pas ces lignes ;
     · `levelFromRegister(...)` n'est qu'un REPLI : le badge de niveau est
       normalement posé ici, exprédit par un humain, et déduit du registre
       quand l'expression n'est pas encore enrichie.

   Une expression enrichie = clé `"<langue>|<expression normalisée>"`.
   La normalisation reprend celle du serveur (minuscules, sans accent) :
   « CARRÉ » et « carré » tombent sur la même fiche.

   ⚠ Les cinq fiches ci-dessous sont un MODÈLE de rédaction (onboarding des
   premières expressions enrichies) : à relire par un locuteur natif avant
   d'être présentées comme définitives.
   ═══════════════════════════════════════════════════════════════════════ */

/** Niveau de langue, du plus oral au plus soutenu. */
export type SlangLevel = "common" | "familiar" | "very_familiar";

export type SlangCulture = {
  /** 📍 D'où vient l'expression (emprunt, verlan, initiales, image…). */
  origin: string;
  /** 👥 Qui l'utilise, et dans quel registre de situation. */
  usage: string;
  /** ⚠️ Niveau de langue — badge visuel. */
  level: SlangLevel;
  /** Formes voisines : déclinaisons, verlan, intensifications. */
  variation?: string;
  /** Une phrase réelle, prête à être dite. */
  example: string;
};

/** Libellés du badge de niveau (FR). */
export const LEVEL_LABEL: Record<SlangLevel, string> = {
  common: "Courant",
  familiar: "Familier",
  very_familiar: "Très familier",
};

/** Icône du badge de niveau — purement visuel, jamais le seul porteur du sens. */
export const LEVEL_DOT: Record<SlangLevel, string> = {
  common: "bg-green-400",
  familiar: "bg-amber-400",
  very_familiar: "bg-red-400",
};

/** Normalisation identique à celle du serveur (normKey) : accents et casse
 *  ne doivent pas créer une seconde fiche pour la même expression. */
function normKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function slangCultureKey(language: string, expression: string): string {
  return `${language.toLowerCase().trim()}|${normKey(expression)}`;
}

/**
 * Registres déjà présents en base :
 *   casual    → langage de tous les jours
 *   internet  → chat, réseaux
 *   street    → rue, banlieue, très informel
 *   vulgar    → grossier
 */
const LEVEL_BY_REGISTER: Record<string, SlangLevel> = {
  casual: "common",
  internet: "common",
  street: "familiar",
  vulgar: "very_familiar",
};

/** Repli : niveau déduit du registre, quand l'expression n'est pas enrichie. */
export function levelFromRegister(register: string | undefined): SlangLevel {
  return (register && LEVEL_BY_REGISTER[register]) || "familiar";
}

const CULTURE_RAW: Record<string, SlangCulture> = {
  "fr|wesh": {
    origin:
      "Emprunté à l'arabe dialectal « wach » (واش) — « quoi ? ». Passé dans le français urbain par le rap des années 1990, laissa de côté le sens interrogatif pour devenir un salut.",
    usage: "Jeunes en milieu urbain, informel entre amis ; aussi à l'oral comme interjection de surprise.",
    level: "familiar",
    variation: "« Wesh wesh » (appuyé), « wesh la famille » (appel au crew), « wesh ou quoi ? ».",
    example: "Wesh reuf, t'as capté ?",
  },
  "fr|carré": {
    origin:
      "Image géométrique : un carré est fermé de quatre côtés parfaits. Ce qui est « carré » ne laisse rien passer — donc propre, réglé, maîtrisé.",
    usage: "Entre amis comme en contexte pro décontracté : valide un plan, un devis, une organisation.",
    level: "common",
    variation: "« C'est carré » (formule complète), « carré » seul, « être carré » (la personne est fiable).",
    example: "Le devis est parti, c'est carré.",
  },
  "fr|gentar": {
    origin:
      "Verlan de « argent » : les syllabes se retournent (ar·gent → gent·ar). Le mot se dit à voix haute sans nommer l'argent.",
    usage: "Rue, colocation, groupes d'amis — parler d'argent sans en parler, souvent pour dire qu'il n'y en a pas.",
    level: "familiar",
    variation: "« Y'a pas de gentar » (= pas de souci, on n'en parle pas), « péter le gentar » (= être riche).",
    example: "Pas de gentar ce mois-ci, on remet ça à la paie.",
  },
  "fr|mdr": {
    origin:
      "Initiales de « mort de rire », nées sur les forums et messageries français des années 2000 avant d'être portées par les SMS.",
    usage: "Réseaux sociaux, chats, SMS — l'écriture d'un rire, devenue si courante qu'elle s'est banalisée.",
    level: "common",
    variation: "« ptDr » (pété de rire), « xpDr » (intensifié), « mort 😂 » en décalé.",
    example: "Tu as vu sa tête quand il a glissé ? MDR.",
  },
  "fr|chelou": {
    origin:
      "Verlan de « louche » : le mot est retourné (lou·che → che·lou), figure classique du verlan français.",
    usage: "Entre amis, pour décrire une personne, un lieu ou une situation douteuse — sans accuser frontalement.",
    level: "familiar",
    variation: "Sens élargi de « douteux » à « bizarre », y compris pour une chose ; s'emploie invariable.",
    example: "Ce type qui traîne là depuis une heure, il est un peu chelou.",
  },
};

/**
 * Clés normalisées au chargement.
 *
 * Les clés ci-dessus sont écrites comme l'utilisateur les tape (« carré »,
 * avec son accent) pour rester lisibles à l'édition ; la LOOKUP, elle, se
 * fait sur la forme normalisée — sans quoi « carré » et « carre » seraient
 * deux fiches, et une moitié du monde n'afficherait jamais la sienne.
 */
const CULTURE: Record<string, SlangCulture> = Object.fromEntries(
  Object.entries(CULTURE_RAW).map(([key, value]) => {
    const [language, expression] = key.split("|");
    return [slangCultureKey(language ?? "", expression ?? ""), value];
  }),
);

/** Enrichissement d'une expression, ou `null` (la carte n'affiche alors rien). */
export function getSlangCulture(
  language: string,
  expression: string,
): SlangCulture | null {
  if (!language || !expression) return null;
  return CULTURE[slangCultureKey(language, expression)] ?? null;
}

/**
 * Le bloc culturel aurait-il du contenu à afficher ?
 *
 * Sert à n'afficher le TITRE d'une section que s'il y a quelque chose
 * dessous : une section vide est un mensonge de mise en page (« Contexte
 * culturel » au-dessus d'un vide).
 */
export function hasCultureContent(
  language: string,
  expression: string,
  register?: string,
  context?: string,
): boolean {
  return (
    getSlangCulture(language, expression) !== null ||
    Boolean(register && register.trim()) ||
    Boolean(context && context.trim())
  );
}

/** Nombre d'expressions enrichies — lu par le contrôle d'intégrité. */
export const SLANG_CULTURE_COUNT = Object.keys(CULTURE).length;
