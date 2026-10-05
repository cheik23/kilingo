import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Heart, Play } from "lucide-react";
import {
  KIND_META,
  ageLabel,
  dateOf,
  fmtDuration,
  isWide,
  type Content,
} from "@/openverse/model";

/* ═══════════════════════════════════════════════════════════════════════
   Carte média — une carte n'apparaît que si son contenu se lit dans
   MOOVY. Statuts et disponibilités restent internes : ils ne sont
   montrés que dans l'espace d'administration.
   ═══════════════════════════════════════════════════════════════════════ */

export function KindPill({ kind, subtype }: { kind: Content["kind"]; subtype?: string }) {
  const meta = KIND_META[kind];
  // Un épisode, une station ou un article se distinguent d'une œuvre :
  // l'information vient de la source, jamais inventée côté interface.
  const extra =
    subtype && subtype !== "show" && subtype !== "catalog"
      ? ` · ${subtype.replace(/_/g, " ")}`
      : "";
  return (
    <span className="rounded-full border border-white/10 bg-black/60 px-2 py-0.5 font-mono text-[0.625rem] tracking-wide text-ink-2 backdrop-blur">
      {meta.icon} {meta.label}
      {extra}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Carte média
   ═══════════════════════════════════════════════════════════════════════ */

export function MediaCard({
  content,
  index = 0,
  favorite = false,
  onOpen,
  onToggleFavorite,
}: {
  content: Content;
  index?: number;
  favorite?: boolean;
  onOpen: (content: Content) => void;
  onToggleFavorite?: (content: Content) => void;
}) {
  const wide = isWide(content);
  const date = dateOf(content);
  const age = ageLabel(date);
  // Sur tactile il n'y a pas de survol : le halo « lecture » resterait
  // invisible sur mobile et la carte donnerait l'impression d'être morte.
  const [tapped, setTapped] = useState(false);

  return (
    <article
      className="ln-card ln-stagger-item group relative cursor-pointer overflow-hidden focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none"
      style={{ ["--ln-i" as string]: index }}
      role="button"
      tabIndex={0}
      aria-label={content.title}
      onClick={() => {
        setTapped(true);
        onOpen(content);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        setTapped(true);
        onOpen(content);
      }}
    >
      <div className={`relative ${wide ? "aspect-square" : "aspect-[2/3]"} overflow-hidden`}>
        {content.thumbnail ? (
          <img
            src={content.thumbnail}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-white/5 to-transparent text-4xl opacity-40">
            {KIND_META[content.kind].icon}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        <div className="absolute left-2 top-2 flex items-center gap-1">
          {/* Une émission de podcast n'a pas d'audio à elle : ses épisodes,
              eux, se lisent ici. */}
          {content.rssUrl && content.kind === "podcast" ? (
            <span className="rounded-full border border-gold/30 bg-black/60 px-2 py-0.5 font-mono text-[0.5625rem] text-gold backdrop-blur">
              ▶ épisodes ici
            </span>
          ) : null}
        </div>

        <div className="absolute right-2 top-2 flex items-center gap-1">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(content);
              }}
              aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              className={`flex size-6 items-center justify-center rounded-full border border-white/15 bg-black/60 backdrop-blur transition-colors ${
                favorite ? "text-red-400" : "text-ink-2 hover:text-gold"
              }`}
            >
              <Heart className={`size-3.5 ${favorite ? "fill-current" : ""}`} />
            </button>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindPill kind={content.kind} subtype={content.subtype} />
            {content.year ? (
              <span className="font-mono text-[0.625rem] text-ink-3">{content.year}</span>
            ) : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink">{content.title}</h3>
          {content.creator && <p className="mt-0.5 line-clamp-1 text-[0.6875rem] text-ink-2">{content.creator}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[0.625rem] text-ink-3">
            {content.duration ? <span>{fmtDuration(content.duration)}</span> : null}
            {age ? <span>· {age}</span> : null}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-100 ${
          tapped ? "opacity-100" : "opacity-0 [@media(hover:none)]:opacity-100"
        }`}
      >
        <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 bg-black/70 text-gold backdrop-blur">
          <Play className="size-5" />
        </span>
      </div>
    </article>
  );
}
