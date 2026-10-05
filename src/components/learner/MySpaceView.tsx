import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate } from "react-router";
import {
  Heart,
  Languages,
  LayoutDashboard,
  Library,
  Settings2,
  Share2,
  Sparkles,
  Target,
  User,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { LANGUAGES, levelFromXp } from "@/convex/languages";
import type { LanguageCode } from "@/convex/languages";
import { useAuth } from "@/hooks/use-auth";
import { LibraryView } from "@/components/openverse/views";
import type { Content } from "@/openverse/model";
import { RollingCounter } from "@/components/fx/rewards";
import { DashboardView } from "./DashboardView";
import { ProfileView } from "./ProfileView";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { AvatarPicker, SelectedAvatar } from "./AvatarPicker";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import { ShareModal } from "./ShareModal";
import { shareStats } from "@/lib/shareEngine";

/* Le lecteur GLB est un chunk séparé : three.js n'entre dans le bundle que
   si l'utilisateur possède réellement un avatar 3D — voir SelectedAvatar,
   qui décide entre l'avatar 3D et l'emoji habillé. */

/* ═══════════════════════════════════════════════════════════════════
   MON ESPACE — section unique (§6, §31, §32).

   « Mon espace » et « Profil » étaient deux écrans qui affichaient les
   mêmes chiffres. Ils sont désormais une seule section, découpée en trois
   onglets : l'aperçu (niveau, progression, objectifs, historique
   d'apprentissage), le profil linguistique (langues, vocabulaire,
   expressions, argot) et les contenus sauvegardés.

   Aucune vue n'est réécrite : les composants existants (DashboardView,
   ProfileView, LibraryView) sont simplement réunis ici au lieu d'être
   dispersés dans la navigation.
   ═══════════════════════════════════════════════════════════════════ */

type SpaceTab = "overview" | "profile" | "saved";

const TABS: { key: SpaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Aperçu", icon: LayoutDashboard },
  { key: "profile", label: "Profil & langues", icon: User },
  { key: "saved", label: "Contenus sauvegardés", icon: Library },
];

const ROMAN = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV",
];

