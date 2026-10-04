/* ═══════════════════════════════════════════════════════════════════
   HERO STATIQUE — repli 100 % CSS, zéro WebGL.
   Utilisé quand : reduced-motion, device low-end, WebGL indisponible,
   ou garde FPS déclenchée. Rendu identical en or/noir.
   ═══════════════════════════════════════════════════════════════════ */

const DUST = Array.from({ length: 26 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 53) % 100}%`,
  delay: `${(index % 7) * 0.6}s`,
  duration: `${9 + (index % 5) * 2.4}s`,
  size: 1 + (index % 3) * 0.6,
}));

export function StaticHero() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(212,165,116,0.18),transparent_58%)]" />
      <div className="absolute left-1/2 top-1/2 size-[min(78vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/20" />
      <div className="absolute left-1/2 top-1/2 size-[min(58vw,25rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/10" />
      <div className="absolute left-1/2 top-1/2 size-[min(38vw,16rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/15 bg-gold/[0.04]" />
      <div className="ln-dust absolute inset-0">
        {DUST.map((dot, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-gold/50"
            style={{
              left: dot.left,
              top: dot.top,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              animation: `ln-drift ${dot.duration} ease-in-out ${dot.delay} infinite alternate`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default StaticHero;
