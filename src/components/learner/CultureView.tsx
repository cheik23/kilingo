import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { useMemo } from "react";
import { Globe, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONCEPT_STYLE,
  DEFAULT_CONCEPT_STYLE,
} from "./cultureStyle";

/* ═══════════════════════════════════════════════════════════════════
   MODE CULTURE — PHASE 10-A (socle)

   vue « /culture » : les 20 concepts universels des ponts culturels
   (table Convex `crossConcepts`, seed idempotent `crossSeed.ts`) avec
   le nombre de langues qui les couvrent. PHASE 10-B : chaque carte est
   désormais cliquable et mène à la vue détaillée du concept
   (« /app/culture/:slug », ConceptDetailView).
   ═══════════════════════════════════════════════════════════════════ */

export function CultureView() {
  const navigate = useNavigate();
  const crossConcepts = useQuery(api.crossSeed.getCrossConcepts, {});
  const concepts = useMemo(
    () =>
      (crossConcepts ?? []).map((c) => ({
        slug: c.slug,
        labelFr: c.labelFr,
        labelEn: c.labelEn,
        langCount: new Set(c.entries.map((e) => e.lang)).size,
        exprCount: c.entries.length,
      })),
    [crossConcepts],
  );
  const totalLangs = useMemo(() => {
    const set = new Set<string>();
    for (const c of crossConcepts ?? []) for (const e of c.entries) set.add(e.lang);
    return set.size;
  }, [crossConcepts]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Titre */}
      <header className="mb-6">
        <p className="flex items-center gap-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
          <Globe className="size-3.5" aria-hidden /> Mode culture
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-ink">
          20 concepts universels, {totalLangs > 0 ? totalLangs : 30} langues
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          La même idée se dit partout — mais jamais pareil. Explore comment
          {" "}{totalLangs || 30} langues nomment l'argent, l'amour, la fête ou le destin.
        </p>
      </header>

      {/* Contenu */}
      {crossConcepts === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ln-card h-24 animate-pulse" />
          ))}
        </div>
      ) : concepts.length === 0 ? (
        <p className="ln-card p-5 text-center text-sm text-ink-3">
          Aucun concept disponible pour le moment.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {concepts.map((c) => {
            const style = CONCEPT_STYLE[c.slug] ?? DEFAULT_CONCEPT_STYLE;
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/culture/${c.slug}`)}
                  className={cn(
                    "ln-card group w-full text-left transition-colors",
                    "hover:border-gold/40 hover:bg-gold/5",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        "bg-gradient-to-br text-xl",
                        style.ring,
                      )}
                      aria-hidden
                    >
                      {style.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink group-hover:text-gold">
                        {c.labelFr}
                      </p>
                      <p className="truncate text-xs text-ink-3">{c.labelEn}</p>
                      <p className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-ink-3">
                        <Languages className="size-3" aria-hidden />
                        {c.langCount} langue{c.langCount > 1 ? "s" : ""}
                        {" · "}
                        {c.exprCount} expression{c.exprCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CultureView;
