import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useChartPalette } from "./chartTheme";

/* ═══════════════════════════════════════════════════════════════════════
   TENDANCE — flèche haut/bas + pourcentage.

   `delta` est un pourcentage SIGNÉ (0 = plat). `null` = comparaison
   impossible (pas de période précédente, ou aucune donnée des deux côtés) :
   on affiche alors un tiret, jamais un « +0 % » mensonger.
   ═══════════════════════════════════════════════════════════════════════ */

export function TrendIndicator({
  delta,
  suffix = " %",
  invert = false,
  className,
}: {
  delta: number | null;
  suffix?: string;
  /** `true` quand une valeur qui MONTE est une mauvaise nouvelle (rang). */
  invert?: boolean;
  className?: string;
}) {
  // Vert / rouge du thème actif : lisibles sur crème comme sur nuit.
  const palette = useChartPalette();
  if (delta === null || !Number.isFinite(delta)) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-[0.6875rem] text-ink-3", className)}
        title="Pas de période précédente comparable"
      >
        <Minus className="size-3.5" aria-hidden />
        <span className="sr-only">Pas de comparaison disponible</span>
        <span aria-hidden>—</span>
      </span>
    );
  }

  const flat = Math.round(delta) === 0;
  const good = invert ? delta < 0 : delta > 0;
  const Arrow = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const rounded = Math.round(delta);

  return (
    <span
      style={{ color: flat ? undefined : good ? palette.green : palette.red }}
      className={cn(
        "inline-flex items-center gap-1 text-[0.6875rem] font-semibold",
        flat && "text-ink-3",
        className,
      )}
    >
      <Arrow className="size-3.5" aria-hidden />
      <span className="tabular-nums">
        {rounded > 0 ? "+" : ""}
        {rounded}
        {suffix}
      </span>
      <span className="sr-only">
        {flat
          ? "stable par rapport à la période précédente"
          : `${rounded > 0 ? "en hausse" : "en baisse"} par rapport à la période précédente`}
      </span>
    </span>
  );
}

export default TrendIndicator;
