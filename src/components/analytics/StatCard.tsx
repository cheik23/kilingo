import type { ComponentType } from "react";

import { CountUp } from "@/components/fx/rewards";
import { cn } from "@/lib/utils";
import { TrendIndicator } from "./TrendIndicator";

/* ═══════════════════════════════════════════════════════════════════════
   CARTE KPI — icône, valeur, tendance, sous-titre.

   `value` accepte un nombre (alors compté de 0 à la valeur, `CountUp`) ou
   une chaîne déjà formatée (« 4 h 35 », « 87 % ») pour les unités
   composées. `trend` reste optionnel : sans période précédente comparable
   la carte n'affiche aucune flèche plutôt qu'un faux « +0 % ».
   ═══════════════════════════════════════════════════════════════════════ */

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendSuffix,
  trendInvert,
  hint,
  accent = false,
  loading = false,
  className,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  /** Variation en % vs période précédente (`null` = incomparable). */
  trend?: number | null;
  trendSuffix?: string;
  trendInvert?: boolean;
  /** Ligne secondaire (« record : 11 », « 32 min aujourd'hui »). */
  hint?: string;
  /** Met la valeur en or (KPI mis en avant). */
  accent?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "ln-card relative overflow-hidden rounded-xl border-white/5 p-4 transition-transform hover:-translate-y-0.5",
        className,
      )}
      aria-busy={loading || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <Icon className="size-4 text-gold" />
        </span>
        {trend !== undefined && !loading && (
          <TrendIndicator delta={trend} suffix={trendSuffix} invert={trendInvert} />
        )}
      </div>

      <p className="mt-3 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        {label}
      </p>

      {loading ? (
        <span className="mt-1.5 block h-7 w-20 animate-pulse rounded-md bg-white/10" />
      ) : (
        <p
          className={cn(
            "mt-1 font-display text-2xl font-bold",
            accent ? "text-gold" : "text-ink",
          )}
        >
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </p>
      )}

      {hint && <p className="mt-0.5 truncate text-[0.6875rem] text-ink-3">{hint}</p>}
    </article>
  );
}

export default StatCard;
