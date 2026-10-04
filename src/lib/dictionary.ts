/**
 * Silent dictionary resolver — the user never sees where data comes from.
 * Cascade: localStorage cache → local base (Convex) → supplementary fetches.
 * Never throws: any failure resolves to null.
 */

export type DictSource = "local" | "ud" | "wiki";

export type DictEntry = {
  expression: string;
  meaning: string;
  example?: string;
  context?: string;
  register?: string;
  region?: string;
  /** Internal routing only — NEVER rendered in the UI. */
  _src: DictSource;
};

/* ── Normalization: case + diacritic-insensitive ─────────────────────── */

export function normWord(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ── Cache (localStorage, TTL 7d / 24h for nulls) ───────────────────── */

type CacheShape = {
  meaning: string;
  example?: string;
  context?: string;
  register?: string;
  region?: string;
};
const TTL_ENTRY = 7 * 86_400_000;
const TTL_NULL = 24 * 3_600_000;

function cacheKey(lang: string, word: string): string {
  return `def:${lang}:${normWord(word)}`;
}

function readCache(lang: string, word: string): DictEntry | null | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(lang, word));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { t: number; v: CacheShape | null };
    if (typeof parsed?.t !== "number") return undefined;
    const ttl = parsed.v === null ? TTL_NULL : TTL_ENTRY;
    if (Date.now() - parsed.t > ttl) {
      localStorage.removeItem(cacheKey(lang, word));
      return undefined;
    }
    if (parsed.v === null) return null;
    return {
      expression: word.trim(),
      meaning: parsed.v.meaning,
      example: parsed.v.example,
      context: parsed.v.context,
      register: parsed.v.register,
      region: parsed.v.region,
      _src: "local",
    };
  } catch {
    return undefined;
  }
}

function writeCache(lang: string, word: string, entry: DictEntry | null): void {
  try {
    const v: CacheShape | null =
      entry === null
        ? null
        : {
            meaning: entry.meaning,
            example: entry.example,
            context: entry.context,
            register: entry.register,
            region: entry.region,
          };
    localStorage.setItem(
      cacheKey(lang, word),
      JSON.stringify({ t: Date.now(), v }),
    );
  } catch {
    // Storage full or unavailable — cache is best-effort only.
  }
}

/* ── Local base (existing public Convex query over its HTTP endpoint) ── */

/**
 * The Convex HTTP URL mirrors VITE_CONVEX_URL (wss://… → https://…). A pure
 * browser fetch against the same backend — no key, no new Convex function
 * beyond the already-public query.
 */
function convexHttpUrl(): string {
  const ws = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "";
  return ws.startsWith("ws") ? `https${ws.slice(3)}` : "";
}

async function fromLocalBase(word: string): Promise<DictEntry | null> {
  const base = convexHttpUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "slang:searchLocal",
        args: { query: word, exact: true, limit: 1 },
        format: "json",
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; value?: unknown };
    if (
      data.status !== "success" ||
      !Array.isArray(data.value) ||
      data.value.length === 0
    ) {
      return null;
    }
    const row = data.value[0] as {
      expression: string;
      meaning: string;
      context?: string;
      register?: string;
      region?: string;
    };
    return {
      expression: row.expression,
      meaning: row.meaning,
      context: row.context,
      register: row.register,
      region: row.region,
      _src: "local",
    };
  } catch {
    return null;
  }
}

/* ── Supplementary sources (browser fetch, no key) ──────────────────── */

function stripBrackets(s: string): string {
  return s.replace(/\[([^\]]+)\]/g, "$1");
}

