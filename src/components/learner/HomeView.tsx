import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES, levelFromXp, levelProgress } from "@/convex/languages";
import { motion } from "framer-motion";
import {
  Check,
  Clapperboard,
  Compass,
  Flame,
  Layers,
  MessagesSquare,
  Moon,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import type { LanguageCode } from "@/convex/languages";
import { SpeakButton } from "./SpeakButton";
import { useEffect, useRef, useState } from "react";
import { DailyChallengeModal, type DailyChallenge } from "./DailyChallengeModal";
import { useI18n } from "@/lib/i18n";
import { CountUp, GoldBurst } from "@/components/fx/rewards";
import { HeroBackdrop } from "@/components/three/HeroBackdrop";
import { Reveal } from "@/components/fx/Reveal";
import { GrainOverlay, MotifBackdrop } from "@/components/fx/motifs";
import { Card3D } from "@/components/fx/Card3D";
import { Scroll3D } from "@/components/fx/Scroll3D";
import { MascotStage, useMascotSafe } from "@/components/three/MascotProvider";

/* ═══════════════════════════════════════════════════════════════════════
   ACCUEIL — « LA PLACE » (bento grid)

   Une grande carte (le globe 3D), deux moyennes (le défi du jour, la
   langue en focus), trois petites (les gestes du quotidien). Le lieu
   donne le nom et la phrase d'ambiance ; le titre se révèle à l'encre
   dorée. Aucun emoji d'interface : les icônes sont Lucide.
   ═══════════════════════════════════════════════════════════════════════ */

export function HomeView({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { t, lang } = useI18n();
  const [burst, setBurst] = useState(0);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyClock, setDailyClock] = useState(Date.now());
  const dailyRequested = useRef(false);
  const getDailyChallenge = useAction(api.dailyChallenge.getOrGenerateDailyChallenge);
  const stats = useQuery(api.learning.myStats);
  const myLanguages = useQuery(api.learning.myLanguages);
  const trending = useQuery(api.slang.trending, { limit: 5 });
  const addToSrs = useMutation(api.learning.addToSrs);
  const recordSession = useMutation(api.learning.recordSession);
  const checkAchievements = useAction(api.achievements.checkAchievements);
  const achievements = useQuery(api.achievements.getMyAchievements, { lang });
  // Jabari s'invite dans le hero et surveille le streak : il saute quand la
  // série est solide, il salue sinon. Le hook DOIT vivre au-dessus de tout
  // early return — sinon le nombre de hooks diffère entre le rendu de
  // chargement et le rendu rempli, et React lève « Rendered more hooks ».
  const mascot = useMascotSafe();
  // Calculé avant le early return : le hook du mascot en dépend, et
  // `stats` peut être undefined pendant le chargement.
  const streak = Math.max(...(stats?.perLanguage ?? []).map((l) => l.streak), 0);

  useEffect(() => {
    if (!mascot) return;
    mascot.play(streak >= 7 ? "celebrate" : "wave", 2600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  useEffect(() => {
    if (!stats || dailyRequested.current) return;
    dailyRequested.current = true;
    void getDailyChallenge({}).then((challenge) => {
      setDailyChallenge(challenge as DailyChallenge);
    }).catch(() => {
      // Le défi est un bonus : une action indisponible ne bloque pas l'accueil.
    });
  }, [getDailyChallenge, stats]);

  useEffect(() => {
    if (!dailyChallenge) return;
    const id = window.setInterval(() => setDailyClock(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [dailyChallenge]);

  if (!stats || !myLanguages) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-shimmer h-24 w-full max-w-md rounded-xl" />
      </div>
    );
  }

  const focus = stats.perLanguage.filter((l) => l.active);
  const passive = stats.perLanguage.filter((l) => !l.active);
  const daily = trending?.[0];
  const dailyRemaining = Math.max(0, (dailyChallenge?.expiresAt ?? 0) - dailyClock);
  const dailyHours = Math.ceil(dailyRemaining / 3_600_000);
  const dailyUrgent = dailyRemaining > 0 && dailyRemaining < 2 * 3_600_000;
  const yoruba = achievements?.items.find((item) => item.achievementId === "yoruba-master-500");

  const startSleep = async (language: LanguageCode) => {
    await recordSession({
      language,
      kind: "sleep",
      durationSeconds: 60,
      itemsLearned: 0,
    });
  };

  /** Les trois gestes du quotidien — petites cartes du bento. */
  const QUICK = [
    { icon: Clapperboard, label: "Shadow un contenu", view: "shadow", motif: "kente" as const },
    { icon: Layers, label: "Réviser mon deck", view: "review", motif: "halftone" as const },
    { icon: Compass, label: "Atlas & recherche", view: "discover", motif: "adinkra" as const },
  ];

  return (
    <div className="space-y-6">
      {/* ── BENTO — 1 grande + 2 moyennes + 3 petites ───────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* GRANDE CARTE — le globe 3D, l'entrée dans le monde. */}
        <section className="relative isolate flex min-h-[40vh] flex-col justify-end overflow-hidden rounded-[var(--ln-radius-xl)] border border-gold/20 bg-noir-2 p-6 sm:min-h-[48vh] lg:col-span-3 lg:min-h-[60vh] lg:p-10">
          <HeroBackdrop />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-noir-2 via-noir-2/60 to-transparent"
          />
          <GrainOverlay opacity={0.03} />
          {/* JABARI — coin bas-droite du hero, sa bulle se pose à gauche. */}
          <div className="pointer-events-none absolute bottom-24 end-4 z-20 h-[180px] w-[180px] sm:bottom-28 sm:end-8">
            <MascotStage
              variant="auto"
              className="size-full"
              bubbleClassName="justify-end"
            />
          </div>
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono text-xs tracking-[0.3em] text-gold uppercase">
                <Compass className="size-3.5" aria-hidden />
                {t("places.home.kicker")}
              </p>
              <h1 className="ln-ink-title mt-1 font-display text-4xl font-semibold tracking-tight">
                {t("places.home.ambiance")}
              </h1>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3.5 py-1.5 text-sm text-gold">
              <Flame className="size-4" aria-hidden />
              <CountUp value={streak} />
              <span className="text-ink-2">jours de streak</span>
            </span>
          </div>
        </section>

        {/* MOYENNE 1 — le défi du jour. */}
        <Reveal className="h-full lg:col-span-2">
          <Card3D className="h-full">
          <section className="ln-card ln-tech-border ln-rivets relative isolate h-full rounded-[inherit] bg-gradient-to-br from-gold/[0.08] via-noir-2 to-noir-2 p-5">
            <MotifBackdrop variant="halftone" opacity={0.04} />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span data-card3d-depth="40" className="flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                  <Target className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-[0.625rem] tracking-[0.22em] text-gold uppercase">
                    Défi du jour
                  </p>
                  <h2 className="mt-1 font-display text-xl font-semibold">
                    30 secondes pour garder le cap.
                  </h2>
                  <p className="mt-1 text-sm text-ink-2">
                    Une expression, une réponse, une récompense immédiate.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {dailyChallenge && !dailyChallenge.completedAt && dailyUrgent && (
                  <span className="font-mono text-xs font-semibold text-terracotta-ink">
                    Expire dans {dailyHours}h
                  </span>
                )}
                {dailyChallenge?.completedAt ? (
                  <span className="flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold">
                    <Check className="size-4" aria-hidden />
                    Complété
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDailyOpen(true)}
                    disabled={!dailyChallenge}
                    className="rounded-lg bg-gradient-to-r from-gold-strong to-gold px-4 py-2.5 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50"
                  >
                    {dailyChallenge ? "Jouer" : "Préparation…"}
                  </button>
                )}
              </div>
            </div>
          </section>
          </Card3D>
        </Reveal>

        {/* MOYENNE 2 — la langue en focus, ramassée. */}
        <Reveal delay={0.04} className="h-full">
          <Card3D className="h-full">
          <section className="ln-card ln-tech-border ln-rivets relative isolate h-full rounded-[inherit] p-5">
            <MotifBackdrop variant="kente" opacity={0.05} />
            <div className="relative z-10">
              <p data-card3d-depth="25" className="font-mono text-[0.625rem] tracking-[0.22em] text-ink-3 uppercase">
                Ta langue
              </p>
              {focus.length === 0 ? (
                <p className="mt-3 text-sm text-ink-2">
                  Aucune langue en focus — ouvre « Focus » pour en choisir.
                </p>
              ) : (
                focus.slice(0, 2).map((l) => {
                  const meta = LANGUAGES.find((x) => x.code === l.language);
                  if (!meta) return null;
                  return (
                    <div key={l.language} className="mt-3">
                      <div className="flex items-center gap-2.5">
                        <span data-card3d-depth="30" className="text-2xl">{meta.flag}</span>
                        <p data-card3d-depth="20" className="font-display text-lg font-semibold">{meta.name}</p>
                        <span className="ms-auto rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[0.625rem] text-gold">
                          {levelFromXp(l.xp)} · {levelProgress(l.xp)}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${levelProgress(l.xp)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                        />
                      </div>
                      <p className="mt-2 font-mono text-[0.625rem] text-ink-3">
                        {l.cards} cartes · {l.due} à revoir
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>
          </Card3D>
        </Reveal>

        {/* TROIS PETITES — les gestes du quotidien. */}
        {QUICK.map((a, i) => (
          <Reveal key={a.view} delay={0.06 + i * 0.04} className="h-full">
            <Card3D className="h-full" max={6}>
            <button
              type="button"
              onClick={() => onNavigate(a.view)}
              className="ln-card ln-tech-border ln-rivets relative isolate flex h-full w-full items-center gap-3 rounded-[inherit] p-4 text-left"
            >
              <MotifBackdrop variant={a.motif} opacity={0.05} />
              <span data-card3d-depth="30" className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/10 text-gold">
                <a.icon className="size-5" aria-hidden />
              </span>
              <span data-card3d-depth="20" className="relative z-10 text-sm font-medium">{a.label}</span>
            </button>
            </Card3D>
          </Reveal>
        ))}
      </div>

      <DailyChallengeModal
        challenge={dailyChallenge}
        open={dailyOpen}
        onClose={() => setDailyOpen(false)}
        onCompleted={() => setDailyChallenge((current) => current ? { ...current, completedAt: Date.now() } : current)}
      />

      {yoruba && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3 text-xs">
          <span className="flex items-center gap-2 text-ink-2">
            <MessagesSquare className="size-4 text-gold" aria-hidden />
            Plus que <strong className="text-gold">{Math.max(0, 500 - (yoruba.progress ?? 0))} expressions</strong> pour Maître du Yoruba
          </span>
          <span className="font-mono text-[0.625rem] text-ink-3">{yoruba.progress ?? 0}/500</span>
        </section>
      )}

      {/* Focus cards — le détail par langue. */}
      <Scroll3D>
      <Reveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2">
          {focus.map((l) => {
            const meta = LANGUAGES.find((x) => x.code === l.language)!;
            const level = levelFromXp(l.xp);
            return (
              <motion.div
                key={l.language}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="ln-card relative overflow-hidden p-6"
              >
                <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gold/10 blur-3xl" />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{meta.flag}</span>
                    <div>
                      <p className="font-display text-2xl font-semibold">{meta.name}</p>
                      <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                        {meta.cities.join(" · ")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-gold/15 px-3 py-1 font-mono text-xs text-gold">
                    {level} · {levelProgress(l.xp)}%
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    [l.cards, "Cartes"],
                    [l.due, "À revoir"],
                    [l.minutes, "Minutes"],
                  ].map(([value, label]) => (
                    <div key={String(label)} className="rounded-lg border border-white/5 bg-noir/50 py-2.5">
                      <p className="font-display text-xl text-gold">{value}</p>
                      <p className="font-mono text-[0.5625rem] tracking-wider text-ink-3 uppercase">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex gap-2.5">
                  <button
                    onClick={() => onNavigate("review")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold to-gold-soft py-2.5 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
                  >
                    <Layers className="size-4" aria-hidden />
                    Réviser {l.due > 0 ? `(${l.due})` : ""}
                  </button>
                  <button
                    onClick={() => onNavigate("discover")}
                    className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    Découvrir
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Reveal>
      </Scroll3D>

      {/* Maintenance passive. */}
      {passive.length > 0 && (
        <div>
          <p className="flex items-center gap-2 font-mono text-xs tracking-widest text-ink-3 uppercase">
            <Moon className="size-3.5" aria-hidden /> Maintenance passive
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {passive.map((l) => {
              const meta = LANGUAGES.find((x) => x.code === l.language)!;
              return (
                <div
                  key={l.language}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-noir-2/70 p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{meta.flag}</span>
                    <div>
                      <p className="text-sm font-medium">{meta.name}</p>
                      <p className="font-mono text-[0.625rem] text-ink-3">
                        {levelFromXp(l.xp)} · {l.cards} cartes
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => startSleep(l.language)}
                    title="Lancer un mini SleepShadow"
                    className="rounded-lg border border-white/10 p-2 text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    <Moon className="size-4" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expression du jour. */}
      {daily && (
        <div className="ln-tech-border ln-rivets relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-gold/[0.08] via-noir-2 to-noir-2 p-6">
          <MotifBackdrop variant="adinkra" opacity={0.04} />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 font-mono text-xs tracking-widest text-gold uppercase">
                <Sparkles className="size-3.5" aria-hidden /> Expression du jour
              </p>
              <div className="mt-3 flex items-center gap-3">
                <p className="font-display text-3xl italic">{daily.expression}</p>
                <SpeakButton text={daily.expression} language={daily.language} />
              </div>
              <p className="mt-1 text-sm text-ink-2">
                <span className="text-ink-3">litt. :</span> {daily.literal} — {daily.meaning}
              </p>
            </div>
            <GoldBurst trigger={burst}>
              <button
                onClick={async () => {
                  setBurst((n) => n + 1);
                  await addToSrs({ slangId: daily._id });
                  await recordSession({
                    language: daily.language,
                    kind: "discovery",
                    durationSeconds: 30,
                    itemsLearned: 1,
                  });
                  void checkAchievements({}).catch(() => undefined);
                }}
                className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
              >
                + Apprendre
              </button>
            </GoldBurst>
          </div>
        </div>
      )}

      {/* Raccourci upload — la porte d'entrée garantie de La Scène. */}
      <div className="grid gap-3 sm:grid-cols-1">
        <button
          onClick={() => onNavigate("shadow")}
          className="flex items-center gap-3 rounded-xl border border-dashed border-gold/30 bg-noir-2/50 p-4 text-left transition-colors hover:border-gold/50"
        >
          <span className="flex size-10 items-center justify-center rounded-lg border border-gold/20 bg-gold/10 text-gold">
            <Upload className="size-5" aria-hidden />
          </span>
          <span className="text-sm text-ink-2">
            Apporte un fichier, un lien ou un texte — on s'occupe du reste.
          </span>
        </button>
      </div>
    </div>
  );
}
