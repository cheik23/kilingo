/* ═══════════════════════════════════════════════════════════════════════
   JABARI — TÊTE 2D (sprite de repli)

   La version SVG de la tête du lion, sans three.js : c'est elle qui
   s'affiche quand le 3D est impossible (reduced-motion, device low-end,
   pas de WebGL, mode dégradé après le watchdog FPS) ET celle qui sert de
   petite tête dans les surfaces textuelles (pilule de streak, cloche de
   notifications, logo).

   Même palette que la scène 3D — l'un et l'autre doivent se ressembler.
   Chaque état a une petite variation d'expression (yeux, sourcils,
   inclination) pour que la bulle et le visage disent la même chose.
   ═══════════════════════════════════════════════════════════════════════ */

import { useThemeColors } from "@/hooks/useThemeColors";

export type MascotSpriteState =
  | "idle"
  | "celebrate"
  | "nag"
  | "sleep"
  | "dance"
  | "wave"
  | "think";

/** Yeux par état : [écartement vertical, forme des sourcils, paupières]. */
const FACES: Record<
  MascotSpriteState,
  { eye: number; brow: number; lid: boolean; tilt: number }
> = {
  idle: { eye: 3, brow: 0, lid: false, tilt: 0 },
  celebrate: { eye: 5, brow: -1, lid: false, tilt: -4 },
  nag: { eye: 2.5, brow: 1, lid: false, tilt: 8 },
  sleep: { eye: 0, brow: 0, lid: true, tilt: 14 },
  dance: { eye: 4, brow: -0.5, lid: false, tilt: -8 },
  wave: { eye: 4, brow: -0.5, lid: false, tilt: -6 },
  think: { eye: 2, brow: 0.5, lid: false, tilt: 10 },
};

export function MascotSprite({
  state = "idle",
  className = "size-10",
  rounded = true,
}: {
  state?: MascotSpriteState;
  className?: string;
  /** Halo rond pour les mini-icônes ; false pour une zone plate. */
  rounded?: boolean;
}) {
  // Mêmes teintes que la scène 3D, donc mêmes tokens de thème : le sprite
  // et le lion restent d'accord en clair comme en sombre.
  const { gold: GOLD, goldDeep: GOLD_DEEP, suit: NIGHT, accent: OLIVE } = useThemeColors();
  const face = FACES[state];
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Jabari"
    >
      {rounded && (
        <circle cx="32" cy="32" r="31" fill={NIGHT} stroke={GOLD_DEEP} strokeWidth="2" />
      )}
      {/* Crinière */}
      <g transform={`rotate(${face.tilt} 32 34)`}>
        <circle cx="32" cy="34" r="21" fill={GOLD_DEEP} />
        {/* Oreilles */}
        <circle cx="16" cy="18" r="6" fill={GOLD} />
        <circle cx="48" cy="18" r="6" fill={GOLD} />
        {/* Face */}
        <circle cx="32" cy="33" r="17" fill={GOLD} />
        {/* Museau */}
        <ellipse cx="32" cy="40" rx="9" ry="7" fill="#EFDCBE" />
        {/* Nez */}
        <path d="M32 36.5 l-3 -3 h6 z" fill={OLIVE} />
        {/* Yeux */}
        <circle cx="25" cy="30" r="2.6" fill="#1E120A" />
        <circle cx="39" cy="30" r="2.6" fill="#1E120A" />
        {face.lid ? (
          <>
            <path d="M22 30 q3 -2 6 0" stroke="#1E120A" strokeWidth="1.6" fill="none" />
            <path d="M36 30 q3 -2 6 0" stroke="#1E120A" strokeWidth="1.6" fill="none" />
          </>
        ) : (
          <>
            <circle cx="25" cy={30 - face.eye * 0.35} r="0.9" fill="#fff" />
            <circle cx="39" cy={30 - face.eye * 0.35} r="0.9" fill="#fff" />
          </>
        )}
        {/* Sourcils : le signal d'humeur le plus lisible */}
        <path
          d={`M21 ${24 - face.brow} q4 ${-2 - face.brow} 8 ${-1 - face.brow}`}
          stroke={GOLD_DEEP}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M35 ${23 - face.brow} q4 ${-1 - face.brow} 8 ${-2 - face.brow}`}
          stroke={GOLD_DEEP}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Bouche : sourire, «Bouh ! » ou moue de dormeur */}
        {state === "sleep" ? (
          <path d="M29 45 q3 2 6 0" stroke="#1E120A" strokeWidth="1.4" fill="none" />
        ) : state === "nag" ? (
          <path d="M28 45 q4 -3 8 0" stroke="#1E120A" strokeWidth="1.5" fill="none" />
        ) : (
          <path
            d={`M27 43 q5 ${state === "celebrate" ? 6 : 4} 10 0`}
            stroke="#1E120A"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </g>
      {/* Écharpe kenté : deux bandes, juste assez pour la signature */}
      <rect x="18" y="53" width="28" height="5" rx="2.5" fill={NIGHT} />
      <rect x="22" y="53" width="6" height="5" rx="2.5" fill={GOLD} />
      <rect x="32" y="53" width="5" height="5" rx="2.5" fill={OLIVE} />
    </svg>
  );
}

export default MascotSprite;
