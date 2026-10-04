import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { registerKey } from "@/convex/languages";
import { useI18n } from "@/lib/i18n";
import type { CSSProperties } from "react";

/* Icône + accents par registre — mêmes codes couleur que le reste de l'app
   (badges de Découverte / Mon deck). */
const REGISTER_ICON: Record<string, string> = {
  street: "🗣️",
  casual: "💬",
  vulgar: "😈",
  internet: "🌐",
  verlan: "🥖",
  regional: "🇫🇷",
  regionalism: "🇫🇷",
};

const REGISTER_ACCENT: Record<string, { dot: string; badge: string }> = {
  street: {
    dot: "bg-orange-400",
    badge: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  },
  casual: {
    dot: "bg-sky-400",
    badge: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  },
  vulgar: {
    dot: "bg-red-400",
    badge: "border-red-400/40 bg-red-400/10 text-red-300",
  },
  internet: {
    dot: "bg-violet-400",
    badge: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  },
};

/** Barre or terre #D4A574 — 0 % si le registre est vide. */
function GoldBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-noir"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: "var(--gold-primary)" }}
      />
    </div>
  );
}

export function MasteryTree() {
  const { t } = useI18n();
  const data = useQuery(api.stats.getMasteryData);

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const hasData = data.total > 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-gold uppercase">
            {t("mastery.overall")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            {t("mastery.title")}
          </h2>
          <p className="mt-1 text-sm text-ink-2">{t("mastery.subtitle")}</p>
        </div>
        <div className="min-w-[9rem] flex-1 sm:max-w-xs">
          <div className="flex items-center justify-between font-mono text-[0.625rem] text-ink-3">
            <span>
              {t("mastery.progress", { m: data.mastered, t: data.total })}
            </span>
            <span className="text-gold">
              {Math.round(data.progress * 100)} %
            </span>
          </div>
          <div className="mt-2">
            <GoldBar value={data.progress} />
          </div>
          <p className="mt-2 font-mono text-[0.625rem] text-ink-3">
            {data.total} {t("mastery.total")}
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="ln-card p-6 text-center text-sm text-ink-2">
          {t("mastery.empty")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.registers.map((r, i) => {
            const accent = REGISTER_ACCENT[r.register];
            const pct = Math.round(r.progress * 100);
            const rk = registerKey(r.register);
            const name = rk ? t(`registers.${rk}`) : r.register;
            return (
              <div
                key={r.register}
                className="ln-card ln-stagger-item p-5"
                style={{ ["--ln-i"]: i } as CSSProperties}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.625rem] tracking-widest uppercase ${
                      accent?.badge ?? "border-white/10 bg-white/5 text-ink-2"
                    }`}
                  >
                    <span aria-hidden="true">
                      {REGISTER_ICON[r.register] ?? "🏷️"}
                    </span>
                    <span
                      className={`size-1.5 rounded-full ${accent?.dot ?? "bg-ink-3"}`}
                    />
                    {name}
                  </span>
                  <span className="font-mono text-[0.625rem] text-ink-3">
                    {pct} %
                  </span>
                </div>

                <p className="mt-4 font-display text-3xl font-semibold">
                  {r.mastered}
                  <span className="text-lg text-ink-3"> / {r.total}</span>
                </p>
                <p className="mt-1 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                  {t("mastery.mastered")}
                </p>

                <div className="mt-4">
                  <GoldBar value={r.progress} />
                </div>
                <p className="mt-2 text-xs text-ink-2">
                  {t("mastery.card", { r: name, m: r.mastered, t: r.total })}
                </p>
                <p className="mt-1 font-mono text-[0.625rem] text-ink-3">
                  {r.learning} {t("mastery.learning")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
