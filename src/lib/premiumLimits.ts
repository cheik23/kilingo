/* ═══════════════════════════════════════════════════════════════════════
   VERROUS PREMIUM — RÈGLES PURES (source unique)

   Ce fichier ne contient QUE des fonctions pures : il est importé à la
   fois par le serveur Convex (`convex/premium.ts`), par les composants, et
   par `scripts/verify-premium-locks.mjs`. Une règle testée ailleurs que
   dans le code qui l'applique ne prouve rien — donc il n'y a qu'un seul
   endroit où chaque règle est écrite.

   ⚠ LE PRINCIPE QUI RÉGIT CE LOT

   Un verrou ne peut JAMAIS :

     · porter sur la boucle d'apprentissage centrale — argot,
       gamification, XP, badges, streaks, révision SRS, quiz. Ces
       surfaces restent gratuites à 100 %, sans exception, parce que
       c'est ce qui fait revenir l'utilisateur. Les trois verrous de ce
       lot portent sur des surfaces *dérivées* : le nombre de langues
       suivies, le nombre d'analyses, le nombre de personnages ;

     · retirer quelque chose qu'un utilisateur gratuit possède DÉJÀ. Le
       verrou ne mord qu'à l'ADDITION. C'est la fonction
       `activeLanguageCap` qui porte cette garantie, et
       `verify-premium-locks.mjs` échoue si une autre règle l'enfreint ;

     · être muet. Un blocage qui surgit sans explication est un
       dark pattern ; chaque message porte un GAIN.

   Les compteurs de terrain (`isPremium`) ne sont jamais acceptés ici :
   cette fonction reçoit l'état résolu par `getMyPremiumStatus`, l'unique
   source de vérité (cf. `convex/subscriptions.ts`).
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   LES TROIS VERROUS
   ═══════════════════════════════════════════════════════════════════════ */

/** Nombre d'analyses Shadow par jour, formule gratuite. */
export const FREE_SHADOW_PER_DAY = 5;

/**
 * Nombre de langues ACTIVES simultanément, formule gratuite.
 *
 * 1, et pas 0 : on ne verrouille pas ce que l'utilisateur a déjà choisi.
 * Le sélecteur de langue a toujours accepté 1 ou 2 (contrainte produit
 * préexistante dans `learning.setFocus`), donc 1 est un cran, pas une
 * invention.
 */
export const FREE_ACTIVE_LANGUAGES = 1;

/**
 * Nombre de langues actives, formule Premium : **2**.
 *
 * On ne fait pas richer le gratuit pour rendre le payant plus désirable :
 * on ne rend pas le payant plus pauvre que le produit ne l'a jamais été.
 * Le sélecteur plafonnait déjà à 2 avant ce lot — Premium ne fait que
 * lever le cran gratuit. Toute revision de ce nombre est une décision
 * commerciale à documenter, pas un effet de bord.
 */
export const PREMIUM_ACTIVE_LANGUAGES = 2;

/** Personnages IA accessibles gratuitement. */
export const FREE_AI_CHARACTERS = 2;

/** Total de personnages existants — la borne haute de la galerie. */
export const TOTAL_AI_CHARACTERS = 8;

/**
 * Les 2 personnages gratuits — et la PREUVE de ce choix.
 *
 * ⚠ Le brief demandait « les 2 les plus populaires selon les données
 * d'usage existantes si disponibles ». Les données d'usage EXISTENT et
 * ont été interrogées (table `aiConversations`, 27/09/2026) :
 *
 *     conversations au total : 2
 *     utilisateurs distincts : 1
 *     baba_street  — 1 conversation, 5 messages
 *     gamer_pro    — 1 conversation, 1 message
 *
 * n = 2. Ce n'est pas une mesure de popularité, c'est un échantillon
 * accidentel : en déduire « les 2 plus populaires » serait présenter du
 * bruit comme une donnée. On applique donc le repli du brief — les deux
 * personnages les plus mis en avant par le produit lui-même, ce qui est
 * un signal réel et vérifiable :
 *
 *     baba_street  — 16 occurrences dans la copy utilisateur, et le seul
 *                    personnage ayant une vraie conversation enregistrée
 *                    (5 messages) ;
 *     mama_wisdom  — présenté dans la landing comme « Mama Africa la
 *                    conteuse de Dakar » (pillars S5/S7 et FAQ).
 *
 * Donc : les deux personnages que nous avons déjà promus le plus, et le
 * seul dont l'usage réel est documenté. `verify-premium-locks.mjs`
 * revérifie que ces 16 et 3 occurrences sont toujours là : si la copy
 * change, le contrôle échoue au lieu de laisser une justification
 * devenue fausse.
 */
