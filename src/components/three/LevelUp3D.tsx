import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { canRender3D, supportsReducedMotion } from "@/lib/perf";
import { useThemeColors } from "@/hooks/useThemeColors";

/* ═══════════════════════════════════════════════════════════════════════
   NIVEAU — SCÈNE 3D (MODULE 4)

   Trois anneaux concentriques or qui s'étendent (échelle 0 → 3) pendant
   que « NIVEAU X » monte en volume, et 80 particules qui s'élèvent.
   Le texte est un sprite généré sur un canvas : pas de TextGeometry, donc
   pas de police à charger et pas de font JSON à embarquer.

   Reduced-motion ou device incapable ⇒ `fallback` (l'affichage 2D).
   ═══════════════════════════════════════════════════════════════════════ */

const RINGS = 3;
const MOTES = 80;
/** Confettis : un seul InstancedMesh, 100 pièces, un draw call. */
const CONFETTI = 100;
/** Même gravité que le coffre : les deux scènes divergent, on ne veut pas. */
const GRAVITY = -9.8;
const CYCLE = 2.4; // s — un cycle complet anneaux + montée des particules

function labelTexture(text: string, gold: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = "bold 76px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = gold;
    ctx.shadowBlur = 28;
    ctx.fillStyle = gold;
    ctx.fillText(text, 256, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function Rings() {
  const { gold: GOLD } = useThemeColors();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useMemo(() => new THREE.TorusGeometry(1, 0.035, 8, 40), []);

  useEffect(() => () => ring.dispose(), [ring]);

  useFrame((state) => {
    const t = (state.clock.elapsedTime % CYCLE) / CYCLE;
    for (let i = 0; i < RINGS; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      // Décalage par anneau : ils s'ouvrent l'un après l'autre.
      const local = (t + i / RINGS) % 1;
      const scale = 0.2 + local * 2.8;
      mesh.scale.setScalar(scale);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.75 * (1 - local));
    }
  });

  return (
    <group rotation={[Math.PI / 2.4, 0, 0]}>
      {Array.from({ length: RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            refs.current[i] = node;
          }}
          geometry={ring}
        >
          <meshBasicMaterial color={GOLD} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function AscendingMotes() {
  const { gold: GOLD, accent: OLIVE } = useThemeColors();
  const points = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const positions = new Float32Array(MOTES * 3);
    const colors = new Float32Array(MOTES * 3);
    const speeds = new Float32Array(MOTES);
    const color = new THREE.Color();
    for (let i = 0; i < MOTES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.4 + Math.random() * 1.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 3;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      speeds[i] = 0.5 + Math.random() * 0.6;
      color.set(Math.random() < 0.25 ? OLIVE : GOLD);
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
    for (let i = 0; i < MOTES; i++) {
      const o = i * 3;
      data.positions[o + 1] += data.speeds[i] * dt; // +0.5 u/s en moyenne
      if (data.positions[o + 1] > 3) data.positions[o + 1] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={0.09} vertexColors transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

/* ── Onde de choc annulaire ────────────────────────────────────────────
   Un disque plat qui s'étend de l'échelle 0 à 4 pendant que son opacité
   s'éteint. C'est le geste « impact » : tout part du sol, d'un coup. */
function Shockwave() {
  const { gold: GOLD } = useThemeColors();
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.RingGeometry(0.82, 1, 48), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const node = mesh.current;
    if (!node) return;
    const t = (state.clock.elapsedTime % CYCLE) / CYCLE;
    const scale = 0.1 + t * 3.9;
    node.scale.setScalar(scale);
    const material = node.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, 0.85 * (1 - t) ** 1.6);
  });

  return (
    <mesh ref={mesh} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
      <meshBasicMaterial color={GOLD} transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/* ── Colonne de lumière ────────────────────────────────────────────────
   Un cylindre additif, ouvert (pas de bouchon), qui monte et faiblit :
   le pilier de lumière qu'on voit dans les jeux de collection. */
function LightColumn() {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.85, 1.15, 4.2, 20, 1, true), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const node = mesh.current;
    if (!node) return;
    const t = (state.clock.elapsedTime % CYCLE) / CYCLE;
    const pulse = Math.sin(Math.min(1, t * 1.4) * Math.PI);
    node.scale.set(0.85 + pulse * 0.25, 0.6 + pulse * 0.5, 0.85 + pulse * 0.25);
    const material = node.material as THREE.MeshBasicMaterial;
    material.opacity = 0.3 * pulse;
  });

  return (
    <mesh ref={mesh} geometry={geometry} position={[0, 0.9, 0]}>
      <meshBasicMaterial color="#FFF3C4" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/* ── Confettis ─────────────────────────────────────────────────────────
   100 morceaux, un InstancedMesh. Chaque confetti part en explosion, tombe,
   et tourne sur lui-même. L'allocation se fait une fois au montage. */
function Confetti() {
  const { gold: GOLD, accent: OLIVE } = useThemeColors();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { geometry, material, state } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(0.09, 0.16);
    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    const items = [] as {
      pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Euler;
      rate: THREE.Vector3; color: THREE.Color; delay: number;
    }[];
    for (let i = 0; i < CONFETTI; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.2;
      items.push({
        pos: new THREE.Vector3(0, -0.4, 0),
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          2.2 + Math.random() * 2.4,
          Math.sin(angle) * speed,
        ),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        rate: new THREE.Vector3(
          (Math.random() * 2 - 1) * 12,
          (Math.random() * 2 - 1) * 12,
          (Math.random() * 2 - 1) * 12,
        ),
        color: new THREE.Color(Math.random() < 0.28 ? OLIVE : GOLD),
        delay: Math.random() * 0.35,
      });
    }
    return { geometry, material, state: items };
  }, [GOLD, OLIVE]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dt = Math.min(delta, 0.033);
    const global = (performance.now() / 1000) % CYCLE;

    for (let i = 0; i < CONFETTI; i++) {
      const item = state[i];
      const local = Math.max(0, global - item.delay);
      if (local <= 0) {
        dummy.position.set(0, -0.4, 0);
        dummy.scale.setScalar(0.001);
        dummy.rotation.copy(item.rot);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
        continue;
      }
      item.vel.y += GRAVITY * dt;
      item.pos.addScaledVector(item.vel, dt);
      if (item.pos.y < -1.2) item.pos.y = -1.2;
      item.rot.x += item.rate.x * dt;
      item.rot.y += item.rate.y * dt;
      item.rot.z += item.rate.z * dt;

      // Ils disparaissent en fin de cycle, sinon ils s'accumulent.
      const fade = 1 - Math.max(0, (local - CYCLE * 0.7) / (CYCLE * 0.3));
      dummy.position.copy(item.pos);
      dummy.rotation.copy(item.rot);
      dummy.scale.setScalar(Math.max(0.001, Math.min(1, fade)));
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
      instanced.setColorAt(i, item.color);
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, CONFETTI]} />;
}

function LevelLabel({ level }: { level: number }) {
  const { gold: GOLD } = useThemeColors();
  const sprite = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => labelTexture(`NIVEAU ${level}`, GOLD), [level, GOLD]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    const node = sprite.current;
    if (!node) return;
    const t = (state.clock.elapsedTime % CYCLE) / CYCLE;
    // Petit zoom qui retombe : le titre « saute » puis se pose.
    const zoom = 0.75 + Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.45;
    node.scale.set(2.6 * zoom, 0.65 * zoom, 1);
    node.position.y = 0.35 + t * 0.5;
    const material = node.material as THREE.SpriteMaterial;
    material.opacity = Math.max(0, Math.min(1, 1.6 * (1 - t)));
  });

  return (
    <sprite ref={sprite} position={[0, 0.4, 0]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function Scene({ level }: { level: number }) {
  return (
    <group>
      {/* L'onde part du sol : c'est elle qui « dit » le niveau qui monte. */}
      <Shockwave />
      <Rings />
      <LightColumn />
      <Confetti />
      <AscendingMotes />
      <LevelLabel level={level} />
    </group>
  );
}

export function LevelUp3D({
  level,
  fallback,
  className = "size-56",
}: {
  level: number;
  fallback: ReactNode;
  className?: string;
}) {
  if (!canRender3D()) return <>{fallback}</>;

  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={supportsReducedMotion() ? "demand" : "always"}
        camera={{ position: [0, 0.4, 4.5], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        fallback={fallback as unknown as React.ReactElement}
      >
        <Scene level={level} />
      </Canvas>
    </div>
  );
}

export default LevelUp3D;
