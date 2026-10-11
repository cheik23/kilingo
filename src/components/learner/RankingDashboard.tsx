import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
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
  Compass,
  Flame,
  Gem,
  HelpCircle,
  Info,
  Languages,
  MessagesSquare,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "react-router";

import { api } from "@/convex/_generated/api";
import { useOptionalQuery } from "@/lib/optionalQuery";
import { useChartPalette } from "@/components/analytics/chartTheme";
import { RankingItem } from "@/components/analytics/RankingItem";
import { LEAGUE_LABELS, type RankingEntry } from "@/components/analytics/leagues";
import { TrendIndicator } from "@/components/analytics/TrendIndicator";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   CLASSEMENT — global ou entre filleuls, sur trois fenêtres.

   Source unique de l'XP : la table `weeklyXp` (écrite uniquement par
   `recordWeeklyXp`). `ranking.getRankingBoard` agrège la fenêtre choisie
   et sa fenêtre précédente pour les flèches de progression ;
   `ranking.getFriendRanking` restreint la même agrégation à mon cercle de
   parrainage (aucune notion d'« ami » déclaratif n'existe en base).

   Ce que la donnée ne permet PAS, et qui n'est donc pas affiché :
   - un badge de spécialité par joueur (« Top Shadowing », « Polyglotte »)
     exigerait une table de métriques publiques qui n'existe pas encore ;
   - le détail du profil des autres joueurs (seuls nom, avatar, ligue et
     XP hebdomadaire sont lisibles).
   ═══════════════════════════════════════════════════════════════════════ */

type Scope = "global" | "friends";
type Period = "week" | "month" | "all";

const SCOPE_LABELS: Array<{ key: Scope; label: string; icon: typeof Trophy }> = [
  { key: "global", label: "Global", icon: Trophy },
  { key: "friends", label: "Mes filleuls", icon: Users },
];

const PERIOD_LABELS: Array<{ key: Period; label: string }> = [
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "all", label: "Tout" },
];

const CATEGORY_META: Record<string, { label: string; icon: typeof Award }> = {
  lang: { label: "Langues", icon: Languages },
  streak: { label: "Séries", icon: Flame },
  quiz: { label: "Quiz", icon: HelpCircle },
  conv: { label: "Conversation", icon: MessagesSquare },
  explore: { label: "Exploration", icon: Compass },
  collect: { label: "Collection", icon: Gem },
};

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ln-card rounded-xl border-white/5 p-5", className)}>
      <h2 className="font-mono text-[0.6875rem] tracking-[0.2em] text-ink-3 uppercase">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-ink-3">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Loading({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}

