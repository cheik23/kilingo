import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion, useReducedMotion } from "framer-motion";

import { useChartPalette } from "@/components/analytics/chartTheme";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/convex/languages";
import { useOptionalQuery } from "@/lib/optionalQuery";
import { api } from "@/convex/_generated/api";
/* ═══════════════════════════════════════════════════════════════════
   RÉPARTITION DE LA BASE D'ARGOT PAR LANGUE

   Une seule unité — l'expression — donc un donut a un sens. Toute
   autre répartition (langues au total, concepts, fichiers) mélange
   des unités et ne raconterait rien ; données figées non plus : la
   mesure vient de `slangAggregates` (écrit par slang:recomputeAggregates),
   la même source que le compteur du hero.

   Ce composant est chargé à la demande : recharts ne doit pas entrer
   dans le bundle qui définit le LCP de la landing.
   ═══════════════════════════════════════════════════════════════════ */

/** Nombre de tranches nommées ; au-delà, tout part dans « Autre » :
    5 accents uniques existent dans le thème graphique (or, violet, bleu,
    vert, orange) sans réutiliser deux fois la même couleur. */
const TOP_SLICES = 5;

/** Ladder d'accents par tranche nommée : or de marque d'abord, puis les
    accents du thème graphique. Le gris des axes sert à « Autre ». */
const ACCENT_KEYS = ["gold", "violet", "blue", "green", "orange"] as const;

export default function SlangShareDonut() {
  const { lang } = useI18n();
  const palette = useChartPalette();
  const reducedMotion = useReducedMotion();
  const state = useOptionalQuery(api.slang.stats, {});
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat(lang).format(n);

  const data = useMemo(() => {
    const byLanguage = state.data?.byLanguage;
    if (!byLanguage) return undefined;
    // Clé typée `string` : la présence dans `LANGUAGES` est lue JUSTE
    // APRES, pas prouvée au compilateur.
    const meta = new Map<string, { name: string; flag: string }>(
      LANGUAGES.map((l) => [l.code as string, { name: l.name, flag: l.flag }]),
    );
    const ranked = Object.entries(byLanguage)
      // `fr` n'est pas une langue apprenable (vocabulaire de traduction) :
      // il ne représente rien pour le visiteur, on l'écarte de la division.
      .filter(([code]) => meta.has(code))
      .map(([code, value]) => ({ code, value, name: meta.get(code)!.name, flag: meta.get(code)!.flag }))
      .sort((a, b) => b.value - a.value);
    const named = ranked.slice(0, TOP_SLICES);
    const rest = ranked.slice(TOP_SLICES);
    const restTotal = rest.reduce((sum, r) => sum + r.value, 0);
    const total = ranked.reduce((sum, r) => sum + r.value, 0);
    // Ladder d'accents : or de marque sur la tranche 1, accents du thème
    // ensuite ; chaque tranche nommée a sa couleur unique (cf. TOP_SLICES).
    const accent = (i: number) => palette[ACCENT_KEYS[i] ?? "gold"];
    return {
      total,
      slices: [
        ...named.map((s, i) => ({
          ...s,
          display: `${s.flag} ${s.name}`,
          fill: accent(i),
        })),
        // Pas un résidu : la couverture EST l'information. « Autres »
        // devient « Autres · N langues » avec le compte réel.
        {
          code: "other",
          display: `Autres · ${ranked.length - TOP_SLICES} langues`,
          value: restTotal,
          fill: palette.axis,
        },
      ],
    };
  }, [state.data, palette]);

  const active = activeIndex !== null ? data?.slices[activeIndex] : undefined;

  return (
    <div className="ln-card flex flex-col items-center gap-8 p-6 md:flex-row md:p-8">
      {/* Donut — activement null tant que la mesure n'est pas arrivée :
          un camembert à zéro mentirait (« 0 expression »). */}
      <div className="relative aspect-square w-full max-w-[280px] shrink-0">
        {data ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.slices}
                  cx="50%"
                  cy="50%"
                  innerRadius="72%"
                  outerRadius="98%"
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="display"
                  isAnimationActive={!reducedMotion}
                  animationDuration={900}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  // Tranche active : légèrement sortie du cercle, le seul
                  // mouvement est porté par le composant (zéro reflow).
                  activeIndex={activeIndex ?? undefined}
                >
                  {data.slices.map((s) => (
                    <Cell key={s.code} fill={s.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active: tipActive, payload }) => {
                    const entry = payload?.[0]?.payload;
                    if (!tipActive || !entry) return null;
                    return (
                      <div className="rounded-lg border border-white/10 bg-noir/90 px-3 py-2 text-xs shadow-xl">
                        <span style={{ color: entry.fill }}>{entry.display}</span>
                        <span className="ml-2 font-mono text-ink-2">
                          {fmt(entry.value)}
                        </span>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre du donut : la valeur sous le curseur, sinon le total. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <motion.span
                key={active?.code ?? "total"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.18 }}
                className="font-display text-2xl font-bold"
                style={{ color: active?.fill ?? palette.gold }}
              >
                {fmt(active?.value ?? data.total)}
              </motion.span>
              <span className="mt-1 max-w-[7rem] text-[0.625rem] uppercase tracking-widest text-ink-3">
                {active ? active.display : "expressions"}
              </span>
            </div>
          </>
        ) : (
          <div className="size-full animate-pulse rounded-full border border-gold/20" aria-hidden="true" />
        )}
      </div>

      {/* Légende — la même donnée que le donut, lue ailleurs que le curseur.
          Lignes focusables : la lecture clavier au moins = pas de donnée
          inaccessible au curseur. */}
      <ul className="w-full flex-1 space-y-2">
        <li className="pb-2">
          <h3 className="font-display text-lg font-semibold">
            Répartition de la base d'argot
          </h3>
          <p className="mt-1 text-xs text-ink-3">
            Expressions servies par langue — mesure réelle, pas une promesse.
          </p>
        </li>
        {data?.slices.map((s, i) => (
          <li key={s.code}>
            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                activeIndex === i
                  ? "border-gold/40 bg-white/[0.06]"
                  : "border-white/5 bg-white/[0.02] hover:border-white/20"
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
            >
              <span className="flex items-center gap-2.5 text-sm text-ink-2">
                <span
                  aria-hidden="true"
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: s.fill }}
                />
                {s.display}
              </span>
              <span className="font-mono text-xs" style={{ color: s.fill }}>
                {fmt(s.value)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
