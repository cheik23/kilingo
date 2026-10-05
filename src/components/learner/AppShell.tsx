import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "convex/react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import {
  BarChart3,
  Award,
  BookOpen,
  BrainCircuit,
  Clapperboard,
  MessageCircle,
  Compass,
  Flame,
  Gem,
  Globe2,
  Headphones,
  Heart,
  History,
  Home,
  Languages,
  LayoutDashboard,
  Library,
  Menu as MenuIcon,
  Map as MapIcon,
  Mic,
  Moon,
  Music2,
  Newspaper,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  Trophy,
  User,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { LANGUAGES } from "@/convex/languages";
import { LogoDropdown } from "@/components/LogoDropdown";
import { BrandLink, BrandLockup } from "@/components/brand/Logo";
import { NoirAmbience } from "@/components/fx/NoirAmbience";
import { NetworkBackdrop } from "@/components/fx/NetworkBackdrop";
import { MascotProvider } from "@/components/three/MascotProvider";
import { startFpsWatchdog, supportsReducedMotion, usePerfMode } from "@/lib/perf";
import { CountUp } from "@/components/fx/rewards";
import { FocusDialog } from "./FocusDialog";
import { Onboarding } from "./Onboarding";
import { LastChanceModal } from "./LastChanceModal";
import { StreakBanner } from "./StreakBanner";
import { NotificationsBell } from "./NotificationsBell";
import { useUnopenedLootCount } from "./LootBoxModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UI_LANGS, uiLangMeta, useI18n, type UiLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { soundEngine } from "@/lib/soundEngine";

/* ═══════════════════════════════════════════════════════════════════
   MOOVY — coquille authentifiée.

   Toutes les vues existantes (Dashboard, Découverte, Révision, Shadow,
   SleepShadow, Media Hub, Profil, Studio, moteur de contenus) sont
   montées ici via des routes imbriquées : aucune fonctionnalité n'est
   réécrite ni dupliquée, elles sont simplement raccordées.

   Navigation §5 : Accueil · Films & vidéos · Musiques · Livres · Audio ·
   Actualités · Explorer · Recherche · Ma bibliothèque · Ma mémoire ·
   Historique · Favoris · Mon espace · Paramètres.

   L'administration n'apparaît jamais dans la navigation utilisateur :
   elle n'est montée que si le compte connecté possède le rôle admin.
   ═══════════════════════════════════════════════════════════════════ */

type NavItem = {
  /** Clé i18n (namespace `nav`). */
  key: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Correspondance exacte de la route (utile pour la racine `/app`). */
  end?: boolean;
};

/** §5 — navigation principale. */
const MAIN_NAV: NavItem[] = [
  { key: "nav.home", to: "/app", icon: Home, end: true },
  { key: "nav.screen", to: "/app/screen", icon: Clapperboard },
  { key: "nav.music", to: "/app/music", icon: Music2 },
  { key: "nav.books", to: "/app/books", icon: BookOpen },
  { key: "nav.audio", to: "/app/talk", icon: Mic },
  { key: "nav.atlas", to: "/app/atlas", icon: MapIcon },
  { key: "nav.library", to: "/app/library", icon: Library },
  { key: "nav.memory", to: "/app/memory", icon: Sparkles },
  { key: "nav.history", to: "/app/history", icon: History },
  { key: "nav.favorites", to: "/app/favorites", icon: Heart },
  { key: "nav.analytics", to: "/app/analytics", icon: BarChart3 },
  { key: "nav.leaderboard", to: "/app/leaderboard", icon: Trophy },
  { key: "nav.achievements", to: "/app/achievements", icon: Award },
  { key: "nav.store", to: "/app/store", icon: Store },
  { key: "nav.quiz", to: "/app/quiz", icon: BrainCircuit },
  { key: "nav.conversation", to: "/app/conversation", icon: MessageCircle },
  { key: "nav.space", to: "/app/space", icon: User },
  { key: "nav.invite", to: "/app/invite", icon: UserPlus },
  { key: "nav.settings", to: "/app/settings", icon: Settings2 },
];

/** Modules conservés (§61) — regroupe les outils d'immersion. */
const TOOL_NAV: NavItem[] = [
  { key: "nav.discover", to: "/app/discover", icon: Compass },
  { key: "nav.shadow", to: "/app/shadow", icon: Headphones },
  { key: "nav.sleep", to: "/app/sleep", icon: Moon },
];

/**
 * Administration — hors navigation utilisateur.
 * Ce groupe n'est monté que si le compte connecté est administrateur ;
 * le backend revérifie de toute façon le rôle à chaque appel.
 */
const ADMIN_NAV: NavItem[] = [
  { key: "nav.admin", to: "/app/admin", icon: ShieldCheck },
];

