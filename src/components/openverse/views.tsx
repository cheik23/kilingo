import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, Compass, Heart, History, Loader2, Settings2, Sparkles } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { Rayon } from "./Rayon";
import { FavoritesInlinePlayer } from "./FavoritesInlinePlayer";
import { friendlyError } from "@/lib/utils";
import { soundEngine } from "@/lib/soundEngine";
import { useThemeMode, type ThemeMode } from "@/hooks/useThemeMode";
import { Volume2 } from "lucide-react";
import { Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { PlaceEmpty, PlaceHeader } from "@/components/fx/PlaceHeader";
import {
  KIND_META,
  LANGS,
  decisionOf,
  download,
  fmtDuration,
  fromLibraryRow,
  langLabel,
  slug,
  toSrt,
  toVtt,
  type Content,
  type Kind,
} from "@/openverse/model";

/* ═══════════════════════════════════════════════════════════════════════
   VUES DE L'APPLICATION
   ═══════════════════════════════════════════════════════════════════════ */

function Row({ title, subtitle, items, onOpen }: { title: string; subtitle?: string; items: Content[]; onOpen: (c: Content) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
        </div>
      </div>
      <div className="ln-snap-x -mx-1 pb-2">
        {items.map((item, i) => (
          <div key={item.key} className="ln-snap-item w-40 sm:w-44">
            <MediaCard content={item as Content} index={i} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Grid({ items, onOpen, favorites, onFavorite }: { items: Content[]; onOpen: (c: Content) => void; favorites?: string[]; onFavorite?: (c: Content) => void }) {
  return (
    <div className="ln-grid-tight">
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

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="ln-card mt-6 p-8 text-center">
      <Compass className="mx-auto size-8 text-gold" />
      <p className="mt-3 font-display text-lg text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-2">{body}</p>
      {action}
    </div>
  );
}

/* ── Accueil ────────────────────────────────────────────────────────── */

/* Puce de recherche : le libellé suffit — l'emoji n'est pas une icône
   d'interface (voir checklist « aucun emoji comme icône »). */
const CHIPS = [
  { label: "Films à regarder ici", query: "public domain film", kind: "movie" as Kind },
  { label: "Concerts live", query: "live concert", kind: "audio" as Kind },
  { label: "Classiques de la littérature", query: "pride and prejudice", kind: "book" as Kind },
  { label: "Jazz", query: "jazz", kind: "music" as Kind },
  { label: "Policier", query: "sherlock holmes", kind: "book" as Kind },
  { label: "Images libres", query: "mountain", kind: "image" as Kind },
];

export function HomeView({
  onOpen,
  onChip,
  favorites,
  onFavorite,
}: {
  onOpen: (c: Content) => void;
  onChip: (query: string, kind: Kind | null) => void;
  favorites: string[];
  onFavorite: (c: Content) => void;
}) {
  const movies = useQuery(api.ovSearch.trending, { kind: "movie", limit: 8 });
  const music = useQuery(api.ovSearch.trending, { kind: "music", limit: 8 });
  const books = useQuery(api.ovSearch.trending, { kind: "book", limit: 8 });
  const audio = useQuery(api.ovSearch.trending, { kind: "audio", limit: 8 });
  const recos = useQuery(api.ovLibrary.recommendations, { limit: 10 });
  const library = useQuery(api.ovLibrary.myLibrary);

  const anything =
    (movies?.length ?? 0) + (music?.length ?? 0) + (books?.length ?? 0) + (audio?.length ?? 0) > 0;

  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.3em] text-gold">Moteur universel</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Qu'est-ce que tu cherches aujourd'hui ?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Films, musiques, livres, podcasts : une seule recherche, et tu vois tout de suite ce que tu peux
          regarder, écouter ou lire ici.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onChip(chip.query, chip.kind)}
            className="rounded-full border border-white/10 bg-noir px-3.5 py-2 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {library?.history?.length ? (
        <Row
          title="Reprendre"
          subtitle="Là où tu t'es arrêté"
          items={library.history.slice(0, 10).map(fromLibraryRow)}
          onOpen={onOpen}
        />
      ) : null}

      {recos?.length ? (
        <Row title="Recommandé pour toi" subtitle="D'après tes lectures, écoutes et favoris" items={recos as never} onOpen={onOpen} />
      ) : null}

      <Row title="Films" subtitle="À regarder dans KILINGO" items={(movies ?? []) as never} onOpen={onOpen} />
      <Row title="Musiques & concerts" items={(music ?? []) as never} onOpen={onOpen} />
      <Row title="Livres" items={(books ?? []) as never} onOpen={onOpen} />
      <Row title="Audio & podcasts" items={(audio ?? []) as never} onOpen={onOpen} />

      {!anything && (
        <EmptyState
          title="Rien d'indexé pour l'instant"
          body="Lance une recherche ou choisis une suggestion ci-dessus : les résultats indexés apparaîtront ensuite ici, organisés par type."
        />
      )}

      {(movies?.length ?? 0) > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">Sélection du moment</h2>
          <Grid items={(movies ?? []) as never} onOpen={onOpen} favorites={favorites} onFavorite={onFavorite} />
        </section>
      )}
    </div>
  );
}