function Podium({ entries }: { entries: RankingEntry[] }) {
  // Ordre d'affichage 2 · 1 · 3 (le premier au centre, surélevé).
  const order = [entries[1], entries[0], entries[2]].filter(Boolean) as RankingEntry[];
  const heights = ["h-24", "h-32", "h-20"];
  const tones = ["#c0c8d0", "#d4af37", "#cd7f32"];

  return (
    <div className="grid grid-cols-3 items-end gap-3" aria-label="Podium du top 3">
      {order.map((entry) => {
        const position = entry.rank;
        return (
          <div key={entry.userId} className="flex flex-col items-center text-center">
            <span className="text-[0.6875rem] font-semibold text-ink-2">
              {LEAGUE_LABELS[entry.league] ?? entry.league}
            </span>
            <p className="mt-0.5 max-w-full truncate font-display text-sm font-bold text-ink">
              {entry.name}
            </p>
            <p className="font-mono text-xs text-gold tabular-nums">
              {entry.xp.toLocaleString("fr-FR")} XP
            </p>
            <div
              className={cn(
                "mt-2 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-white/10 pt-2",
                heights[position - 1],
              )}
              style={{ background: `linear-gradient(180deg, ${tones[position - 1]}33, transparent)` }}
            >
              <span
                className="font-display text-2xl font-bold"
                style={{ color: tones[position - 1] }}
              >
                {position}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RankingDashboard() {
  const palette = useChartPalette();
  const [scope, setScope] = useState<Scope>("global");
  const [period, setPeriod] = useState<Period>("week");

  const boardRead = useOptionalQuery(
    api.ranking.getRankingBoard,
    scope === "global" ? { period } : "skip",
  );
  const friendsRead = useOptionalQuery(
    api.ranking.getFriendRanking,
    scope === "friends" ? { period } : "skip",
  );
  const historyRead = useOptionalQuery(api.ranking.getRankingHistory, { weeks: 12 });
  const history = historyRead.data;
  const achievements = useQuery(api.achievements.getMyAchievements, {});

  /* Repli de production : le classement hebdomadaire (`leaderboard`) est déjà
     en production, le module multi-périodes non. Tant que `ranking` n'est pas
     déployé, la vue « Global · cette semaine » reste servie par l'ancienne
     lecture au lieu de laisser une page morte. */
  const legacyActive = boardRead.unavailable && scope === "global" && period === "week";
  const legacyRead = useOptionalQuery(
    api.leaderboard.getCurrentLeaderboard,
    legacyActive ? {} : "skip",
  );

  const active = useMemo(() => {
    if (scope === "friends") return friendsRead.data;
    if (boardRead.data) return boardRead.data;
    const legacy = legacyRead.data;
    if (!legacyActive || !legacy) return undefined;
    const entries = legacy.entries as RankingEntry[];
    return {
      period: "week" as const,
      days: 7,
      entries,
      my: legacy.my
        ? {
            rank: legacy.my.rank,
            xp: legacy.my.xp,
            league: legacy.my.league,
            previousRank: legacy.my.previousRank,
            rankDelta: legacy.my.rankDelta,
            participants: entries.length,
          }
        : null,
    };
  }, [scope, friendsRead.data, boardRead.data, legacyRead.data, legacyActive]);
  const entries = active?.entries ?? [];
  const my = active?.my ?? null;
  const top = entries.slice(0, 10);

  // Le rang de la semaine en cours est lu AVANT la mémoïsation : `history.current`
  // ressemble à un accès `ref.current` pour le compilateur React.
  const livePoint = history?.current ?? null;
  const historyData = useMemo(() => {
    if (!history) return [];
    const finalized = history.points.map((point) => ({
      label: point.weekKey.replace(/^\d{4}-W/, "S"),
      rank: point.rank,
      xp: point.xp,
      current: false,
    }));
    const live = livePoint
      ? [{ label: "En cours", rank: livePoint.rank, xp: livePoint.xp, current: true }]
      : [];
    return [...finalized, ...live];
  }, [history, livePoint]);

  const categories = useMemo(() => {
    if (!achievements) return null;
    const counts = new Map<string, number>();
    for (const item of achievements.items) {
      if (!item.completed) continue;
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([category, count]) => ({
        category,
        label: CATEGORY_META[category]?.label ?? category,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [achievements]);

  const medalTones = [palette.gold, palette.blue, palette.green, palette.violet, palette.orange, palette.red];

  /* Ni le module multi-périodes ni le repli hebdomadaire n'ont répondu :
     on explique au lieu de laisser un squelette éternel. */
  const unavailableHere =
    !legacyActive &&
    (scope === "friends" ? friendsRead.unavailable : boardRead.unavailable) &&
    legacyRead.data === undefined;

  if (unavailableHere) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PlaceHeader
          place="leaderboard"
          title="Classement"
          icon={Trophy}
          motif="kente"
          description="Global · par semaine, par mois ou depuis le début"
        />
        <section className="ln-card rounded-xl border-white/5 p-8 text-center">
          <Info className="mx-auto size-9 text-gold/60" aria-hidden />
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">
            Classement indisponible pour le moment
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-2">
            Le serveur ne fournit pas encore cette vue du classement
            {scope === "friends" ? " (filleuls)" : ""}. Ton XP et ta ligue restent enregistrés :
            ils réapparaîtront dès la prochaine mise à jour du backend.
          </p>
          <Link
            to="/app/dashboard"
            className="mt-5 inline-block rounded-xl border border-gold/35 px-4 py-2.5 text-sm font-semibold text-gold"
          >
            Voir mon tableau de bord
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PlaceHeader
        place="leaderboard"
        title="Classement"
        icon={Trophy}
        motif="kente"
        description={
          scope === "global"
            ? "XP réellement gagné sur la fenêtre choisie, toutes ligues confondues"
            : "Toi et tes filleuls rattachés à ton code de parrainage"
        }
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div
              role="group"
              aria-label="Portée du classement"
              className="flex gap-1 rounded-xl border border-white/8 bg-noir/60 p-1"
            >
              {SCOPE_LABELS.map((option) => {
                const Icon = option.icon;
                const isActive = option.key === scope;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setScope(option.key)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-gradient-to-r from-gold-strong to-gold text-noir"
                        : "text-ink-2 hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div
              role="group"
              aria-label="Période du classement"
              className="flex gap-1 rounded-xl border border-white/8 bg-noir/60 p-1"
            >
              {PERIOD_LABELS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPeriod(option.key)}
                  aria-pressed={option.key === period}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[0.6875rem] font-semibold transition-colors",
                    option.key === period
                      ? "bg-white/10 text-ink"
                      : "text-ink-3 hover:bg-white/5 hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {legacyActive && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/15 bg-gold/5 px-4 py-3 text-xs text-ink-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
          Vue hebdomadaire servie par le classement existant : les fenêtres <strong>Ce mois</strong>{" "}
          et <strong>Tout</strong>, ainsi que le classement entre filleuls, s'activeront avec la
          prochaine mise à jour du backend.
        </p>
      )}

      {/* ── Ma position ─────────────────────────────────────────────── */}
      <section className="ln-card relative overflow-hidden rounded-xl border-gold/30 bg-gradient-to-br from-gold/[0.08] to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <Trophy className="size-6 text-gold" />
            </span>
            <div>
              <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                Ma position · {PERIOD_LABELS.find((p) => p.key === period)?.label}
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-ink">
                {my ? `#${my.rank}` : "—"}
                <span className="ms-2 font-mono text-xs font-normal text-ink-3">
                  {my ? `sur ${my.participants} classé(s)` : "aucune activité sur la fenêtre"}
                </span>
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                XP gagné
              </dt>
              <dd className="mt-1 font-mono text-xl font-bold text-gold tabular-nums">
                {(my?.xp ?? 0).toLocaleString("fr-FR")}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                Ligue
              </dt>
              <dd className="mt-1 font-display text-lg font-bold text-ink">
                {LEAGUE_LABELS[my?.league ?? "bronze"]}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                Progression
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                {my?.previousRank == null ? (
                  <span className="text-xs text-ink-3">pas de période précédente</span>
                ) : (
                  <TrendIndicator delta={my.rankDelta} suffix=" pl." invert />
                )}
              </dd>
            </div>
          </dl>
        </div>

        {scope === "friends" && (
          <p className="mt-4 flex items-start gap-2 border-t border-white/8 pt-3 text-xs text-ink-3">
            <Users className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
            Le classement « Mes filleuls » ne contient que les comptes rattachés à ton code de
            parrainage. Invite quelqu'un depuis la page Inviter pour l'y voir apparaître.
          </p>
        )}
      </section>

      {/* ── Top 10 ──────────────────────────────────────────────────── */}
      <section className="ln-card rounded-xl border-white/5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="flex items-center gap-2 font-mono text-[0.6875rem] tracking-[0.2em] text-ink-3 uppercase">
            <Award className="size-4 text-gold" aria-hidden />
            Top 10
          </h2>
          {active && <span className="font-mono text-[0.625rem] text-ink-3">{entries.length} classé(s)</span>}
        </div>

        {active === undefined ? (
          <div className="mt-4 space-y-3">
            <Loading className="h-24" />
            <Loading className="h-12" />
            <Loading className="h-12" />
          </div>
        ) : top.length === 0 ? (
          <div className="mt-4 flex flex-col items-center py-10 text-center">
            <Trophy className="size-9 text-gold/60" aria-hidden />
            <p className="mt-3 font-display text-lg font-semibold text-ink">
              Aucun XP sur cette fenêtre
            </p>
            <p className="mt-1 max-w-md text-sm text-ink-3">
              {scope === "friends"
                ? "Ni toi ni tes filleuls n'avez gagné d'XP sur cette période : lance une session pour ouvrir le classement."
                : "Personne n'a encore gagné d'XP sur cette fenêtre. Une session, une révision ou une conversation suffisent."}
            </p>
          </div>
        ) : (
          <>
            {top.length >= 3 && (
              <div className="mt-6">
                <Podium
                  entries={top.slice(0, 3).map((entry) => ({
                    ...entry,
                    // Le podium se lit au rang réel, pas à la position du tableau.
                    rank: entry.rank,
                  }))}
                />
              </div>
            )}
            <div className="mt-6 space-y-2">
              {top.map((entry) => (
                <RankingItem key={entry.userId} entry={entry} small={entry.rank > 3} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Visualisations ─────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Évolution de mon rang"
          subtitle={
            history === undefined
              ? undefined
              : history.points.length > 0
                ? `Meilleur rang : #${history.bestRank} · ${history.points.length} semaine(s) finalisée(s)`
                : history.current !== null
                  ? `Aucune semaine finalisée : seul le rang live de la semaine en cours (#${history.current.rank}) est connu`
                  : "Aucune semaine finalisée ni XP sur la semaine en cours"
          }
        >
          {historyRead.unavailable ? (
            <p className="text-sm text-ink-3">
              Historique indisponible pour le moment : le serveur ne fournit pas encore la
              lecture semaine par semaine.
            </p>
          ) : history === undefined ? (
            <Loading className="h-52" />
          ) : historyData.length === 0 ? (
            <p className="text-sm text-ink-3">
              Aucune semaine finalisée pour l'instant : ton rang apparaîtra ici dimanche soir, à la
              clôture de la semaine ISO.
            </p>
          ) : (
            <div
              className="h-52"
              role="img"
              aria-label={`Courbe de mon rang par semaine : ${historyData
                .map((point) => `${point.label} rang ${point.rank}`)
                .join(", ")}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ln-rank-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.gold} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={palette.gold} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={palette.grid} strokeOpacity={0.14} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: palette.axis, fontSize: 11 }}
                    axisLine={{ stroke: palette.axis, strokeOpacity: 0.25 }}
                    tickLine={false}
                  />
                  <YAxis
                    reversed
                    allowDecimals={false}
                    width={36}
                    tick={{ fill: palette.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(rank) => `#${rank}`}
                  />
                  <RTooltip
                    formatter={(value) => [`rang #${value}`, "Position"]}
                    contentStyle={{
                      background: palette.surface,
                      border: `1px solid ${palette.gold}55`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rank"
                    stroke={palette.gold}
                    strokeWidth={2}
                    fill="url(#ln-rank-grad)"
                    dot={{ r: 3, fill: palette.gold, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Répartition des scores"
          subtitle="XP de la fenêtre, du 1er au 10e"
        >
          {active === undefined ? (
            <Loading className="h-52" />
          ) : top.length === 0 ? (
            <p className="text-sm text-ink-3">Rien à comparer sur cette fenêtre.</p>
          ) : (
            <div
              className="h-52"
              role="img"
              aria-label={`Barres : scores du top 10 — ${top
                .map((entry) => `${entry.rank}. ${entry.name} ${entry.xp} XP`)
                .join(", ")}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={top.map((entry) => ({
                    label: entry.rank === 1 ? entry.name.slice(0, 10) : `#${entry.rank}`,
                    xp: entry.xp,
                    isYou: entry.isYou,
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={palette.grid} strokeOpacity={0.14} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: palette.axis, fontSize: 10 }}
                    axisLine={{ stroke: palette.axis, strokeOpacity: 0.25 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={40}
                    tick={{ fill: palette.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RTooltip
                    formatter={(value) => [`${value} XP`, "Score"]}
                    cursor={{ fill: palette.gold, fillOpacity: 0.06 }}
                    contentStyle={{
                      background: palette.surface,
                      border: `1px solid ${palette.gold}55`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="xp" radius={[6, 6, 0, 0]}>
                    {top.map((entry, index) => (
                      <Cell
                        key={entry.userId}
                        fill={entry.isYou ? palette.green : medalTones[index % medalTones.length]}
                        fillOpacity={entry.isYou ? 1 : 0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Mes catégories dominantes"
          subtitle="Succès réellement débloqués, par famille"
          className="lg:col-span-2"
        >
          {categories === null ? (
            <Loading className="h-44" />
          ) : categories.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-3">
              <Sparkles className="size-4 text-gold" aria-hidden />
              Aucun succès débloqué pour l'instant — les catégories apparaîtront ici dès le premier
              badge.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-8">
              <div
                className="h-52 w-52 shrink-0"
                role="img"
                aria-label={`Diagramme circulaire de mes succès débloqués : ${categories
                  .map((entry) => `${entry.label} ${entry.count}`)
                  .join(", ")}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={50}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {categories.map((entry, index) => (
                        <Cell key={entry.category} fill={medalTones[index % medalTones.length]} />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(value, name) => [`${value} succès`, name]}
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
                {categories.map((entry, index) => {
                  const Icon = CATEGORY_META[entry.category]?.icon ?? BarChart3;
                  const total = categories.reduce((sum, item) => sum + item.count, 0);
                  return (
                    <li key={entry.category} className="flex items-center gap-3 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: medalTones[index % medalTones.length] }}
                        aria-hidden
                      />
                      <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-ink">{entry.label}</span>
                      <span className="font-mono text-xs text-ink-3 tabular-nums">
                        {entry.count} · {Math.round((entry.count / total) * 100)} %
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      <p className="flex items-start gap-3 rounded-2xl border border-gold/15 bg-gold/5 p-4 text-xs leading-relaxed text-ink-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
        Chaque semaine ISO, l'XP gagné est finalisé dans une ligue : les 20 % les mieux classés
        montent, les 20 % les moins actifs descendent (sous réserve d'atteindre le seuil d'XP de la
        ligue supérieure). Le classement se réinitialise chaque lundi.
      </p>
    </div>
  );
}

export default RankingDashboard;
