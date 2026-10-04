import { v, type Infer } from "convex/values";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — LANGUES
   Registre extensible : ajouter une entrée suffit pour la proposer dans
   les sélecteurs (langue d'interface, sous-titres, traduction).
   `whisper` = code attendu par les moteurs de reconnaissance vocale.
   `mt`      = code attendu par LibreTranslate / MyMemory.
   ═══════════════════════════════════════════════════════════════════════ */

export const LANGS = [
  { code: "fr", label: "Français", native: "Français", flag: "🇫🇷", dir: "ltr", whisper: "fr", mt: "fr" },
  { code: "en", label: "Anglais", native: "English", flag: "🇬🇧", dir: "ltr", whisper: "en", mt: "en" },
  { code: "es", label: "Espagnol", native: "Español", flag: "🇪🇸", dir: "ltr", whisper: "es", mt: "es" },
  { code: "pt", label: "Portugais", native: "Português", flag: "🇵🇹", dir: "ltr", whisper: "pt", mt: "pt" },
  { code: "it", label: "Italien", native: "Italiano", flag: "🇮🇹", dir: "ltr", whisper: "it", mt: "it" },
  { code: "de", label: "Allemand", native: "Deutsch", flag: "🇩🇪", dir: "ltr", whisper: "de", mt: "de" },
  { code: "ar", label: "Arabe", native: "العربية", flag: "🇸🇦", dir: "rtl", whisper: "ar", mt: "ar" },
  { code: "zh", label: "Chinois", native: "中文", flag: "🇨🇳", dir: "ltr", whisper: "zh", mt: "zh-CN" },
  { code: "ja", label: "Japonais", native: "日本語", flag: "🇯🇵", dir: "ltr", whisper: "ja", mt: "ja" },
  { code: "ko", label: "Coréen", native: "한국어", flag: "🇰🇷", dir: "ltr", whisper: "ko", mt: "ko" },
  { code: "ru", label: "Russe", native: "Русский", flag: "🇷🇺", dir: "ltr", whisper: "ru", mt: "ru" },
  { code: "nl", label: "Néerlandais", native: "Nederlands", flag: "🇳🇱", dir: "ltr", whisper: "nl", mt: "nl" },
  { code: "pl", label: "Polonais", native: "Polski", flag: "🇵🇱", dir: "ltr", whisper: "pl", mt: "pl" },
  { code: "tr", label: "Turc", native: "Türkçe", flag: "🇹🇷", dir: "ltr", whisper: "tr", mt: "tr" },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳", dir: "ltr", whisper: "hi", mt: "hi" },
] as const;

export type OvLang = (typeof LANGS)[number];
export type OvLangCode = OvLang["code"];

export const langCodes = LANGS.map((l) => l.code) as [string, ...string[]];

export const langValidator = v.union(
  v.literal("fr"),
  v.literal("en"),
  v.literal("es"),
  v.literal("pt"),
  v.literal("it"),
  v.literal("de"),
  v.literal("ar"),
  v.literal("zh"),
  v.literal("ja"),
  v.literal("ko"),
  v.literal("ru"),
  v.literal("nl"),
  v.literal("pl"),
  v.literal("tr"),
  v.literal("hi"),
);

export type LangCode = Infer<typeof langValidator>;

export function langMeta(code: string | undefined): OvLang {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}
