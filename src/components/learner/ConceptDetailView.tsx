import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useParams } from "react-router";
import { useMemo } from "react";
import { ArrowLeft, Globe, Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LANGUAGES, registerKey } from "@/convex/languages";
import { ContextParser } from "./ContextParser";
import { SpeakButton } from "./SpeakButton";
import {
  CONCEPT_STYLE,
  DEFAULT_CONCEPT_STYLE,
} from "./cultureStyle";

/* ═══════════════════════════════════════════════════════════════════
   MODE CULTURE — VUE DÉTAILLÉE D'UN CONCEPT (PHASE 10-B)

   Route dynamique « /app/culture/:slug » : toutes les langues et
   expressions d'un concept des ponts culturels (table Convex
   `crossConcepts`, query dédiée `crossSeed:getConceptDetails` qui
   ramène en plus, quand la fiche existe dans la base slang, son
   `context` enrichi, son registre et sa région).

   Rendu du champ `context` : impérativement <ContextParser /> (Phase
   10-A) — format 4 parties rendu élégamment, tout autre format ou
   valeur null tombe sur son fallback sécurisé, jamais de crash.
   ═══════════════════════════════════════════════════════════════════ */

type LangMeta = { name: string; flag: string };

/** Meta langue (drapeau + nom) depuis la table des langues du projet. */
const LANG_META: Record<string, LangMeta> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, { name: l.name, flag: l.flag }]),
);

/** Le fallback ne fabrique rien : code brut + globe si inconnu. */
function langMeta(lang: string): LangMeta {
  return LANG_META[lang] ?? { name: lang, flag: "🌐" };
}

type Entry = {
  lang: string;
  expr: string;
  gloss: string;
  context: string | null;
  literal: string | null;
  register: string | null;
  region: string | null;
};

/** Carte d'une expression dans une langue. */
function LanguageExpressionCard({ entry }: { entry: Entry }) {
  const meta = langMeta(entry.lang);

  return (
    <article className="ln-card flex h-full flex-col gap-3 p-4">
      {/* Langue : drapeau + nom */}
      <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
        <span aria-hidden>{meta.flag}</span>
        {meta.name}
      </p>

      {/* Expression, grande et grasse, avec écoute de la prononciation */}
      <header className="flex items-start justify-between gap-2">
        <p className="font-display min-w-0 text-xl font-semibold break-words text-ink">
          {entry.expr}
        </p>
        <SpeakButton text={entry.expr} language={entry.lang} />
      </header>

      {/* Sens / traduction littérale — secondaire */}
      {entry.gloss && (
        <p className="border-t border-white/5 pt-2 text-sm leading-relaxed text-ink-2">
          {entry.gloss}
        </p>
      )}

      {/* Contexte enrichi — <ContextParser/> gère le fallback brut */}
      {entry.context && (
        <div className="mt-auto border-t border-white/5 pt-2">
          <ContextParser context={entry.context} />
        </div>
      )}

      {/* Badges optionnels : registre (i18n) + région brute si présente */}
      {(entry.register || entry.region) && (
        <p className="flex flex-wrap items-center gap-1.5">
          {entry.register && <RegisterBadge register={entry.register} />}
          {entry.region && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.625rem] text-ink-3">
              {entry.region}
            </span>
          )}
        </p>
      )}
    </article>
  );
}

/** Badge de registre : libellé i18n (repli fr) si connu, brut sinon. */
function RegisterBadge({ register }: { register: string }) {
  const { t } = useI18n();
  const key = registerKey(register);
  return (
    <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[0.625rem] text-gold/90">
      {key ? t(`registers.${key}`) : register}
    </span>
  );
}

/** Vue route « /app/culture/:slug ». */
export function ConceptDetailView() {
  // Le slug venant de l'URL est décodé/validé par React Router ; on ne
  // requête que des chaînes non vides pour éviter un aller-retour inutile.
  const { slug = "" } = useParams<{ slug: string }>();
  const concept = useQuery(api.crossSeed.getConceptDetails, { slug });

  const entries = useMemo(() => concept?.entries ?? [], [concept]);
  const langCount = useMemo(
    () => new Set(entries.map((e) => e.lang)).size,
    [entries],
  );
  const style = CONCEPT_STYLE[concept?.slug ?? ""] ?? DEFAULT_CONCEPT_STYLE;

  if (concept === undefined) {
    // Chargement : même grille d'os que la liste de la Phase 10-A.
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ln-card h-40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (concept === null || concept.entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <DetailHeader
          backTo="/app/culture"
          labelFr="Concept introuvable"
          labelEn={slug}
          langCount={0}
          exprCount={0}
        />
        <p className="ln-card p-5 text-center text-sm text-ink-3">
          Ce concept n'existe pas (ou plus) dans les ponts culturels.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <DetailHeader
        backTo="/app/culture"
        emoji={style.emoji}
        accent={style.ring}
        labelFr={concept.labelFr}
        labelEn={concept.labelEn}
        langCount={langCount}
        exprCount={concept.entries.length}
      />

      {/* Grille responsive : 1 → 2 → 3 colonnes */}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {entries.map((e, i) => (
          <li
            key={`${e.lang}-${e.expr}-${i}`}
            className={cn("flex", "min-w-0")}
          >
            <div className="w-full">
              <LanguageExpressionCard entry={e} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** En-tête de la vue détail : retour, emoji du concept, titre, sous-titre. */
function DetailHeader({
  backTo,
  labelFr,
  labelEn,
  langCount,
  exprCount,
  emoji = "🌐",
  accent = "from-white/20 to-white/10",
}: {
  backTo: string;
  labelFr: string;
  labelEn: string;
  langCount: number;
  exprCount: number;
  emoji?: string;
  accent?: string;
}) {
  return (
    <header className="mb-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
        Retour aux concepts
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl",
            accent,
          )}
          aria-hidden
        >
          {emoji}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
            <Globe className="size-3.5" aria-hidden /> Mode culture
          </p>
          <h1 className="font-display mt-0.5 break-words text-3xl font-semibold text-ink">
            {labelFr}
          </h1>
          <p className="truncate text-xs text-ink-3">{labelEn}</p>
        </div>
      </div>

      {/* Sous-titre : X langues, Y expressions */}
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        Découvrez comment ce concept s'exprime dans{" "}
        <span className="font-medium text-gold">
          {langCount} langue{langCount > 1 ? "s" : ""}
        </span>{" "}
        {langCount > 0 || exprCount > 0 ? "· " : ""}
        <span className="inline-flex items-center gap-1">
          <Languages className="size-3.5" aria-hidden />
          {exprCount} expression{exprCount > 1 ? "s" : ""}
        </span>
      </p>
      {exprCount === 0 && langCount === 0 && (
        <p className="text-xs text-ink-3 mt-1">
          Aucune expression enregistrée pour ce concept.
        </p>
      )}
    </header>
  );
}

export default ConceptDetailView;
