import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════
   REVEAL — apparition au scroll (opacity 0 → 1, y 24px → 0).
   `once: true` : l'élément ne se rejoue pas à chaque aller-retour.
   Reduced-motion ou IntersectionObserver indisponible → rendu direct,
   donc le contenu reste toujours visible et lisible.
   ═══════════════════════════════════════════════════════════════════ */

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setShown(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        shown
          ? { opacity: 1, y: 0, transition: { duration: 0.4, delay } }
          : { opacity: 0, y }
      }
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
