/**
 * Native browser text-to-speech (Web Speech API) — 100% free, no API key,
 * no network call, no audio files stored anywhere.
 */

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ar: "ar-SA",
  ru: "ru-RU",
};

/** Map an app language code ("zh") to a BCP-47 locale ("zh-CN"). */
export function speechLanguage(code: string): string {
  return LANG_MAP[code] ?? "en-US";
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
  utterance.rate = options?.rate ?? 0.9; // Un peu plus lent pour bien entendre la prononciation
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = Math.max(0, Math.min(1, options?.volume ?? 1));

  // Prefer a native voice matching the exact locale — matters for zh/ar/ru phonemes.
  const target = utterance.lang;
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.replace("_", "-") === target) ??
    voices.find((v) => v.lang.replace("_", "-").startsWith(langCode));
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
