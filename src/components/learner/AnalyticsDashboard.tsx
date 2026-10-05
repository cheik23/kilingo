import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Archive, Headphones, Plus, Snowflake, Target, TrendingDown, Share2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uiLangMeta, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ShareModal } from "./ShareModal";
import { shareStats } from "@/lib/shareEngine";
import { useAuth } from "@/hooks/use-auth";

/* ═══════════════════════════════════════════════════════════════════
   ANALYTICS — « Ta progression » (Phase 1/4)

   Données : module analytics (cartes SRS, sessions, favoris, agrégats).
   Thème or/noir exclusivement ; Recharts pour le BarChart 7 jours,
   CSS grid pour la heatmap ; tout est sans crash sur données vides.
   ═══════════════════════════════════════════════════════════════════ */

const GOLD = "var(--gold-primary)";

type WeeklyPoint = { date: string; count: number };
type BreakdownRow = { language: string; count: number; percentage: number };
type HeatCell = { hour: number; dayOfWeek: number; count: number };
type Heatmap = { cells: HeatCell[]; insight: string | null };
type Insights = {
  strength: { language: string; count: number } | null;
  weakness: { language: string; daysIdle: number } | null;
  streak: number;
  retention: number;
  delta: number;
  mastered: number;
  corpusTotal: number;
  active: boolean;
};
type Goal = {
  _id: Id<"goals">;
  language: string;
  target: number;
  deadline?: number;
  origin: "suggested" | "custom";
  current: number;
};

/** Nom natif + drapeau d'une langue d'apprentissage (repli sûr). */
function langLabel(code: string): { name: string; flag: string } {
  if (code === "total") return { name: "Toutes les langues", flag: "🌍" };
  const meta = uiLangMeta(code);
  return { name: meta.native, flag: meta.flag };
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** getUTCDay (0 = dimanche) → ordre lundi-premier. */
const dayRow = (dow: number): number => (dow + 6) % 7;

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-gold/30 bg-noir-2 px-3 py-2 text-xs shadow-xl">
      <p className="font-mono text-[0.625rem] text-ink-3">{label}</p>
      <p className="font-semibold text-gold">
        {v} expression{Number(v) > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-3">
      {children}
    </h2>
  );
}

/* ── Heatmap 7 × 24 — CSS grid, gradient noir → or ────────────────── */

