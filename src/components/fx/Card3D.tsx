import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { usePerfMode } from "@/lib/perf";

/* ═══════════════════════════════════════════════════════════════════════
   CARTES 3D — PROFONDEUR RÉELLE (MODULE 2)

   Un tilt seul donne l'illusion ; ici les enfants sont SURÉLEVÉS dans un
   vrai espace 3D. La carte penche (rotateX/rotateY, ressort 200) et ses
   enfants avancent vers le lecteur (translateZ) : le titre reste à
   l'arrière-plan pendant que l'image ou le badge vient au premier plan.

   Profondeurs : le contenu se déclare avec `data-card3d-depth` —
   20 · 25 · 30 · 40 · 50 · 60 px. Pas de wrapper à ajouter, donc le
   balisage existant reste lisible.

   Trois replis, dans cet ordre :
     1. `prefers-reduced-motion` ⇒ carte plate, enfants à plat ;
     2. pointeur grossier (tactile) ⇒ pas de tilt, mais la profondeur
        subsiste (elle ne dépend pas du survol) ;
     3. mode `lite` (watchdog FPS) ⇒ simple élévation, sans translateZ.
   ═══════════════════════════════════════════════════════════════════════ */

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  );
}

export function Card3D({
  children,
  className = "",
  /** Amplitude maximale du basculement, en degrés. */
  max = 8,
  /** Désactive la profondeur (carte pleine largeur, liste dense…). */
  depth = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  depth?: boolean;
}) {
  const perf = usePerfMode();
  const [hovered, setHovered] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tiltEnabled = !reduced && !isCoarsePointer() && perf === "full";
  const depthEnabled = depth && !reduced && perf === "full";

  const rotateXValue = useMotionValue(0);
  const rotateYValue = useMotionValue(0);
  const scaleValue = useMotionValue(1);

  const springConfig = { stiffness: 200, damping: 22, mass: 0.35 } as const;
  const springX = useSpring(rotateXValue, springConfig);
  const springY = useSpring(rotateYValue, springConfig);
  const springScale = useSpring(scaleValue, springConfig);

  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(50);

  const transform = useTransform(
    [springX, springY, springScale],
    ([x, y, s]: number[]) =>
      `perspective(1200px) rotateX(${x}deg) rotateY(${y}deg) scale(${s})`,
  );

  // Le reflet suit le curseur ; 15 % d'opacité : perceptible, jamais laqué.
  const shine = useMotionTemplate`radial-gradient(360px circle at ${pointerX}% ${pointerY}%, rgba(212,165,116,0.15), transparent 70%)`;

  const onMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!tiltEnabled) return;
      const rect = hostRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      rotateXValue.set(-(py - 0.5) * max * 2);
      rotateYValue.set((px - 0.5) * max * 2);
      pointerX.set(px * 100);
      pointerY.set(py * 100);
    },
    [max, pointerX, pointerY, rotateXValue, rotateYValue, tiltEnabled],
  );

  const onLeave = useCallback(() => {
    setHovered(false);
    rotateXValue.set(0);
    rotateYValue.set(0);
    scaleValue.set(1);
    pointerX.set(50);
    pointerY.set(50);
  }, [pointerX, pointerY, rotateXValue, rotateYValue, scaleValue]);

  const onEnter = useCallback(() => {
    setHovered(true);
    if (tiltEnabled) scaleValue.set(1.03);
  }, [scaleValue, tiltEnabled]);

  // Repli total : ni transform, ni profondeur, ni reflet.
  if (reduced || perf === "lite") {
    return (
      <div className={`ln-card3d ln-card3d-off ${className}`}>{children}</div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={`ln-card3d ${depthEnabled ? "ln-card3d-depth" : "ln-card3d-off"} ${className}`}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div
        style={{ transform, transformStyle: "preserve-3d" }}
        className={`relative h-full ${hovered ? "ln-card3d-lit" : ""}`}
      >
        {children}
        <motion.span
          aria-hidden="true"
          className="ln-card3d-shine"
          style={{ backgroundImage: shine }}
        />
      </motion.div>
    </div>
  );
}

export default Card3D;
