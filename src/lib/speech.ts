/**
 * Native browser text-to-speech (Web Speech API) — 100% free, no API key,
 * no network call, no audio files stored anywhere.
 */

/** Map an app language code ("zh") to a BCP-47 locale ("zh-CN").
 *  Étendu Phase 10-C : tous les codes du catalogue de langues (africains
 *  inclus) au lieu des seules 5 langues historiques.
 */
const LANG_MAP: Record<string, string> = {
  // Codes historiques
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ar: "ar-SA",
  ru: "ru-RU",
  // Catalogue complet (LANGUAGES de convex/languages.ts)
  sw: "sw-KE",   // Swahili — Kenya (le Kiswahili standard)
  ln: "ln-AO",   // Lingala — Angola (le tag ln-CD est refusé par certains moteurs TTS, ln-AO est le seul régionalisé BCP-47 valide)
  ha: "ha-NG",   // Haoussa — Nigeria
  yo: "yo-NG",   // Yoruba — Nigeria
  zu: "zu-ZA",   // Zoulou — Afrique du Sud
  wo: "wo-SN",   // Wolof — Sénégal
  de: "de-DE",
  hi: "hi-IN",
  bn: "bn-BD",
  pt: "pt-BR",
  ur: "ur-PK",
  id: "id-ID",
  ja: "ja-JP",
  tr: "tr-TR",
  ko: "ko-KR",
  it: "it-IT",
  th: "th-TH",
  vi: "vi-VN",
  am: "am-ET",   // Amharique — Éthiopie
  ig: "ig-NG",   // Igbo — Nigeria
  fa: "fa-IR",
  tl: "tl-PH",   // Tagalog — Philippines
  pl: "pl-PL",
  el: "el-GR",
  fr: "fr-FR",
};

/** Map an app language code ("zh") to a BCP-47 locale ("zh-CN").
 *  Fallback : le code tel quel (l'API sait souvent résoudre les préfixes
 *  BCP-47 simples elle-même), jamais un tag d'une autre langue.
 */
export function speechLanguage(code: string): string {
  return LANG_MAP[code] ?? code;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Some browsers load voices asynchronously — warm them up and refresh on change.
if (isSpeechSupported()) {
  const warm = () => {
    window.speechSynthesis.getVoices();
  };
  warm();
  window.speechSynthesis.onvoiceschanged = warm;
}

/** Strip parenthetical transliterations ("牛逼 (niúbī)" → "牛逼") so the voice reads the expression cleanly. */
export function speakableText(expression: string): string {
  const stripped = expression
    .replace(/[(\[{][^\)\]}]*[\)\]}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : expression.trim();
}

export function speakText(
  text: string,
  langCode: string,
  options?: {
    rate?: number;
    pitch?: number;
    /** 0–1 — la révision nocturne parle plus bas que le volume système. */
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: unknown) => void;
  },
): void {
  if (!isSpeechSupported()) {
    options?.onError?.(
      new Error("Synthèse vocale non supportée par ce navigateur"),
    );
    return;
  }

  // Cancel any ongoing playback first.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Map app language codes to the native BCP-47 locales.
  utterance.lang = speechLanguage(langCode);
  utterance.rate = options?.rate ?? 0.9; // Un peu plus lent pour bien entendre la prononciation (phase 10-C)
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = Math.max(0, Math.min(1, options?.volume ?? 1));

  // Deux niveaux de repli, volontairement paresseux :
  //   1. voix qui commence par le code simple ("zh" → "zh-TW", "en" → "en-GB") ;
  //   2. langue arrière par défaut ("en"→ en-* ; "ar"→ ar-*) — mieux qu'un
  //      fallback hardcodé en-US qui laisserait des langues entières muettes.
  const base = langCode.split("-")[0];
  const target = utterance.lang;
  // Certains moteurs Windows nomment les tags avec un underscore ("zh_CN").
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.replace("_", "-") === target) ??
    voices.find((v) => v.lang.replace("_", "-").startsWith(base)) ??
    (base !== "en"
      ? voices.find((v) => v.lang.replace("_", "-").startsWith("en"))
      : undefined);
  if (voice) utterance.voice = voice;

  utterance.onstart = () => options?.onStart?.();
  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = (e) => {
    // "interrupted"/"canceled" just mean a new playback replaced this one.
    if (e.error === "interrupted" || e.error === "canceled") {
      options?.onEnd?.();
      return;
    }
    console.warn("TTS Native error:", e);
    options?.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}

/** Stop whatever is currently being spoken. */
export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
