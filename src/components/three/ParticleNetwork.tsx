import { useEffect, useMemo, useRef } from "react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════
   FOND 3D — RÉSEAU DE PARTICULES (MODULE 1)

   150 points qui dérivent lentement dans un volume 20 × 20 × 10, reliés
   entre eux quand ils passent à moins de 3 unités. 70 % or terre,
   30 % vert olive. La rotation globale est lente (0.01 rad/s)
   et le curseur ajoute au plus 0.05 rad de parallaxe.

   Coûts assumés :
     • les buffers (positions, vitesses, couleurs, segments) sont alloués
       UNE fois et réécrits en place — aucune allocation par frame ;
     • `setDrawRange` limite le rendu aux segments réellement présents ;
     • le volume est torique (les points rebouclent) : pas d'amas
       artifiel sur les bords ;
     • `dpr={[1, 1.5]}` partout, jamais 2× sur Retina ;
     • hors viewport le `frameloop` passe à « demand » : plus une frame ;
     • reduced-motion → vitesses et rotation à zéro, une seule image.

   Ce fichier est un CHUNK SÉPARÉ : il n'est importé que dynamiquement
   depuis NetworkBackdrop, jamais dans le bundle initial.
   ═══════════════════════════════════════════════════════════════════════ */

const COUNT = 150;
const HALF_X = 10;
const HALF_Y = 10;
const HALF_Z = 5;
/** Au-delà, deux points ne sont plus reliés (carré de la distance). */
const LINK_LIMIT_SQ = 9;
/** Plafond de segments préalloués — largement au-dessus du réel. */
const MAX_SEGMENTS = 900;

function buildState(GOLD: THREE.Color, ACCENT: THREE.Color) {
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const linePositions = new Float32Array(MAX_SEGMENTS * 2 * 3);
  const lineColors = new Float32Array(MAX_SEGMENTS * 2 * 3);

  const color = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    const x = (Math.random() * 2 - 1) * HALF_X;
    const y = (Math.random() * 2 - 1) * HALF_Y;
    const z = (Math.random() * 2 - 1) * HALF_Z;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // VITESSE LENTE : 0.02–0.05 u/s, direction aléatoire par axe.
    velocities[i * 3] = (Math.random() * 2 - 1) * 0.05;
    velocities[i * 3 + 1] = (Math.random() * 2 - 1) * 0.05;
    velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.03;

    // 70 % or vif / 30 % magenta.
    color.copy(Math.random() < 0.3 ? ACCENT : GOLD);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return { positions, velocities, colors, linePositions, lineColors };
}

function Network({ animate }: { animate: boolean }) {
  const { gold, accent } = useThemeColors();
  const GOLD = useMemo(() => new THREE.Color(gold), [gold]);
  const ACCENT = useMemo(() => new THREE.Color(accent), [accent]);
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);

  // Les couleurs de particules sont cuites dans les buffers : elles se
  // reconstruisent quand le thème change (rare), pas à chaque frame.
  const { positions, velocities, colors, linePositions, lineColors } = useMemo(
    () => buildState(GOLD, ACCENT),
    [GOLD, ACCENT],
  );

  const pointsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [positions, colors]);

  const linesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    geometry.setDrawRange(0, 0);
    return geometry;
  }, [linePositions, lineColors]);

  // Les tampons sont recréés au changement de thème : on libère les anciens.
  useEffect(
    () => () => {
      pointsGeometry.dispose();
      linesGeometry.dispose();
    },
    [pointsGeometry, linesGeometry],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05); // on ne saute pas après un onglet en veille
    const pointerX = state.pointer.x;
    const pointerY = state.pointer.y;

    if (animate) {
      // Dérive + rebouclage torique.
      for (let i = 0; i < COUNT; i++) {
        const o = i * 3;
        let x = positions[o] + velocities[o] * dt;
        let y = positions[o + 1] + velocities[o + 1] * dt;
        let z = positions[o + 2] + velocities[o + 2] * dt;
        if (x > HALF_X) x -= HALF_X * 2;
        else if (x < -HALF_X) x += HALF_X * 2;
        if (y > HALF_Y) y -= HALF_Y * 2;
        else if (y < -HALF_Y) y += HALF_Y * 2;
        if (z > HALF_Z) z -= HALF_Z * 2;
        else if (z < -HALF_Z) z += HALF_Z * 2;
        positions[o] = x;
        positions[o + 1] = y;
        positions[o + 2] = z;
      }

      spin.current += dt * 0.01; // rotation globale lente
    }

    // Connexions : on reconstruit la liste complète chaque frame. À
    // 150 points cela représente ~11 000 paires, soit un coût négligeable
    // comparé au rendu — et l'alternative (grille de voisinage) alourdirait
    // le code sans gain mesurable ici.
    let segments = 0;
    for (let i = 0; i < COUNT && segments < MAX_SEGMENTS; i++) {
      const oi = i * 3;
      for (let j = i + 1; j < COUNT && segments < MAX_SEGMENTS; j++) {
        const oj = j * 3;
        const dx = positions[oi] - positions[oj];
        const dy = positions[oi + 1] - positions[oj + 1];
        const dz = positions[oi + 2] - positions[oj + 2];
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > LINK_LIMIT_SQ) continue;

        const base = segments * 6;
        linePositions[base] = positions[oi];
        linePositions[base + 1] = positions[oi + 1];
        linePositions[base + 2] = positions[oi + 2];
        linePositions[base + 3] = positions[oj];
        linePositions[base + 4] = positions[oj + 1];
        linePositions[base + 5] = positions[oj + 2];

        // « Opacité selon la distance » : pas d'alpha par sommet possible
        // avec LineBasicMaterial, donc on assombrit la couleur — un fil
        // lointain s'éteint visuellement sans coût de tri.
        const strength = 1 - Math.sqrt(distSq) / 3;
        for (let end = 0; end < 2; end++) {
          const c = base + end * 3;
          const tint = end === 0 ? 1 : 0.7;
          lineColors[c] = GOLD.r * strength * tint;
          lineColors[c + 1] = GOLD.g * strength * tint;
          lineColors[c + 2] = GOLD.b * strength * tint;
        }
        segments += 1;
      }
    }

    pointsGeometry.attributes.position.needsUpdate = true;
    linesGeometry.attributes.position.needsUpdate = true;
    linesGeometry.attributes.color.needsUpdate = true;
    linesGeometry.setDrawRange(0, segments * 2);

    const node = group.current;
    if (node) {
      node.rotation.y = spin.current + pointerX * 0.05;
      node.rotation.x = pointerY * 0.05;
    }
  });

  return (
    <group ref={group}>
      <points geometry={pointsGeometry}>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.15} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

export function ParticleNetwork({
  className = "",
  visible = true,
  animate = true,
}: {
  className?: string;
  /** false = hors viewport ⇒ frameloop « demand ». */
  visible?: boolean;
  /** false = reduced-motion : image fixe. */
  animate?: boolean;
}) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible && animate ? "always" : "demand"}
        camera={{ position: [0, 0, 26], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <Network animate={animate} />
      </Canvas>
    </div>
  );
}

export default ParticleNetwork;
