import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useThemeColors } from "@/hooks/useThemeColors";

/* ═══════════════════════════════════════════════════════════════════
   ATLAS SCENE — champ de particules typographiques (three.js/R3F)

   Chaque particule est un caractère authentique d'une langue servie
   par le catalogue (codes de `convex/languages.ts`) : hanzi, kana,
   hangul, arabe, cyrillique, grec, gé'ez, devanagari, bengali, thaï,
   persan, latin étendu. Formes isolées pour les écritures où la
   lettre se lie — canonique, rien d'inventé.

   Trois couches dans UN seul canvas (une seule boucle de rendu) :
     · coques filaires concentriques — les « espaces » traversés ;
     · nuage de glyphes en 3 coquilles volumétriques (atlas sprites) ;
     · rubans phonétiques (tubes sinusoïdaux, blending additif).

   Les glyphes sont dessinés au canvas 2D par le navigateur (polices
   système) : zéro asset à télécharger, rendu correct sur chaque OS.

   Perfs : MeshBasicMaterial + AdditiveBlending → AUCUNE lumière ;
   dpr plafonné 1.6 ; textures et géométries disposées au démontage ;
   la caméra est pilotée par une ref de scroll partagée (zéro rerender
   React par frame) ; la boucle se coupe hors viewport (frameloop,
   contrôlé par le wrapper AtlasHero).
   ═══════════════════════════════════════════════════════════════════ */

/* ── Écritures réellement servies ──────────────────────────────────── */

const GLYPHS = [
  // Hanzi (mandarin)
  "字", "词", "话",
  // Kana japonais
  "か", "な", "み",
  // Hangul — syllabes de 한글
  "한", "글",
  // Arabe — kaf, lam, mim (isolées)
  "ك", "ل", "م",
  // Cyrillique (russe) — s-l-o-v-o
  "с", "л", "о", "в",
  // Grec — l-e-x-i
  "λ", "ε", "ξ", "η",
  // Gé'ez (amharique)
  "ቃ", "ል",
  // Devanagari (hindi) — ś-a-b-d
  "श", "ब", "द",
  // Bengali — ś-a-b-d
  "শ", "ব", "দ",
  // Thaï
  "ค", "ำ",
  // Persan (isolées) — v, a, ž, h
  "و", "ا", "ژ", "ه",
  // Latin étendu (fr, es, pt, de, it, pl, vi, tr, id, tl…)
  "a", "à", "b", "ç", "é", "è", "f", "g", "h", "i", "l", "m", "n", "o",
  "p", "r", "s", "t", "u", "v", "w", "y", "z",
] as const;

const ATLAS_COLS = 8;
const ATLAS_ROWS = Math.ceil(GLYPHS.length / ATLAS_COLS);

