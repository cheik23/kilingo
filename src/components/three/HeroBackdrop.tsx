import { Suspense, lazy, useEffect, useState } from "react";
import { StaticHero } from "./StaticHero";
import { canRender3D, usePerfMode } from "@/lib/perf";

/* ═══════════════════════════════════════════════════════════════════════
   FOND DU HERO — globe 3D ou repli statique

   Le chunk three.js n'est téléchargé qu'ici, et seulement si la scène 3D
   est réellement retenue. Trois raisons de ne pas la monter, toutes
   partagées avec le reste de l'app (voir lib/perf) :
     · `prefers-reduced-motion` ;
     · device low-end (`hardwareConcurrency <= 4`) ou pas de WebGL ;
     · mode `lite` déclenché par le watchdog FPS après 3 s sous 30 FPS.

   Un échec WebGL à l'exécution bascule aussi sur le repli — le repos de
   l'app ne doit jamais dépendre du hero.
   ═══════════════════════════════════════════════════════════════════════ */

const GlobeHero = lazy(() =>
  import("./GlobeHero").then((m) => ({ default: m.GlobeHero })),
);

export function HeroBackdrop({ className = "" }: { className?: string }) {
  const perf = usePerfMode();
  // `mounted` évite de créer un canvas avant le premier rendu côté client.
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setMounted(true), []);

  const globe = mounted && !failed && perf === "full" && canRender3D();

  if (globe) {
    return (
      <div className={className}>
        <Suspense fallback={<StaticHero />}>
          <GlobeHero onDegrade={() => setFailed(true)} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={className}>
      <StaticHero />
    </div>
  );
}

export default HeroBackdrop;
