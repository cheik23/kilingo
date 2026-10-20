/* ═══════════════════════════════════════════════════════════════════════
   ONBOARDING — PERSISTANCE DU BROUILLON (couche PURE)

   Cause du défaut observé en recette (HEAD 9eed807) : dans Onboarding.tsx,
   la sélection de langues, les centres d'intérêt et l'étape courante ne
   vivaient QUE dans le state React. La seule écriture serveur (setFocus)
   survient À LA FINALISATION — un rechargement avant « Lancer mon premier
   jour » reprenait donc à l'étape 1, sans aucune sélection, et regrisait
   « Continuer ». Aucun mécanisme de brouillon n'existait.

   Le mécanisme prévu par l'architecture pour l'état d'onboarding éphémère
   est le sessionStorage (l'AppShell y mémorise déjà « Explorer d'abord »
   via SKIP_ONBOARDING_KEY) : ce module suit exactement ce modèle.

   SÉPARATION DES RÔLES — ce module ne touche JAMAIS au backend :
     • le brouillon est un état d'INTERFACE in-progress ;
     • le contrat réel (plafond Premium, garde serveur, activation
       datée du compte gratuit) reste porté par la mutation Convex
       `learning.setFocus`, appelée une seule fois à la finalisation ;
     • un brouillon rechargé ne contourne donc JAMAIS les limites :
       « Continuer » n'écrit rien, et `finish()` passe toujours par
       setFocus + guardLanguageCap côté serveur.

   ÉCHECS DE STOCKAGE : sessionStorage peut être indisponible (navigation
   privée stricte) : load retourne alors null et save/clear sont des
   no-op silencieux — le composant se comporte comme avant (state vivant
   en mémoire, brouillon simplement non restauré). Aucun code ne prétend
   que le choix a été persisté quand il ne l'a pas été.
   ═══════════════════════════════════════════════════════════════════════ */

/** Une seule clé, une seule source de vérité du brouillon. */
const DRAFT_KEY = "kilingo.onboarding.draft";

/** Étapes possibles de l'onboarding (0 = focus, 1 = lifestyle). */
const VALID_STEPS = [0, 1] as const;

export type OnboardingDraft = {
  /** Langues de focus choisies à l'étape 1 (0 à 2, dédupliquées). */
  selected: string[];
  /** Centres d'intérêt cochés à l'étape 2. */
  interests: string[];
  /** Étape courante (0 ou 1) — tout autre valeur invalide le brouillon. */
  step: number;
};

/** Garde de forme : un brouillon altéré ou partiel n'est jamais réhydraté. */
function isUsableDraft(value: unknown): value is OnboardingDraft {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  const step = d.step;
  return (
    Array.isArray(d.selected) &&
    d.selected.every((v) => typeof v === "string") &&
    new Set(d.selected).size === d.selected.length &&
    d.selected.length <= 2 &&
    Array.isArray(d.interests) &&
    d.interests.every((v) => typeof v === "string") &&
    typeof step === "number" &&
    (VALID_STEPS as readonly number[]).includes(step)
  );
}

/** Brouillon rechargé, ou null (absent, corrompu, type inattendu). */
export function loadOnboardingDraft(): OnboardingDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUsableDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Écrit best-effort ; une indisponibilité de storage n'interrompt rien. */
export function saveOnboardingDraft(draft: OnboardingDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* le composant garde son state en mémoire ; la perte est réelle et
       assumée (mêmes règles que SKIP_ONBOARDING_KEY côté AppShell) */
  }
}

/** Finalisation réussie (ou sortie d'onboarding) : le brouillon expire. */
export function clearOnboardingDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* rien à faire : un brouillon résiduel est simplement ignoré */
  }
}
