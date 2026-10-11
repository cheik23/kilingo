import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   BADGE DE SUCCÈS — icône, titre, description, progression.

   Deux états visuels seulement, dérivés de la donnée réelle :
   débloqué (anneau doré + date) ou verrouillé (atténué + cadenas + barre
   de progression partielle). L'icône du catalogue est un pictogramme
   culturel fourni par la base, on l'affiche tel quel.
   ═══════════════════════════════════════════════════════════════════════ */

export type AchievementItem = {
  achievementId: string;
  category: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  completedAt: number | null;
  reward: { xp: number; gems: number; badgeId?: string };
  icon: string;
  tier: string;
};

const TIER_RING: Record<string, string> = {
  bronze: "border-[#cd7f32]/45",
  silver: "border-slate-300/45",
  gold: "border-gold/50",
};

export function AchievementBadge({
  item,
  onOpen,
  className,
}: {
  item: AchievementItem;
  /** Ouvre le détail / la célébration (facultatif). */
  onOpen?: (item: AchievementItem) => void;
  className?: string;
}) {
  const ratio = item.target > 0 ? Math.min(1, item.progress / item.target) : 0;
  const percent = Math.round(ratio * 100);
  const ring = TIER_RING[item.tier] ?? TIER_RING.bronze;

  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border-2 bg-noir-3 text-2xl",
            ring,
            !item.completed && "grayscale",
          )}
          aria-hidden
        >
          {item.icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="truncate">{item.title}</span>
            {!item.completed && <Lock className="size-3.5 shrink-0 text-ink-3" aria-hidden />}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-3">
            {item.description}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <span
            className={cn(
              "block h-full rounded-full",
              item.completed
                ? "bg-gradient-to-r from-gold-strong to-gold"
                : "bg-gold/45",
            )}
            style={{ width: `${percent}%`, transition: "width 500ms ease-out" }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[0.625rem] text-ink-3">
          <span className="tabular-nums">
            {item.completed ? "Débloqué" : `${item.progress} / ${item.target}`}
          </span>
          <span className="tabular-nums">
            {item.completed && item.completedAt
              ? new Date(item.completedAt).toLocaleDateString("fr-FR")
              : `+${item.reward.xp} XP · ${item.reward.gems} gemmes`}
          </span>
        </div>
      </div>
    </>
  );

  const shell = cn(
    "ln-card rounded-xl border-white/5 p-4 text-left transition-transform",
    item.completed
      ? "hover:-translate-y-1 hover:shadow-[0_0_28px_rgba(212,165,116,0.18)]"
      : "opacity-60 hover:opacity-80",
    className,
  );

  if (!onOpen) {
    return <article className={shell}>{content}</article>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={shell}
      aria-label={`${item.title} — ${item.completed ? "débloqué" : `${item.progress} sur ${item.target}`}`}
    >
      {content}
    </button>
  );
}

export default AchievementBadge;
