/* ═══════════════════════════════════════════════════════════════════════
   LANGUES — MAPPING PAYS/ISO 3166-1 alpha-2
   ═══════════════════════════════════════════════════════════════════════ */

export const LANGUAGE_COUNTRIES: Record<string, string[]> = {
  wo: ["SN", "GM", "GW"], // Wolof
  ln: ["CD", "CG", "AO"], // Lingala
  sw: ["KE", "TZ", "UG", "CD", "RW"], // Swahili
  ha: ["NG", "NE", "GH", "CM"], // Haoussa
  yo: ["NG", "BJ", "TG"], // Yoruba
  fr: [
    "FR",
    "SN",
    "CI",
    "ML",
    "BF",
    "NE",
    "TD",
    "MG",
    "CM",
    "BJ",
    "TG",
    "CD",
  ], // Français
  en: ["GB", "US", "NG", "KE", "GH", "ZA", "UG", "TZ"], // Anglais
} as const;
