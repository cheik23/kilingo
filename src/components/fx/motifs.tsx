/* ═══════════════════════════════════════════════════════════════════════
   ADN VISUEL — MOTIFS CULTURELS FUTURISTES (MODULES 0 & 1)

   Trois motifs SVG, 100 % vectoriels et sans dépendance, qui donnent à
   chaque lieu une texture reconnaissable — traditionnel + tech :

     · kente     — bandes tissées + traces de circuit et LED aux nœuds
     · adinkra   — symboles reliés en réseau (graphe) + nœuds lumineux
     · halftone  — points dégradés avec halo LED or terre

   Règles tenues par construction :
     · toujours en FOND de section, `opacity` 3 à 6 % — jamais sur du
       texte : `aria-hidden`, `pointer-events-none`, et l'appelant garde
       son contenu AU-DESSUS (z-10) ;
     · `preserveAspectRatio="none"` : le motif s'étire au cadre sans
       jamais déborder ni créer de scroll horizontal ;
     · palette « Terre Sacrée » : or terre + brun ; terracotta réservé aux
       urgences ;
     · animations pilotées uniquement en CSS (classes `ln-motif-node` /
       `ln-motif-link`), coupées en `prefers-reduced-motion` ;
     · chaque motif pèse < 5 Ko (inline, aucun fetch).
   ═══════════════════════════════════════════════════════════════════════ */

export type MotifVariant = "kente" | "adinkra" | "halftone";

/* ── 1. Kente futuriste : tissage + circuit imprimé ─────────────────── */

/** Traces de circuit : segments orthogonaux qui relient les LED. */
const KENTE_TRACES = [
  "M0 30 H118 V62 H200",
  "M58 0 V30",
  "M142 0 V62",
  "M0 118 H42 V150 H200",
  "M0 86 H30 V118",
  "M170 118 V200",
];

/** Points de connexion lumineux (LED) aux intersections du circuit. */
const KENTE_LEDS = [
  { x: 118, y: 30 },
  { x: 118, y: 62 },
  { x: 58, y: 30 },
  { x: 142, y: 62 },
  { x: 42, y: 118 },
  { x: 30, y: 86 },
  { x: 170, y: 118 },
  { x: 200, y: 62 },
  { x: 0, y: 118 },
];

/** Bandes tissées or / brun — inspiration kente. */
export function KenteMotif({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 200 200"
      className={className}
    >
      <defs>
        <pattern id="ln-kente" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="none" />
          {/* trame horizontale */}
          {[0, 6, 14, 22, 34].map((y, i) => (
            <rect
              key={`h${y}`}
              x="0"
              y={y}
              width="40"
              height={i % 2 === 0 ? 3 : 5}
              fill="var(--gold-primary)"
              opacity={i % 2 === 0 ? 0.9 : 0.5}
            />
          ))}
          {/* fils verticaux */}
          {[4, 20, 36].map((x) => (
            <rect key={`v${x}`} x={x} y="0" width="2" height="40" fill="var(--gold-primary)" opacity="0.45" />
          ))}
          {/* losanges tissés */}
          <path d="M10 24 L18 16 L26 24 L18 32 Z" fill="var(--gold-primary)" opacity="0.35" />
          <path d="M30 10 L36 4 L42 10 L36 16 Z" fill="var(--gold-primary)" opacity="0.25" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#ln-kente)" />
      {/* circuit imprimé par-dessus le tissage */}
      <g fill="none" stroke="var(--gold-primary)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        {KENTE_TRACES.map((d, i) => (
          <path key={i} d={d} opacity="0.5" />
        ))}
      </g>
      <g fill="var(--gold-primary)">
        {KENTE_LEDS.map((led, i) => (
          <circle key={i} className="ln-motif-node" cx={led.x} cy={led.y} r="2.6" />
        ))}
      </g>
    </svg>
  );
}

/* ── 2. Adinkra en réseau : symboles reliés ─────────────────────────── */

const ADINKRA_NODES = [
  { x: 25, y: 25 },
  { x: 75, y: 25 },
  { x: 125, y: 25 },
  { x: 175, y: 25 },
  { x: 50, y: 75 },
  { x: 100, y: 75 },
  { x: 150, y: 75 },
  { x: 25, y: 125 },
  { x: 75, y: 125 },
  { x: 125, y: 125 },
  { x: 175, y: 125 },
  { x: 50, y: 175 },
  { x: 100, y: 175 },
  { x: 150, y: 175 },
];

/** Arêtes du graphe (index dans ADINKRA_NODES). */
const ADINKRA_LINKS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [3, 6],
  [4, 5], [5, 6], [4, 7], [4, 8], [5, 8], [5, 9], [6, 9], [6, 10],
  [7, 8], [8, 9], [9, 10], [7, 11], [8, 11], [8, 12], [9, 12], [9, 13],
  [10, 13], [11, 12], [12, 13],
];

