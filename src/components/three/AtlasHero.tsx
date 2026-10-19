import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { canRender3D, startFpsWatchdog, usePerfMode } from "@/lib/perf";
import { StaticHero } from "./StaticHero";
/* ═══════════════════════════════════════════════════════════════════
   ATLAS HERO — wrapper du monde 3D

   Le chunk three.js n'est téléchargé que si la scène est réellement
   retenue. Quatre raisons de ne pas la monter, héritées de lib/perf :
     · prefers-reduced-motion → jamais de 3D (canRender3D) ;
     · device low-end ou pas de WebGL → repli statique ;
     · mode lite (watchdog FPS < 30 pendant 3 s → usePerfMode) ;
   En cas de sortie du viewport, la scène est démontée (le GPU se
   repose). La landing, elle, ne dépend JAMAIS du hero : si la scène
   échoue, le contenu HTML reste entier.

   `scrollProgress` est une ref partagée { current: 0..1 } écrite par
   la landing et lue à chaque frame par CameraRig — zéro rerender.
   ═══════════════════════════════════════════════════════════════════ */

const AtlasScene = lazy(() =>
  import("./AtlasScene").then((m) => ({ default: m.AtlasScene })),
);

export function AtlasHero({
  className = "",
  scrollProgress,
}: {
  className?: string;
  scrollProgress: { current: number };
}) {
  const perf = usePerfMode();
  const containerRef = useRef<HTMLDivElement>(null);

  /* La garde WebGL est lue UNE fois (useMemo) : `supportsWebGL()` crée
     un canvas provisoire, on ne le refait pas à chaque rendu. L'app
     est client-side : le canvas peut être créé au premier rendu. */
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

  /* Repli : reduced-motion, low-end, pas de WebGL, ou mode lite du
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
          <AtlasScene
            scrollProgress={scrollProgress}
            frameloop={inView ? "always" : "demand"}
          />
        )}
      </Suspense>
    </div>
  );
}

export default AtlasHero;
