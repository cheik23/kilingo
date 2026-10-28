import { MapPin, Repeat2, Signal, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayContext } from "@/lib/pedagogicalContext";
import { registerLabel } from "@/convex/languages";
import { SpeakButton } from "./SpeakButton";
import {
  LEVEL_DOT,
  LEVEL_LABEL,
  getSlangCulture,
  levelFromRegister,
  type SlangCulture,
  type SlangLevel,
} from "@/data/slang-culture";

/* ═══════════════════════════════════════════════════════════════════
   FICHE D'EXPRESSION ENRICHIE — expression, sens, contexte culturel

   Une expression n'est pas une traduction. Ce composant rend les quatre
   blocs utiles pour la comprendre :

     1. l'expression + l'écoute de sa prononciation ;
     2. la définition courte ;
     3. le CONTEXTE CULTUREL — origine, qui l'utilise, niveau de langue ;
     4. les variations et un exemple concret.

   Rien n'est inventé à l'affichage : chaque ligne n'apparaît que si la
   donnée existe (base `slangExpressions`, puis enrichissement éditorial
   `src/data/slang-culture.ts`). Une expression non enrichie affiche son
   contexte issu de la base, jamais un champ creux.

   Deux sorties depuis le même module :
     · `ExpressionDetailCard` — la carte complète (Shadow, bilan de
       mission, fiche autonome) ;
     · `ExpressionCultureBlock` — le seul bloc culturel, à glisser dans un
       panneau de détail qui affiche déjà l'expression (Atlas).
   ═══════════════════════════════════════════════════════════════════ */

type SlangFields = {
  expression: string;
  /** Code langue de l'expression (« fr », « sw »…) — sert au TTS. */
  language: string;
  meaning?: string;
  /** Sens du sens : le mot à mot, quand la base le porte. */
  literal?: string;
  register?: string;
  region?: string;
  /** Exemple / contexte porté par la base. */
  context?: string;
};

/** Niveau de langue : enrichissement éditorial d'abord, registre ensuite. */
function resolveLevel(
  fields: SlangFields,
  culture: SlangCulture | null,
): { level: SlangLevel; source: string } | null {
  if (culture) return { level: culture.level, source: LEVEL_LABEL[culture.level] };
  if (!fields.register) return null;
  return { level: levelFromRegister(fields.register), source: registerLabel(fields.register) };
}

function LevelBadge({ level, source }: { level: SlangLevel; source: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.6875rem] text-ink-2"
      title={`Niveau de langue : ${LEVEL_LABEL[level]}`}
    >
      <span className={cn("size-2 rounded-full", LEVEL_DOT[level])} aria-hidden />
      {LEVEL_LABEL[level]}
      <span className="text-ink-3">· {source}</span>
    </span>
  );
}

function CultureLine({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        <Icon className="size-3" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

/**
 * Bloc culturel seul — pour un panneau qui affiche déjà l'expression
 * (Atlas). Ne rend rien quand la base ne porte ni contexte ni registre.
 */
export function ExpressionCultureBlock({
  expression,
  language,
  register,
  region,
  context,
  className,
}: SlangFields & { className?: string }) {
  const culture = getSlangCulture(language, expression);
  // BOUCLIER — `context` participe aussi à levelSource/resolveLevel (logique
  // métier, doit rester brut) ; seul l'exemple rendu est filtré : gabarit de
  // provenance PURE/DIRECTIVE/AMBIGUOUS → masqué, MIXED → exemple seul,
  // LABEL/libre → intact. L'exemple éditorial (`culture.example`) prime et
  // n'est jamais filtré.
  const level = resolveLevel({ expression, language, register, region, context }, culture);
  // Exemple éditorial d'abord, puis l'exemple filtré porté par la base.
  const example = culture?.example ?? displayContext(context);
  if (!culture && !level && !example) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {culture?.origin && (
        <CultureLine icon={MapPin} label="Origine">
          {culture.origin}
        </CultureLine>
      )}
      {culture?.usage && (
        <CultureLine icon={Users} label="Utilisation">
          {culture.usage}
        </CultureLine>
      )}
      {level && (
        <CultureLine icon={Signal} label="Niveau de langue">
          <LevelBadge level={level.level} source={level.source} />
        </CultureLine>
      )}
      {(culture?.variation || example) && (
        <div className="border-t border-white/5 pt-3">
          {culture?.variation && (
            <p className="text-sm text-ink-2">
              <span className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                <Repeat2 className="size-3" aria-hidden /> Variation
              </span>
              {culture.variation}
            </p>
          )}
          {example && (
            <p className={cn("text-sm italic", culture?.variation && "mt-2")}>
              <span className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase not-italic">
                {culture?.example ? "Exemple" : "Contexte"}
              </span>{" "}
              <span className="text-gold">« {example} »</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** La fiche complète — expression + audio + définition + contexte culturel. */
export function ExpressionDetailCard({
  expression,
  language,
  meaning,
  literal,
  register,
  region,
  context,
  className,
}: SlangFields & { className?: string }) {
  const culture = getSlangCulture(language, expression);

  return (
    <section className={cn("ln-card p-4 sm:p-5", className)}>
      {/* 1 · Expression + écoute */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl italic text-ink">{expression}</p>
          {region && (
            <p className="mt-0.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {region}
            </p>
          )}
        </div>
        <SpeakButton text={expression} language={language} size="lg" />
      </header>

      {/* 2 · Définition courte */}
      {meaning && (
        <p className="mt-3 border-t border-white/5 pt-3 text-sm leading-relaxed text-ink-2">
          <span className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
            Définition
          </span>
          <span className="mt-1 block font-medium text-gold">{meaning}</span>
          {literal && (
            <span className="mt-0.5 block text-xs text-ink-3 italic">
              littéralement : « {literal} »
            </span>
          )}
        </p>
      )}

      {/* 3 & 4 · Contexte culturel + variations / exemple */}
      <div className="mt-3 border-t border-white/5 pt-3">
        <ExpressionCultureBlock
          expression={expression}
          language={language}
          register={register}
          region={region}
          context={context}
        />
      </div>
    </section>
  );
}
