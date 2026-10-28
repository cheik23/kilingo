import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  BookOpen,
  Film,
  Map,
  Mic,
  Music,
  Podcast,
  Repeat,
  Sparkles,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { LANGUAGES } from "@/convex/languages";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { getLandingCopy, type LandingSections } from "@/lib/i18n.landing";
import { displayContext } from "@/lib/pedagogicalContext";
import { formatEur, PREMIUM, premiumPerDayEur, premiumAnnualDiscountPct } from "@/lib/pricing";
import { useOptionalQuery } from "@/lib/optionalQuery";
import { MiniWorldHero } from "@/components/three/diorama/MiniWorldHero";
import { WORLDS, WORLD_CODES, worldHasContent, type WorldCode } from "@/components/three/diorama/worlds";
import { SpeakButton } from "@/components/learner/SpeakButton";
import { PremiumCta } from "@/components/learner/PremiumCta";
import { SubscriptionCard } from "@/components/learner/SubscriptionCard";

/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — LANDING PUBLIQUE (refonte : atlas linguistique vivant)

   Concept visuel : un monde tridimensionnel FIXE derrière le contenu —
   un champ de caractères des langues réellement servies, des coques
   concentriques (les « espaces » de la langue), des rubans phonétiques —
   que le scroll TRAVERSE via une caméra pilotée par une ref partagée
   (zéro re-render React par frame). Chaque scène du récit se joue
   AU-DESSUS du monde, en HTML sémantique lisible.

   Honnêteté (scripts verify-*, non négociables) :
   · chiffres = MESURES Convex (landingStats / slang.trending) ;
   · aucun total d'expressions figé dans le source ;
   · montants = formatEur(PREMIUM.*) / premiumPerDayEur() /
     premiumAnnualDiscountPct() — jamais écrits en dur ;
   · le bouton Premium et la carte d'abonnement sont montés UNE fois ;
   · ancres funnel dans cet ordre : methode → modules → argot →
     langues → pricing ; l'invite finale d'inscription vient APRÈS
     le prix (jeton exact requis par le guard, posé dans le JSX).
   · la copy reprend « 8 personnages » (table aiCharacters) ;
   · showcase & quiz = requêtes PUBLIQUES réelles ; vivier vide ⇒
     section absente, jamais une phrase inventée.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── i18n : sections complètes (fr/en), repli fr pour les autres ───── */

function snapSections(lang: string): LandingSections {
  const fromLang = getLandingCopy(lang) as
    | { landing?: { sections?: LandingSections } }
    | undefined;
  if (fromLang?.landing?.sections) return fromLang.landing.sections;
  const fr = getLandingCopy("fr") as
    | { landing?: { sections?: LandingSections } }
    | undefined;
  return fr?.landing?.sections as LandingSections;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
} as const;

const viewportOnce = { once: true, amount: 0.2 } as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.625rem] uppercase tracking-[0.3em] text-gold">
      {children}
    </p>
  );
}

function SceneHeader({
  chapter,
  title,
  lead,
}: {
  chapter: string;
  title: string;
  lead?: string;
}) {
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce} className="max-w-2xl">
      <Eyebrow>{chapter}</Eyebrow>
      <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-3 text-ink-2">{lead}</p> : null}
    </motion.div>
  );
}

/* ── Navigation ───────────────────────────────────────────────────── */

