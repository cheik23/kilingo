import { lazy, Suspense, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Captions,
  Clapperboard,
  Compass,
  Flame,
  Gauge,
  Headphones,
  Languages,
  Mic,
  Music2,
  Repeat,
  Search,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Waves,
} from "lucide-react";

import { NoirAmbience } from "@/components/fx/NoirAmbience";
import { BrandLink } from "@/components/brand/Logo";
import { MagneticButton, TiltCard } from "@/components/fx/interact";
import { RevealTitle, ScrambleHeading, ShimmerTitle } from "@/components/fx/text";
import { useAuth } from "@/hooks/use-auth";
import { REGISTERS } from "@/convex/languages";

/* Le globe 3D pèse plus d'un mégaoctet de three.js. Il ne doit PAS entrer
   dans le bundle qui définit le LCP de la landing : on le charge à la
   demande, une fois le hero visible. */
const GlobeHero = lazy(() =>
  import("@/components/three/GlobeHero").then((m) => ({ default: m.GlobeHero })),
);

/* ═══════════════════════════════════════════════════════════════════
   KILINGO — page publique.

   « Don't study the culture. Live it. »

   Le produit n'est pas un manuel : c'est une plateforme d'immersion
   culturelle qui transforme films, musiques, livres et podcasts en
   contenu pédagogique (vocabulaire, argot, contexte culturel,
   révisions).

   Contenus : uniquement ce que la plateforme a le droit d'afficher,
   d'intégrer ou d'analyser — plus les contenus importés par
   l'utilisateur lui-même. Aucun contournement de DRM, aucun
   téléchargement d'œuvre protégée.
   ═══════════════════════════════════════════════════════════════════ */

const LANGUAGES = [
  { flag: "🇬🇧", name: "Anglais", detail: "US · UK" },
  { flag: "🇨🇳", name: "Mandarin", detail: "简体 · 繁體" },
  { flag: "🇪🇸", name: "Espagnol", detail: "España · LatAm" },
  { flag: "🇸🇦", name: "Arabe", detail: "MSA · dialectes" },
  { flag: "🇷🇺", name: "Russe", detail: "RU" },
];

/** Modules d'immersion — un par type de contenu, plus les moteurs transverses. */
const MODULES = [
  {
    icon: Clapperboard,
    name: "ScreenShadow",
    tag: "Films & vidéos",
    text: "Sous-titres interactifs : clique un mot dans le dialogue et obtiens traduction, registre, prononciation et contexte — sans quitter le film.",
    tags: ["Cinema Mode", "sous-titres .srt / .vtt"],
  },
  {
    icon: Music2,
    name: "MusicShadow",
    tag: "Musiques",
    text: "Décortique un morceau phrase par phrase : aperçus légaux, analyse linguistique, argot détecté, tout versé dans ta mémoire.",
    tags: ["Lyrics Decoder", "aperçus 30 s"],
  },
  {
    icon: BookOpen,
    name: "BookShadow",
    tag: "Livres",
    text: "Lecteur avec dictionnaire inline : sélectionne un passage, traduis-le, garde-le. Auteurs, genres, niveaux de difficulté.",
    tags: ["Dictionnaire inline", "TTS"],
  },
  {
    icon: Mic,
    name: "TalkShadow",
    tag: "Podcasts & audio",
    text: "Transcription horodatée, traduction, vocabulaire et argot extraits automatiquement. Écoute à vitesse réduite, phrase par phrase.",
    tags: ["Transcription", "Timecodes"],
  },
  {
    icon: Repeat,
    name: "Shadowing",
    tag: "Pratique orale",
    text: "Écoute, répète, enregistre-toi, compare, corrige. Sur n'importe quel contenu, pas seulement dans des exercices.",
    tags: ["Prononciation", "Comparaison"],
  },
  {
    icon: Compass,
    name: "Swipe Discovery",
    tag: "Découverte",
    text: "Un geste : à droite ce que tu veux apprendre, à gauche plus tard. Chaque carte devient une révision programmée.",
    tags: ["Argot", "Expressions"],
  },
];

