import { Fragment, useEffect, useMemo, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   Cinematic text FX — pure React, no dependencies, GPU-safe.
   ═══════════════════════════════════════════════════════════════════ */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&@$§*+=/\\<>";
const GLYPH_WINDOW = 3; // letters resolving per animation frame step

/**
 * Decode/scramble effect: letters cycle through random glyphs, then freeze
 * left-to-right. Runs once per `text` change (~600 ms). Disabled when the
 * user prefers reduced motion.
 */
export function useScramble(text: string, durationMs = 600): string {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(text);
      return;
    }

    const total = text.length;
    let raf = 0;
    const start = performance.now();
    frame.current = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const resolved = Math.floor(progress * total);

      if (progress >= 1) {
        setDisplay(text);
        return;
      }

      const out = Array.from(text, (ch, i) => {
        if (i < resolved || ch === " " || ch === "\n") return ch;
        // Deterministic pseudo-random per (frame, index) — no re-render storms.
        const seed = (frame.current * 31 + i * 17) % GLYPHS.length;
        return GLYPHS[seed];
      }).join("");

      frame.current += 1;
      setDisplay(out);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, durationMs]);

  return display;
}

/** Section heading with a one-shot decode/scramble reveal on mount. */
export function ScrambleHeading({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const display = useScramble(text);
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

/**
 * Gold shimmer sweep for display titles ONLY (never body copy):
 * linear-gradient(110deg, gold → near-white → gold), background-size 200%,
 * background-clip: text, sweeping 3.5 s linear infinite.
 */
export function ShimmerTitle({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <span className={`ln-shimmer-text ${className}`}>{children}</span>
  );
}

/** Split text into letter spans for staggered reveals.
 *
 *  Les lettres sont groupées PAR MOT (`ln-word`, `display: inline-block`).
 *  Sans ce groupe, chaque lettre était une boîte inline-block et le
 *  navigateur pouvait couper n'importe où : à 935 px, le titre du hero
 *  s'affichait « Maîtrise l'argot a / fricain en 7 jours ». Un bloc-mot
 *  se dimensionne en `max-content` : il reste d'un seul tenant tant qu'il
 *  tient sur la ligne, et ne se coupe à l'intérieur que s'il est seul plus
 *  large que la ligne (utile pour les titres zh / ja, sans espaces).
 *  L'espace est rendu HORS du bloc : dedans, il serait rogné en fin de
 *  ligne et deux mots se colleraient. */
function Letters({ text }: { text: string }) {
  const words = text.split(" ");
  let index = 0;
  return (
    <>
      {words.map((word, w) => (
        <Fragment key={w}>
          <span className="ln-word">
            {Array.from(word).map((ch) => {
              const i = index++;
              return (
                <span
                  key={i}
                  className="ln-letter"
                  style={{ ["--ln-i" as string]: i }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
          {w < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Headline entrance: letters flip up from rotateX(90deg)+opacity 0 with a
 * 40 ms stagger (perspective on the parent, transform-origin bottom).
 */
export function RevealTitle({
  text,
  className = "",
  shimmer = false,
}: {
  text: string;
  className?: string;
  shimmer?: boolean;
}) {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  return (
    <span
      className={`ln-reveal-title ${className}`}
      aria-label={text}
      style={{ ["--ln-stagger" as string]: "40ms" }}
    >
      <span aria-hidden="true" className={shimmer ? "ln-shimmer-text" : undefined}>
        {reduced ? (
          text
        ) : (
          <Letters text={text} />
        )}
      </span>
    </span>
  );
}
