import { useEffect, useMemo, useState } from "react";

/**
 * Cinematic "Noir & Or" ambience, mounted once at the app root:
 *  - 3 drifting radial gold halos (25–35 s keyframes, translate + scale)
 *  - ~20 floating embers (2–4 px gold dots rising with random delays)
 *  - SVG-noise film grain (feTurbulence data-URI, opacity 0.04)
 *  - edge vignette
 * Entirely `pointer-events-none`, hidden on coarse pointers and when the user
 * prefers reduced motion. Only transform/opacity are animated (GPU-only).
 */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const HALOS = [
  {
    className: "ln-halo ln-halo-a",
    style: {
      top: "-12%",
      left: "55%",
      width: "48rem",
      height: "48rem",
      background:
        "radial-gradient(circle, rgba(212,165,116,0.09) 0%, rgba(212,165,116,0) 62%)",
    } as React.CSSProperties,
  },
  {
    className: "ln-halo ln-halo-b",
    style: {
      top: "38%",
      left: "-18%",
      width: "38rem",
      height: "38rem",
      background:
        "radial-gradient(circle, rgba(212,165,116,0.07) 0%, rgba(212,165,116,0) 60%)",
    } as React.CSSProperties,
  },
  {
    className: "ln-halo ln-halo-c",
    style: {
      bottom: "-22%",
      right: "-14%",
      width: "44rem",
      height: "44rem",
      background:
        "radial-gradient(circle, rgba(232,207,174,0.08) 0%, rgba(232,207,174,0) 62%)",
    } as React.CSSProperties,
  },
];

type Ember = {
  left: string;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
};

function useEmbers(count = 20): Ember[] {
  return useMemo<Ember[]>(() => {
    return Array.from({ length: count }, () => ({
      left: `${Math.random() * 100}%`,
      size: 2 + Math.random() * 2, // 2–4 px
      opacity: 0.25 + Math.random() * 0.55,
      duration: 14 + Math.random() * 18, // 14–32 s to cross the screen
      delay: -Math.random() * 30, // negative → already mid-flight on mount
      drift: (Math.random() - 0.5) * 120, // horizontal sway in px
    }));
  }, [count]);
}

export function NoirAmbience() {
  const [enabled, setEnabled] = useState(false);
  const embers = useEmbers(20);

  // Only activate on fine pointers without reduced motion — decorative only.
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!coarse && !reduced) setEnabled(true);
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* drifting halos */}
      {HALOS.map((h, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-[80px] ${h.className}`}
          style={h.style}
        />
      ))}

      {/* floating embers */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="ln-ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            opacity: e.opacity,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
            ["--ln-drift" as string]: `${e.drift}px`,
          }}
        />
      ))}

      {/* film grain */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRAIN, opacity: 0.04 }}
      />

      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,0.42) 100%)",
        }}
      />
    </div>
  );
}
