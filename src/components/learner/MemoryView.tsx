import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  LANGUAGES,
  registerKey,
  type LanguageCode,
} from "@/convex/languages";
import { UI_LANGS, uiLangMeta } from "@/lib/i18n";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Heart,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { SpeakButton } from "./SpeakButton";
import {
  exportAnki,
  exportCSV,
  type ExportCard,
} from "@/lib/exportEngine";
import { soundEngine } from "@/lib/soundEngine";
import { ReviewView } from "./ReviewView";
import { useI18n, type UiLang } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════
   MA MÉMOIRE — tout ce que l'utilisateur a réellement mémorisé :
   mots, expressions, argot, avec date d'ajout, langue, contexte,
   progression (répétitions, prochaine révision), recherche, filtres,
   tri et navigation précédent/suivant.
   ❤️ = favori (convex/favorites.ts) — distinct de la révision ↻.
   ═══════════════════════════════════════════════════════════════════ */

type StatusFilter = "all" | "due" | "later" | "mastered";
type SortKey = "due" | "added" | "alpha" | "popularity";

/* ── Export Anki/CSV (100 % client, aucune API) ────────────────────── */

function ExportMenu({
  rows,
  t,
}: {
  rows: ExportCard[];
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  const [expLang, setExpLang] = useState<UiLang | "all">("all");

  const filteredRows = useMemo(
    () => (expLang === "all" ? rows : rows.filter((r) => r.language === expLang)),
    [rows, expLang],
  );
  const empty = rows.length === 0 || filteredRows.length === 0;

  const doExport = (format: "csv" | "tsv") => {
    try {
      const langTag = expLang === "all" ? "all" : expLang;
      if (format === "csv") {
        exportCSV(filteredRows, langTag);
      } else {
        exportAnki(filteredRows, langTag);
      }
      soundEngine.play("reward");
      toast.success(t("exportMenu.done", { n: filteredRows.length }));
      setOpen(false);
    } catch {
      toast.error(t("exportMenu.failed"));
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={rows.length === 0}
        aria-expanded={open}
        title={rows.length === 0 ? t("exportMenu.emptyHint") : undefined}
        className="flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="size-4" />
        {t("exportMenu.label")}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute end-0 top-12 z-50 w-64 rounded-2xl border border-white/10 bg-noir-2 p-3 shadow-2xl">
            <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {t("exportMenu.language")}
            </p>
            <div className="mt-2 max-h-44 overflow-auto">
              <button
                type="button"
                onClick={() => setExpLang("all")}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                  expLang === "all"
                    ? "bg-gold/10 text-gold"
                    : "text-ink-2 hover:bg-gold/10 hover:text-gold"
                }`}
              >
                🌐 {t("exportMenu.allLangs")}
              </button>
              {UI_LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setExpLang(l)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                    expLang === l
                      ? "bg-gold/10 text-gold"
                      : "text-ink-2 hover:bg-gold/10 hover:text-gold"
                  }`}
                >
                  <span aria-hidden>{uiLangMeta(l).flag}</span>
                  <span className="flex-1 text-start">{uiLangMeta(l).native}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => doExport("csv")}
                disabled={empty}
                title={empty ? t("exportMenu.emptyHint") : undefined}
                className="w-full rounded-lg bg-gradient-to-r from-gold-strong to-gold px-3 py-1.5 text-xs font-semibold text-noir transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("exportMenu.csv")}
              </button>
              <button
                type="button"
                onClick={() => doExport("tsv")}
                disabled={empty}
                title={empty ? t("exportMenu.emptyHint") : undefined}
                className="w-full rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("exportMenu.tsv")}
              </button>
              {/* Guide pas-à-pas : l'import Anki n'est pas évident, et
                  l'utilisateur n'a aucun moyen de deviner le réglage. */}
              <p className="pt-1 text-[0.625rem] leading-relaxed text-ink-3">
                {t("exportMenu.instructionsAnki")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  learning: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  confirming: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  mastered: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
};

export function MemoryView() {
  const { t, lang: uiLang } = useI18n();
  // Deux modes : parcourir la mémoire, ou lancer une session de révision.
  const [mode, setMode] = useState<"browse" | "review">("browse");
  const deck = useQuery(api.learning.myDeck, {});
  const favoriteIds = useQuery(api.favorites.favoriteSlangIds, {});
  const toggleFavorite = useMutation(api.favorites.toggleSlangFavorite);
  const favorites = useMemo(() => new Set(favoriteIds ?? []), [favoriteIds]);

  const [query, setQuery] = useState("");
  const [langF, setLangF] = useState<LanguageCode | "all">("all");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("due");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 24;

  const now = Date.now();

  const filtered = useMemo(() => {
    const rows = (deck ?? []).map(({ card, slang }) => ({ card, slang }));
    const q = query.trim().toLowerCase();
    return rows
      .filter(({ card, slang }) => {
        if (langF !== "all" && slang.language !== langF) return false;
        if (statusF === "due" && card.nextReview > now) return false;
        if (statusF === "later" && card.nextReview <= now) return false;
        if (statusF === "mastered" && card.status !== "mastered") return false;
        if (!q) return true;
        return (
          slang.expression.toLowerCase().includes(q) ||
          slang.meaning.toLowerCase().includes(q) ||
          (slang.context ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        switch (sort) {
          case "added":
            return b.card._creationTime - a.card._creationTime;
          case "alpha":
            return a.slang.expression.localeCompare(b.slang.expression);
          case "popularity":
            return b.slang.popularity - a.slang.popularity;
          default:
            return a.card.nextReview - b.card.nextReview;
        }
      });
  }, [deck, query, langF, statusF, sort, now]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const dueCount = (deck ?? []).filter(
    (d) => d.card.nextReview <= now && d.card.status !== "mastered",
  ).length;

  /* Mode révision : on délègue entièrement à ReviewView. */
  if (mode === "review") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setMode("browse")}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
        >
          ← {t("memory.backToMemory")}
        </button>
        <ReviewView />
      </div>
    );
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-[0.6875rem] transition-colors ${
      active
        ? "border-gold/50 bg-gold/10 text-gold"
        : "border-white/10 text-ink-3 hover:text-ink-2"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-gold uppercase">
            {t("memory.brand")}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {t("memory.title")}
          </h1>
        </div>
        <ExportMenu
          t={t}
          rows={(deck ?? []).map(({ card, slang }) => ({
            expression: slang.expression,
            language: slang.language,
            meaning: slang.meaning,
            example: slang.context ?? "",
            // Translation : le sens stocké EST le texte lisible de l'app
            // (déjà rendu tel quel dans les cartes) — pas d'appel réseau.
            translation: slang.meaning,
            // Colonne mastery du CSV : où en est la carte dans le cycle SRS.
            mastery: card.status ?? "learning",
          }))}
        />
        <button
          onClick={() => setMode("review")}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-soft px-5 py-2 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
        >
          ↻ {t("memory.reviewNow")}
          {dueCount > 0 && (
            <span className="rounded-full bg-noir/30 px-2 py-0.5 font-mono text-[0.625rem]">
              {dueCount}
            </span>
          )}
        </button>
      </div>

      {/* Recherche + filtres + tri */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute top-2.5 left-3 size-4 text-ink-3" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={t("memory.searchPlaceholder")}
            className="w-full rounded-xl border border-white/10 bg-noir-2 py-2.5 pr-4 pl-9 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-gold/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-ink-3" />
          <button onClick={() => setLangF("all")} className={chip(langF === "all")}>
            {t("memory.allLangs")}
          </button>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLangF(l.code);
                setPage(0);
              }}
              className={chip(langF === l.code)}
            >
              {l.flag} {l.code.toUpperCase()}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          <button
            onClick={() => {
              setStatusF("all");
              setPage(0);
            }}
            className={chip(statusF === "all")}
          >
            {t("memory.allStatus")}
          </button>
          <button
            onClick={() => {
              setStatusF("due");
              setPage(0);
            }}
            className={chip(statusF === "due")}
          >
            {t("memory.statusDue")}
          </button>
          <button
            onClick={() => {
              setStatusF("later");
              setPage(0);
            }}
            className={chip(statusF === "later")}
          >
            {t("memory.statusLater")}
          </button>
          <button
            onClick={() => {
              setStatusF("mastered");
              setPage(0);
            }}
            className={chip(statusF === "mastered")}
          >
            {t("memory.statusMastered")}
          </button>
          <span className="mx-1 h-4 w-px bg-white/10" />
          <SlidersHorizontal className="size-3.5 text-ink-3" />
          <button onClick={() => setSort("due")} className={chip(sort === "due")}>
            {t("memory.sortDue")}
          </button>
          <button onClick={() => setSort("added")} className={chip(sort === "added")}>
            {t("memory.sortAdded")}
          </button>
          <button onClick={() => setSort("alpha")} className={chip(sort === "alpha")}>
            {t("memory.sortAlpha")}
          </button>
          <button
            onClick={() => setSort("popularity")}
            className={chip(sort === "popularity")}
          >
            {t("memory.sortPopularity")}
          </button>
        </div>
      </div>

      {/* Liste paginée */}
      {!deck ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-shimmer h-40 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="ln-card py-10 text-center text-sm text-ink-2">
          {t("memory.empty")}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ card, slang }, i) => {
              const lang = LANGUAGES.find((l) => l.code === slang.language);
              const rk = registerKey(slang.register);
              const fav = favorites.has(slang._id);
              const due = card.nextReview <= now && card.status !== "mastered";
              return (
                <div
                  key={card._id}
                  className="ln-card ln-stagger-item flex flex-col p-4"
                  style={{ "--ln-i": i } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-display text-lg italic">
                          {slang.expression}
                        </p>
                        <SpeakButton
                          text={slang.expression}
                          language={slang.language}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {lang?.flag ?? "🌐"} {slang.language.toUpperCase()}
                        {rk ? ` · ${t(`registers.${rk}`)}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        void (async () => {
                          try {
                            const res = await toggleFavorite({
                              slangId: slang._id as never,
                            });
                            toast.success(
                              res.favorite
                                ? t("discover.favoriteAdded", {
                                    e: slang.expression,
                                  })
                                : t("discover.favoriteRemoved", {
                                    e: slang.expression,
                                  }),
                            );
                          } catch {
                            toast.error(t("errors.generic"));
                          }
                        })()
                      }
                      aria-pressed={fav}
                      title={
                        fav
                          ? t("discover.favoriteRemove")
                          : t("discover.favoriteAdd")
                      }
                      aria-label={
                        fav
                          ? t("discover.favoriteRemove")
                          : t("discover.favoriteAdd")
                      }
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        fav
                          ? "border-gold/50 bg-gold/15 text-gold"
                          : "border-white/10 text-ink-3 hover:border-gold/30 hover:text-gold"
                      }`}
                    >
                      <Heart className={`size-3.5 ${fav ? "fill-current" : ""}`} />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-ink-2">{slang.meaning}</p>
                  {slang.context && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-3">
                      {slang.context}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2.5 font-mono text-[0.625rem] text-ink-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 uppercase ${
                        card.status
                          ? (STATUS_BADGE[card.status] ?? "border-white/10")
                          : "border-white/10"
                      }`}
                    >
                      {card.status
                        ? t(`memory.badge_${card.status}`)
                        : t("memory.badge_learning")}
                    </span>
                    <span>· {t("memory.reps", { n: card.repetitions })}</span>
                    <span>
                      ·{" "}
                      {due
                        ? t("memory.dueBadge")
                        : t("memory.nextIn", {
                            d: Math.ceil(
                              (card.nextReview - now) / 86_400_000,
                            ),
                          })}
                    </span>
                    <span>
                      ·{" "}
                      {t("memory.addedOn", {
                        d: new Date(card._creationTime).toLocaleDateString(
                          uiLang,
                        ),
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation précédent / suivant */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-30"
            >
              <ChevronLeft className="size-4" /> {t("memory.prev")}
            </button>
            <span className="font-mono text-xs text-ink-3">
              {safePage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-30"
            >
              {t("memory.next")} <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
