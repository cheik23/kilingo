import { useEffect, useState } from "react";
import { normWord } from "./dictionary";

/* ═══════════════════════════════════════════════════════════════════
   TRADUCTION CLIENT COURTE — un seul helper partagé (recherche, livres).

   MyMemory keyless, cache localStorage 24 h, dédupe par effet.
   Échec ⇒ texte original (affiché tel quel, jamais de crash).
   Le rendu décide du fallback (« traduction indisponible ») en comparant
   value au texte source.
   ═══════════════════════════════════════════════════════════════════ */

/** zh → zh-CN pour MyMemory ; les autres codes passent tels quels. */
export function mmLang(code: string): string {
  return code === "zh" ? "zh-CN" : code;
}

export function useLocalizedText(
  text: string | undefined,
  source: string,
  target: string,
): { value: string | undefined; loading: boolean } {
  const [state, setState] = useState<{ value: string | undefined; loading: boolean }>(
    () => ({ value: text, loading: false }),
  );
  useEffect(() => {
    if (!text || source === target) {
      setState({ value: text, loading: false });
      return;
    }
    const key = `mmtr:${source}>${target}:${normWord(text).slice(0, 100)}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { t: number; v: string | null };
        if (typeof parsed?.t === "number" && Date.now() - parsed.t < 24 * 3_600_000) {
          setState({ value: parsed.v ?? text, loading: false });
          return;
        }
      }
    } catch {
      /* cache best-effort */
    }
    let cancelled = false;
    setState({ value: text, loading: true });
    void (async () => {
      let value: string | null = null;
      try {
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${mmLang(source)}|${mmLang(target)}`,
          { signal: AbortSignal.timeout(6000) },
        );
        if (res.ok) {
          const data = (await res.json()) as { responseData?: { translatedText?: string } };
          const out = data.responseData?.translatedText;
          if (out && normWord(out) !== normWord(text)) value = out.trim();
        }
      } catch {
        /* échec silencieux : texte original conservé */
      }
      try {
        localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
      } catch {
        /* best-effort */
      }
      if (!cancelled) setState({ value: value ?? text, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [text, source, target]);
  return state;
}
