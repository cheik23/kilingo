/* ═══════════════════════════════════════════════════════════════════
   HERO STATIQUE — repli 100 % CSS, zéro WebGL.
   Utilisé quand : reduced-motion, device low-end, WebGL indisponible,
   ou garde FPS déclenchée. Moins riche que la 3D mais garde la même
   identité lumineuse (menthe / turquoise / rose / ivoire) : illusion
   d'un globe satiné par dégradés radiaux superposés — jamais une
   simple série de cercles au trait.
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
      {/* Lueur d'ambiance : nappe rose / menthe qui répond au thème. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(52rem 36rem at 62% 38%, color-mix(in srgb, var(--gradient-magenta, #F3A9C8) 14%, transparent), transparent 62%)," +
            "radial-gradient(60rem 44rem at 36% 70%, color-mix(in srgb, var(--gold, #42CDBA) 12%, transparent), transparent 64%)",
        }}
      />
      {/* Globe satiné : demi-ton turquoise + éclairage ivoire haut-gauche. */}
      <div
        className="absolute left-1/2 top-1/2 size-[min(62vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 26%, #FFF8EF 0%, #A7E8D6 26%, #42CDBA 58%, #17484A 130%)",
          opacity: 0.4,
          boxShadow:
            "inset -18px -24px 48px rgba(23,72,74,0.35), inset 10px 14px 32px rgba(255,248,239,0.38)",
        }}
      />
      {/* Horizon : double liseré doux qui respire au rythme du thème. */}
      <div className="absolute left-1/2 top-1/2 h-[min(46vw,20rem)] w-[min(78vw,38rem)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-gold/20" />
      <div className="absolute left-1/2 top-1/2 h-[min(34vw,14rem)] w-[min(60vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-gold/10 bg-gold/[0.04]" />
      {/* Poussière lumineuse pastel. */}
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
