import { useMemo } from "react";

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   HEATMAP D'ACTIVITÉ — grille type « contributions » (semaines × jours).

   Entrée = `stats.heatmap` : un point par jour, du plus ancien au plus
   récent, jours vides inclus (0). On n'invente rien : une case colorée
   correspond à des séances réellement enregistrées ; les cases après
   aujourd'hui sont marquées « hors période » et non cliquables.

   Le niveau (0-4) est dérivé du nombre de séances du jour ; l'échelle est
   relative au meilleur jour de la période affichée, sinon une heatmap de
   « gros joueur » resterait uniformément saturée.
   ═══════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;
const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

const WEEKDAYS = ["Lun", "", "Mer", "", "Ven", "", "Dim"];

export type HeatmapDay = { date: string; sessions: number };

function toMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function level(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const LEVEL_CLASS = [
  "bg-white/[0.06]",
  "bg-gold/20",
  "bg-gold/40",
  "bg-gold/65",
  "bg-gold",
] as const;

export function ActivityHeatmap({
  days,
  className,
  compact = false,
}: {
  days: HeatmapDay[];
  className?: string;
  /** Hauteur de case réduite (aperçu de profil). */
  compact?: boolean;
}) {
  const model = useMemo(() => {
    if (days.length === 0) return null;
    const byDate = new Map(days.map((d) => [d.date, d.sessions]));
    const firstMs = toMs(days[0].date);
    const lastMs = toMs(days[days.length - 1].date);
    // On cale la grille sur le lundi de la semaine du premier jour affiché.
    const mondayOffset = (new Date(firstMs).getUTCDay() + 6) % 7;
    const startMs = firstMs - mondayOffset * DAY_MS;

    const columns: Array<{ key: number; month: number; cells: Array<{ date: string | null; count: number }> }> = [];
    for (let t = startMs; t <= lastMs; t += 7 * DAY_MS) {
      const cells: Array<{ date: string | null; count: number }> = [];
      for (let d = 0; d < 7; d += 1) {
        const ms = t + d * DAY_MS;
        if (ms < firstMs || ms > lastMs) {
          cells.push({ date: null, count: 0 });
          continue;
        }
        const key = new Date(ms).toISOString().slice(0, 10);
        cells.push({ date: key, count: byDate.get(key) ?? 0 });
      }
      columns.push({ key: t, month: new Date(t).getUTCMonth(), cells });
    }

    const counts = days.map((d) => d.sessions);
    const max = Math.max(1, ...counts);
    const total = counts.reduce((a, b) => a + b, 0);
    const activeDays = counts.filter((c) => c > 0).length;
    const best = days.reduce(
      (acc, d) => (d.sessions > acc.sessions ? d : acc),
      { date: days[0].date, sessions: 0 },
    );
    return { columns, max, total, activeDays, best };
  }, [days]);

  if (!model) {
    return (
      <p className={cn("text-sm text-ink-3", className)}>
        Aucune activité enregistrée pour l'instant.
      </p>
    );
  }

  const cellSize = compact ? "size-2.5" : "size-3";
  const cellRadius = compact ? "rounded-[2px]" : "rounded-sm";

  return (
    <div className={className}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-[3px] pt-4">
          {WEEKDAYS.map((day, index) => (
            <span
              key={index}
              className={cn(
                "flex items-center font-mono text-[0.5625rem] text-ink-3",
                compact ? "h-2.5" : "h-3",
              )}
            >
              {day}
            </span>
          ))}
        </div>

        <div className="flex gap-[3px]">
          {model.columns.map((column, columnIndex) => {
            const showMonth =
              columnIndex === 0 || model.columns[columnIndex - 1].month !== column.month;
            return (
              <div key={column.key} className="flex flex-col gap-[3px]">
                <span className="h-4 font-mono text-[0.5625rem] whitespace-nowrap text-ink-3">
                  {showMonth ? MONTHS[column.month] : ""}
                </span>
                {column.cells.map((cell, index) => (
                  <span
                    key={index}
                    title={
                      cell.date
                        ? `${cell.date} · ${cell.count} séance${cell.count > 1 ? "s" : ""}`
                        : undefined
                    }
                    className={cn(
                      cellSize,
                      cellRadius,
                      cell.date === null
                        ? "bg-transparent"
                        : LEVEL_CLASS[level(cell.count, model.max)],
                    )}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-2">
          <span className="font-semibold text-ink">{model.activeDays}</span> jour
          {model.activeDays > 1 ? "s" : ""} actif{model.activeDays > 1 ? "s" : ""} ·{" "}
          <span className="font-semibold text-ink">{model.total}</span> séance
          {model.total > 1 ? "s" : ""} · meilleur jour {model.best.date} (
          {model.best.sessions})
        </p>
        <span className="flex items-center gap-1.5 font-mono text-[0.5625rem] text-ink-3 uppercase">
          Moins
          {LEVEL_CLASS.map((tone, index) => (
            <span key={tone} className={cn("size-3 rounded-sm", tone)} aria-hidden data-level={index} />
          ))}
          Plus
        </span>
      </div>
    </div>
  );
}

export default ActivityHeatmap;
