import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, Loader2, Rss, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MediaCard } from "./MediaCard";
import { LANGS, type Content, type Kind } from "@/openverse/model";
import { cn, friendlyError } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   RAYON — surface de découverte unifiée d'un type de contenu

   Un rayon ne dépend d'aucun connecteur en particulier : il demande au
   moteur « donne-moi du Films & vidéos, trié par nouveauté », et le moteur
   va voir tous les connecteurs compatibles. Ajouter une source ne modifie
   donc jamais ce composant.

   Trois manières d'entrer dans un rayon :
     · ouvrir (aucune requête)  → `browseLive` : nouveautés / tendances ;
     · filtrer (pays, langue, tri, type) → rejoue `browseLive` paramétré ;
     · chercher (mots-clés)     → `searchUniversal`.
   ═══════════════════════════════════════════════════════════════════════ */

export type SortKey = "new" | "popular" | "trending";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "new", label: "Plus récents" },
  { key: "popular", label: "Tendances" },
  { key: "trending", label: "À lire ici d'abord" },
];

/** Fenêtre du filtre « Nouveautés » : contenus publiés il y a moins d'un an. */
const NEW_WINDOW_MS = 365 * 86_400_000;

/** Volume affiché par page : « Charger plus » ajoute une page entière. */
const PAGE_SIZE = 100;
/** Seuil « clip court » : moins de 4 minutes. */
const SHORT_MAX_S = 240;

function Chip({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
        active
          ? "border-gold/60 bg-gold/10 font-medium text-gold"
          : "border-white/10 bg-noir text-ink-2 hover:border-gold/40 hover:text-gold",
      )}
    >
      {children}
    </button>
  );
}

function Grid({
  items,
  favorites,
  onOpen,
  onFavorite,
  loading,
}: {
  items: Content[];
  favorites?: string[];
  onOpen: (c: Content) => void;
  onFavorite?: (c: Content) => void;
  loading?: boolean;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="ln-stagger-item aspect-[2/3] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
            style={{ ["--ln-i" as string]: i }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item, i) => (
        <MediaCard
          key={item.key}
          content={item}
          index={i}
          favorite={favorites?.includes(item.key)}
          onOpen={onOpen}
          onToggleFavorite={onFavorite}
        />
      ))}
    </div>
  );
}

/* ── Ajout d'un flux (podcast, blog, créateur) ──────────────────────── */

