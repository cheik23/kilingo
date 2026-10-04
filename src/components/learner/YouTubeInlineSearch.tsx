import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Loader2, Play, Search } from "lucide-react";
import { toast } from "sonner";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { EmptyState } from "./MediaHubView";
import type { HubMedia } from "@/components/media/MediaRoomView";
import { cn, friendlyError } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   VIDÉOS — recherche YouTube (API officielle) et lecture 100 % in-app.

   Clic = le lecteur intégré s'ouvre immédiatement ici (aucune
   redirection), la MediaRoom apporte transcription et traduction à
   côté via le pipeline Shadow existant. Les vidéos sans lecteur
   possible ne sont pas affichées.
   ═══════════════════════════════════════════════════════════════════ */

type VideoHit = {
  key: string;
  externalId: string;
  title: string;
  creator?: string;
  thumbnail?: string;
  publishedAt?: number;
  embedUrl?: string;
};

/** « 2026-05-01T12:00:00Z » → label court « 1 mai 2026 ». */
function dateLabel(publishedAt?: number): string {
  if (!publishedAt || !Number.isFinite(publishedAt)) return "";
  return new Date(publishedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function YouTubeInlineSearch({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState<VideoHit | null>(null);
  const [starting, setStarting] = useState(false);

  const searchEngine = useAction(api.ovSearch.searchUniversal);
  const createMedia = useMutation(api.media.createLinkMedia);

  async function doSearch(term?: string) {
    const q = (term ?? query).trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await searchEngine({ query: q, kind: "video", limit: 24, sort: "new" });
      // Règle du Hub : seules les vidéos réellement lisibles ici passent.
      const hits = (res.items as unknown as VideoHit[])
        .filter((v) => Boolean(v.embedUrl))
        .map((v) => ({
          key: v.key,
          externalId: v.externalId ?? v.key.split(":")[1] ?? "",
          title: v.title,
          creator: v.creator,
          thumbnail: v.thumbnail,
          publishedAt: v.publishedAt,
          embedUrl: v.embedUrl,
        }))
        .filter((v) => v.externalId);
      setResults(hits);
    } catch (err) {
      toast.error(friendlyError(err, "Indisponible pour le moment."));
    } finally {
      setSearching(false);
    }
  }

  /** Lance le pipeline Shadow (sous-titres YouTube → traduction → argot). */
  async function analyze(v: VideoHit) {
    setStarting(true);
    try {
      const { mediaId } = await createMedia({
        language: language as "en",
        title: v.title.slice(0, 120),
        url: `https://www.youtube.com/watch?v=${v.externalId}`,
        platform: "youtube",
      });
      toast.success("Analyse lancée — transcription en cours.");
      onOpenRoom({
        kind: "youtube",
        title: v.title,
        artist: v.creator,
        embedUrl: `https://www.youtube-nocookie.com/embed/${v.externalId}`,
        language,
        statusId: mediaId,
      });
    } catch (err) {
      toast.error(friendlyError(err, "Analyse impossible."));
    } finally {
      setStarting(false);
    }
  }

  const suggestions = ["Drake", "TED", "interview", "documentary"];

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Une chaîne, un sujet, un artiste…"
            aria-label="Rechercher une vidéo"
            className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 font-medium text-noir disabled:opacity-50"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
        </button>
      </form>

      {playing && (
        <div className="space-y-3">
          <YouTubeEmbed videoId={playing.externalId} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-medium text-ink">{playing.title}</p>
              <p className="font-mono text-[0.625rem] text-ink-3">
                {[playing.creator, dateLabel(playing.publishedAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlaying(null)}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-ink-2 hover:border-gold/40 hover:text-gold"
              >
                ← Retour
              </button>
              <button
                onClick={() => void analyze(playing)}
                disabled={starting}
                className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
              >
                {starting ? <Loader2 className="size-3.5 animate-spin" /> : "Transcription + traduction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!results && !searching && !playing && (
        <EmptyState
          icon={<Play className="size-6 text-gold" />}
          title="Des vidéos récentes à regarder ici"
          hint="Clic = lecture directe dans l'app, transcription et traduction à côté."
          suggestions={suggestions}
          onSuggestion={(s) => {
            setQuery(s);
            void doSearch(s);
          }}
        />
      )}

      {searching && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      )}

      {results && !playing && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((v, i) => (
            <button
              key={v.key}
              onClick={() => setPlaying(v)}
              className={cn(
                "ln-stagger-item group overflow-hidden rounded-2xl border border-white/5 bg-noir-2 text-left transition-colors hover:border-gold/40",
              )}
              style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                {v.thumbnail ? (
                  <img
                    src={v.thumbnail}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-3xl opacity-40">▶️</div>
                )}
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-black/70 text-gold">
                    <Play className="size-4" />
                  </span>
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium text-ink">{v.title}</p>
                <p className="mt-0.5 line-clamp-1 font-mono text-[0.625rem] text-ink-3">
                  {[v.creator, dateLabel(v.publishedAt)].filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          ))}
          {results.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={<Play className="size-6 text-ink-3" />}
                title="Aucune vidéo lisible ici pour cette recherche"
                hint="Essaie un autre sujet ou une autre chaîne."
                suggestions={suggestions}
                onSuggestion={(s) => {
                  setQuery(s);
                  void doSearch(s);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
