import { useMemo } from "react";
import * as THREE from "three";
import { DIORAMA } from "./worlds";

/* ═══════════════════════════════════════════════════════════════════
   MONUMENTS PROCÉDURAUX — dioramas miniatures de Kɪ́LINGO

   Chaque monument est un COMPOSANT indépendant (jamais fusionné en
   une seule image) : le hero peut animer sa position, sa montée de
   scène et son survol un par un. Volumes arrondis, matériaux doux et
   satinés (MeshStandardMaterial), pastel lumineux, lisible sous tous
   les angles.

   Limite documentée (docs/limites-3d.md) : aucun .glb Tripo n'a pu
   être généré dans cet environnement (aucune clé API). Ces monuments
   100 % procéduraux tiennent le rôle du premier prototype : ils sont
   révélés, animés et cliquables — et restent remplaçables un par un
   par des assets générés, puisque chacun vit dans son propre group.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Matériaux partagés ────────────────────────────────────────────── */

const SATIN = { roughness: 0.55, metalness: 0.06 } as const;

function Plaster({ color = DIORAMA.stone }: { color?: string }) {
  return <meshStandardMaterial color={color} {...SATIN} />;
}

function Rose() {
  return <meshStandardMaterial color={DIORAMA.rose} {...SATIN} />;
}

function Turquoise() {
  return <meshStandardMaterial color={DIORAMA.turquoise} {...SATIN} />;
}

function Ink() {
  return <meshStandardMaterial color={DIORAMA.ink} {...SATIN} />;
}

function Flora() {
  return <meshStandardMaterial color={DIORAMA.flora} roughness={0.7} metalness={0.02} flatShading />;
}

function Snow() {
  return <meshStandardMaterial color={DIORAMA.snow} roughness={0.85} metalness={0} flatShading />;
}

function StoneWarm() {
  return <meshStandardMaterial color={DIORAMA.stoneWarm} {...SATIN} />;
}

/* ── FR — Tour Eiffel : grille de volume + flèche ──────────────────── */

export function EiffelTower() {
  const legs = [-1, 1] as const;
  return (
    <group>
      {/* Empattement */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.3]} />
        <Plaster color={DIORAMA.stoneWarm} />
      </mesh>
      {/* Quatre pieds évasés */}
      {legs.map((sx) =>
        legs.map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.085, 0.13, sz * 0.085]} rotation={[sz * 0.14, 0, -sx * 0.14]}>
            <boxGeometry args={[0.045, 0.26, 0.045]} />
            <Ink />
          </mesh>
        )),
      )}
      {/* 1re plateforme */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.24, 0.035, 0.24]} />
        <Turquoise />
      </mesh>
      {/* Monde intermédiaire */}
      {legs.map((sx) =>
        legs.map((sz) => (
          <mesh key={`m${sx}${sz}`} position={[sx * 0.045, 0.4, sz * 0.045]} rotation={[sz * 0.1, 0, -sx * 0.1]}>
            <boxGeometry args={[0.035, 0.2, 0.035]} />
            <Ink />
          </mesh>
        )),
      )}
      {/* 2e plateforme */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.15, 0.03, 0.15]} />
        <Turquoise />
      </mesh>
      {/* Flèche */}
      <mesh position={[0, 0.66, 0]}>
        <coneGeometry args={[0.05, 0.26, 8]} />
        <Ink />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.06, 6]} />
        <Rose />
      </mesh>
    </group>
  );
}

/* ── FR — Arc de triomphe : trois piliers + fronton arqué ──────────── */

export function ArcDeTriomphe() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.11, 0.1, 0]}>
          <boxGeometry args={[0.09, 0.2, 0.09]} />
          <Plaster />
        </mesh>
      ))}
      {/* Arche (tore aplati) */}
      <mesh position={[0, 0.1, 0]} scale={[0.9, 1, 0.75]}>
        <torusGeometry args={[0.09, 0.018, 6, 16, Math.PI]} />
        <Plaster color={DIORAMA.stoneWarm} />
      </mesh>
      {/* Fronton */}
      <mesh position={[0, 0.235, 0]}>
        <boxGeometry args={[0.32, 0.07, 0.09]} />
        <Plaster />
      </mesh>
      <mesh position={[0, 0.285, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.07]} />
        <Rose />
      </mesh>
    </group>
  );
}

/* ── FR — Château de la Loire : corps + 4 tours coniques ───────────── */

export function LoireCastle() {
  const corners = [
    [-0.12, -0.08],
    [-0.12, 0.08],
    [0.12, -0.08],
    [0.12, 0.08],
  ] as const;
  return (
    <group>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[0.26, 0.14, 0.18]} />
        <Plaster />
      </mesh>
      {/* Toit pavillon rose pastel sur le corps */}
      <mesh position={[0, 0.16, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.15, 0.07, 4]} />
        <Rose />
      </mesh>
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.28, 10]} />
            <Plaster color={DIORAMA.stoneWarm} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <coneGeometry args={[0.05, 0.09, 10]} />
            <Turquoise />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── ZH — Temple du Ciel : tambour + triple toit turquoise ─────────── */