/** Symboles adinkra reliés en réseau (graphe) avec nœuds lumineux. */
export function AdinkraMotif({ className = "" }: { className?: string }) {
  const at = (i: number) => ADINKRA_NODES[i]!;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 200 200"
      className={className}
    >
      {/* liens : s'illuminent en séquence (delay par nth-child) */}
      <g stroke="var(--gold-primary)" strokeWidth="0.8" fill="none">
        {ADINKRA_LINKS.map(([a, b], i) => (
          <line
            key={i}
            className="ln-motif-link"
            x1={at(a).x}
            y1={at(a).y}
            x2={at(b).x}
            y2={at(b).y}
          />
        ))}
      </g>
      {/* nœuds : cœur cerclé + croix tournante */}
      {ADINKRA_NODES.map((n, i) => (
        <g key={i} className="ln-motif-node">
          <circle cx={n.x} cy={n.y} r="8" fill="none" stroke="var(--gold-primary)" strokeWidth="1.3" />
          <path
            d={`M${n.x} ${n.y + 6} C${n.x - 5} ${n.y + 2} ${n.x - 9} ${n.y - 1} ${n.x - 9} ${n.y - 5} C${n.x - 9} ${n.y - 8} ${n.x - 7} ${n.y - 10} ${n.x - 4} ${n.y - 10} C${n.x - 2} ${n.y - 10} ${n.x - 1} ${n.y - 9} ${n.x} ${n.y - 7} C${n.x + 1} ${n.y - 9} ${n.x + 2} ${n.y - 10} ${n.x + 4} ${n.y - 10} C${n.x + 7} ${n.y - 10} ${n.x + 9} ${n.y - 8} ${n.x + 9} ${n.y - 5} C${n.x + 9} ${n.y - 1} ${n.x + 5} ${n.y + 2} ${n.x} ${n.y + 6} Z`}
            fill="var(--gold-primary)"
            opacity="0.7"
          />
          <path
            d={`M${n.x} ${n.y - 13} V${n.y - 11} M${n.x} ${n.y + 11} V${n.y + 13} M${n.x - 13} ${n.y} H${n.x - 11} M${n.x + 11} ${n.y} H${n.x + 13}`}
            stroke="var(--gold-primary)"
            strokeWidth="1"
            opacity="0.6"
          />
        </g>
      ))}
    </svg>
  );
}

/* ── 3. Halftone LED : points dégradés + halo ───────────────────────── */

/** Points dégradés à halo LED — affiche de rue moderne. */
export function HalftoneMotif({ className = "" }: { className?: string }) {
  // Rangées de points dont le rayon grandit puis décroît : le dégradé naît
  // de la géométrie, pas d'un gradient flou (rendu net à toute taille).
  const rows = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 16 }, (_, c) => {
      const wave = Math.sin((c / 15) * Math.PI) * Math.sin((r / 7) * Math.PI);
      return { x: c * 12.5 + 6, y: r * 25 + 12, r: 0.6 + wave * 3.2, wave };
    }),
  ).flat();
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 200 200"
      className={className}
    >
      {rows.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={Math.max(0.4, d.r)} fill="var(--gold-primary)" />
      ))}
      {/* halo LED : un point pulsant sur les pics de la trame */}
      {rows
        .filter((d) => d.wave > 0.6)
        .map((d, i) => (
          <circle
            key={`led${i}`}
            className="ln-motif-node"
            cx={d.x}
            cy={d.y}
            r={d.r * 2.6}
            fill="var(--gold-primary)"
          />
        ))}
    </svg>
  );
}

const MOTIFS = {
  kente: KenteMotif,
  adinkra: AdinkraMotif,
  halftone: HalftoneMotif,
} as const satisfies Record<MotifVariant, (p: { className?: string }) => unknown>;

/**
 * Motif posé en FOND d'un conteneur `relative`. Le contenu de la section
 * doit être dans un enfant `relative z-10` (le motif est en z-0 et
 * `pointer-events-none`). Opacité par défaut 5 % — jamais lisible sur du
 * texte, juste une texture.
 */
export function MotifBackdrop({
  variant,
  className = "",
  opacity = 0.05,
}: {
  variant: MotifVariant;
  className?: string;
  opacity?: number;
}) {
  const Motif = MOTIFS[variant];
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <Motif className="size-full" />
    </div>
  );
}

/* ── Grain or : voile de bruit fixé sur le fond de page ─────────────── */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * Grain or subtil (3 %) posé par-dessus le fond d'une page — purement
 * décoratif. Contrairement à l'ambiance fixe globale, il suit la page :
 * utile sur les grandes surfaces plates (bento, listes, empty states).
 */
export function GrainOverlay({ opacity = 0.03 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      style={{ backgroundImage: GRAIN, opacity, mixBlendMode: "overlay" }}
    />
  );
}
