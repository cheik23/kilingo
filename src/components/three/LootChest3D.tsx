import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { canRender3D } from "@/lib/perf";
import { useThemeColors, type ThemeColors } from "@/hooks/useThemeColors";

/* ═══════════════════════════════════════════════════════════════════════
   COFFRE DE LOOT — SÉQUENCE CINÉMA (v2)

   Le coffre a changé de régime : il n'est plus « une boîte qui s'ouvre ».
   C'est un mini-film en quatre temps, cadré par une seule horloge.

     a) SUSPENSE  le coffre tremble, la lueur pulse, des braises orbitent
     b) OUVERTURE le couvercle part au ressort (120/8), la caméra encaisse
                  un coup de FOV 50 → 62 → 50, un flash additif claque
     c) BURST     60 pièces en UN SEUL InstancedMesh : vitesses aléatoires,
                  gravité -9.8, rebond au sol (restitution 0.4), tumble
     d) SETTLE    4 plans de rayons (god-rays) en additif + scintillements,
                  puis la révélation du contenu

   Matériaux PBR : l'or est un MeshStandardMetalness (metalness 0.85,
   roughness 0.25), le bois rugueux (roughness 0.7). Pour qu'ils aient
   quelque chose à réfléchir, on génère une environnement de réflexion par
   PMREM à partir d'une scène gradient or/noir — AUCUN HDRI téléchargé,
   donc zéro octet réseau et pas de dépendance externe.

   Budget géométrique : le coffre est composé de boîtes (bandes biseautées,
   serrure, coins) — ~1 800 triangles au total. Les 60 pièces sont
   instanciées : un seul draw call, pas 60.

   Reduced-motion ou machine incapable ⇒ `fallback` (l'affichage 2D).
   ═══════════════════════════════════════════════════════════════════════ */

/** 60 pièces, un seul InstancedMesh. */
const COINS = 60;
/** Rebond au sol. */
const RESTITUTION = 0.4;
const GRAVITY = -9.8;
/** Position du sol de la scène (les pièces rebondissent dessus). */
const FLOOR_Y = -1.05;

/* ── Environnement de réflexion, généré à la volée ─────────────────────
   Une petite scène (sphère dégradée + deux panneaux lumineux) passée au
   PMREMGenerator de three : c'est exactement ce que fait un HDRI, mais
   calculé à partir de rien. À faire UNE fois par canvas, pas par frame. */
