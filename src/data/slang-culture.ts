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
  // TODO: Vérification native requise — ces fiches suivent le même modèle de structure.
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

  // TODO: Vérification native requise
  "sw|sheng": {
    origin: "Terme désignant la variété urbaine hybride (Sheng) née à Nairobi, mêlant swahili, anglais et langues locales.",
    usage: "Jeunes urbains au Kenya, notamment à Nairobi ; désigne le code parlé entre pairs.",
    level: "common",
    variation: "« kuongea Sheng » (parler Sheng).",
    example: "Hawa wanazungumza Sheng sana.",
  },
  "sw|mtaa": {
    origin: "Mot swahili signifiant quartier/voisinage ; courant dans le Sheng pour évoquer l'origine ou le coin.",
    usage: "Quotidien entre amis ; fait référence au quartier d'origine ou à l'endroit.",
    level: "common",
    variation: "« mtu wa mtaa » (habitant du quartier).",
    example: "Niko mtaa leo, tuko free.",
  },
  "sw|msee": {
    origin: "Terme Sheng courant désignant « un gars/une personne » ; largement documenté dans le lexique Sheng.",
    usage: "Très informel entre jeunes, surtout à Nairobi ; forme d'adresse entre pairs.",
    level: "familiar",
    variation: "Employé seul ou dans « msee wangu » (mon gars).",
    example: "Sasa msee, uko aje?",
  },
  "sw|rada": {
    origin: "Mot Sheng signifiant « situation / plan / ce qui se passe ».",
    usage: "Entre amis pour demander ou expliquer la situation.",
    level: "familiar",
    variation: "« bamba rada » (comprendre/suivre la situation).",
    example: "Uko na rada gani leo?",
  },
  "sw|chapaa": {
    origin: "Mot Sheng signifiant « argent ».",
    usage: "Jeunes urbains, contexte décontracté ; éviter en contexte très formel.",
    level: "familiar",
    variation: "« sina chapaa » (je n'ai pas d'argent).",
    example: "Nahitaji chapaa kidogo.",
  },

  // TODO: Vérification native requise
  "ha|sannu": {
    origin: "Salutation haoussa très répandue au nord du Nigeria et au Niger.",
    usage: "Formel et informel selon ton ; politesse de base à Kano et ailleurs.",
    level: "common",
    variation: "« Sannu da zuwa » (bienvenue).",
    example: "Sannu, yaya jiki?",
  },
  "ha|lafiya": {
    origin: "Réponse classique au « yaya jiki? » ; « lafiya » = bien/bonne santé.",
    usage: "Quotidien, tout public ; marque de politesse.",
    level: "common",
    variation: "« Lafiya lau » (très bien).",
    example: "Lafiya lau, kai fa?",
  },
  "ha|nagode": {
    origin: "Forme haoussa de « merci ».",
    usage: "Universel entre locuteurs haoussa ; courant aussi au-delà.",
    level: "common",
    variation: "« Na gode sosai » (merci beaucoup).",
    example: "Na gode, Allah ya saka da alheri.",
  },
  "ha|aboki": {
    origin: "Signifie « ami/mon frère » en haoussa ; contexte sensible hors cercle haoussa selon ton.",
    usage: "Entre pairs haoussa ; à manier avec précaution hors groupe.",
    level: "familiar",
    variation: "« abokina » (mon ami).",
    example: "Yaya, aboki?",
  },
  "ha|haba": {
    origin: "Exclamation haoussa très diffusée au Nigeria pour marquer surprise/désappointement.",
    usage: "Très courant, y compris en pidgin nigérian ; informel.",
    level: "familiar",
    variation: "Intensité selon ton.",
    example: "Haba, ai gaskiya ne?",
  },

  // TODO: Vérification native requise
  "yo|omo": {
    origin: "Terme yoruba « ọmọ » (enfant) ; très répandu en exclamation dans le Lagos informel.",
    usage: "Entre jeunes, marque surprise/stress/émotion ; diffusé hors yoruba.",
    level: "familiar",
    variation: "« Omo mi » (mon enfant) ; usage exclamatoire détaché ici.",
    example: "Omo, see traffic o!",
  },
  "yo|oya": {
    origin: "Mot yoruba signifiant « allons-y / dépêche-toi / vas-y » selon ton.",
    usage: "Quotidien ; encouragement ou impatience selon contexte.",
    level: "common",
    variation: "« Oya o ».",
    example: "Oya, let’s go now.",
  },
  "yo|egbon": {
    origin: "« Ẹ̀gbọ́n » = frère/sœur aîné(e) ; utilisé pour adresser quelqu'un plus âgé ou en signe de respect.",
    usage: "Poli et respectueux ; très courant à Lagos.",
    level: "common",
    variation: "« Egbon mi ».",
    example: "Egbon, good afternoon o.",
  },
  "yo|ose": {
    origin: "« Ọ̀ṣé » = merci / bravo.",
    usage: "Quotidien, tout public ; marque de gratitude.",
    level: "common",
    variation: "« Ose gan » (merci beaucoup).",
    example: "Ose, I appreciate.",
  },
  "yo|wahala": {
    origin: "Mot yoruba « wàhálà » = problème/tracas ; largement diffusé en pidgin nigérian.",
    usage: "Très courant pour évoquer souci ou difficulté ; « no wahala » universel.",
    level: "common",
    variation: "« wahala no dey ».",
    example: "No wahala, we go fix am.",
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

/** Nombre d'expressions enrichies FR — lu par le contrôle d'intégrité. */
export const SLANG_CULTURE_COUNT = Object.keys(CULTURE).filter((k) =>
  k.startsWith("fr|"),
).length;
