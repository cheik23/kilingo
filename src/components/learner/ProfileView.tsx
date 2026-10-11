import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  LANGUAGES,
  registerKey,
  levelFromXp,
  levelProgress,
  type LanguageCode,
} from "@/convex/languages";
import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
import { Link } from "react-router";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useOptionalQuery } from "@/lib/optionalQuery";
import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap";
import { useChartPalette } from "@/components/analytics/chartTheme";
import { RollingCounter } from "@/components/fx/rewards";
import { MasteryTree } from "./MasteryTree";
import { AvatarPicker, SelectedAvatar } from "./AvatarPicker";
import { ShareModal } from "./ShareModal";
import { shareStats } from "@/lib/shareEngine";
import { useAuth } from "@/hooks/use-auth";
import { Share2 } from "lucide-react";
import {
  Award,
  BookOpenCheck,
  CalendarDays,
  Clock,
  Crown,
  Flame,
  Heart,
  Languages,
  Layers,
  Pencil,
  Settings2,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

const BADGES = [
  { icon: Flame, name: "Semaine de feu", desc: "7 jours de streak", test: (s: number) => s >= 7 },
  { icon: Trophy, name: "Polyglotte débutant", desc: "A2 dans une langue", test: () => false },
  { icon: Award, name: "Collectionneur", desc: "20 cartes au deck", test: (s: number) => s >= 20 },
];

export function ProfileView() {
  const { t } = useI18n();
  const stats = useQuery(api.learning.myStats);
  const deck = useQuery(api.learning.myDeck);
  const leaderboard = useQuery(api.leaderboard.getCurrentLeaderboard, {});
  const removeFromSrs = useMutation(api.learning.removeFromSrs);
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { user } = useAuth();
  const customization = useQuery(api.customization.getMyCustomization, { lang: "fr" });
  const referrals = useQuery(api.referrals.getMyReferrals);
  const leaderboardShare = useQuery(api.leaderboard.getCurrentLeaderboard, {});
  const achievementsShare = useQuery(api.achievements.getMyAchievements, {});
  const overview = useQuery(api.stats.overview);
  const favorites = useQuery(api.favorites.mySlangFavorites, {});
  const heatmap = useQuery(api.stats.heatmap, { weeks: 26 });
  const premium = useQuery(api.subscriptions.getMyPremiumStatus);
  // Lecture tolérante : l'historique d'abonnement est un détail — un backend
  // en retard ne doit pas faire tomber le profil entier.
  const subscriptions = useOptionalQuery(api.subscriptions.getMySubscriptions, {}).data;
  /** Palette des graphiques du thème actif (le radar doit suivre clair/sombre). */
  const palette = useChartPalette();

  if (!stats || !deck) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-shimmer h-40 w-full max-w-lg rounded-xl" />
      </div>
    );
  }

  const radarData = stats.perLanguage.map((l) => ({
    lang: LANGUAGES.find((x) => x.code === l.language)?.code.toUpperCase() ?? "",
    niveau: Math.min(100, l.xp / 10),
  }));

  const maxStreak = Math.max(...stats.perLanguage.map((l) => l.streak), 0);

  /** Leçons terminées : somme des séances réellement enregistrées, par langue. */
  const lessons = stats.perLanguage.reduce((sum, item) => sum + item.sessions, 0);
  const signupDate = user?._creationTime
    ? new Date(user._creationTime).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6">
      {/* ── Carte de profil — identité, niveau, ancienneté, badges ──── */}
      <section className="ln-card rounded-3xl border-gold/20 bg-gradient-to-br from-gold/[0.07] to-transparent p-6">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-start">
          <button
            type="button"
            onClick={() => setCustomizationOpen(true)}
            className={cn(
              "shrink-0 rounded-full border-2 p-1 transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-gold/50",
              premium?.isPremium ? "border-gold" : "border-white/15",
            )}
            aria-label={t("space.customize")}
          >
            <SelectedAvatar size="xl" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.5625rem] uppercase tracking-[0.25em] text-gold">
              {t("space.identity")}
            </p>
            <h1 className="mt-1 truncate font-display text-3xl font-semibold text-ink">
              {user?.name ?? user?.email ?? "KILINGO"}
            </h1>

            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[0.6875rem] text-ink-3 sm:justify-start">
              <span className="flex items-center gap-1.5">
                <Trophy className="size-3.5 text-gold" aria-hidden />
                Niveau {levelFromXp(stats.totalXp)} · {stats.totalXp} XP
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden />
                Inscrit le {signupDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="size-3.5" aria-hidden />
                {maxStreak} j de série
              </span>
            </p>

            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[0.625rem] uppercase",
                  premium?.isPremium
                    ? "border-gold/45 bg-gold/10 text-gold"
                    : "border-white/10 text-ink-3",
                )}
              >
                <Crown className="size-3.5" aria-hidden />
                {premium?.isPremium ? "Premium" : "Compte gratuit"}
              </span>
              {(referrals?.totalFriends ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 font-mono text-[0.625rem] text-ink-2 uppercase">
                  <Users className="size-3.5 text-gold" aria-hidden />
                  {referrals?.totalFriends} filleul(s)
                </span>
              )}
              {(achievementsShare?.summary.completed ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 font-mono text-[0.625rem] text-ink-2 uppercase">
                  <Award className="size-3.5 text-gold" aria-hidden />
                  {achievementsShare?.summary.completed} succès
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={() => setCustomizationOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 py-2.5 text-sm font-semibold text-noir transition-transform hover:scale-[1.02]"
              >
                <Pencil className="size-4" aria-hidden />
                {t("space.customize")}
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-gold/35 px-5 py-2.5 text-sm font-semibold text-gold"
              >
                <Share2 className="size-4" aria-hidden />
                {t("share.button")}
              </button>
              <Link
                to="/app/settings"
                className="flex items-center gap-2 rounded-xl border border-white/12 px-5 py-2.5 text-sm font-semibold text-ink-2 transition-colors hover:border-gold/35 hover:text-gold"
              >
                <Settings2 className="size-4" aria-hidden />
                Paramètres
              </Link>
            </div>
          </div>
        </div>
      </section>
      <AvatarPicker open={customizationOpen} onOpenChange={setCustomizationOpen} />
      <ShareModal open={shareOpen} onOpenChange={setShareOpen} userId={user?._id ?? referrals?.inviteCode ?? ""} filename="kilingo-stats" generate={() => shareStats({
        userId: user?._id ?? referrals?.inviteCode ?? "kilingo",
        expressions: stats.totalCards,
        days: Math.max(1, new Date().getDate()),
        streak: stats.perLanguage.reduce((sum, item) => Math.max(sum, item.streak), 0),
        league: leaderboardShare?.my?.league ?? "bronze",
        achievements: achievementsShare?.summary.completed ?? 0,
        avatar: {
          avatar: customization?.catalog.find((item) => item.itemId === customization.selectedAvatar)?.previewUrl ?? "🦁",
          hat: customization?.catalog.find((item) => item.itemId === customization.selectedHat)?.previewUrl ?? null,
          glasses: customization?.catalog.find((item) => item.itemId === customization.selectedGlasses)?.previewUrl ?? null,
          background: customization?.catalog.find((item) => item.itemId === customization.selectedBackground)?.previewUrl ?? null,
        },
      })} />
      <div>
        <p className="font-mono text-xs tracking-widest text-gold uppercase">
          Ton empire linguistique
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          Ton profil linguistique
        </h1>
      </div>

      {/* MOD 4 — badge de ligue permanent, figé pour la semaine. */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/25 bg-gradient-to-r from-gold/10 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-noir/40 text-xl">
            {leaderboard?.my?.league === "silver" ? "⚪" : leaderboard?.my?.league === "gold" ? "🟡" : leaderboard?.my?.league === "platinum" ? "💎" : leaderboard?.my?.league === "diamond" ? "💠" : "🟤"}
          </span>
          <div>
            <p className="font-mono text-[0.5625rem] tracking-[0.2em] text-gold uppercase">{t("leaderboard.leagueBadge")}</p>
            <p className="mt-0.5 font-display text-lg font-semibold">
              {t(`league.${leaderboard?.my?.league ?? "bronze"}`)} — {t("leaderboard.week", { week: leaderboard?.my?.lastLeagueWeek ?? leaderboard?.weekKey ?? "—" })}
            </p>
          </div>
        </div>
        <span className="font-mono text-xs text-ink-3">#{leaderboard?.my?.rank ?? "—"} · {leaderboard?.my?.xp ?? 0} XP</span>
      </div>

      {/* Statistiques personnelles — trois colonnes sur desktop. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: TrendingUp, label: "XP total", value: stats.totalXp, suffix: "" },
          { icon: Clock, label: "Temps d'étude total", value: stats.totalMinutes, suffix: " min" },
          { icon: BookOpenCheck, label: "Leçons terminées", value: lessons, suffix: "" },
          { icon: Languages, label: "Langues apprises", value: stats.perLanguage.length, suffix: "" },
          { icon: Heart, label: "Expressions favorites", value: favorites?.length ?? 0, suffix: "" },
          { icon: Layers, label: "Expressions au deck", value: stats.totalCards, suffix: "" },
          { icon: Award, label: "Médias analysés", value: overview?.mediaCount ?? 0, suffix: "" },
          { icon: Users, label: "Filleuls parrainés", value: referrals?.totalFriends ?? 0, suffix: "" },
          { icon: Flame, label: "Meilleure série", value: maxStreak, suffix: " j" },
        ].map((s) => (
          <div key={s.label} className="ln-card p-5">
            <s.icon className="size-5 text-gold" aria-hidden />
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              <RollingCounter value={s.value} suffix={s.suffix} />
            </p>
            <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* radar */}
        <div className="ln-card p-6">
          <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
            Les 5 langues en un regard
          </p>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke={palette.grid} strokeOpacity={0.14} />
                <PolarAngleAxis
                  dataKey="lang"
                  tick={{ fill: palette.axis, fontSize: 11 }}
                />
                <Radar
                  dataKey="niveau"
                  stroke={palette.gold}
                  fill={palette.gold}
                  fillOpacity={0.25}
                />
                <Tooltip
                  contentStyle={{
                    background: palette.surface,
                    border: `1px solid ${palette.gold}55`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* per language table */}
        <div className="ln-card p-6">
          <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
            Détail par langue
          </p>
          <div className="mt-4 space-y-3">
            {stats.perLanguage.map((l) => {
              const meta = LANGUAGES.find((x) => x.code === l.language)!;
              return (
                <div
                  key={l.language}
                  className="rounded-xl border border-white/5 bg-noir/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-lg">{meta.flag}</span> {meta.name}
                      {l.active && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[0.5625rem] text-gold">
                          ACTIF
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-gold">
                      {levelFromXp(l.xp)} · {l.xp} XP
                    </span>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                      style={{ width: `${levelProgress(l.xp)}%` }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[0.625rem] text-ink-3">
                    {l.cards} cartes · {l.due} à revoir · {l.minutes} min ·{" "}
                    {l.streak}j streak
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activité type « contributions » — 6 derniers mois. */}
      <section className="ln-card p-6">
        <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
          Activité des 6 derniers mois
        </p>
        <p className="mt-1 text-xs text-ink-3">
          Une case = un jour, colorée par le nombre de séances enregistrées.
        </p>
        <div className="mt-4">
          {heatmap === undefined ? (
            <div className="h-32 animate-pulse rounded-xl bg-white/5" />
          ) : (
            <ActivityHeatmap days={heatmap} />
          )}
        </div>
      </section>

      {/* Abonnement — affiché dès qu'une ligne existe (actif comme expiré). */}
      {(premium?.hasSubscription || (subscriptions?.length ?? 0) > 0) && (
        <section className="ln-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
              Abonnement
            </p>
            <span
              className={cn(
                "rounded-full border px-3 py-1 font-mono text-[0.625rem] uppercase",
                premium?.isPremium
                  ? "border-gold/45 bg-gold/10 text-gold"
                  : "border-white/10 text-ink-3",
              )}
            >
              {premium?.status ?? "inconnu"}
              {premium?.testMode ? " · test" : ""}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-noir/40 p-4">
              <p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                Fin de période
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {premium?.currentPeriodEnd
                  ? new Date(premium.currentPeriodEnd).toLocaleDateString("fr-FR")
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-noir/40 p-4">
              <p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                Fin d'essai
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {premium?.trialEndsAt
                  ? new Date(premium.trialEndsAt).toLocaleDateString("fr-FR")
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-noir/40 p-4">
              <p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                Offre
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">
                {premium?.variantId ?? "—"}
              </p>
            </div>
          </div>

          {(subscriptions?.length ?? 0) > 0 && (
            <ul className="mt-4 space-y-2">
              {subscriptions?.map((row) => (
                <li
                  key={`${row.createdAt}-${row.variantId ?? "v"}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-noir/30 px-4 py-3 text-xs"
                >
                  <span className="font-mono text-ink-2 uppercase">
                    {row.status} · {row.providerStatus}
                  </span>
                  <span className="text-ink-3">
                    {new Date(row.createdAt).toLocaleDateString("fr-FR")} →{" "}
                    {new Date(row.updatedAt).toLocaleDateString("fr-FR")}
                    {row.currentPeriodEnd
                      ? ` · jusqu'au ${new Date(row.currentPeriodEnd).toLocaleDateString("fr-FR")}`
                      : ""}
                    {row.testMode ? " · mode test" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* maîtrise par registre d'argot */}
      <MasteryTree />

      {/* badges */}
      <div>
        <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
          Badges lifestyle
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {BADGES.map((b) => {
            const unlocked = b.test(stats.totalCards) || (b.name === "Semaine de feu" && maxStreak >= 7);
            return (
              <div
                key={b.name}
                className={`ln-card flex items-center gap-4 p-5 ${unlocked ? "" : "opacity-40"}`}
              >
                <span
                  className={`flex size-11 items-center justify-center rounded-xl border ${
                    unlocked
                      ? "border-gold/30 bg-gold/10 text-gold"
                      : "border-white/10 bg-white/5 text-ink-3"
                  }`}
                >
                  <b.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-ink-3">{b.desc}</p>
                </div>
                {unlocked && (
                  <span className="ml-auto font-mono text-[0.5625rem] tracking-widest text-gold uppercase">
                    Obtenu
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* deck */}
      <div>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
            Mon deck ({deck.length})
          </p>
        </div>
        {deck.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">
            Ton deck est vide — ajoute des expressions depuis le mode découverte.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deck.map(({ card, slang }) => (
              <div key={card._id} className="ln-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg italic">
                      {slang.expression}
                    </p>
                    <p className="text-xs text-ink-3">
                      {LANGUAGES.find((l) => l.code === slang.language)?.flag}{" "}
                      {slang.meaning}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await removeFromSrs({ slangId: slang._id as never });
                      toast.success("Retiré du deck");
                    }}
                    className="rounded-lg border border-white/10 p-1.5 text-ink-3 transition-colors hover:border-red-400/40 hover:text-red-300"
                    title="Retirer du deck"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[0.625rem] text-ink-3">
                  <span>
                    {slang.register && registerKey(slang.register)
                      ? t(`registers.${registerKey(slang.register)}`)
                      : slang.register}
                  </span>
                  <span>
                    répét. {card.repetitions} ·{" "}
                    {card.nextReview <= Date.now()
                      ? "à revoir"
                      : `J+${Math.ceil((card.nextReview - Date.now()) / 86_400_000)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
