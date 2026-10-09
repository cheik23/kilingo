/* Ce fichier ne contient QUE de la logique : le composant qui consomme
   `resolveGate` vit dans `components/learner/PremiumGate.tsx`, comme les
   autres séparation du dépôt entre la règle et son rendu. */

/* ═══════════════════════════════════════════════════════════════════════
   GARDES PREMIUM — MODULE E

   Le but de ce fichier est de permettre de verrouiller une fonctionnalité
   derriere `getMyPremiumStatus` **sans jamais verrouiller par surprise**.

   ⚠ LE CONSTAT QUI IMPOSE CE DESIGN (audit avant/après)

   Le brief demande de « verrouiller les fonctionnalités Premium
   existantes ». Un audit du code montre que les SIX-avantages annoncés sur
   la page des tarifs sont TOUS déjà accessibles à tout le monde, et
   qu'aucun n'a jamais été réservé :

     · 11 langues ............ aucun plafond dans le code
     · 2 363 expressions .... taille du catalogue, pas une porte
     · shadowing illimité .... aucun compteur implémenté
     · 8 personnages IA ...... les 8 sont sélectionnables
     · export Anki / CSV ..... `MemoryView` l'exporte pour tout le monde
     · avatar 3D ............ fermé par `FEATURES.avatar3d`, donc fermé
                               POUR TOUT LE MONDE (raisons de poids et de
                               performance), pas « réservé à Premium »

   Autrement dit : verrouiller l'un d'eux AUJOURD'HUI reviendrait à
   retirer une fonctionnalité qui fonctionne à un utilisateur gratuit
   installé. C'est exactement le piège que le brief nomme — « qu'aucune
   fonctionnalité gratuite ne devienne payante par erreur ».   Le livrer
   serait une régression commerciale déguisée en étude de cadrage.

   Donc : le MÉCANISME est livré, POLITIQUE, appliquée à rien.

     · `resolveGate` est la seule fonction du dépôt qui décide d'un accès
       Premium, et elle ne lit QUE `getMyPremiumStatus` — jamais un booléen
       local, jamais un `localStorage`, jamais une comparaison de prix ;
     · `GATES` déclare la politique d'un coup, avec la raison à côté, pour
       qu'unlocking ou locking soit une décision lisible en diff ;
     · `PremiumGate` est monté dans un vrai écran (l'export Anki/CSV) et
       y rend ses enfants, parce que sa politique est `free`. Il n'est pas
       du code mort : il est branché, testé par l'usage, et il n'a aucun
       effet. Le jour où l'on bascule `exportAnki` en `premium`, le
       verrou est déjà en place et testé.

   Passer une porte de `free` à `premium` est alors un changement d'UN
   mot. `scripts/verify-payments.mjs` échoue si une porte passe à
   `premium` sans que le README (§ Audit Premium) ne la liste comme
   régression assumée.

   ── MISE À JOUR (lot « Verrous Premium ») ────────────────────────────

   Le constat ci-dessus était juste au moment où il a été écrit, et
   l'audit ne peut pas servir d'excuse éternelle : la page des tarifs
   ANNONCE « 2 langues en parallèle », « shadowing illimité » et « 8
   personnages » comme des avantages Premium, et le code n'en appliquait
   aucun. Trois portes passent donc à `premium` — avec, à chaque fois,
   la migration sans perte vérifiée par `scripts/verify-premium-locks.mjs`
   et documentée dans le README.

   `exportAnki`, `avatar3d` et `support` restent `free` : ce sont les
   trois avantages que le brief de ce lot ne demandait pas de verrouiller,
   et dont la gratuité protège le cœur de la boucle d'apprentissage
   (argot, XP, export = 100 % gratuits).
   ═══════════════════════════════════════════════════════════════════════ */

/** Les avantages Premium annoncés sur la page des tarifs. */
export type PremiumFeature =
  | "languages"
  | "shadowing"
  | "aiCharacters"
  | "exportAnki"
  | "avatar3d"
  | "support";

/** Politique appliquée à un avantage. */
export type GatePolicy = "free" | "premium";

export type GateEntry = {
  /** Politique en vigueur. */
  policy: GatePolicy;
  /** Pourquoi cette politique — lisible dans un diff, pas dans un ticket. */
  because: string;
};

export const GATES: Record<PremiumFeature, GateEntry> = {
  languages: {
    policy: "premium",
    because:
      "Le lot « Verrous Premium » fixe le plafond à 2 langues actives en Premium et à 1 en formule gratuite, SANS retrait rétroactif : une langue déjà active avant le déploiement reste acquise (voir `activeLanguageCap`, qui compte les lignes sans `activatedAt`). Voir README § Verrous Premium.",
  },
  shadowing: {
    policy: "premium",
    because:
      "Le lot « Verrous Premium » instaure le compteur annoncé depuis le début mais jamais implémenté : 5 analyses Shadow par jour en formule gratuite, illimité en Premium, remise à zéro à minuit dans le fuseau de l'utilisateur. Aucun contenu déjà généré n'est retiré (le quota ne porte que sur les NOUVELLES analyses). Voir README § Verrous Premium.",
  },
  aiCharacters: {
    policy: "premium",
    because:
      "Le lot « Verrous Premium » ouvre 2 personnages sur 8 en formule gratuite (Baba Street et Mama Wisdom) et garde les 6 autres VISIBLES mais verrouillés. Seule l'ouverture d'une conversation est bloquée : envoyer un message ou terminer une conversation déjà commencée ne l'est pas. Voir README § Verrous Premium.",
  },
  exportAnki: {
    policy: "free",
    because:
      "`MemoryView` exporte en CSV et Anki pour tout le monde aujourd'hui. La porte est MONTÉE ici (`PremiumGate`) mais ouverte : la basculer casserait l'export de tous les comptes gratuits existants.",
  },
  avatar3d: {
    policy: "free",
    because:
      "Fermé par `FEATURES.avatar3d = false` (poids du lot three.js, décision de simplification), donc fermé pour tout le monde. Le rattacher à Premium promettrait un avantage que personne n'a, même en payant.",
  },
  support: {
    policy: "free",
    because:
      "Ce n'est pas une fonctionnalité du code mais une promesse de service : rien à verrouiller côté application.",
  },
};

/** Le compte connecté a-t-il accès à CET avantage ? */
export function resolveGate(
  feature: PremiumFeature,
  isPremium: boolean | undefined,
): boolean {
  // `undefined` = la query est en vol. On accorde l'accès : on ne retire
  // jamais une fonctionnalité sur une absence d'information. C'est aussi
  // ce qui évite qu'un Account-free voie clignoter l'interface pendant le
  // chargement.
  //
  // Depuis le lot « Verrous Premium », trois portes sont réellement
  // `premium`. Cela ne change rien ici : l'application n'accorde l'accès
  // qu'après l'appel serveur (`guardShadowQuota`, `applyFocus`,
  // `startConversation`), qui refuse avant toute écriture. Cette fonction
  // ne sert qu'à l'affichage d'un verrou déjà décidé ailleurs — elle
  // doit donc rester patiente, et ne jamais faire clignoter un verrou
  // pendant le chargement.
  if (GATES[feature].policy === "free") return true;
  if (isPremium === undefined) return true;
  return isPremium === true;
}

/** Avantages réellement réservés à Premium aujourd'hui. */
export function lockedFeatures(): PremiumFeature[] {
  return (Object.keys(GATES) as PremiumFeature[]).filter(
    (f) => GATES[f].policy === "premium",
  );
}
