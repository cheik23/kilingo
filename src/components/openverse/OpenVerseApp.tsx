import { useCallback, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  Clapperboard,
  Compass,
  Heart,
  History,
  Home,
  Library,
  LogOut,
  Mic,
  Music2,
  Newspaper,
  Podcast,
  Search,
  Settings2,
  Tv,
  Video,
} from "lucide-react";
import { SearchBox } from "./SearchBox";
import {
  CategoryView,
  HomeView,
  LibraryView,
  SearchResultsView,
  SettingsView,
} from "./views";
import { useAuth } from "@/hooks/use-auth";
import { KIND_META, type Content, type Kind } from "@/openverse/model";

type ViewKey =
  | "home"
  | "movie"
  | "series"
  | "video"
  | "music"
  | "podcast"
  | "book"
  | "audio"
  | "article"
  | "search"
  | "library"
  | "history"
  | "favorites"
  | "studio"
  | "settings";

/** Vues rendues par le rayon unifié (même composant que les rayons du Hub). */
const CATEGORY_KEYS: ViewKey[] = [
  "movie",
  "series",
  "video",
  "music",
  "podcast",
  "book",
  "audio",
  "article",
];

const NAV: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "home", label: "Accueil", icon: Home },
  { key: "movie", label: "Films", icon: Clapperboard },
  { key: "series", label: "Séries", icon: Tv },
  { key: "video", label: "Vidéos", icon: Video },
  { key: "music", label: "Musiques", icon: Music2 },
  { key: "podcast", label: "Podcasts", icon: Podcast },
  { key: "book", label: "Livres", icon: BookOpen },
  { key: "audio", label: "Audio", icon: Mic },
  { key: "article", label: "Articles", icon: Newspaper },
  { key: "search", label: "Recherche", icon: Search },
  { key: "library", label: "Ma bibliothèque", icon: Library },
  { key: "history", label: "Historique", icon: History },
  { key: "favorites", label: "Favoris", icon: Heart },
  { key: "settings", label: "Paramètres", icon: Settings2 },
];

export function OpenVerseApp({ embedded = false }: { embedded?: boolean } = {}) {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<ViewKey>("home");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [items, setItems] = useState<Content[]>([]);
  const [failures, setFailures] = useState<{ source: string; error: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useAction(api.ovSearch.searchUniversal);
  const favorites = useQuery(api.ovLibrary.favoriteKeys);
  const toggleFavorite = useMutation(api.ovLibrary.toggleFavorite);

  const favoriteKeys = (favorites ?? []) as string[];

  const runSearch = useCallback(
    async (nextQuery: string, nextKind: Kind | null) => {
      setQuery(nextQuery);
      setKind(nextKind);
      setView("search");
      setLoading(true);
      setFailures([]);
      try {
        const result = await search({
          query: nextQuery,
          kind: nextKind ?? undefined,
          // Recherche massive : chaque source est interrogée en volume,
          // les réponses sont mémorisées 30 minutes côté serveur.
          limit: 200,
        });
        setItems(result.items as unknown as Content[]);
        setFailures(result.failures);
      } catch (error) {
        setItems([]);
        // R4 : le détail technique reste en console, jamais dans l'état affiché.
        console.error("[search] échec de recherche:", error);
        setFailures([{ source: "recherche", error: "Indisponible pour le moment." }]);
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  // Clic carte = fiche pleine page (route réelle) — le panneau interne
  // historique a été remplacé par /app/content/:key.
  const navigate = useNavigate();
  const openContent = useCallback(
    (content: Content) => navigate(`/app/content/${encodeURIComponent(content.key)}`),
    [navigate],
  );

  const onFavorite = useCallback(
    (content: Content) => void toggleFavorite({ contentKey: content.key }),
    [toggleFavorite],
  );

  return (
    <main className="min-h-screen bg-noir text-ink">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-noir/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setView("home")}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Moteur de contenus — accueil"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-strong font-display text-sm font-bold text-noir">
              OV
            </span>
            <span className="hidden font-display text-lg font-semibold tracking-tight sm:block">
              {embedded ? (
                <>
                  Moteur <span className="text-gold">de contenus</span>
                </>
              ) : (
                <>
                  Open<span className="text-gold">Verse</span>
                </>
              )}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <SearchBox
              initial={query}
              kind={kind}
              onKind={(next) => {
                setKind(next);
                if (query) void runSearch(query, next);
              }}
              onSubmit={(next) => void runSearch(next, kind)}
              loading={loading}
              compact
            />
          </div>

          {!embedded && (
          <div className="hidden items-center gap-2 md:flex">
            <span className="max-w-32 truncate rounded-full border border-white/10 px-3 py-1.5 text-[0.6875rem] text-ink-2">
              {user?.email ?? user?.name ?? "Compte"}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Se déconnecter"
              className="text-ink-2 transition-colors hover:text-gold"
            >
              <LogOut className="size-4" />
            </button>
          </div>
          )}
        </div>

        {/* navigation mobile */}
        <nav className="flex gap-1 overflow-x-auto border-t border-white/5 px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => setView(n.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.6875rem] ${
                view === n.key ? "bg-gold/15 text-gold" : "text-ink-2"
              }`}
            >
              <n.icon className="size-3.5" />
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6">
        <aside className="sticky top-24 hidden h-fit w-56 shrink-0 md:block">
          <nav className="space-y-0.5">
            {NAV.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => setView(n.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                  view === n.key
                    ? "bg-gold/10 font-medium text-gold shadow-[inset_0_0_0_1px_rgba(212,165,116,0.22)]"
                    : "text-ink-2 hover:bg-white/5 hover:text-ink"
                }`}
              >
                <n.icon className="size-4" />
                {n.label}
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-xl border border-white/5 bg-noir p-4">
            <p className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-widest text-gold">
              <Compass className="size-3" /> L'esprit KILINGO
            </p>
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-2">
              Discover → Feel → Understand → Speak → Master. Tout ce qui se lit
              ici s'ouvre dans l'application : regarde, écoute, transcris et
              traduis sans jamais la quitter.
            </p>
          </div>
        </aside>

        <section key={view + (kind ?? "all")} className="ln-view-in min-w-0 flex-1">
          {view === "home" && (
            <HomeView
              onOpen={openContent}
              onChip={(q, k) => void runSearch(q, k)}
              favorites={favoriteKeys}
              onFavorite={onFavorite}
            />
          )}
          {CATEGORY_KEYS.includes(view) && <CategoryView kind={view as Kind} />}
          {view === "search" && (
            <SearchResultsView
              query={query}
              items={items}
              failures={failures}
              loading={loading}
              onOpen={openContent}
              favorites={favoriteKeys}
              onFavorite={onFavorite}
            />
          )}
          {(view === "library" || view === "history" || view === "favorites") && (
            <LibraryView tab={view} onOpen={openContent} />
          )}
          {view === "settings" && <SettingsView />}

          {view === "search" && items.length > 0 && (
            <p className="mt-8 text-center text-[0.6875rem] text-ink-3">
              {items.length} résultat(s) — {Object.keys(KIND_META).length} types de contenus couverts, sources
              légales uniquement.
            </p>
          )}
        </section>
      </div>

    </main>
  );
}
