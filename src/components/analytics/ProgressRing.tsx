import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   ANNEAU DE PROGRESSION — cercle SVG, animé par transition CSS.

   `value` est une fraction 0..1 (jamais un pourcentage : les appelants
   passent `completed / total`, donc aucun mélange d'unités possible).
   L'anneau porte un rôle `img` et un libellé complet pour les lecteurs
   d'écran ; le pourcentage affiché au centre est décoratif (aria-hidden)
   puisqu'il est déjà dans le libellé.
   ═══════════════════════════════════════════════════════════════════════ */

export function ProgressRing({
  value,
  size = 132,
  thickness = 11,
  label,
  caption,
  className,
}: {
  value: number;
  size?: number;
  thickness?: number;
  /** Texte au centre de l'anneau (ex. « 42 % »). */
  label?: string;
  /** Ligne sous le libellé (ex. « 63 / 150 »). */
  caption?: string;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const percent = Math.round(clamped * 100);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${percent} %${label ? ` — ${label}` : ""}${caption ? ` (${caption})` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-white/10"
        />
        <defs>
          <linearGradient id={`ln-ring-${size}-${thickness}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-deep)" />
            <stop offset="100%" stopColor="var(--gold-primary)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          stroke={`url(#ln-ring-${size}-${thickness})`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>

      <span
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden
      >
        <span className="font-display text-2xl font-bold text-ink tabular-nums">
          {label ?? `${percent} %`}
        </span>
        {caption && <span className="mt-0.5 font-mono text-[0.625rem] text-ink-3">{caption}</span>}
      </span>
    </div>
  );
}

export default ProgressRing;
