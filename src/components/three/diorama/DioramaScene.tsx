import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Acacia,
  ArcDeTriomphe,
  Dhow,
  EiffelTower,
  GreatWallTower,
  Kilimanjaro,
  LoireCastle,
  Pagoda,
  TempleOfHeaven,
} from "./monuments";
import { DIORAMA, WORLDS, type MonumentSpec, type WorldCode, type WorldConfig } from "./worlds";

/* ═══════════════════════════════════════════════════════════════════
   DIORAMA SCENE — globe miniature réutilisable + monuments séparés

   Un seul canvas (une seule boucle de rendu) :
     · globe sphérique VOLUMEUX (océan satiné, terres basses-poly,
       reliefs, neige, halo d'ambiance) ;
     · monuments INDÉPENDANTS posés sur leurs coordonnées réelles,
       orientés selon la normale du globe — chaque position reste
       animable (entrée en scène décalée, survol, clic) ;
     · éclairage de studio (key chaude ivoire, fill rose, rim menthe)
       + ombres douces, matériaux satinés ;
     · rotation douce + parallaxe pointeur + caméra pilotée par la
       ref de scroll partagée (zéro re-render React par frame).

   Interactivité : chaque monument porte une boîte de clic invisible ;
   `onSelect(id)` remonte au composant parent (pédagogie : mener vers
   la langue réellement disponible, jamais une fiche inventée).
   ═══════════════════════════════════════════════════════════════════ */

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* LCG déterministe : le décor ne change pas d'une session à l'autre. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* Backout de suavisation pour l'entrée des monuments (dépassement léger). */
function backOut(t: number): number {
  const s = 1.7;
  const x = Math.max(0, Math.min(1, t));
  return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
}

/* ── Globe : océan satiné + terres basses-poly + reliefs ───────────── */

function LandBlob({ lat, lon, radius, squash, color }: MonumentLandProps) {
  /* Orientation : le sommet local +Y est aligné sur la normale du globe. */
  const position = useMemo(() => latLonToVector3(lat, lon, 1 - radius * 0.12), [lat, lon, radius]);
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().normalize());
    return q;
  }, [position]);

  return (
    <mesh
      position={position}
      quaternion={quaternion}
      scale={[radius, radius * squash, radius * 0.85]}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.02} flatShading transparent opacity={0.98} />
    </mesh>
  );
}

type MonumentLandProps = {
  lat: number;
  lon: number;
  radius: number;
  squash: number;
  color: string;
};

function Relief({ lat, lon, color, size = 0.07, squat = 0.5 }: { lat: number; lon: number; color: string; size?: number; squat?: number }) {
  const position = useMemo(() => latLonToVector3(lat, lon, 1.005), [lat, lon]);
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().normalize());
    return q;
  }, [position]);
  return (
    <mesh position={position} quaternion={quaternion} scale={[size, size * squat, size]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.75} metalness={0} flatShading />
    </mesh>
  );
}

function Globe({ world }: { world: WorldConfig }) {
  const random = useMemo(() => seededRandom(1), []);

  const reliefs = useMemo(() => {
    const items = [] as { lat: number; lon: number; color: string; size: number }[];
    for (const land of world.lands) {
      const count = Math.round(land.radius * 10) + 2;
      for (let i = 0; i < count; i++) {
        const jitterLat = land.lat + (random() - 0.5) * land.radius * 60;
        const jitterLon = land.lon + (random() - 0.5) * land.radius * 70;
        items.push({
          lat: jitterLat,
          lon: jitterLon,
          color: random() > 0.66 ? DIORAMA.landAlt : DIORAMA.land,
          size: 0.05 + random() * 0.05,
        });
      }
    }
    return items;
  }, [world, random]);

  return (
    <group>
      {/* Océan satiné */}
      <mesh>
        <sphereGeometry args={[1, 56, 40]} />
        <meshStandardMaterial color={DIORAMA.ocean} roughness={0.35} metalness={0.12} />
      </mesh>
      {/* Terres basses-poly (pastel menthe) */}
      {world.lands.map((lm, i) => (
        <LandBlob key={i} lat={lm.lat} lon={lm.lon} radius={lm.radius} squash={lm.squash} color={DIORAMA.land} />
      ))}
      {/* Reliefs : collines et sommets sculptés côté visible */}
      {reliefs.map((r, i) => (
        <Relief key={i} lat={r.lat} lon={r.lon} color={r.color} size={r.size} squat={r.size > 0.08 ? 0.9 : 0.55} />
      ))}
    </group>
  );
}

/* ── Cette table associe chaque « kind » à son composant ─────────── */

const MONUMENT_COMPONENTS: Record<MonumentSpec["kind"], () => JSX.Element> = {
  eiffelTower: EiffelTower,
  arcDeTriomphe: ArcDeTriomphe,
  loireCastle: LoireCastle,
  templeOfHeaven: TempleOfHeaven,
  greatWallTower: GreatWallTower,
  pagoda: Pagoda,
  kilimanjaro: Kilimanjaro,
  dhow: Dhow,
  acacia: Acacia,
};

/* ── Un monument posé sur le globe, orienté à la normale ───────────── */