/** Barre inférieure mobile : les 4 gestes du quotidien. */
const MOBILE_NAV: NavItem[] = [
  { key: "nav.home", to: "/app", icon: Home, end: true },
  { key: "nav.discover", to: "/app/discover", icon: Compass },
  { key: "nav.memory", to: "/app/memory", icon: Sparkles },
  { key: "nav.atlas", to: "/app/atlas", icon: MapIcon },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
    isActive
      ? "bg-gold/10 font-medium text-gold"
      : "text-ink-2 hover:bg-white/[0.03] hover:text-ink",
  );
}

function NavEntry({ item }: { item: NavItem }) {
  const { t } = useI18n();
  // MOD 2 — pastille or sur l'icône Boutique : loot boxes non ouvertes.
  const unopenedLoot = useUnopenedLootCount();
  const showLootDot = item.key === "nav.store" && (unopenedLoot ?? 0) > 0;
  return (
    <li>
      <NavLink to={item.to} end={item.end} className={navLinkClass}>
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-gold"
              />
            )}
            <span className="relative shrink-0">
              <item.icon className="ln-nav-flip size-4" />
              {showLootDot && (
                <span
                  aria-hidden
                  className="absolute -end-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-noir bg-gold px-0.5 font-mono text-[0.5rem] font-bold text-noir"
                >
                  {unopenedLoot! > 9 ? "9+" : unopenedLoot}
                </span>
              )}
            </span>
            <span className="min-w-0 truncate">{t(item.key)}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

/** Les libellés sont re-clés sur la langue : fondu au changement de langue. */
function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const { lang } = useI18n();
  return (
    <div key={lang} className="ln-lang-fade">
      <p className="px-3 pb-2 font-mono text-[0.625rem] tracking-[0.2em] text-ink-3 uppercase">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <NavEntry key={item.to} item={item} />
        ))}
      </ul>
    </div>
  );
}