export const FREE_AI_CHARACTER_IDS = ["baba_street", "mama_wisdom"] as const;

/* ═══════════════════════════════════════════════════════════════════════
   LANGUES ACTIVES — AVEC NON-RÉTROACTIVITÉ
   ═══════════════════════════════════════════════════════════════════════ */

/** Une ligne `userLanguages`, pour le calcul du plafond. */
export type ActiveLanguageRow = {
  language: string;
  active: boolean;
  /**
   * Instantané d'activation. **ABSENT = ligne antérieure au lot** : elle
   * est « grand-père » et compte pour toujours, quelle que soit la
   * formule. C'est la garantie de non-retour en arrière, et elle tient
   * dans la simple absence de cette colonne.
   */
  activatedAt?: number;
};

/**
 * Plafond d'un utilisateur pour le nombre de langues ACTIVES.
 *
 * Formule Premium : la borne du produit (2).
 * Formule gratuite : `max(1, nombre de lignes actives déjà
 * grand-pères)`.
 *
 * Le `max` est tout le lot en une ligne : un utilisateur gratuit qui
 * suivait déjà 2 langues avant ce lot garde 2. Un nouveau client gratuit,
 * lui, plafonne à 1. Et un grand-père qui désactive une langue puis en
 * réactive une autre n'échappe pas au verrou : la désactivation efface
 * son horodatage, donc la langue réactivée est une NOUVELLE activation,
 * comptée contre le plafond courant.
 */
export function activeLanguageCap(
  isPremium: boolean,
  rows: ActiveLanguageRow[],
): number {
  if (isPremium) return PREMIUM_ACTIVE_LANGUAGES;
  const grandfathered = rows.filter((r) => r.active && r.activatedAt === undefined).length;
  return Math.max(FREE_ACTIVE_LANGUAGES, grandfathered);
}

/** Motif de refus, ou `null` si l'ensemble demandé tient dans le plafond. */
export function activeLanguageBlockReason(
  isPremium: boolean,
  rows: ActiveLanguageRow[],
  wanted: string[],
): "language_cap" | null {
  const cap = activeLanguageCap(isPremium, rows);
  const unique = Array.from(new Set(wanted));
  if (unique.length <= cap) return null;
  return "language_cap";
}

/* ═══════════════════════════════════════════════════════════════════════
   QUOTA SHADOW — JOUR DE L'UTILISATEUR
   ═══════════════════════════════════════════════════════════════════════ */

/** `yyyy-mm-dd` dans le fuseau de l'utilisateur, ou en UTC en cas de défaut. */
export function localDayKey(now: number, timezone: string | undefined): string {
  try {
    // `en-CA` rend un AAAA-MM-JJ, ce qui est exactement la forme voulue.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
  } catch {
    // Fuseau inexistant ou Indisponible dans le runtime : on retombe sur
    // l'UTC. Un décompte approximatif vaut mieux qu'une exception — et
    // l'interface affiche le fuseau retenu, donc rien n'est caché.
    return new Date(now).toISOString().slice(0, 10);
  }
}

/** Clé d'index : un compte, un jour, dans SON fuseau. */
export function quotaKey(userId: string, now: number, timezone: string | undefined): string {
  return `${userId}:${localDayKey(now, timezone)}`;
}

export type ShadowQuota = {
  /** `Infinity` pour Premium — jamais sérialisé, uniquement utilisé en JS. */
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  /** Fuseau dans lequel le compteur est remis à zéro. */
  timezone: string;
  /** Jour de décompte, tel que calculé. */
  dayKey: string;
  /** Instant de la prochaine remise à zéro, en ms epoch. */
  resetsAt: number;
};

