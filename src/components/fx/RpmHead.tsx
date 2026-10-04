/* ═══════════════════════════════════════════════════════════════════════
   PORTRAIT DE TÊTE — AVATAR 3D EN MINIATURE

   Pour les surfaces où un GLB serait disproportionné (classement, en-tête
   de conversation) : Ready Player Me rend le même modèle en PNG portrait
   de tête via sa route d'export. On transforme donc l'URL `.glb` en
   `.png?…&view=head`.

   Zéro three.js ici — c'est une simple <img>. Repli immédiat sur le
   sprite de Jabari si l'image ne répond pas (CDN injoignable, avatar
   supprimé entre-temps). Rien n'est chargé tant que l'élément entre
   dans le viewport.
   ═════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";

import { MascotSprite } from "@/components/three/MascotSprite";

/** Memo des URL dérivées : le classement affiche jusqu'à 100 lignes. */
const derived = new Map<string, string>();

function headRenderUrl(glbUrl: string): string {
  const cached = derived.get(glbUrl);
  if (cached) return cached;
  const url = glbUrl.replace(
    /\.glb(\?|$)/,
    ".png?size=128&armature=0x62&body=head&view=head&expression=happy&$1",
  );
  derived.set(glbUrl, url);
  return url;
}

export function RpmHead({
  url,
  className = "size-10",
  alt = "",
}: {
  url: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }
    setFailed(false);
    const el = ref.current;
    if (!el) {
      setSrc(headRenderUrl(url));
      return;
    }
    if (!("IntersectionObserver" in window)) {
      setSrc(headRenderUrl(url));
      return;
    }
    // Chargement paresseux : seuls les portraits visibles partent en réseau.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSrc(headRenderUrl(url));
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url]);

  if (!url || failed || !src) {
    return <MascotSprite state="idle" className={className} />;
  }

  return (
    <span
      ref={ref}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-noir-2 ring-1 ring-gold/25 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export default RpmHead;