function LandingNav({ authed, s }: { authed: boolean; s: LandingSections }) {
  const [open, setOpen] = useState(false);
  const links = [
    { to: "#methode", label: s.nav.method },
    { to: "#modules", label: s.nav.modules },
    { to: "#argot", label: s.nav.showcase },
    { to: "#langues", label: s.nav.languages },
    { to: "#quiz", label: s.nav.quiz },
    { to: "#pricing", label: s.nav.pricing },
    { to: "#faq", label: s.nav.faq },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-noir/70 backdrop-blur-md">
      <nav aria-label="Navigation principale" className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="font-display text-lg font-bold tracking-wide text-ink">
          Kɪ́LINGO
        </Link>

        <ul className="hidden items-center gap-6 text-sm text-ink-2 lg:flex">
          {links.map((l) => (
            <li key={l.to}>
              <a href={l.to} className="transition-colors hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden lg:block">
          <Link
            to={authed ? "/app" : "/auth"}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-strong px-5 py-2.5 text-sm font-semibold text-noir shadow-lg shadow-gold/20"
          >
            {authed ? s.nav.open : s.nav.start}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="landing-nav-mobile"
          className="text-lg text-ink-2 lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {open && (
        <ul id="landing-nav-mobile" className="border-t border-white/5 px-5 pb-4 pt-2 lg:hidden">
          {links.map((l) => (
            <li key={l.to}>
              <a href={l.to} className="block py-2.5 text-sm text-ink-2" onClick={() => setOpen(false)}>
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <Link to={authed ? "/app" : "/auth"} className="block py-2.5 text-sm font-semibold text-gold">
              {authed ? s.nav.open : s.nav.start}
            </Link>
          </li>
        </ul>
      )}
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SCÈNE 1 — ENTRER DANS LE MONDE
   Titre + CTA en HTML lisible ; le mini-monde 3D vit derrière le texte.
   ═══════════════════════════════════════════════════════════════════════ */

function Hero({
  world,
  setWorld,
  selectedMonument,
  setSelectedMonument,
}: {
  world: WorldCode;
  setWorld: (w: WorldCode) => void;
  selectedMonument: string | null;
  setSelectedMonument: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const cfg = WORLDS[world];
  const available = worldHasContent(world);
  const explored = cfg.monuments.find((m) => m.kind === selectedMonument) ?? null;

  return (
    <section
      aria-label="Introduction"
      className="mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-center gap-8 px-5 pb-24 pt-36 text-center"
    >
      <Eyebrow>{t("landing.badge")}</Eyebrow>

      <h1 className="max-w-4xl font-display text-4xl font-semibold leading-tight text-ink sm:text-6xl lg:text-7xl">
        {t("landing.title")}
      </h1>

      <p className="max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
        {t("landing.subtitle")}
      </p>

      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Link
          to={authedFallback()}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold to-gold-strong px-8 py-4 font-semibold text-noir shadow-lg shadow-gold/25 transition-transform hover:scale-[1.03] active:scale-95"
        >
          {t("landing.cta")}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
        <a
          href="#argot"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-4 text-ink-2 transition-colors hover:border-gold/40 hover:text-ink"
        >
          {t("landing.ctaSecondary")}
        </a>
      </div>

      <LearnerLine />

      {/* ── Mini-mondes : trois prototypes, une intégration réelle ─────
          Chaque monde mène à sa langue (Auth → focus de langues) ou le
          badge Bientôt si le contenu n'existe pas encore. Le libellé
         /routes sont DÉRIVÉS des données du monde, jamais inventés. */}
      <div className="ln-card w-full max-w-xl rounded-3xl p-5 text-left" role="group" aria-label="Mini-mondes prototype">
        <div className="flex flex-wrap items-center gap-2">
          {WORLD_CODES.map((code) => {
            const w = WORLDS[code];
            const activeWorld = code === world;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={activeWorld}
                onClick={() => {
                  setWorld(code);
                  setSelectedMonument(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  activeWorld
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-white/15 text-ink-2 hover:border-gold/30 hover:text-ink"
                }`}
              >
                <span aria-hidden="true">{w.flag}</span>
                {w.native}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">{cfg.regionLabel}.</span>
          {explored ? ` Monument sélectionné : ${explored.label}.` : ""}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {cfg.monuments.map((m) => (
            <button
              key={m.kind}
              type="button"
              aria-pressed={selectedMonument === m.kind}
              onClick={() => setSelectedMonument(selectedMonument === m.kind ? null : m.kind)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedMonument === m.kind
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-white/10 text-ink-3 hover:border-gold/30 hover:text-ink-2"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {available ? (
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">Contenu disponible</span>
          ) : (
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-3">Bientôt</span>
          )}
          <Link
            to={isAuthenticated ? "/app" : "/auth"}
            className="rounded-xl bg-gradient-to-r from-gold to-gold-strong px-4 py-2 text-xs font-semibold text-noir shadow-md shadow-gold/20 transition-transform hover:scale-[1.03] active:scale-95"
          >
            {isAuthenticated ? "Ouvrir l'application" : "Commencer"}
          </Link>
        </div>

        <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-3">
          Prototypes animés : fr · zh · sw. Les autres langues de la liste plus bas reçoivent leur monde dans les
          prochaines itérations.
        </p>
      </div>

      <p className="text-xs text-ink-3">{t("landing.reassurance")}</p>
    </section>
  );
}

/* Éviter le prop-drilling : le seul link du hero mène au parcours réel. */
function authedFallback() {
  return "/#langues";
}

/* Compteur d'apprenants : requête publique, chiffre réel, rien en repli. */
function LearnerLine() {
  const { t } = useI18n();
  const state = useOptionalQuery(api.landingStats.getLandingStats, {});
  if (state.data === undefined || state.unavailable) return null;
  if (state.data.verifiedLearners <= 0) return null;
  return <p className="text-sm text-ink-3">{t("landing.learners", { n: state.data.verifiedLearners })}</p>;
}

/* ═══════════════════════════════════════════════════════════════════════
   SCÈNE 2 — LA MÉTHODE (trois temps) + les modules média
   `id="methode"` et `id="modules"`.
   ═══════════════════════════════════════════════════════════════════════ */

function MethodSection({ s }: { s: LandingSections }) {
  const { t } = useI18n();

  return (
    <section id="methode" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
      <SceneHeader chapter={s.chapters.method} title={s.method.title} lead={s.method.eyebrow} />

      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {s.method.steps.map((step, i) => (
          <motion.li
            key={step.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            transition={{ delay: i * 0.08 }}
            className="ln-card h-full rounded-2xl p-7"
          >
            <span className="font-mono text-xs text-gold/70">0{i + 1}</span>
            <h3 className="mt-3 font-display text-xl font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.text}</p>
          </motion.li>
        ))}
      </ol>

      <p className="mt-8 text-xs text-ink-3">{s.method.note}</p>

      {/* Modules média : routes réelles de l'app (nécessitent un compte
          via le flux normal — c'est la continuité attendue). */}
      <div id="modules" className="mt-20 scroll-mt-24">
        <SceneHeader chapter={s.chapters.media} title={s.media.title} lead={s.media.body} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <Link to="/app/screen" className="ln-card flex h-full flex-col gap-3 rounded-2xl p-6 transition-colors hover:border-gold/30">
              {icon(Film)}
              <span className="font-display text-lg font-semibold text-ink">{t("mediaHub.tabs.screen")}</span>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <Mic className="size-3.5" aria-hidden="true" />
                {s.media.available}
              </span>
            </Link>
          </li>
          <li>
            <Link to="/app/music" className="ln-card flex h-full flex-col gap-3 rounded-2xl p-6 transition-colors hover:border-gold/30">
              {icon(Music)}
              <span className="font-display text-lg font-semibold text-ink">{t("mediaHub.tabs.music")}</span>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <Mic className="size-3.5" aria-hidden="true" />
                {s.media.available}
              </span>
            </Link>
          </li>
          <li>
            <Link to="/app/books" className="ln-card flex h-full flex-col gap-3 rounded-2xl p-6 transition-colors hover:border-gold/30">
              {icon(BookOpen)}
              <span className="font-display text-lg font-semibold text-ink">{t("mediaHub.tabs.books")}</span>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <Mic className="size-3.5" aria-hidden="true" />
                {s.media.available}
              </span>
            </Link>
          </li>
          <li>
            <Link to="/app/talk" className="ln-card flex h-full flex-col gap-3 rounded-2xl p-6 transition-colors hover:border-gold/30">
              {icon(Podcast)}
              <span className="font-display text-lg font-semibold text-ink">{t("mediaHub.tabs.talk")}</span>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <Mic className="size-3.5" aria-hidden="true" />
                {s.media.available}
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

function icon(Icon: typeof Film) {
  return <Icon className="size-6 text-gold" strokeWidth={1.6} aria-hidden="true" />;
}

/* ═══════════════════════════════════════════════════════════════════════
   SCÈNE 3 — LES MOTS DANS LA VRAIE VIE (vitrine d'expressions réelles)
   `id="argot"`. Données : api.slang.trending (top popularité globale,
   multi-langues). Rien d'inventé : vivier vide ⇒ section absente.
   ═══════════════════════════════════════════════════════════════════════ */

function ShowcaseSection({ s }: { s: LandingSections }) {
  const state = useOptionalQuery(api.slang.trending, { limit: 9 });
  const cards = state.data ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const active = cards[activeIdx];
  /* BOUCLIER — couche de présentation uniquement : la donnée API (active)
     reste brute pour la phonétique/le SpeakButton, seul le texte affiché
     passe par displayContext(). Gabarit MIXED → exemple seul, PURE
     /DIRECTIVE/AMBIGUOUS → bloc masqué (jamais de fallback brut). */
  const showcaseCtx = active ? displayContext(active.context) : null;

  if (state.unavailable || (state.data !== undefined && cards.length === 0)) return null;

  return (
    <section id="argot" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
      <SceneHeader chapter={s.chapters.showcase} title={s.showcase.title} lead={s.showcase.lead} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <ul className="flex flex-col gap-2">
          {cards.map((c, i) => {
            const meta = LANGUAGES.find((l) => l.code === c.language);
            return (
              <li key={c._id}>
                <button
                  type="button"
                  aria-pressed={i === activeIdx}
                  onFocus={() => setActiveIdx(i)}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => setActiveIdx(i)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    i === activeIdx ? "border-gold/40 bg-gold/[0.07]" : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true">{meta?.flag ?? "🌍"}</span>
                    <span className="font-display text-lg font-semibold text-ink">« {c.expression} »</span>
                  </span>
                  <span className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-3">{meta?.name}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {active ? (
          <motion.figure
            key={active._id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="ln-card rounded-2xl p-7"
          >
            <div className="flex items-center justify-between">
              <figcaption className="font-mono text-[0.625rem] uppercase tracking-[0.25em] text-gold">
                {s.showcase.listenLabel}
              </figcaption>
              <SpeakButton text={active.expression} language={active.language} />
            </div>
            <blockquote className="mt-3">
              <p className="font-display text-3xl font-semibold text-ink">« {active.expression} »</p>
            </blockquote>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="text-[0.7rem] uppercase tracking-widest text-ink-3">{s.showcase.meaningLabel}</dt>
                <dd className="mt-1 text-ink">{active.meaning}</dd>
              </div>
              {showcaseCtx && (
                <div>
                  <dt className="text-[0.7rem] uppercase tracking-widest text-ink-3">{s.showcase.contextLabel}</dt>
                  <dd className="mt-1 italic text-ink-2">{showcaseCtx}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 text-[0.7rem] text-ink-3">
              <span className="rounded-full border border-white/10 px-2.5 py-0.5">
                {s.showcase.regionLabel}: {active.region}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-0.5">
                {s.showcase.registerLabel}: {active.register}
              </span>
            </div>
          </motion.figure>
        ) : (
          <div className="ln-card h-72 animate-pulse rounded-2xl p-7" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SCÈNE 4 — LES LANGUES QUI MÉRITENT D'ÊTRE DÉCOUVERTES
   `id="langues"`. Chaque langue listée est dans languages.ts.
   Les stats restent SECONDAIRES, en dessous de la richesse essayée.
   ═══════════════════════════════════════════════════════════════════════ */

function LanguagesSection({ s }: { s: LandingSections }) {
  const { t } = useI18n();
  const numbers = useOptionalQuery(api.landingStats.getLandingNumbers, {});
  const [hovered, setHovered] = useState<string | null>(null);
  const fmt = useMemo(() => new Intl.NumberFormat("fr-FR"), []);

  const clusters = [
    {
      title: LANGUAGES.find((l) => l.code === t("clusters.intl", { defaultValue: "en" }))?.name ?? "Langues internationales",
      codes: ["en", "es", "zh", "ar", "ru", "pt", "de", "it", "pl", "el", "fr"],
    },
    {
      title: "Voix moins représentées",
      codes: ["wo", "sw", "ln", "ha", "yo", "zu", "ig", "am", "tr", "tl", "id", "th", "vi", "fa", "ur", "hi", "bn", "ko", "ja"],
    },
  ];

  return (
    <section id="langues" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
      <SceneHeader chapter={s.chapters.features} title={t("landing.features.title")} lead={t("landing.features.lead")} />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {clusters.map((cluster) => (
          <motion.div
            key={cluster.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className={`ln-card rounded-2xl p-7 transition-colors ${hovered === cluster.title ? "border-gold/30 bg-white/[0.04]" : ""}`}
            onMouseEnter={() => setHovered(cluster.title)}
            onMouseLeave={() => setHovered(null)}
          >
            <Map className="size-6 text-gold" strokeWidth={1.6} aria-hidden="true" />
            <h3 className="mt-3 font-display text-xl font-semibold text-ink">{cluster.title}</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {cluster.codes
                .map((code) => LANGUAGES.find((l) => l.code === code))
                .filter((l): l is (typeof LANGUAGES)[number] => Boolean(l))
                .map((meta) => (
                  <li key={meta.code} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-ink-2">
                    <span aria-hidden="true">{meta.flag}</span>
                    {meta.name}
                  </li>
                ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {numbers.data ? (
        <dl className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="proof-stats">
          <div className="ln-card rounded-2xl p-5 text-center">
            <dt className="font-display text-2xl font-bold text-gold">{t("landing.features.languagesValue")}</dt>
            <dd className="mt-1.5 text-[0.68rem] uppercase tracking-widest text-ink-3">{t("landing.features.languagesLabel")}</dd>
          </div>
          <div className="ln-card rounded-2xl p-5 text-center">
            <dt className="font-display text-2xl font-bold text-gold">{fmt.format(numbers.data.expressions)}</dt>
            <dd className="mt-1.5 text-[0.68rem] uppercase tracking-widest text-ink-3">{t("landing.features.expressionsLabel")}</dd>
          </div>
          <div className="ln-card rounded-2xl p-5 text-center">
            <dt className="font-display text-2xl font-bold text-gold">{numbers.data.avatars}</dt>
            <dd className="mt-1.5 text-[0.68rem] uppercase tracking-widest text-ink-3">{t("landing.features.avatarLabel")}</dd>
          </div>
          <div className="ln-card rounded-2xl p-5 text-center">
            <dt className="font-display text-2xl font-bold text-gold">{t("landing.features.cultureValue")}</dt>
            <dd className="mt-1.5 text-[0.68rem] uppercase tracking-widest text-ink-3">{t("landing.features.cultureLabel")}</dd>
          </div>
        </dl>
      ) : (
        <div className="mt-14 h-24 animate-pulse rounded-2xl bg-white/[0.03]" aria-hidden="true" />
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SCÈNE 5 — PARTICIPER (mini-quiz sans compte, réel)
   Données : api.dailySlang.getDailySlang (publique). Correction :
   mutation completeDailySlang — tenue côté serveur ; sans compte la
   correction locale suffit, la PERSISTANCE attend l'inscription.
   ═══════════════════════════════════════════════════════════════════════ */

function QuizSection({ s }: { s: LandingSections }) {
  const { isAuthenticated } = useAuth();
  const state = useOptionalQuery(api.dailySlang.getDailySlang, {});
  const complete = useMutation(api.dailySlang.completeDailySlang);
  const [chosen, setChosen] = useState<number | null>(null);
  const [serverCorrect, setServerCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.unavailable) return null;
  const card = state.data;
  if (!card) return null;
  // BOUCLIER — contexte d'affichage uniquement ; la donnée API reste brute.
  const quizCtx = displayContext(card.context);
  const answered = chosen !== null;

  return (
    <section id="quiz" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
      <SceneHeader chapter={s.chapters.quiz} title={s.quiz.title} lead={s.quiz.lead} />

      <figure className="ln-card mx-auto mt-12 w-full max-w-lg rounded-2xl p-7" data-testid="daily-quiz">
        <blockquote>
          <p className="font-display text-3xl font-semibold text-ink">« {card.expression} »</p>
          <p className="mt-2 text-sm text-ink-2">
            {card.region} · {card.register}
          </p>
        </blockquote>

        <ul className="mt-6 space-y-2" aria-label={s.quiz.pickLabel}>
          {card.options.map((opt, i) => {
            const isAnswer = i === card.answerIndex;
            return (
              <li key={opt}>
                <button
                  type="button"
                  disabled={answered || card.completed || submitting}
                  onClick={() => {
                    if (answered || card.completed || submitting) return;
                    setChosen(i);
                    setSubmitting(true);
                    if (isAuthenticated) {
                      complete({ answerIndex: i })
                        .then((res) => setServerCorrect(res.correct))
                        .catch(() => setServerCorrect(null))
                        .finally(() => setSubmitting(false));
                    } else {
                      setServerCorrect(null);
                      setSubmitting(false);
                    }
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    answered && isAnswer
                      ? "border-gold/40 bg-gold/10 text-ink"
                      : answered && i === chosen
                        ? "border-white/15 bg-white/[0.03] text-ink-2"
                        : answered
                          ? "border-white/5 text-ink-3"
                          : "border-white/10 bg-white/[0.02] hover:border-gold/30"
                  }`}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="sr-only" role="status">
          {answered && serverCorrect === true ? s.quiz.correct : ""}
        </p>

        {answered ? (
          <div className="mt-6 space-y-3 text-sm">
            {isAnswerIdx(card, chosen) ? (
              <p className="text-gold">{s.quiz.correct}</p>
            ) : (
              <p className="text-ink-3">{s.quiz.incorrect}</p>
            )}
            {quizCtx && (
              <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-ink-2">
                <span className="font-semibold text-ink">{s.quiz.contextIntro} :</span> {quizCtx}
              </p>
            )}
            <p className="text-xs text-ink-3">
              {isAuthenticated ? s.quiz.authedNote : s.quiz.guestNote}
            </p>
          </div>
        ) : null}
      </figure>
    </section>
  );
}

/* La logique visuelle : face au UX, on re-sélectionne la bonne réponse
   localement même sans compte (lindex réel, sans re-attribuer le XP). */
function isAnswerIdx(
  card: { answerIndex: number },
  chosen: number | null,
): boolean {
  return chosen === card.answerIndex;
}

/* ═══════════════════════════════════════════════════════════════════════
   SCÈNE 6 — LE SYSTÈME (les fonctions réelles)
   Recherche/Atlas, ponts culturels, révisions espacées. "8 personnages
   IA" — la copy est vérifiée par les guards (la table en compte 8).
   ═══════════════════════════════════════════════════════════════════════ */

function SystemSection({ s }: { s: LandingSections }) {
  const items = [
    { icon: Map, ...s.system.atlas },
    { icon: Sparkles, ...s.system.bridges },
    { icon: Repeat, ...s.system.revisions },
  ];

  return (
    <section id="system" className="mx-auto max-w-6xl px-5 py-28">
      <SceneHeader chapter={s.chapters.system} title={s.system.title} />
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map((item, i) => (
          <motion.li
            key={item.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            transition={{ delay: i * 0.06 }}
            className="ln-card rounded-2xl p-6"
          >
            <item.icon className="size-6 text-gold" strokeWidth={1.6} aria-hidden="true" />
            <h3 className="mt-3 font-display text-lg font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.text}</p>
          </motion.li>
        ))}
      </ul>
      <p className="mt-10 text-center font-display text-xl text-ink-2">
        « Une langue, mille façons de la vivre. »
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SCÈNE 7 — LA CONVERSION (prix dérivé, 1 bouton, 1 carte) `id="pricing"`
   Aucun montant en dur : tout passe par lib/pricing.ts.
   ═══════════════════════════════════════════════════════════════════════ */

function PricingSection({ s, lang }: { s: LandingSections; lang: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const monthly = formatEur(PREMIUM.monthlyEur);
  const annual = formatEur(PREMIUM.annualEur);
  const perDay = premiumPerDayEur();
  const discount = premiumAnnualDiscountPct();

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
      <SceneHeader chapter={s.chapters.pricing} title={s.pricing.title} lead={s.pricing.lead} />

      {/* Le catalogue : 2 langues en parallèle + shadowing illimité + les
          8 personnages IA (table aiCharacters). */}
      <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="ln-card rounded-3xl p-8">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-5xl font-bold text-ink">{monthly}</span>
            <span className="text-sm text-ink-3">{s.pricing.monthlyLabel}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            ≈ {perDay} {s.pricing.perDayLabel}
          </p>
          <div className="mt-5 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">−{discount}%</span>
            <span className="text-ink-3">{annual} / {s.pricing.annualLabel}</span>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-ink-2">
            {s.pricing.includes.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden="true" className="text-gold">✓</span>
                {item}
              </li>
            ))}
          </ul>

          {authLoading ? null : (
            <div className="mt-7">
              <PremiumCta lang={lang} label={s.pricing.ctaLabel ?? s.pricing.cta} returnTo="/#pricing" />
            </div>
          )}
          <p className="mt-4 text-xs text-ink-3">{s.pricing.finePrint}</p>
        </div>

        <div className="ln-card rounded-3xl p-8">
          <h3 className="font-display text-xl font-semibold text-ink">{s.pricing.manageSub}</h3>
          {isAuthenticated ? (
            <div className="mt-5">
              <SubscriptionCard lang={lang} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-2">
              <Link to="/auth" className="text-gold hover:underline">
                {s.nav.start}
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────────── */

function FaqSection({ s }: { s: LandingSections }) {
  const items = s.faq;
  const [open, setOpen] = useState<string | null>(items[0]?.q ?? null);

  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-28">
      <Eyebrow>FAQ</Eyebrow>
      <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">FAQ</h2>

      <dl className="mt-10 divide-y divide-white/5">
        {items.map((item) => {
          const isOpen = open === item.q;
          return (
            <div key={item.q} className="py-5">
              <dt>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : item.q)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="font-display text-lg font-semibold text-ink">{item.q}</span>
                  <span aria-hidden="true" className="text-xl text-gold">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
              </dt>
              {isOpen && <dd className="mt-3 text-ink-2">{item.a}</dd>}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function Landing() {
  const { lang, t } = useI18n();
  const { isAuthenticated, isLoading } = useAuth();

  const s = snapSections(lang);
  const authed = !isLoading && isAuthenticated;

  /* ── Mini-mondes : le prototype suit la langue d'interface quand il
     existe (fr → fr, zh → zh) — sinon on ouvre sur fr, l'un des trois
     prototypes, sans créer de hiérarchie entre eux. */
  const [world, setWorld] = useState<WorldCode>(() => (lang === "zh" ? "zh" : "fr"));
  const [selectedMonument, setSelectedMonument] = useState<string | null>(null);

  /* Scène : ref partagée, écrite par le scroll, lue à chaque frame par
     CameraRig dans le canvas — zéro re-render pendant le scroll. */
  const scrollProgress = useRef(0);
  useMotionValueEvent(useScroll().scrollYProgress, "change", (v) => {
    scrollProgress.current = v;
  });

  return (
    <div className="relative min-h-screen overflow-x-clip bg-noir text-ink">
      {/* Le mini-monde 3D, fixe, derrière tout le contenu.
          Le wrapper gère pointer-events (monuments cliquables) et replis. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <MiniWorldHero
          className="absolute inset-0 [&>div]:pointer-events-auto [&_canvas]:pointer-events-auto"
          scrollProgress={scrollProgress}
          world={world}
          onSelect={(id) => setSelectedMonument(id)}
        />
      </div>

      {/* Voile atmosphérique : protège la lisibilité sur les zones denses. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(70rem 36rem at 50% 0%, transparent 45%, color-mix(in srgb, var(--noir) 78%, transparent) 88%)",
        }}
      />

      <LandingNav authed={authed} s={s} />

      <main className="relative z-10">
        <Hero world={world} setWorld={setWorld} selectedMonument={selectedMonument} setSelectedMonument={setSelectedMonument} />
        <MethodSection s={s} />
        <ShowcaseSection s={s} />
        <LanguagesSection s={s} />
        <QuizSection s={s} />
        <SystemSection s={s} />
        <PricingSection s={s} lang={lang} />
        <FaqSection s={s} />

        <section className="mx-auto max-w-4xl px-5 py-28 text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}>
            <Eyebrow>{s.footer.tagline}</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-5xl">
              Commence ton immersion.
            </h2>
            <div className="mt-10">
              <Link
                to={authed ? "/app" : "/auth"}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold to-gold-strong px-8 py-4 font-semibold text-noir shadow-lg shadow-gold/25 transition-transform hover:scale-[1.03] active:scale-95"
              >
                {authed ? s.nav.open : t("landing.cta")}
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        </section>

        <footer className="border-t border-white/5 px-5 py-10 text-sm text-ink-3">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="font-display font-semibold tracking-wide text-ink-2">Kɪ́LINGO</span>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <li>
                <a href="mailto:contact@kilingo.app" className="transition-colors hover:text-ink">
                  {s.footer.contact}
                </a>
              </li>
              <li>
                <Link to="/auth" className="transition-colors hover:text-ink">
                  {s.footer.login}
                </Link>
              </li>
            </ul>
          </div>
        </footer>
      </main>
    </div>
  );
}
