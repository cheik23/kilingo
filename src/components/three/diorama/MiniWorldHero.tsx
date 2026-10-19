import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { canRender3D, startFpsWatchdog, usePerfMode } from "@/lib/perf";
import { StaticHero } from "../StaticHero";
import { type WorldCode } from "./worlds";

/* ═══════════════════════════════════════════════════════════════════
   MINI WORLD HERO — wrapper du diorama 3D

   Le chunk three.js n'est téléchargé que si le diorama est réel.
   Quatre raisons de ne pas le monter (héritées de lib/perf) :
     · prefers-reduced-motion → jamais de 3D ;
     · device low-end ou pas de WebGL → repli statique ;
     · mode lite (watchdog FPS) ;
     · hors viewport → scène démontée, le GPU se repose.

   La landing ne dépend JAMAIS du hero : si la scène échoue, le contenu
   HTML reste entier (repli CSS immédiat).
   ═══════════════════════════════════════════════════════════════════ */

const DioramaScene = lazy(() =>
  import("./DioramaScene").then((m) => ({ default: m.DioramaScene })),
);

export function MiniWorldHero({
  className = "",
  scrollProgress,
  world,
  onSelect,
}: {
  className?: string;
  /** Ref partagée 0→1, écrite par le scroll de la Landing. */
  scrollProgress: { current: number };
  /** Prototype affiché (fr · zh · sw). */
  world: WorldCode;
  /** Clic sur un monument (pédagogie : mener vers la langue réelle). */
  onSelect: (id: string) => void;
}) {
  const perf = usePerfMode();
  const containerRef = useRef<HTMLDivElement>(null);

  const can3d = useMemo(() => canRender3D(), []);
  const [inView, setInView] = useState(true);

  useEffect(() => startFpsWatchdog(), []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Repli : reduced-motion, low-end, pas de WebGL, mode lite du
     watchdog FPS → le rendu statique reprend la main. */
  if (perf !== "full" || !can3d) {
    return (
      <div ref={containerRef} className={className}>
        <StaticHero />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className} data-scene={inView ? "live" : "paused"}>
      <Suspense fallback={<StaticHero />}>
        {inView && (
          <DioramaScene
            world={world}
            onSelect={onSelect}
            scrollProgress={scrollProgress}
            frameloop={inView ? "always" : "demand"}
          />
        )}
      </Suspense>
    </div>
  );
}

export default MiniWorldHero;
