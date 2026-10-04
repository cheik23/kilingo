import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { shouldUse3D, supportsReducedMotion, usePerfMode } from "@/lib/perf";

/* ═══════════════════════════════════════════════════════════════════════
   MONTAGE DU FOND « RÉSEAU DE PARTICULES » (MODULE 1)

   Ce fichier n'importe JAMAIS three.js : la scène est un chunk séparé
   chargé à la demande, une fois le premier peint terminé. Conséquences
   garanties :
     • three.js ne pèse pas sur le chargement initial ;
     • le fond n'apparaît jamais avant d'être prêt (rien ne « saute ») ;
     • si le 3D est impossible — reduced-motion, device low-end, pas de
       WebGL, ou mode dégradé après le watchdog FPS — on rend un dégradé
       animé aux MÊMES teintes : la substitution est invisible.

   La scène est en pause dès que l'onglet passe en arrière-plan
   (`frameloop="demand"`) : un fond fixe n'a rien à faire hors écran.
   ═══════════════════════════════════════════════════════════════════════ */

const ParticleNetwork = lazy(() => import("@/components/three/ParticleNetwork"));

type IdleHandle = { kind: "idle" | "timeout"; id: number };

function scheduleIdle(callback: () => void): IdleHandle {
  const raf = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof raf.requestIdleCallback === "function") {
    return { kind: "idle", id: raf.requestIdleCallback(callback, { timeout: 2000 }) };
  }
  return { kind: "timeout", id: window.setTimeout(callback, 400) };
}

function cancelIdle(handle: IdleHandle) {
  const raf = window as Window & { cancelIdleCallback?: (id: number) => void };
  if (handle.kind === "idle") raf.cancelIdleCallback?.(handle.id);
  else window.clearTimeout(handle.id);
}

export function NetworkBackdrop({ className = "" }: { className?: string }) {
  // `usePerfMode` : le passage en `lite` fait basculer sur le repli CSS
  // sans qu'aucun composant ait à deviner si l'app rame.
  const perf = usePerfMode();
  const capable = perf === "full" && shouldUse3D();
  const reduced = supportsReducedMotion();

  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // 1. Chargement différé : jamais avant le premier peint.
  useEffect(() => {
    if (!capable || ready) return;
    const handle = scheduleIdle(() => setReady(true));
    return () => cancelIdle(handle);
  }, [capable, ready]);

  // 2. Pause hors écran / onglet en arrière-plan.
  useEffect(() => {
    if (!ready) return;
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    setVisible(!document.hidden);

    const node = hostRef.current;
    let observer: IntersectionObserver | null = null;
    if (node && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => setVisible(entry.isIntersecting && !document.hidden),
        { threshold: 0 },
      );
      observer.observe(node);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, [ready]);

  if (!capable) {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-0 ${className}`}
      >
        <div className="ln-network-fallback absolute inset-0" />
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 opacity-40 ${className}`}
    >
      {ready && (
        <Suspense fallback={null}>
          <ParticleNetwork className="size-full" visible={visible} animate={!reduced} />
        </Suspense>
      )}
    </div>
  );
}

export default NetworkBackdrop;
