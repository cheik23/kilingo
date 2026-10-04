import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router";
import {
  BookOpen,
  Brain,
  Compass,
  Globe,
  Heart,
  Languages,
  Loader2,
  Map as MapIcon,
  Mic,
  Music2,
  Network,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { registerKey } from "@/convex/languages";
import { MediaCard } from "@/components/openverse/MediaCard";
import { LANGS, langLabel, type Content } from "@/openverse/model";
import { SpeakButton } from "./SpeakButton";
import { PlaceEmpty, PlaceHeader } from "@/components/fx/PlaceHeader";
import { Card3D } from "@/components/fx/Card3D";
import { normWord, resolveInLang, type LocalizedEntry } from "@/lib/dictionary";
import {
  loadDefLang,
  saveDefLang,
  UI_LANGS,
  uiLangMeta,
  useI18n,
  type UiLang,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLocalizedText } from "@/lib/translate";

/* ═══════════════════════════════════════════════════════════════════
   ATLAS — Recherche + Ponts culturels dans une seule page.

   Deux modes : RECHERCHE (défaut — base d'expressions, dictionnaire
   dynamique, contenus) et EXPLORATION (concepts culturels multi-langues).
   Un mot qui appartient à un concept fait apparaître l'encart « Pont
   culturel » en tête des résultats ; chaque chip bascule vers cette
   expression. Thème or/noir (ln-card, text-gold, bg-noir), zéro crash
   sur données vides : hooks toujours inconditionnels, fallbacks partout.
   ═══════════════════════════════════════════════════════════════════ */

/** Déduit la langue d'un terme non latin depuis son écriture. */
function guessLang(q: string): string {
  for (const ch of q) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x4e00 && cp <= 0x9fff) return "zh";
    if (cp >= 0x0600 && cp <= 0x06ff) return "ar";
    if (cp >= 0x0400 && cp <= 0x04ff) return "ru";
    if (cp >= 0x3040 && cp <= 0x30ff) return "ja";
    if (cp >= 0xac00 && cp <= 0xd7af) return "ko";
  }
  return "en";
}

const SLANG_REGISTERS = new Set(["street", "vulgar", "internet"]);

/**
 * Une phrase de contexte est RÉELLE (jamais un libellé d'import type
 * « Importé depuis Urban Dictionary ») — sinon la section est masquée.
 */
function isRealSentence(s: string | undefined): s is string {
  const t = (s ?? "").trim();
  if (t.length < 12) return false;
  if (/^Importé depuis/.test(t)) return false;
  return /\s/.test(t) || t.length > 25;
}

/** Sections de contenus : un onglet mental par usage. */
const CONTENT_GROUPS: {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  kinds: string[];
}[] = [
  { key: "screen", label: "Films & vidéos", icon: Sparkles, kinds: ["movie", "series", "video"] },
  { key: "music", label: "Musiques", icon: Music2, kinds: ["music"] },
  { key: "books", label: "Livres", icon: BookOpen, kinds: ["book"] },
  { key: "talk", label: "Podcasts & audio", icon: Mic, kinds: ["podcast", "audio"] },
];

type SlangRow = {
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
  meaningLang?: string;
};

/* ── Blocs de la fiche du mot recherché ───────────────────────────── */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/5 py-3 first:border-0 first:pt-0">
      <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/** Carte compacte d'une expression touchée par la recherche. */
function ExpressionCard({
  row,
  favorite,
  onFavorite,
  onLearn,
  onPick,
}: {
  row: SlangRow;
  favorite: boolean;
  onFavorite: () => void;
  onLearn: () => void;
  onPick: () => void;
}) {
  const { t } = useI18n();
  const lang = LANGS.find((l) => l.code === row.language);
  const rk = registerKey(row.register);
  return (
    <div className="ln-card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onPick}
          className="min-w-0 text-left font-display text-lg italic text-ink hover:text-gold"
        >
          {row.expression}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onFavorite}
            aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={favorite}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border transition-colors",
              favorite
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-white/10 text-ink-3 hover:border-gold/30 hover:text-gold",
            )}
          >
            <Heart className={cn("size-3.5", favorite && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={onLearn}
            aria-label="Ajouter à ma mémoire"
            className="flex size-7 items-center justify-center rounded-full border border-white/10 text-ink-3 transition-colors hover:border-gold/30 hover:text-gold"
          >
            <Brain className="size-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-2">{row.meaning}</p>
      {row.context && (
        <p className="mt-1.5 line-clamp-2 text-xs text-ink-3">{row.context}</p>
      )}
      <p className="mt-3 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        {lang?.flag ?? "🌐"} {row.region} · {rk ? t(`registers.${rk}`) : row.register}
      </p>
    </div>
  );
}

