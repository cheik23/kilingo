import {
  Globe2,
  Flame,
  Target,
  Crown,
  BookOpen,
  Zap,
  Star,
  MessagesSquare,
  Drama,
  Briefcase,
  Heart,
  Mic2,
  Gamepad2,
  Landmark,
  Trophy,
  Gem,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   BADGES (Phase 2/4) — source unique des ids, libellés et récompenses.

   Les badges sont stockés côté serveur comme ids (table userStats.badges).
   Les conditions « auto » (perfectionniste, rapide, streak7, level10) sont
   attribuées par quizEngine:submitQuiz ; les autres sont des objectifs UI
   (progression affichée via gamification:getBadgeProgress, attribution
   ultérieure).
   ═══════════════════════════════════════════════════════════════════ */

export type BadgeId =
  | "polyglotte"
  | "streak7"
  | "perfectionniste"
  | "maitreRue"
  | "erudit"
  | "rapide"
  | "level10"
  // Badges spéciaux conversation (Phase 3/4)
  | "polyglotte_conversationnel"
  | "acteur_ne"
  | "negociateur"
  | "tombeur"
  | "mc"
  | "gamer_pro_badge"
  | "sage"
  | "maitre_scenarios"
  | "fluent"
  | "legende_vivante";

export type BadgeDef = {
  id: BadgeId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Récompense XP affichée (l'attribution réelle passe par awardXP). */
  xpReward: number;
};

export const BADGES: BadgeDef[] = [
  {
    id: "polyglotte",
    label: "Polyglotte",
    description: "10 mots dans 3 langues différentes",
    icon: Globe2,
    xpReward: 100,
  },
  {
    id: "streak7",
    label: "En feu",
    description: "Streak de 7 jours consécutifs",
    icon: Flame,
    xpReward: 50,
  },
  {
    id: "perfectionniste",
    label: "Perfectionniste",
    description: "Quiz parfait 10/10 sans erreur",
    icon: Target,
    xpReward: 75,
  },
  {
    id: "maitreRue",
    label: "Maître de la Rue",
    description: "Maîtrise du registre street",
    icon: Crown,
    xpReward: 100,
  },
  {
    id: "erudit",
    label: "Érudit",
    description: "500 expressions vues",
    icon: BookOpen,
    xpReward: 150,
  },
  {
    id: "rapide",
    label: "Rapide",
    description: "Quiz fini en moins de 30 secondes",
    icon: Zap,
    xpReward: 30,
  },
  {
    id: "level10",
    label: "Légende",
    description: "Niveau 10 atteint",
    icon: Star,
    xpReward: 500,
  },
  /* ── Badges spéciaux conversation (Phase 3/4) ────────────────── */
  {
    id: "polyglotte_conversationnel",
    label: "Polyglotte Conversationnel",
    description: "10 conversations dans 3 langues différentes",
    icon: MessagesSquare,
    xpReward: 200,
  },
  {
    id: "acteur_ne",
    label: "Acteur Né",
    description: "5 conversations avec Baba Street (score > 70 %)",
    icon: Drama,
    xpReward: 100,
  },
  {
    id: "negociateur",
    label: "Négociateur",
    description: "5 conversations marché réussies",
    icon: Briefcase,
    xpReward: 100,
  },
  {
    id: "tombeur",
    label: "Tombeur",
    description: "3 conversations drague avec score > 80 %",
    icon: Heart,
    xpReward: 80,
  },
  {
    id: "mc",
    label: "MC",
    description: "5 conversations studio d'enregistrement",
    icon: Mic2,
    xpReward: 80,
  },
  {
    id: "gamer_pro_badge",
    label: "Gamer Pro",
    description: "10 conversations gaming",
    icon: Gamepad2,
    xpReward: 120,
  },
  {
    id: "sage",
    label: "Sage",
    description: "5 conversations avec Mama Wisdom",
    icon: Landmark,
    xpReward: 80,
  },
  {
    id: "maitre_scenarios",
    label: "Maître de Scénarios",
    description: "Tous les scénarios d'une langue maîtrisés",
    icon: Trophy,
    xpReward: 300,
  },
  {
    id: "fluent",
    label: "Fluent",
    description: "50 conversations totales",
    icon: Flame,
    xpReward: 250,
  },
  {
    id: "legende_vivante",
    label: "Légende Vivante",
    description: "Score parfait (100 %) sur 10 conversations",
    icon: Gem,
    xpReward: 500,
  },
];

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.id, b]),
);

/** Libellé sûr pour un id inconnu (données serveur évolutives). */
export function badgeLabel(id: string): string {
  return BADGE_MAP[id]?.label ?? id;
}

export function badgeIcon(id: string): LucideIcon {
  return BADGE_MAP[id]?.icon ?? Star;
}
