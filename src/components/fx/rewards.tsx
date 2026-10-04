import { useEffect, useMemo, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   Micro-rewards — gold particle bursts and rolling counters.
   Transform/opacity only; particles are removed after their animation.
   ═══════════════════════════════════════════════════════════════════ */

type Particle = {
  angle: number;
  distance: number;
  size: number;
  duration: number;
};

function randomParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    angle: Math.random() * Math.PI * 2,
    distance: 28 + Math.random() * 42, // 28–70 px
    size: 2 + Math.random() * 3, // 2–5 px
    duration: 550 + Math.random() * 250, // 550–800 ms
  }));
}

/**
 * One-shot gold burst. Increment `trigger` to fire (0 = idle). Spans are
 * absolutely positioned around the children and cleaned up automatically.
 */
export function GoldBurst({
  children,
  trigger,
  count = 14,
  className = "",
}: {
  children: React.ReactNode;
  trigger: number;
  count?: number;
  className?: string;
}) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const particles = useMemo(
    () => (reduced ? [] : randomParticles(count)),
    // Re-randomize on every trigger change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger, count, reduced],
  );

  if (reduced) return <>{children}</>;

  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      {trigger > 0 &&
        particles.map((p, i) => (
          <span
            key={`${trigger}-${i}`}
            className="ln-burst-particle"
            style={{
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}ms`,
              ["--ln-px" as string]: `${Math.cos(p.angle) * p.distance}px`,
              ["--ln-py" as string]: `${Math.sin(p.angle) * p.distance}px`,
            }}
          />
        ))}
    </span>
  );
}

/**
 * LOT H — compteur « count-up » : le nombre monte jusqu'à sa valeur en
 * 600 ms (assez court pour ne jamais retarder la lecture, assez long pour
 * que le gain soit vu), séparateurs de milliers et suffixe optionnel. Même
 * garde que le reste du module : mouvement réduit ⇒ valeur finale immédiate.
 */
export function CountUp({
  value,
  duration = 600,
  suffix = "",
  prefix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced || value === display) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const startValue = from.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startValue + (value - startValue) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduced]);

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {display.toLocaleString("fr-FR")}
      {suffix}
    </span>
  );
}

/**
 * LOT H — confettis or/noir (80 pièces par défaut), tirés une seule fois au
 * montage, purement décoratifs. `aria-hidden` + `pointer-events: none` :
 * jamais dans l'arbre d'accessibilité, jamais cliquables.
 */
export function Confetti({
  pieces = 80,
  className = "",
}: {
  pieces?: number;
  className?: string;
}) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const parts = useMemo(() => {
    if (reduced) return [];
    return Array.from({ length: pieces }, (_, i) => {
      const gold = i % 3 !== 0;
      return {
        left: Math.random() * 100, // % de la largeur
        delay: Math.random() * 0.5, // s
        duration: 1.6 + Math.random() * 1.4, // s
        drift: -60 + Math.random() * 120, // px
        spin: 180 + Math.random() * 540, // deg
        size: 5 + Math.random() * 6, // px
        ratio: Math.random() > 0.5 ? 1 : 0.45, // carré ou confetti
        color: gold ? "var(--gold-primary)" : "#f7f3e8",
      };
    });
  }, [pieces, reduced]);

  if (reduced || parts.length === 0) return null;

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {parts.map((p, i) => (
        <span
          key={i}
          className="ln-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * p.ratio,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--ln-confetti-x" as string]: `${p.drift}px`,
            ["--ln-confetti-spin" as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Rolling number: interpolates to `value` over 400 ms with rAF easing,
 * without reflowing layout (tabular-nums keeps width stable).
 */
export function RollingCounter({
  value,
  className = "",
  suffix = "",
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced || value === display) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const startValue = from.current;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 400);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(startValue + (value - startValue) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // `display` intentionally excluded — the animation drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  return (
    <span className={`tabular-nums ${className}`}>
      {display}
      {suffix}
    </span>
  );
}