async function fromSupplementaryEn(word: string): Promise<DictEntry | null> {
  try {
    const res = await fetch(
      `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      list?: Array<{
        definition?: string;
        example?: string;
        thumbs_up?: number;
      }>;
    };
    const items = (data.list ?? [])
      .filter(
        (i) =>
          typeof i.definition === "string" && i.definition.trim().length > 0,
      )
      .sort((a, b) => (b.thumbs_up ?? 0) - (a.thumbs_up ?? 0));
    if (items.length === 0) return null;
    const item = items[0];
    return {
      expression: word.trim(),
      meaning: stripBrackets(item.definition as string),
      example: item.example ? stripBrackets(item.example) : undefined,
      _src: "ud",
    };
  } catch {
    return null;
  }
}

async function fromSupplementaryIntl(
  word: string,
  lang: string,
): Promise<DictEntry | null> {
  try {
    const res = await fetch(
      `https://${lang}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<
      string,
      Array<
        Array<{
          definitions?: Array<{
            definition?: string;
            examples?: string[];
          }>;
        }>
      >
    >;
    const defs = data?.[lang];
    if (!Array.isArray(defs) || defs.length === 0) return null;
    for (const posGroup of defs) {
      for (const item of posGroup) {
        const first = item?.definitions?.find(
          (d) =>
            typeof d.definition === "string" && d.definition.trim().length > 0,
        );
        if (first?.definition) {
          const text = first.definition
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (!text) continue;
          return {
            expression: word.trim(),
            meaning: text,
            example: first.examples?.[0]
              ? first.examples[0].replace(/<[^>]*>/g, " ").trim()
              : undefined,
            _src: "wiki",
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/* ── Public API ─────────────────────────────────────────────────────── */

/** In-flight de-dupe: identical lookups share one promise. */
const inflight = new Map<string, Promise<DictEntry | null>>();

/**
 * Resolve a word silently. Order: cache → local base → supplementary
 * fetch (EN: thumbs-ranked community definitions; otherwise the intl
 * dictionary). Never throws — failures resolve to null and are cached 24 h.
 */
export function resolveWord(
  word: string,
  lang: string,
): Promise<DictEntry | null> {
  const clean = word.replace(/[«».,!?;:…()[\]{}"'’“”]/g, "").trim();
  if (clean.length < 2) return Promise.resolve(null);

  const cached = readCache(lang, clean);
  if (cached !== undefined) return Promise.resolve(cached);

  const key = `${lang}:${normWord(clean)}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async (): Promise<DictEntry | null> => {
    // 1. Local base first.
    const local = await fromLocalBase(clean);
    if (local) {
      writeCache(lang, clean, local);
      return local;
    }
    // 2. One supplementary fetch depending on the language.
    const supplementary =
      lang === "en"
        ? await fromSupplementaryEn(clean)
        : await fromSupplementaryIntl(clean, lang);
    if (supplementary) {
      writeCache(lang, clean, supplementary);
      return supplementary;
    }
    // Nothing found anywhere — remember for 24 h so we don't re-fetch.
    writeCache(lang, clean, null);
    return null;
  })();

  inflight.set(key, task);
  void task
    .catch(() => {})
    .finally(() => {
      if (inflight.get(key) === task) inflight.delete(key);
    });
  return task;
}

/* ── Résolution dans la langue de définition choisie ───────────────── */

/** Résultat d'une résolution localisée : entry + note si fallback. */
export type LocalizedEntry = {
  entry: DictEntry;
  /** Vrai si la traduction de la définition a échoué (fallback meaningFr). */
  fallback: boolean;
};

const DEFTR_TTL = 7 * 86_400_000;

function defTrKey(lang: string, word: string): string {
  return `deftr:${lang}:${normWord(word)}`;
}

function readDefTr(lang: string, word: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(defTrKey(lang, word));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { t: number; v: string | null };
    if (typeof parsed?.t !== "number") return undefined;
    if (Date.now() - parsed.t > DEFTR_TTL) {
      localStorage.removeItem(defTrKey(lang, word));
      return undefined;
    }
    return parsed.v;
  } catch {
    return undefined;
  }
}

function writeDefTr(lang: string, word: string, meaning: string | null): void {
  try {
    localStorage.setItem(
      defTrKey(lang, word),
      JSON.stringify({ t: Date.now(), v: meaning }),
    );
  } catch {
    /* best effort */
  }
}

const defTrInflight = new Map<string, Promise<string | null>>();

/**
 * Traduit un sens vers la langue cible via MyMemory (keyless).
 * Dédupe les requêtes en cours ; échec → null (jamais d'exception).
 */
async function translateMeaning(
  meaning: string,
  source: string,
  target: string,
): Promise<string | null> {
  const key = `mm:${source}|${target}:${normWord(meaning).slice(0, 120)}`;
  const existing = defTrInflight.get(key);
  if (existing) return existing;
  const task = (async (): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(meaning)}&langpair=${source}|${target}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        responseStatus?: string | number;
        responseData?: { translatedText?: string };
      };
      const text = data.responseData?.translatedText;
      if (
        data.responseStatus === 200 &&
        typeof text === "string" &&
        text.trim().length > 0 &&
        normWord(text) !== normWord(meaning)
      ) {
        return text.trim();
      }
      return null;
    } catch {
      return null;
    }
  })();
  defTrInflight.set(key, task);
  void task
    .catch(() => {})
    .finally(() => {
      if (defTrInflight.get(key) === task) defTrInflight.delete(key);
    });
  return task;
}

/**
 * Langue du sens renvoyé par la source : la base locale répond en
 * français, les sources communautaires et internationales dans la langue
 * de la requête. C'est la langue SOURCE de la traduction — l'assumer
 * toujours française affichait la mauvaise traduction (un mot anglais
 * traduit comme s'il venait du français).
 */
function sourceLangOf(entry: DictEntry | null, lookupLang: string): string {
  if (!entry) return "fr";
  return entry._src === "local" ? "fr" : lookupLang;
}

/**
 * Résout un mot dans la langue de définition choisie (def_lang).
 * Le sens est traduit à la volée (MyMemory, caché 7 j) quand la langue
 * choisie diffère de celle de la source — avec repli discret sur le sens
 * d'origine si la traduction échoue.
 */
export async function resolveInLang(
  word: string,
  lookupLang: string,
  defLang: string,
): Promise<LocalizedEntry | null> {
  const entry = await resolveWord(word, lookupLang);
  if (!entry) return null;

  // La langue choisie est déjà celle du sens : affichage natif, rien à faire
  // (couvre fr→fr, en→en pour un mot anglais, es→es pour un mot espagnol…).
  const sourceLang = sourceLangOf(entry, lookupLang);
  if (defLang === sourceLang) {
    return { entry, fallback: false };
  }

  const cached = readDefTr(defLang, entry.expression || word);
  if (cached !== undefined) {
    if (cached === null) return { entry, fallback: true };
    return { entry: { ...entry, meaning: cached }, fallback: false };
  }

  const translated = await translateMeaning(entry.meaning, sourceLang, defLang);
  if (translated) {
    writeDefTr(defLang, entry.expression || word, translated);
    return { entry: { ...entry, meaning: translated }, fallback: false };
  }
  // Échec : note discrète côté appelant, sens d'origine conservé.
  writeDefTr(defLang, entry.expression || word, null);
  return { entry, fallback: true };
}
