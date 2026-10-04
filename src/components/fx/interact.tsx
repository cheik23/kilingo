import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════
   Interaction FX — 3D tilt cards, magnetic buttons, cursor glow.
   Ressorts framer-motion (stiffness 150 / damping 20), transform-only
   (zéro reflow). Touch et reduced-motion : effet totalement coupé,
   le composant reste un conteneur statique.
   ═══════════════════════════════════════════════════════════════════ */

const isReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isCoarse = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

/** Le tilt n'a de sens qu'à la souris : jamais sur tactile, jamais en reduced-motion. */
function canTilt(): boolean {
  return !isReduced() && !isCoarse();
}

/**
 * Tilt 3D sur hover : rotateX/rotateY ±6° max, perspective 900px,
 * ressort 150/20, plus une légère élévation Z sur l'ombre.
 */
export function TiltCard({
  children,
  className = "",
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const update = () => setEnabled(canTilt());
    update();
    const query = window.matchMedia("(pointer: coarse)");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const rotateXValue = useMotionValue(0);
  const rotateYValue = useMotionValue(0);
  const springX = useSpring(rotateXValue, { stiffness: 150, damping: 20, mass: 0.4 });
  const springY = useSpring(rotateYValue, { stiffness: 150, damping: 20, mass: 0.4 });
  const transform = useTransform(
    [springX, springY],
    ([x, y]: number[]) => `perspective(900px) rotateX(${x}deg) rotateY(${y}deg)`,
  );

  const onMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      rotateXValue.set(-py * max * 2);
      rotateYValue.set(px * max * 2);
    },
    [enabled, max, rotateXValue, rotateYValue],
  );

  const onLeave = useCallback(() => {
    setHovering(false);
    rotateXValue.set(0);
    rotateYValue.set(0);
  }, [rotateXValue, rotateYValue]);

  if (!enabled) {
    return <div className={`ln-tilt ${className}`}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{ transform, transformStyle: "preserve-3d" }}
      className={`ln-tilt ${hovering ? "ln-tilt-hover" : ""} ${className}`}
      onMouseMove={onMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={onLeave}
    >
      <span aria-hidden="true" className="ln-shine" />
      {children}
    </motion.div>
  );
}

/**
 * Bouton magnétique : translation max 4px vers le curseur + scale 1.02.
 * Coupe sur tactile et reduced-motion.
 */
export function MagneticButton({
  children,
  className = "",
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 20, mass: 0.3 });
  const springY = useSpring(y, { stiffness: 150, damping: 20, mass: 0.3 });
  const [enabled, setEnabled] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const update = () => setEnabled(canTilt());
    update();
    const query = window.matchMedia("(pointer: coarse)");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const handleMove = (event: globalThis.MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      x.set(Math.max(-4, Math.min(4, (event.clientX - cx) * 0.15)));
      y.set(Math.max(-4, Math.min(4, (event.clientY - cy) * 0.15)));
    };
    const reset = () => {
      x.set(0);
      y.set(0);
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", reset);
      cancelAnimationFrame(raf.current);
    };
  }, [enabled, x, y]);

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={enabled ? { x: springX, y: springY } : undefined}
      whileHover={enabled ? { scale: 1.02 } : undefined}
      whileTap={enabled ? { scale: 0.97 } : undefined}
      className={`ln-magnetic relative overflow-hidden ${className}`}
    >
      <span aria-hidden="true" className="ln-shine" />
      {children}
    </motion.button>
  );
}

/**
 * Halo or de 300px qui suit le curseur avec lissage.
 * pointer-events: none ; désactivé sur tactile et reduced-motion.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarse || reduced) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let x = tx;
    let y = ty;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.transform = `translate3d(${x - 150}px, ${y - 150}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[1] size-[300px] rounded-full"
      style={{
        background:
          "radial-gradient(circle, rgba(212,165,116,0.06) 0%, rgba(212,165,116,0) 70%)",
        willChange: "transform",
      }}
    />
  );
}
