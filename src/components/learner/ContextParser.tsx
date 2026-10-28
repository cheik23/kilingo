import { useMemo } from "react";
import { Info, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayContext } from "@/lib/pedagogicalContext";

/* ═══════════════════════════════════════════════════════════════════
   SCALE CONTEXT — formatage élégant du champ `context` (PHASE 10-A)

   Deux formats coexistent dans la base (aucune donnée réécrite) :
     · structuré — 4 segments « [A] | [B] | [Ex: '...'] | [Note: ...] »
       (1061 fiches enrichies, format canonique depuis la phase 5-6) ;
     · libre — tout le reste : guillemets « ... », texte simple,
       formats partiels ou anciens (fallback brut, jamais crasher).

   Le parseur accepte les séparateurs «  |  » ET « | » (certains lots
   historiques n'ont pas d'espaces autour du tube), puis n'affiche le
   rendu structuré que si TOUTES les parties lexicales reconnues sont
   bien présentes — sinon fallback sécurisé.
   ═══════════════════════════════════════════════════════════════════ */

/* Ce que le parseur sait extraire d'une partie du contexte structuré. */
type Segments = {
  literal: string | null;   // ‹ Époque: … › / ‹ Sens littéral: … › etc.
  sense: string | null;     // ‹ Sens réel: … › / ‹ Origine: … › etc.
  example: string | null;   // ‹ Ex: '...' ›
  note: string | null;      // ‹ Note: ... ›
};

/** Pattern des étiquettes connues dans les 4 segments canoniques. */
const LABEL_RE = {
  literal: /^\[?\s*(?:Sens littéral|Époque|Mot à mot|Sens premier)\s*[:：]/i,
  sense: /^\[?\s*(?:Sens réel|Origine|Usage|Registre|Niveau|Source)\s*[:：]/i,
  example: /^\[?\s*Ex\s*[:：]/i,
  note: /^\[?\s*Note\s*[:：]/i,
} as const;

/** Retire les crochets/espaces décoratifs autour d'un segment. */
function clean(s: string): string {
  return s.replace(/^\[+|\]+$/, "").trim();
}

/** Classification d'une partie textuelle brute. */
function classify(part: string): keyof typeof LABEL_RE | null {
  for (const key of Object.keys(LABEL_RE) as (keyof typeof LABEL_RE)[]) {
    if (LABEL_RE[key].test(part.trim())) return key;
  }
  return null;
}

/** Parse une chaîne `context` en segments canoniques (ou null si libre). */
export function parseContext(raw: string | null | undefined): Segments | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  if (!text.includes("|")) return null;

  const parts = text.split("|").map(clean);
  const parsed: Segments = { literal: null, sense: null, example: null, note: null };
  let used = 0;
  for (const p of parts) {
    if (!p) continue;
    const kind = classify(p);
    if (!kind) break; // format libre mélangé au structuré → fallback
    if (parsed[kind] !== null) break; // doublons → format inattendu
    // 1re partie : on accepte aussi un segment sans étiquette (sens
    // littéral implicite) si les suivantes sont étiquetées.
    parsed[kind] = clean(p.replace(/^\[?\s*[^:：]{0,30}[:：]\s*/, ""));
    used += 1;
  }
  // Format structuré confirmé si au moins 2 parties reconnues et rien
  // d'inexpliqué. Sinon, fallback brut (anciennes/formats partiels : 269
  // fiches) — jamais aucun crash.
  const leftover = parts.length - used;
  if (used >= 2 && leftover === 0) return parsed;
  return null;
}

type Props = {
  context: string | null | undefined;
  className?: string;
};

/** Le composant : rend élégant si structuré, brut si libre. */
export function ContextParser({ context, className }: Props) {
  /* BOUCLIER — tout le texte rendu passe par displayContext() : gabarit de
     provenance PURE/DIRECTIVE/AMBIGUOUS → null (bloc masqué, jamais de
     fallback brut) ; MIXED → l'exemple seul, sans le gabarit ; LABEL et
     contexte libre → intacts. Le parse structuré opère ensuite sur la
     valeur filtrée — la donnée brute n'est jamais rendue. */
  const shown = displayContext(context);
  const parsed = useMemo(() => parseContext(shown), [shown]);

  if (!shown) return null;
  if (!parsed) {
    // Fallback sécurisé : la valeur filtrée, jamais la chaîne brute.
    return (
      <p className={cn("text-sm leading-relaxed text-ink-2", className)}>
        {shown}
      </p>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed text-ink-2", className)}>
      {/* 1 · Sens littéral — gras */}
      {parsed.literal && (
        <p className="mt-1 font-semibold text-ink">
          {parsed.literal}
        </p>
      )}
      {/* 2 · Sens réel — normal */}
      {parsed.sense && (
        <p className="mt-1">{parsed.sense}</p>
      )}
      {/* 3 · Exemple — italique, couleur d'accent */}
      {parsed.example && (
        <p className="mt-1 text-sm italic text-gold/90">
          <Quote className="mr-1 inline-block size-3 shrink-0 align-baseline" aria-hidden />
          {parsed.example}
        </p>
      )}
      {/* 4 · Note — bloc discret (détail au survol/planche discrète) */}
      {parsed.note && (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-ink-3">
          <Info className="mt-0.5 size-3 shrink-0 text-gold/70" aria-hidden />
          {parsed.note}
        </p>
      )}
    </div>
  );
}

export default ContextParser;
