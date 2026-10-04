import { useEffect, useMemo, useRef } from "react";
import { useThemeColors, type ThemeColors } from "@/hooks/useThemeColors";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════
   JABARI — MASCOTTE 3D PROCÉDURALE (MODULE 1)

   Pourquoi procédurale et pas un GLB ?
   ───────────────────────────────
   Les packs CC0 de Quaternius sont bien réels (quaternius.com, licence
   CC0 confirmée sur la fiche du pack), mais ils sont hébergés sur des
   dossiers Google Drive / itch.io : pas d'URL de fichier direct, donc
   pas de téléchargement fiable ni de coupe possible à < 2 Mo. L'API
   poly.pizza répond 401 sans jeton. On construit donc le lion nous-même
   en primitives three — ce qui est de toute façon la solution la plus
   légère : **zéro octet d'asset**, licence CC0 par construction, et des
   animations pilotées par le code (donc réversibles, blendables).

   Palette « Terre Sacrée », qui SUIT LE THÈME : corps or terre, crinière
   or profond, hoodie brun, écharpe à motif kenté (texture canvas 64 px),
   vert olive en accent (nez, doublure de l'oreille). Les valeurs viennent
   de `useThemeColors()` (tokens `--fx-3d-*`) : en thème clair l'or passe
   au ton foncé #8A5A33, lisible sur crème.

   Machine à états : idle · celebrate · nag · sleep · dance · wave · think.
   Le fondu entre deux états est un simple lissage exponentiel de constante
   0.3 s sur chaque paramètre de pose — un vrai crossfade, sans morphing.
   ═══════════════════════════════════════════════════════════════════════ */

export type MascotState =
  | "idle"
  | "celebrate"
  | "nag"
  | "sleep"
  | "dance"
  | "wave"
  | "think";

export const MASCOT_STATES: MascotState[] = [
  "idle",
  "celebrate",
  "nag",
  "sleep",
  "dance",
  "wave",
  "think",
];

/** Museau : plus clair que le corps, dans les deux thèmes. */
const MUZZLE = "#EFDCBE";
/** Yeux : toujours sombres — un œil clair disparaît sur l'or du visage. */
const INK = "#1E120A";

/** Constante de temps du fondu entre deux poses (secondes). */
const BLEND = 0.3;

/** Pose = l'ensemble des valeurs animées, interpolées entre les états. */
type Pose = {
  bob: number; // hauteur du corps
  bodyYaw: number; // rotation du buste
  bodyRoll: number; // roulis
  headPitch: number; // tête basse (nag) / haute (danse)
  headYaw: number; // tête de gauche à droite
  headRoll: number; // tête penchée (think)
  armLeft: number; // bras gauche : 0 = au repos, 1 = levé
  armRight: number; // bras droit : idem (le salut)
  armWave: number; // amplitude du salut de la main
  tail: number; // balancement de la queue
  squash: number; // écrasement (respiration du sommeil)
};

const POSES: Record<MascotState, Pose> = {
  idle: {
    bob: 0, bodyYaw: 0, bodyRoll: 0,
    headPitch: 0, headYaw: 0, headRoll: 0,
    armLeft: 0, armRight: 0, armWave: 0, tail: 0, squash: 1,
  },
  celebrate: {
    bob: 0.55, bodyYaw: 0, bodyRoll: 0,
    headPitch: -0.3, headYaw: 0, headRoll: 0,
    armLeft: 1, armRight: 1, armWave: 0.2, tail: 1, squash: 1.06,
  },
  nag: {
    bob: 0, bodyYaw: 0, bodyRoll: 0,
    headPitch: 0.18, headYaw: 0, headRoll: 0,
    armLeft: 0.25, armRight: 0.25, armWave: 0, tail: 0.4, squash: 0.97,
  },
  sleep: {
    bob: -0.18, bodyYaw: 0, bodyRoll: 0.12,
    headPitch: 0.42, headYaw: 0.25, headRoll: 0.2,
    armLeft: 0, armRight: 0, armWave: 0, tail: 0, squash: 0.94,
  },
  dance: {
    bob: 0.12, bodyYaw: 0, bodyRoll: 0,
    headPitch: -0.12, headYaw: 0, headRoll: 0.22,
    armLeft: 0.85, armRight: 0.85, armWave: 0.5, tail: 0.8, squash: 1.03,
  },
  wave: {
    bob: 0.04, bodyYaw: 0, bodyRoll: 0,
    headPitch: -0.08, headYaw: 0, headRoll: -0.12,
    armLeft: 0.1, armRight: 1, armWave: 1, tail: 0.3, squash: 1,
  },
  think: {
    bob: 0, bodyYaw: 0.12, bodyRoll: 0,
    headPitch: 0.1, headYaw: -0.2, headRoll: 0.3,
    armLeft: 0, armRight: 0.55, armWave: 0, tail: 0.1, squash: 0.99,
  },
};

/** Écharpe kenté : bandes or / brun / olive, générées sur un canvas. */
function kenteTexture({ gold, suit, accent, goldDeep }: ThemeColors): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = suit;
  ctx.fillRect(0, 0, size, size);
  const bands = [gold, suit, accent, gold, suit, gold];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(0, (i * size) / 6, size, size / 12);
  }
  // Losanges : le signe reconnaissable du kenté.
  ctx.fillStyle = goldDeep;
  for (let y = 0; y < size; y += 16) {
    for (let x = 0; x < size; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + 16, y + 8);
      ctx.lineTo(x + 8, y + 16);
      ctx.lineTo(x, y + 8);
      ctx.closePath();
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Lion({
  state,
  interactive = true,
}: {
  state: MascotState;
  interactive?: boolean;
}) {
  // Or/brun/olive du thème actif : Jabari change de robe avec le thème.
  const { gold: GOLD, goldDeep: GOLD_DEEP, accent: OLIVE, suit: NIGHT } = useThemeColors();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const pupils = useRef<THREE.Group>(null);

  const { camera } = useThree();
  const cameraBase = useMemo(() => camera.position.clone(), [camera]);

  // Cible = pose de l'état courant ; `current` suit la cible avec un
  // lissage exponentiel de constante BLEND : c'est le fondu de 0.3 s
  // entre deux clips — pas de morphing, pas de mélange de géométries.
  const current = useRef<Pose>({ ...POSES.idle });
  const pointer = useRef({ x: 0, y: 0 });

  // Regards : la tête suit doucement le curseur.
  useEffect(() => {
    if (!interactive) return;
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [interactive]);

  const geometry = useMemo(
    () => ({
      torso: new THREE.SphereGeometry(0.46, 12, 10),
      hoodie: new THREE.SphereGeometry(0.52, 12, 10),
      head: new THREE.SphereGeometry(0.34, 14, 12),
      muzzle: new THREE.SphereGeometry(0.17, 10, 8),
      ear: new THREE.ConeGeometry(0.11, 0.2, 4),
      mane: new THREE.TorusGeometry(0.36, 0.13, 6, 14),
      arm: new THREE.CapsuleGeometry(0.1, 0.3, 3, 8),
      tail: new THREE.ConeGeometry(0.08, 0.55, 6),
      eye: new THREE.SphereGeometry(0.055, 8, 6),
      pupil: new THREE.SphereGeometry(0.026, 6, 5),
      nose: new THREE.SphereGeometry(0.045, 8, 6),
    }),
    [],
  );

  // L'écharpe est un canvas : il se régénère quand les couleurs changent.
  const scarf = useMemo(
    () => kenteTexture({ gold: GOLD, goldDeep: GOLD_DEEP, accent: OLIVE, suit: NIGHT, env: NIGHT }),
    [GOLD, GOLD_DEEP, OLIVE, NIGHT],
  );

  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      scarf.dispose();
    },
    [geometry, scarf],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = performance.now() / 1000;
    const target = POSES[state];
    const now = current.current;

    // Interpolation exponentielle : vitesse = 1/BLEND.
    const k = 1 - Math.exp(-dt / BLEND);
    for (const key of Object.keys(target) as (keyof Pose)[]) {
      now[key] += (target[key] - now[key]) * k;
    }

    // Oscillations propres à l'état, ajoutées APRÈS le fondu : le rythme
    // reste net, la transition reste douce.
    let bobExtra = 0;
    let bodyYawExtra = 0;
    let bodyRollExtra = 0;
    let headYawExtra = 0;
    let headRollExtra = 0;
    let armWaveExtra = 0;
    let tailExtra = 0;
    let squash = 1;

    switch (state) {
      case "idle":
        bobExtra = Math.sin(t * 1.6) * 0.045;
        bodyYawExtra = Math.sin(t * 0.7) * 0.12;
        tailExtra = Math.sin(t * 2.1) * 0.45;
        headYawExtra = Math.sin(t * 0.9) * 0.08;
        break;
      case "celebrate": {
        // Petit saut parabolique, deux fois par cycle.
        const cycle = (t % 1.4) / 1.4;
        bobExtra = Math.sin(cycle * Math.PI) * 0.45;
        bodyYawExtra = Math.sin(cycle * Math.PI * 2) * 0.3;
        armWaveExtra = Math.sin(t * 9) * 0.25;
        tailExtra = Math.sin(t * 6) * 0.7;
        break;
      }
      case "nag":
        headYawExtra = Math.sin(t * 5.5) * 0.28;
        headRollExtra = Math.sin(t * 5.5 + 1) * 0.12;
        bodyRollExtra = Math.sin(t * 5.5) * 0.05;
        break;
      case "sleep":
        squash = 1 + Math.sin(t * 1.1) * 0.035; // respiration
        headRollExtra = Math.sin(t * 0.5) * 0.06;
        break;
      case "dance":
        bobExtra = Math.abs(Math.sin(t * 4.2)) * 0.12;
        bodyRollExtra = Math.sin(t * 4.2) * 0.16;
        headRollExtra = Math.sin(t * 2.1) * 0.18;
        armWaveExtra = Math.sin(t * 8.4) * 0.55;
        tailExtra = Math.sin(t * 4.2) * 0.6;
        break;
      case "wave":
        armWaveExtra = Math.sin(t * 7.5) * 0.6;
        bobExtra = Math.sin(t * 1.8) * 0.03;
        headRollExtra = Math.sin(t * 1.5) * 0.06;
        break;
      case "think":
        headYawExtra = Math.sin(t * 1.1) * 0.12;
        headRollExtra = 0.12 + Math.sin(t * 1.1) * 0.05;
        break;
    }

    if (body.current) {
      body.current.position.y = now.bob + bobExtra;
      body.current.rotation.y = now.bodyYaw + bodyYawExtra;
      body.current.rotation.z = now.bodyRoll + bodyRollExtra;
      body.current.scale.set(2 - squash, squash, 2 - squash);
    }
    if (head.current) {
      // Le regard suit le curseur (borne douce pour rester lisible).
      head.current.rotation.y = now.headYaw + headYawExtra + pointer.current.x * 0.35;
      head.current.rotation.x = now.headPitch + pointer.current.y * 0.2;
      head.current.rotation.z = now.headRoll + headRollExtra;
    }
    if (armL.current) armL.current.rotation.z = now.armLeft * 2.1 - 0.15;
    if (armR.current) {
      armR.current.rotation.z = -(now.armRight * 2.1) + 0.15 + (now.armWave + armWaveExtra) * 0.4;
    }
    if (tail.current) {
      tail.current.rotation.z = Math.sin(t * 1.4) * 0.3 + now.tail * 0.6 + tailExtra;
    }
    if (pupils.current) {
      pupils.current.position.x = pointer.current.x * 0.022;
      pupils.current.position.y = -pointer.current.y * 0.016;
    }

    // Caméra fixe : le mascotte reste cadré, la parallaxe vient du regard.
    camera.position.lerp(cameraBase, Math.min(1, dt * 4));
  });

  return (
    <group ref={root} scale={1.15}>
      {/* Queue */}
      <group ref={tail} position={[0.42, -0.1, -0.1]}>
        <mesh geometry={geometry.tail} rotation={[0, 0, -0.9]} position={[0, 0, 0]}>
          <meshBasicMaterial color={GOLD_DEEP} />
        </mesh>
      </group>

      <group ref={body}>
        {/* Hoodie bleu nuit : le buste */}
        <mesh geometry={geometry.hoodie} position={[0, 0, 0]}>
          <meshBasicMaterial color={NIGHT} />
        </mesh>
        {/* Ventre or */}
        <mesh geometry={geometry.torso} position={[0, -0.04, 0.16]} scale={[0.82, 0.86, 0.7]}>
          <meshBasicMaterial color={GOLD} />
        </mesh>
        {/* Bras */}
        <group ref={armL} position={[-0.44, 0.06, 0]}>
          <mesh geometry={geometry.arm} position={[0, -0.2, 0]}>
            <meshBasicMaterial color={GOLD} />
          </mesh>
        </group>
        <group ref={armR} position={[0.44, 0.06, 0]}>
          <mesh geometry={geometry.arm} position={[0, -0.2, 0]}>
            <meshBasicMaterial color={GOLD} />
          </mesh>
        </group>
        {/* Écharpe kenté */}
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.34, 0.075, 6, 18]} />
          <meshBasicMaterial map={scarf} />
        </mesh>

        {/* Tête */}
        <group ref={head} position={[0, 0.52, 0]}>
          {/* Crinière or profond */}
          <mesh geometry={geometry.mane} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={GOLD_DEEP} />
          </mesh>
          <mesh geometry={geometry.head}>
            <meshBasicMaterial color={GOLD} />
          </mesh>
          {/* Oreilles */}
          <mesh geometry={geometry.ear} position={[-0.26, 0.22, 0]} rotation={[0, 0, 0.5]}>
            <meshBasicMaterial color={GOLD} />
          </mesh>
          <mesh geometry={geometry.ear} position={[0.26, 0.22, 0]} rotation={[0, 0, -0.5]}>
            <meshBasicMaterial color={GOLD} />
          </mesh>
          {/* Museau + nez olive */}
          <mesh geometry={geometry.muzzle} position={[0, -0.1, 0.26]}>
            <meshBasicMaterial color={MUZZLE} />
          </mesh>
          <mesh geometry={geometry.nose} position={[0, -0.04, 0.36]}>
            <meshBasicMaterial color={OLIVE} />
          </mesh>
          {/* Yeux + pupilles qui suivent le curseur */}
          <mesh geometry={geometry.eye} position={[-0.13, 0.07, 0.29]}>
            <meshBasicMaterial color={INK} />
          </mesh>
          <mesh geometry={geometry.eye} position={[0.13, 0.07, 0.29]}>
            <meshBasicMaterial color={INK} />
          </mesh>
          <group ref={pupils}>
            <mesh geometry={geometry.pupil} position={[-0.13, 0.07, 0.33]}>
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh geometry={geometry.pupil} position={[0.13, 0.07, 0.33]}>
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Le museau est plus clair que le corps : lisible sur fond bleu nuit. */

export function Mascot({
  state = "idle",
  interactive = true,
  className = "h-44 w-44",
}: {
  state?: MascotState;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.5, 3.2], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Lion state={state} interactive={interactive} />
      </Canvas>
    </div>
  );
}

export default Mascot;
