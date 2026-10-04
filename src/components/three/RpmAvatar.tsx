/* ═══════════════════════════════════════════════════════════════════════
   AVATAR 3D — LECTEUR GLB (Ready Player Me)

   Mon espace affiche l'avatar que l'utilisateur a créé dans le studio RPM.
   On ne stocke que l'URL : aucun octet de modèle ne vit dans notre base, et
   le fichier est ensuite servi par le cache HTTP du navigateur.

   Turntable lent + respiration verticale. Rien de plus : c'est un portrait,
   pas une animation. Si le modèle ne se charge pas (réseau, format, CDN),
   l'appelant affiche son repli (l'emoji actuel) — ce composant ne lève
   jamais d'erreur visible.

   Le composant est chargé en lazy : three.js n'entre dans le bundle
   qu'au premier affichage d'un avatar 3D.
   ═════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

/** Cache mémoire de session : plusieurs usages d'un même avatar ne
    redemandent pas le fichier au CDN. */
const urlCache = new Map<string, THREE.Group>();

function useGltfGroup(url: string): THREE.Group {
  const gltf = useLoader(GLTFLoader, url);
  return useMemo(() => {
    const cached = urlCache.get(url);
    if (cached) return cached;
    // clone() de SkeletonUtils : indispensable pour un avatar skinné, sinon
    // le squelette est partagé entre instances et le premier rendu « bouffe »
    // les animations des suivants.
    const cloned = cloneSkeleton(gltf.scene) as THREE.Group;
    urlCache.set(url, cloned);
    return cloned;
  }, [gltf.scene, url]);
}

function Turntable({ url, reduced }: { url: string; reduced: boolean }) {
  const group = useGltfGroup(url);
  const root = useRef<THREE.Group>(null);

  // Les avatars RPM sont plus grands que l'unité : on cadre large et on
  // remonte pour centrer le visage plutôt que les pieds.
  const box = useMemo(() => new THREE.Box3().setFromObject(group), [group]);
  const center = useMemo(() => box.getCenter(new THREE.Vector3()), [box]);
  const size = useMemo(() => box.getSize(new THREE.Vector3()), [box]);
  const scale = Math.max(1, 1.7 / Math.max(size.y, size.x, 0.001));

  useFrame((state) => {
    if (!root.current) return;
    if (!reduced) {
      root.current.rotation.y = state.clock.elapsedTime * 0.25;
      root.current.position.y = Math.sin(state.clock.elapsedTime * 1.4) * 0.03;
    }
  });

  return (
    <group ref={root} scale={scale} position={[-center.x * scale, 0, -center.z * scale]}>
      <primitive object={group} />
      {/* Lumière douce : la silhouette doit rester lisible sur fond bleu nuit. */}
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 4]} intensity={1.6} color="#FFE9A8" />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} color="#B8956A" />
    </group>
  );
}

export default function RpmAvatar({
  url,
  className = "h-64 w-64",
  onError,
}: {
  url: string;
  className?: string;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (failed) {
    onError?.();
    return null;
  }

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.3, 3], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        onError={() => {
          setFailed(true);
        }}
      >
        <Turntable url={url} reduced={reduced} />
      </Canvas>
    </div>
  );
}
