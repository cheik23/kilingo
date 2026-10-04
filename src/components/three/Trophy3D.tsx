import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { canRender3D, supportsReducedMotion } from "@/lib/perf";

/* ═══════════════════════════════════════════════════════════════════════
   TROPHÉE 3D — DÉBLOCAGE D'UN SUCCÈS (MODULE 4)

   Remplace l'emoji 🏆 2D du modal de réussite par une vraie scène :
     · trophée low-poly or qui fait un tour complet en 2 s ;
     · 100 confettis or terre / olive qui tombent en boucle ;
     · flash doré plein écran 400 ms (0 → 0.3 → 0), posé en `fixed`.

   Le composant reste UN overlay `pointer-events-none` : il ne peut jamais
   bloquer un clic. Reduced-motion ou device incapable ⇒ `fallback`
   (l'emoji + les confettis canvas historiques).
   ═══════════════════════════════════════════════════════════════════════ */

import { useThemeColors } from "@/hooks/useThemeColors";

const CONFETTI = 100;

function Confetti() {
  const { gold: GOLD, accent: OLIVE } = useThemeColors();
  const points = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const positions = new Float32Array(CONFETTI * 3);
    const colors = new Float32Array(CONFETTI * 3);
    const speeds = new Float32Array(CONFETTI);
    const color = new THREE.Color();
    for (let i = 0; i < CONFETTI; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * 2.6;
      positions[i * 3 + 1] = 2 + Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 1.2;
      speeds[i] = 0.9 + Math.random() * 1.4;
      color.set(Math.random() < 0.3 ? OLIVE : GOLD);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    return { positions, colors, speeds };
  }, [GOLD, OLIVE]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    return geo;
  }, [data]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < CONFETTI; i++) {
      const o = i * 3;
      data.positions[o + 1] -= data.speeds[i] * dt;
      data.positions[o] += Math.sin(data.positions[o + 1] * 2 + i) * dt * 0.4;
      // Recyclage : le confetti qui sort par le bas revient en haut.
      if (data.positions[o + 1] < -3) data.positions[o + 1] = 3.5;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.1}
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </points>
  );
}

function Trophy() {
  const { gold: GOLD, goldDeep: GOLD_DEEP } = useThemeColors();
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);

  const cup = useMemo(() => new THREE.CylinderGeometry(0.5, 0.22, 0.62, 8, 1, true), []);
  const stem = useMemo(() => new THREE.CylinderGeometry(0.1, 0.12, 0.5, 6), []);
  const base = useMemo(() => new THREE.CylinderGeometry(0.62, 0.78, 0.26, 6), []);
  const handle = useMemo(() => new THREE.TorusGeometry(0.26, 0.055, 6, 10, Math.PI), []);

  useEffect(
    () => () => {
      cup.dispose();
      stem.dispose();
      base.dispose();
      handle.dispose();
    },
    [cup, stem, base, handle],
  );

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    // Un tour complet en 2 s, puis on continue doucement.
    spin.current += Math.min(delta, 0.05) * Math.PI;
    node.rotation.y = spin.current;
    node.position.y = Math.sin(spin.current * 2) * 0.06;
  });

  return (
    <group ref={group} scale={1.1}>
      <mesh geometry={cup} position={[0, 0.35, 0]}>
        <meshBasicMaterial color={GOLD} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={stem} position={[0, -0.2, 0]}>
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <mesh geometry={base} position={[0, -0.55, 0]}>
        <meshBasicMaterial color={GOLD_DEEP} />
      </mesh>
      <mesh geometry={handle} position={[0.48, 0.42, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <mesh geometry={handle} position={[-0.48, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <Confetti />
      <OrbitSparkles />
      <FakeReflection />
    </group>
  );
}

/* ── Sparkles orbitaux ─────────────────────────────────────────────────
   Des points qui tournent autour du trophée sur deux orbites de rayons et
   de vitesses différents, en s'éloignant en hauteur. Un seul `Points` :
   pas un mesh par étincelle. */
function OrbitSparkles() {
  const points = useRef<THREE.Points>(null);
  const COUNT = 28;

  const { geometry, material, base, phase } = useMemo(() => {
    const base = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      // Deux couronnes : une proche du calice, une plus large et basse.
      const radius = i % 2 === 0 ? 0.72 + Math.random() * 0.18 : 1.15 + Math.random() * 0.25;
      base[i * 3] = Math.cos(angle) * radius;
      base[i * 3 + 1] = (i % 2 === 0 ? 0.3 : -0.35) + Math.random() * 0.2;
      base[i * 3 + 2] = Math.sin(angle) * radius;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    const material = new THREE.PointsMaterial({
      size: 0.075,
      color: "#FFF3C4",
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return { geometry, material, base, phase };
  }, []);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((state) => {
    const node = points.current;
    if (!node) return;
    const t = state.clock.elapsedTime;
    const attr = node.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      // Rotation différentielle : la couronne extérieure tourne plus vite,
      // ce qui évite l'alignement des points entre deux frames.
      const speed = i % 2 === 0 ? 0.9 : -0.55;
      const angle = phase[i] + t * speed;
      const radius = Math.hypot(base[i * 3], base[i * 3 + 2]);
      // Scintillement vertical : chaque étincelle monte et redescend.
      const bob = Math.sin(t * 2.2 + phase[i]) * 0.12;
      attr.array[i * 3] = Math.cos(angle) * radius;
      attr.array[i * 3 + 1] = base[i * 3 + 1] + bob;
      attr.array[i * 3 + 2] = Math.sin(angle) * radius;
    }
    attr.needsUpdate = true;
    node.rotation.y = t * 0.15;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/* ── Réflexion « fake » ────────────────────────────────────────────────
   Pas de reflectionMap, pas de rendu miroir (coûteux et fragile) : un
   simple plan horizontal, additif, avec un dégradé en texture canvas qui
   s'estompe vers l'extérieur. À cette échelle le cerveau lit « le trophée
   est posé sur une surface polie » — l'illusion est complète. */
function FakeReflection() {
  const plane = useMemo(() => new THREE.PlaneGeometry(2.2, 1.5), []);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(64, 40, 4, 64, 40, 64);
    grad.addColorStop(0, "rgba(212,165,116,0.75)");
    grad.addColorStop(0.45, "rgba(212,165,116,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);

  useEffect(() => () => { plane.dispose(); texture.dispose(); }, [plane, texture]);

  return (
    <mesh geometry={plane} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.92, 0]}>
      <meshBasicMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

export function Trophy3D({ fallback }: { fallback: ReactNode }) {
  if (!canRender3D()) return <>{fallback}</>;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[96] flex items-center justify-center"
    >
      {/* Flash doré plein écran — 400 ms, une seule fois (montage). */}
      <style>{`@keyframes ln-trophy-flash{0%{opacity:0}35%{opacity:.3}100%{opacity:0}}`}</style>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(212,165,116,0.55) 0%, rgba(212,165,116,0.12) 45%, transparent 70%)",
          animation: supportsReducedMotion() ? "none" : "ln-trophy-flash 400ms ease-out both",
        }}
      />
      <div className="relative size-56">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 4.2], fov: 42 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <Trophy />
        </Canvas>
      </div>
    </div>
  );
}

export default Trophy3D;