/** Bandeau d'identité : qui tu es, ce que tu apprends, où tu en es. */
function ProfileStrip({ onCustomize }: { onCustomize: () => void }) {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const overview = useQuery(api.stats.overview);
  const myLanguages = useQuery(api.learning.myLanguages);
  const favorites = useQuery(api.favorites.mySlangFavorites, {});
  const customization = useQuery(api.customization.getMyCustomization, { lang });
  const achievements = useQuery(api.achievements.getMyAchievements, { lang });
  const gamification = useQuery(api.gamification.getUserStats);
  const referrals = useQuery(api.referrals.getMyReferrals);
  // Meme source que ProfileView pour le nombre d'expressions partagees.
  const learningStats = useQuery(api.learning.myStats);
  const leaderboardShare = useQuery(api.leaderboard.getCurrentLeaderboard, {});
  const [shareOpen, setShareOpen] = useState(false);
  // Une seule source de vérité pour le look affiché : `SelectedAvatar`
  // lit `getMyCustomization` et décide seul (avatar 3D si présent et
  // renderable, sinon emoji habillé). Ce bandeau n'a donc plus de copie
  // locale `savedUrl` — qui pouvait diverger de la base — ni de bouton
  // « avatar 3D » : le studio vit dans l'onglet « Avatar 3D » de la
  // section « Forge ton look », plus bas.

  const focus = (myLanguages?.activeFocus ?? []) as LanguageCode[];
  const initials = (user?.name ?? user?.email ?? "LN").trim().charAt(0).toUpperCase();

  const chips = focus
    .map((code) => LANGUAGES.find((l) => l.code === code))
    .filter((l): l is (typeof LANGUAGES)[number] => Boolean(l));

  return (
    <section className="ln-card relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -end-16 -top-24 size-80 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-7 lg:flex-row">
        <div className="text-center">
          {/* L'aperçu ne montre QUE le look : avatar 3D s'il existe, sinon
              l'emoji habillé. Le bouton dessous est le SEUL passage vers
              la forge — pas de second raccourci concurrent. */}
          <button
            type="button"
            onClick={onCustomize}
            className="rounded-[2.5rem] transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gold/50"
            aria-label={t("space.customize")}
          >
            <SelectedAvatar size="xl" />
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onCustomize}
              className="rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 py-2.5 text-sm font-semibold text-noir"
            >
              {t("space.customize")}
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-gold/35 px-5 py-2.5 text-sm font-semibold text-gold"
            >
              <Share2 className="size-4" />
              {t("share.button")}
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center lg:text-start">
          <p className="font-mono text-[0.5625rem] uppercase tracking-[0.25em] text-gold">{t("space.identity")}</p>
          <p className="ln-wrap-anywhere mt-1 truncate font-display text-2xl font-semibold text-ink">{user?.name ?? t("space.title")}</p>
          <p className="truncate font-mono text-[0.6875rem] text-ink-3">{user?.email ?? t("space.guest")}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
            {chips.length === 0 ? <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.6875rem] text-ink-3">{t("space.noFocus")}</span> : chips.map((l) => <span key={l.code} className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-[0.6875rem] text-gold">{l.flag} {l.name}</span>)}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t("space.level"), value: ROMAN[(overview?.level ?? 1) - 1] ?? String(overview?.level ?? 1) },
              { label: "XP", value: <RollingCounter value={gamification?.totalXP ?? overview?.xp ?? 0} /> },
              { label: t("space.streak"), value: `${gamification?.currentStreak ?? overview?.streakCurrent ?? 0} j` },
              { label: t("space.gems"), value: customization?.gems ?? gamification?.gems ?? 0 },
            ].map((cell) => <div key={cell.label} className="rounded-xl border border-white/7 bg-noir/55 px-3 py-3 text-center"><p className="font-display text-xl font-bold text-gold">{cell.value}</p><p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">{cell.label}</p></div>)}
          </div>
        </div>
      </div>

      <div className="relative mt-7 border-t border-gold/15 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-gold">{t("space.collections")}</p><p className="mt-1 text-xs text-ink-3">{t("space.collectionHint")}</p></div>
          <p className="font-mono text-xs text-gold">{customization?.unlocked.length ?? 0}/85</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["avatar", "hat", "glasses", "background"] as const).map((type) => {
            const total = customization?.catalog.filter((item) => item.type === type).length ?? { avatar: 50, hat: 15, glasses: 10, background: 10 }[type];
            const owned = customization?.unlocked.filter((id) => customization.catalog.find((item) => item.itemId === id)?.type === type).length ?? 0;
            const percent = Math.round((owned / Math.max(1, total)) * 100);
            return <div key={type} className="rounded-2xl border border-white/7 bg-noir/50 p-4"><div className="flex items-center justify-between text-xs"><span className="font-semibold">{t(`customization.tabs.${type}`)}</span><span className="font-mono text-[0.625rem] text-ink-3">{owned}/{total}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold transition-[width]" style={{ width: `${percent}%` }} /></div></div>;
          })}
        </div>
      </div>

      <div className="relative mt-6 border-t border-gold/15 pt-6">
        <div className="flex items-end justify-between gap-3"><div><p className="font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-gold">{t("space.achievements")}</p><p className="mt-1 text-xs text-ink-3">{t("space.achievementHint")}</p></div><p className="font-display text-xl font-bold text-gold">{achievements?.summary.completed ?? 0}<span className="text-xs text-ink-3">/150</span></p></div>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {(achievements?.items ?? []).filter((item) => item.completed).slice(0, 16).map((item) => <div key={item.achievementId} title={`${item.title} · +${item.reward.xp} XP · +${item.reward.gems} gems`} className="flex aspect-square items-center justify-center rounded-xl border border-gold/25 bg-gold/8 text-3xl">{item.icon}</div>)}
          {(achievements?.items ?? []).filter((item) => item.completed).length === 0 && <p className="col-span-full rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-ink-3">{t("space.noAchievements")}</p>}
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        userId={user?._id ?? referrals?.inviteCode ?? ""}
        filename="kilingo-espace"
        generate={() => shareStats({
          userId: user?._id ?? referrals?.inviteCode ?? "kilingo",
          expressions: learningStats?.totalCards ?? 0,
          days: Math.max(1, new Date().getDate()),
          streak: gamification?.currentStreak ?? overview?.streakCurrent ?? 0,
          league: leaderboardShare?.my?.league ?? "bronze",
          achievements: achievements?.summary.completed ?? 0,
          avatar: {
            avatar: customization?.catalog.find((item) => item.itemId === customization.selectedAvatar)?.previewUrl ?? "🦁",
            hat: customization?.catalog.find((item) => item.itemId === customization.selectedHat)?.previewUrl ?? null,
            glasses: customization?.catalog.find((item) => item.itemId === customization.selectedGlasses)?.previewUrl ?? null,
            background: customization?.catalog.find((item) => item.itemId === customization.selectedBackground)?.previewUrl ?? null,
          },
        })}
      />
    </section>
  );
}

