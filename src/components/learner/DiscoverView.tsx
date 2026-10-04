import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  COUNTRIES,
  LANGUAGES,
  REGISTER_IDS,
  registerKey,
  type LanguageCode,
} from "@/convex/languages";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Brain, Globe, Heart, Search, Volume2, X, Filter, Shuffle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SpeakButton } from "./SpeakButton";
import { GoldBurst } from "@/components/fx/rewards";
import { useI18n } from "@/lib/i18n";
import { useSwipe, type SwipeDirection } from "@/hooks/useSwipe";

const REGISTER_STYLES: Record<string, string> = {
  street: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  casual: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  vulgar: "border-red-400/40 bg-red-400/10 text-red-300",
  internet: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  urban: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  colloquial: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  unfiltered: "border-red-400/40 bg-red-400/10 text-red-300",
  trending: "border-violet-400/40 bg-violet-400/10 text-violet-300",
};

type Slang = {
  _id: string;
  language: string;
  expression: string;
  literal?: string;
  meaning: string;
  context: string;
  register: string;
  region: string;
  popularity: number;
  mediaRefs?: string[];
};

/* ── Historique d'exposition (localStorage, FIFO 300) ──────────────── */

function readIds(key: "discover_shown" | "discover_swiped"): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-300) : [];
  } catch {
    return [];
  }
}

function pushId(key: "discover_shown" | "discover_swiped", id: string) {
  try {
    const arr = readIds(key);
    const next = [...arr, id].slice(-300);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // localStorage indisponible — la variation sera moindre mais l'app tient.
  }
}

/* ── Carte de la stack ─────────────────────────────────────────────── */

