import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { canRender3D, supportsReducedMotion } from "@/lib/perf";

/* ═══════════════════════════════════════════════════════════════════════
   GELER LE STREAK — CRISTAUX DE GLACE (v2)

   Quand on dépense un gel, la série est sauvée. L'idée : faire pousser
   des cristaux de glace autour de la pilule de streak, avec un souffle
   froid qui monte. Court, silencieux, sans stole — c'est une récompense
   d'appoint, pas un moment de cinéma.

   Trois primitives seulement (cônes tronqués), 6 shards : le « snowflake »
   grossier mais lisible. Ils poussent par un ressort sur l'échelle Y
   (stiffness 140, damping 12), pas par un lerp linéaire — la poussée a un
   petit dépassement, c'est ce qui la rend vivante.

   Le souffle froid = un seul `Points` bleu, 30 particules qui montent en
   boucle. Reduced-motion ou device incapable ⇒ `fallback`.
   ═══════════════════════════════════════════════════════════════════════ */

const ICE = "#BEE3F7";
const ICE_DEEP = "#6FB3D9";
const COLD = "#9FD8FF";
const SHARDS = 6;
const BREATH = 30;

function Shards() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const velocities = useRef<number[]>(new Array(SHARDS).fill(0));

  const geometry = useMemo(
    () => new THREE.ConeGeometry(0.13, 0.72, 5),
    [],
  );
  const materials = useMemo(
    () =>
      Array.from({ length: SHARDS }, (_, i) =>
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? ICE : ICE_DEEP,
          metalness: 0.1,
          roughness: 0.12,
          transparent: true,
          opacity: 0.88,
          emissive: new THREE.Color(COLD),
          emissiveIntensity: 0.18,
        }),
      ),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [geometry, materials],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = performance.now() / 1000;
    const k = 140;
    const d = 12;
    for (let i = 0; i < SHARDS; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      // Cible 1 = grown. Le ressort dépasse légèrement puis se pose.
      const accel = (1 - mesh.scale.y) * k - velocities.current[i] * d;
      velocities.current[i] += accel * dt;
      mesh.scale.y = Math.max(0.01, mesh.scale.y + velocities.current[i] * dt);
      // Légère respiration une fois grown.
      mesh.rotation.y = t * 0.4 + i;
      mesh.position.y = -0.35 + (mesh.scale.y - 1) * 0.36;
    }
  });

  return (
    <group>
      {materials.map((material, i) => {
        const angle = (i / SHARDS) * Math.PI * 2;
        const radius = i === 0 ? 0 : 0.34;
        return (
          <mesh
            key={i}
            ref={(node) => {
              refs.current[i] = node;
            }}
            geometry={geometry}
            material={material}
            position={[Math.cos(angle) * radius, -0.35, Math.sin(angle) * radius]}
            rotation={[0, 0, Math.cos(angle) * 0.24]}
            scale={[1, 0.01, 1]}
          />
        );
      })}
    </group>
  );
}

function ColdBreath() {
  const points = useRef<THREE.Points>(null);
  const { geometry, material, base, speeds } = useMemo(() => {
    const base = new Float32Array(BREATH * 3);
    const speeds = new Float32Array(BREATH);
    for (let i = 0; i < BREATH; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.45;
      base[i * 3] = Math.cos(angle) * radius;
      base[i * 3 + 1] = Math.random() * 1.2;
      base[i * 3 + 2] = Math.sin(angle) * radius;
      speeds[i] = 0.4 + Math.random() * 0.5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    const material = new THREE.PointsMaterial({
      size: 0.05,
      color: COLD,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { geometry, material, base, speeds };
  }, []);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((_, delta) => {
    const node = points.current;
    if (!node) return;
    const dt = Math.min(delta, 0.05);
    const attr = node.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < BREATH; i++) {
      attr.array[i * 3 + 1] += speeds[i] * dt;
      if (attr.array[i * 3 + 1] > 1.3) attr.array[i * 3 + 1] = 0;
    }
    attr.needsUpdate = true;
    node.rotation.y += dt * 0.2;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} color="#D6EEFF" />
      <directionalLight position={[2, 3, 2]} intensity={1.4} color="#FFFFFF" />
      <directionalLight position={[-2, 1, -2]} intensity={0.6} color={COLD} />
      <Shards />
      <ColdBreath />
    </>
  );
}

export function FreezeCrystals3D({
  fallback,
  className = "size-14",
}: {
  fallback: ReactNode;
  className?: string;
}) {
  if (!canRender3D()) return <>{fallback}</>;

  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={supportsReducedMotion() ? "demand" : "always"}
        camera={{ position: [0, 0.3, 2.4], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        fallback={fallback as unknown as React.ReactElement}
      >
        <Scene />
      </Canvas>
    </div>
  );
}

export default FreezeCrystals3D;
