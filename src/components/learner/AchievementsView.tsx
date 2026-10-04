import { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Check,
  ChevronRight,
  Compass,
  Flame,
  Gem,
  HelpCircle,
  Languages,
  MessagesSquare,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ShareModal } from "./ShareModal";
import { shareAchievement } from "@/lib/shareEngine";
import { useAuth } from "@/hooks/use-auth";
import { Share2 } from "lucide-react";
import { Confetti, CountUp } from "@/components/fx/rewards";
import { coinTrailFrom } from "@/components/fx/coinTrail";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import { Card3D } from "@/components/fx/Card3D";

/* MODULE 4 — la scène 3D du déblocage vit dans un chunk séparé : three.js
   n'est téléchargé qu'à l'ouverture réelle d'un succès. `fallback` garde
   l'emoji 2D historique (reduced-motion, device incapable, mode lite). */
const TrophyScene = lazy(() => import("@/components/three/Trophy3D"));

const CATEGORIES = [
  ["all", "achievementCategories.all"],
  ["lang", "achievementCategories.lang"],
  ["streak", "achievementCategories.streak"],
  ["quiz", "achievementCategories.quiz"],
  ["conv", "achievementCategories.conv"],
  ["explore", "achievementCategories.explore"],
  ["collect", "achievementCategories.collect"],
] as const;

type Category = (typeof CATEGORIES)[number][0];

/** LOT G — une section par famille, avec son icône : les 150 cartes sont
 *  regroupées au lieu de former un mur unique illisible. */
const SECTIONS = [
  { key: "lang", label: "achievementCategories.lang", icon: Languages },
  { key: "streak", label: "achievementCategories.streak", icon: Flame },
  { key: "quiz", label: "achievementCategories.quiz", icon: HelpCircle },
  { key: "conv", label: "achievementCategories.conv", icon: MessagesSquare },
  { key: "explore", label: "achievementCategories.explore", icon: Compass },
  { key: "collect", label: "achievementCategories.collect", icon: Gem },
] as const;

/** Cartes visibles par section avant dépliage — 10 : de quoi voir une
 *  famille entière sur une grande page, sans redevenir un mur. */
