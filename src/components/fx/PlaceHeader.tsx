import type { ComponentType, ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { GrainOverlay, MotifBackdrop, type MotifVariant } from "./motifs";
import { MascotStage } from "@/components/three/MascotProvider";
import type { PlaceKey } from "@/lib/i18n.places";

/* ═══════════════════════════════════════════════════════════════════════
   LES LIEUX — EN-TÊTE ET VIDE THÉMATISÉS (MODULES 1 & 3)

   Chaque page est un LIEU : un nom (kicker), une phrase d'ambiance, et
   un titre qui se révèle « à l'encre dorée » (clip-path + flou → net,
   400 ms, cf. .ln-ink-title).

   Les textes viennent tous de t("places.<lieu>.*") — traduits dans les
   12 langues d'interface (voir i18n.places.ts). Aucun texte en dur ici.

   Le motif culturel est TOUJOURS en fond (4 %) et le contenu en z-10 :
   aucune texture ne passe jamais sous le texte.
   ═══════════════════════════════════════════════════════════════════════ */

export function PlaceHeader({
  place,
  title,
  icon: Icon,
  motif = "kente",
  actions,
  description,
  className = "",
}: {
  /** Lieu de l'univers : donne le kicker + la phrase d'ambiance. */
  place: PlaceKey;
  /** Titre de la page (déjà traduit par l'appelant). */
  title: string;
  /** Icône Lucide — jamais un emoji d'interface. */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  motif?: MotifVariant;
  /** Boutons / filtres alignés à droite (optionnel). */
  actions?: ReactNode;
  /** Remplace la phrase d'ambiance du lieu si l'appelant en a une. */
  description?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <header
      className={`ln-tech-border ln-rivets relative isolate overflow-hidden rounded-[var(--ln-radius-lg)] bg-noir-2 p-6 sm:p-8 ${className}`}
    >
      <MotifBackdrop variant={motif} opacity={0.04} />
      <GrainOverlay opacity={0.03} />
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="ln-kicker flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {t(`places.${place}.kicker`)}
          </p>
          <h1 className="ln-ink-title mt-2 font-display text-3xl font-semibold sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
            {description ?? t(`places.${place}.ambiance`)}
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * Vide thématisé : le motif du lieu + une grande icône Lucide + la phrase
 * de vide du lieu + une action optionnelle. Remplace les blocs de texte
 * gris « rien ici » par quelque chose qui raconte le lieu.
 */
export function PlaceEmpty({
  place,
  icon: Icon,
  motif = "adinkra",
  action,
  className = "",
}: {
  place: PlaceKey;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  motif?: MotifVariant;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`ln-tech-border ln-rivets relative isolate overflow-hidden rounded-[var(--ln-radius-lg)] bg-noir-2/60 px-6 py-10 text-center ${className}`}
    >
      <MotifBackdrop variant={motif} opacity={0.05} />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-gold/25 bg-gold/10 text-gold">
          <Icon className="size-6" aria-hidden />
        </span>
        {/* Jabari cherche pourquoi c'est vide (sprite : jamais de WebGL ici). */}
        <MascotStage variant="sprite" className="mt-3 size-14" bubble={false} />
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          {t(`places.${place}.empty`)}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