function FeedBar({ onItems }: { onItems: (items: Content[]) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = useAction(api.ovSearch.previewFeed);

  const submit = async () => {
    const value = url.trim();
    if (!/^https?:\/\//i.test(value)) {
      toast.error("Colle l'URL complète d'un flux RSS ou Atom.");
      return;
    }
    setBusy(true);
    try {
      const items = (await preview({ feedUrl: value, limit: 24 })) as unknown as Content[];
      if (!items.length) {
        toast.error("Ce flux ne contient aucun élément exploitable.");
        return;
      }
      onItems(items);
      toast.success(`${items.length} élément(s) lus dans le flux.`);
    } catch (err) {
      toast.error(friendlyError(err, "Flux illisible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-noir p-3 sm:flex-row sm:items-center">
      <span className="flex items-center gap-2 text-xs text-ink-2">
        <Rss className="size-3.5 text-gold" /> Ajouter un flux
      </span>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://exemple.com/feed.xml"
        aria-label="URL du flux RSS ou Atom"
        className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-ink outline-none placeholder:text-ink-3 focus:border-gold/50"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gold/15 px-3 text-xs font-semibold text-gold disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        Lire le flux
      </button>
    </div>
  );
}

/* ── Le rayon ───────────────────────────────────────────────────────── */

export function Rayon({
  kinds,
  title,
  subtitle,
  suggestions = [],
  allowFeed = false,
  searchPlaceholder,
  language,
}: {
  kinds: Kind[];
  title: string;
  subtitle: string;
  suggestions?: string[];
  allowFeed?: boolean;
  searchPlaceholder?: string;
  /** Langue d'apprentissage : sert de filtre par défaut côté connecteurs. */
  language?: string;
}) {
  const [sort, setSort] = useState<SortKey>("new");
  const [newOnly, setNewOnly] = useState(false);
  const [country, setCountry] = useState("");
  const [lang, setLang] = useState(language ?? "");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Content[]>([]);
  const [live, setLive] = useState(false);
  // Clic carte = navigation vers la fiche pleine page (scroll et filtres
  // conservés par l'historique du navigateur au retour).
  const navigate = useNavigate();
  const openDetail = useCallback(
    (c: Content) => navigate(`/app/content/${encodeURIComponent(c.key)}`),
    [navigate],
  );
  /** Une recherche ou un flux « épingle » son résultat : on n'affiche alors
   *  plus le repli sur le catalogue, pour que « aucun résultat » soit vrai. */
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failures, setFailures] = useState<{ source: string; error: string }[]>([]);
  /** Nombre de résultats affichés (le reste arrive par « Charger plus »). */
  const [visible, setVisible] = useState(PAGE_SIZE);
  /** Filtre « clips courts » du rayon Vidéos (< 4 minutes). */
  const [shortsOnly, setShortsOnly] = useState(false);

  const browseLive = useAction(api.ovSearch.browseLive);
  const searchUniversal = useAction(api.ovSearch.searchUniversal);
  // Filtre « Nouveautés » : figé au montage (et au re-basculement) pour que
  // la requête Convex reste stable — jamais `Date.now()` à chaque rendu.
  const newerThan = useMemo(
    () => (newOnly ? Date.now() - NEW_WINDOW_MS : undefined),
    [newOnly],
  );

  // Repli hors ligne : le catalogue déjà indexé s'affiche même si aucune
  // source externe ne répond (Convex reste réactif et gratuit à lire).
  const fallback = useQuery(api.ovSearch.browse, {
    kindIn: kinds,
    limit: 24,
    sort: sort === "new" ? "new" : "popular",
    newerThan,
  });
  const facets = useQuery(api.ovSearch.facets);
  const favorites = useQuery(api.ovLibrary.favoriteKeys);
  const toggleFavorite = useMutation(api.ovLibrary.toggleFavorite);

  const kindsKey = kinds.join(",");

  const load = useCallback(async () => {
    setLoading(true);
    setFailures([]);
    setVisible(PAGE_SIZE);
    try {
      const res = await browseLive({
        kinds,
        sort,
        newerThan,
        country: country || undefined,
        lang: lang || undefined,
        limit: 48,
      });
      setItems(res.items as unknown as Content[]);
      setLive(res.items.length > 0);
      setFailures(res.failures as { source: string; error: string }[]);
    } catch {
      setFailures([{ source: "moteur", error: "Indisponible pour le moment." }]);
    } finally {
      setLoading(false);
    }
  }, [browseLive, country, kinds, lang, sort, newerThan]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, country, lang, kindsKey, newerThan]);

  const runSearch = async (term?: string) => {
    const q = (term ?? query).trim();
    if (q.length < 2) return;
    setQuery(q);
    setLoading(true);
    setFailures([]);
    setVisible(PAGE_SIZE);
    try {
      const res = await searchUniversal({
        query: q,
        // Rayon mono-type : la source est interrogée en mode massif
        // (des centaines de résultats par connecteur).
        kind: kinds.length === 1 ? kinds[0] : undefined,
        limit: 300,
        newerThan,
        country: country || undefined,
        lang: lang || undefined,
        sort: sort === "new" ? "new" : sort === "popular" ? "popular" : undefined,
      });
      // Un rayon ne montre que ses propres types : le moteur, lui, cherche partout.
      const filtered = (res.items as unknown as Content[]).filter((item) => kinds.includes(item.kind));
      setItems(filtered);
      setPinned(true);
      setLive(true);
      setFailures(res.failures as { source: string; error: string }[]);
    } catch {
      setFailures([{ source: "recherche", error: "Indisponible pour le moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const favouriteKeys = useMemo(() => favorites ?? [], [favorites]);
  const fallbackRows = (fallback ?? []) as unknown as Content[];
  const raw = pinned ? items : items.length ? items : fallbackRows;
  // « Clips courts » : on ne garde que les moins de 4 minutes (la durée
  // vient de la source ; les fiches sans durée ne sont pas filtrées).
  const pool = shortsOnly ? raw.filter((c) => c.duration && c.duration < SHORT_MAX_S) : raw;
  const shown = useMemo(() => pool.slice(0, visible), [pool, visible]);
  const moreAvailable = pool.length > shown.length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</p>
      </header>

      {/* Barre de recherche du rayon : elle interroge tous les connecteurs. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? "Rechercher un titre, un artiste, un auteur…"}
            aria-label="Rechercher"
            className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 text-sm font-medium text-noir disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
        </button>
      </form>

      {/* Tri & filtres : Nouveautés / Tendances / pays / langue. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
          <SlidersHorizontal className="size-3" /> tri
        </span>
        {SORTS.map((s) => (
          <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>
            {s.label}
          </Chip>
        ))}
        <Chip active={newOnly} onClick={() => setNewOnly((v) => !v)} title="Contenus publiés il y a moins de 12 mois">
          ✨ Moins d'un an
        </Chip>
        {kinds.includes("video") && (
          <Chip active={shortsOnly} onClick={() => setShortsOnly((v) => !v)} title="Les moins de 4 minutes">
            ⚡ Clips courts
          </Chip>
        )}
        <span className="mx-1 h-4 w-px bg-white/10" />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label="Langue du contenu"
          className="h-8 rounded-full border border-white/10 bg-noir px-3 text-xs text-ink-2"
        >
          <option value="">Toutes langues</option>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
      </div>

      {allowFeed && (
        <FeedBar
          onItems={(feedItems) => {
            setItems(feedItems);
            setPinned(true);
            setLive(true);
          }}
        />
      )}

      {failures.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-[0.6875rem] text-amber-200">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5" /> Certaines sources n'ont pas répondu
          </p>
          <p className="mt-1 text-amber-200/80">
            Le reste du rayon reste affiché. Reviens dans un instant pour compléter la sélection.
          </p>
        </div>
      )}

      {!live && shown.length > 0 && (
        <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
          {shown.length} contenu(s) enregistré(s)
        </p>
      )}

      {pool.length > 0 && (
        <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
          {pool.length} résultat(s){moreAvailable ? ` · ${pool.length - shown.length} à charger` : ""}
        </p>
      )}

      <Grid
        items={shown}
        loading={loading}
        favorites={favouriteKeys}
        onOpen={openDetail}
        onFavorite={(c) => void toggleFavorite({ contentKey: c.key })}
      />

      {moreAvailable && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-xl border border-gold/40 bg-gold/10 px-6 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
          >
            Charger plus ({pool.length - shown.length} restant(s))
          </button>
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="ln-card p-8 text-center">
          <p className="font-display text-lg text-ink">Rien à afficher pour ce filtre</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-2">
            Essaie un autre pays, une autre langue, ou lance une recherche : la
            sélection interroge toutes les sources disponibles.
          </p>
          {suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <Chip key={s} onClick={() => void runSearch(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