/** Atlas des glyphes : canvas 2D → texture three.js (dispose par l'appelant). */
function buildGlyphAtlas(gold: string): THREE.CanvasTexture {
  const cell = 64;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * cell;
  canvas.height = ATLAS_ROWS * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");

  ctx.font = '44px "Noto Sans", "Segoe UI", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = gold;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  GLYPHS.forEach((glyph, i) => {
    const x = (i % ATLAS_COLS) * cell + cell / 2;
    const y = Math.floor(i / ATLAS_COLS) * cell + cell / 2;
    ctx.fillText(glyph, x, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/* ── Couche 1 : nuage de glyphes (shader points custom) ────────────── */

const POINT_COUNT = 280;

const vertexShader = /* glsl */ `
  attribute float aCell;
  varying float vCell;
  void main() {
    vCell = aCell;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(260.0 / -mv.z, 10.0, 96.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D atlas;
  varying float vCell;
  void main() {
    float col = mod(vCell, ${ATLAS_COLS}.0);
    float row = floor(vCell / ${ATLAS_COLS}.0);
    // gl_PointCoord : y vers le bas ; atlas canvas inversé (flipY).
    vec2 uv = vec2(
      (col + gl_PointCoord.x) / ${ATLAS_COLS}.0,
      (${ATLAS_ROWS}.0 - row - (1.0 - gl_PointCoord.y)) / ${ATLAS_ROWS}.0
    );
    vec4 tex = texture2D(atlas, uv);
    if (tex.a < 0.02) discard;
    gl_FragColor = tex;
  }
`;

function GlyphCloud({ gold }: { gold: string }) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);

  const atlas = useMemo(() => buildGlyphAtlas(gold), [gold]);
  useEffect(() => () => atlas.dispose(), [atlas]);

  /* 3 coquilles concentriques, sphère uniforme, aplatissement Y léger.
     La distribution est DÉTERMINISTE (LCG à graine fixe) : le rendu ne
     dépend jamais d'un Math.random — donc stable au re-render, et le
     champ de glyphes reste identique d'une session à l'autre. */
  const [positions, cells] = useMemo(() => {
    let seed = 0x9e3779b9;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = new Float32Array(POINT_COUNT * 3);
    const cells = new Float32Array(POINT_COUNT);
    for (let i = 0; i < POINT_COUNT; i += 1) {
      const shell = i % 3;
      const radius = 1.5 + shell * 1.45 + (next() - 0.5) * 0.3;
      const theta = next() * Math.PI * 2;
      const phi = Math.acos(2 * next() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.78;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      cells[i] = i % GLYPHS.length;
    }
    return [positions, cells] as const;
  }, []);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    spin.current += delta * 0.05;
    g.rotation.y = spin.current + state.pointer.x * 0.12;
    g.rotation.x = state.pointer.y * 0.06;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aCell" args={[cells, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={{ atlas: { value: atlas } }}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* ── Couche 2 : coques filaires ────────────────────────────────────── */

function Shells({ gold }: { gold: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.02;
    group.current.rotation.z = Math.sin(group.current.rotation.y * 0.4) * 0.08;
  });

  return (
    <group ref={group}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} scale={1.55 + i * 1.5}>
          <sphereGeometry args={[1, 40, 28]} />
          <meshBasicMaterial
            color={gold}
            wireframe
            transparent
            opacity={0.14 - i * 0.03}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Couche 3 : rubans phonétiques ─────────────────────────────────── */

const RIBBONS = [0, 1, 2, 3].map((i) => ({
  tilt: (i / 4) * Math.PI,
  phase: (i / 4) * Math.PI * 2,
}));

function Ribbons({ gold }: { gold: string }) {
  const group = useRef<THREE.Group>(null);

  const geometries = useMemo(
    () =>
      RIBBONS.map((r) => {
        const pts: THREE.Vector3[] = [];
        for (let t = 0; t <= 120; t += 1) {
          const p = (t / 120) * Math.PI * 2;
          const radius = 2.3 + Math.sin(p * 3 + r.phase) * 0.4;
          pts.push(
            new THREE.Vector3(
              Math.cos(p) * radius,
              Math.sin(p * 2 + r.phase) * 0.75,
              Math.sin(p) * radius,
            ),
          );
        }
        const curve = new THREE.CatmullRomCurve3(pts, true);
        return new THREE.TubeGeometry(curve, 100, 0.012, 6, true);
      }),
    [],
  );

  useEffect(
    () => () => {
      geometries.forEach((geo) => geo.dispose());
    },
    [geometries],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const r = RIBBONS[i];
      if (!r) return;
      child.rotation.z = r.tilt * 0.2 + Math.sin(clock.elapsedTime * 0.4 + i) * 0.06;
    });
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.2;
  });

  return (
    <group ref={group}>
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshBasicMaterial
            color={gold}
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Caméra pilotée par la ref de scroll (0→1) + parallaxe pointeur ─── */

function CameraRig({ scrollProgress }: { scrollProgress: { current: number } }) {
  const { camera } = useThree();
  const pointer = useRef({ x: 0, y: 0 });

  /* eslint-disable react-hooks/immutability -- c'est le rôle même
     d'un rig de caméra R3F : muter la caméra (et les accumulateurs de
     lissage) pendant la frame, hors du cycle de rendu React. */
  useFrame((state, delta) => {
    const p = scrollProgress.current;
    const ease = Math.min(1, delta * 3);

    // Plonger vers le centre (z 6.5 → 2.3) tout en montant légèrement :
    // on TRAVERSE la 1re coque, puis on embrasse l'ensemble.
    const targetZ = 6.5 - p * 4.2;
    const targetY = p * 1.1;
    const targetX = Math.sin(p * Math.PI) * 0.7;

    pointer.current.x += (state.pointer.x - pointer.current.x) * ease;
    pointer.current.y += (state.pointer.y - pointer.current.y) * ease;

    camera.position.x += (targetX + pointer.current.x * 0.5 - camera.position.x) * ease;
    camera.position.y += (targetY + pointer.current.y * 0.35 - camera.position.y) * ease;
    camera.position.z += (targetZ - camera.position.z) * ease;
    camera.lookAt(0, targetY * 0.4, 0);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}

/* ── Scène publique ────────────────────────────────────────────────── */

export function AtlasScene({
  scrollProgress,
  frameloop = "always",
}: {
  /** Ref externe 0→1, écrite par le scroll de la Landing (useScroll). */
  scrollProgress: { current: number };
  /** "demand" hors viewport : le GPU se met réellement au repos. */
  frameloop?: "always" | "demand";
}) {
  /* ── Scène publique ── (rappel : gold suit le thème actif) */
  const colors = useThemeColors();
  const gold = colors.gold ?? "#f5c542";

  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={frameloop}
      camera={{ position: [0, 0, 6.5], fov: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <Shells gold={gold} />
      <GlyphCloud gold={gold} />
      <Ribbons gold={gold} />
      <CameraRig scrollProgress={scrollProgress} />
    </Canvas>
  );
}

export default AtlasScene;
