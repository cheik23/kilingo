import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Flame,
  Headphones,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TiltCard } from "@/components/fx/interact";
import { GoldBurst, RollingCounter } from "@/components/fx/rewards";
import { ScrambleHeading } from "@/components/fx/text";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   Dashboard "Performance" — ce que tu AS fait et ce que tu PEUX faire.
   Noir & Or, animations transform/opacity/stroke-dashoffset uniquement.
   ═══════════════════════════════════════════════════════════════════ */

const ROMAN = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV",
];

const GOALS = [5, 10, 20, 30] as const;

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

function frDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/* ── Count-up rAF (500 ms) ──────────────────────────────────────────── */

function CountUp({ value, className }: { value: number; className?: string }) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [display, setDisplay] = useState(value);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 500);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced]);

  return <span className={cn("tabular-nums", className)}>{display}</span>;
}

/* ── Section A : header héro ────────────────────────────────────────── */

function HeroHeader({
  overview,
}: {
  overview: NonNullable<ReturnType<typeof useQuery<typeof api.stats.overview>>>;
}) {
  const restant = Math.max(0, overview.levelCeil - overview.xp);
  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Niveau + XP */}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
            Niveau
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-4xl font-bold text-gold">
              {ROMAN[overview.level - 1] ?? overview.level}
            </span>
            <span className="text-sm text-ink-2">
              <RollingCounter value={overview.xp} className="text-gold" /> XP ·{" "}
              {restant} XP avant niveau{" "}
              {ROMAN[overview.level] ?? overview.level + 1}
            </span>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5"
            role="progressbar"
            aria-valuenow={Math.round(overview.levelProgress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression vers le niveau suivant"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-strong via-gold to-gold-soft transition-[width] duration-600 ease-out"
              style={{ width: `${Math.max(2, overview.levelProgress * 100)}%` }}
            />
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-4 sm:pl-6">
          <span className="ln-slang-badge flex size-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <Flame className="size-7" aria-hidden />
          </span>
          <div>
            <p className="font-display text-3xl font-bold text-ink">
              <RollingCounter value={overview.streakCurrent} />
            </p>
            <p className="text-xs text-ink-3">
              jours de suite · record {overview.streakLongest}
            </p>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

/* ── Section B : KPI cards ──────────────────────────────────────────── */

function KpiRow({
  overview,
}: {
  overview: NonNullable<ReturnType<typeof useQuery<typeof api.stats.overview>>>;
}) {
  const kpis = [
    { label: "XP totale", value: overview.xp, suffix: "" },
    { label: "Minutes aujourd'hui", value: overview.minutesToday, suffix: "" },
    { label: "Mots maîtrisés", value: overview.wordsMastered, suffix: "" },
    { label: "Rétention 7 j", value: Math.round(overview.retention7d * 100), suffix: "%" },
    { label: "Médias analysés", value: overview.mediaCount, suffix: "" },
    { label: "Expressions argot", value: overview.slangMastered, suffix: "" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl border border-white/5 bg-noir-2 p-4 transition-colors hover:border-gold/40"
        >
          <p className="font-mono text-[0.625rem] tracking-wider text-ink-3 uppercase">
            {k.label}
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold text-ink">
            <CountUp value={k.value} />
            <span className="text-sm text-gold">{k.suffix}</span>
          </p>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Section C : anneau objectif ────────────────────────────────────── */

function GoalRing({
  minutesToday,
  goal,
  onSet,
}: {
  minutesToday: number;
  goal: number;
  onSet: (m: 5 | 10 | 20 | 30) => void;
}) {
  const ratio = Math.min(1, minutesToday / goal);
  const R = 52;
  const C = 2 * Math.PI * R;
  const done = ratio >= 1;
  const [burst, setBurst] = useState(0);
  const wasDone = useRef(false);

  useEffect(() => {
    if (done && !wasDone.current) {
      setBurst((b) => b + 1);
      wasDone.current = true;
    }
    if (!done) wasDone.current = false;
  }, [done]);

  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        <Target className="size-3 text-gold" /> Objectif du jour
      </p>
      <div className="mt-4 flex items-center gap-5">
        <GoldBurst trigger={burst} className="shrink-0">
          <svg
            width="128"
            height="128"
            viewBox="0 0 128 128"
            role="img"
            aria-label={`Objectif : ${minutesToday} minutes sur ${goal}`}
          >
            <circle cx="64" cy="64" r={R} fill="none" stroke="#2A2A2A" strokeWidth="10" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="var(--gold-primary)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - ratio)}
              transform="rotate(-90 64 64)"
              style={{ transition: "stroke-dashoffset 600ms ease-out" }}
            />
            <text
              x="64"
              y="60"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="22"
              fontWeight="700"
              fontFamily="var(--font-display)"
            >
              {minutesToday}
            </text>
            <text
              x="64"
              y="80"
              textAnchor="middle"
              fill="#606060"
              fontSize="12"
              fontFamily="var(--font-mono)"
            >
              / {goal} min
            </text>
          </svg>
        </GoldBurst>
        <div className="min-w-0 flex-1">
          {done && (
            <p className="mb-2 text-sm font-medium text-gold">
              Objectif atteint ✨
            </p>
          )}
          <p className="mb-3 font-mono text-[0.625rem] tracking-wider text-ink-3 uppercase">
            Ajuster l'objectif
          </p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => onSet(g)}
                aria-label={`Objectif ${g} minutes`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors",
                  g === goal
                    ? "border-gold/60 bg-gold/15 text-gold"
                    : "border-white/10 text-ink-2 hover:border-gold/40 hover:text-gold",
                )}
              >
                {g} min
              </button>
            ))}
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

/* ── Section D : heatmap 12 semaines ───────────────────────────────── */

function Heatmap({
  data,
}: {
  data: Array<{ date: string; sessions: number }> | undefined;
}) {
  const max = Math.max(1, ...(data?.map((d) => d.sessions) ?? [1]));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const OPAC = ["bg-white/5", "bg-gold/10", "bg-gold/30", "bg-gold/60", "bg-gold"];
  // Colonne par semaine pour un défilement horizontal propre.
  const cols: Array<Array<{ date: string; sessions: number }>> = [];
  const flat = data ?? [];
  for (let i = 0; i < flat.length; i += 7) cols.push(flat.slice(i, i + 7));

  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
          12 dernières semaines
        </p>
        <p className="flex items-center gap-1.5 font-mono text-[0.625rem] text-ink-3">
          moins
          {OPAC.map((c) => (
            <span key={c} className={cn("size-2.5 rounded-sm", c)} />
          ))}
          plus
        </p>
      </div>
      <div
        className="mt-4 overflow-x-auto pb-1"
        role="img"
        aria-label="Carte de chaleur de l'activité des 12 dernières semaines"
      >
        <div className="flex gap-[3px]">
          {cols.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((d) => (
                <span
                  key={d.date}
                  title={`${frDate(d.date)} — ${d.sessions} session${d.sessions > 1 ? "s" : ""}`}
                  className={cn(
                    "size-3 rounded-sm transition-colors",
                    OPAC[level(d.sessions)],
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </TiltCard>
  );
}

/* ── Section E : activité 14 jours (recharts présent dans le projet) ── */

function ActivityChart({
  data,
}: {
  data: Array<{ date: string; minutes: number; words: number }> | undefined;
}) {
  const chart = (data ?? []).slice(-14);
  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        Activité — 14 jours
      </p>
      <div className="mt-3 h-44" role="img" aria-label="Minutes d'activité par jour sur 14 jours">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
            <CartesianAxis stroke="#2A2A2A" tick={{ fill: "#606060", fontSize: 10 }} />
            <Tooltip
              cursor={{ fill: "rgba(212,165,116,0.06)" }}
              contentStyle={{
                background: "#141414",
                border: "1px solid #2A2A2A",
                borderRadius: 12,
                fontSize: 12,
                color: "#FFFFFF",
              }}
              labelFormatter={(l: string) => frDate(String(l))}
            />
            <Bar dataKey="minutes" name="Minutes" fill="var(--gold-primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex items-center gap-2 font-mono text-[0.625rem] text-ink-3">
        <span className="inline-block h-2 w-4 rounded bg-gold" /> minutes / jour
      </p>
    </TiltCard>
  );
}

/* ── Section F : SRS (style Anki) ──────────────────────────────────── */

function SrsPanel({
  srs,
}: {
  srs: {
    dueToday: number;
    forecast7: Array<{ date: string; due: number }>;
    maturity: { new: number; learning: number; mature: number };
  } | undefined;
}) {
  const total = srs
    ? srs.maturity.new + srs.maturity.learning + srs.maturity.mature
    : 0;
  const maturePct = total > 0 ? Math.round((srs!.maturity.mature / total) * 100) : 0;
  const maxDue = Math.max(1, ...(srs?.forecast7.map((f) => f.due) ?? [1]));
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        Répétition espacée
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {/* À revoir */}
        <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p
            className={cn(
              "font-display text-4xl font-bold text-ink",
              (srs?.dueToday ?? 0) > 0 && "ln-slang-badge rounded-xl",
            )}
          >
            <RollingCounter value={srs?.dueToday ?? 0} />
          </p>
          <p className="mt-1 text-xs text-ink-3">à revoir aujourd'hui</p>
        </div>

        {/* Forecast 7 j */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="mb-2 font-mono text-[0.625rem] text-ink-3">Prévision 7 j</p>
          <div
            className="flex h-16 items-end gap-1"
            role="img"
            aria-label="Cartes à revoir par jour sur les 7 prochains jours"
          >
            {(srs?.forecast7 ?? []).map((f) => (
              <span
                key={f.date}
                title={`${frDate(f.date)} — ${f.due}`}
                className="flex-1 rounded-sm bg-gold/50"
                style={{
                  height: `${Math.max(4, (f.due / maxDue) * 100)}%`,
                  transition: "height 600ms ease-out",
                }}
              />
            ))}
          </div>
        </div>

        {/* Donut maturité */}
        <div className="flex items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            role="img"
            aria-label={`Maturité : ${maturePct} % de cartes maîtrisées`}
          >
            <circle cx="48" cy="48" r={R} fill="none" stroke="#606060" strokeWidth="9" />
            <circle
              cx="48"
              cy="48"
              r={R}
              fill="none"
              stroke="#A0A0A0"
              strokeWidth="9"
              strokeDasharray={`${C * ((srs?.maturity.learning ?? 0) / Math.max(1, total))} ${C}`}
              transform="rotate(-90 48 48)"
              style={{ transition: "stroke-dasharray 600ms ease-out" }}
            />
            <circle
              cx="48"
              cy="48"
              r={R}
              fill="none"
              stroke="var(--gold-primary)"
              strokeWidth="9"
              strokeDasharray={`${C * ((srs?.maturity.mature ?? 0) / Math.max(1, total))} ${C}`}
              transform={`rotate(${-90 + 360 * ((srs?.maturity.new ?? 0) / Math.max(1, total))} 48 48)`}
              style={{ transition: "stroke-dasharray 600ms ease-out" }}
            />
            <text
              x="48"
              y="53"
              textAnchor="middle"
              fill="var(--gold-primary)"
              fontSize="16"
              fontWeight="700"
              fontFamily="var(--font-display)"
            >
              {maturePct}%
            </text>
          </svg>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 font-mono text-[0.625rem] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-silver" /> nouveau {srs?.maturity.new ?? 0}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-3" /> en cours {srs?.maturity.learning ?? 0}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gold" /> maîtrisé {srs?.maturity.mature ?? 0}
        </span>
      </div>
    </TiltCard>
  );
}

/* ── Section G : compétences ────────────────────────────────────────── */

function SkillsPanel({
  skills,
}: {
  skills: { listening: number; reading: number; vocab: number; slang: number } | undefined;
}) {
  const rows = [
    { key: "listening", label: "Écoute", icon: Headphones, value: skills?.listening ?? 0 },
    { key: "reading", label: "Lecture", icon: BookOpen, value: skills?.reading ?? 0 },
    { key: "vocab", label: "Vocabulaire", icon: Sparkles, value: skills?.vocab ?? 0 },
    { key: "slang", label: "Argot", icon: Flame, value: skills?.slang ?? 0 },
  ];
  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        Compétences
      </p>
      <div className="mt-4 space-y-4">
        {rows.map((r, i) => (
          <div key={r.key}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-2">
                <r.icon className="size-4 text-gold" />
                {r.label}
              </span>
              <span className="font-mono text-xs text-gold">
                <RollingCounter value={r.value} /> /100
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-white/5"
              role="progressbar"
              aria-valuenow={r.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Compétence ${r.label} : ${r.value} sur 100`}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold-soft"
                initial={{ width: 0 }}
                animate={{ width: `${r.value}%` }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>
    </TiltCard>
  );
}

/* ── Section H : succès ─────────────────────────────────────────────── */

function AchievementsPanel({
  badges,
}: {
  badges: Array<{
    id: string;
    title: string;
    desc: string;
    icon: string;
    unlocked: boolean;
    unlockedAt?: number;
  }> | undefined;
}) {
  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        Succès
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {(badges ?? []).map((b) => (
          <div
            key={b.id}
            title={b.unlocked ? `${b.title} — ${b.desc}` : `${b.title} : ${b.desc}`}
            className={cn(
              "group flex flex-col items-center rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center transition-colors",
              b.unlocked ? "border-gold/30" : "opacity-40 grayscale",
            )}
          >
            <span
              className={cn(
                "text-2xl",
                b.unlocked && "ln-slang-badge rounded-full",
              )}
            >
              {b.icon}
            </span>
            <p className="mt-1.5 text-[0.6875rem] leading-tight font-medium text-ink">
              {b.title}
            </p>
            <p className="mt-0.5 text-[0.5625rem] leading-tight text-ink-3">
              {b.unlocked && b.unlockedAt
                ? new Date(b.unlockedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })
                : b.desc}
            </p>
          </div>
        ))}
      </div>
    </TiltCard>
  );
}

/* ── Section I : prochaine étape ────────────────────────────────────── */

const ACTION_ICON: Record<string, typeof Play> = {
  review: Play,
  home: Flame,
  discover: Sparkles,
  shadow: Headphones,
};

function NextStepsPanel({
  actions,
  onNavigate,
}: {
  actions: Array<{ id: string; label: string; cta: string }> | undefined;
  onNavigate: (view: string) => void;
}) {
  const targets: Record<string, string> = {};
  // Le backend ne renvoie pas la cible ; on déduit par id.
  const idToView: Record<string, string> = {
    "review-due": "review",
    "retention-rescue": "review",
    "flame-guard": "home",
    "weekly-goal": "shadow",
    "explore-media": "shadow",
  };

  return (
    <TiltCard className="rounded-2xl border border-gold/40 bg-noir-2 p-5 shadow-[0_0_24px_rgba(212,165,116,0.12)]">
      <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
        <Target className="size-3" /> Ta prochaine étape
      </p>
      <div className="mt-4 space-y-3">
        {(actions ?? []).map((a, i) => {
          const view = targets[a.id] ?? idToView[a.id] ?? "home";
          const Icon = ACTION_ICON[view] ?? Sparkles;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/10">
                <Icon className="size-4 text-gold" />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm text-ink">{a.label}</p>
              <button
                onClick={() => onNavigate(view)}
                className="shrink-0 rounded-full bg-gradient-to-r from-gold-strong to-gold px-4 py-1.5 text-xs font-semibold text-noir transition-transform active:scale-97"
              >
                {a.cta}
              </button>
            </motion.div>
          );
        })}
        {(!actions || actions.length === 0) && (
          <p className="text-sm text-ink-3">Tout est à jour. À demain ✨</p>
        )}
      </div>
    </TiltCard>
  );
}

/* ── Section J : rapport hebdo ──────────────────────────────────────── */

function WeeklyReport({ delta }: { delta: number }) {
  const up = delta >= 0;
  const abs = Math.round(Math.abs(delta) * 100);
  const phrase = up
    ? `Semaine plus intense que la précédente. ${abs >= 50 ? "Le momentum est excellent, garde ce rythme." : "Belle progression, continue."}`
    : `Semaine moins intense que la précédente. ${abs >= 50 ? "Une session courte suffira à relancer la machine." : "Presse-toi un peu pour rattraper le rythme."}`;
  return (
    <TiltCard className="rounded-2xl border border-white/5 bg-noir-2 p-5">
      <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        Rapport hebdo
      </p>
      <div className="mt-3 flex items-center gap-4">
        <span
          className={cn(
            "font-display text-3xl font-bold",
            up ? "text-gold" : "text-red-400/80",
          )}
        >
          {up ? "↑" : "↓"} {abs}%
        </span>
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-2">{phrase}</p>
      </div>
    </TiltCard>
  );
}

/* ── Vue principale ─────────────────────────────────────────────────── */

export function DashboardView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const overview = useQuery(api.stats.overview);
  const daily14 = useQuery(api.stats.dailyActivity, { days: 14 });
  const heat = useQuery(api.stats.heatmap, { weeks: 12 });
  const srs = useQuery(api.stats.srsSummary);
  const skills = useQuery(api.stats.skills);
  const badges = useQuery(api.stats.achievements);
  const actions = useQuery(api.stats.nextActions);
  const setDailyGoal = useMutation(api.users.setDailyGoal);

  return (
    <div className="space-y-5">
      <ScrambleHeading text="Progression" />
      {!overview ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <>
          <HeroHeader overview={overview} />
          <KpiRow overview={overview} />
          <div className="grid gap-5 lg:grid-cols-2">
            <GoalRing
              minutesToday={overview.minutesToday}
              goal={overview.dailyGoalMinutes}
              onSet={(m) => void setDailyGoal({ minutes: m })}
            />
            <ActivityChart data={daily14} />
          </div>
          <Heatmap data={heat} />
          <SrsPanel srs={srs} />
          <div className="grid gap-5 lg:grid-cols-2">
            <SkillsPanel skills={skills} />
            <NextStepsPanel actions={actions} onNavigate={onNavigate} />
          </div>
          <AchievementsPanel badges={badges} />
          <WeeklyReport delta={overview.deltaWeek} />
        </>
      )}
    </div>
  );
}