function CardFaceInner({ item, revealLabel }: { item: Slang; revealLabel: string }) {
  const [revealed, setRevealed] = useState(false);
  const lang = LANGUAGES.find((l) => l.code === item.language);

  return (
    <>
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-gold/10 blur-3xl" />
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-white/10 bg-noir/60 px-3 py-1 font-mono text-[0.625rem] tracking-widest text-ink-2 uppercase">
          {lang?.flag} {item.region}
        </span>
        <span className="font-mono text-[0.625rem] text-ink-3">
          ❤ {item.popularity}
        </span>
      </div>

      <div className="mt-10 mb-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <p className="font-display text-4xl leading-tight font-semibold italic">
            {item.expression}
          </p>
          <SpeakButton text={item.expression} language={item.language} size="lg" />
        </div>
        <p className="mt-3 text-sm text-ink-3 italic">
          litt. « {item.literal} »
        </p>
      </div>

      {revealed ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <p className="text-center text-lg font-medium text-gold">
            {item.meaning}
          </p>
          <p className="text-center text-sm leading-relaxed text-ink-2">
            {item.context}
          </p>
          {item.mediaRefs && item.mediaRefs.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-3">
              {item.mediaRefs.map((r) => (
                <p key={r} className="text-center text-xs text-ink-3">
                  🎬 {r}
                </p>
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="mx-auto flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-sm text-gold transition-colors hover:bg-gold/20"
        >
          <Volume2 className="size-4" /> {revealLabel}
        </button>
      )}
    </>
  );
}

export function DiscoverView() {
  const { t } = useI18n();
  const [langFilter, setLangFilter] = useState<LanguageCode | "all">("all");
  const [countryFilter, setCountryFilter] = useState<string | "all">("all");
  const [registerFilter, setRegisterFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"deck" | "database">("deck");

  /* ── Historique d'exposition (FIFO 300, rechargé au mount) ────────── */
  const [excludeList, setExcludeList] = useState<string[]>(() => [
    ...new Set([...readIds("discover_shown"), ...readIds("discover_swiped")]),
  ]);

  // Le deck HÉRITE des filtres — c'était le bug : aucun filtre ne le
  // traversait, d'où des cartes US alors qu'Espagne était sélectionnée.
  const deckArgs = useMemo(() => {
    const rest = excludeList as never;
    return {
      excludeIds: rest,
      limit: 30,
      ...(langFilter !== "all" ? { language: langFilter } : {}),
      ...(countryFilter !== "all" ? { country: countryFilter } : {}),
      ...(registerFilter !== "all" ? { register: registerFilter } : {}),
    };
  }, [excludeList, langFilter, countryFilter, registerFilter]);
  const deck = useQuery(api.slang.discoveryDeck, deckArgs);
  const database = useQuery(api.slang.list, {
    language: langFilter === "all" ? undefined : langFilter,
    register: registerFilter === "all" ? undefined : registerFilter,
    country: countryFilter === "all" ? undefined : countryFilter,
    search: search || undefined,
    limit: 60,
  });
  const addToSrs = useMutation(api.learning.addToSrs);
  const recordSession = useMutation(api.learning.recordSession);
  const favoriteIds = useQuery(api.favorites.favoriteSlangIds);
  const toggleFavorite = useMutation(api.favorites.toggleSlangFavorite);
  const favorites = useMemo(() => new Set(favoriteIds ?? []), [favoriteIds]);

  const deckItems = useMemo(() => deck ?? [], [deck]);
  const [deckIndex, setDeckIndex] = useState(0);
  const current = deckItems[deckIndex];
  const behind = deckItems.slice(deckIndex + 1, deckIndex + 3);
  const [burst, setBurst] = useState(0);

  /* ── Actions de swipe ─────────────────────────────────────────────── */

  /**
   * Glisser à droite range la carte : c'est un favori, rien de plus.
   * Un cœur ne doit JAMAIS programmer de révision — « Apprendre » (le
   * cerveau) est la seule action qui remplit la mémoire et le SRS.
   */
  const commitSwipe = useCallback(
    (dir: SwipeDirection) => {
      if (!current) return;
      if (dir === "right") {
        setBurst((n) => n + 1);
        pushId("discover_swiped", current._id);
        void (async () => {
          try {
            const res = await toggleFavorite({ slangId: current._id as never });
            if (res.favorite) {
              toast.success(t("discover.favoriteAdded", { e: current.expression }));
            } else {
              toast.info(t("discover.favoriteRemoved", { e: current.expression }));
            }
          } catch {
            toast.error(t("errors.generic"));
          }
        })();
      }
      // Swipe gauche : vu uniquement (discover_shown via l'effet ci-dessous),
      // reproposable plus tard une fois le FIFO 300 tourné.
      setDeckIndex((i) => i + 1);
    },
    [current, toggleFavorite, t],
  );

  /** Apprendre : c'est ici, et seulement ici, qu'une carte entre en mémoire. */
  const learnCurrent = useCallback(() => {
    if (!current) return;
    void (async () => {
      try {
        const res = await addToSrs({ slangId: current._id as never });
        if (res?.ok) {
          toast.success(t("discover.addedSrs", { e: current.expression }));
          await recordSession({
            language: current.language as LanguageCode,
            kind: "discovery",
            durationSeconds: 25,
            itemsLearned: 1,
          });
        } else {
          toast.info(t("discover.alreadyDeck"));
        }
      } catch {
        toast.error(t("errors.generic"));
      }
    })();
  }, [current, addToSrs, recordSession, t]);

  const { dx, dragging, exiting, swipe, handlers } = useSwipe(commitSwipe);

  /* Toute carte affichée entre dans l'historique "shown" (FIFO 300). */
  useEffect(() => {
    if (!current) return;
    const list = readIds("discover_shown");
    if (!list.includes(current._id)) pushId("discover_shown", current._id);
  }, [current?._id]);

  /* Clavier : → = swipe droit (réviser), ← = swipe gauche (plus tard). */
  useEffect(() => {
    if (tab !== "deck" || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") swipe("right");
      else if (e.key === "ArrowLeft") swipe("left");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, current?._id, swipe]);

  const filtersActive =
    langFilter !== "all" || countryFilter !== "all" || registerFilter !== "all";
  const resetFilters = useCallback(() => {
    setLangFilter("all");
    setCountryFilter("all");
    setRegisterFilter("all");
    setDeckIndex(0);
  }, []);

  const reshuffle = useCallback(() => {
    setDeckIndex(0);
    setExcludeList((prev) => {
      const mixed = [...prev];
      // Petite rotation FIFO : libère les plus anciennes cartes après un cycle.
      if (mixed.length > 40) return mixed.slice(20);
      return mixed;
    });
  }, []);

  // Les chips "TOUTES" (langue) et "Tous" (registre) de la ligne langue
  // font aussi office de bouton pays — simple et sans ligne de plus.
  const allCountries = useMemo(
    () => (langFilter === "all" ? [] : (COUNTRIES[langFilter] ?? [])),
    [langFilter],
  );
  const showCountryRow = allCountries.length > 1 || countryFilter !== "all";

  const setLang = useCallback((l: LanguageCode | "all") => {
    setLangFilter(l);
    setCountryFilter("all"); // un pays n'a de sens que dans sa langue
  }, []);

  /* ── Transform de la carte active ─────────────────────────────────── */

  const activeStyle: React.CSSProperties =
    exiting === "right"
      ? {
          transform: "translateX(560px) rotate(20deg)",
          opacity: 0,
          transition: "transform 250ms ease-out, opacity 250ms ease-out",
        }
      : exiting === "left"
        ? {
            transform: "translateX(-560px) rotate(-20deg)",
            opacity: 0,
            transition: "transform 250ms ease-out, opacity 250ms ease-out",
          }
        : {
            transform: `translateX(${dx}px) rotate(${dx / 20}deg)`,
            transition: dragging ? "none" : "transform 250ms ease-out",
          };

  const overlayRightOpacity = Math.max(0, Math.min(1, dx / 100));
  const overlayLeftOpacity = Math.max(0, Math.min(1, -dx / 100));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-gold uppercase">
            {t("discover.brand")}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {t("discover.title")}
          </h1>
        </div>
        <div className="flex gap-2">
          {(["deck", "database"] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                tab === tb
                  ? "bg-gold font-semibold text-noir"
                  : "border border-white/10 text-ink-2 hover:text-ink"
              }`}
            >
              {tb === "deck" ? t("discover.deck") : t("discover.database")}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres — langue, puis pays, puis registre. Tous réels, pour le
          deck ET la base : les modifier change réellement les résultats. */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="size-3.5 text-ink-3" />
        <button
          onClick={() => setLang("all")}
          className={`rounded-full border px-3 py-1 font-mono text-[0.6875rem] transition-colors ${
            langFilter === "all"
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-white/10 text-ink-3 hover:text-ink-2"
          }`}
        >
          TOUTES
        </button>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`rounded-full border px-3 py-1 font-mono text-[0.6875rem] transition-colors ${
              langFilter === l.code
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-white/10 text-ink-3 hover:text-ink-2"
            }`}
          >
            {l.flag} {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      {showCountryRow && (
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="size-3.5 text-ink-3" />
          <button
            onClick={() => setCountryFilter("all")}
            className={`rounded-full border px-3 py-1 font-mono text-[0.6875rem] transition-colors ${
              countryFilter === "all"
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-white/10 text-ink-3 hover:text-ink-2"
            }`}
          >
            {langFilter === "all"
              ? t("discover.allCountries")
              : t("discover.allCountriesShort")}
          </button>
          {allCountries.map((c) => (
            <button
              key={c.code}
              onClick={() => setCountryFilter(c.code)}
              className={`rounded-full border px-3 py-1 text-[0.6875rem] transition-colors ${
                countryFilter === c.code
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-white/10 text-ink-3 hover:text-ink-2"
              }`}
            >
              {c.flag} {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setRegisterFilter("all")}
          className={`rounded-full border px-3 py-1 text-[0.6875rem] transition-colors ${
            registerFilter === "all"
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-white/10 text-ink-3 hover:text-ink-2"
          }`}
        >
          {t("discover.allRegisters")}
        </button>
        {REGISTER_IDS.map((k) => (
          <button
            key={k}
            onClick={() => setRegisterFilter(k)}
            className={`rounded-full border px-3 py-1 text-[0.6875rem] transition-colors ${
              registerFilter === k
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-white/10 text-ink-3 hover:text-ink-2"
            }`}
          >
            {t(`registers.${k}`)}
          </button>
        ))}
      </div>

      <div key={tab} className="ln-tab-in">
      {tab === "deck" ? (
        <div className="flex flex-col items-center">
          {!deck ? (
            <div className="animate-shimmer h-96 w-full max-w-sm rounded-3xl" />
          ) : current ? (
            <div className="w-full max-w-sm select-none">
              {/* Stack : carte active + 2 derrière */}
              <div className="relative">
                {/* Cartes derrière (reformation animée 250 ms) */}
                {behind.map((item, i) => (
                  <div
                    key={item._id}
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-96 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-noir-3 via-noir-2 to-noir p-8"
                    style={{
                      transform: `scale(${i === 0 ? 0.95 : 0.9}) translateY(${i === 0 ? 8 : 16}px)`,
                      opacity: i === 0 ? 0.6 : 0.3,
                      transition: "transform 250ms ease-out, opacity 250ms ease-out",
                      zIndex: 2 - i,
                    }}
                  >
                    <CardFaceInner item={item} revealLabel={t("discover.reveal")} />
                  </div>
                ))}

                {/* Carte active */}
                <div
                  key={current._id}
                  {...handlers}
                  className={`relative z-10 h-96 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-noir-3 via-noir-2 to-noir p-8 shadow-2xl will-change-transform ${
                    !dragging && !exiting ? "ln-card-in" : ""
                  }`}
                  style={{
                    ...activeStyle,
                    touchAction: "pan-y",
                    cursor: dragging ? "grabbing" : "grab",
                  }}
                >
                  <GoldBurst trigger={burst}>
                    <CardFaceInner
                      item={current}
                      revealLabel={t("discover.reveal")}
                    />
                  </GoldBurst>

                  {/* Overlays de drag */}
                  <div
                    className="pointer-events-none absolute inset-0 z-20 flex items-start justify-start p-6"
                    style={{ opacity: overlayRightOpacity }}
                  >
                    <span className="rotate-[-12deg] rounded-xl border-2 border-gold px-4 py-1.5 font-display text-xl font-bold tracking-widest text-gold">
                      {t("discover.swipeRevise")}
                    </span>
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0 z-20 flex items-start justify-end p-6"
                    style={{ opacity: overlayLeftOpacity }}
                  >
                    <span className="rotate-[12deg] rounded-xl border-2 border-white/40 px-4 py-1.5 font-display text-xl font-bold tracking-widest text-white/70">
                      {t("discover.swipeLater")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trois gestes distincts : plus tard · favori · apprendre. */}
              <div className="mt-6 flex items-center justify-center gap-6">
                <button
                  onClick={() => swipe("left")}
                  className="flex size-12 items-center justify-center rounded-full border border-white/15 text-ink-2 transition-transform hover:scale-[1.05] hover:border-white/30 hover:text-ink"
                  title={t("discover.swipeLater")}
                  aria-label={t("discover.swipeLater")}
                >
                  <X className="size-5" />
                </button>
                <button
                  onClick={() => swipe("right")}
                  aria-pressed={favorites.has(current._id)}
                  className={`flex size-12 items-center justify-center rounded-full border transition-transform hover:scale-[1.05] ${
                    favorites.has(current._id)
                      ? "border-gold bg-gold text-noir shadow-lg shadow-gold/20"
                      : "border-gold/40 bg-gold/10 text-gold"
                  }`}
                  title={
                    favorites.has(current._id)
                      ? t("discover.favoriteRemove")
                      : t("discover.favoriteAdd")
                  }
                  aria-label={
                    favorites.has(current._id)
                      ? t("discover.favoriteRemove")
                      : t("discover.favoriteAdd")
                  }
                >
                  <Heart
                    className={`size-5 ${favorites.has(current._id) ? "fill-current" : ""}`}
                  />
                </button>
                <button
                  onClick={learnCurrent}
                  className="flex size-12 items-center justify-center rounded-full border border-white/15 text-ink-2 transition-transform hover:scale-[1.05] hover:border-gold/50 hover:text-gold"
                  title={t("discover.addToSrs")}
                  aria-label={t("discover.addToSrs")}
                >
                  <Brain className="size-5" />
                </button>
              </div>

              <p className="mt-4 text-center font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                ❤ {t("discover.favoriteAdd")} · 🧠 {t("discover.addToSrs")}
              </p>
              <p className="mt-1.5 text-center font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                {t("discover.swipeNote", {
                  i: deckIndex + 1,
                  n: deckItems.length,
                })}
              </p>
            </div>
          ) : (
            <div className="max-w-sm py-16 text-center">
              <p className="font-display text-2xl italic">
                {filtersActive
                  ? t("discover.noMatchFilters")
                  : t("discover.allSwiped")}
              </p>
              <p className="mt-2 text-sm text-ink-2">
                {filtersActive
                  ? t("discover.noMatchFiltersHint")
                  : t("discover.allSwipedHint")}
              </p>
              {filtersActive ? (
                <button
                  onClick={resetFilters}
                  className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-sm text-gold transition-colors hover:bg-gold/20"
                >
                  <Filter className="size-4" /> {t("discover.resetFilters")}
                </button>
              ) : (
                <button
                  onClick={reshuffle}
                  className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-sm text-gold transition-colors hover:bg-gold/20"
                >
                  <Shuffle className="size-4" /> {t("discover.shuffle")}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="relative mb-4 max-w-md">
            <Search className="absolute top-2.5 left-3 size-4 text-ink-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("discover.searchPlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-noir-2 py-2.5 pr-4 pl-9 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-gold/50"
            />
          </div>
          {!database ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-shimmer h-32 rounded-xl" />
              ))}
            </div>
          ) : database.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-2">
              {t("discover.noResults")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {database.map((e, i) => (
                <div
                  key={e._id}
                  className="ln-card ln-stagger-item p-5"
                  style={{ "--ln-i": i } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                      {e.language} · {e.region}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[0.5625rem] uppercase ${
                        REGISTER_STYLES[e.register] ??
                        "border-white/10 text-ink-3"
                      }`}
                    >
                      {registerKey(e.register)
                        ? t(`registers.${registerKey(e.register)}`)
                        : e.register}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <p className="font-display text-xl italic">
                      {e.expression}
                    </p>
                    <SpeakButton text={e.expression} language={e.language} />
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{e.meaning}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-ink-3">
                    {e.context}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() =>
                        void (async () => {
                          try {
                            await toggleFavorite({ slangId: e._id as never });
                          } catch {
                            toast.error(t("errors.generic"));
                          }
                        })()
                      }
                      aria-pressed={favorites.has(e._id)}
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        favorites.has(e._id)
                          ? "border-gold/50 bg-gold/15 text-gold"
                          : "border-white/10 text-ink-3 hover:border-gold/30 hover:text-gold"
                      }`}
                      title={
                        favorites.has(e._id)
                          ? t("discover.favoriteRemove")
                          : t("discover.favoriteAdd")
                      }
                      aria-label={
                        favorites.has(e._id)
                          ? t("discover.favoriteRemove")
                          : t("discover.favoriteAdd")
                      }
                    >
                      <Heart
                        className={`size-3.5 ${favorites.has(e._id) ? "fill-current" : ""}`}
                      />
                    </button>
                    <button
                      onClick={() =>
                        void (async () => {
                          try {
                            const res = await addToSrs({ slangId: e._id as never });
                            if (res?.ok) {
                              toast.success(
                                t("discover.addedSrs", { e: e.expression }),
                              );
                              await recordSession({
                                language: e.language as LanguageCode,
                                kind: "discovery",
                                durationSeconds: 25,
                                itemsLearned: 1,
                              });
                            } else {
                              toast.info(t("discover.alreadyDeck"));
                            }
                          } catch {
                            toast.error(t("errors.generic"));
                          }
                        })()
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs text-gold transition-colors hover:bg-gold/20"
                    >
                      <Brain className="size-3.5" /> {t("discover.addToSrs")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
