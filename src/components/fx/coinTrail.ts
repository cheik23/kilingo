/* ═══════════════════════════════════════════════════════════════════════
   TRAÎNÉE DE PIÈCES (LOT H) — 15 particules dorées qui partent du point de
   gain et rejoignent le compteur de gems du header, en 800 ms.

   Pourquoi un canvas et pas 15 <span> animés : la traînée est un élément
   décoratif TOTALEMENT à part de l'arbre React (un seul canvas plein écran,
   supprimé à la fin). Aucun composant ne se re-rend 60 fois par seconde, et
   rien ne peut perturber la mise en page de la page qui affiche le gain.

   Garde-fous, dans l'ordre :
   - `prefers-reduced-motion` ⇒ no-op, rien n'est créé ;
   - pas de compteur trouvé (page sans header, test, SSR) ⇒ no-op ;
   - pas de contexte 2D (canvas bloqué) ⇒ le canvas est retiré aussitôt.

   `data-coin-target` est le contrat explicite ; les sélecteurs de repli
   évitent de dépendre d'une classe Tailwind qui peut changer.
   ═══════════════════════════════════════════════════════════════════════ */

const DURATION_MS = 800;
const PIECES = 15;
/** Cadence : chaque pièce part un souffle après la précédente. */
const STAGGER_MS = 12;

const TARGET_SELECTORS = [
  "[data-coin-target]",
  'header a[href="/app/store"]',
  'a[href="/app/store"]',
];

export type CoinPoint = { x: number; y: number };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function findTarget(explicit?: Element | null): Element | null {
  if (explicit && explicit.isConnected) return explicit;
  for (const selector of TARGET_SELECTORS) {
    const found = document.querySelector(selector);
    if (found) return found;
  }
  return null;
}

/** Le compteur respire deux fois : l'œil suit la traînée jusqu'au solde. */
function pulseCounter(el: Element): void {
  el.classList.remove("ln-coin-pulse");
  // Reflow forcé : sans lui, une deuxième traînée ne relance pas l'animation.
  void (el as HTMLElement).offsetWidth;
  el.classList.add("ln-coin-pulse");
  window.setTimeout(() => el.classList.remove("ln-coin-pulse"), 1_200);
}

/**
 * Envoie 15 pièces dorées de `from` (coordonnées écran) vers le compteur de
 * gems du header. Sans effet si les animations sont désactivées.
 */
export function coinTrail(from: CoinPoint, targetEl?: Element | null): void {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  const target = findTarget(targetEl ?? null);
  if (!target) return;

  const box = target.getBoundingClientRect();
  const to: CoinPoint = {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "95";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: PIECES }, (_, i) => ({
    delay: i * STAGGER_MS,
    size: 2.5 + Math.random() * 2.5,
    // Arc propre à chaque pièce : la traînée ressemble à une poignée de
    // pièces jetées, pas à un tuyau.
    spread: (Math.random() - 0.5) * 110,
    lift: -(30 + Math.random() * 110),
    spin: Math.random() * Math.PI * 2,
    spinSpeed: (Math.random() - 0.5) * 10,
  }));

  const start = performance.now();
  pulseCounter(target);

  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    let alive = false;

    for (const piece of pieces) {
      const t = (elapsed - piece.delay) / DURATION_MS;
      if (t < 0) {
        alive = true;
        continue;
      }
      if (t >= 1) continue;
      alive = true;

      const eased = t * t * (3 - 2 * t); // smoothstep
      const arc = Math.sin(Math.PI * t);
      const x = from.x + (to.x - from.x) * eased + piece.spread * arc;
      const y = from.y + (to.y - from.y) * eased + piece.lift * arc;
      // Disparition franche sur les 15 % derniers : pas de fondu mou.
      const alpha = t < 0.85 ? 1 : Math.max(0, (1 - t) / 0.15);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(piece.spin + t * piece.spinSpeed);
      const glow = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        piece.size * 2.2,
      );
      glow.addColorStop(0, "#fff7d6");
      glow.addColorStop(0.55, "#f5c542");
      glow.addColorStop(1, "rgba(245, 197, 66, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, piece.size * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (alive) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(frame);
}

/** Même traînée, depuis le centre d'un élément (bouton, carte, trophée). */
export function coinTrailFrom(el: Element | null): void {
  if (!el) return;
  const box = el.getBoundingClientRect();
  coinTrail({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
}
