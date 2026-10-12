import { Flame } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   « CONTENU ADULTE » — un seul badge, les mêmes surfaces que « non vérifié »

   POURQUOI UN COMPOSANT À PART, ET PAS UNE OPTION DE `UnverifiedBadge`

   Les deux avertissements ne disent pas la même chose : l'un porte sur la
   FIABILITÉ d'une fiche (pas encore relue par un natif), l'autre sur son
   REGISTRE (argot sexuel ou très cru). Les fusionner obligerait à écrire
   « non vérifié ET/OU adulte » dans un seul libellé, et l'ambre de la
   relecture se mettrait à signaler du contenu adulte — deux lectures
   incompatibles sur la même couleur. Deux badges, deux couleurs, deux
   infobulles : chacun reste lisible seul.

   LA SEULE RÈGLE QUI COMPTE ICI

   Seul `true` déclenche le badge. ABSENT ne déclenche rien — c'est le
   contrat de `schema.ts` (comme pour `validated`), et c'est ce qui évite de
   marquer les ~4 200 fiches existantes.

   CE QU'IL NE FAIT PAS

   Il ne masque pas l'expression, ne la retire pas du quiz ni de la
   révision, ne la floute pas. L'apprenant est prévenu, pas empêché —
   l'infobulle le dit noir sur blanc, parce qu'un avertissement sans cette
   précision se lit comme une interdiction.
   ═══════════════════════════════════════════════════════════════════════ */

export type AdultContentBadgeProps = {
  /** Valeur `isAdult` de la fiche. Seul `true` déclenche le badge. */
  isAdult?: boolean;
  /** Classes additionnelles (marges selon la surface). */
  className?: string;
};

export function AdultContentBadge({ isAdult, className = "" }: AdultContentBadgeProps) {
  const { t } = useI18n();

  if (isAdult !== true) return null;

  const label = t("adult.label");
  const tooltip = t("adult.tooltip");

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/10 font-mono text-[0.625rem] font-medium tracking-wide text-rose-300",
        "px-2 py-0.5",
        className,
      )}
    >
      <Flame className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
