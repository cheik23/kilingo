import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Box, Check, Crown, LockKeyhole, Palette, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { shouldUse3D } from "@/lib/perf";
import { soundEngine } from "@/lib/soundEngine";
import { RpmAvatarStudio } from "./RpmAvatarStudio";

/* Le lecteur GLB reste un chunk séparé : three.js n'entre dans le bundle
   que si l'utilisateur possède réellement un avatar 3D. */
const RpmAvatar = lazy(() => import("@/components/three/RpmAvatar"));

export type CustomizationItem = {
  itemId: string;
  type: "avatar" | "hat" | "glasses" | "background";
  name: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  priceGems: number;
  achievementId?: string;
  previewUrl: string;
};

const TABS = [
  { type: "avatar", label: "customization.tabs.avatar", icon: UserRound },
  { type: "hat", label: "customization.tabs.hat", icon: Crown },
  { type: "glasses", label: "customization.tabs.glasses", icon: Sparkles },
  { type: "background", label: "customization.tabs.background", icon: Palette },
] as const;

const RARITY_STYLES = {
  common: "border-orange-300/30 text-orange-200",
  rare: "border-slate-300/40 text-slate-200",
  epic: "border-gold/45 text-gold",
  legendary: "border-cyan-300/45 text-cyan-200",
} as const;

/** ≥ 1024 px : le picker devient une section intégrée à « Mon espace ». */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

/** Les deux façon de se chew un look. Une seule source de vérité pour les
 *  deux : `getMyCustomization`. Si un avatar 3D existe ET qu'on sait le
 *  rendre, il gagne — sinon l'emoji habillé. */
