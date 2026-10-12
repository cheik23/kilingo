import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOptionalQuery } from "@/lib/optionalQuery";
import {
  WorldMapLanguages,
} from "./WorldMapLanguages";
import { LANGUAGE_COUNTRIES, LANGUAGE_GEO } from "@/data/languages-geo";
import { useI18n } from "@/lib/i18n";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  BarChart3,
  BookOpenCheck,
  Clock3,
  Compass,
  Download,
  Film,
  Flame,
  Info,
  MessagesSquare,
  Moon,
  Repeat,
  Sparkles,
  Target,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { LANGUAGES } from "@/convex/languages";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { StatCard } from "@/components/analytics/StatCard";
import { ProgressRing } from "@/components/analytics/ProgressRing";
import { TrendIndicator } from "@/components/analytics/TrendIndicator";
import { useChartPalette } from "@/components/analytics/chartTheme";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   TABLEAU DE BORD — données réelles Convex (aucune constante de démo).

   Sources (lecture seule, tables existantes) :
   - `analytics.getActivitySeries(90)` : UNE requête pour toutes les
     périodes ; le sélecteur découpe la série côté client, donc changer de
     période ne coûte aucune lecture supplémentaire ;
   - `stats.overview` : XP, niveau, série, rétention, temps total ;
   - `stats.skills` : écoute / lecture / vocabulaire / argot ;
   - `analytics.getLanguageBreakdown` : répartition par langue ;
   - `analytics.getActivityHeatmap` : 90 jours → agrégat par heure ;
   - `analytics.getGoals` + `getInsights` + `getRecentActivity` : objectifs,
     force/faiblesse, fil d'activité.

   Les tendances sont TOUJOURS un calcul période courante vs période
   précédente de même longueur. Quand la comparaison n'a pas de sens
   (aucune donnée d'un côté), la flèche affiche « — » au lieu d'un faux
   0 %. Aucune valeur n'est inventée pour remplir une carte.
   ═══════════════════════════════════════════════════════════════════════ */

const SERIES_DAYS = 90;

type PeriodKey = "today" | "7d" | "30d" | "all";

const PERIODS: ReadonlyArray<{ key: PeriodKey; label: string; days: number }> = [
  { key: "today", label: "Aujourd'hui", days: 1 },
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
  { key: "all", label: "Tout (90 j)", days: SERIES_DAYS },
];

type SeriesPoint = {
  date: string;
  minutes: number;
  shadowingMinutes: number;
  conversationMinutes: number;
  sessions: number;
  reviews: number;
  words: number;
};

type Goal = {
  _id: string;
  language: string;
  target: number;
  deadline?: number;
  origin: string;
  current: number;
};

const SKILL_LABELS: Array<{ key: "listening" | "reading" | "vocab" | "slang"; label: string }> = [
  { key: "listening", label: "Écoute" },
  { key: "reading", label: "Lecture" },
  { key: "vocab", label: "Vocabulaire" },
  { key: "slang", label: "Argot" },
];

/** Icône + teinte par type d'événement du fil d'activité. */
const ACTIVITY: Record<string, typeof Sparkles> = {
  shadowing: Repeat,
  sleep: Moon,
  discovery: Compass,
  srs: BookOpenCheck,
  conversation: MessagesSquare,
  media: Film,
  achievement: Award,
};

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  return `${hours} h ${String(total % 60).padStart(2, "0")}`;
}

function dayLabel(date: string, withMonth = false): string {
  const ms = new Date(`${date}T00:00:00Z`).getTime();
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    ...(withMonth ? { month: "short" } : {}),
    timeZone: "UTC",
  }).format(ms);
}

function fullDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`).getTime());
}

/** Variation en % entre deux cumuls ; `null` si la base est nulle. */
function change(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

/** Série de jours consécutifs actifs qui se termine au dernier jour donné. */
function streakAtEnd(points: SeriesPoint[]): number {
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const active = points[i].minutes > 0 || points[i].sessions > 0;
    if (!active) break;
    streak += 1;
  }
  return streak;
}

function relativeTime(at: number): string {
  const diff = at - Date.now();
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return "à l'instant";
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ln-card rounded-xl border-white/5 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-[0.6875rem] tracking-[0.2em] text-ink-3 uppercase">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-xs text-ink-3">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Loading({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}

/* ── Infobulle du graphique principal ─────────────────────────────── */

function ActivityTip({
  active,
  payload,
  label,
  date,
  palette,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string }>;
  label?: string | number;
  date?: string;
  palette: ReturnType<typeof useChartPalette>;
}) {
  if (!active || !payload?.length) return null;
  const read = (key: string) =>
    Number(payload.find((entry) => entry.dataKey === key)?.value ?? 0);
  const total = read("shadowing") + read("conversation");
  return (
    <div
      className="rounded-xl border border-gold/30 px-3 py-2 text-xs shadow-xl"
      style={{ background: palette.surface }}
    >
      <p className="font-mono text-[0.625rem] text-ink-3 capitalize">
        {date ? fullDate(date) : label}
      </p>
      <p className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
        <span className="size-2 rounded-full" style={{ background: palette.gold }} aria-hidden />
        Shadowing · {read("shadowing")} min
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-ink">
        <span className="size-2 rounded-full" style={{ background: palette.blue }} aria-hidden />
        Conversation · {read("conversation")} min
      </p>
      <p className="mt-1 border-t border-white/10 pt-1 font-mono text-[0.625rem] text-ink-3">
        {total} min au total
      </p>
    </div>
  );
}

export function StatsDashboard() {
  const palette = useChartPalette();
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const { t } = useI18n();

  /* Le NOM vient de i18n (`languages.<code>`, présent dans les six dictionnaires)
     et la GÉOGRAPHIE de LANGUAGE_GEO : une seule source par information. Le
     libellé français figé qui vivait ici avait déjà produit des clés brutes à
     l'écran (« lang.fr »), puis un nom identique dans toutes les langues. */
  const languageLabel = (code: string) => t(`languages.${code}`);

  const selectedLangHint = selectedLang
    ? `${languageLabel(selectedLang)} · ${
        LANGUAGE_COUNTRIES[selectedLang]?.length ?? 0
      } pays pleins`
    : "Sélectionne une langue pour voir sa couverture géographique";

  // Lecture TOLÉRANTE : ces deux fonctions sont récentes — un backend en
  // retard (front déployé avant lui) doit dégrader proprement, jamais faire
  // tomber tout l'écran sur l'ErrorBoundary.
  const seriesRead = useOptionalQuery(api.analytics.getActivitySeries, { days: SERIES_DAYS });
  const series = seriesRead.data as SeriesPoint[] | undefined;
  const overview = useQuery(api.stats.overview);
  const skills = useQuery(api.stats.skills);
  const languages = useQuery(api.analytics.getLanguageBreakdown);
  const heatmap = useQuery(api.analytics.getActivityHeatmap);
  const insights = useQuery(api.analytics.getInsights);
  const goals = useQuery(api.analytics.getGoals) as Goal[] | undefined;
  const recent = useOptionalQuery(api.analytics.getRecentActivity, { limit: 8 }).data;

  const seedSuggested = useMutation(api.analytics.seedSuggestedGoals);

  const activePeriod = PERIODS.find((p) => p.key === period) ?? PERIODS[1];
  const days = activePeriod.days;

  const view = useMemo(() => {
    if (!series) return null;
    const current = series.slice(-days);
    const previous = series.slice(-2 * days, -days);

    const sum = (points: SeriesPoint[], key: keyof SeriesPoint) =>
      points.reduce((total, point) => total + (point[key] as number), 0);

    const minutesCurrent = sum(current, "minutes");
    const minutesPrevious = sum(previous, "minutes");
    const sessionsCurrent = sum(current, "sessions");
    const sessionsPrevious = sum(previous, "sessions");
    const streakCurrent = streakAtEnd(current);
    const streakPrevious = streakAtEnd(previous);

    return {
      current,
      previous,
      minutesCurrent,
      sessionsCurrent,
      streakCurrent,
      minutesTrend: change(minutesCurrent, minutesPrevious),
      sessionsTrend: change(sessionsCurrent, sessionsPrevious),
      // Progression de série : différence de longueur avec la fin de la
      // période précédente (en jours, pas en %). `null` si rien à comparer.
      streakTrend: streakPrevious === 0 && streakCurrent === 0 ? null : streakCurrent - streakPrevious,
      shadowingCurrent: sum(current, "shadowingMinutes"),
      conversationCurrent: sum(current, "conversationMinutes"),
      wordsCurrent: sum(current, "words"),
      reviewsCurrent: sum(current, "reviews"),
      bestDay: current.reduce<SeriesPoint | null>(
        (best, point) => (best === null || point.minutes > best.minutes ? point : best),
        null,
      ),
    };
  }, [series, days]);

  // Objectifs « suggested » amorcés une seule fois par compte (idempotent).
  const goalsEmpty = goals !== undefined && goals.length === 0;
  useEffect(() => {
    if (goalsEmpty) void seedSuggested({});
  }, [goalsEmpty, seedSuggested]);

  /** « Aujourd'hui » côté serveur (dernier jour de la série) — pas l'horloge locale. */
  const todayMs = useMemo(() => {
    if (!series || series.length === 0) return null;
    return new Date(`${series[series.length - 1].date}T00:00:00Z`).getTime();
  }, [series]);

  const hourBuckets = useMemo(() => {
    if (!heatmap) return null;
    const perHour = new Array<number>(24).fill(0);
    for (const cell of heatmap.cells) perHour[cell.hour] += cell.count;
    const max = Math.max(0, ...perHour);
    const peak = perHour.indexOf(max);
    return { perHour, max, peak };
  }, [heatmap]);

  const skillBars = useMemo(() => {
    if (!skills) return null;
    return SKILL_LABELS.map(({ key, label }) => ({ label, value: skills[key] }));
  }, [skills]);

  /** Avancement moyen des objectifs actifs (0..1) — 0 sans objectif. */
  const goalRatio = useMemo(() => {
    if (!goals || goals.length === 0) return 0;
    return (
      goals.reduce(
        (total, goal) => total + Math.min(1, goal.current / Math.max(1, goal.target)),
        0,
      ) / goals.length
    );
  }, [goals]);

  const exportCsv = () => {
    if (!view || view.current.length === 0) {
      toast.error("Rien à exporter sur cette période.");
      return;
    }
    const header = [
      "date",
      "minutes_totales",
      "minutes_shadowing",
      "minutes_conversation",
      "sessions",
      "revisions",
      "expressions",
    ];
    const lines = view.current.map((point) =>
      [
        point.date,
        point.minutes,
        point.shadowingMinutes,
        point.conversationMinutes,
        point.sessions,
        point.reviews,
        point.words,
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `kilingo-activite-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${lines.length} ligne(s) exportée(s).`);
  };

  const loading = series === undefined || overview === undefined;

  /* CARTE MONDIALE — indépendante des statistiques : un nouvel arrivant doit
     voir les langues disponibles avant d'avoir la moindre session. Rendue une
     seule fois puis réutilisée par chaque branche de la vue (état vide et
     backend indisponible compris), pour qu'aucune ne puisse la faire
     disparaître. */
  const worldMapSection = (
    <>
      <div className="flex flex-wrap gap-2">
        {LANGUAGE_GEO.map(({ code }) => (
          <button
            key={code}
            type="button"
            onClick={() => setSelectedLang(selectedLang === code ? null : code)}
            className={`rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
              selectedLang === code
                ? "border-gold bg-gold/15 text-gold"
                : "border-white/10 text-ink-2 hover:border-gold/40"
            }`}
          >
            {languageLabel(code)}
          </button>
        ))}
      </div>
      <WorldMapLanguages
        selectedLanguage={selectedLang}
        languagesCountries={LANGUAGE_COUNTRIES}
        className="w-full h-[400px]"
      />
      <p className="mt-2 font-mono text-[0.6875rem] text-ink-3">{selectedLangHint}</p>
    </>
  );

  // Backend en retard : on le DIT au lieu d'un squelette éternel ou d'un crash.
  if (seriesRead.unavailable) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <DashboardHeader period={period} onPeriod={setPeriod} onExport={exportCsv} disabled />
        {worldMapSection}
        <section className="ln-card rounded-xl border-white/5 p-8 text-center">
          <Info className="mx-auto size-9 text-gold/60" aria-hidden />
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">
            Statistiques indisponibles pour le moment
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-2">
            Cette vue n'est pas encore disponible. Aucune donnée n'est perdue : tes sessions,
            cartes et conversations restent intactes et réapparaîtront ici dès que la mise à jour
            sera terminée.
          </p>
          <Link
            to="/app/analytics"
            className="mt-5 inline-block rounded-xl border border-gold/35 px-4 py-2.5 text-sm font-semibold text-gold"
          >
            Voir mes statistiques détaillées
          </Link>
        </section>
      </div>
    );
  }

  if (insights && !insights.active) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <DashboardHeader period={period} onPeriod={setPeriod} onExport={exportCsv} disabled />
        {worldMapSection}
        <div className="ln-card flex flex-col items-center rounded-xl border-white/5 p-10 text-center">
          <BarChart3 className="size-10 text-gold/60" />
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">
            Commence à pratiquer pour voir tes stats
          </h2>
          <p className="mt-2 max-w-md text-sm text-ink-2">
            Aucune session enregistrée pour l'instant. Une séance de Shadowing, une révision ou
            une conversation suffisent : le tableau de bord se remplit tout seul.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              to="/app/shadow"
              className="rounded-xl bg-gradient-to-r from-gold-strong to-gold px-4 py-2.5 text-sm font-semibold text-noir"
            >
              Lancer un Shadowing
            </Link>
            <Link
              to="/app/memory"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-ink hover:border-gold/40"
            >
              Réviser mes cartes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeader
        period={period}
        onPeriod={setPeriod}
        onExport={exportCsv}
        disabled={loading}
      />

      {/* CARTE MONDIALE — toujours visible, même sans aucune donnée. */}
      {worldMapSection}

      {/* ── 1. KPIs ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Temps d'étude"
          value={loading ? 0 : formatMinutes(view?.minutesCurrent ?? 0)}
          icon={Clock3}
          trend={view?.minutesTrend}
          hint={
            loading
              ? undefined
              : `${formatMinutes(overview.minutesToday)} aujourd'hui · total ${formatMinutes(
                  overview.minutesTotal,
                )}`
          }
          loading={loading}
          accent
        />
        <StatCard
          label="Leçons terminées"
          value={view?.sessionsCurrent ?? 0}
          icon={BookOpenCheck}
          trend={view?.sessionsTrend}
          hint={
            loading
              ? undefined
              : `${view?.reviewsCurrent ?? 0} carte(s) revue(s) · ${view?.wordsCurrent ?? 0} expression(s)`
          }
          loading={loading}
        />
        <StatCard
          label="Jours consécutifs"
          value={view?.streakCurrent ?? 0}
          icon={Flame}
          trend={view?.streakTrend}
          trendSuffix=" j"
          hint={
            loading
              ? undefined
              : `record : ${Math.max(overview.streakLongest, view?.streakCurrent ?? 0)} j`
          }
          loading={loading}
        />
        <StatCard
          label="Précision moyenne"
          value={`${Math.round((overview?.retention7d ?? 0) * 100)} %`}
          icon={Target}
          trend={null}
          hint="rétention estimée · 7 j glissants"
          loading={loading}
        />
      </section>

      {/* ── 2. Graphique principal ──────────────────────────────────── */}
      <section className="ln-card rounded-xl border-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-[0.6875rem] tracking-[0.2em] text-ink-3 uppercase">
              Activité — {activePeriod.label}
            </h2>
            {view && (
              <p className="mt-1 text-xs text-ink-3">
                {view.shadowingCurrent} min de Shadowing · {view.conversationCurrent} min de
                conversation ·{" "}
                {view.bestDay && view.bestDay.minutes > 0
                  ? `meilleur jour : ${dayLabel(view.bestDay.date, true)} (${view.bestDay.minutes} min)`
                  : "aucune minute enregistrée sur la période"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 text-[0.6875rem] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: palette.gold }}
                aria-hidden
              />
              Shadowing
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: palette.blue }}
                aria-hidden
              />
              Conversation IA
            </span>
          </div>
        </div>

        {loading ? (
          <Loading className="mt-4 h-64" />
        ) : (
          <div
            className="mt-4 h-64"
            role="img"
            aria-label={`Graphique d'aire : minutes de Shadowing et de conversation IA par jour sur ${activePeriod.label}. ${view?.shadowingCurrent ?? 0} minutes de Shadowing et ${view?.conversationCurrent ?? 0} minutes de conversation au total.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={view?.current.map((point) => ({
                  date: point.date,
                  label: dayLabel(point.date, days > 7),
                  shadowing: point.shadowingMinutes,
                  conversation: point.conversationMinutes,
                }))}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ln-grad-gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.gold} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={palette.gold} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ln-grad-blue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.blue} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={palette.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={palette.grid} strokeOpacity={0.14} vertical={false} />
                <XAxis
                  dataKey="label"
                  minTickGap={18}
                  interval="preserveStartEnd"
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
                  content={<ActivityTip palette={palette} />}
                  cursor={{ stroke: palette.gold, strokeOpacity: 0.3 }}
                />
                <Area
                  type="monotone"
                  dataKey="shadowing"
                  name="Shadowing"
                  stroke={palette.gold}
                  strokeWidth={2}
                  fill="url(#ln-grad-gold)"
                />
                <Area
                  type="monotone"
                  dataKey="conversation"
                  name="Conversation IA"
                  stroke={palette.blue}
                  strokeWidth={2}
                  fill="url(#ln-grad-blue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── 3. Détails (2 colonnes) ─────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionCard
            title="Progression par compétence"
            subtitle="Score 0-100 dérivé du volume réel (sessions et cartes)"
          >
            {skillBars === null ? (
              <Loading className="h-48" />
            ) : (
              <div
                className="h-48"
                role="img"
                aria-label={`Barres horizontales : ${skillBars
                  .map((bar) => `${bar.label} ${bar.value} sur 100`)
                  .join(", ")}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={skillBars}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke={palette.grid} strokeOpacity={0.12} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: palette.axis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={84}
                      tick={{ fill: palette.axis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      cursor={{ fill: palette.gold, fillOpacity: 0.06 }}
                      formatter={(value) => [`${value}/100`, "Score"]}
                      contentStyle={{
                        background: palette.surface,
                        border: `1px solid ${palette.gold}55`,
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                      {skillBars.map((bar, index) => (
                        <Cell
                          key={bar.label}
                          fill={
                            [palette.gold, palette.green, palette.blue, palette.violet][index % 4]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Langues pratiquées"
            subtitle="Part de tes cartes et favoris, par langue d'apprentissage"
          >
            {languages === undefined ? (
              <Loading className="h-48" />
            ) : languages.length === 0 ? (
              <p className="text-sm text-ink-3">
                Aucune langue pratiquée : ajoute une expression à ton deck pour voir la
                répartition.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-6">
                <div
                  className="h-44 w-44 shrink-0"
                  role="img"
                  aria-label={`Diagramme circulaire : ${languages
                    .map((entry) => `${entry.language} ${entry.percentage} %`)
                    .join(", ")}.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={languages}
                        dataKey="count"
                        nameKey="language"
                        innerRadius={44}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {languages.map((entry, index) => (
                          <Cell
                            key={entry.language}
                            fill={
                              [palette.gold, palette.blue, palette.green, palette.violet, palette.orange, palette.red][
                                index % 6
                              ]
                            }
                          />
                        ))}
                      </Pie>
                      <RTooltip
                        formatter={(value, name) => [`${value} éléments`, name]}
                        contentStyle={{
                          background: palette.surface,
                          border: `1px solid ${palette.gold}55`,
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-2">
                  {languages.map((entry, index) => {
                    const meta = LANGUAGES.find((lang) => lang.code === entry.language);
                    return (
                      <li key={entry.language} className="flex items-center gap-2.5 text-sm">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            background: [
                              palette.gold,
                              palette.blue,
                              palette.green,
                              palette.violet,
                              palette.orange,
                              palette.red,
                            ][index % 6],
                          }}
                          aria-hidden
                        />
                        <FlagIcon languageCode={entry.language} />
                        <span className="min-w-0 flex-1 truncate text-ink">
                          {meta?.name ?? entry.language}
                        </span>
                        <span className="font-mono text-xs text-ink-3 tabular-nums">
                          {entry.count} · {entry.percentage} %
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Activité par heure"
            subtitle={
              heatmap?.insight ?? "Répartition des séances et révisions sur 90 jours (heure UTC)"
            }
          >
            {hourBuckets === null ? (
              <Loading className="h-48" />
            ) : hourBuckets.max === 0 ? (
              <p className="text-sm text-ink-3">Pas encore d'activité à répartir.</p>
            ) : (
              <div
                className="h-48"
                role="img"
                aria-label={`Histogramme horaire : pic d'activité à ${hourBuckets.peak} h avec ${hourBuckets.max} activités.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hourBuckets.perHour.map((count, hour) => ({ hour, count }))}
                    margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid stroke={palette.grid} strokeOpacity={0.12} vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: palette.axis, fontSize: 10 }}
                      tickFormatter={(hour: number) => `${hour}h`}
                      interval={3}
                      axisLine={{ stroke: palette.axis, strokeOpacity: 0.25 }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={34}
                      tick={{ fill: palette.axis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      cursor={{ fill: palette.gold, fillOpacity: 0.06 }}
                      formatter={(value) => [`${value} activité(s)`, "Volume"]}
                      labelFormatter={(hour) => `${hour}h - ${(Number(hour) + 1) % 24}h`}
                      contentStyle={{
                        background: palette.surface,
                        border: `1px solid ${palette.gold}55`,
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {hourBuckets.perHour.map((count, hour) => (
                        <Cell
                          key={hour}
                          fill={hour === hourBuckets.peak ? palette.orange : palette.gold}
                          fillOpacity={count === 0 ? 0.18 : 0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Objectifs en cours"
            subtitle="Progression recalculée depuis tes cartes réelles"
            action={
              goals && goals.length > 0 ? (
                <span className="font-mono text-[0.625rem] text-ink-3">
                  {goals.length} actif(s)
                </span>
              ) : undefined
            }
          >
            {goals === undefined ? (
              <Loading className="h-32" />
            ) : goals.length === 0 ? (
              <p className="text-sm text-ink-3">
                Aucun objectif actif — les suggestions sont en cours de création.
              </p>
            ) : (
              <ul className="space-y-4">
                {goals.slice(0, 4).map((goal) => {
                  const ratio = goal.target > 0 ? Math.min(1, goal.current / goal.target) : 0;
                  const meta = LANGUAGES.find((lang) => lang.code === goal.language);
                  const label =
                    goal.language === "total" ? "Toutes langues" : (meta?.name ?? goal.language);
                  const remaining = Math.max(0, goal.target - goal.current);
                  // « Aujourd'hui » vient du serveur (dernier jour de la série),
                  // pas de l'horloge du navigateur : rendu déterministe.
                  const daysLeft =
                    goal.deadline != null && todayMs !== null
                      ? Math.ceil((goal.deadline - todayMs) / 86_400_000)
                      : null;
                  return (
                    <li key={goal._id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          {goal.language !== "total" && (
                            <FlagIcon languageCode={goal.language} />
                          )}
                          <span className="truncate text-ink">{label}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-ink-3 tabular-nums">
                          {goal.current} / {goal.target}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-gold-strong to-gold"
                          style={{
                            width: `${Math.round(ratio * 100)}%`,
                            transition: "width 600ms ease-out",
                          }}
                        />
                      </div>
                      <p className="mt-1 font-mono text-[0.625rem] text-ink-3">
                        {remaining === 0
                          ? "Objectif atteint"
                          : `${remaining} restant(s)`}
                        {daysLeft !== null &&
                          (daysLeft >= 0
                            ? ` · échéance dans ${daysLeft} j`
                            : " · échéance dépassée")}
                        {goal.origin === "suggested" ? " · suggéré" : " · personnalisé"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Régularité"
            subtitle={`${overview?.mediaCount ?? 0} média(s) analysé(s) · série record ${overview?.streakLongest ?? 0} j`}
          >
            <div className="flex items-center gap-5">
              <ProgressRing
                value={goalRatio}
                label={goals && goals.length > 0 ? `${Math.round(goalRatio * 100)} %` : "—"}
                caption="objectifs"
                size={116}
              />
              <ul className="min-w-0 flex-1 space-y-2 text-sm text-ink-2">
                <li className="flex items-center justify-between gap-3">
                  <span>Niveau</span>
                  <span className="font-mono text-ink tabular-nums">
                    {overview?.level ?? 1} · {overview?.xp ?? 0} XP
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Mots maîtrisés</span>
                  <span className="font-mono text-ink tabular-nums">
                    {overview?.wordsMastered ?? 0}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Cartes à réviser aujourd'hui</span>
                  <span className="font-mono text-ink tabular-nums">{overview?.dueToday ?? 0}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Force / à relancer</span>
                  <span className="font-mono text-ink">
                    {insights?.strength ? insights.strength.language : "—"}
                    {" / "}
                    {insights?.weakness ? insights.weakness.language : "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Activité vs semaine précédente</span>
                  <TrendIndicator delta={insights?.delta ?? null} />
                </li>
              </ul>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── 4. Résumé d'activité ────────────────────────────────────── */}
      <SectionCard
        title="Résumé d'activité"
        subtitle="Tes dernières actions, toutes sources confondues"
        action={
          <Link to="/app/analytics" className="text-xs text-gold hover:underline">
            Analyse détaillée
          </Link>
        }
      >
        {recent === undefined ? (
          <div className="space-y-3">
            <Loading className="h-12" />
            <Loading className="h-12" />
            <Loading className="h-12" />
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-ink-3">Aucune action enregistrée sur les 60 derniers jours.</p>
        ) : (
          <ol className="relative space-y-4 border-s border-white/10 ps-6">
            {recent.map((entry) => {
              const Icon = ACTIVITY[entry.kind] ?? Sparkles;
              return (
                <li key={entry.id} className="relative">
                  <span className="absolute -start-[2.05rem] top-0.5 flex size-7 items-center justify-center rounded-full border border-gold/30 bg-noir-2">
                    <Icon className="size-3.5 text-gold" />
                  </span>
                  <p className="text-sm font-semibold text-ink">{entry.label}</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {entry.detail} · <time dateTime={new Date(entry.at).toISOString()}>{relativeTime(entry.at)}</time>
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>

      <p className="flex items-start gap-2 rounded-xl border border-gold/15 bg-gold/5 p-4 text-xs leading-relaxed text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" />
        Tes statistiques sont calculées en temps réel à partir de ton activité : temps d'écoute,
        expressions apprises, médias analysés et conversations pratiquées. Les flèches de tendance
        comparent ta progression avec la période précédente.
      </p>
    </div>
  );
}

/* ── En-tête : titre, sélecteur de période, export ──────────────────── */

function DashboardHeader({
  period,
  onPeriod,
  onExport,
  disabled,
}: {
  period: PeriodKey;
  onPeriod: (key: PeriodKey) => void;
  onExport: () => void;
  disabled: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Tableau de bord</h1>
        <p className="mt-1 font-mono text-xs text-ink-3">
          Vue d'ensemble · activité, régularité et précision
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Période affichée"
          className="flex flex-wrap gap-1 rounded-xl border border-white/8 bg-noir/60 p-1"
        >
          {PERIODS.map((option) => {
            const active = option.key === period;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onPeriod(option.key)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-gradient-to-r from-gold-strong to-gold text-noir"
                    : "text-ink-2 hover:bg-white/5 hover:text-ink",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={disabled}
          className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/15 disabled:opacity-50"
        >
          <Download className="size-3.5" aria-hidden />
          Exporter (CSV)
        </button>
      </div>
    </header>
  );
}

export default StatsDashboard;
