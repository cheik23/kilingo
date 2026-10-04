import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Clock, Loader2, Search, Sparkles, X } from "lucide-react";
import { KIND_META, type Kind } from "@/openverse/model";

const KINDS: (Kind | "all")[] = [
  "all",
  "movie",
  "series",
  "video",
  "music",
  "podcast",
  "book",
  "audio",
  "article",
  "image",
];

export function SearchBox({
  initial = "",
  kind,
  onKind,
  onSubmit,
  loading = false,
  compact = false,
}: {
  initial?: string;
  kind: Kind | null;
  onKind: (kind: Kind | null) => void;
  onSubmit: (query: string) => void;
  loading?: boolean;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), 220);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const suggestions = useQuery(api.ovSearch.suggest, { q: debounced });
  const open = focused && (debounced.length >= 2 || (suggestions?.recent.length ?? 0) > 0);

  const list = useMemo(() => {
    const titles = suggestions?.titles ?? [];
    const recent = suggestions?.recent ?? [];
    return [...titles.map((t) => ({ label: t, kind: "title" as const })), ...recent.map((r) => ({ label: r, kind: "recent" as const }))]
      .filter((entry, i, all) => all.findIndex((e) => e.label === entry.label) === i)
      .slice(0, 7);
  }, [suggestions]);

  return (
    <div className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim().length >= 2) {
            setFocused(false);
            onSubmit(value.trim());
          }
        }}
        className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-noir px-3 transition-colors focus-within:border-gold/40 ${
          compact ? "h-11" : "h-14"
        }`}
      >
        <Search className="size-4 shrink-0 text-gold" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          placeholder="Rechercher un film, une musique, un livre, un artiste, un acteur…"
          aria-label="Recherche universelle"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Effacer"
            className="text-ink-3 transition-colors hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
        <div className="hidden items-center gap-1 border-l border-white/10 pl-2 sm:flex">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKind(k === "all" ? null : (k as Kind))}
              className={`rounded-lg px-2 py-1 text-[0.6875rem] transition-colors ${
                (kind ?? "all") === k ? "bg-gold/15 text-gold" : "text-ink-3 hover:text-ink"
              }`}
              title={k === "all" ? "Tous les types" : KIND_META[k as Kind].plural}
            >
              {k === "all" ? "Tous" : KIND_META[k as Kind].icon}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading || value.trim().length < 2}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-3 text-xs font-semibold text-noir transition-opacity disabled:opacity-40"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          <span className="hidden sm:inline">Chercher</span>
        </button>
      </form>

      {open && list.length > 0 && (
        <div className="ln-panel-in absolute inset-x-0 top-[calc(100%+6px)] z-50 origin-top overflow-hidden rounded-2xl border border-white/10 bg-noir shadow-2xl">
          {list.map((entry) => (
            <button
              key={`${entry.kind}-${entry.label}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setValue(entry.label);
                setFocused(false);
                onSubmit(entry.label);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-2 transition-colors hover:bg-white/5 hover:text-ink"
            >
              {entry.kind === "title" ? (
                <Sparkles className="size-3.5 shrink-0 text-gold" />
              ) : (
                <Clock className="size-3.5 shrink-0 text-ink-3" />
              )}
              <span className="line-clamp-1">{entry.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
