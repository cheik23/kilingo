import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Captions,
  Check,
  Clapperboard,
  Compass,
  Flame,
  Gauge,
  Headphones,
  Languages,
  Menu,
  Mic,
  Music2,
  Repeat,
  Search,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Waves,
  X,
} from "lucide-react";

import { NoirAmbience } from "@/components/fx/NoirAmbience";
import { BrandLink } from "@/components/brand/Logo";
import { MagneticButton, TiltCard } from "@/components/fx/interact";
import { RevealTitle, ScrambleHeading, ShimmerTitle } from "@/components/fx/text";
import { useAuth } from "@/hooks/use-auth";
import { LANGUAGES, REGISTERS } from "@/convex/languages";
import { languageIsComingSoon } from "@/data/contentLanguages";
import { SoonBadge } from "@/components/ui/SoonBadge";
import { PremiumCta } from "@/components/learner/PremiumCta";
import { SubscriptionCard } from "@/components/learner/SubscriptionCard";
import {
  PREMIUM,
  formatEur,
  premiumAnnualDiscountPct,
  premiumPerDayEur,
} from "@/lib/pricing";

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

/* Le mur des langues ne RECOPIE plus la liste : il lit la source unique
   `convex/languages`, celle des sélecteurs de l'onboarding, du changement de
   focus et de la découverte. L'ancienne liste figée à cinq entrées annonçait
   « Cinq langues » alors que l'application en proposait déjà onze, et elle ne
   pouvait pas suivre le lot des 18 : deux vérités à maintenir en parallèle.
   Drapeau et libellé viennent donc de la même source que l'application. */

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

/** Liens de navigation de la landing — une source unique pour le nav desktop
    et le panneau mobile : les deux ne peuvent plus dériver l'un de l'autre. */
const NAV_LINKS = [
  { href: "/culture", label: "Culture" },
  { href: "#methode", label: "La méthode" },
  { href: "#modules", label: "Modules" },
  { href: "#argot", label: "Argot" },
  { href: "#langues", label: "Langues" },
  { href: "#pricing", label: "Tarifs" },
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

/* ═══════════════════════════════════════════════════════════════════
   APPARITION AU DÉFILEMENT — le vocabulaire des sections.

   Framer Motion est déjà embarqué (TiltCard, MagneticButton), donc ces
   variantes n'ajoutent aucun octet au bundle. Le langage est le même
   que celui du hero : montée de 40 px, expo-out, 100 ms entre deux
   tuiles — une seule grammaire de mouvement sur la page.

   `once: true` : une section déjà vue ne rejoue pas — une animation qui
   repart à chaque passage transforme la lecture en manège.
   ═══════════════════════════════════════════════════════════════════ */
const REVEAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Marge de déclenchement : l'élément apparaît quand son haut entre à
    100 px du bas de la fenêtre, pas quand il est déjà à l'écran. */
const REVEAL_VIEWPORT = { once: true, margin: "-100px" } as const;

/** Le conteneur ne bouge pas lui-même : il cadence ses enfants. */
const revealGroup: Variants = {
  hidden: {},
  show: {
    transition: {
      duration: 0.6,
      ease: REVEAL_EASE,
      staggerChildren: 0.1,
    },
  },
};

/** Chaque tuile / carte : fondu et montée de 40 px, 600 ms. */
const revealItem: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: REVEAL_EASE },
  },
};

/* Le titre du hero est découpé en DEUX lignes pour l'impact : la coupure
   tombe au plus près du milieu, sur une espace. Les langues sans espaces
   (zh, ja) gardent une seule ligne — on ne coupe jamais un mot en deux.
   Le calcul est fait ici, sur la chaîne réellement affichée : aucune
   traduction n'a de « \n » à maintenir en parallèle. */
