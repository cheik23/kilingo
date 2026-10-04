import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { usePerfMode } from "@/lib/perf";

/* ═══════════════════════════════════════════════════════════════════════
   3D LIÉ AU SCROLL (MODULE 3)

   Une section qui arrive par le bas se redresse en pivotant de 5° vers 0°
   tout en remontant de -100px : elle « sort de l'écran » pour se poser
   à plat dans la page. L'effet est purely décoratif — le contenu reste
   entièrement lisible et cliquable, et le texte n'est jamais incliné plus
   de 5° (au-delà, la lecture se dégrade).

   Repli : reduced-motion ou mode `lite` ⇒ simple rendu statique.
   ═══════════════════════════════════════════════════════════════════════ */

export function Scroll3D({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const perf = usePerfMode();
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [5, 0]);
  const z = useTransform(scrollYProgress, [0, 1], [-100, 0]);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const enabled = !reduced && perf === "full";

  return (
    <motion.div
      ref={ref}
      className={className}
      style={
        enabled
          ? {
              rotateX,
              z,
              transformPerspective: 1200,
              transformStyle: "preserve-3d",
            }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}

export default Scroll3D;