export function MySpaceView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [tab, setTab] = useState<SpaceTab>("overview");
  // La forge d'avatar vit ici, au même niveau que le bandeau : en desktop
  // elle se déplie comme une section, jamais comme une modale.
  const [customizationOpen, setCustomizationOpen] = useState(false);
  // « Personnaliser » ouvre ET amène la section sous les yeux : sans ça le
  // bouton semblait mort, la forge apparaissant hors champ, plus bas.
  const openForge = useCallback(() => {
    setCustomizationOpen(true);
    // Deux temps : d'abord le rendu (la section doit exister), puis le
    // scroll — sinon l'ancre n'a pas d'élément à viser.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById("avatar-studio")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);
  // Clic carte = fiche pleine page ; Mon espace garde son onglet et son scroll.
  const navigate = useNavigate();
  const openDetail = useCallback(
    (c: Content) => navigate(`/app/content/${encodeURIComponent(c.key)}`),
    [navigate],
  );
  const me = useQuery(api.learning.myStats);
  const favorites = useQuery(api.favorites.mySlangFavorites, {});

  // Self-heal one-shot (anti-quota R6) : complète le registre dénormalisé
  // sur les cartes créées avant la migration. Une seule fois par navigateur
  // — ensuite zéro coût (la mutation ne lit que les cartes de l'appelant,
  // et ne patche que celles qui en ont besoin).
  const backfillRegisters = useMutation(api.learning.backfillMyCardRegisters);
  useEffect(() => {
    const KEY = "ln-register-backfill-v1";
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, "1");
    backfillRegisters().catch(() => localStorage.removeItem(KEY));
  }, [backfillRegisters]);

  return (
    <div className="space-y-5">
      <PlaceHeader
        place="space"
        title="Mon espace"
        icon={User}
        motif="kente"
        description="Ton profil, tes langues, ta progression, ta mémoire et tes contenus sauvegardés — au même endroit."
        actions={
          <Link
            to="/app/settings"
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
          >
            <Settings2 className="size-3.5" aria-hidden /> Préférences personnelles
          </Link>
        }
      />

      <ProfileStrip onCustomize={openForge} />

      <AvatarPicker
        open={customizationOpen}
        onOpenChange={setCustomizationOpen}
      />

      {/* Trois portes d'entrée, une seule section. */}
      <div
        role="tablist"
        aria-label="Sections de Mon espace"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                active
                  ? "border-gold/50 bg-gold/10 font-medium text-gold"
                  : "border-white/10 text-ink-2 hover:border-gold/30 hover:text-gold",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {item.key === "saved" && (favorites?.length ?? 0) > 0 && (
                <span className="font-mono text-[0.625rem] text-ink-3">
                  {favorites?.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div key={tab} className="ln-tab-in">
        {tab === "overview" && <DashboardView onNavigate={onNavigate} />}

        {tab === "profile" && (
          <div className="space-y-6">
            <ProfileView />

            {/* Expressions mises de côté : ranger est distinct d'apprendre. */}
            {(favorites?.length ?? 0) > 0 && (
              <section>
                <h2 className="flex items-center gap-2 font-mono text-xs tracking-widest text-ink-2 uppercase">
                  <Heart className="size-3.5 text-gold" /> Expressions favorites
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {favorites!.map((row) => (
                    <div key={row.favoriteId} className="ln-card p-4">
                      <p className="font-display text-lg italic">
                        {row.slang.expression}
                      </p>
                      <p className="mt-1 text-sm text-ink-2">{row.slang.meaning}</p>
                      <p className="mt-2 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                        {LANGUAGES.find((l) => l.code === row.slang.language)?.flag}{" "}
                        {row.slang.region}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Vocabulaire & expressions du deck, en un coup d'œil. */}
            {me && (
              <section className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: Sparkles,
                    label: "Mots & expressions en mémoire",
                    value: me.totalCards,
                  },
                  { icon: Target, label: "À revoir aujourd'hui", value: me.dueCount },
                  {
                    icon: Languages,
                    label: "Langues suivies",
                    value: me.perLanguage.length,
                  },
                ].map((cell) => (
                  <div key={cell.label} className="ln-card p-4">
                    <cell.icon className="size-4 text-gold" />
                    <p className="mt-2 font-display text-2xl font-bold">
                      <RollingCounter value={cell.value} />
                    </p>
                    <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                      {cell.label}
                    </p>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {tab === "saved" && (
          <>
            <LibraryView tab="library" onOpen={openDetail} />
            <div className="mt-6 space-y-2">
              <h2 className="font-mono text-xs tracking-widest text-ink-2 uppercase">
                Historique de lecture
              </h2>
              <LibraryView tab="history" onOpen={openDetail} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