function Monument({
  spec,
  selected,
  onSelect,
}: {
  spec: MonumentSpec;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  /* Entrée en scène : 0 → 1, pilotée par frame (aucun re-render React). */
  const entry = useRef(0);

  const position = useMemo(() => latLonToVector3(spec.lat, spec.lon, 1.0), [spec.lat, spec.lon]);
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().normalize());
    return q;
  }, [position]);

  const Component = MONUMENT_COMPONENTS[spec.kind];

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    /* Backout sur l'entrée, puis lissé vers la cible de survol. */
    if (entry.current < 1) entry.current = Math.min(1, entry.current + delta / 0.9);
    const eased = entry.current < 1 ? backOut(entry.current) : 1;
    const target = (hovered.current ? 1.14 : selected ? 1.08 : 1) * Math.max(0.001, eased);
    const s = node.scale.x + (target - node.scale.x) * 0.2;
    node.scale.setScalar(Math.max(0.001, s));
  });

  return (
    <group position={position} quaternion={quaternion}>
      <group ref={group} scale={[0.001, 0.001, 0.001]}>
        <group scale={[spec.scale, spec.scale, spec.scale]}>
          <Component />
        </group>
        {/* Boîte de clic invisible mais raycastable (opacité 0). */}
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            hovered.current = true;
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            hovered.current = false;
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(spec.kind);
          }}
        >
          <boxGeometry args={[0.34, 0.6, 0.34]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ── Halo d'ambiance derrière le globe (sprite canvas doux) ────────── */

function AmbienceHalo() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(243,169,200,0.32)");
      grad.addColorStop(0.6, "rgba(167,232,214,0.14)");
      grad.addColorStop(1, "rgba(167,232,214,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0.5, 0.4, -1.4]} scale={[6, 6, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

/* ── Petit vent de poussière déterministe autour du globe ──────────── */

function DustField() {
  const geometry = useMemo(() => {
    const random = seededRandom(20260925);
    const count = 320;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 1.25 + random() * 0.9;
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

  return (
    <points geometry={geometry}>
      <pointsMaterial color={DIORAMA.turquoise} size={0.02} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
    </points>
  );
}

/* ── Caméra : parallaxe + plongée pilotée par la ref de scroll ─────── */

function CameraRig({ scrollProgress }: { scrollProgress: { current: number } }) {
  const { camera } = useThree();
  const pointer = useRef({ x: 0, y: 0 });

  /* eslint-disable react-hooks/immutability -- c'est le rôle même
     d'un rig de caméra R3F : muter la caméra (et les accumulateurs de
     lissage) pendant la frame, hors du cycle de rendu React. */
  useFrame((state, delta) => {
    const p = scrollProgress.current;
    const ease = Math.min(1, delta * 3);
    pointer.current.x += (state.pointer.x - pointer.current.x) * ease;
    pointer.current.y += (state.pointer.y - pointer.current.y) * ease;

    /* Scroll : le globe recule légèrement (l'utilisateur descend dans
       le récit) et monte un peu — mouvement lisible mais sobre. */
    const targetZ = 3.4 + p * 1.3;
    const targetY = 0.5 - p * 0.3;

    camera.position.x += (pointer.current.x * 0.5 - camera.position.x) * ease;
    camera.position.y += (targetY + pointer.current.y * 0.3 - camera.position.y) * ease;
    camera.position.z += (targetZ - camera.position.z) * ease;
    camera.lookAt(0, 0.1, 0);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}

/* ── Racine du diorama : rotation douce + transforms de scroll ─────── */

function DioramaRig({
  world,
  selected,
  onSelect,
}: {
  world: WorldConfig;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const worldGroup = useRef<THREE.Group>(null);
  const globeSpin = useRef(0);
  const entrance = useRef(0);

  useFrame((_, delta) => {
    const node = worldGroup.current;
    if (!node) return;
    if (entrance.current < 1) entrance.current = Math.min(1, entrance.current + delta / 1.1);
    const e = entrance.current;
    const eased = backOut(e);
    globeSpin.current += delta * 0.06;

    node.rotation.y = WORLDS[world.code].introLon * (Math.PI / 180) + globeSpin.current;
    node.rotation.z = Math.sin(globeSpin.current * 0.4) * 0.05;
    node.position.y = -0.1 + eased * 0.1;
    node.scale.setScalar(0.9 + eased * 0.1);
  });

  return (
    <group ref={worldGroup}>
      <Globe world={world} />
      {world.monuments.map((spec) => (
        <Monument key={`${world.code}-${spec.kind}`} spec={spec} selected={selected === spec.kind} onSelect={onSelect} />
      ))}
      <DustField />
      <AmbienceHalo />
    </group>
  );
}

/* ── Lumières de studio ────────────────────────────────────────────── */

function StudioLights() {
  return (
    <>
      {/* Key chaude : la lumière "ivoire chaud" du studio. */}
      <directionalLight position={[3.5, 4.5, 2.5]} intensity={1.15} color="#FFF8EF" />
      {/* Fill rose : adoucit les ombres avec la chaleur du pastel. */}
      <directionalLight position={[-3.5, 2, 1.5]} intensity={0.45} color="#F9D9E7" />
      {/* Rim menthe : détache la silhouette du fond. */}
      <directionalLight position={[-1.5, 1.5, -3]} intensity={0.5} color="#A7E8D6" />
      {/* Lumière ambiante faible pour le bleu-vert profond. */}
      <ambientLight intensity={0.35} color="#17484A" />
    </>
  );
}

/* ── Scène publique ────────────────────────────────────────────────── */

export function DioramaScene({
  world,
  onSelect,
  scrollProgress,
  frameloop = "always",
}: {
  world: WorldCode;
  onSelect: (id: string) => void;
  scrollProgress: { current: number };
  frameloop?: "always" | "demand";
}) {
  const config = WORLDS[world];
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={frameloop}
      camera={{ position: [0, 0.5, 3.4], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      fallback={null}
    >
      <StudioLights />
      <DioramaRig
        world={config}
        selected={selected}
        onSelect={(id) => {
          setSelected(id);
          onSelect(id);
        }}
      />
      <CameraRig scrollProgress={scrollProgress} />
    </Canvas>
  );
}

export default DioramaScene;