function NavList({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <NavGroup label={t("nav.mainNav")} items={MAIN_NAV} />
      <NavGroup label={t("nav.tools")} items={TOOL_NAV} />
      {isAdmin && <NavGroup label={t("nav.admin")} items={ADMIN_NAV} />}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <BrandLink to="/app" size="sm" />;
}

/** Sélecteur de langue d'interface : code + nom natif, hover or. */
function UiLangSelect() {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("common.uiLang")}
          className="gap-2 border border-white/10 text-ink-2 hover:text-gold"
        >
          <Languages className="size-4" />
          <span className="font-mono text-xs uppercase">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 border-white/10 bg-noir-2"
      >
        {UI_LANGS.map((code: UiLang) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLang(code)}
            className={cn(
              "cursor-pointer gap-3",
              code === lang ? "text-gold" : "text-ink-2 focus:text-gold",
            )}
          >
            <span className="w-6 font-mono text-[0.625rem] uppercase">
              {code}
            </span>
            <span className="flex-1">{uiLangMeta(code).native}</span>
            {code === lang && (
              <span aria-hidden className="size-1.5 rounded-full bg-gold" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mémorise l'échappatoire à l'onboarding le temps de la session onglet. */
const SKIP_ONBOARDING_KEY = "ln.onboarding.skipped";

/** Jabari partage son humeur dans tout le shell : une seule source d'état. */
export function AppShell() {
  return (
    <MascotProvider>
      <AppShellInner />
    </MascotProvider>
  );
}

function AppShellInner() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  // MODULE 3 + 6 — la rotation 3D entre pages n'a de sens que si la
  // machine suit ; le mode `lite` (watchdog FPS) retombe sur un fondu.
  const perfMode = usePerfMode();
  const page3D = perfMode === "full" && !supportsReducedMotion();
  useEffect(() => startFpsWatchdog(), []);
  // Le thème global est initialisé par ThemeRuntime à la racine.
  const [soundMuted, setSoundMuted] = useState(soundEngine.isMuted());
  const [navOpen, setNavOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const myLanguages = useQuery(api.learning.myLanguages);
  // Le rôle vient du backend : l'interface ne fait que s'y conformer.
  const access = useQuery(api.ovAdmin.amIAdmin);
  const isAdmin = access?.admin === true;

  // MOD 2 — économie : compteur gems (header) + badge Double XP animé.
  const doubleXp = useQuery(api.gamification.hasDoubleXp);
  const [, setXpTick] = useState(0);
  useEffect(() => {
    if (!doubleXp?.active) return;
    const id = setInterval(() => setXpTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [doubleXp?.active]);

  // Referme le tiroir mobile après chaque navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // MOD 1 — C : au premier chargement, si la dernière activité date de
  // plus de 24 h, le modal « Dernière chance » prend la main (une seule
  // fois par session de navigation — sessionStorage).
  const myStats = useQuery(api.gamification.getUserStats);
  const [lastChanceOpen, setLastChanceOpen] = useState(false);
  useEffect(() => {
    const seenKey = "ln.lastChance.seen";
    let seen = false;
    try {
      seen = sessionStorage.getItem(seenKey) === "1";
    } catch {
      seen = false;
    }
    if (seen || !myStats) return;
    if (myStats.lastActiveAt > 0 && Date.now() - myStats.lastActiveAt > 24 * 3_600_000) {
      try {
        sessionStorage.setItem(seenKey, "1");
      } catch {
        /* sans sessionStorage : ré-affichage possible, sans crash */
      }
      setLastChanceOpen(true);
    }
  }, [myStats]);

  // Premier passage : aucune langue de focus → l'onboarding prend la main.
  // Il propose toujours de passer outre (« Explorer d'abord ») : sans cela, la
  // porte remplace TOUTE l'app et aucune URL — pas même /app/conversation —
  // n'atteint son écran. Le choix est mémorisé en sessionStorage : sans cela
  // un simple rechargement (F5) rejetait l'utilisateur sur l'onboarding.
  const needsOnboarding = !!myLanguages && myLanguages.rows.length === 0;
  const [skipOnboarding, setSkipOnboarding] = useState(() => {
    try {
      return sessionStorage.getItem(SKIP_ONBOARDING_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const setSkip = useCallback((next: boolean) => {
    setSkipOnboarding(next);
    try {
      if (next) sessionStorage.setItem(SKIP_ONBOARDING_KEY, "1");
      else sessionStorage.removeItem(SKIP_ONBOARDING_KEY);
    } catch {
      /* sans sessionStorage : l'échappatoire ne tient pas jusqu'au rechargement */
    }
  }, []);

  const activeFocus = myLanguages?.activeFocus ?? [];
  const focusLabel = activeFocus.length
    ? activeFocus
        .map((code) => LANGUAGES.find((l) => l.code === code)?.name ?? code)
        .join(" · ")
    : t("nav.noFocus");

  if (needsOnboarding && !skipOnboarding) {
    return (
      <div className="relative min-h-screen bg-noir text-ink">
        <NoirAmbience />
        <NetworkBackdrop />
        <Onboarding />
        <button
          type="button"
          onClick={() => setSkip(true)}
          className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit rounded-full border border-white/15 bg-noir/80 px-5 py-2 text-xs text-ink-2 backdrop-blur transition-colors hover:border-gold/50 hover:text-gold focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none"
        >
          {t("onboarding.exploreFirst")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-noir text-ink">
      <NoirAmbience />

      {/* ── Barre latérale (desktop) ──────────────────────────────── */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-white/5 bg-noir-2/50 backdrop-blur-sm lg:flex">
        <div className="flex h-16 items-center border-b border-white/5 px-5">
          <Brand />
        </div>
        <nav
          aria-label={t("nav.mainNav")}
          className="flex-1 overflow-y-auto px-3 py-5"
        >
          <NavList isAdmin={isAdmin} />
        </nav>
        <p className="border-t border-white/5 px-5 py-4 text-[0.6875rem] leading-relaxed text-ink-3">
          Don't study the culture. Live it.
        </p>
      </aside>

      {/* ── Colonne de contenu ────────────────────────────────────── */}
      <div className="relative flex min-h-screen flex-col lg:ps-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/5 bg-noir/80 px-4 backdrop-blur lg:h-16 lg:px-8">
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <span className="hidden font-display text-lg font-semibold lg:block">
            <span className="text-ink-3">—</span>{" "}
            <span className="text-gold">{t(labelKey(pathname))}</span>
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setFocusOpen(true)}
            aria-label={t("nav.changeFocus")}
            className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[0.6875rem] text-ink-2 transition-colors hover:border-gold/40 hover:text-gold sm:flex"
          >
            <Flame className="size-3.5 text-gold" />
            <span className="min-w-0 max-w-40 truncate">{focusLabel}</span>
          </button>
          {/* MOD 2 — compteur gems (toutes pages) + badge Double XP.
              LOT H — count-up 600 ms à chaque gain, et `data-coin-target` :
              c'est la cible de la traînée de pièces (fx/coinTrail), qui le
              fait pulser à l'arrivée. */}
          <Link
            to="/app/store"
            data-coin-target=""
            className="hidden items-center gap-1 rounded-full border border-gold/30 px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 sm:flex"
            aria-label={t("nav.store")}
          >
            <Gem className="size-3.5" aria-hidden /> <CountUp value={myStats?.gems ?? 0} />
          </Link>
          {doubleXp?.active && (
            <span
              className="hidden animate-pulse items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[0.6875rem] font-semibold text-gold sm:flex"
              title={t("store.doubleXpTitle")}
            >
              <Zap className="size-3" />×2 ·{" "}
              {Math.max(1, Math.ceil((doubleXp.remainingMs || 0) / 60_000))} min
            </span>
          )}
          <button
            type="button"
            onClick={() => { const next = soundEngine.toggleMuted(); setSoundMuted(next); soundEngine.play("click"); }}
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
            aria-label={t(soundMuted ? "sound.unmute" : "sound.mute")}
            title={t(soundMuted ? "sound.unmute" : "sound.mute")}
          >
            {soundMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <NotificationsBell />
          <UiLangSelect />
          <LogoDropdown />
        </header>

        {/* MOD 1 — A : bannière rouge streak (20-24 h), toutes pages /app. */}
        <StreakBanner />

        {/* Rappel de l'onboarding écarté : l'app reste navigable, mais le
            choix des langues de focus conditionne les quiz et les cartes. */}
        {needsOnboarding && !nudgeDismissed && (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 lg:mx-8">
            <p className="text-xs text-ink-2">{t("onboarding.noFocusHint")}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNudgeDismissed(false);
                  setSkip(false);
                  setFocusOpen(true);
                }}
                className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
              >
                {t("onboarding.pickFocus")}
              </button>
              <button
                type="button"
                onClick={() => setNudgeDismissed(true)}
                aria-label={t("common.close")}
                className="p-1 text-ink-3 transition-colors hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        <FocusDialog open={focusOpen} onOpenChange={setFocusOpen} />
        <LastChanceModal
          open={lastChanceOpen}
          onClose={() => setLastChanceOpen(false)}
        />

        <main className="flex-1 px-4 pt-6 pb-24 lg:px-8 lg:pt-8 lg:pb-12">
          {/* Module 2 — transition de page : fondu 150 ms + translateY 8px,
              mode="wait" pour que deux contenus ne se superposent jamais.
              Reduced-motion : durée nulle (voir bloc global en CSS). */}
          {/* MODULE 3 — transition de page en 3D : la vue arrive depuis
              le fond (translateZ -200px) en pivotant de 15°, et repart vers
              l'arrière en -15°. `easeInOut` assumé : un ressort serait
              chaotique sur une page entière. Repli : simple fondu si la
              machine ne suit pas (watchdog FPS) ou en reduced-motion. */}
          <div style={{ perspective: 1500 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={
                  page3D
                    ? { opacity: 0, rotateY: 15, z: -200 }
                    : { opacity: 0, y: 8 }
                }
                animate={
                  page3D
                    ? { opacity: 1, rotateY: 0, z: 0 }
                    : { opacity: 1, y: 0 }
                }
                exit={
                  page3D
                    ? { opacity: 0, rotateY: -15, z: -200 }
                    : { opacity: 0, y: -8 }
                }
                transition={
                  page3D
                    ? { duration: 0.4, ease: "easeInOut" }
                    : { duration: 0.15, ease: [0.4, 0, 0.2, 1] }
                }
                style={{ transformStyle: "preserve-3d" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Navigation mobile ────────────────────────────────────── */}
      <nav
        aria-label={t("nav.mainNav")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-noir/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <li key={item.to} className="min-w-0">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[0.625rem] transition-colors",
                    isActive ? "text-gold" : "text-ink-3",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn("ln-nav-flip size-5", isActive && "drop-shadow-[0_0_8px_rgba(212,165,116,0.45)]")}
                    />
                    <span className="min-w-0 truncate px-1">{t(item.key)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="min-w-0">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex w-full flex-col items-center gap-1 py-2.5 text-[0.625rem] text-ink-3 transition-colors hover:text-gold"
                >
                  <MenuIcon className="size-5" />
                  <span>{t("nav.menu")}</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[85dvh] overflow-y-auto border-white/10 bg-noir-2 p-5"
              >
                <SheetTitle className="mb-4 font-display text-lg">
                  <BrandLockup size="sm" />
                </SheetTitle>
                <NavList isAdmin={isAdmin} />
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/**
 * Clé i18n du titre affiché dans l'en-tête.
 * Deux routes ne portent pas le nom de leur module : `/app/talk` est l'onglet
 * « Audio » du Media Hub, et `/app/space` réunit l'ancien « Mon espace » et
 * l'ancien « Profil ».
 */
const ROUTE_LABEL: Record<string, string> = {
  "/app": "nav.home",
  "/app/talk": "nav.audio",
  "/app/hub": "nav.hub",
  "/app/space": "nav.space",
  "/app/analytics": "nav.analytics",
  "/app/performance": "nav.space",
  "/app/profile": "nav.space",
};

function labelKey(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/app";
  const known = ROUTE_LABEL[normalized];
  if (known) return known;
  const hit = [...MAIN_NAV, ...TOOL_NAV].find((i) => i.to === normalized);
  return hit?.key ?? "nav.home";
}
