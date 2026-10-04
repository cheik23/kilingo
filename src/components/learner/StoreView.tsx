import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Eye, Gem, Gift, Snowflake, Store, Zap } from "lucide-react";
import { Link } from "react-router";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/fx/rewards";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import { LootBoxModal } from "./LootBoxModal";
import { Card3D } from "@/components/fx/Card3D";

/* ═══════════════════════════════════════════════════════════════════
   BOUTIQUE (MOD 2 — C) — /app/store, thème or/noir exclusivement.

   4 items : Streak Freeze (réutilise gamification:buyFreeze "gems"),
   Double XP 1 h (activateDoubleXp), Révéler 1 réponse (buyRevealToken),
   Loot boxes (centre loot : boxes non ouvertes + ouverture via modal).
   Chaque carte : preview + prix + bouton désactivé si solde insuffisant
   (tooltip « Il te manque X gems »). Aucun rouge sur cette page.
   ═══════════════════════════════════════════════════════════════════ */

const FREEZE_PRICE = 500;
const DOUBLE_XP_PRICE = 300;
const REVEAL_PRICE = 50;

export function StoreView() {
  const { t } = useI18n();
  const stats = useQuery(api.gamification.getUserStats);
  const loot = useQuery(api.gamification.getMyLootBoxes, { opened: false });

  const buyFreeze = useMutation(api.gamification.buyFreeze);
  const activateDoubleXp = useMutation(api.gamification.activateDoubleXp);
  const buyRevealToken = useMutation(api.gamification.buyRevealToken);

  const [busy, setBusy] = useState<string | null>(null);
  const [openLootId, setOpenLootId] = useState<Id<"userLootBoxes"> | null>(null);

  const gems = stats?.gems ?? 0;
  const unopened = loot ?? [];

  const items = useMemo(
    () => [
      {
        key: "freeze",
        icon: Snowflake,
        price: FREEZE_PRICE,
        title: t("store.freezeTitle"),
        desc: t("store.freezeDesc"),
      },
      {
        key: "doubleXp",
        icon: Zap,
        price: DOUBLE_XP_PRICE,
        title: t("store.doubleXpTitle"),
        desc: t("store.doubleXpDesc"),
      },
      {
        key: "reveal",
        icon: Eye,
        price: REVEAL_PRICE,
        title: t("store.revealTitle"),
        desc: t("store.revealDesc"),
      },
    ],
    [t],
  );

  const buy = (key: string) => {
    setBusy(key);
    const call =
      key === "freeze"
        ? buyFreeze({ method: "gems" })
        : key === "doubleXp"
          ? activateDoubleXp({})
          : buyRevealToken({});
    call
      .then((r: { ok: boolean; reason?: string }) => {
        if (!r.ok) {
          toast.error(t("store.insufficient"));
          return;
        }
        toast.success(t(`store.bought_${key}`));
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setBusy(null));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header boutique ────────────────────────────────────────── */}
      <PlaceHeader
        place="store"
        title={t("store.title")}
        icon={Store}
        motif="kente"
        description={t("store.subtitle")}
        actions={
          <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-center">
            <p className="flex items-center justify-center gap-1.5 font-display text-xl font-bold text-gold">
              <Gem className="size-4" aria-hidden />
              <CountUp value={gems} />
            </p>
            <p className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
              {t("store.balance")}
            </p>
          </div>
        }
      />

      {/* ── Grille d'items ─────────────────────────────────────────── */}
      <section className="ln-grid-cards">
        {items.map((item) => {
          const affordable = gems >= item.price;
          const missing = item.price - gems;
          const Icon = item.icon;
          return (
            <Card3D key={item.key} className="ln-card flex flex-col p-5">
              <span
                data-card3d-depth="50"
                className="flex size-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
              >
                <Icon className="size-5 text-gold" />
              </span>
              <h2 data-card3d-depth="20" className="mt-3 font-display text-lg text-ink">
                {item.title}
              </h2>
              <p className="mt-1 flex-1 text-sm text-ink-2">{item.desc}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span
                  data-card3d-depth="25"
                  className="font-display text-lg font-semibold text-gold"
                >
                  💎 {item.price}
                </span>
                <span title={affordable ? undefined : t("store.missing", { x: missing })}>
                  <button
                    type="button"
                    disabled={!affordable || busy === item.key}
                    onClick={() => buy(item.key)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                      affordable
                        ? "ln-btn-3d bg-gradient-to-r from-gold-strong to-gold text-noir"
                        : "cursor-not-allowed border border-white/10 text-ink-3 opacity-50",
                    )}
                  >
                    {busy === item.key ? t("store.working") : t("store.buy")}
                  </button>
                </span>
              </div>
            </Card3D>
          );
        })}

        {/* ── Centre loot ─────────────────────────────────────────── */}
        <div className="ln-card flex flex-col p-5">
          <span className="flex size-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <Gift className="size-5 text-gold" />
          </span>
          <h2 className="mt-3 font-display text-lg text-ink">{t("store.lootTitle")}</h2>
          <p className="mt-1 flex-1 text-sm text-ink-2">{t("store.lootDesc")}</p>
          {unopened.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {unopened.slice(0, 3).map((b) => (
                <li key={b._id}>
                  <button
                    type="button"
                    onClick={() => setOpenLootId(b._id)}
                    className="flex w-full items-center justify-between rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-ink transition-colors hover:bg-gold/10"
                  >
                    <span>🎁 {t(`loot.tier_${b.tier}`)}</span>
                    <span className="text-gold">{t("loot.open")}</span>
                  </button>
                </li>
              ))}
              {unopened.length > 3 && (
                <li className="font-mono text-[0.625rem] text-ink-3">
                  +{unopened.length - 3}…
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-ink-3">{t("store.lootEmpty")}</p>
          )}
        </div>
      </section>

      {/* ── Économie : quiz parfait, conversations réussies ───────── */}
      <section className="ln-card p-5">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-3">
          {t("store.howTo")}
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
          <li>🏆 {t("store.howQuiz")}</li>
          <li>💬 {t("store.howConv")}</li>
          <li>🔥 {t("store.howStreak")}</li>
        </ul>
        <div className="mt-4 flex gap-3">
          <Link
            to="/app/quiz"
            className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
          >
            {t("store.goQuiz")}
          </Link>
          <Link
            to="/app/conversation"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
          >
            {t("store.goConv")}
          </Link>
        </div>
      </section>

      <LootBoxModal lootId={openLootId} onClose={() => setOpenLootId(null)} />
    </div>
  );
}
