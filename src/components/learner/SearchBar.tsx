import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { normWord, resolveInLang, type LocalizedEntry } from "@/lib/dictionary";
import {
  useI18n,
  UI_LANGS,
  uiLangMeta,
  loadDefLang,
  saveDefLang,
  type UiLang,
} from "@/lib/i18n";

/**
 * Unified search in the app menu. Results merge the local base and
 * supplementary entries under one identical visual treatment — the user
 * never sees where data comes from.
 */

const HISTORY_KEY = "searchHistory";
const HISTORY_MAX = 5;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr
          .filter((h): h is string => typeof h === "string")
          .slice(0, HISTORY_MAX)
      : [];
  } catch {
    return [];
  }
}

function saveHistory(list: string[]): void {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(list.slice(0, HISTORY_MAX)),
    );
  } catch {
    /* best effort */
  }
}

type Row = {
  id: string;
  expression: string;
  meaning: string;
  example?: string;
  context?: string;
  register?: string;
  region?: string;
  fallback?: boolean;
};

function hasLatin(s: string): boolean {
  return /[a-z\u00c0-\u024f]/i.test(s);
}

/** Pick the supplementary lookup language from the script of the query. */
function supplementaryLanguage(q: string): string | null {
  for (const ch of q) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x4e00 && cp <= 0x9fff) return "zh";
    if (cp >= 0x0600 && cp <= 0x06ff) return "ar";
    if (cp >= 0x0400 && cp <= 0x04ff) return "ru";
  }
  if (hasLatin(q)) return "en";
  return null;
}

