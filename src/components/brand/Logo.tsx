import { Link } from "react-router";
import { MascotSprite } from "@/components/three/MascotSprite";

/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — SYSTÈME DE BRANDING (point d'entrée unique de l'identité)

   Toute l'interface affiche la marque via ce module : remplacer le logo
   définitif un jour = éditer CE FICHIER uniquement (§14 : le futur logo
   devra fonctionner en favicon, icône d'app, navbar, splash, petit et
   grand format, sombre et clair).

   En attendant le logo définitif :
   • symbole temporaire : play ▶ inscrit dans un carré or (mouvement +
     média + culture, aucun glyphe générique de librairie d'icônes) ;
   • wordmark : « KILINGO » en majuscules, fonte display de la marque ;
   • les deux sont remplaçables indépendamment (LOGO_SLOT ci-dessous).
   ═══════════════════════════════════════════════════════════════════════ */

/** Nom de marque — TOUJOURS en majuscules dans l'UI. */
export const BRAND_NAME = "KILINGO";

/** Baseline produit (footer, métadonnées, OTP e-mail). */
export const BRAND_TAGLINE = "Don't study the culture. Live it.";

/** Description produit (manifest, OG, meta description). */
export const BRAND_DESCRIPTION =
  "Plateforme d'immersion culturelle : apprends les langues à travers films, musiques, séries, podcasts et culture réelle.";

/**
 * EMPLACEMENT LOGO — futur logo KILINGO.
 * Rien d'autre dans l'app ne dessine la marque : remplacer ce composant
 * (ou brancher <img src="/logo.svg">) suffit à relooker toute l'interface.
 */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex ${className} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-noir-2 font-display font-bold text-noir select-none ring-1 ring-gold/25`}
    >
      {/* JABARI — la tête de la mascotte est la marque (même dessin que
          /mascot.svg, favicon et PWA). Remplaçable sans impact ailleurs. */}
      <MascotSprite state="idle" className="size-full" rounded={false} />
    </span>
  );
}

/** Wordmark seul (la couleur d'accent reste portée par le thème). */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display font-semibold tracking-[0.08em] ${className}`}
    >
      {BRAND_NAME}
    </span>
  );
}

/** Bloc marque complet : symbole + wordmark (tailles navbar / auth / sheet). */
export function BrandLockup({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const mark = size === "lg" ? "size-11 text-lg" : size === "sm" ? "size-8" : "size-9 text-base";
  const word = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={mark} />
      <Wordmark className={`leading-none ${word}`} />
    </span>
  );
}

/** Bloc marque cliquable (navbar publique, header app, footer). */
export function BrandLink({
  to = "/",
  size = "md",
  className = "",
}: {
  to?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Link to={to} className={`flex items-center gap-2.5 ${className}`} aria-label={BRAND_NAME}>
      <BrandLockup size={size} />
    </Link>
  );
}
