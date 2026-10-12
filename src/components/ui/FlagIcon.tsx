import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   DRAPEAUX — un seul composant, un seul cadrage.

   Les émojis drapeaux n'ont ni taille ni cadrage contrôlables (rendu
   dépendant de la police système : carrés sur Windows, jamais ronds,
   et parfois absents). Ici l'image vient de `flagcdn.com`, toujours
   rognée dans un même cercle, avec une taille en pixels POSÉE sur
   l'élément (`width`/`height` + classes) : la place est réservée avant
   le chargement, donc aucun décalage de mise en page (CLS).

   Le code pays affiché n'est pas toujours celui de la langue : `en`
   → `gb` (variante demandée), `wo` → `sn`, etc.
   ═══════════════════════════════════════════════════════════════════ */

/** Langue d'apprentissage ou d'interface → code pays ISO-2 du drapeau. */
export const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  // Langues d'apprentissage (convex/languages.ts)
  en: "gb",
  zh: "cn",
  es: "es",
  ar: "sa",
  ru: "ru",
  sw: "ke",
  ln: "cd",
  ha: "ng",
  yo: "ng",
  zu: "za",
  wo: "sn",
  // Langues d'interface (lib/i18n.tsx)
  fr: "fr",
  // Autres langues rencontrées dans l'app (Media Hub, Atlas)
  nl: "nl",
  /* ── Lot final : les 18 langues d'apprentissage ajoutées (12 + 18 = 30).
     Un code absent d'ici n'était pas une erreur visible : le drapeau
     retombait silencieusement sur le globe de l'ONU. */
  de: "de",
  hi: "in",
  bn: "bd",
  pt: "pt",
  ur: "pk",
  id: "id",
  ja: "jp",
  tr: "tr",
  ko: "kr",
  it: "it",
  th: "th",
  vi: "vn",
  am: "et",
  ig: "ng",
  fa: "ir",
  tl: "ph",
  pl: "pl",
  el: "gr",
};

/** Repli : drapeau de l'ONU (`un` existe réellement sur flagcdn) — un
    globe pour tout code inconnu, jamais une image cassée. */
export const FLAG_FALLBACK_COUNTRY = "un";

/** Normalise un code langue en code pays exploitable par le CDN. */
export function flagCountryCode(languageCode: string): string {
  const key = (languageCode ?? "").trim().toLowerCase();
  return LANGUAGE_TO_COUNTRY[key] ?? FLAG_FALLBACK_COUNTRY;
}

/**
 * Classes de cadrage — à utiliser TELLES QUELLES pour que tous les
 * drapeaux de l'app soient identiques (mêmes dimensions, même cercle).
 */
export const FLAG_SIZE_CLASSES = {
  /** Listes, menus, en-tête. */
  sm: "w-6 h-6 rounded-full object-cover border border-white/10 shadow-sm",
  /** Cartes, en-têtes de section, onboarding. */
  lg: "w-12 h-12 rounded-full object-cover border border-white/10 shadow-md",
} as const;

export type FlagSize = keyof typeof FLAG_SIZE_CLASSES;

/** Taille en pixels des attributs `width`/`height` (réserve la place). */
const FLAG_SIZE_PX: Record<FlagSize, number> = { sm: 24, lg: 48 };

export function FlagIcon({
  languageCode,
  size = "sm",
  className,
  /** Renseigné seulement si le drapeau porte l'information (sinon décoratif). */
  alt,
  title,
  /** Le drapeau de l'en-tête doit être là tout de suite (pas de lazy). */
  eager = false,
}: {
  languageCode: string;
  size?: FlagSize;
  className?: string;
  alt?: string;
  title?: string;
  eager?: boolean;
}) {
  const country = flagCountryCode(languageCode);
  const px = FLAG_SIZE_PX[size];
  return (
    <img
      src={`https://flagcdn.com/w80/${country}.png`}
      srcSet={`https://flagcdn.com/w160/${country}.png 2x`}
      width={px}
      height={px}
      alt={alt ?? ""}
      // Sans texte alternatif le drapeau est purement décoratif : le nom de
      // la langue voisine porte déjà l'information.
      aria-hidden={alt ? undefined : true}
      title={title}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn(FLAG_SIZE_CLASSES[size], className)}
    />
  );
}