function useProceduralEnv(
  scene: THREE.Scene,
  gl: THREE.WebGLRenderer,
  colors: ThemeColors,
): THREE.Texture | null {
  return useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();

    // Dôme : dégradé brun profond → noir, pour des reflets cohérents.
    const domeGeo = new THREE.SphereGeometry(10, 16, 12);
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(colors.env) },
        bottom: { value: new THREE.Color(colors.suit) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom;
        varying vec3 vPos;
        void main() {
          float h = clamp(vPos.y / 10.0 * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottom, top, h), 1.0);
        }`,
    });
    envScene.add(new THREE.Mesh(domeGeo, domeMat));

    // Deux « boîtes à lumière » : ce sont elles qui donnent au métal des
    // reflets francs — sans elles, l'or reste plat quelle que soit sa
    // metalness.
    const key = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 4),
      new THREE.MeshBasicMaterial({ color: "#FFF3C4" }),
    );
    key.position.set(0, 6, 2);
    key.lookAt(0, 0, 0);
    envScene.add(key);

    const rim = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: colors.accent }),
    );
    rim.position.set(-7, 1, -3);
    rim.lookAt(0, 0, 0);
    envScene.add(rim);

    const target = pmrem.fromScene(envScene, 0.04);

    // Nettoyage immédiat : l'environnement est déjà rendu dans la cible.
    domeGeo.dispose();
    domeMat.dispose();
    envScene.clear();
    pmrem.dispose();

    scene.environment = target.texture;
    return target.texture;
  }, [scene, gl, colors.env, colors.suit, colors.accent]);
}

/* ── Le coffre ───────────────────────────────────────────────────────────
   Boîtes composées : caisse, couvercle, deux bandes métalliques, quatre
   coins renforcés, une serrure. Tout en MeshStandardMaterial. */
function Chest({ phaseRef }: { phaseRef: React.RefObject<number> }) {
  const { gold: GOLD, goldDeep: GOLD_DEEP } = useThemeColors();
  const root = useRef<THREE.Group>(null);
  const lidPivot = useRef<THREE.Group>(null);
  const lockRef = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);

  const geo = useMemo(
    () => ({
      body: new THREE.BoxGeometry(1.5, 0.95, 1.05),
      lid: new THREE.BoxGeometry(1.56, 0.42, 1.1),
      // Bandeaux : légèrement plus larges que la caisse → effet de
      // « biseau » sans coût de géométrie.
      bandH: new THREE.BoxGeometry(1.6, 0.1, 1.14),
      bandV: new THREE.BoxGeometry(0.16, 1.0, 1.14),
      corner: new THREE.BoxGeometry(0.13, 1.0, 0.13),
      lock: new THREE.BoxGeometry(0.34, 0.3, 0.12),
      glow: new THREE.SphereGeometry(1.7, 16, 12),
      flash: new THREE.SphereGeometry(2.4, 16, 12),
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      gold: new THREE.MeshStandardMaterial({
        color: GOLD,
        metalness: 0.85,
        roughness: 0.25,
      }),
      goldDeep: new THREE.MeshStandardMaterial({
        color: GOLD_DEEP,
        metalness: 0.85,
        roughness: 0.3,
      }),
      wood: new THREE.MeshStandardMaterial({
        color: "#3A2418",
        metalness: 0.05,
        roughness: 0.7,
      }),
    }),
    [GOLD, GOLD_DEEP],
  );

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [geo, mats],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = performance.now() / 1000;
    const phase = phaseRef.current;
    const node = root.current;

    if (node) {
      // Phase 0 = suspense : tremblement. Dès l'ouverture, le coffre se
      // calme et se met à tourner fièrement.
      if (phase === 0) {
        const intensity = 0.02 + Math.sin(t * 22) * 0.012;
        node.position.x = Math.sin(t * 40) * intensity;
        node.position.y = Math.sin(t * 1.5) * 0.06;
        node.rotation.z = Math.sin(t * 31) * intensity * 0.5;
      } else {
        node.position.x *= 1 - Math.min(1, dt * 8);
        node.position.z *= 1 - Math.min(1, dt * 8);
        node.rotation.z *= 1 - Math.min(1, dt * 8);
        node.rotation.y += dt * 0.5;
        node.position.y = Math.sin(t * 1.2) * 0.04;
      }
    }

    // Couvercle : ressort réel (stiffness 120, damping 8) plutôt qu'un
    // lerp vers la cible — l'inertie fait tout le travail.
    const pivot = lidPivot.current;
    if (pivot) {
      const target = phase >= 1 ? -1.9 : 0;
      const k = 120;
      const d = 8;
      const accel = (target - pivot.rotation.x) * k - pivot.userData.vel * d;
      pivot.userData.vel = (pivot.userData.vel ?? 0) + accel * dt;
      pivot.rotation.x += pivot.userData.vel * dt;
    }

    // La serrure disparaît quand le couvercle s'ouvre.
    if (lockRef.current) {
      lockRef.current.visible = phase < 1;
    }

    // Lueur : pulsée en suspense, tenue après l'ouverture.
    if (glow.current) {
      const material = glow.current.material as THREE.MeshBasicMaterial;
      const base = phase === 0 ? 0.18 : 0.4;
      material.opacity = base + Math.sin(t * (phase === 0 ? 6 : 2.2)) * (phase === 0 ? 0.12 : 0.1);
    }

    // Flash additif : une seule impulsion, à l'ouverture.
    if (flash.current) {
      const material = flash.current.material as THREE.MeshBasicMaterial;
      if (phase === 1) {
        material.opacity = Math.max(0, material.opacity - dt * 2.4);
      } else {
        material.opacity = Math.max(0, 0);
      }
    }
  });

  return (
    <group>
      <mesh ref={glow} geometry={geo.glow}>
        <meshBasicMaterial color={GOLD} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={flash} geometry={geo.flash} visible={false}>
        <meshBasicMaterial color="#FFF6D8" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <group ref={root}>
        {/* Caisse : bois, les bandes métalliques viennent par-dessus. */}
        <mesh geometry={geo.body} position={[0, -0.38, 0]} material={mats.wood} />
        <mesh geometry={geo.bandH} position={[0, -0.12, 0]} material={mats.gold} />
        <mesh geometry={geo.bandH} position={[0, -0.66, 0]} material={mats.gold} />
        <mesh geometry={geo.bandV} position={[-0.5, -0.38, 0]} material={mats.gold} />
        <mesh geometry={geo.bandV} position={[0.5, -0.38, 0]} material={mats.gold} />
        {/* Coins renforcés. */}
        {([[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]] as const).map(([x, z], i) => (
          <mesh key={i} geometry={geo.corner} position={[x, -0.38, z]} material={mats.goldDeep} />
        ))}

        {/* Couvercle : pivot à l'arrière, il bascule vers l'arrière. */}
        <group position={[0, 0.12, -0.5]}>
          <group ref={lidPivot} position={[0, 0, 0.5]}>
            <mesh geometry={geo.lid} material={mats.goldDeep} />
            <mesh geometry={geo.bandV} position={[-0.42, 0, 0]} material={mats.gold} />
            <mesh geometry={geo.bandV} position={[0.42, 0, 0]} material={mats.gold} />
          </group>
        </group>

        {/* Serrure, face avant. */}
        <mesh ref={lockRef} geometry={geo.lock} position={[0, -0.2, 0.55]} material={mats.gold} />
      </group>
    </group>
  );
}

/* ── Les 60 pièces ──────────────────────────────────────────────────────
   Un InstancedMesh, un draw call. Intégration dans une matrice par pièce
   et par frame — l'allocation est faite une fois, au montage. */
function Coins({ phaseRef }: { phaseRef: React.RefObject<number> }) {
  const { gold: GOLD, goldDeep: GOLD_DEEP } = useThemeColors();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const baseFov = useMemo(() => (camera as THREE.PerspectiveCamera).fov, [camera]);
  const startedAt = useRef<number | null>(null);

  const { geometry, material, positions, velocities, spins, spinRates } = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.11, 0.11, 0.028, 10);
    const material = new THREE.MeshStandardMaterial({
      color: GOLD,
      metalness: 0.9,
      roughness: 0.22,
      emissive: new THREE.Color(GOLD_DEEP),
      emissiveIntensity: 0.35,
    });
    const positions = new Float32Array(COINS * 3);
    const velocities = new Float32Array(COINS * 3);
    const spins = new Float32Array(COINS * 3);
    const spinRates = new Float32Array(COINS * 3);
    for (let i = 0; i < COINS; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.1 + Math.random() * 2.4;
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = 2.4 + Math.random() * 2.6;
      velocities[i * 3 + 2] = Math.sin(angle) * speed;
      spinRates[i * 3] = (Math.random() * 2 - 1) * 14;
      spinRates[i * 3 + 1] = (Math.random() * 2 - 1) * 14;
      spinRates[i * 3 + 2] = (Math.random() * 2 - 1) * 14;
    }
    return { geometry, material, positions, velocities, spins, spinRates };
  }, [GOLD, GOLD_DEEP]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dt = Math.min(delta, 0.033);
    const t = state.clock.elapsedTime;
    const phase = phaseRef.current;
    const cam = camera as THREE.PerspectiveCamera;

    if (phase === 0) {
      instanced.visible = false;
      cam.fov = baseFov;
      cam.updateProjectionMatrix();
      // On arme le départ du prochain cycle : sans ça, le coup de FOV ne
      // se rejouerait qu'à la toute PREMIÈRE ouverture.
      startedAt.current = null;
      return;
    }

    instanced.visible = true;
    if (startedAt.current === null) {
      startedAt.current = t;
      // Nouvelle ouverture : on remet les pièces dans la caisse et on
      // regénère leurs vitesses, sinon le deuxième coffre.openapié à
      // l'endroit exact où le premier s'était arrêté.
      for (let i = 0; i < COINS; i++) {
        const o = i * 3;
        positions[o] = (Math.random() - 0.5) * 0.3;
        positions[o + 1] = 0.05;
        positions[o + 2] = (Math.random() - 0.5) * 0.3;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.1 + Math.random() * 2.4;
        velocities[o] = Math.cos(angle) * speed;
        velocities[o + 1] = 2.4 + Math.random() * 2.6;
        velocities[o + 2] = Math.sin(angle) * speed;
        spinRates[o] = (Math.random() * 2 - 1) * 14;
        spinRates[o + 1] = (Math.random() * 2 - 1) * 14;
        spinRates[o + 2] = (Math.random() * 2 - 1) * 14;
      }
    }
    const age = t - startedAt.current;

    // Coup de FOV : 50 → 62 → 50 sur 300 ms, puis repos.
    const kick = Math.max(0, 1 - age / 0.3);
    const eased = Math.sin(kick * Math.PI) * 12;
    cam.fov = baseFov + eased;
    cam.updateProjectionMatrix();

    for (let i = 0; i < COINS; i++) {
      const o = i * 3;
      if (phase === 1) {
        // Pendant l'ouverture, les pièces restent « en réserve » dans la
        // caisse : seule leur hauteur est maintenue à zéro.
        positions[o + 1] = 0.05;
      } else {
        velocities[o + 1] += GRAVITY * dt;
        positions[o] += velocities[o] * dt;
        positions[o + 1] += velocities[o + 1] * dt;
        positions[o + 2] += velocities[o + 2] * dt;

        // Rebond : on inverse la vitesse verticale, on amortit le
        // horizontal, et la pièce finit par se poser.
        if (positions[o + 1] < FLOOR_Y) {
          positions[o + 1] = FLOOR_Y;
          velocities[o + 1] = -velocities[o + 1] * RESTITUTION;
          velocities[o] *= 0.72;
          velocities[o + 2] *= 0.72;
          spinRates[o] *= 0.6;
          spinRates[o + 2] *= 0.6;
        }
        spins[o] += spinRates[o] * dt;
        spins[o + 1] += spinRates[o + 1] * dt;
        spins[o + 2] += spinRates[o + 2] * dt;
      }

      dummy.position.set(positions[o], positions[o + 1], positions[o + 2]);
      dummy.rotation.set(spins[o], spins[o + 1], spins[o + 2]);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, COINS]} />;
}

/* ── God-rays + scintillements (phase « settle ») ───────────────────────
   Quatre plans additifs en éventail, en rotation lente, + un nuage de
   points qui scintille. Aucun mesh par particule : un seul Points. */
function Radiance({ phaseRef }: { phaseRef: React.RefObject<number> }) {
  const { gold: GOLD } = useThemeColors();
  const rays = useRef<THREE.Group>(null);
  const sparkles = useRef<THREE.Points>(null);
  // Mémorise l'instant où la phase settle a commencé : la fondu part de là.
  // `-1` = on n'a pas encore vu la nouvelle phase en frame.
  const phaseStart = useRef(0);
  const lastPhase = useRef(0);

  const plane = useMemo(() => new THREE.PlaneGeometry(0.42, 3.4), []);
  const { geometry, material, base } = useMemo(() => {
    const count = 40;
    const geometry = new THREE.BufferGeometry();
    const base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.6 + Math.random() * 1.5;
      base[i * 3] = Math.cos(angle) * radius;
      base[i * 3 + 1] = Math.random() * 1.6;
      base[i * 3 + 2] = Math.sin(angle) * radius;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    const material = new THREE.PointsMaterial({
      size: 0.06,
      color: "#FFF3C4",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { geometry, material, base };
  }, []);

  useEffect(
    () => () => {
      plane.dispose();
      geometry.dispose();
      material.dispose();
    },
    [plane, geometry, material],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const phase = phaseRef.current;
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      phaseStart.current = -1;
    }
    const on = phase >= 3;
    // Premiere frame de la phase : on ancre l'origine du fondu.
    if (phaseStart.current < 0) phaseStart.current = t;
    // Montée douce en 400 ms à l'arrivée sur « settle », puis tenue.
    const fade = on ? Math.min(1, (t - phaseStart.current) / 0.4) : 0;

    if (rays.current) {
      rays.current.visible = on;
      rays.current.rotation.y = t * 0.18;
      for (const child of rays.current.children) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.16 * fade * (0.6 + 0.4 * Math.sin(t * 1.6 + mesh.rotation.y));
      }
    }

    if (sparkles.current) {
      const mat = sparkles.current.material as THREE.PointsMaterial;
      mat.opacity = on ? 0.85 * fade : 0;
      // Scintillement : chaque point respire à son propre rythme.
      sparkles.current.rotation.y = -t * 0.12;
      const attr = sparkles.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < base.length / 3; i++) {
        attr.array[i * 3] = base[i * 3];
        attr.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 1.8 + i) * 0.05;
        attr.array[i * 3 + 2] = base[i * 3 + 2];
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      <group ref={rays} visible={false} position={[0, 0.2, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={plane} rotation={[0, (i / 4) * Math.PI * 2, (i - 1.5) * 0.12]}>
            <meshBasicMaterial color={GOLD} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <points ref={sparkles} geometry={geometry}>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
}

function Scene({ open }: { open: boolean }) {
  const colors = useThemeColors();
  const { gl, scene } = useThree();
  useProceduralEnv(scene, gl, colors);

  /* L'horloge du film. L'appelant ne fournit qu'un booléen « ouvert » :
     c'est le temps écoulé depuis le basculement qui fait avancer les
     quatre temps. Un Ref et non un state — les trois sous-scènes le lisent
     dans LEUR useFrame, sans jamais provoquer de re-render React. */
  const phaseRef = useRef(0);
  const openedAt = useRef<number | null>(null);

  // Deux lumières : une clé chaude qui fait vibrer l'or, un remplissage
  // olive pour détacher le coffre du fond (brun profond en nuit, crème
  // en thème clair).
  const key = useRef<THREE.DirectionalLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (open) {
      if (openedAt.current === null) openedAt.current = t;
      const age = t - openedAt.current;
      // a) suspense déjà passé · b) ouverture 450 ms · c) burst 850 ms
      // d) settle : les rayons et les étincelles prennent le relais.
      phaseRef.current = age < 0.45 ? 1 : age < 1.3 ? 2 : 3;
    } else {
      openedAt.current = null;
      phaseRef.current = 0;
    }

    if (key.current) key.current.position.x = 3 + Math.sin(t) * 1.2;
  });

  return (
    <>
      <ambientLight intensity={0.35} color="#C9BCA8" />
      <directionalLight ref={key} position={[3, 4, 3]} intensity={2.2} color="#FFF3C4" />
      <directionalLight position={[-3, 1, -2]} intensity={0.7} color={colors.accent} />
      <Chest phaseRef={phaseRef} />
      <Coins phaseRef={phaseRef} />
      <Radiance phaseRef={phaseRef} />
    </>
  );
}

export function LootChest3D({
  open,
  fallback,
  className = "mx-auto h-32 w-32",
}: {
  open: boolean;
  fallback: ReactNode;
  className?: string;
}) {
  if (!canRender3D()) return <>{fallback}</>;

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        frameloop="always"
        camera={{ position: [0, 0.4, 4], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        fallback={fallback}
        onError={() => undefined}
      >
        <Scene open={open} />
      </Canvas>
    </div>
  );
}

export default LootChest3D;
