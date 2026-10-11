/* ═══════════════════════════════════════════════════════════════════════
   LIGUES — libellés, teintes et type d'entrée de classement.

   Sortis du composant `RankingItem` pour deux raisons : un module de
   constantes partagé par la page Classement et la page Profil (qui
   affiche aussi la ligue), et un fichier de composant qui n'exporte que
   des composants (fast refresh préservé).
   ═══════════════════════════════════════════════════════════════════════ */

export const LEAGUE_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Argent",
  gold: "Or",
  platinum: "Platine",
  diamond: "Diamant",
};

/** Classes Tailwind par ligue (bordure + fond + texte), thème sombre et clair. */
export const LEAGUE_TONES: Record<string, string> = {
  bronze: "border-[#cd7f32]/35 bg-[#cd7f32]/10 text-[#cd7f32]",
  silver: "border-slate-300/35 bg-slate-300/10 text-slate-300",
  gold: "border-gold/40 bg-gold/10 text-gold",
  platinum: "border-cyan-200/35 bg-cyan-200/10 text-cyan-200",
  diamond: "border-sky-200/40 bg-sky-200/10 text-sky-200",
};

/** Une ligne de classement, telle que renvoyée par `ranking.*`. */
export type RankingEntry = {
  userId: string;
  name: string;
  image: string | null;
  rpmAvatarUrl: string | null;
  rank: number;
  xp: number;
  league: string;
  previousRank: number | null;
  rankDelta: number;
  isYou: boolean;
};