export function TempleOfHeaven() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <Rose />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.09, 6]} />
        <Ink />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <coneGeometry args={[0.06, 0.07, 14]} />
        <Turquoise />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <coneGeometry args={[0.1, 0.075, 14]} />
        <Turquoise />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <coneGeometry args={[0.14, 0.08, 14]} />
        <Turquoise />
      </mesh>
      {/* Tambour */}
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.1, 0.11, 0.15, 14]} />
        <Plaster />
      </mesh>
      {/* Socle en trois gradins (méridien du temple réel) */}
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.15, 0.16, 0.024, 14]} />
        <Plaster color={DIORAMA.stoneWarm} />
      </mesh>
    </group>
  );
}

/* ── ZH — Tour de la Muraille (segment + échauguette) ──────────────── */

export function GreatWallTower() {
  const merlons = Array.from({ length: 6 }, (_, i) => -0.125 + i * 0.05);
  return (
    <group>
      {/* Segment de muraille en pente douce */}
      <mesh position={[0, 0.045, 0]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[0.42, 0.09, 0.08]} />
        <Plaster color={DIORAMA.stoneWarm} />
      </mesh>
      {merlons.map((x) => (
        <mesh key={x} position={[x, 0.1, 0]}>
          <boxGeometry args={[0.022, 0.02, 0.075]} />
          <Plaster />
        </mesh>
      ))}
      {/* Tour de guet */}
      <group position={[0.05, 0, 0]}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.11, 0.16, 0.11]} />
          <Plaster />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.13, 0.02, 0.13]} />
          <Rose />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.055, 0.28, 0]}>
            <boxGeometry args={[0.03, 0.05, 0.03]} />
            <Turquoise />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ── ZH — Pagode : 3 étages rétrécissants ──────────────────────────── */

export function Pagoda() {
  const tiers = [
    { y: 0.08, w: 0.19, hy: 0.11 },
    { y: 0.21, w: 0.14, hy: 0.09 },
    { y: 0.3, w: 0.1, hy: 0.07 },
  ] as const;
  return (
    <group>
      {tiers.map((t, i) => (
        <group key={i} position={[0, t.y, 0]}>
          <mesh>
            <boxGeometry args={[t.w, t.hy * 2 - 0.035, t.w * 0.82]} />
            <Plaster />
          </mesh>
          <mesh position={[0, t.hy, 0]} scale={[1, 0.38, 1]}>
            <coneGeometry args={[t.w * 0.85, 0.09, 4]} />
            <Rose />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <Turquoise />
      </mesh>
    </group>
  );
}

/* ── SW — Kilimandjaro : volcan couronné de neige ──────────────────── */

export function Kilimanjaro() {
  const rocks = Array.from({ length: 5 }, (_, i) => ({
    x: Math.cos((i / 5) * Math.PI * 2) * 0.13,
    z: Math.sin((i / 5) * Math.PI * 2) * 0.13,
    s: 0.025 + (i % 3) * 0.008,
  }));
  return (
    <group>
      <mesh position={[0, 0.09, 0]}>
        <coneGeometry args={[0.17, 0.18, 9]} />
        <Flora />
      </mesh>
      {/* Calotte de neige */}
      <mesh position={[0, 0.163, 0]}>
        <coneGeometry args={[0.058, 0.05, 9]} />
        <Snow />
      </mesh>
      {/* Rochers au pied */}
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, r.s * 0.6, r.z]}>
          <icosahedronGeometry args={[r.s, 0]} />
          <StoneWarm />
          <StoneWarm />
        </mesh>
      ))}
    </group>
  );
}

/* ── SW — Acacia de la savane : tronc fin + parasols plats ─────────── */

export function Acacia() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.008, 0.014, 0.12, 6]} />
        <Plaster color={DIORAMA.stoneWarm} />
      </mesh>
      {/* Branches évasées */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.03, 0.125, 0]} rotation={[0, 0, s * 0.5]}>
          <cylinderGeometry args={[0.004, 0.006, 0.07, 5]} />
          <Plaster color={DIORAMA.stoneWarm} />
        </mesh>
      ))}
      {/* Deux parasols aplatis */}
      <mesh position={[0, 0.155, 0]} scale={[1.7, 0.4, 1.35]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <Flora />
      </mesh>
      <mesh position={[0.015, 0.125, 0.02]} scale={[1.1, 0.35, 0.9]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <Flora />
      </mesh>
    </group>
  );
}

/* ── SW — Dhow de Zanzibar : coque + lateen turquoise ──────────────── */

export function Dhow() {
  const sail = useMemo(() => {
    const shape = new THREE.BufferGeometry();
    shape.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0.02, 0, 0.21, 0.2, 0, 0, 0.36, 0], 3),
    );
    shape.computeVertexNormals();
    return shape;
  }, []);

  return (
    <group>
      {/* Coque */}
      <mesh scale={[1.5, 0.5, 0.8]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[0.085, 12, 10, 0, Math.PI * 2, Math.PI / 2.1, Math.PI / 2.1]} />
        <Plaster color={DIORAMA.stoneWarm} />
      </mesh>
      <mesh position={[0, 0.012, 0]} scale={[1.48, 0.28, 0.78]}>
        <sphereGeometry args={[0.085, 12, 8]} />
        <Plaster />
      </mesh>
      {/* Mât */}
      <mesh position={[0, 0.22, 0]} rotation={[0, 0, 0.22]}>
        <cylinderGeometry args={[0.004, 0.004, 0.36, 6]} />
        <Ink />
      </mesh>
      {/* Voile latine */}
      <mesh geometry={sail}>
        <meshStandardMaterial color={DIORAMA.roseSoft} {...SATIN} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