export function SearchBar() {
  const { t, lang: uiLang } = useI18n();
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fetched, setFetched] = useState<LocalizedEntry | null | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);
  const [defLang, setDefLangState] = useState<UiLang>(loadDefLang);
  const [langOpen, setLangOpen] = useState(false);
  const langWrapRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const expandedRowRef = useRef<HTMLDivElement | null>(null);

  const setDefLang = (l: UiLang) => {
    setDefLangState(l);
    saveDefLang(l);
    // Re-réévalue la requête en cours dans la nouvelle langue.
    setFetched(undefined);
  };

  // ── Debounce 400 ms ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 400);
    return () => clearTimeout(t);
  }, [value]);

  const queryText = debounced.length >= 2 ? debounced : "";

  // ── Local rows (reactive query) ─────────────────────────────────────
  const localRows = useQuery(
    api.slang.searchLocal,
    queryText ? { query: queryText, limit: 6 } : "skip",
  );

  // ── Supplementary lookup (deduped + cached inside the resolver) ─────
  const suppLang = useMemo(
    () => (queryText ? supplementaryLanguage(queryText) : null),
    [queryText],
  );

  useEffect(() => {
    if (!queryText || !suppLang) {
      setFetched(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveInLang(queryText, suppLang, defLang)
      .then((entry) => {
        if (cancelled) return;
        setFetched(entry);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetched(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryText, suppLang, defLang]);

  // ── Outside click + Escape close ────────────────────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (
        langWrapRef.current &&
        !langWrapRef.current.contains(e.target as Node)
      ) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Keep the expanded row in view inside the scrollable panel.
  useEffect(() => {
    if (expandedId) {
      expandedRowRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [expandedId]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const r of localRows ?? []) {
      out.push({
        id: `l-${r._id}`,
        expression: r.expression,
        meaning: r.meaning,
        context: r.context,
        register: r.register,
        region: r.region,
      });
    }
    if (fetched) {
      // Hide the supplementary row when the local base already covers it.
      const dup = out.some(
        (r) => normWord(r.expression) === normWord(fetched.entry.expression),
      );
      if (!dup) {
        out.push({
          id: `s-${normWord(fetched.entry.expression)}`,
          expression: fetched.entry.expression,
          meaning: fetched.entry.meaning,
          example: fetched.entry.example,
          context: fetched.entry.context,
          register: fetched.entry.register,
          region: fetched.entry.region,
          fallback: fetched.fallback,
        });
      }
    }
    return out;
  }, [localRows, fetched]);

  const showHistory = open && queryText === "" && history.length > 0;
  const showResults = open && queryText !== "";
  const showPanel = showHistory || (showResults && (rows.length > 0 || loading));

  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => setActiveIdx(0), [queryText]);

  const pushHistory = (term: string) => {
    const next = [term, ...history.filter((h) => h !== term)].slice(
      0,
      HISTORY_MAX,
    );
    setHistory(next);
    saveHistory(next);
  };

  const removeFromHistory = (term: string) => {
    const next = history.filter((h) => h !== term);
    setHistory(next);
    saveHistory(next);
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (showHistory) {
      if (e.key === "ArrowDown" && history.length > 0) {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % history.length);
      } else if (e.key === "ArrowUp" && history.length > 0) {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + history.length) % history.length);
      } else if (e.key === "Enter" && history[activeIdx]) {
        e.preventDefault();
        setValue(history[activeIdx]);
        inputRef.current?.focus();
      }
      return;
    }
    if (!showResults) return;
    if (e.key === "ArrowDown" && rows.length > 0) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp" && rows.length > 0) {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter" && rows[activeIdx]) {
      e.preventDefault();
      setExpandedId(rows[activeIdx].id);
      pushHistory(queryText);
    }
  }

  return (
    <div ref={wrapRef} className="relative min-w-0 max-w-sm flex-1">
      {/* Barre hero : 56 px, texte 18 px, ombre au focus — la recherche est
          une entrée principale de l'app, pas un champ secondaire. */}
      <div className="relative flex items-center transition-all duration-200 focus-within:bg-white/[0.12] focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-6 -translate-y-1/2 text-ink-3" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("common.search")}
          aria-label={t("common.searchAria")}
          className="h-14 w-full rounded-xl border border-white/[0.12] bg-white/[0.08] pe-24 ps-12 text-lg text-ink placeholder:text-ink-3/80 focus:border-white/25 focus:outline-none"
        />
        {value && (
          <button
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="absolute end-16 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
            aria-label={t("common.clear")}
          >
            <X className="size-4" />
          </button>
        )}
        {/* Sélecteur de langue de définition → 🇪🇸 ES, bien visible. */}
        <div ref={langWrapRef} className="absolute end-2">
          <button
            onClick={() => setLangOpen((o) => !o)}
            aria-label={t("common.defLang")}
            aria-expanded={langOpen}
            className="flex h-9 items-center gap-1 rounded-full bg-noir/70 px-2.5 font-mono text-[0.6875rem] font-semibold text-gold transition-colors hover:bg-gold/15"
          >
            <span aria-hidden>{uiLangMeta(defLang).flag}</span>
            {defLang.toUpperCase()}
          </button>
          {langOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setLangOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute end-0 top-11 z-50 w-36 rounded-xl border border-white/10 bg-noir-2 p-1 shadow-2xl">
                {UI_LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setDefLang(l);
                      setLangOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      l === defLang
                        ? "bg-gold/10 text-gold"
                        : "text-ink-2 hover:bg-gold/10 hover:text-gold"
                    }`}
                  >
                    <span aria-hidden>{uiLangMeta(l).flag}</span>
                    <span className="flex-1 text-start">
                      {uiLangMeta(l).native}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showPanel && (
        <div className="ln-panel-in absolute left-0 right-0 top-16 z-50 max-h-96 overflow-auto rounded-xl border border-white/10 bg-noir-2 p-1.5 shadow-2xl">
          {showHistory ? (
            <div className="space-y-0.5">
              {history.map((h, i) => (
                <div
                  key={h}
                  className={`group flex items-center justify-between rounded-lg px-2.5 py-2 ${
                    activeIdx === i ? "bg-white/5" : ""
                  }`}
                >
                  <button
                    className="min-w-0 flex-1 truncate text-left text-sm text-ink-2"
                    onClick={() => {
                      setValue(h);
                      inputRef.current?.focus();
                    }}
                  >
                    {h}
                  </button>
                  <button
                    className="ml-2 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
                    onClick={() => removeFromHistory(h)}
                    aria-label={`Retirer ${h} de l'historique`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              {loading && rows.length === 0 && (
                <div className="space-y-2 p-2">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg bg-white/5"
                    />
                  ))}
                </div>
              )}
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  ref={expandedId === row.id ? expandedRowRef : undefined}
                  data-active={activeIdx === i}
                  className="ln-stagger-item rounded-lg transition-colors hover:bg-white/5 data-[active=true]:bg-white/5"
                  style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <button
                    onClick={() => {
                      const next = expandedId === row.id ? null : row.id;
                      setExpandedId(next);
                      if (next) pushHistory(queryText);
                    }}
                    className="w-full px-2.5 py-2 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-gold">
                      {row.expression}
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {row.meaning}
                      </span>
                      {(row.register || row.region) && (
                        <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">
                          {row.register}
                          {row.register && row.region ? " · " : ""}
                          {row.region}
                        </span>
                      )}
                    </span>
                  </button>
                  {expandedId === row.id && (
                    <div className="ln-accordion space-y-1.5 border-t border-white/5 px-2.5 pb-2.5 pt-2 text-xs">
                      {row.example && (
                        <p className="italic text-ink-2">{row.example}</p>
                      )}
                      {row.context && <p className="text-ink-2">{row.context}</p>}
                      {row.fallback && (
                        <p className="text-[0.625rem] text-ink-3">
                          {t("errors.defNote")}
                        </p>
                      )}
                      {(row.example || row.context) && (
                        <p className="font-mono text-[0.625rem] text-ink-3">
                          {row.region}
                          {row.register && row.region ? " · " : ""}
                          {row.register}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!loading && rows.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-ink-3">
                  {t("common.noResults", { q: queryText })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
