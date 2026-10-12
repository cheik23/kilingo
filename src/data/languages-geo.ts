/* ═══════════════════════════════════════════════════════════════════════
   LANGUES — MAPPING PAYS/ISO 3166-1 alpha-2

   SOURCE UNIQUE de la géographie : un seul tableau porte le code de langue
   et les pays surlignés. Le sélecteur de la carte (StatsDashboard) et la
   carte elle-même (WorldMapLanguages) lisent tous deux ce fichier, donc une
   langue sélectionnable est forcément une langue surlignable. L'ancien
   doublon — une liste de boutons codée à part du record de pays — est
   exactement ce qui faisait disparaître le Mandarin et l'Arabe du menu.

   Les NOMS ne vivent pas ici : ils viennent du dictionnaire i18n
   (`languages.<code>`, présent dans les six langues d'interface), donc ils
   suivent la langue choisie par l'utilisateur et ne peuvent pas dériver.

   Les codes pays sont des ISO 3166-1 alpha-2 en MAJUSCULES, ceux que
   Natural Earth expose dans `ISO_A2` (cf. WorldMapLanguages). Un code
   absent du fond de carte est simplement ignoré, jamais une erreur.
   ═══════════════════════════════════════════════════════════════════════ */

export type LanguageGeoEntry = {
  /** Code de langue : ceux de `convex/languages.ts`, plus `fr` (langue de
      l'interface, fortement présente sur la carte Afrique/Europe). */
  code: string;
  /** Pays surlignés sur la carte quand cette langue est sélectionnée. */
  countries: string[];
};

export const LANGUAGE_GEO: readonly LanguageGeoEntry[] = [
  {
    code: "fr",
    countries: [
      // Europe francophone
      "FR", "BE", "CH", "LU", "MC",
      // Amérique — Québec et Haïti
      "CA", "HT",
      // Afrique francophone
      "SN", "CI", "ML", "BF", "NE", "TD", "CM", "BJ", "TG", "CD", "CG",
      "GA", "RW", "BI", "DJ", "GN", "GQ", "CF", "KM", "MG", "DZ", "MA",
      "TN", "MR",
      // Océan Indien / Pacifique
      "SC", "VU",
    ],
  },
  {
    code: "en",
    countries: [
      // Cœur anglophone
      "GB", "US", "CA", "AU", "NZ", "IE", "MT", "CY",
      // Caraïbes
      "JM", "TT",
      // Afrique anglophone
      "NG", "KE", "GH", "ZA", "UG", "TZ", "ZW", "ZM", "MW", "BW", "NA",
      "SL", "LR", "GM",
      // Asie / Pacifique
      "SG", "IN", "PH", "PK", "MY", "FJ", "PG",
    ],
  },
  {
    code: "es",
    countries: [
      "ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO",
      "DO", "HN", "PY", "SV", "NI", "CR", "PA", "PR", "UY", "GQ",
    ],
  },
  {
    code: "ar",
    countries: [
      "SA", "EG", "MA", "DZ", "TN", "AE", "QA", "KW", "BH", "OM", "JO",
      "LB", "SY", "IQ", "LY", "SD", "YE", "PS", "MR", "SO", "DJ", "KM",
    ],
  },
  {
    code: "zh",
    countries: ["CN", "TW", "SG", "MY", "HK", "MO"],
  },
  {
    code: "ru",
    countries: [
      "RU", "BY", "KZ", "KG", "UA", "MD", "UZ", "TJ", "TM", "GE", "AM",
      "AZ", "EE", "LV", "LT",
    ],
  },
  {
    code: "sw",
    countries: ["KE", "TZ", "UG", "CD", "RW", "BI", "MZ", "MW", "OM", "SO", "KM"],
  },
  {
    code: "ha",
    countries: ["NG", "NE", "GH", "CM", "TD", "BJ", "BF", "CI", "SD"],
  },
  {
    code: "yo",
    countries: ["NG", "BJ", "TG", "GH", "CI"],
  },
  {
    code: "ln",
    countries: ["CD", "CG", "AO", "CF"],
  },
  {
    code: "wo",
    countries: ["SN", "GM", "GW", "MR"],
  },
  {
    code: "zu",
    countries: ["ZA", "ZW", "MZ", "MW", "LS", "SZ"],
  },
];

/** Code langue → pays surlignés. Dérivé de `LANGUAGE_GEO` (jamais dupliqué). */
export const LANGUAGE_COUNTRIES: Record<string, string[]> = Object.fromEntries(
  LANGUAGE_GEO.map((entry) => [entry.code, [...entry.countries]]),
);
