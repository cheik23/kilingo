import { Medal } from "lucide-react";

import { RpmHead } from "@/components/fx/RpmHead";
import { cn } from "@/lib/utils";
import { LEAGUE_LABELS, LEAGUE_TONES, type RankingEntry } from "./leagues";
import { TrendIndicator } from "./TrendIndicator";

/* ═══════════════════════════════════════════════════════════════════════
   LIGNE DE CLASSEMENT — rang, avatar, nom, ligue, XP, progression.

   Les trois premières places portent une médaille Lucide (or / argent /
   bronze) : pas d'emoji dans l'interface, cohérent avec le reste du
   produit. La progression compare au classement de la période précédente
   (`rankDelta` en places) ; sans période précédente, aucun chiffre.
   ═══════════════════════════════════════════════════════════════════════ */

const MEDAL_COLORS = ["#d4af37", "#c0c8d0", "#cd7f32"] as const;

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "M"
  );
}

function RankMark({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="w-8 shrink-0 text-center font-mono text-xs text-ink-3 tabular-nums">
        {rank}
      </span>
    );
  }
  const medals = ["Médaille d'or", "Médaille d'argent", "Médaille de bronze"];
  return (
    <span className="flex w-8 shrink-0 justify-center">
      <Medal
        className="size-5"
        style={{ color: MEDAL_COLORS[rank - 1] }}
        role="img"
        aria-label={`${medals[rank - 1]} · rang ${rank}`}
      />
    </span>
  );
}

export function RankingItem({
  entry,
  small = false,
  className,
}: {
  entry: RankingEntry;
  /** Rendu compact (listes longues, sous-classement). */
  small?: boolean;
  className?: string;
}) {
  const tone = LEAGUE_TONES[entry.league] ?? LEAGUE_TONES.bronze;
  const size = small ? "size-8" : "size-11";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/5 px-3 py-2.5 transition-colors hover:bg-white/[0.03]",
        entry.isYou && "border-gold/40 bg-gold/[0.06]",
        className,
      )}
    >
      <RankMark rank={entry.rank} />

      {entry.rpmAvatarUrl ? (
        <RpmHead url={entry.rpmAvatarUrl} className={size} alt={entry.name} />
      ) : entry.image ? (
        <img
          src={entry.image}
          alt=""
          loading="lazy"
          decoding="async"
          width={small ? 32 : 44}
          height={small ? 32 : 44}
          className={cn("shrink-0 rounded-full border border-gold/25 object-cover", size)}
        />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gradient-to-br from-gold/25 to-noir font-display font-bold text-gold",
            small ? "size-8 text-[0.625rem]" : "size-11 text-sm",
          )}
          aria-hidden
        >
          {initials(entry.name)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {entry.name}
          {entry.isYou && <span className="ml-1.5 text-[0.6875rem] text-gold">· toi</span>}
        </p>
        <span
          className={cn(
            "mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[0.5625rem] uppercase",
            tone,
          )}
        >
          {LEAGUE_LABELS[entry.league] ?? entry.league}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <span className="font-mono text-sm font-bold text-gold tabular-nums">
          {entry.xp.toLocaleString("fr-FR")}
        </span>
        {entry.previousRank === null ? (
          <span className="text-[0.6875rem] text-ink-3">nouveau</span>
        ) : (
          <TrendIndicator delta={entry.rankDelta} suffix=" pl." invert />
        )}
      </div>
    </div>
  );
}

export default RankingItem;