/** Trois entrées réelles de la base d'argot embarquée. */
const SLANG_SAMPLES = [
  {
    expr: "finna",
    literal: "contraction de « fixing to »",
    meaning: "sur le point de",
    context: "« I'm finna leave » — AAVE essentiel, compris partout.",
    register: "street",
    region: "US (AAVE)",
  },
  {
    expr: "bruh",
    literal: "frère (élongation de bro)",
    meaning: "bro ; exaspération",
    context: "« Bruh. » — le soupir lexé ; réaction universelle au n'importe quoi.",
    register: "internet",
    region: "US",
  },
  {
    expr: "spin the block",
    literal: "reprendre le pâté de maisons",
    meaning: "revenir, retenter (souvent un ex)",
    context: "« He back? Spin the block » — la seconde chance sentimentale.",
    register: "street",
    region: "US",
  },
];

/** Language DNA — le profil n'est pas un score unique. */
const DNA = [
  { label: "Compréhension orale", value: 78 },
  { label: "Vocabulaire", value: 64 },
  { label: "Argot & expressions", value: 86 },
  { label: "Prononciation", value: 41 },
  { label: "Compréhension culturelle", value: 72 },
];

function SectionTitle({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
        <ScrambleHeading text={title} />
      </h2>
      {lead && (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{lead}</p>
      )}
    </header>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Tous les CTA mènent au produit : /app pour les inscrits, l'auth sinon —
  // avec le chemin demandé conservé dans returnTo.
  const start = useMemo(
    () => (isAuthenticated ? "/app" : "/auth?returnTo=%2Fapp"),
    [isAuthenticated],
  );
  const go = () => navigate(start);
  const { t, lang } = useI18n();
  // Compteur temps réel : preuve sociale vérifiable, pas une statistique
  // figée dans le texte. Les deux requêtes sont des lectures minuscules
  // (deux agrégats), elles ne bloquent donc pas le rendu.
  const stats = useQuery(api.landingStats.getLandingStats, {});
  const numbers = useQuery(api.landingStats.getLandingNumbers, {});
  const learners = stats?.verifiedLearners ?? 0;
  // Le nombre d'expressions vient de la base (donc du seed réellement
  // exécuté) et se formate dans la locale de l'interface ; la constante du
  // dictionnaire ne sert plus que de repli avant l'arrivée de la requête.
  const fmt = (n: number) => new Intl.NumberFormat(lang).format(n);
  const expressionCount =
    numbers === undefined
      ? t("landing.features.expressionsValue")
      : fmt(numbers.expressions);

  return (
    <div className="relative min-h-screen overflow-hidden bg-noir text-ink">
      <NoirAmbience />

      {/* ── Barre de navigation ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-noir/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <BrandLink to="/" />

          <nav className="hidden flex-1 items-center justify-center gap-7 text-sm text-ink-2 lg:flex">
            <a href="#methode" className="transition-colors hover:text-gold">
              La méthode
            </a>
            <a href="#modules" className="transition-colors hover:text-gold">
              Modules
            </a>
            <a href="#argot" className="transition-colors hover:text-gold">
              Argot
            </a>
            <a href="#langues" className="transition-colors hover:text-gold">
              Langues
            </a>
          </nav>

          <div className="flex-1 lg:hidden" />
          <Link
            to={isAuthenticated ? "/app" : "/auth"}
            className="hidden rounded-full border border-white/10 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold sm:block"
          >
            {isAuthenticated ? "Mon espace" : "Se connecter"}
          </Link>
          <MagneticButton
            onClick={go}
            className="rounded-full bg-gradient-to-r from-gold to-gold-soft px-5 py-2 text-sm font-semibold text-noir"
          >
            {isAuthenticated ? "Ouvrir" : "Commencer"}
          </MagneticButton>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── Héro ────────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-3.5 py-1.5 font-mono text-[0.625rem] tracking-[0.2em] text-gold uppercase">
              <Waves className="size-3" />
              {t("landing.badge")}
            </p>

            <h1 className="mt-6 font-display text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
              <RevealTitle text={t("landing.title")} />
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-2">
              {t("landing.subtitle")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={start}
                className="ln-glow inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-6 py-3.5 font-semibold text-noir transition-transform hover:-translate-y-0.5"
              >
                {t("landing.cta")}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#modules"
                className="rounded-xl border border-white/10 px-6 py-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
              >
                {t("landing.ctaSecondary")}
              </a>
            </div>

            <p className="mt-5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {t("landing.reassurance")}
            </p>
          </div>

          {/* Context Card — la promesse du produit, rendue visible. */}
          <TiltCard className="ln-card rounded-2xl p-5">
            <p className="flex items-center justify-between font-mono text-[0.625rem] tracking-[0.2em] text-ink-3 uppercase">
              Context Card
              <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-gold">
                street · US (AAVE)
              </span>
            </p>

            <p className="mt-4 font-display text-3xl font-semibold text-gold">
              finna
            </p>
            <p className="mt-1 text-sm text-ink-3">
              sur le point de · littéralement « contraction de fixing to »
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <div>
                <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                  Contexte
                </p>
                <p className="mt-1 text-ink-2">
                  « I'm finna leave » — AAVE essentiel, compris partout.
                </p>
              </div>
              <div>
                <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                  Registre
                </p>
                <p className="mt-1 text-ink-2">
                  familier → street · jamais en entretien d'embauche
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {["COMPRENDRE", "POURQUOI ?", "JE VEUX APPRENDRE ÇA"].map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[0.625rem] tracking-wide text-ink-2"
                >
                  {c}
                </span>
              ))}
            </div>
          </TiltCard>
        </section>

        {/* ── Globe + chiffres clés ───────────────────────────────
            Le globe est chargé à la demande : three.js ne doit pas
            entrer dans le bundle qui définit le LCP de la landing. */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative order-2 lg:order-1">
              <div className="relative mx-auto aspect-square w-full max-w-sm">
                <Suspense
                  fallback={
                    <div className="size-full animate-pulse rounded-full border border-gold/20" />
                  }
                >
                  <GlobeHero />
                </Suspense>
              </div>
              <p className="mt-2 text-center text-xs text-ink-3">
                {t("landing.globeCaption")}
              </p>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                {t("landing.features.title")}
              </h2>
              <p className="mt-3 max-w-lg text-ink-2">{t("landing.features.lead")}</p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    value: String(numbers?.languages ?? 11),
                    label: t("landing.features.languagesLabel"),
                  },
                  {
                    value: expressionCount,
                    label: t("landing.features.expressionsLabel"),
                  },
                  {
                    value: t("landing.features.avatarValue"),
                    label: t("landing.features.avatarLabel"),
                  },
                ].map((f) => (
                  <div key={f.label} className="ln-card p-5">
                    <p className="font-display text-3xl font-bold text-gold">
                      {f.value}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-ink-3">
                      {f.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Social proof — donnée live, pas une statistique figée. */}
              <p className="mt-8 flex items-center gap-2 text-sm text-ink-2">
                <Sparkles className="size-4 text-gold" />
                {t("landing.learners", { n: learners })}
              </p>

              <Link
                to={start}
                className="ln-glow mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-6 py-3.5 font-semibold text-noir transition-transform hover:-translate-y-0.5"
              >
                {t("landing.cta")}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Le problème / la méthode ────────────────────────────── */}
        <section
          id="methode"
          className="border-y border-white/5 bg-noir-2/40 py-20"
        >
          <div className="mx-auto max-w-6xl px-5">
            <SectionTitle
              eyebrow="La méthode"
              title="Arrête d'apprendre une langue qui n'existe pas"
              lead="Les applications classiques t'apprennent à commander un café. KILINGO t'apprend à comprendre une punchline, une interview, un refrain — la langue telle qu'elle se parle."
            />

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Clapperboard,
                  title: "CONTENU × LANGUE × CULTURE",
                  text: "Un même extrait produit du vocabulaire, de l'argot, de la grammaire, de la prononciation et du contexte culturel — pas une leçon isolée.",
                },
                {
                  icon: Brain,
                  title: "Neurosciences, pas de points",
                  text: "Répétition espacée, rappel actif, explication des erreurs. On te dit pourquoi tu confonds, pas seulement que tu t'es trompé.",
                },
                {
                  icon: Gauge,
                  title: "Language DNA",
                  text: "Ton profil n'est pas un niveau A1/B2 : écoute, lecture, prononciation, argot, compréhension rapide — chacun avec ses forces et ses manques.",
                },
              ].map((c) => (
                <TiltCard key={c.title} className="ln-card p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                    <c.icon className="size-5 text-gold" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {c.text}
                  </p>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── Modules ─────────────────────────────────────────────── */}
        <section id="modules" className="mx-auto max-w-6xl px-5 py-20">
          <SectionTitle
            eyebrow="Modules"
            title="Un univers, pas un cours"
            lead="Chaque module peut évoluer indépendamment. Tous alimentent la même mémoire et le même profil linguistique."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <TiltCard
                key={m.name}
                className="ln-card ln-stagger-item p-6"
              >
                <div
                  className="flex items-start justify-between"
                  style={{ ["--ln-i" as string]: i }}
                >
                  <span className="flex size-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                    <m.icon className="size-5 text-gold" />
                  </span>
                  <span className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                    {m.tag}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">
                  {m.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  {m.text}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-[0.625rem] text-ink-3"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ── Argot ───────────────────────────────────────────────── */}
        <section
          id="argot"
          className="border-y border-white/5 bg-noir-2/40 py-20"
        >
          <div className="mx-auto max-w-6xl px-5">
            <SectionTitle
              eyebrow="Slang Engine"
              title="On ne traduit pas l'argot, on l'explique"
              lead="Signification naturelle, traduction littérale, contexte, registre, variantes, exemples — et l'avertissement qui va avec. La base embarquée compte 974 expressions, du verlan au drill."
            />

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {SLANG_SAMPLES.map((s, i) => (
                <div
                  key={s.expr}
                  className="ln-card ln-stagger-item p-5"
                  style={{ ["--ln-i" as string]: i }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-xl font-semibold text-gold">
                      {s.expr}
                    </p>
                    <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[0.625rem] text-ink-3">
                      {s.region}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink">{s.meaning}</p>
                  <p className="mt-1 text-xs text-ink-3 italic">{s.literal}</p>
                  <p className="mt-3 text-xs leading-relaxed text-ink-2">
                    {s.context}
                  </p>
                  <p className="mt-3 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
                    {REGISTERS[s.register] ?? s.register}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Language DNA + Daily Drop ───────────────────────────── */}
        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-20 lg:grid-cols-2">
          <TiltCard className="ln-card p-6">
            <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
              Language DNA
            </p>
            <h3 className="mt-3 font-display text-2xl font-semibold">
              Ton profil, en détail
            </h3>
            <p className="mt-2 text-sm text-ink-2">
              Exemple de profil : chaque axe évolue séparément, pour savoir quoi
              travailler — et pas seulement « où tu en es ».
            </p>
            <ul className="mt-6 space-y-3.5">
              {DNA.map((d) => (
                <li key={d.label}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-ink-2">{d.label}</span>
                    <span className="font-mono text-ink-3">{d.value} %</span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5"
                    role="progressbar"
                    aria-label={d.label}
                    aria-valuenow={d.value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold-soft"
                      style={{ width: `${d.value}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[0.6875rem] text-ink-3">
              Données d'illustration — ton profil réel se construit à partir de
              ce que tu écoutes, lis et révises.
            </p>
          </TiltCard>

          <div className="space-y-4">
            <TiltCard className="ln-card p-6">
              <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
                Daily Drop
              </p>
              <h3 className="mt-3 font-display text-2xl font-semibold">
                Ta mission du jour
              </h3>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  { icon: Headphones, t: "10 minutes d'écoute active" },
                  { icon: Sparkles, t: "5 nouvelles expressions" },
                  { icon: Brain, t: "10 révisions en rappel actif" },
                  { icon: Mic, t: "5 minutes de shadowing" },
                  { icon: Subtitles, t: "1 exercice de compréhension" },
                ].map((r) => (
                  <li
                    key={r.t}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5"
                  >
                    <r.icon className="size-4 shrink-0 text-gold" />
                    <span className="text-ink-2">{r.t}</span>
                  </li>
                ))}
              </ul>
            </TiltCard>

            <TiltCard className="ln-card p-6">
              <p className="flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
                <ShieldCheck className="size-3.5" />
                Contenus & droits
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                Ton propre contenu importé reste privé. Tout ce que tu vois
                dans l'app se lit directement ici — films, musiques, livres,
                podcasts et vidéos.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                Les contenus proviennent de sources ouvertes et sont analysés
                pour toi : transcription, traduction, argot.
              </p>
            </TiltCard>
          </div>
        </section>

        {/* ── Langues ─────────────────────────────────────────────── */}
        <section
          id="langues"
          className="border-y border-white/5 bg-noir-2/40 py-20"
        >
          <div className="mx-auto max-w-6xl px-5">
            <SectionTitle
              eyebrow="Langues"
              title="Cinq langues, une même exigence"
              lead="Interface disponible en français, anglais, espagnol, mandarin, arabe (RTL) et russe. D'autres langues s'ajoutent sans toucher au reste."
            />
            <div className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {LANGUAGES.map((l, i) => (
                <div
                  key={l.name}
                  className="ln-card ln-stagger-item p-5 text-center"
                  style={{ ["--ln-i" as string]: i }}
                >
                  <span className="text-3xl">{l.flag}</span>
                  <p className="mt-3 font-display text-lg font-semibold">
                    {l.name}
                  </p>
                  <p className="mt-1 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                    {l.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-14 max-w-3xl">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Search, label: "Recherche universelle" },
                  { icon: Captions, label: "Transcription & traduction" },
                  { icon: Languages, label: "Interface multilingue" },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                  >
                    <f.icon className="size-4 shrink-0 text-gold" />
                    <span className="text-sm text-ink-2">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA final ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <Flame className="mx-auto size-8 text-gold" />
          <h2 className="mt-5 font-display text-3xl font-semibold sm:text-4xl">
            <ShimmerTitle>Commence ton immersion.</ShimmerTitle>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink-2">
            Choisis jusqu'à deux langues de focus, et laisse tes films, ta
            musique et tes podcasts faire le reste. Aucun paiement, aucune
            dépendance à un service payant pour le cœur du produit.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={start}
              className="ln-glow inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-7 py-3.5 font-semibold text-noir transition-transform hover:-translate-y-0.5"
            >
              {isAuthenticated ? "Ouvrir mon espace" : "Créer mon profil"}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to={isAuthenticated ? "/app" : "/auth"}
              className="rounded-xl border border-white/10 px-7 py-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
            >
              {isAuthenticated ? "Continuer" : "J'ai déjà un compte"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-center sm:flex-row sm:text-left">
          <BrandLink to="/" size="sm" />
          <p className="max-w-xl text-[0.6875rem] leading-relaxed text-ink-3">
            Watch it. Hear it. Get it. — Uniquement des contenus qui se
            lisent directement dans l'app.
          </p>
        </div>
      </footer>
    </div>
  );
}