/* ── Catégorie ──────────────────────────────────────────────────────── */

const CATEGORY_SUGGESTIONS: Record<Kind, string[]> = {
  movie: ["public domain film", "documentary", "animation", "sci-fi"],
  series: ["drama", "comedy", "documentary", "thriller"],
  video: ["conference", "interview", "documentary", "vlog"],
  music: ["jazz", "classical", "blues", "live"],
  podcast: ["interview", "actualité", "culture", "société"],
  audio: ["radio", "concert", "conférence", "entretien"],
  book: ["pride and prejudice", "sherlock holmes", "frankenstein", "poetry"],
  article: ["actualité", "culture", "science", "société"],
  social: ["communauté", "échange", "débat", "créateur"],
  image: ["landscape", "portrait", "architecture", "vintage"],
};

const CATEGORY_INTRO: Record<Kind, string> = {
  movie:
    "Des films à regarder directement ici, et une fiche pour chaque autre titre : durée, genres, pays, et où le voir.",
  series:
    "Les séries et leur diffusion du jour : tu vois immédiatement ce qui est nouveau.",
  video:
    "Des vidéos à regarder dans KILINGO, avec leur lecteur d'origine.",
  music:
    "Cherche par artiste, titre ou album : classements par pays et extraits à écouter, avec les paroles quand elles sont disponibles.",
  podcast:
    "Des émissions et leurs épisodes : tu écoutes en streaming, sans quitter KILINGO.",
  audio:
    "Livres audio et webradios du monde entier, filtrables par pays et par langue.",
  book:
    "Des livres en texte intégral à lire et à traduire ici, et une fiche pour tous les autres.",
  article:
    "Actualités, culture, science et société : lisibles et traduisibles ici, avec le crédit de l'auteur.",
  social:
    "Les contenus de créateurs et de communautés arriveront dans cette catégorie.",
  image:
    "Des images à explorer, créditées quand la source le demande.",
};

/**
 * CATÉGORIE — délègue au rayon unifié : même moteur que les rayons du Hub
 * (recherche, tri par nouveauté, filtres pays/langue, fiche KILINGO).
 */
export function CategoryView({ kind }: { kind: Kind }) {
  const meta = KIND_META[kind];
  return (
    <Rayon
      kinds={[kind]}
      title={`${meta.icon} ${meta.plural}`}
      subtitle={CATEGORY_INTRO[kind]}
      suggestions={CATEGORY_SUGGESTIONS[kind]}
    />
  );
}

/* ── Résultats de recherche ─────────────────────────────────────────── */

export function SearchResultsView({
  query,
  items,
  failures,
  loading,
  onOpen,
  favorites,
  onFavorite,
}: {
  query: string;
  items: Content[];
  failures: { source: string; error: string }[];
  loading: boolean;
  onOpen: (c: Content) => void;
  favorites: string[];
  onFavorite: (c: Content) => void;
}) {
  return (
    <div>
      <header className="mb-4">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.3em] text-gold">Résultats</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
          {loading ? `Recherche de « ${query} »…` : `${items.length} résultat(s) pour « ${query} »`}
        </h1>
      </header>

      {failures.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-[0.6875rem] text-amber-200">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5" /> Certaines sources n'ont pas répondu
          </p>
          <p className="mt-1 text-amber-200/80">
            Les résultats des autres sources restent affichés. Relance la recherche
            dans un instant pour les récupérer.
          </p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="ln-stagger-item aspect-[2/3] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]" style={{ ["--ln-i" as string]: i }} />
          ))}
        </div>
      ) : items.length ? (
        <Grid items={items} onOpen={onOpen} favorites={favorites} onFavorite={onFavorite} />
      ) : (
        <EmptyState
          title="Aucun résultat"
          body="Essaie une orthographe proche, un titre original, ou un autre type de contenu. La recherche tolère les fautes courantes et les langues différentes."
        />
      )}
    </div>
  );
}

