import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Crown, Sparkles, Trophy, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import { RpmHead } from "@/components/fx/RpmHead";

const LEAGUE_META = {
  bronze: { badge: "🟤", nextAt: 500, accent: "text-[#cd7f32]", border: "border-[#cd7f32]/35", bg: "bg-[#cd7f32]/10" },
  silver: { badge: "⚪", nextAt: 1500, accent: "text-slate-200", border: "border-slate-300/35", bg: "bg-slate-300/10" },
  gold: { badge: "🟡", nextAt: 3500, accent: "text-gold", border: "border-gold/40", bg: "bg-gold/10" },
  platinum: { badge: "💎", nextAt: 7000, accent: "text-cyan-200", border: "border-cyan-200/35", bg: "bg-cyan-200/10" },
  diamond: { badge: "💠", nextAt: 7000, accent: "text-sky-200", border: "border-sky-200/40", bg: "bg-sky-200/10" },
} as const;

type League = keyof typeof LEAGUE_META;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";
}

function Movement({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-ink-3">—</span>;
  const up = delta > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-gold" : "text-ink-3")}>
      {up ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      {Math.abs(delta)}
    </span>
  );
}

function PromotionModal({ league, onClose }: { league: League; onClose: () => void }) {
  const { t } = useI18n();
  const meta = LEAGUE_META[league];
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-noir/95 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
      >
        {Array.from({ length: 30 }, (_, index) => (
          <motion.span
            key={index}
            className="pointer-events-none absolute left-1/2 top-1/2 size-2 rounded-sm"
            style={{ background: ["#f3e4cf", "#d4a574", "#6b8e23", "#c9bca8"][index % 4] }}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
            animate={{
              opacity: 0,
              x: Math.cos((index / 30) * Math.PI * 2) * (100 + (index % 6) * 24),
              y: Math.sin((index / 30) * Math.PI * 2) * (100 + (index % 5) * 28) + 80,
              rotate: index * 31,
            }}
            transition={{ duration: 1.8, delay: (index % 8) * 0.06, ease: "easeOut" }}
          />
        ))}
        <motion.div
          initial={{ scale: 0.88, y: 18, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={cn("relative w-full max-w-md overflow-hidden rounded-3xl border bg-noir-2 p-8 text-center shadow-[0_0_100px_rgba(212,165,116,0.22)]", meta.border)}
        >
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="absolute end-4 top-4 rounded-lg p-1 text-ink-3 hover:text-ink">
            <X className="size-4" />
          </button>
          <motion.div animate={{ y: [0, -7, 0], rotate: [0, 3, -3, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="text-6xl">
            {meta.badge}
          </motion.div>
          <p className="mt-5 font-mono text-[0.625rem] tracking-[0.28em] text-gold uppercase">KILINGO · {t("leaderboard.promotionEyebrow")}</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink">
            🎉 {t("leaderboard.promotionTitle", { league: t(`league.${league}`) })}
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-2">{t("leaderboard.promotionBody")}</p>
          <button type="button" onClick={onClose} className="mt-7 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir transition-transform hover:-translate-y-0.5">
            {t("leaderboard.continue")}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function LeaderboardView() {
  const { t } = useI18n();
  const board = useQuery(api.leaderboard.getCurrentLeaderboard, {});
  const [promotion, setPromotion] = useState<League | null>(null);

  const pending = board?.my?.pendingPromotion;
  useEffect(() => {
    if (!pending) return;
    const key = `kilingo.promotion.${pending.weekKey}.${pending.to}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      /* navigation privée : le modal reste visible pour cette session */
    }
    setPromotion(pending.to);
  }, [pending?.weekKey, pending?.to]);

  if (!board) return <div className="animate-shimmer h-72 rounded-3xl border border-white/5" />;

  const top = board.entries.slice(0, 10);
  const rest = board.entries.slice(10, 100);
  const my = board.my;
  const myLeague = (my?.league ?? "bronze") as League;
  const myMeta = LEAGUE_META[myLeague];
  const currentXp = my?.xp ?? 0;
  const progress = Math.min(100, Math.max(0, (currentXp / myMeta.nextAt) * 100));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {promotion && <PromotionModal league={promotion} onClose={() => setPromotion(null)} />}

      <PlaceHeader
        place="leaderboard"
        title={t("leaderboard.title")}
        icon={Trophy}
        motif="kente"
        description={`${t("leaderboard.subtitle")} · ${board.weekKey}`}
        actions={
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 sm:min-w-[430px]">
            <div className="rounded-2xl border border-white/8 bg-noir/65 p-4">
              <p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">{t("leaderboard.yourRank")}</p>
              <p className="mt-1 font-display text-3xl font-bold text-gold">#{my?.rank ?? "—"}</p>
            </div>
            <div className={cn("rounded-2xl border p-4", myMeta.border, myMeta.bg)}>
              <p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">{t("leaderboard.league")}</p>
              <p className="mt-1 truncate font-display text-xl font-bold"><span className="mr-1">{myMeta.badge}</span>{t(`league.${myLeague}`)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-noir/65 p-4">
              <p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">XP {t("leaderboard.thisWeek")}</p>
              <p className="mt-1 font-display text-3xl font-bold">{currentXp.toLocaleString()}</p>
            </div>
          </div>
        }
      />

      <div>
        <div className="mb-2 flex justify-between font-mono text-[0.5625rem] text-ink-3 uppercase">
          <span>{t(`league.${myLeague}`)}</span>
          <span>{myLeague === "diamond" ? t("leaderboard.maxLeague") : `${currentXp} / ${myMeta.nextAt} XP`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold" />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Crown className="size-4 text-gold" />
          <h2 className="font-mono text-xs tracking-[0.2em] text-ink-2 uppercase">{t("leaderboard.topTen")}</h2>
        </div>
        {top.length === 0 ? <EmptyLeaderboard /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {top.map((entry) => {
              const meta = LEAGUE_META[entry.league];
              return (
                <motion.div key={entry.userId} whileHover={{ y: -2 }} className={cn("ln-card flex items-center gap-3 p-4", entry.isYou && "border-gold/45 bg-gold/[0.06]")}>
                  <span className={cn("w-8 shrink-0 text-center font-display text-xl font-bold", entry.rank <= 3 ? "text-gold" : "text-ink-3")}>{entry.rank}</span>
                  <Avatar image={entry.image} name={entry.name} rpmAvatarUrl={entry.rpmAvatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">{entry.name}{entry.isYou ? " · TOI" : ""}</p>
                    <p className="mt-0.5 text-xs text-ink-3"><span className="mr-1">{meta.badge}</span>{t(`league.${entry.league}`)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-gold">{entry.xp.toLocaleString()} XP</p>
                    <Movement delta={entry.rankDelta} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <section className="ln-card overflow-hidden">
          <div className="border-b border-white/6 px-5 py-4">
            <h2 className="font-mono text-xs tracking-[0.2em] text-ink-2 uppercase">{t("leaderboard.fullRanking")}</h2>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {rest.map((entry) => {
              const meta = LEAGUE_META[entry.league];
              return (
                <div key={entry.userId} className="flex items-center gap-3 border-b border-white/5 px-5 py-3 last:border-0 hover:bg-white/[0.025]">
                  <span className="w-8 font-mono text-xs text-ink-3">{entry.rank}</span>
                  <Avatar image={entry.image} name={entry.name} small rpmAvatarUrl={entry.rpmAvatarUrl} />
                  <p className="min-w-0 flex-1 truncate text-sm">{entry.name}</p>
                  <span className="hidden text-xs text-ink-3 sm:inline">{meta.badge} {t(`league.${entry.league}`)}</span>
                  <span className="w-20 text-right font-mono text-xs font-semibold text-gold">{entry.xp.toLocaleString()} XP</span>
                  <span className="w-8 text-right"><Movement delta={entry.rankDelta} /></span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-gold/15 bg-gold/5 p-4 text-xs leading-relaxed text-ink-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" />
        <p>{t("leaderboard.rules")}</p>
      </div>
    </div>
  );
}

function Avatar({
  image,
  name,
  small = false,
  rpmAvatarUrl,
}: {
  image: string | null;
  name: string;
  small?: boolean;
  rpmAvatarUrl?: string | null;
}) {
  const size = small ? "size-8" : "size-11";
  // Avatar 3D du joueur (portrait de tête) — prioritaire sur la photo.
  if (rpmAvatarUrl) {
    return <RpmHead url={rpmAvatarUrl} className={size} alt={name} />;
  }
  return image ? (
    <img src={image} alt="" loading="lazy" decoding="async" width={small ? 32 : 44} height={small ? 32 : 44} className={cn("shrink-0 rounded-full border border-gold/25 object-cover", size)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gradient-to-br from-gold/25 to-noir font-display font-bold text-gold", small ? "size-8 text-[0.625rem]" : "size-11 text-sm")}>
      {initials(name)}
    </span>
  );
}

function EmptyLeaderboard() {
  const { t } = useI18n();
  return (
    <div className="ln-card flex min-h-52 flex-col items-center justify-center p-8 text-center">
      <Trophy className="size-9 text-gold/60" />
      <p className="mt-3 font-display text-xl font-semibold">{t("leaderboard.emptyTitle")}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{t("leaderboard.emptyBody")}</p>
    </div>
  );
}