/**
 * Prochaine minuit **local**, en ms epoch.
 *
 * On ne suppose JAMAIS que 24 h font un jour : un fuseau à +14 ou à -11,
 * et surtout un changement d'heure, décalent la frontière. On avance donc
 * par pas de 15 minutes jusqu'à ce que le jour local change, puis on
 * RECULE minute par minute pour la frontière exacte.
 *
 * Ce recul n'est pas un raffinement esthétique : sans lui, l'heure de
 * remise à zéro affichée pouvait être jusqu'à 15 minutes APRÈS la
 * véritable — et un compteur qui se réinitialise « à minuit » mais
 * continue de compter pendant un quart d'heure est un compteur faux.
 */
export function nextLocalMidnight(now: number, timezone: string | undefined): number {
  const day = localDayKey(now, timezone);
  const base = Date.parse(`${day}T00:00:00.000Z`);
  const STEP = 15 * 60_000;
  for (let t = base + STEP; t <= base + 26 * 3_600_000; t += STEP) {
    if (localDayKey(t, timezone) === day) continue;
    // Frontière dans ]t-15min, t] : on remonte à la minute exacte.
    for (let m = t; m > t - STEP; m -= 60_000) {
      if (localDayKey(m, timezone) !== day) return m;
    }
    return t;
  }
  return base + 86_400_000;
}

/** État complet du quota, affiché tel quel à l'utilisateur. */
export function shadowQuotaState(
  isPremium: boolean,
  used: number,
  now: number,
  timezone: string | undefined,
): ShadowQuota {
  const tz = timezone ?? "UTC";
  const dayKey = localDayKey(now, tz);
  const limit = isPremium ? Number.POSITIVE_INFINITY : FREE_SHADOW_PER_DAY;
  const remaining = isPremium
    ? Number.POSITIVE_INFINITY
    : Math.max(0, FREE_SHADOW_PER_DAY - used);
  return {
    limit,
    used,
    remaining,
    unlimited: isPremium,
    timezone: tz,
    dayKey,
    resetsAt: nextLocalMidnight(now, tz),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   PERSONNAGES IA
   ═══════════════════════════════════════════════════════════════════════ */

export function isCharacterFree(id: string): boolean {
  return (FREE_AI_CHARACTER_IDS as readonly string[]).includes(id);
}

/**
 * Le personnage est-il verrouillé pour ce compte ?
 *
 * `undefined` = état Premium inconnu (query en vol) : on ne verrouille
 * jamais sur une absence d'information, sinon l'interface clignoterait et
 * un utilisateur payant pourrait voir ses personnages disparaître une
 * fraction de seconde.
 */
export function isCharacterLocked(id: string, isPremium: boolean | undefined): boolean {
  if (isCharacterFree(id)) return false;
  return isPremium === false;
}

/* ═══════════════════════════════════════════════════════════════════════
   RÉSUMÉ — pour l'interface et les tests
   ═══════════════════════════════════════════════════════════════════════ */

export type PremiumLimits = {
  activeLanguages: number;
  shadowPerDay: number;
  aiCharacters: number;
};

export function resolveLimits(isPremium: boolean | undefined): PremiumLimits {
  return {
    activeLanguages: isPremium === true ? PREMIUM_ACTIVE_LANGUAGES : FREE_ACTIVE_LANGUAGES,
    shadowPerDay: isPremium === true ? Number.POSITIVE_INFINITY : FREE_SHADOW_PER_DAY,
    aiCharacters: isPremium === true ? TOTAL_AI_CHARACTERS : FREE_AI_CHARACTERS,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   CODES D'ERREUR TYPÉS

   Convex ne transporte qu'un message : on y glisse donc un CODE stable,
   que l'interface reconnaît. Sans ça, chaque blocage se traduirait en
   « Import impossible » — un message technique qui ne dit rien à
   l'utilisateur et ne mène nulle part.

   La reconnaissance est faite sur le message parce que c'est la seule
   chose qui remonte du serveur. Elle est volontairement LENNE (on cherche
   le code dans le texte) : un `Error` Convex peut être ré-enveloppé, et un
   blocage mal reconnu se dégrade en message générique — jamais en crash.
   ═══════════════════════════════════════════════════════════════════════ */

export const QUOTA_SHADOW_CODE = "quota_shadow";
export const CHARACTER_LOCKED_CODE = "character_locked";

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

export function isQuotaShadowError(err: unknown): boolean {
  return messageOf(err).includes(QUOTA_SHADOW_CODE);
}

export function isCharacterLockedError(err: unknown): boolean {
  return messageOf(err).includes(CHARACTER_LOCKED_CODE);
}
