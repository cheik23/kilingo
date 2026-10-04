import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useThemeColors } from "@/hooks/useThemeColors";

/* ═══════════════════════════════════════════════════════════════════
   GLOBE HERO — scène 3D réelle, strictement or/noir.
   Chargé en lazy : ce chunk (three.js) n'est téléchargé que si le hero
   3D est réellement affiché (pas de reduced-motion, device capable,
   WebGL disponible). Aucune lumière : uniquement MeshBasicMaterial
   + additive blending, donc pas de coût GPU par lumière.
   ═══════════════════════════════════════════════════════════════════ */

const CITY_COUNT = 13;

/** Les 13 villes où l'on apprend une langue. */
const CITIES: Array<{ name: string; lat: number; lon: number }> = [
  { name: "Lagos", lat: 6.52, lon: 3.38 },
  { name: "Dakar", lat: 14.72, lon: -17.47 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Kinshasa", lat: -4.32, lon: 15.31 },
  { name: "Johannesburg", lat: -26.2, lon: 28.05 },
  { name: "Kano", lat: 12.0, lon: 8.52 },
  { name: "Lusaka", lat: -15.39, lon: 28.32 },
  { name: "Paris", lat: 48.86, lon: 2.35 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "Mexico City", lat: 19.43, lon: -99.13 },
  { name: "Beijing", lat: 39.9, lon: 116.41 },
  { name: "Moscow", lat: 55.76, lon: 37.62 },
];

function latLonToVector3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Dégradé déterministe : le décor ne change pas d'une session à l'autre. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function Globe() {
  // Or du thème actif : #D4A574 en nuit, #8A5A33 en jour (lisible sur crème).
  const { gold: GOLD } = useThemeColors();
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  // Géométries partagées : une sphère pour le filaire, un buffer de points.
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 48, 32), []);
  const cityGeometry = useMemo(() => {
    const positions = new Float32Array(CITY_COUNT * 3);
    CITIES.forEach((city, index) => {
      const [x, y, z] = latLonToVector3(city.lat, city.lon, 1.015);
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);
  const dustGeometry = useMemo(() => {
    const random = seededRandom(20260925);
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Distribution en coquille autour du globe (pas au centre).
      const radius = 1.15 + random() * 0.85;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      target.current.x = ((event.clientX / w) * 2 - 1) * 0.32;
      target.current.y = ((event.clientY / h) * 2 - 1) * 0.2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    // Parallaxe ressort amorti + rotation auto 0.05 rad/s.
    pointer.current.x += (target.current.x - pointer.current.x) * Math.min(1, delta * 4);
    pointer.current.y += (target.current.y - pointer.current.y) * Math.min(1, delta * 4);
    node.rotation.y += delta * 0.05 + pointer.current.x * delta;
    node.rotation.x = pointer.current.y;
  });

  return (
    <group ref={group}>
      <mesh geometry={sphereGeometry}>
        <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.16} />
      </mesh>
      <mesh geometry={sphereGeometry} scale={0.995}>
        <meshBasicMaterial color={GOLD} transparent opacity={0.05} blending={THREE.AdditiveBlending} />
      </mesh>
      <points geometry={cityGeometry}>
        <pointsMaterial color={GOLD} size={0.055} sizeAttenuation transparent opacity={0.95} blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={dustGeometry}>
        <pointsMaterial color={GOLD} size={0.012} sizeAttenuation transparent opacity={0.5} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

/** FPS guard : sous 30 FPS pendant 3 s, on bascule sur le fallback. */
function FpsGuard({ onDegrade }: { onDegrade: () => void }) {
  const state = useRef({ frames: 0, elapsed: 0, fired: false });
  useFrame((_, delta) => {
    const s = state.current;
    if (s.fired) return;
    s.frames += 1;
    s.elapsed += delta;
    if (s.elapsed >= 3) {
      if (s.frames / s.elapsed < 30) {
        s.fired = true;
        onDegrade();
      }
      s.frames = 0;
      s.elapsed = 0;
    }
  });
  return null;
}

export function GlobeHero({ onDegrade }: { onDegrade?: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);

  // `frameloop="demand"` hors viewport : le GPU se met réellement en veille.
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const degrade = () => {
    setFailed(true);
    onDegrade?.();
  };

  if (failed) return null;

  return (
    <div ref={container} className="absolute inset-0" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? "always" : "demand"}
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        fallback={null}
        onError={() => setFailed(true)}
      >
        <Globe />
        <FpsGuard onDegrade={degrade} />
      </Canvas>
    </div>
  );
}

export default GlobeHero;