const SECTION_PREVIEW = 10;
type Item = {
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

function CompletionModal({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  /** LOT H — du détail près : ref de la carte qui porte les gems gagnés. */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Traînée de pièces : des gems gagnés partent de la carte vers le solde.
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => coinTrailFrom(cardRef.current), 240);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-noir/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
        {/* LOT H — flash doré plein écran, 300 ms, une seule fois. */}
        {!reduced && (
          <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }} transition={{ duration: 0.3, times: [0, 0.35, 1], ease: "easeOut" }} className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/45 via-gold/15 to-transparent" />
        )}
        <motion.div ref={cardRef} initial={reduced ? { opacity: 0 } : { rotateY: 180, opacity: 0 }} animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} style={{ transformPerspective: 1400 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-gold/35 bg-noir-2 p-8 text-center shadow-[0_0_90px_rgba(212,165,116,0.2)]">
          {/* LOT H — 80 confettis or/noir à l'ouverture du succès. */}
          <Confetti pieces={80} />
          <button type="button" onClick={onClose} aria-label="Fermer" className="absolute end-4 top-4 p-1 text-ink-3 hover:text-ink"><X className="size-4" /></button>
          {/* MODULE 4 — trophée 3D (rotation + confettis 3D + flash) ; repli
              2D emoji si le 3D est indisponible. */}
          <Suspense
            fallback={
              <motion.div
                animate={reduced ? undefined : { scale: [1, 1.12, 1], rotate: [0, 4, -4, 0] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="text-6xl"
              >
                🏆
              </motion.div>
            }
          >
            <TrophyScene
              fallback={
                <motion.div
                  animate={reduced ? undefined : { scale: [1, 1.12, 1], rotate: [0, 4, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className="text-6xl"
                >
                  🏆
                </motion.div>
              }
            />
          </Suspense>
          <p className="mt-4 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">Achievement</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">{title}</h2>
          <p className="mt-2 text-sm text-ink-2">{body}</p>
          <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir">Continuer</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function AchievementsView() {
  const { t, lang } = useI18n();
  const data = useQuery(api.achievements.getMyAchievements, { lang });
  const notifications = useQuery(api.notifications.list);
  const [filter, setFilter] = useState<Category>("all");
  /** Sections dépliées à la demande (clé = famille). */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [shareItem, setShareItem] = useState<Item | null>(null);
  const { user } = useAuth();
  const customization = useQuery(api.customization.getMyCustomization, { lang });
  const referrals = useQuery(api.referrals.getMyReferrals);

  useEffect(() => {
    const latest = notifications?.find((n) => n.kind === "achievement" && n.readAt == null);
    if (!latest) return;
    const key = `moovy.achievement.modal.${latest._id}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      /* mode privé : le modal reste visible dans cette session */
    }
    setModal({ title: latest.title, body: latest.body });
  }, [notifications]);

  const items = data?.items ?? [];
  const filtered = useMemo(() => filter === "all" ? items : items.filter((item) => item.category === filter), [filter, items]);
  /** Regroupement par famille — construit une seule fois par jeu de données. */
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items]);
  const completed = data?.summary.completed ?? 0;

  /** Dépliage initial : la première famille sur laquelle il y a du progrès
   *  est ouverte d'emblée — c'est là que l'utilisateur peut agir. Les autres
   *  restent repliées à `SECTION_PREVIEW` cartes. Une seule fois : ensuite
   *  l'état appartient à l'utilisateur. */
  useEffect(() => {
    if (items.length === 0) return;
    setExpanded((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const firstActive = SECTIONS.find(({ key }) =>
        (grouped.get(key) ?? []).some((item) => item.progress > 0),
      );
      return firstActive ? { [firstActive.key]: true } : prev;
    });
  }, [items.length, grouped]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {modal && <CompletionModal {...modal} onClose={() => setModal(null)} />}
      {selected && <AchievementDetail item={selected} onShare={() => setShareItem(selected)} onClose={() => setSelected(null)} />}
      <PlaceHeader
        place="achievements"
        title={t("achievements.title")}
        icon={Trophy}
        motif="kente"
        description={t("achievements.subtitle")}
        actions={
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:min-w-[370px]">
            <div className="rounded-2xl border border-gold/25 bg-gold/10 p-4"><p className="font-mono text-[0.5625rem] uppercase tracking-widest text-ink-3">{t("achievements.unlocked")}</p><p className="mt-1 font-display text-3xl font-bold text-gold"><CountUp value={completed} /><span className="text-base text-ink-3">/150</span></p></div>
            <div className="rounded-2xl border border-white/8 bg-noir/70 p-4"><p className="font-mono text-[0.5625rem] uppercase tracking-widest text-ink-3">XP gagnés</p><p className="mt-1 font-display text-2xl font-bold"><CountUp value={data?.summary.xpEarned ?? 0} prefix="+" /></p></div>
            <div className="rounded-2xl border border-white/8 bg-noir/70 p-4"><p className="font-mono text-[0.5625rem] uppercase tracking-widest text-ink-3">Gems gagnés</p><p className="mt-1 font-display text-2xl font-bold text-gold"><CountUp value={data?.summary.gemsEarned ?? 0} prefix="+" /></p></div>
          </div>
        }
      />

      <div className="h-2 overflow-hidden rounded-full bg-white/8"><motion.div animate={{ width: `${(completed / 150) * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold" /></div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("achievements.filters")}>
        {CATEGORIES.map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={cn("rounded-full border px-4 py-2 text-xs transition-colors", filter === key ? "border-gold/55 bg-gold/10 font-semibold text-gold" : "border-white/10 text-ink-2 hover:border-gold/30 hover:text-gold")}>{t(label)}</button>)}
      </div>

      {shareItem && <ShareModal open onOpenChange={(open) => { if (!open) setShareItem(null); }} userId={user?._id ?? referrals?.inviteCode ?? ""} filename={`lingua-noir-${shareItem.achievementId}`} generate={() => shareAchievement({ userId: user?._id ?? referrals?.inviteCode ?? "lingua-noir", title: shareItem.title, icon: shareItem.icon, completedAt: shareItem.completedAt ?? Date.now(), avatar: { avatar: customization?.catalog.find((item) => item.itemId === customization.selectedAvatar)?.previewUrl ?? "🦁", hat: customization?.catalog.find((item) => item.itemId === customization.selectedHat)?.previewUrl ?? null, glasses: customization?.catalog.find((item) => item.itemId === customization.selectedGlasses)?.previewUrl ?? null, background: customization?.catalog.find((item) => item.itemId === customization.selectedBackground)?.previewUrl ?? null } })} />}
      {data === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-44 animate-shimmer rounded-2xl bg-white/5" />)}</div>
      ) : filter === "all" ? (
        <div className="space-y-8">
          {SECTIONS.map(({ key, label, icon: Icon }) => {
            /* En cours d'abord : l'utilisateur voit ce sur quoi il peut agir. */
            const group = (grouped.get(key) ?? [])
              .slice()
              .sort(
                (a, b) =>
                  Number(a.completed) - Number(b.completed) ||
                  b.progress / Math.max(1, b.target) -
                    a.progress / Math.max(1, a.target),
              );
            if (group.length === 0) return null;
            const done = group.filter((item) => item.completed).length;
            const open = expanded[key] === true;
            const shownItems = open ? group : group.slice(0, SECTION_PREVIEW);
            const headingId = `ach-section-${key}`;
            return (
              <section key={key} className="space-y-3" aria-labelledby={headingId}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [key]: !open }))
                  }
                  aria-expanded={open}
                  /* En-tête collant : on garde toujours le nom de la famille et
                     son compteur X/Y sous les yeux pendant qu'on descend. */
                  className="sticky top-14 z-20 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-noir-2/95 px-4 py-3 text-left backdrop-blur-md transition-colors hover:border-gold/30 lg:top-16"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-gold" aria-hidden />
                    <span id={headingId} className="truncate font-display text-lg font-semibold">
                      {t(label)}
                    </span>
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[0.5625rem] text-ink-3">
                      {done}/{group.length}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-ink-3">
                    {Math.round((done / group.length) * 100)}%
                    <ChevronRight
                      className={cn("size-4 transition-transform", open && "rotate-90")}
                      aria-hidden
                    />
                  </span>
                </button>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(done / group.length) * 100}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold"
                  />
                </div>
                <div className="ln-grid-tight">
                  {shownItems.map((item, i) => (
                    <div
                      key={item.achievementId}
                      className="ln-stagger-item"
                      style={{ ["--ln-i" as string]: i }}
                    >
                      <Card3D className="ln-card h-full">
                        <AchievementCard item={item} onOpen={() => setSelected(item)} />
                      </Card3D>
                    </div>
                  ))}
                </div>
                {!open && group.length > shownItems.length && (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [key]: true }))}
                    className="w-full rounded-xl border border-white/10 py-2.5 text-xs text-ink-2 transition-colors hover:border-gold/35 hover:text-gold"
                  >
                    Voir les {group.length - shownItems.length} autres « {t(label)} »
                  </button>
                )}
                {open && group.length > SECTION_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [key]: false }))}
                    className="w-full rounded-xl border border-white/10 py-2.5 text-xs text-ink-2 transition-colors hover:border-gold/35 hover:text-gold"
                  >
                    Replier « {t(label)} »
                  </button>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="ln-grid-tight">
          {filtered.map((item, i) => (
            <div
              key={item.achievementId}
              className="ln-stagger-item"
              style={{ ["--ln-i" as string]: i }}
            >
              <Card3D className="ln-card h-full">
                <AchievementCard item={item} onOpen={() => setSelected(item)} />
              </Card3D>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-gold/15 bg-gold/5 p-4 text-xs leading-relaxed text-ink-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-gold" /><p>{t("achievements.rules")}</p></div>
    </div>
  );
}

function AchievementCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const { t } = useI18n();
  const percent = Math.min(100, Math.round((item.progress / Math.max(1, item.target)) * 100));
  return (
    <article
      className={cn("group relative h-full cursor-pointer rounded-[inherit] p-6 transition-colors hover:border-gold/35", item.completed ? "border-gold/35" : "")}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${item.title} — ${t("achievements.titles.progress")}: ${item.progress}/${item.target}`}
    >
      {item.completed && <span className="absolute end-4 top-4 flex size-6 items-center justify-center rounded-full bg-gold text-noir"><Check className="size-4" /></span>}
      <div className="flex items-start gap-3"><span data-card3d-depth="30" className={cn("text-4xl transition-transform group-hover:scale-[1.06]", !item.completed && "grayscale opacity-55")}>{item.icon}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 title={item.title} className="truncate font-display text-lg font-semibold text-ink">{item.title}</h2><span className={cn("rounded-full border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase", item.tier === "gold" ? "border-gold/40 text-gold" : item.tier === "silver" ? "border-slate-300/35 text-slate-200" : "border-orange-400/35 text-orange-300")}>{item.tier}</span></div><p title={item.description} className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-3">{item.description}</p></div></div>
      <div className="mt-5 flex items-center justify-between font-mono text-[0.625rem] text-ink-3"><span>{item.progress}/{item.target}</span><span>{item.completed ? t("achievements.completed") : item.progress === 0 ? t("achievements.notStarted") : `${percent}%`}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold" /></div>
      <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 text-[0.6875rem] text-ink-3"><span className="flex items-center gap-1"><Award className="size-3.5 text-gold" /> +{item.reward.xp} XP · +{item.reward.gems} gems</span>{item.completed && <span className="flex items-center gap-1 text-gold">✓ {t("achievements.rewardClaimed")} <ChevronRight className="size-3" /></span>}</div>
    </article>
  );
}

function AchievementDetail({ item, onClose, onShare }: { item: Item; onClose: () => void; onShare: () => void }) {
  const { t } = useI18n();
  const percent = Math.min(100, Math.round((item.progress / Math.max(1, item.target)) * 100));
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-noir/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
        <motion.article initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md rounded-3xl border border-gold/35 bg-noir-2 p-7 shadow-[0_0_90px_rgba(212,165,116,0.2)]" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={onClose} aria-label="Fermer" className="absolute end-4 top-4 p-1 text-ink-3 hover:text-ink"><X className="size-4" /></button>
          <div className="flex items-start gap-4">
            <span className={cn("text-5xl", !item.completed && "grayscale opacity-60")}>{item.icon}</span>
            <div>
              <p className="font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-gold">{item.completed ? t("achievements.titles.completed") : t("achievements.titles.locked")}</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.description}</p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between font-mono text-[0.625rem] text-ink-3"><span>{t("achievements.titles.progress")}</span><span>{item.progress}/{item.target} · {percent}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold" style={{ width: `${percent}%` }} /></div>
          <button type="button" onClick={onShare} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gold/35 py-2.5 text-sm font-semibold text-gold"><Share2 className="size-4" />Partager</button>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gold/20 bg-gold/8 p-4"><p className="font-mono text-[0.5625rem] uppercase tracking-widest text-ink-3">XP</p><p className="mt-1 text-xl font-bold text-gold">+{item.reward.xp}</p></div>
            <div className="rounded-2xl border border-gold/20 bg-gold/8 p-4"><p className="font-mono text-[0.5625rem] uppercase tracking-widest text-ink-3">Gems</p><p className="mt-1 text-xl font-bold text-gold">+{item.reward.gems}</p></div>
          </div>
          <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-semibold text-noir">Fermer</button>
        </motion.article>
      </motion.div>
    </AnimatePresence>
  );
}
