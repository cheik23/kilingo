import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookOpenCheck, Clock3, Flame, Info, Target } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   TABLEAU DE BORD — socle visuel (Recharts + KPIs).

   ⚠️ ÉTAPE UI UNIQUEMENT : toutes les valeurs ci-dessous sont des
   constantes de démonstration (`DEMO_*`). Aucune requête Convex n'est
   faite ici — la logique backend n'est pas touchée. Le branchement se
   fera en remplaçant les deux constantes par des queries, sans changer
   la structure des composants.

   Le thème clair/sombre vient des tokens CSS (`--gold-primary`,
   `--ink-3`, `--gold-light`) : Recharts écrit des couleurs concrètes
   dans le SVG, donc on les LIT sur le thème actif au lieu d'écrire
   `var(...)` dans un attribut (ce qui ne serait pas résolu).
   ═══════════════════════════════════════════════════════════════════ */

type Palette = { gold: string; goldSoft: string; axis: string };

const FALLBACK_PALETTE: Palette = {
  gold: "#d4a574",
  goldSoft: "#8a5a33",
  axis: "#8b8b8b",
};

function readPalette(): Palette {
  if (typeof document === "undefined") return FALLBACK_PALETTE;
  const styles = getComputedStyle(document.documentElement);
  const readVar = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    gold: readVar("--gold-primary", FALLBACK_PALETTE.gold),
    goldSoft: readVar("--gold-light", FALLBACK_PALETTE.goldSoft),
    axis: readVar("--ink-3", FALLBACK_PALETTE.axis),
  };
}

/** Couleurs de graphe du thème actif, relues quand `data-theme` change. */
function useChartPalette(): Palette {
  const [palette, setPalette] = useState<Palette>(readPalette);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const update = () =>
      setPalette((prev) => {
        const next = readPalette();
        return next.gold === prev.gold &&
          next.goldSoft === prev.goldSoft &&
          next.axis === prev.axis
          ? prev
          : next;
      });
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    update();
    return () => observer.disconnect();
  }, []);

  return palette;
}

/* ── Données de démonstration ─────────────────────────────────────── */

const DEMO_KPIS: ReadonlyArray<{
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}> = [
  {
    label: "Temps d'étude",
    value: "4 h 35",
    sub: "cette semaine · +12 %",
    icon: Clock3,
  },
  {
    label: "Leçons terminées",
    value: "42",
    sub: "sur 56 au programme",
    icon: BookOpenCheck,
  },
  {
    label: "Jours consécutifs",
    value: "6",
    sub: "record personnel : 11",
    icon: Flame,
    accent: true,
  },
  {
    label: "Précision moyenne",
    value: "87 %",
    sub: "sur les 7 derniers jours",
    icon: Target,
  },
];

/** Minutes d'étude par jour — 7 derniers jours (fictif). */
const DEMO_ACTIVITY = [
  { day: "Lun", minutes: 32 },
  { day: "Mar", minutes: 48 },
  { day: "Mer", minutes: 21 },
  { day: "Jeu", minutes: 57 },
  { day: "Ven", minutes: 39 },
  { day: "Sam", minutes: 64 },
  { day: "Dim", minutes: 26 },
];

function DashboardTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const minutes = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-xl border border-gold/30 bg-noir-2 px-3 py-2 text-xs shadow-xl">
      <p className="font-mono text-[0.625rem] text-ink-3">{label}</p>
      <p className="font-semibold text-gold">
        {minutes} min d'étude
      </p>
    </div>
  );
}

export function StatsDashboard() {
  const palette = useChartPalette();
  const totalMinutes = DEMO_ACTIVITY.reduce((sum, d) => sum + d.minutes, 0);
  const bestDay = DEMO_ACTIVITY.reduce((best, d) =>
    d.minutes > best.minutes ? d : best,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── En-tête ───────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Tableau de bord
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-3">
            Vue d'ensemble · activité, régularité et précision
          </p>
        </div>
        <p className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1.5 text-[0.6875rem] text-ink-2">
          <Info className="size-3.5 text-gold" />
          Données de démonstration — en attente des maquettes finales
        </p>
      </header>

      {/* ── 4 cartes KPI ──────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DEMO_KPIS.map((kpi) => (
          <article
            key={kpi.label}
            className="ln-card rounded-xl border-white/5 p-4"
          >
            <span className="flex size-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <kpi.icon className="size-4 text-gold" />
            </span>
            <p className="mt-3 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {kpi.label}
            </p>
            <p
              className={`mt-1 font-display text-2xl font-bold ${
                kpi.accent ? "text-gold" : "text-ink"
              }`}
            >
              {kpi.value}
            </p>
            <p className="mt-0.5 truncate text-[0.6875rem] text-ink-3">
              {kpi.sub}
            </p>
          </article>
        ))}
      </section>

      {/* ── Graphique principal — 7 derniers jours ────────────────── */}
      <section className="ln-card rounded-xl border-white/5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-mono text-[0.6875rem] tracking-[0.2em] text-ink-3 uppercase">
              7 derniers jours
            </h2>
            <p className="mt-1 font-mono text-xs text-ink-3">
              {totalMinutes} min d'étude · meilleur jour : {bestDay.day} (
              {bestDay.minutes} min)
            </p>
          </div>
          <span className="flex items-center gap-2 text-[0.6875rem] text-ink-3">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: palette.gold }}
            />
            Minutes d'étude
          </span>
        </div>

        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={DEMO_ACTIVITY}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="ln-dashboard-gold"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={palette.gold}
                    stopOpacity={0.42}
                  />
                  <stop
                    offset="100%"
                    stopColor={palette.gold}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={palette.axis}
                strokeOpacity={0.14}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fill: palette.axis, fontSize: 11 }}
                axisLine={{ stroke: palette.axis, strokeOpacity: 0.25 }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={36}
                tick={{ fill: palette.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <RTooltip
                content={<DashboardTip />}
                cursor={{ stroke: palette.gold, strokeOpacity: 0.35 }}
              />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke={palette.gold}
                strokeWidth={2}
                fill="url(#ln-dashboard-gold)"
                dot={{ r: 3, fill: palette.gold, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: palette.goldSoft }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
