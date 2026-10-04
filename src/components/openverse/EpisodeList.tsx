import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import type { Content } from "@/openverse/model";

/* ═══════════════════════════════════════════════════════════════════════
   ÉPISODES — séries (TVmaze) et flux (podcast / RSS)

   Une série ou une émission est un CONTENEUR : sa fiche liste ses épisodes,
   et chaque épisode est évalué séparément par le Rights Engine. Ce qui est
   lisible s'ouvre ici ; le reste s'affiche « indisponible pour le moment »,
   sans jamais envoyer l'utilisateur hors de l'application.

   Module séparé volontairement : `Rayon` et `ContentDetail` l'utilisent tous
   les deux, et s'importer mutuellement créerait un cycle.
   ═══════════════════════════════════════════════════════════════════════ */

export function EpisodeList({
  content,
  onOpen,
}: {
  content: Content;
  onOpen: (c: Content) => void;
}) {
  const [items, setItems] = useState<Content[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const expandSeries = useAction(api.ovSearch.listSeriesEpisodes);
  const expandFeed = useAction(api.ovSearch.listFeedItems);

  const isSeries = content.kind === "series";
  const isFeed = Boolean(content.rssUrl) || content.subtype === "show";

  useEffect(() => {
    let alive = true;
    if (!isSeries && !isFeed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const run = isSeries
      ? expandSeries({ showId: content.externalId ?? "", limit: 40 })
      : expandFeed({ feedUrl: content.rssUrl ?? content.externalUrl, limit: 24 });
    run
      .then((res) => {
        if (alive) setItems(res.items as unknown as Content[]);
      })
      .catch((err: Error) => alive && setError("Indisponible pour le moment."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // Un changement de fiche relance la liste ; les actions sont stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.key, isSeries, isFeed]);

  if (!isSeries && !isFeed) return null;
  // Échec de chargement : la section entière disparaît — aucun message
  // technique, aucune demi-fiche (règle R4 + exigence épisodes).
  if (error) return null;

  const playable = (episode: Content) =>
    episode.rightsStatus === "EMBED_ALLOWED" ||
    episode.rightsStatus === "PUBLIC_DOMAIN" ||
    episode.rightsStatus === "CC_ALLOWED" ||
    episode.fullStreamAllowed ||
    Boolean(episode.streamUrl);

  return (
    <div className="ln-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{isSeries ? "Épisodes" : "Épisodes du flux"}</h3>
        {items?.length ? (
          <span className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
            {items.filter(playable).length} / {items.length} lisibles ici
          </span>
        ) : null}
      </div>

      {loading && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-3">
          <Loader2 className="size-3.5 animate-spin" /> Chargement des épisodes…
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs leading-relaxed text-amber-200">
          Épisodes indisponibles : {error}
        </p>
      )}
      {!loading && !error && (items?.length ?? 0) === 0 && (
        <p className="mt-2 text-xs text-ink-3">
          Aucun épisode exploitable dans ce flux — le flux est peut-être privé ou vide.
        </p>
      )}

      {(items?.length ?? 0) > 0 && (
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {items!.map((episode, i) => (
            <li key={episode.key}>
              <button
                type="button"
                onClick={() => onOpen(episode)}
                className="ln-stagger-item flex w-full items-center gap-3 rounded-xl border border-white/5 px-3 py-2 text-left transition-colors hover:border-gold/30 hover:bg-white/[0.02]"
                style={{ ["--ln-i" as string]: Math.min(i, 12) }}
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-xs text-ink">{episode.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[0.625rem] text-ink-3">
                    {episode.publishedAt ? (
                      <span>{new Date(episode.publishedAt).toLocaleDateString("fr-FR")}</span>
                    ) : null}
                    <span>{playable(episode) ? "● lisible ici" : "○ indisponible pour le moment"}</span>
                  </span>
                </span>
                <span className="shrink-0 text-[0.625rem] text-gold">Ouvrir</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[0.625rem] leading-relaxed text-ink-3">
        Les épisodes lisibles s'ouvrent directement ici. La transcription
        n'est proposée que lorsqu'elle est disponible pour cet épisode.
      </p>
    </div>
  );
}