/**
 * Expressions/mots mis en favoris via les cœurs de Découverte, Recherche,
 * Mémoire et Shadow — le système canonique `convex/favorites.ts`.
 * Suppression possible ici (re-clic = toggle, on n'écrit jamais deux fois).
 */
function WordFavorites() {
  const favorites = useQuery(api.favorites.mySlangFavorites, {});
  const toggleFavorite = useMutation(api.favorites.toggleSlangFavorite);

  if (favorites === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-3">
        <Loader2 className="size-4 animate-spin" /> Chargement de tes expressions…
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="ln-card p-5">
        <p className="text-sm text-ink-2">
          Aucune expression enregistrée pour l'instant.
        </p>
        <p className="mt-1 text-xs text-ink-3">
          Touche le cœur sur une expression (Découverte, Recherche, Shadow) pour
          la retrouver ici.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {favorites.map((row) => (
        <div key={row.favoriteId} className="ln-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-lg italic text-ink">
                {row.slang.expression}
              </p>
              <p className="mt-0.5 text-sm text-gold">{row.slang.meaning}</p>
              {(row.slang.region || row.slang.register) && (
                <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-wider text-ink-3">
                  {[row.slang.region, row.slang.register].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void toggleFavorite({ slangId: row.slang._id })}
              aria-label={`Retirer « ${row.slang.expression} » des favoris`}
              className="shrink-0 text-gold transition-colors hover:text-red-300"
            >
              <Heart className="size-4 fill-current" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Bibliothèque / historique / favoris ────────────────────────────── */

export function LibraryView({
  tab,
  onOpen,
}: {
  tab: "library" | "history" | "favorites";
  onOpen: (c: Content) => void;
}) {
  const library = useQuery(api.ovLibrary.myLibrary);
  const clearHistory = useMutation(api.ovLibrary.clearHistory);
  const removeFromHistory = useMutation(api.ovLibrary.removeFromHistory);
  const toggleFavorite = useMutation(api.ovLibrary.toggleFavorite);
  const deletePlaylist = useMutation(api.ovLibrary.deletePlaylist);
  const createPlaylist = useMutation(api.ovLibrary.createPlaylist);

  if (!library) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <Loader2 className="size-4 animate-spin" /> Chargement de ta bibliothèque…
      </div>
    );
  }

  if (tab === "history") {
    return (
      <div>
        <PlaceHeader
          place="history"
          title="Historique"
          icon={History}
          motif="kente"
          description="Ce que tu lances apparaît ici, avec ta position de reprise."
          actions={
            library.history.length > 0 ? (
              <button
                type="button"
                onClick={() => void clearHistory()}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-terracotta/40 hover:text-terracotta-ink"
              >
                Tout effacer
              </button>
            ) : undefined
          }
        />
        <div className="mt-4" />
        {library.history.length === 0 ? (
          <PlaceEmpty place="history" icon={History} motif="halftone" />
        ) : (
          <ul className="space-y-2">
            {library.history.map((row, i) => (
              <li key={row._id} className="ln-card ln-stagger-item flex items-center gap-3 p-3" style={{ ["--ln-i" as string]: i }}>
                {row.thumbnail ? (
                  <img src={row.thumbnail} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-ink">{row.title}</p>
                  <p className="text-[0.6875rem] text-ink-3">
                    {KIND_META[row.kind as Kind]?.icon} {row.progress}% · position {fmtDuration(row.position)}
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${row.progress}%` }} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(fromLibraryRow(row))}
                  className="rounded-lg border border-white/10 px-2.5 py-1 text-[0.6875rem] text-ink-2 hover:text-gold"
                >
                  Reprendre
                </button>
                <button
                  type="button"
                  onClick={() => void removeFromHistory({ contentKey: row.contentKey })}
                  className="text-[0.6875rem] text-ink-3 hover:text-red-300"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (tab === "favorites") {
    const favoriteItems = library.favorites.map(fromLibraryRow);
    return (
      <div>
        <h1 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold text-ink">
          <Heart className="size-5 text-gold" /> Favoris
        </h1>
        {/* Expressions/mots favoris — même système que les cœurs de
            Découverte, Recherche, Mémoire et Shadow (convex/favorites.ts).
            Sans cette section, un mot mis en favori n'apparaissait nulle part
            dans cet onglet : deux systèmes de favoris coexistent (mots et
            contenus) et l'onglet ne montrait que les contenus. */}
        <WordFavorites />
        <h2 className="mt-8 mb-3 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
          Contenus favoris
        </h2>
        {library.favorites.length === 0 ? (
          <EmptyState title="Aucun favori" body="Touche le cœur sur une carte pour garder un contenu sous la main." />
        ) : (
          <>
            {/* Mini-lecteur inline : les favoris audio s'écoutent ici,
                sans quitter la liste. Le même composant que la fiche est
                réutilisé — aucune logique de lecture dupliquée. */}
            <FavoritesInlinePlayer items={favoriteItems} />
            <div className="mt-5">
              <Grid
                items={favoriteItems}
                onOpen={onOpen}
                favorites={library.favorites.map((f) => f.contentKey)}
                onFavorite={(c) => void toggleFavorite({ contentKey: c.key })}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Ma bibliothèque</h1>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt("Nom de la nouvelle playlist ?");
            if (name) void createPlaylist({ name });
          }}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ink-2 hover:text-gold"
        >
          + Playlist
        </button>
      </header>

      <div className="mb-6">
        <h2 className="mb-2 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">Favoris récents</h2>
        {library.favorites.length === 0 ? (
          <p className="text-sm text-ink-3">Rien pour l'instant.</p>
        ) : (
          <div className="ln-snap-x -mx-1 pb-2">
            {library.favorites.slice(0, 8).map((item, i) => (
              <div key={item._id} className="ln-snap-item w-40">
                <MediaCard content={fromLibraryRow(item)} index={i} favorite onOpen={onOpen} />
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-2 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">Playlists & collections</h2>
      {library.playlists.length === 0 ? (
        <p className="text-sm text-ink-3">Aucune playlist. Crée-en une pour organiser tes contenus.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {library.playlists.map((playlist, i) => (
            <div key={playlist._id} className="ln-card ln-stagger-item p-4" style={{ ["--ln-i" as string]: i }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{playlist.name}</p>
                  <p className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
                    {playlist.kind} · {playlist.items.length} élément(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void deletePlaylist({ id: playlist._id })}
                  className="text-[0.6875rem] text-ink-3 hover:text-red-300"
                >
                  Supprimer
                </button>
              </div>
              <ul className="mt-3 space-y-1">
                {playlist.items.slice(0, 4).map((item) => (
                  <li key={item.contentKey} className="line-clamp-1 text-xs text-ink-2">
                    · {item.title}
                  </li>
                ))}
              </ul>
              {playlist.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpen(fromLibraryRow(playlist.items[0]))}
                  className="mt-3 text-[0.6875rem] text-gold"
                >
                  Ouvrir le premier élément
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {library.bookmarks.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">Marque-pages</h2>
          <ul className="space-y-1.5">
            {library.bookmarks.map((b) => (
              <li key={b._id} className="flex items-center gap-2 text-sm text-ink-2">
                <span className="text-gold">🔖</span>
                <span className="line-clamp-1">{b.title}</span>
                <span className="font-mono text-[0.625rem] text-ink-3">
                  {b.label} · {fmtDuration(b.position)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ── Traductions / studio ───────────────────────────────────────────── */

/* ── Paramètres ─────────────────────────────────────────────────────── */

/**
 * PARAMÈTRES UTILISATEUR
 *
 * Ne contient que ce qui concerne la personne qui utilise l'application :
 * ses langues, sa façon de lire, ses données. Les moteurs de transcription,
 * les connecteurs de sources, les clés d'API et l'état des droits sont des
 * sujets d'exploitation : ils vivent côté système et administration, pas ici.
 */
export function SettingsView() {
  const { t } = useI18n();
  const { mode, setMode } = useThemeMode();
  const installPrompt = useInstallPrompt();
  const [volume, setVolume] = useState(soundEngine.getVolume());
  const [muted, setMuted] = useState(soundEngine.isMuted());
  const prefs = useQuery(api.ovLibrary.getPreferences);
  const setPreferences = useMutation(api.ovLibrary.setPreferences);
  const clearSearchHistory = useMutation(api.ovLibrary.clearSearchHistory);
  const [saved, setSaved] = useState(false);

  if (!prefs) return <p className="text-sm text-ink-2">Chargement…</p>;

  const update = async (patch: Record<string, unknown>) => {
    await setPreferences(patch as never);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
          <Settings2 className="size-5 text-gold" /> Paramètres
        </h1>
        {saved && <p className="mt-1 text-xs text-emerald-300">Préférences enregistrées ✓</p>}
      </header>

      <section className="ln-card p-5">
        <h2 className="text-sm font-semibold text-ink">Langues</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["uiLang", "Langue de l'interface"],
              ["translationLang", "Langue de traduction"],
              ["subtitleLang", "Sous-titres par défaut"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">{label}</span>
              <select
                value={(prefs as unknown as Record<string, string>)[key] ?? "fr"}
                onChange={(e) => void update({ [key]: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-noir px-3 text-sm text-ink"
              >
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label} — {l.native}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="ln-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Volume2 className="size-4 text-gold" />{t("sound.title")}</h2><p className="mt-1 text-xs text-ink-3">{t("sound.subtitle")}</p></div>
          <button type="button" onClick={() => { const next = soundEngine.toggleMuted(); setMuted(next); if (!next) soundEngine.play("click"); }} className="rounded-xl border border-gold/25 px-3 py-2 text-xs text-gold">{muted ? t("sound.unmute") : t("sound.mute")}</button>
        </div>
        <input aria-label={t("sound.volume")} type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(event) => { const value = Number(event.target.value) / 100; setVolume(value); soundEngine.setVolume(value); soundEngine.play("click"); }} className="mt-5 w-full accent-gold" />
        <p className="mt-1 text-right font-mono text-[0.625rem] text-ink-3">{Math.round(volume * 100)}%</p>
      </section>

      <section className="ln-card p-5">
        <h2 className="text-sm font-semibold text-ink">{t("pwa.install.button")}</h2>
        <p className="mt-1 text-xs text-ink-3">
          {installPrompt.installed
            ? t("pwa.install.installed")
            : installPrompt.canInstall
              ? t("pwa.offline.banner")
              : installPrompt.needsManualInstall
                ? t("pwa.install.manual")
                : t("pwa.install.dismissed")}
        </p>
        {installPrompt.canInstall && (
          <button
            type="button"
            onClick={() => void installPrompt.install()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-4 py-2 text-sm font-semibold text-noir transition-transform hover:scale-[1.02]"
          >
            <Download className="size-4" />
            {t("pwa.install.button")}
          </button>
        )}
        {installPrompt.canInstall && (
          <button
            type="button"
            onClick={installPrompt.dismiss}
            className="mt-3 block text-xs text-ink-3 underline underline-offset-4 hover:text-ink"
          >
            {t("pwa.install.dismissed")}
          </button>
        )}
      </section>

      <section className="ln-card p-5">
        <h2 className="text-sm font-semibold text-ink">{t("theme.title")}</h2>
        <p className="mt-1 text-xs text-ink-3">{t("theme.subtitle")}</p>
        <div role="radiogroup" aria-label={t("theme.title")} className="mt-4 grid grid-cols-3 gap-3">
          {(["auto", "light", "dark"] as ThemeMode[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-2xl border p-3 text-left transition-colors ${mode === value ? "border-gold bg-gold/10" : "border-white/10 hover:border-gold/40"}`}
            >
              <span
                className={`block h-16 rounded-xl border p-2 ${
                  value === "light"
                    ? "bg-[#FAF0E6] text-[#2C1810]"
                    : value === "dark"
                      ? "bg-[#2C1810] text-[#faf0e6]"
                      : "bg-gradient-to-r from-[#FAF0E6] to-[#2C1810]"
                }`}
              >
                <i className="block h-1 w-10 rounded bg-current opacity-40" />
                <i className="mt-2 block h-5 w-full rounded bg-gold/30" />
              </span>
              <span className="mt-2 block text-xs font-semibold">{t(`theme.modes.${value}`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ln-card p-5">
        <h2 className="text-sm font-semibold text-ink">Lecture & données</h2>
        <div className="mt-3 space-y-3">
          {(
            [
              ["autoplay", "Lecture automatique", "Lance le média dès l'ouverture de la fiche."],
              ["dataSaver", "Économiseur de données", "Ne charge pas les aperçus avant lecture."],
              ["safeSearch", "Filtrage famille", "Masque les contenus signalés comme sensibles."],
            ] as const
          ).map(([key, label, help]) => (
            <label key={key} className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm text-ink">{label}</span>
                <span className="block text-[0.6875rem] text-ink-3">{help}</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean((prefs as unknown as Record<string, boolean>)[key])}
                onChange={(e) => void update({ [key]: e.target.checked })}
                className="mt-1 size-4 accent-gold"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void clearSearchHistory()}
          className="mt-4 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ink-2 hover:text-red-300"
        >
          Effacer mon historique de recherche
        </button>
      </section>

    </div>
  );
}

/* ── Aides réutilisables ────────────────────────────────────────────── */

export function ContentSummary({ content }: { content: Content }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.6875rem] text-ink-3">{KIND_META[content.kind].icon}</span>
      <span className="text-[0.6875rem] text-ink-3">{langLabel(content.language)}</span>
      <Sparkles className="size-3 text-gold" />
    </div>
  );
}