function HeatmapGrid({ data }: { data: Heatmap }) {
  const max = Math.max(1, ...data.cells.map((c) => c.count));
  const rows = [1, 2, 3, 4, 5, 6, 0]; // lundi → dimanche
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-px font-mono text-[0.5625rem] text-ink-3">
          {DAY_LABELS.map((d) => (
            <span key={d} className="leading-none">
              {d}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
          >
            {rows.map((dow) =>
              Array.from({ length: 24 }, (_, hour) => {
                const cell = data.cells.find(
                  (c) => c.dayOfWeek === dow && c.hour === hour,
                );
                const n = cell?.count ?? 0;
                const alpha = n === 0 ? 0 : 0.12 + 0.88 * Math.sqrt(n / max);
                return (
                  <div
                    key={`${dow}-${hour}`}
                    title={
                      n > 0
                        ? `${DAY_LABELS[dayRow(dow)]} ${hour}h — ${n} activité${n > 1 ? "s" : ""}`
                        : undefined
                    }
                    aria-label={
                      n > 0 ? `${DAY_LABELS[dayRow(dow)]} ${hour}h : ${n}` : undefined
                    }
                    className="aspect-square rounded-[2px] border border-white/[0.04]"
                    style={{
                      backgroundColor:
                        n === 0 ? "rgba(255,255,255,0.02)" : `rgba(212,165,116,${alpha.toFixed(3)})`,
                    }}
                  />
                );
              }),
            )}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[0.5625rem] text-ink-3">
            {[0, 6, 12, 18, 23].map((h) => (
              <span key={h}>{h}h</span>
            ))}
          </div>
        </div>
      </div>
      {data.insight && (
        <p className="mt-3 text-sm text-ink-2">
          <span aria-hidden>⏰</span> {data.insight}
        </p>
      )}
    </div>
  );
}

/* ── Objectifs ────────────────────────────────────────────────────── */

const GOAL_LANGS = [
  "en", "zh", "es", "ar", "ru", "sw", "ln", "ha", "yo", "zu", "wo", "total",
] as const;

function GoalCard({ goal, onArchive }: { goal: Goal; onArchive: (id: Id<"goals">) => void }) {
  const { name, flag } = langLabel(goal.language);
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const daysLeft = goal.deadline
    ? Math.max(0, Math.ceil((goal.deadline - Date.now()) / 86_400_000))
    : null;
  return (
    <div className="ln-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
          <span aria-hidden>{flag}</span>
          <span className="truncate">{name}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider ${
              goal.origin === "custom"
                ? "border-gold/40 text-gold"
                : "border-white/15 text-ink-3"
            }`}
          >
            {goal.origin === "custom" ? "Perso" : "Suggéré"}
          </span>
          <button
            type="button"
            onClick={() => onArchive(goal._id)}
            aria-label="Archiver l'objectif"
            className="rounded-lg p-1 text-ink-3 transition-colors hover:text-ink"
          >
            <Archive className="size-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-1 font-mono text-xs text-ink-2">
        {goal.current} / {goal.target} expressions
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[0.6875rem] text-ink-3">
        {pct}%{daysLeft !== null ? ` · ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}` : ""}
      </p>
    </div>
  );
}

function NewGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createGoal = useMutation(api.analytics.createGoal);
  const [language, setLanguage] = useState<string>("en");
  const [target, setTarget] = useState("50");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const n = Number(target);
    if (!Number.isFinite(n) || n < 1) {
      setError("Choisis une cible d'au moins 1.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createGoal({
        language: language as (typeof GOAL_LANGS)[number],
        target: n,
        deadline: deadline ? new Date(`${deadline}T23:59:59Z`).getTime() : undefined,
      });
      onOpenChange(false);
      setTarget("50");
      setDeadline("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-noir-2 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-ink">
            <Target className="size-4 text-gold" />
            Nouvel objectif
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            La barre suit ton nombre réel d'expressions — mise à jour en direct.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <span className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
              Langue
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-noir/60 p-2.5 text-sm text-ink outline-none focus:border-gold/50"
            >
              {GOAL_LANGS.map((code) => {
                const { name, flag } = langLabel(code);
                return (
                  <option key={code} value={code} className="bg-noir-2">
                    {flag} {name}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
              Cible (expressions)
            </span>
            <input
              type="number"
              min={1}
              max={100_000}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-noir/60 p-2.5 text-sm text-ink outline-none focus:border-gold/50"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
              Échéance (optionnelle)
            </span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-noir/60 p-2.5 text-sm text-ink outline-none focus:border-gold/50 [color-scheme:dark]"
            />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void submit()}
            className="bg-gradient-to-r from-gold to-gold-soft text-noir hover:opacity-90"
          >
            Créer l'objectif
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Vue principale ───────────────────────────────────────────────── */

export function AnalyticsDashboard() {
  const { t } = useI18n();
  const weekly = useQuery(api.analytics.getWeeklyProgress) as
    | WeeklyPoint[]
    | undefined;
  const breakdown = useQuery(api.analytics.getLanguageBreakdown) as
    | BreakdownRow[]
    | undefined;
  const heatmap = useQuery(api.analytics.getActivityHeatmap) as
    | Heatmap
    | undefined;
  const insights = useQuery(api.analytics.getInsights) as Insights | undefined;
  const goals = useQuery(api.analytics.getGoals) as Goal[] | undefined;

  const seedSuggested = useMutation(api.analytics.seedSuggestedGoals);
  const archiveGoal = useMutation(api.analytics.archiveGoal);
  const [goalDialog, setGoalDialog] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { user } = useAuth();
  const referrals = useQuery(api.referrals.getMyReferrals);
  const leaderboard = useQuery(api.leaderboard.getCurrentLeaderboard);
  const customization = useQuery(api.customization.getMyCustomization, {});
  const achievements = useQuery(api.achievements.getMyAchievements, {});

  // MOD 1 — Loss aversion : badge Freeze (A) + carte rouge decay (B).
  const stats = useQuery(api.gamification.getUserStats);
  const xpDecay = useQuery(api.gamification.getXpDecay, {}) as
    | { percent: number; daysInactive: number; xpPerWeek: number }
    | null
    | undefined;
  const buyFreeze = useMutation(api.gamification.buyFreeze);
  const [shopOpen, setShopOpen] = useState(false);

  const doBuyFreeze = (method: "gems" | "card") => {
    buyFreeze({ method })
      .then((r) => {
        if (!r.ok && r.reason === "not_enough_gems") {
          toast.error(t("freeze.notEnoughGems"));
          return;
        }
        if (method === "card") toast.success(t("freeze.purchaseSimulated"));
        else toast.success(t("freeze.bought"));
        setShopOpen(false);
      })
      .catch((e: Error) => toast.error(e.message));
  };

  // Premier passage sans objectif : amorce les 3 « suggested » (idempotent).
  const seededRef = useRef(false);
  useEffect(() => {
    if (goals === undefined || goals.length > 0 || seededRef.current) return;
    seededRef.current = true;
    void seedSuggested().catch(() => {
      /* le dashboard reste utilisable sans objectifs suggérés */
    });
  }, [goals, seedSuggested]);

  const weeklyData = (weekly ?? []).map((p) => ({
    ...p,
    label: new Date(`${p.date}T12:00:00Z`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));
  const totalWeek = weeklyData.reduce((a, p) => a + p.count, 0);
  const loading =
    weekly === undefined ||
    breakdown === undefined ||
    heatmap === undefined ||
    insights === undefined ||
    goals === undefined;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-shimmer h-28 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="animate-shimmer h-64 rounded-2xl" />
          <div className="animate-shimmer h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  /* Empty state : aucune session, aucune carte → pas de stats à montrer. */
  if (!insights!.active && totalWeek === 0) {
    return (
      <div className="ln-card mx-auto max-w-xl p-10 text-center">
        <Headphones className="mx-auto size-10 text-gold" />
        <h2 className="mt-4 font-display text-xl text-ink">
          Lance ta première session Shadow
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Tes stats de progression apparaîtront ici dès ta première immersion :
          expressions apprises, langues pratiquées, moments où tu apprends le
          mieux.
        </p>
        <Link
          to="/app/shadow"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-5 py-2.5 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
        >
          <Headphones className="size-4" />
          Ouvrir Shadow
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="ln-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Ta progression
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-3">
            {insights!.streak > 0
              ? `🔥 ${insights!.streak} jour${insights!.streak > 1 ? "s" : ""} consécutif${insights!.streak > 1 ? "s" : ""}`
              : "Série à démarrer — une session aujourd'hui 🔥"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-end">
          <p className="font-display text-2xl font-bold text-gold">
            {insights!.mastered.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-ink-3">
              / {insights!.corpusTotal.toLocaleString("fr-FR")}
            </span>
          </p>
          <p className="font-mono text-[0.6875rem] text-ink-3">expressions maîtrisées</p>
          </div>
          <button type="button" onClick={() => setShareOpen(true)} className="flex items-center gap-2 rounded-xl border border-gold/35 px-3 py-2 text-xs font-semibold text-gold"><Share2 className="size-4" />{t("share.button")}</button>
        </div>
      </header>

      {/* ── MOD 1 : Loss aversion (A + B) ─────────────────────────── */}
      {(stats || (xpDecay && xpDecay.percent > 0)) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {stats && (
            <button
              type="button"
              onClick={() => setShopOpen(true)}
              className="ln-card flex flex-1 items-center justify-between gap-3 p-4 text-start transition-colors hover:border-gold/40"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
                  <Snowflake className="size-5 text-gold" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    🧊 {t("freeze.badge", { n: stats.freezes })}
                  </span>
                  <span className="block font-mono text-[0.6875rem] text-ink-3">
                    💎 {stats.gems} gems
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold">
                {t("freeze.buy")}
              </span>
            </button>
          )}
          {xpDecay && xpDecay.percent > 0 && (
            <div className="flex flex-1 items-center gap-3 border border-red-400/30 bg-red-950/30 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-red-400/40 bg-red-400/10">
                <TrendingDown className="size-5 text-red-400" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  ⚠️ {t("decay.card", { x: xpDecay.xpPerWeek })}
                </p>
                <p className="font-mono text-[0.6875rem] text-red-300/80">
                  {t("decay.sub", { d: xpDecay.daysInactive, p: xpDecay.percent })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Insights ──────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InsightCard
          icon="💪"
          title="Force"
          value={
            insights!.strength
              ? `${langLabel(insights!.strength.language).flag} ${langLabel(insights!.strength.language).name}`
              : "—"
          }
          sub={
            insights!.strength
              ? `${insights!.strength.count} expressions en deck`
              : "Aucune langue encore"
          }
        />
        <InsightCard
          icon="⚠️"
          title="Faiblesse"
          value={
            insights!.weakness
              ? `${langLabel(insights!.weakness.language).flag} ${langLabel(insights!.weakness.language).name}`
              : "Aucune"
          }
          sub={
            insights!.weakness
              ? `Inactif depuis ${insights!.weakness.daysIdle} jours`
              : "Tout est actif 🔥"
          }
        />
        <InsightCard
          icon="📈"
          title="Cette semaine"
          value={`${insights!.delta >= 0 ? "+" : ""}${insights!.delta}%`}
          sub="vs semaine précédente"
          accent={insights!.delta >= 0}
        />
        <InsightCard
          icon="🎯"
          title="Rétention"
          value={`${insights!.retention}%`}
          sub="cartes revues / créées"
          accent={insights!.retention >= 70}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── 7 derniers jours ──────────────────────────────────── */}
        <section className="ln-card p-5">
          <SectionTitle>7 derniers jours</SectionTitle>
          <p className="mt-1 font-mono text-xs text-ink-3">
            {totalWeek} expression{totalWeek > 1 ? "s" : ""} apprise
            {totalWeek > 1 ? "s" : ""} cette semaine
          </p>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8b8b8b", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#8b8b8b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RTooltip content={<ChartTip />} cursor={{ fill: "rgba(212,165,116,0.08)" }} />
                <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ── Répartition par langue ────────────────────────────── */}
        <section className="ln-card p-5">
          <SectionTitle>Répartition par langue</SectionTitle>
          {(breakdown ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-ink-2">
              Ajoute des expressions à ton deck ou en favoris pour voir la
              répartition.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(breakdown ?? []).map((row) => {
                const { name, flag } = langLabel(row.language);
                return (
                  <li key={row.language}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-ink">
                        <span aria-hidden>{flag}</span> {name}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-ink-3">
                        {row.count} · {row.percentage}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                        style={{ width: `${row.percentage}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Heatmap 7 × 24 ────────────────────────────────────── */}
        <section className="ln-card p-5">
          <SectionTitle>Rythme d'apprentissage</SectionTitle>
          <p className="mt-1 font-mono text-xs text-ink-3">
            90 derniers jours · heure × jour de semaine
          </p>
          <div className="mt-4">
            <HeatmapGrid data={heatmap!} />
          </div>
        </section>

        {/* ── Objectifs ─────────────────────────────────────────── */}
        <section className="ln-card p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Objectifs</SectionTitle>
            <button
              type="button"
              onClick={() => setGoalDialog(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20"
            >
              <Plus className="size-3.5" />
              Nouvel objectif
            </button>
          </div>
          {(goals ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-ink-2">
              Aucun objectif actif — crée-en un pour donner un cap à ta
              progression.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {(goals ?? []).map((g) => (
                <GoalCard
                  key={g._id}
                  goal={g}
                  onArchive={(id) =>
                    void archiveGoal({ goalId: id }).catch(() => {
                      /* toast d'erreur non bloquant : la carte reste */
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <NewGoalDialog open={goalDialog} onOpenChange={setGoalDialog} />
      <BuyFreezeDialog
        open={shopOpen}
        onOpenChange={setShopOpen}
        gems={stats?.gems ?? 0}
        onBuy={doBuyFreeze}
      />
      <ShareModal open={shareOpen} onOpenChange={setShareOpen} userId={user?._id ?? referrals?.inviteCode ?? ""} filename="kilingo-progression" generate={() => shareStats({ userId: user?._id ?? referrals?.inviteCode ?? "kilingo", expressions: insights!.mastered, days: Math.max(1, new Date().getDate()), streak: insights!.streak, league: leaderboard?.my?.league ?? "bronze", achievements: achievements?.summary.completed ?? 0, avatar: { avatar: customization?.catalog.find((item) => item.itemId === customization.selectedAvatar)?.previewUrl ?? "🦁", hat: customization?.catalog.find((item) => item.itemId === customization.selectedHat)?.previewUrl ?? null, glasses: customization?.catalog.find((item) => item.itemId === customization.selectedGlasses)?.previewUrl ?? null, background: customization?.catalog.find((item) => item.itemId === customization.selectedBackground)?.previewUrl ?? null } })} />
    </div>
  );
}

function InsightCard({
  icon,
  title,
  value,
  sub,
  accent,
}: {
  icon: string;
  title: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="ln-card p-4">
      <p className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
        <span aria-hidden>{icon}</span> {title}
      </p>
      <p
        className={`mt-2 truncate font-display text-lg font-semibold ${
          accent ? "text-gold" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[0.6875rem] text-ink-3">{sub}</p>
    </div>
  );
}

/* ── MOD 1 — D : achat Freeze (500 gems ou €0.99 simulé) ──────────── */

function BuyFreezeDialog({
  open,
  onOpenChange,
  gems,
  onBuy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gems: number;
  onBuy: (method: "gems" | "card") => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-noir-2 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-ink">
            <Snowflake className="size-4 text-gold" />
            {t("freeze.shopTitle")}
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            {t("freeze.shopDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onBuy("gems")}
            disabled={gems < 500}
            className={cn(
              "rounded-xl border p-4 text-start transition-colors",
              gems >= 500
                ? "border-gold/40 bg-gold/5 hover:bg-gold/10"
                : "cursor-not-allowed border-white/10 opacity-50",
            )}
          >
            <p className="font-display text-lg font-semibold text-gold">💎 500</p>
            <p className="mt-1 text-xs text-ink-2">{t("freeze.optionGems")}</p>
            <p className="mt-2 font-mono text-[0.625rem] text-ink-3">
              {t("freeze.balance", { n: gems })}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onBuy("card")}
            className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-start transition-colors hover:bg-gold/10"
          >
            <p className="font-display text-lg font-semibold text-gold">€0.99</p>
            <p className="mt-1 text-xs text-ink-2">{t("freeze.optionCard")}</p>
            <p className="mt-2 font-mono text-[0.625rem] text-ink-3">
              {t("freeze.simulated")}
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Typage utilitaire — les docs Convex ne sont utilisés qu'en lecture. */
export type AnalyticsGoalDoc = Doc<"goals">;