/* ── Sélecteur de langue cible (12 langues, drapeaux) ─────────────── */

function DefLangSelect({
  value,
  onPick,
  ariaLabel,
}: {
  value: UiLang;
  onPick: (l: UiLang) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-noir-2 px-3.5 font-mono text-xs font-semibold text-gold transition-colors hover:border-gold/40"
      >
        <Languages className="size-4" />
        <span aria-hidden>{uiLangMeta(value).flag}</span>
        {value.toUpperCase()}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute end-0 top-14 z-50 max-h-80 w-44 overflow-auto rounded-xl border border-white/10 bg-noir-2 p-1 shadow-2xl">
            {UI_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  onPick(l);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                  l === value
                    ? "bg-gold/10 text-gold"
                    : "text-ink-2 hover:bg-gold/10 hover:text-gold"
                }`}
              >
                <span aria-hidden>{uiLangMeta(l).flag}</span>
                <span className="flex-1 text-start">{uiLangMeta(l).native}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE ATLAS
   ═══════════════════════════════════════════════════════════════════ */

export function Atlas() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  // Mode : une recherche active (q) force Recherche ; sinon `mode=explore`.
  const mode: "search" | "explore" =
    query.length > 0 || params.get("mode") !== "explore" ? "search" : "explore";

  const [draft, setDraft] = useState(query);
  const setMode = useCallback(
    (m: "search" | "explore") => {
      const next = new URLSearchParams(params);
      if (m === "explore") next.set("mode", "explore");
      else next.delete("mode");
      setParams(next);
    },
    [params, setParams],
  );

  // Langue cible : traduction des définitions ET filtre rapide des ponts.
  const [defLang, setDefLangState] = useState<UiLang>(loadDefLang);
  const setDefLang = useCallback((l: UiLang) => {
    setDefLangState(l);
    saveDefLang(l);
  }, []);

  /* ── Ponts culturels : seed idempotent + lecture ─────────────────── */
  const seedCross = useMutation(api.crossSeed.seedCrossConcepts);
  useEffect(() => {
    void seedCross({}).catch(() => undefined);
  }, [seedCross]);
  const recordActivity = useMutation(api.achievements.recordActivity);
  const crossConcepts = useQuery(api.crossSeed.getCrossConcepts, {});
  useEffect(() => {
    if (query.trim().length >= 2) void recordActivity({ metric: "atlas:uses" });
  }, [query, recordActivity]);
  useEffect(() => {
    if (mode === "explore" && crossConcepts && crossConcepts.length > 0) {
      void recordActivity({ metric: "cross:uses" });
    }
  }, [crossConcepts, mode, recordActivity]);

  /* ── Suggestions populaires (recherche vide) ─────────────────────── */
  const trending = useQuery(api.slang.trending, { limit: 10 });

  /* ── RECHERCHE : état (repris de SearchPage) ─────────────────────── */
  const [dict, setDict] = useState<LocalizedEntry | null | undefined>(undefined);
  const [loadingDict, setLoadingDict] = useState(false);
  const [addingDyn, setAddingDyn] = useState(false);

  const [items, setItems] = useState<Content[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  const localRows = useQuery(
    api.slang.searchLocal,
    query.length >= 2 ? { query, limit: 20 } : "skip",
  ) as SlangRow[] | undefined;

  const favoriteIds = useQuery(api.favorites.favoriteSlangIds);
  const toggleFavorite = useMutation(api.favorites.toggleSlangFavorite);
  const addToSrs = useMutation(api.learning.addToSrs);

  /* ── Dictionnaire dynamique (mots HORS base) ──────────────────────
     Appelé UNIQUEMENT quand la base locale n'a rien : la cascade de
     traduction et l'Urban Dictionary prennent alors le relais.          */
  const lookupDynamic = useAction(api.dynamicDict.lookupDynamic);
  const addDynamicCard = useMutation(api.dynamicMemory.addDynamicCard);
  const [dyn, setDyn] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | {
        status: "done";
        origin: string;
        content: string;
        contentSrc?: string;
        example?: string;
        exampleTr?: string;
        meaningLang?: string;
      }
    | { status: "error" }
  >({ status: "idle" });

  useEffect(() => {
    // Le dictionnaire dynamique n'est appelé qu'une fois la base locale
    // RÉELLEMENT répondu (localRows défini) — sinon on attend sa réponse.
    if (query.length < 2) {
      setDyn({ status: "idle" });
      return;
    }
    if (localRows === undefined) return;
    if (localRows.length > 0) {
      setDyn({ status: "idle" });
      return;
    }
    let cancelled = false;
    setDyn({ status: "loading" });
    lookupDynamic({ text: query, targetLang: defLang })
      .then((res) => {
        if (!cancelled)
          setDyn({
            status: "done",
            origin: res.origin,
            content: res.content,
            contentSrc: res.contentSrc,
            example: res.example,
            exampleTr: res.exampleTr,
            meaningLang: res.meaningLang,
          });
      })
      .catch(() => {
        if (!cancelled) setDyn({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [query, defLang, localRows, lookupDynamic]);

  const searchUniversal = useAction(api.ovSearch.searchUniversal);

  const favoriteKeys = useQuery(api.ovLibrary.favoriteKeys);
  const toggleContentFavorite = useMutation(api.ovLibrary.toggleFavorite);

  // Le terme est recherché à la fois dans la base et dans les sources.
  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    if (query.length < 2) {
      setDict(undefined);
      setLoadingDict(false);
      return;
    }
    let cancelled = false;
    setLoadingDict(true);
    resolveInLang(query, guessLang(query), defLang)
      .then((entry) => {
        if (!cancelled) setDict(entry);
      })
      .catch(() => {
        if (!cancelled) setDict(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDict(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, defLang]);

  useEffect(() => {
    if (query.length < 2) {
      setItems([]);
      setLoadingContent(false);
      return;
    }
    let cancelled = false;
    setLoadingContent(true);
    searchUniversal({ query, limit: 200 })
      .then((res) => {
        if (!cancelled) setItems(res.items as unknown as Content[]);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, searchUniversal]);

  const favorites = useMemo(() => new Set(favoriteIds ?? []), [favoriteIds]);

  // Clic carte = fiche pleine page ; la recherche (filtres + scroll) est
  // conservée par l'historique au retour.
  const openDetail = useCallback(
    (c: Content) => navigate(`/app/content/${encodeURIComponent(c.key)}`),
    [navigate],
  );

  const run = useCallback(
    (term: string) => {
      const value = term.trim();
      if (value.length < 2) return;
      // `q` présent ⇒ mode Recherche automatique (le paramètre `mode` saute).
      setParams({ q: value });
    },
    [setParams],
  );

  /* ── ENCART PONT CULTUREL : le mot appartient à un concept ? ─────── */
  const bridge = useMemo(() => {
    if (query.length < 2 || !crossConcepts) return null;
    const qn = normWord(query);
    if (!qn) return null;
    return (
      crossConcepts.find((c) => c.entries.some((e) => normWord(e.expr) === qn)) ??
      null
    );
  }, [query, crossConcepts]);

  /* ── Partition réelle des expressions touchées ──────────────────── */
  const words = (localRows ?? []).filter(
    (r) => !r.expression.includes(" ") && !SLANG_REGISTERS.has(r.register),
  );
  const expressions = (localRows ?? []).filter((r) => r.expression.includes(" "));
  const slangs = (localRows ?? []).filter((r) => SLANG_REGISTERS.has(r.register));

  /* ── Capture 1 clic : mot hors base → carte SRS (+ entrée slang) ── */
  const onAddDynamic = () => {
    if (dyn.status !== "done" || !dyn.content) return;
    void (async () => {
      setAddingDyn(true);
      try {
        const res = await addDynamicCard({
          text: query,
          // La définition stockée est celle de la SOURCE (UD « en ») — la
          // traduction est refaite à la demande vers la langue cible.
          definition: dyn.origin === "urban" ? (dyn.contentSrc ?? dyn.content) : dyn.content,
          targetLang: defLang,
          origin: dyn.origin,
          // Exemple réel persisté dans context pour les prochaines fois.
          ...(isRealSentence(dyn.example) ? { example: dyn.example } : {}),
        });
        if (res?.ok && res.reason === "already") {
          toast.info("Déjà dans ta mémoire");
        } else if (res?.ok) {
          toast.success(
            res.storedExample
              ? `Ajouté à ta mémoire ! +${res.xpGain} XP · exemple conservé`
              : `Ajouté à ta mémoire ! +${res.xpGain} XP`,
          );
        } else {
          toast.error("Impossible d'ajouter ce terme.");
        }
      } catch {
        toast.error("Impossible d'ajouter à ta mémoire.");
      } finally {
        setAddingDyn(false);
      }
    })();
  };

  /* ── Le mot recherché : base locale d'abord, dictionnaire ensuite ─ */
  const head = useMemo(() => {
    const first = (localRows ?? [])[0];
    if (first) {
      // resolveInLang a déjà traduit le sens de la base vers la langue cible
      // quand elle couvre la même expression : on l'affiche, sinon sens brut.
      const localized =
        dict && normWord(dict.entry.expression) === normWord(first.expression)
          ? dict.entry.meaning
          : undefined;
      return {
        expression: first.expression,
        literal: first.literal,
        meaning: localized ?? first.meaning,
        example: undefined as string | undefined,
        // Phrase de contexte RÉELLE uniquement (jamais un libellé d'import).
        context: isRealSentence(first.context) ? first.context : undefined,
        // Langue du sens stocké : "en" pour les imports UD, "fr" base seedée.
        meaningLang: first.meaningLang ?? "fr",
        register: first.register,
        region: first.region,
        language: first.language,
        fromBase: true,
      };
    }
    if (!dict) return null;
    return {
      expression: dict.entry.expression || query,
      literal: undefined,
      meaning: dict.entry.meaning,
      example: dict.entry.example,
      context: dict.entry.context,
      // UD répond en anglais ; les sources locales en français ; wiki dans
      // la langue de la requête (approximée par l'écriture du terme).
      meaningLang:
        dict.entry._src === "ud" ? "en" : dict.entry._src === "local" ? "fr" : guessLang(query),
      register: dict.entry.register,
      region: dict.entry.region,
      language: undefined,
      fromBase: false,
    };
  }, [localRows, dict, query]);

  // Langue du terme : celle de la base quand elle est connue, sinon l'écriture.
  const headLang = head?.language ?? (head ? guessLang(head.expression) : guessLang(query));

  /* ── A2 : le sens ET la phrase de contexte suivent la langue cible ──
     Traduction à la volée (cascade client MyMemory, cache 24 h) quand la
     langue stockée diffère de la cible ; skeleton pendant le chargement,
     texte original conservé en repli (italique gris).                  */
  const headSourceLang = head?.meaningLang ?? "fr";
  const headMeaning = useLocalizedText(head?.meaning, headSourceLang, defLang);
  const exampleRaw = head && isRealSentence(head.example) ? head.example : undefined;
  const contextRaw = head && !exampleRaw && isRealSentence(head.context) ? head.context : undefined;
  const headExample = useLocalizedText(exampleRaw, headLang, defLang);
  const headContext = useLocalizedText(contextRaw, headLang, defLang);
  const exampleOriginal = exampleRaw ?? contextRaw;
  const exampleTranslated = (contextRaw ? headContext.value : headExample.value) ?? undefined;
  const headLangMeta = LANGS.find((l) => l.code === headLang);
  const targetMeta = LANGS.find((l) => l.code === defLang);
  const defLangName = LANGS.find((l) => l.code === defLang)?.label ?? defLang;

  const loading = (loadingDict || loadingContent) && !head;

  const contentGroups = CONTENT_GROUPS.map((group) => ({
    ...group,
    // Règle du Hub : un contenu qui ne se lit pas ici n'est PAS affiché —
    // pas de fiche morte (flux, extrait ou lecteur intégré requis).
    items: items.filter(
      (item) =>
        group.kinds.includes(item.kind) &&
        Boolean(item.streamUrl || item.textUrl || item.body || item.previewUrl || item.embedUrl || item.rssUrl),
    ),
  })).filter((group) => group.items.length > 0);

  const onFavoriteSlang = (row: SlangRow) => {
    void (async () => {
      try {
        const res = await toggleFavorite({ slangId: row._id as never });
        toast.success(res.favorite ? "Ajouté aux favoris" : "Retiré des favoris");
      } catch {
        toast.error("Impossible de mettre à jour tes favoris.");
      }
    })();
  };

  const onLearnSlang = (row: SlangRow) => {
    void (async () => {
      try {
        const res = await addToSrs({ slangId: row._id as never });
        toast[res?.ok ? "success" : "info"](
          res?.ok ? `« ${row.expression} » ajouté à ta mémoire` : "Déjà dans ta mémoire",
        );
      } catch {
        toast.error("Impossible d'ajouter à ta mémoire.");
      }
    })();
  };

  /* ══ EXPLORATION : état des ponts culturels ═══════════════════════ */
  const [filterLangs, setFilterLangs] = useState<Set<string>>(new Set());
  const [insightIdx, setInsightIdx] = useState(0);

  const ranked = useMemo(() => {
    if (!crossConcepts) return [];
    return [...crossConcepts]
      .filter((c) => c.entries.length > 0)
      .sort((a, b) => b.entries.length - a.entries.length || a.slug.localeCompare(b.slug));
  }, [crossConcepts]);

  useEffect(() => {
    if (mode !== "explore" || ranked.length <= 1) return;
    const id = setInterval(() => {
      setInsightIdx((i) => (i + 1) % ranked.length);
    }, 5000);
    return () => clearInterval(id);
  }, [mode, ranked.length]);

  const availableLangs = useMemo(() => {
    if (!crossConcepts) return [];
    const counts = new Map<string, number>();
    for (const c of crossConcepts) {
      for (const e of c.entries) {
        counts.set(e.lang, (counts.get(e.lang) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([lang]) => lang);
  }, [crossConcepts]);

  const totalEntries = useMemo(
    () => (crossConcepts ?? []).reduce((a, c) => a + c.entries.length, 0),
    [crossConcepts],
  );

  const visible = useMemo(() => {
    if (!crossConcepts) return [];
    if (filterLangs.size === 0) return crossConcepts;
    return crossConcepts
      .map((c) => ({
        ...c,
        entries: c.entries.filter((e) => filterLangs.has(e.lang)),
      }))
      .filter((c) => c.entries.length > 0);
  }, [crossConcepts, filterLangs]);

  const toggleLang = (lang: string) => {
    setFilterLangs((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  };

  // Le sélecteur de langue cible sert aussi à filtrer les ponts.
  const pickLangForBridges = (l: UiLang) => {
    setDefLang(l);
    setFilterLangs(new Set([l]));
  };

  const insight = ranked[insightIdx];

  const flagOf = (lang: string) => LANGS.find((l) => l.code === lang)?.flag ?? uiLangMeta(lang as UiLang)?.flag ?? "🌐";

  return (
    <div className="space-y-6">
      {/* ── En-tête du lieu « La Carte » + toggle Recherche ↔ Exploration ── */}
      <PlaceHeader
        place="atlas"
        title={t("atlas.title")}
        icon={MapIcon}
        motif="adinkra"
        description={t("atlas.subtitle")}
        actions={
          <div
            role="tablist"
            aria-label={t("atlas.toggle")}
            className="flex rounded-xl border border-white/10 bg-noir-2 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "search"}
              onClick={() => setMode("search")}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                mode === "search"
                  ? "bg-gradient-to-r from-gold-strong to-gold text-noir"
                  : "text-ink-2 hover:text-gold",
              )}
            >
              {t("atlas.search")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "explore"}
              onClick={() => setMode("explore")}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                mode === "explore"
                  ? "bg-gradient-to-r from-gold-strong to-gold text-noir"
                  : "text-ink-2 hover:text-gold",
              )}
            >
              {t("atlas.explore")}
            </button>
          </div>
        }
      />

      {/* ════ MODE RECHERCHE ═════════════════════════════════════════ */}
      {mode === "search" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(draft);
            }}
            className="flex flex-wrap gap-2 sm:flex-nowrap"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="bonjour, finna, jazz, Sherlock Holmes…"
                aria-label={t("atlas.search")}
                className="h-12 w-full rounded-xl border border-white/10 bg-noir-2 ps-11 pe-4 text-base text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
              />
            </div>
            <DefLangSelect value={defLang} onPick={setDefLang} ariaLabel="Traduire vers" />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 text-sm font-semibold text-noir"
            >
              {t("atlas.search")}
            </button>
          </form>

          {query.length < 2 ? (
            /* ── Suggestions populaires (top expressions) ─────────────── */
            <div className="ln-card p-6">
              <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                {t("atlas.popular")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {trending === undefined
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-9 w-28 animate-pulse rounded-full bg-white/5"
                      />
                    ))
                  : trending.map((row) => {
                      const flag = LANGS.find((l) => l.code === row.language)?.flag ?? "🌐";
                      return (
                        <button
                          key={row._id}
                          type="button"
                          onClick={() => run(row.expression)}
                          className="rounded-full border border-white/10 bg-noir px-3.5 py-2 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                        >
                          <span aria-hidden className="me-1">{flag}</span>
                          {row.expression}
                        </button>
                      );
                    })}
              </div>
            </div>
          ) : (
            <>
              {/* ── ENCART PONT CULTUREL (le mot appartient à un concept) ─ */}
              {bridge && (
                <div className="ln-card border-gold/30 p-4">
                  <p className="flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
                    <Network className="size-3.5" /> {t("atlas.culturalBridge")}
                  </p>
                  <p className="mt-1.5 text-sm text-ink-2">
                    {t("bridges.insightWord", { count: bridge.entries.length })} —{" "}
                    <span className="font-semibold text-gold">{bridge.labelFr}</span>
                    <span className="text-ink-3"> · {bridge.labelEn}</span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {bridge.entries.map((e) => (
                      <button
                        key={`${e.lang}:${e.expr}`}
                        type="button"
                        onClick={() => run(e.expr)}
                        title={e.gloss}
                        className={cn(
                          "group rounded-xl border px-2.5 py-1.5 text-xs transition-colors",
                          normWord(e.expr) === normWord(query)
                            ? "border-gold/50 bg-gold/10 text-gold"
                            : "border-white/10 bg-noir-2 text-ink-2 hover:border-gold/50 hover:text-gold",
                        )}
                      >
                        <span aria-hidden className="me-1">{flagOf(e.lang)}</span>
                        <span className="font-semibold">{e.expr}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── MOT RECHERCHÉ ─────────────────────────────────────── */}
              <section className="ln-card p-5 sm:p-6">
                <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
                  {t("atlas.search")}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <h2 className="font-display text-4xl leading-tight font-semibold italic text-ink">
                    {head?.expression ?? query}
                  </h2>
                  <SpeakButton text={head?.expression ?? query} language={headLang} size="lg" />
                </div>

                {/* La langue reste visible, quoi qu'affiche la traduction. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[0.6875rem] text-gold">
                    <Languages className="size-3.5" />
                    Langue : {headLangMeta?.flag ?? "🌐"} {langLabel(headLang)}
                  </span>
                  {head?.register && (
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[0.6875rem] text-ink-2">
                      Registre : {registerKey(head.register)
                        ? t(`registers.${registerKey(head.register)}`)
                        : head.register}
                    </span>
                  )}
                  {head?.region && (
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[0.6875rem] text-ink-2">
                      Région : {head.region}
                    </span>
                  )}
                </div>

                {/* ── RÉSULTAT HORS BASE (dictionnaire dynamique) ────────── */}
                {dyn.status === "loading" && (
                  <p className="mt-5 flex items-center gap-2 text-sm text-ink-3">
                    <Loader2 className="size-4 animate-spin" /> Recherche élargie pour « {query} »…
                  </p>
                )}
                {dyn.status === "done" && dyn.content && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-noir p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6875rem] text-ink-2">
                        <Globe className="size-3.5" />
                        Hors base
                      </span>
                      <button
                        type="button"
                        onClick={onAddDynamic}
                        disabled={addingDyn}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-strong to-gold px-3.5 py-1.5 text-xs font-semibold text-noir transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {addingDyn ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Brain className="size-3.5" />
                        )}
                        {t("atlas.addMemory")}
                      </button>
                    </div>
                    {dyn.origin === "urban" ? (
                      <div className="mt-3">
                        <p className="text-sm leading-relaxed text-ink-2">{dyn.content}</p>
                        {/* Définition originale en repli (italique gris). */}
                        {dyn.contentSrc && dyn.content !== dyn.contentSrc && (
                          <p className="mt-1 text-xs italic text-ink-3">
                            traduction indisponible — original : « {dyn.contentSrc} »
                          </p>
                        )}
                        {isRealSentence(dyn.example) && (
                          <div className="mt-2 space-y-1">
                            <p className="text-sm italic text-ink-3">« {dyn.example} »</p>
                            {dyn.exampleTr && dyn.exampleTr !== dyn.example && (
                              <p className="text-sm font-medium text-gold">« {dyn.exampleTr} »</p>
                            )}
                          </div>
                        )}
                        <p className="mt-2 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                          Définition Urban Dictionary
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-relaxed text-ink-2">
                        <span className="font-medium text-gold">{dyn.content}</span>
                      </p>
                    )}
                  </div>
                )}
                {dyn.status === "error" && (
                  <p className="mt-5 text-sm text-ink-3">
                    Recherche élargie indisponible pour « {query} » — réessaie plus tard.
                  </p>
                )}

                {loading ? (
                  <p className="mt-5 flex items-center gap-2 text-sm text-ink-3">
                    <Loader2 className="size-4 animate-spin" /> Recherche de « {query} »…
                  </p>
                ) : !head ? (
                  dyn.status === "done" && dyn.content ? null : (
                    <p className="mt-5 text-sm text-ink-2">
                      Aucune définition trouvée pour « {query} ». Essaie une orthographe
                      proche, ou cherche le mot dans une autre langue.
                    </p>
                  )
                ) : (
                  <div className="mt-5 grid gap-x-8 lg:grid-cols-2">
                    <div>
                      <Field label="Traduction">
                        {headMeaning.loading ? (
                          <span className="flex items-center gap-2 text-sm text-ink-3">
                            <Loader2 className="size-3.5 animate-spin" />
                            Traduction en cours…
                          </span>
                        ) : (
                          <span className="text-base font-medium text-gold">
                            {headMeaning.value}
                          </span>
                        )}
                        {/* Repli visible : texte original dans sa langue source. */}
                        {!headMeaning.loading && headSourceLang !== defLang && (
                          <span className="mt-1 block text-xs text-ink-3 italic">
                            traduction indisponible — original : « {head.meaning} »
                          </span>
                        )}
                        <span className="mt-1 block font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                          vers {targetMeta?.flag ?? "🌐"} {defLangName}
                        </span>
                        {head.literal && (
                          <span className="mt-1 block text-xs text-ink-3 italic">
                            littéralement : « {head.literal} »
                          </span>
                        )}
                      </Field>

                      <Field label="Prononciation">
                        <span className="flex flex-wrap items-center gap-2">
                          <SpeakButton text={head.expression} language={headLang} />
                          <span className="text-xs text-ink-3">
                            Écoute la prononciation, puis répète à voix haute.
                          </span>
                        </span>
                      </Field>

                      <Field label="Définition">
                        {head.meaning}
                      </Field>
                    </div>

                    <div>
                      <Field label="Exemples">
                        {exampleOriginal ? (
                          <span className="space-y-1.5">
                            {/* Phrase réelle en double : originale (gris) puis
                                traduite dans la cible (or), même cascade + cache. */}
                            <span className="block text-xs italic text-ink-3">
                              « {exampleOriginal} »
                            </span>
                            {exampleTranslated && headLang !== defLang && (
                              exampleTranslated !== exampleOriginal ? (
                                <span className="block text-sm font-medium text-gold">
                                  « {exampleTranslated} »
                                </span>
                              ) : (
                                <span className="block text-[0.6875rem] text-ink-3">
                                  traduction de l'exemple indisponible
                                </span>
                              )
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-3">
                            Aucun exemple disponible pour ce terme.
                          </span>
                        )}
                      </Field>

                      <Field label="Expressions">
                        {expressions.length > 0 ? (
                          <span className="flex flex-wrap gap-1.5">
                            {expressions.slice(0, 6).map((row) => (
                              <button
                                key={row._id}
                                type="button"
                                onClick={() => run(row.expression)}
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                              >
                                {row.expression}
                              </button>
                            ))}
                          </span>
                        ) : (
                          <span className="text-ink-3">
                            Aucune expression associée pour le moment.
                          </span>
                        )}
                      </Field>

                      <Field label="Argot & registre">
                        {head.register || slangs.length > 0 ? (
                          <span className="flex flex-wrap items-center gap-2">
                            {head.register && (
                              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.6875rem]">
                                {registerKey(head.register)
                                  ? t(`registers.${registerKey(head.register)}`)
                                  : head.register}
                              </span>
                            )}
                            {head.region && (
                              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.6875rem]">
                                {head.region}
                              </span>
                            )}
                            {slangs.length > 0 && (
                              <span className="text-xs text-ink-3">
                                {slangs.length} terme(s) d'argot dans les résultats
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-3">
                            Registre standard — pas d'argot identifié.
                          </span>
                        )}
                      </Field>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Mots ──────────────────────────────────────────────── */}
              {words.length > 0 && (
                <section>
                  <h3 className="font-mono text-xs tracking-widest text-ink-2 uppercase">
                    Mots
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {words.map((row) => (
                      <ExpressionCard
                        key={row._id}
                        row={row}
                        favorite={favorites.has(row._id)}
                        onFavorite={() => onFavoriteSlang(row)}
                        onLearn={() => onLearnSlang(row)}
                        onPick={() => run(row.expression)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Expressions ───────────────────────────────────────── */}
              {expressions.length > 0 && (
                <section>
                  <h3 className="font-mono text-xs tracking-widest text-ink-2 uppercase">
                    Expressions
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {expressions.map((row) => (
                      <ExpressionCard
                        key={row._id}
                        row={row}
                        favorite={favorites.has(row._id)}
                        onFavorite={() => onFavoriteSlang(row)}
                        onLearn={() => onLearnSlang(row)}
                        onPick={() => run(row.expression)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Slang ─────────────────────────────────────────────── */}
              {slangs.length > 0 && (
                <section>
                  <h3 className="font-mono text-xs tracking-widest text-ink-2 uppercase">
                    Slang
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {slangs.map((row) => (
                      <ExpressionCard
                        key={row._id}
                        row={row}
                        favorite={favorites.has(row._id)}
                        onFavorite={() => onFavoriteSlang(row)}
                        onLearn={() => onLearnSlang(row)}
                        onPick={() => run(row.expression)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Contenus associés, un type par section ────────────── */}
              {loadingContent && items.length === 0 && (
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[2/3] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                    />
                  ))}
                </section>
              )}

              {contentGroups.map((group) => (
                <section key={group.key}>
                  <h3 className="flex items-center gap-2 font-mono text-xs tracking-widest text-ink-2 uppercase">
                    <group.icon className="size-3.5 text-gold" />
                    {group.label}
                    <span className="text-ink-3">({group.items.length})</span>
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {group.items.map((item, i) => (
                      <MediaCard
                        key={item.key}
                        content={item}
                        index={i}
                        favorite={(favoriteKeys ?? []).includes(item.key)}
                        onOpen={openDetail}
                        onToggleFavorite={(c) => void toggleContentFavorite({ contentKey: c.key })}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {!loading &&
                words.length === 0 &&
                expressions.length === 0 &&
                slangs.length === 0 &&
                items.length === 0 && (
                  <PlaceEmpty
                    place="atlas"
                    icon={Compass}
                    motif="halftone"
                    action={
                      <p className="max-w-lg text-sm leading-relaxed text-ink-3">
                        Rien trouvé pour « {query} ». Essaie une orthographe proche,
                        un titre original, ou un autre type de contenu — la
                        recherche tolère les fautes et les langues différentes.
                      </p>
                    }
                  />
                )}
            </>
          )}
        </>
      )}

      {/* ════ MODE EXPLORATION ═══════════════════════════════════════ */}
      {mode === "explore" && (
        <>
          {/* ── Sélecteur de langue cible (filtre rapide des ponts) ──── */}
          <div className="flex flex-wrap items-center gap-2">
            <DefLangSelect
              value={defLang}
              onPick={pickLangForBridges}
              ariaLabel={t("atlas.filterLanguages")}
            />
            <span className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {t("atlas.filterLanguages")}
            </span>
          </div>

          {/* ── Bandeau insight (concept le plus riche d'abord) ──────── */}
          <header className="ln-card relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-8 -top-8 text-[7.5rem] opacity-[0.06]">
              🌍
            </div>
            <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
              {crossConcepts
                ? t("bridges.insight", {
                    concepts: crossConcepts.length,
                    languages: availableLangs.length,
                  })
                : t("bridges.loading")}
            </h2>
            {insight && (
              <p className="mt-2 max-w-2xl text-sm text-ink-2 transition-opacity">
                «{" "}
                <span className="font-semibold text-gold">{insight.labelFr}</span>{" "}
                » {t("bridges.insightWord", { count: insight.entries.length })} —{" "}
                {insight.entries
                  .slice(0, 4)
                  .map((e) => `${e.expr} (${flagOf(e.lang)})`)
                  .join(" · ")}
                {insight.entries.length > 4 ? " …" : ""}
              </p>
            )}
            <p className="mt-3 text-xs text-ink-3">{t("atlas.bridges")}</p>
          </header>

          {/* ── Filtres langues (multi-sélection) ────────────────────── */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterLangs(new Set())}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                filterLangs.size === 0
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-white/10 text-ink-3 hover:border-gold/40 hover:text-gold",
              )}
            >
              {t("atlas.resetFilters")}
            </button>
            {availableLangs.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLang(lang)}
                title={uiLangMeta(lang as UiLang)?.native ?? lang}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  filterLangs.has(lang)
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-white/10 text-ink-2 hover:border-gold/40 hover:text-gold",
                )}
              >
                {flagOf(lang)} {lang}
              </button>
            ))}
            {filterLangs.size > 0 && (
              <span className="ml-1 font-mono text-[0.625rem] text-ink-3">
                {visible.length}/{crossConcepts?.length ?? 0}
              </span>
            )}
          </div>

          {/* ── Grille de cartes concept — chip = recherche ──────────── */}
          {crossConcepts === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <PlaceEmpty
              place="atlas"
              icon={Compass}
              motif="halftone"
              action={
                <div>
                  <p className="font-display text-lg text-ink">{t("bridges.emptyTitle")}</p>
                  <p className="mt-1 text-sm text-ink-3">{t("bridges.emptyHint")}</p>
                  <button
                    type="button"
                    onClick={() => setFilterLangs(new Set())}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-gold/40 px-3.5 py-2 text-xs text-gold hover:bg-gold/10"
                  >
                    {t("atlas.resetFilters")}
                  </button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((c) => (
                <Card3D key={c.slug} className="ln-card flex flex-col p-4">
                  <header data-card3d-depth="25" className="mb-3">
                    <h3 className="font-display text-lg font-semibold text-gold">
                      {c.labelFr}
                    </h3>
                    <p className="text-xs text-ink-3">{c.labelEn}</p>
                  </header>
                  <div className="flex flex-wrap gap-1.5">
                    {c.entries.map((e) => (
                      <button
                        key={`${e.lang}:${e.expr}`}
                        type="button"
                        onClick={() => run(e.expr)}
                        title={`${e.expr} → ${t("atlas.search")}`}
                        className="group rounded-xl border border-white/10 bg-noir-2 px-2.5 py-1.5 text-left transition-colors hover:border-gold/50 hover:bg-gold/5"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm">{flagOf(e.lang)}</span>
                          <span className="text-sm font-semibold text-ink group-hover:text-gold">
                            {e.expr}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[0.625rem] leading-tight text-ink-3">
                          {e.gloss}
                        </span>
                      </button>
                    ))}
                  </div>
                </Card3D>
              ))}
            </div>
          )}

          {crossConcepts && (
            <p className="text-center font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {crossConcepts.length} concepts · {totalEntries} expressions ·{" "}
              {availableLangs.length} langues
            </p>
          )}
        </>
      )}
    </div>
  );
}