export function SelectedAvatar({ size = "lg", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const { lang } = useI18n();
  const data = useQuery(api.customization.getMyCustomization, { lang });
  const avatar = data?.catalog.find((item) => item.itemId === data.selectedAvatar);
  const hat = data?.catalog.find((item) => item.itemId === data.selectedHat);
  const glasses = data?.catalog.find((item) => item.itemId === data.selectedGlasses);
  const background = data?.catalog.find((item) => item.itemId === data.selectedBackground);
  const dimension = { sm: "size-14 text-4xl", md: "size-24 text-6xl", lg: "size-32 text-8xl", xl: "size-[200px] text-[7.5rem]" }[size];

  const rpmUrl = data?.rpmAvatarUrl ?? null;
  const show3D = Boolean(rpmUrl) && shouldUse3D();

  const frame = (
    <div
      key={`${rpmUrl ?? "emoji"}-${avatar?.itemId}-${hat?.itemId}-${glasses?.itemId}-${background?.itemId}`}
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-gold/30 bg-noir shadow-[0_0_50px_rgba(212,165,116,0.12)]", dimension, className)}
      style={background ? { backgroundImage: `url("${background.previewUrl}")`, backgroundSize: "cover" } : undefined}
      aria-label={avatar?.name ?? "Avatar"}
    >
      {show3D ? (
        <Suspense fallback={<span className="relative z-10 text-5xl">{avatar?.previewUrl ?? "🦁"}</span>}>
          <RpmAvatar url={rpmUrl!} className="size-full" />
        </Suspense>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-noir/45" />
          <motion.span
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className="relative z-10 drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]"
          >
            {avatar?.previewUrl ?? "🦁"}
          </motion.span>
          {hat && <span className="absolute start-1/2 top-1 z-20 -translate-x-1/2 scale-75 text-4xl drop-shadow-lg">{hat.previewUrl}</span>}
          {glasses && <span className="absolute start-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-[42%] leading-none">{glasses.previewUrl}</span>}
        </>
      )}
    </div>
  );

  // Le saut d'échelle (emoji → 3D) est réservé aux gros formats : en
  // miniature il clignoterait à chaque re-render de la query.
  if (size === "sm" || size === "md") return frame;
  return <motion.div layout transition={{ type: "spring", stiffness: 260, damping: 24 }}>{frame}</motion.div>;
}

/* ═══════════════════════════════════════════════════════════════════
   FORGE TON AVATAR — un seul contenu, deux formats.

   Desktop (≥ 1024 px) : plus de modale. « Personnaliser » déplie une
   section dans Mon espace — preview géante sticky à gauche, onglets et
   grille à droite. Mobile : feuille plein écran (100 dvh), en-tête
   collant, contenu sur une colonne.

   La grille ne bouge jamais de largeur : 2 colonnes, 3 dès 640 px, 4 dès
   1280 px, cellules carrées `w-full min-w-0`. Aucun transform 3D sur les
   cartes — un simple changement de bordure au survol.
   ═══════════════════════════════════════════════════════════════════ */

function Studio({ layout, onClose }: { layout: "desktop" | "mobile"; onClose: () => void }) {
  const { lang, t } = useI18n();
  const data = useQuery(api.customization.getMyCustomization, { lang });
  const achievements = useQuery(api.achievements.getMyAchievements, { lang });
  const unlockItem = useMutation(api.customization.unlockItem);
  const selectItem = useMutation(api.customization.selectItem);
  const clearAvatar = useMutation(api.customization.setRpmAvatar);
  const seedCatalog = useMutation(api.customizationCatalog.seedCatalog);
  useEffect(() => {
    const key = "kilingo.customization.catalog.v1";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    void seedCatalog().catch(() => localStorage.removeItem(key));
  }, [seedCatalog]);

  // Deux grandes sections, deux façons de seigner un look. Plus de bouton
  // « avatar 3D » quelque part ailleurs : c'est ICI, ou nulle part.
  const [section, setSection] = useState<"style" | "avatar3d">("style");
  const [tab, setTab] = useState<CustomizationItem["type"]>("avatar");
  const [busy, setBusy] = useState<string | null>(null);
  const catalog = data?.catalog ?? [];
  const filtered = useMemo(() => catalog.filter((item) => item.type === tab), [catalog, tab]);
  const selected = {
    avatar: data?.selectedAvatar,
    hat: data?.selectedHat,
    glasses: data?.selectedGlasses,
    background: data?.selectedBackground,
  };
  /** Titres des succès : le cadenas explique toujours *quel* succès ouvrir. */
  const achievementTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of achievements?.items ?? []) map.set(item.achievementId, item.title);
    return map;
  }, [achievements]);
  const currentAvatar = catalog.find((item) => item.itemId === data?.selectedAvatar);

  const handleUnlock = async (item: CustomizationItem) => {
    setBusy(item.itemId);
    try {
      const result = await unlockItem({ itemId: item.itemId });
      if (!result.ok) {
        toast.error(result.reason === "achievement_required" ? t("customization.achievementRequired") : t("customization.notEnoughGems", { amount: Math.max(1, item.priceGems - (data?.gems ?? 0)) }));
        return;
      }
      await selectItem({ itemId: item.itemId });
      soundEngine.play("click");
      toast.success(t("customization.unlockedToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("customization.error"));
    } finally {
      setBusy(null);
    }
  };

  const handleSelect = async (item: CustomizationItem) => {
    setBusy(item.itemId);
    try {
      await selectItem({ itemId: item.itemId });
      soundEngine.play("click");
      toast.success(t("customization.selectedToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("customization.error"));
    } finally {
      setBusy(null);
    }
  };

  const rpmUrl = data?.rpmAvatarUrl ?? null;

  const removeAvatar = async () => {
    try {
      await clearAvatar({ url: null });
      toast.success(t("space.rpm.removed"));
    } catch {
      toast.error(t("space.rpm.error"));
    }
  };

  /** Les deux onglets majeurs : Style / Avatar 3D. */
  const renderSections = (fit: boolean) => (
    <div
      role="tablist"
      aria-label={t("customization.title")}
      className={cn("flex gap-1.5 rounded-(--radius-md) border border-gold/20 bg-noir/70 p-1", !fit && "overflow-x-auto")}
    >
      {(
        [
          { key: "style", label: "customization.section.style", icon: Sparkles },
          { key: "avatar3d", label: "customization.section.avatar3d", icon: Box },
        ] as const
      ).map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          role="tab"
          type="button"
          aria-selected={section === key}
          onClick={() => setSection(key)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            fit ? "min-w-0 flex-1" : "shrink-0 whitespace-nowrap",
            section === key
              ? "bg-gradient-to-r from-gold-strong to-gold text-noir"
              : "text-ink-3 hover:text-ink",
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span className={cn(fit && "truncate")}>{t(label)}</span>
        </button>
      ))}
    </div>
  );

  /** Onglet « Avatar 3D » : studio intégré, jamais une modale par-dessus. */
  const avatar3dPanel = (
    <div className="space-y-4">
      <RpmAvatarStudio
        onSaved={() => toast.success(t("space.rpm.saved"))}
        className="w-full"
      />
      {rpmUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-md) border border-white/10 bg-noir/70 px-4 py-3">
          <p className="ln-wrap-anywhere min-w-0 flex-1 truncate font-mono text-xs text-ink-3">
            {rpmUrl}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void removeAvatar()}
            className="shrink-0 gap-1.5 text-ink-3 hover:text-terracotta"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t("space.rpm.remove")}
          </Button>
        </div>
      )}
    </div>
  );

  /** `fit` : onglets égaux qui remplissent la largeur (desktop).
   *  Sinon : rangée qui défile plutôt que de tronquer (mobile). */
  const renderTabs = (fit: boolean) => (
    <div role="tablist" aria-label={t("customization.title")} className={cn("flex gap-1 rounded-(--radius-md) border border-white/8 bg-noir/70 p-1", !fit && "overflow-x-auto")}>
      {TABS.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          role="tab"
          type="button"
          aria-selected={tab === type}
          onClick={() => setTab(type)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors",
            fit ? "min-w-0 flex-1" : "shrink-0 whitespace-nowrap",
            tab === type ? "bg-gold/15 text-gold" : "text-ink-3 hover:text-ink",
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className={cn(fit && "truncate")}>{t(label)}</span>
        </button>
      ))}
    </div>
  );

  const grid = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {data === undefined
        ? Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-square w-full animate-shimmer rounded-(--radius-md) bg-white/5" />)
        : filtered.map((item) => {
            const unlocked = data.unlocked.includes(item.itemId);
            const active = selected[item.type] === item.itemId;
            const exclusive = !unlocked && Boolean(item.achievementId);
            const isBackground = item.type === "background";
            const achievementTitle = item.achievementId ? achievementTitles.get(item.achievementId) ?? item.achievementId : undefined;
            return (
              <button
                key={item.itemId}
                type="button"
                disabled={busy === item.itemId}
                onClick={() => (active ? undefined : unlocked ? void handleSelect(item) : void handleUnlock(item))}
                title={active ? t("customization.currentLook") : exclusive ? `${t("customization.completeAchievement")} · ${achievementTitle}` : item.description}
                aria-label={item.name}
                className={cn(
                  "group relative flex aspect-square w-full min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-(--radius-md) border p-2 text-center transition-[border-color,transform,box-shadow] duration-200",
                  "hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none disabled:cursor-wait",
                  active
                    ? "ln-bounce-once border-gold shadow-[0_0_30px_rgba(212,165,116,0.2)]"
                    : "border-white/10 hover:border-gold/60",
                  isBackground && "justify-end bg-cover bg-center",
                )}
                style={isBackground ? { backgroundImage: `url("${item.previewUrl}")` } : undefined}
              >
                {isBackground && <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-noir via-noir/30 to-transparent" />}

                {/* Badge : prix, cadenas du succès, ou état « actuel ». */}
                <span
                  className={cn(
                    "absolute end-2 top-2 z-10 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 font-mono text-[0.5rem] tracking-wider uppercase backdrop-blur-sm",
                    active
                      ? "border-gold bg-gold text-noir"
                      : exclusive
                        ? "border-cyan-300/40 bg-noir/80 text-cyan-200"
                        : unlocked
                          ? "border-white/10 bg-noir/80 text-ink-3"
                          : "border-gold/40 bg-noir/80 text-gold",
                  )}
                >
                  {active ? (
                    <>
                      <Check className="size-3 shrink-0" />
                      <span className="truncate">{t("customization.current")}</span>
                    </>
                  ) : exclusive ? (
                    <LockKeyhole className="size-3 shrink-0" />
                  ) : unlocked ? (
                    <span className={cn("truncate", RARITY_STYLES[item.rarity])}>{t(`customization.rarity.${item.rarity}`)}</span>
                  ) : (
                    <span className="truncate">{item.priceGems} 💎</span>
                  )}
                </span>

                {!isBackground && (
                  <span aria-hidden className="flex-none text-5xl leading-none drop-shadow-lg">
                    {item.previewUrl}
                  </span>
                )}
                <span className="relative z-10 w-full truncate text-center text-sm font-medium">{item.name}</span>

                {busy === item.itemId && (
                  <span className="absolute inset-0 z-20 flex items-center justify-center bg-noir/70">
                    <Sparkles className="size-6 animate-pulse text-gold" />
                  </span>
                )}
              </button>
            );
          })}
    </div>
  );

  if (layout === "mobile") {
    return (
      <Sheet open onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="bottom" className="h-[100dvh] max-h-[100dvh] w-full gap-0 overflow-hidden border-gold/25 bg-noir-2 p-0 text-ink [&>button]:hidden">
          <div className="flex h-full min-h-0 flex-col">
            <header className="shrink-0 border-b border-gold/15 bg-noir-2/95 px-4 pt-4 pb-3 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[0.5625rem] tracking-[0.25em] text-gold uppercase">{t("customization.eyebrow")}</p>
                  <SheetTitle className="mt-1 truncate font-display text-xl font-semibold">{t("customization.title")}</SheetTitle>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-xs font-semibold text-gold">{data?.gems ?? 0} 💎</span>
                  <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}><X /></Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {renderSections(false)}
                {section === "style" && renderTabs(false)}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {/* Look actuel, en bandeau : la grille ne le montre pas seule. */}
              <div className="mb-4 flex items-center gap-3 rounded-(--radius-lg) border border-gold/20 bg-noir/70 p-3">
                <SelectedAvatar size="md" />
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold">{currentAvatar?.name ?? t("customization.currentLook")}</p>
                  <p className="text-xs text-ink-3">{t("customization.currentLook")}</p>
                </div>
              </div>
              {section === "style" ? grid : avatar3dPanel}
              <Button onClick={onClose} className="mt-5 w-full bg-gradient-to-r from-gold-strong to-gold text-noir">{t("customization.done")}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <motion.section
      id="avatar-studio"
      aria-label={t("customization.title")}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-(--radius-xl) border border-gold/20 bg-noir-2/70 p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[0.5625rem] tracking-[0.25em] text-gold uppercase">{t("customization.eyebrow")}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">{t("customization.title")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("customization.subtitle", { gems: data?.gems ?? 0 })}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full border border-white/10 text-ink-2 hover:border-gold/40 hover:text-gold">
          {t("customization.done")}
        </Button>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        {/* Colonne gauche : le look actuel, en grand, toujours visible au scroll. */}
        <aside className="rounded-(--radius-xl) border border-gold/20 bg-noir/70 p-5 text-center lg:sticky lg:top-24">
          <SelectedAvatar size="xl" className="mx-auto" />
          <p className="mt-4 font-display text-lg font-bold">{currentAvatar?.name ?? t("customization.currentLook")}</p>
          <p className="mt-1 text-xs text-ink-3">{t("customization.currentLook")}</p>
          <div className="mt-4 rounded-(--radius-md) border border-gold/25 bg-gold/8 px-4 py-3">
            <p className="font-display text-2xl font-bold text-gold">{data?.gems ?? 0} 💎</p>
            <p className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">{t("space.gems")}</p>
          </div>
          <Button onClick={onClose} className="mt-4 w-full bg-gradient-to-r from-gold-strong to-gold text-noir">
            {t("customization.done")}
          </Button>
        </aside>

        {/* Colonne droite : onglets fixes, seule la grille défile. */}
        <div className="min-w-0">
          {renderSections(true)}
          {section === "style" ? (
            <>
              <div className="mt-4">{renderTabs(true)}</div>
              <div className="mt-4 max-h-[min(64vh,760px)] overflow-x-hidden overflow-y-auto overscroll-contain px-1">{grid}</div>
            </>
          ) : (
            <div className="mt-4">{avatar3dPanel}</div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

export function AvatarPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isDesktop = useIsDesktop();
  if (!open) return null;
  return isDesktop
    ? <Studio layout="desktop" onClose={() => onOpenChange(false)} />
    : <Studio layout="mobile" onClose={() => onOpenChange(false)} />;
}
