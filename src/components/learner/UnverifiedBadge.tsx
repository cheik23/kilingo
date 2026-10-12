import { AlertTriangle } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   « CONTENU À RELIRE PAR UN NATIF » — un seul badge, trois surfaces

   Découverte, Quiz et Révision affichent le même avertissement, donc le même
   composant : une formulation qui change selon l'écran ferait douter de ce
   que l'ensemble signifie.

   LA SEULE RÈGLE QUI COMPTE ICI

   `validated !== false` ⇒ rien. C'est-à-dire : ABSENT ne déclenche rien.
   Le champ est optionnel (`schema.ts`) et n'est posé à `false` que sur les
   lots non relus (amharique et igbo). Un test du genre `!validated` aurait
   affiché l'avertissement sur les 30 langues du catalogue — soit l'inverse
   exact du but. Un bug ici ne casse rien, il décrédibilise tout.

   Ce qu'il NE fait PAS : il ne masque pas l'expression, ne désactive aucun
   exercice, ne la retire pas de la révision. L'apprenant est informé, pas
   empêché — et l'infobulle dit explicitement que tout fonctionne.

   POURQUOI IL EST AMBRE, ALORS QUE « BIENTÔT » EST NEUTRE

   `SoonBadge` est neutre à dessein : il annonce une PROMESSE (du contenu
   arrive), et rien n'oblige l'utilisateur à agir. Celui-ci dit l'inverse —
   une RÉSERVE sur du contenu déjà servi. Le noyer dans le gris le rendrait
   invisible, ce qui est exactement le reproche qu'on ferait à un
   avertissement ; l'ambre est déjà la couleur d'attention de l'app
   (MemoryView, ReviewView, PronunciationCheck), donc il se comprend sans
   légende. Il reste petit et ne prend jamais la place de l'expression.
   ═══════════════════════════════════════════════════════════════════════ */

export type UnverifiedBadgeProps = {
  /** Valeur `validated` de la fiche. Seul `false` déclenche le badge. */
  validated?: boolean;
  /** Classes additionnelles (marges selon la surface). */
  className?: string;
};

export function UnverifiedBadge({ validated, className = "" }: UnverifiedBadgeProps) {
  const { t } = useI18n();

  if (validated !== false) return null;

  const label = t("validation.unverified");
  const tooltip = t("validation.tooltip");

  return (
    <span
      // `title` ET `aria-label` : l'infobulle souris n'existe pas au clavier
      // ni au lecteur d'écran, et c'est justement ce public-là qui a besoin
      // de savoir pourquoi une fiche est signalée.
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 font-mono text-[0.625rem] font-medium tracking-wide text-amber-300",
        "px-2 py-0.5",
        className,
      )}
    >
      <AlertTriangle className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