function splitTitle(title: string): string[] {
  const words = title.trim().split(" ");
  if (words.length < 4) return [title];
  const mid = title.trim().length / 2;
  let best = 1;
  let bestDelta = Number.POSITIVE_INFINITY;
  let cursor = 0;
  for (let i = 0; i < words.length - 1; i += 1) {
    cursor += words[i].length + 1;
    const delta = Math.abs(cursor - mid);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i + 1;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/* ═══════════════════════════════════════════════════════════════════
   PARALLAXE DU HERO — une seule écoute du pointeur pour tous les
   calques.

   Le héros n'est pas une scène 3D : le curseur ne déplace que des
   nappes (profondeurs de 4 à 26 px), jamais le texte au point de le
   rendre illisible. Deux raisons de passer par rAF et des variables
   CSS plutôt que par l'état React :

     · aucun re-rendu pendant le mouvement — l'état ne change pas ;
     · une seule boucle pour N calques, et elle S'ARRÊTE dès que la
       valeur a rejoint la cible (pas de rAF qui tourne à vide).

   Coupée sur tactile (il n'y a pas de curseur) et en reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */
function useHeroParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let running = false;

    const paint = () => {
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      /* Assez proche de la cible : on pose la valeur exacte et on rend
         la main — la boucle repart au prochain `pointermove`. */
      if (Math.abs(targetX - x) < 0.002 && Math.abs(targetY - y) < 0.002) {
        x = targetX;
        y = targetY;
        running = false;
      } else {
        raf = requestAnimationFrame(paint);
      }
      el.style.setProperty("--ln-mx", x.toFixed(4));
      el.style.setProperty("--ln-my", y.toFixed(4));
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(paint);
    };

    const onMove = (event: PointerEvent) => {
      /* Le doigt ne pilote pas de parallaxe : sur mobile, la nappe
         sauterait à chaque défilement. */
      if (event.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      targetX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2);
      targetY = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2);
      start();
    };

    /* Sortie du héros : tout revient au centre. Sans ça, les nappes
       resteraient figées du côté où la souris est partie. */
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      start();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      el.style.removeProperty("--ln-mx");
      el.style.removeProperty("--ln-my");
    };
  }, [ref]);
}

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
  /* État du menu hamburger mobile — inutile au-dessus de lg, où le nav
     desktop reprend la main, mais un seul état évite toute divergence. */
  const [menuOpen, setMenuOpen] = useState(false);
  /* `prefers-reduced-motion` : dans ce cas on ne pose NI `initial`
     (« hidden », donc opacity 0) NI `whileInView` — les éléments sont
     rendus dans leur état final, sans mouvement et sans attendre le
     défilement. */
  const reducedMotion = useReducedMotion();
  /* Référence du héros : la parallaxe écrit ses variables dessus, donc
     tous les calques de la section partagent un seul gestionnaire. */
  const heroRef = useRef<HTMLElement | null>(null);
  useHeroParallax(heroRef);

  /* ── L'ancre « /#pricing » doit vraiment sauter ────────────────────
     Les trois invites Premium mènent à `/#pricing`. React Router change
     bien l'URL, mais une navigation client ne fait sauter AUCUNE ancre :
     le défilement natif n'a lieu que sur un chargement complet. Sans ce
     qui suit, le CTA atterrirait en haut de la page — c'est-à-dire nulle
     part, exactement le défaut que cette section existe pour corriger.

     On vise l'élément après deux frames : Lenis remet la page en haut au
     changement de route (son effet s'exécute après le nôtre), et la
     section doit exister au moment du `scrollIntoView`. */
  const { hash, key: navKey } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [hash, navKey]);

  // Tous les CTA mènent à la découverte : /discover pour les nouveaux
  // visiteurs, /app/discover pour les inscrits.
  const start = useMemo(
    () => (isAuthenticated ? "/app" : "/discover"),
    [isAuthenticated],
  );
  const go = () => navigate(start);
  const { t, lang } = useI18n();
  /* Badges « Bientôt » du mur des langues : la réponse est calculée AU BUILD
     depuis les seeds (data/contentLanguages), jamais recopiée ici. Aucun
     appel réseau : la page publique reste juste même si le backend dort. */
  // Compteur temps réel : preuve sociale vérifiable, pas une statistique
  // figée dans le texte. Les deux requêtes sont des lectures minuscules
  // (deux agrégats), elles ne bloquent donc pas le rendu.
  /* Deux lignes, quel que soit le texte de la locale courante. */
  const titleLines = splitTitle(t("landing.title"));
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
  /* Le nombre de langues suit EXACTEMENT la même règle que les expressions :
     valeur live de landingStats, repli sur la copy i18n tant que la requête
     n'est pas arrivée. Le titre de la section Langues et la carte de stats
     lisent donc la MÊME source — plus de « 30 » en haut et « 29 » en bas. */
  const languageCount =
    numbers === undefined
      ? t("landing.features.languagesValue")
      : String(numbers.languages);

  return (
    <div className="relative min-h-screen overflow-hidden bg-noir text-ink">
      <NoirAmbience />

      {/* ── Barre de navigation ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-noir/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <BrandLink to="/" />

          {/* Liens — desktop uniquement (≥ lg, comme avant : en dessous, les
              six liens + les boutons ne tiennent pas sans déborder). Ils
              passent alors dans le panneau du menu hamburger. */}
          <nav className="hidden flex-1 items-center justify-center gap-6 text-sm text-ink-2 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-gold"
              >
                {l.label}
              </a>
            ))}
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

          {/* Bouton hamburger — mobile et tablette (< lg) uniquement. */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-ink-2 transition-colors hover:border-gold/40 hover:text-gold lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        {/* Panneau mobile : mêmes liens que le desktop (source unique),
            chaque cible tactile faisant au moins 44 px (min-h-11). */}
        {menuOpen && (
          <nav
            id="landing-mobile-nav"
            className="border-t border-white/5 bg-noir/95 backdrop-blur-xl lg:hidden"
          >
            <ul className="mx-auto max-w-6xl px-3 py-2">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-gold/10 hover:text-gold"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              {/* Le lien de connexion est masqué dans la barre sous sm : on
                  le réexpose ici pour les écrans étroits. */}
              <li className="mt-1 border-t border-white/5 pt-1 sm:hidden">
                <Link
                  to={isAuthenticated ? "/app" : "/auth"}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-gold/10 hover:text-gold"
                >
                  {isAuthenticated ? "Mon espace" : "Se connecter"}
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        {/* ── Héro ────────────────────────────────────────────────── */}
        {/* Entrée en cascade (`.hero-anim` + `hero-reveal` / `hero-fade`,
            délai posé en ligne) et parallaxe curseur (`.ln-hero-layer`,
            profondeur `--ln-depth`). Aucune bibliothèque d'animation
            n'entre ici : le mouvement est du CSS plus une seule boucle
            rAF. Le héros porte le LCP de la page publique, il ne doit
            pas payer du JS décoratif en plus de three.js. */}
        <section
          ref={heroRef}
          className="relative isolate mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24"
        >
          {/* Décor : une nappe dorée qui respire (22 s) et un halo plus
              petit qui suit le curseur. Purement visuels —
              `pointer-events: none`, `aria-hidden`. */}
          <span aria-hidden="true" className="ln-hero-halo" />
          <span
            aria-hidden="true"
            className="ln-hero-cursor ln-hero-layer"
            style={{ ["--ln-depth" as string]: "26px" }}
          />

          <div>
            <p
              className="hero-anim hero-fade ln-hero-layer inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-3.5 py-1.5 font-mono text-[0.625rem] tracking-[0.2em] text-gold uppercase"
              style={{
                animationDelay: "0s",
                ["--ln-depth" as string]: "4px",
              }}
            >
              <Waves className="size-3" />
              {t("landing.badge")}
            </p>

            <h1
              className="hero-anim hero-reveal mt-6 font-display text-3xl leading-[1.1] font-semibold sm:text-4xl md:text-5xl lg:text-6xl"
              style={{ animationDelay: "0.1s" }}
            >
              {titleLines.map((line) => (
                <span key={line} className="block">
                  <RevealTitle text={line} />
                </span>
              ))}
            </h1>

            <p
              className="hero-anim hero-fade mt-6 max-w-xl text-base leading-relaxed text-ink-2"
              style={{ animationDelay: "0.3s" }}
            >
              {t("landing.subtitle")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={start}
                className="ln-glow ln-sheen hero-anim hero-fade relative inline-flex w-full items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-gold to-gold-soft px-5 py-3 font-semibold text-noir transition-all duration-300 hover:scale-[1.03] active:scale-95 md:w-auto md:px-6"
                style={{ animationDelay: "0.5s" }}
              >
                <span aria-hidden="true" className="ln-shine" />
                {t("landing.cta")}
                <ArrowRight className="size-4" />
              </Link>
              {/* Le bouton secondaire suit la même entrée, juste après :
                  sans ça, il apparaissait d'un coup à côté d'un CTA
                  encore en train de se poser. */}
              <a
                href="#modules"
                className="hero-anim hero-fade inline-flex w-full items-center justify-center rounded-xl border border-white/10 px-6 py-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-gold/40 hover:text-gold md:w-auto"
                style={{ animationDelay: "0.58s" }}
              >
                {t("landing.ctaSecondary")}
              </a>
            </div>

            <p
              className="hero-anim hero-fade mt-5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase"
              style={{ animationDelay: "0.7s" }}
            >
              {t("landing.reassurance")}
            </p>
          </div>

          {/* Context Card — la promesse du produit, rendue visible.
              Une aura dorée tourne derrière la carte (26 s, floutée) :
              elle donne au panneau une lumière qui ne s'arrête jamais,
              sans ajouter une seule propriété animée de plus à la carte,
              qui garde son inclinaison au curseur via `TiltCard`. */}
          <div
            className="hero-anim hero-reveal relative"
            style={{ animationDelay: "0.35s" }}
          >
            <span aria-hidden="true" className="ln-hero-aura" />
            <TiltCard className="ln-card relative rounded-2xl p-5">
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
                {["COMPRENDRE", "POURQUOI ?", "JE VEUX APPRENDRE ÇA"].map(
                  (c) => (
                    <span
                      key={c}
                      className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[0.625rem] tracking-wide text-ink-2"
                    >
                      {c}
                    </span>
                  ),
                )}
              </div>
            </TiltCard>
          </div>
        </section>

        {/* ── Globe + chiffres clés ───────────────────────────────
            Le globe est chargé à la demande : three.js ne doit pas
            entrer dans le bundle qui définit le LCP de la landing. */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative order-2 lg:order-1">
              <div className="ln-globe-breathe relative mx-auto aspect-square w-full max-w-sm">
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
              <h2 className="font-display text-3xl font-semibold sm:text-4xl lg:text-5xl">
                {t("landing.features.title")}
              </h2>
              <p className="mt-3 max-w-lg text-ink-2">{t("landing.features.lead")}</p>

              {/* Les six tuiles apparaissent une à une à l'entrée dans le
                  champ, une seule fois. Le conteneur cadence
                  (`staggerChildren`), les tuiles ne portent que leur
                  variante — aucun délai à maintenir à la main. */}
              <motion.div
                className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                variants={revealGroup}
                initial={reducedMotion ? false : "hidden"}
                whileInView={reducedMotion ? undefined : "show"}
                viewport={REVEAL_VIEWPORT}
              >
                {[
                  {
                    // Même source que le titre de la section Langues :
                    // `languageCount` (landingStats, repli copy i18n).
                    value: languageCount,
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
                  {
                    value: t("landing.features.cultureValue"),
                    label: t("landing.features.cultureLabel"),
                  },
                  {
                    value: t("landing.features.pronunciationValue"),
                    label: t("landing.features.pronunciationLabel"),
                  },
                  {
                    value: t("landing.features.verifiedValue"),
                    label: t("landing.features.verifiedLabel"),
                  },
                ].map((f) => {
                  /* Une valeur courte et numérique (« 29 », « 6 600+ »,
                     « 3D », « 20 ») garde text-4xl : elle tient sur une ligne.
                     Une valeur textuelle (« Audio native », « Base de données
                     vérifiée ») descend à text-xl puis md:text-2xl : en 4xl,
                     elle prenait 2 à 3 lignes sur mobile. Les 12 locales
                     n'utilisent que des chiffres ASCII : tester le premier
                     caractère suffit à trancher. */
                  const numeric = /^\d/.test(f.value.trim());
                  return (
                    <motion.div
                      key={f.label}
                      variants={revealItem}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white/5 p-6 text-center"
                    >
                      <span
                        className={`font-bold text-gold ${
                          numeric
                            ? "text-4xl"
                            : "text-xl leading-tight md:text-2xl"
                        }`}
                      >
                        {f.value}
                      </span>
                      <span className="text-sm font-medium text-ink-2">
                        {f.label}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>

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

          <motion.div
            className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            variants={revealGroup}
            initial={reducedMotion ? false : "hidden"}
            whileInView={reducedMotion ? undefined : "show"}
            viewport={REVEAL_VIEWPORT}
          >
            {MODULES.map((m) => (
              /* Le wrapper est la tuile de la grille : il porte l'entrée
                 au défilement ET la montée au survol. Le TiltCard à
                 l'intérieur garde son inclinaison — les deux `transform`
                 sont sur deux éléments distincts, donc ils se composent
                 au lieu de s'écraser. `h-full` : sans lui, la carte
                 cessait de remplir sa ligne et les cartes d'une même
                 rangée n'avaient plus la même hauteur. */
              <motion.div
                key={m.name}
                variants={revealItem}
                whileHover={
                  reducedMotion
                    ? undefined
                    : {
                        y: -8,
                        transition: { duration: 0.3, ease: "easeOut" },
                      }
                }
                className="h-full"
              >
                {/* `hover:shadow-xl hover:shadow-gold/10` est la classe
                    demandée ; elle est neutralisée à l'écran par
                    `.ln-card:hover` (règle non layerisée, prioritaire sur
                    `@layer utilities`). L'intensification réelle est donc
                    portée par `.ln-card-glow`, déclarée après elle. Le
                    détail est commenté dans `index.css`. */}
                <TiltCard className="ln-card ln-card-glow hover:shadow-xl hover:shadow-gold/10 h-full p-6">
                  <div className="flex items-start justify-between">
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
                  <div className="mt-4 flex flex-wrap gap-1">
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
              </motion.div>
            ))}
          </motion.div>
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
              /* Le compteur est le MÊME que celui du hero (mesuré côté
                 Convex, repli i18n) : écrit en dur, il avait dérivé de
                 974 à 4 136 expressions sans que rien ne le signale. */
              lead={`Signification naturelle, traduction littérale, contexte, registre, variantes, exemples — et l'avertissement qui va avec. La base embarquée compte ${expressionCount} expressions, du verlan au drill.`}
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
            <ul className="mt-6 space-y-3">
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
              <ul className="mt-5 space-y-2 text-sm">
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
              title={`${languageCount} langues d'apprentissage, une même exigence`}
              lead="Interface disponible en douze langues, dont le français, l'anglais, l'espagnol, le mandarin, l'arabe (RTL) et le russe. D'autres s'ajoutent sans toucher au reste."
            />
            <div className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {LANGUAGES.map((l, i) => (
                <div
                  key={l.code}
                  className="ln-card ln-stagger-item relative p-5 text-center"
                  style={{ ["--ln-i" as string]: i }}
                >
                  {/* La langue encore vide garde sa carte : la promesse est
                      datée, pas cachée. La carte, elle, surligne déjà ses pays. */}
                  {languageIsComingSoon(l.code) && (
                    <SoonBadge className="absolute top-3 right-3" />
                  )}
                  <span className="text-3xl">{l.flag}</span>
                  <p className="mt-3 font-display text-lg font-semibold">
                    {l.name}
                  </p>
                  <p className="mt-1 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                    {l.countries}
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

        {/* ── Tarifs ────────────────────────────────────────────────
            Destination des trois invites Premium (« /#pricing »).

            AUCUN montant n'est écrit ici : les valeurs viennent de
            `lib/pricing.ts`, la source unique que la landing partage avec
            la caisse. Un prix qui bouge sans qu'on mette la page à jour
            casse un contrôle au lieu de mentir en silence.

            La carte gratuite est écrite en clair, et pas seulement la
            payante : ce qui reste gratuit est une promesse, il doit donc
            être lisible au même endroit que le prix. */}
        <section
          id="pricing"
          className="scroll-mt-24 border-y border-white/5 bg-noir-2/40 py-20"
        >
          <div className="mx-auto max-w-6xl px-5">
            <SectionTitle
              eyebrow="Tarifs"
              title="La boucle d'apprentissage reste gratuite"
              lead="Argot, quiz, révisions espacées, XP, badges et export Anki / CSV : gratuits pour toujours, sans carte bancaire. Premium n'ouvre que ce qui coûte réellement des ressources — langues en parallèle, shadowing illimité, personnages IA."
            />

            <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
              {/* Gratuit */}
              <div className="ln-card flex flex-col p-6">
                <p className="font-mono text-[0.625rem] tracking-[0.3em] text-ink-3 uppercase">
                  Gratuit
                </p>
                <p className="mt-3 font-display text-3xl font-semibold">
                  0 €
                </p>
                <p className="mt-1 text-xs text-ink-3">
                  Pour toujours · aucune carte bancaire
                </p>

                <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-2">
                  {[
                    "Une langue active (elle ne disparaît jamais, même en changeant de focus)",
                    "5 analyses Shadow par jour, compteur visible et remise à zéro chez toi",
                    "Baba Street et Mama Wisdom, avec tous leurs scénarios",
                    "Argot, quiz, révisions, XP, badges et export Anki / CSV",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 leading-relaxed">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={start}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                >
                  {isAuthenticated ? "Ouvrir mon espace" : "Commencer gratuitement"}
                </Link>
              </div>

              {/* Premium — le seul CTA principal de cette section. */}
              <div className="ln-card relative flex flex-col border-gold/30 p-6">
                <span className="absolute -top-3 right-5 rounded-full border border-gold/40 bg-noir px-3 py-1 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
                  Deux langues en parallèle
                </span>
                <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
                  Premium
                </p>
                <p className="mt-3 font-display text-3xl font-semibold text-gold">
                  {formatEur(PREMIUM.monthlyEur)}
                  <span className="ml-1 text-base font-normal text-ink-2">
                    / mois
                  </span>
                </p>

                <ul className="mt-5 space-y-2 text-sm text-ink-2">
                  {[
                    "Deux langues actives en parallèle, sans compteur ni plafond",
                    "Shadowing illimité : plus aucune analyse décomptée",
                    "Les 8 personnages IA, chacun avec sa voix et son registre",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 leading-relaxed">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Le bouton de paiement n'est monté qu'ICI : c'est ce
                    montage qui interroge l'état du prestataire et écrit sa
                    réponse en base. La classe passée est celle des autres
                    CTA de la page (le défaut du composant vise un style
                    qui n'existe pas dans cette feuille). */}
                <PremiumCta
                  lang={lang}
                  label={`Démarrer l'essai de ${PREMIUM.trialDays} jours`}
                  fallbackHref={start}
                  className="ln-glow mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-5 py-3 font-semibold text-noir transition-transform hover:-translate-y-0.5"
                />

                <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-3">
                  {PREMIUM.trialDays} jours d'essai, sans prélèvement avant la
                  fin. Annulation à tout moment, en un clic depuis les
                  réglages. Ou {formatEur(PREMIUM.annualEur)} par an —{" "}
                  {premiumAnnualDiscountPct()} % de moins, soit{" "}
                  {premiumPerDayEur()} par jour.
                </p>
              </div>
            </div>

            {/* Ce qui est déjà ouvert sur CE compte : la carte ne s'affiche
                qu'une fois connecté, parce que « gérer mon abonnement » ne
                veut rien dire pour un visiteur. */}
            {isAuthenticated ? (
              <div className="mx-auto mt-6 max-w-4xl">
                <SubscriptionCard lang={lang} />
              </div>
            ) : null}
          </div>
        </section>

        {/* ── CTA final ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <Flame className="mx-auto size-8 text-gold" />
          <h2 className="mt-5 font-display text-3xl font-semibold sm:text-4xl lg:text-5xl">
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
