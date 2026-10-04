import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/* ═══════════════════════════════════════════════════════════════════
   SCÉNARIOS IA (Phase 3/4) — 15 situations contextuelles par langue.

   Les `objectives` seedés sont des MOTIFS thématiques : au démarrage
   d'une conversation, aiConversation:startConversation les résout en
   VRAIES expressions de la base slang de la langue (matching par
   sous-chaîne, complétées par des expressions populaires). La checklist
   est donc toujours atteignable, quelle que soit la base.

   1.3 — UN SCÉNARIO N'EST JAMAIS SKIPPÉ : quand la base slang de la
   langue est vide, la conversation démarre en MODE LIBRE (objectifs
   = [], freeMode = true) et l'UI affiche un badge dédié.
   ═══════════════════════════════════════════════════════════════════ */

export type ScenarioSeed = {
  id: string;
  characterId: string;
  title: string;
  description: string;
  /** Prompt injecté au LLM : lieu, ambiance, situation. */
  context: string;
  /** Premier message de l'IA (lancement immersif). */
  opening: string;
  /** Motifs d'expressions à utiliser pour gagner des bonus XP. */
  objectives: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
};

export const SCENARIOS: ScenarioSeed[] = [
  {
    id: "marche_lagos",
    characterId: "aunty_business",
    title: "🛒 Au marché de Lagos",
    description: "Négocie le prix d'un tissu avec Aunty Business, la reine du marché.",
    context:
      "Étal de tissus colorés au marché de Lagos, midi, forte chaleur, foule dense et bruyante. L'utilisateur veut acheter un tissu ankara. Le marchand surestime les prix et adore le marchandage théâtral.",
    opening:
      "Ah, mon nouveau client ! Approche, approche… Ce tissu-là, c'est de la qualité supérieure. Dis-moi, combien tu penses payer ?",
    objectives: ["prix", "argent", "acheter", "cher", "marché", "négocier", "payer", "money"],
    difficulty: "beginner",
  },
  {
    id: "soiree_owambe",
    characterId: "dj_vibes",
    title: "🎉 Soirée Owambe",
    description: "DJ Vibes te teste sur les danses et l'argot tendance de la fête.",
    context:
      "Grande soirée owambe, sonos à fond, danseurs au centre. DJ Vibes anime au micro et fait participer la foule. Ambiance électrique, tout le monde se défoule.",
    opening:
      "OH OH OH, on m'a dit qu'il y avait un nouveau dans la salle ! Au micro maintenant : dis-moi comment tu appelles ce mouvement de danse, et montre-moi l'ambiance !",
    objectives: ["danser", "fête", "musique", "son", "ambiance", "bouger", "party", "dance"],
    difficulty: "beginner",
  },
  {
    id: "premier_rendezvous",
    characterId: "love_guru",
    title: "💕 Premier rendez-vous",
    description: "Love Guru t'aide à formuler l'accroche parfaite en argot.",
    context:
      "Café en terrasse en fin de journée. Love Guru joue le coach attablé à côté : l'utilisateur doit impressionner son crush avec des phrases d'accroche en argot.",
    opening:
      "Ok mon ami, elle arrive dans cinq minutes. Tu as UNE chance pour la première phrase. Balance ta meilleure accroche, je te note en temps réel.",
    objectives: ["beau", "belle", "cœur", "amour", "charmer", "plaire", "love", "crush"],
    difficulty: "intermediate",
  },
  {
    id: "controle_police",
    characterId: "officer_k",
    title: "🚔 Contrôle de police",
    description: "Officer K t'interpelle : négocie ta sortie en argot de rue.",
    context:
      "Checkpoint de nuit dans une rue animée. Officer K interpelle l'utilisateur, ton autoritaire, il demande des papiers et veut comprendre qui tu es. Tension légère mais négociable.",
    opening:
      "Halte-là. Ton sac. Tes papiers. Et tu me parles vite et bien — je n'ai pas la nuit entière pour toi.",
    objectives: ["police", "problème", "vite", "laisser", "attention", "danger", "peur", "dépêcher"],
    difficulty: "advanced",
  },
  {
    id: "pause_universite",
    characterId: "prof_slang",
    title: "🏫 Pause universitaire",
    description: "Prof Slang mélange langue académique et argot du campus.",
    context:
      "Campus universitaire, pause entre deux cours. Prof Slang discute sur le banc, alterne vocabulaire soutenu et argot étudiant. Ambiance détendue et curieuse.",
    opening:
      "Assieds-toi ! J'étais justement en train de réviser… enfin, entre deux expressions qu'aucun prof ne nous enseignera. Alors, tu connais déjà quoi comme argot ?",
    objectives: ["étudier", "examen", "fatigue", "travailler", "apprendre", "réussir", "study", "book"],
    difficulty: "beginner",
  },
  {
    id: "session_gaming",
    characterId: "gamer_pro",
    title: "🎮 Session gaming",
    description: "Gamer Pro te challenge en plein stream, argot internet obligatoire.",
    context:
      "Chambre de Gamer Pro, stream en cours, casque sur les oreilles. L'utilisateur rejoint la partie en ligne. Atmosphère de compétition amicale, taunts et célébrations.",
    opening:
      "Yooo, le nouveau est connecté ! Stream à 200 viewers, alors si tu perds, tout le monde le saura. Prêt ? Première manche, dis-moi ton plan de bataille !",
    objectives: ["gagner", "perdre", "rapide", "fort", "jeu", "équipe", "win", "game"],
    difficulty: "intermediate",
  },
  {
    id: "dans_danfo",
    characterId: "baba_street",
    title: "🚌 Dans le danfo",
    description: "Conversation survoltée avec Baba Street dans le minibus.",
    context:
      "Minibus danfo bondé, klaxons, vendeurs ambulants à chaque feu. Baba Street est assis à côté de l'utilisateur et lui fait le cours magistral de la rue.",
    opening:
      "Fais attention à ton portefeuille, petit ! Ici, dans ce bus, on apprend la vraie vie. Regarde ce vendeur… tu sais comment on l'appelle, dans la rue ?",
    objectives: ["argent", "attention", "vite", "voleur", "danger", "regarder", "trust", "watch"],
    difficulty: "intermediate",
  },
  {
    id: "restaurant_amala",
    characterId: "mama_wisdom",
    title: "🍽️ Restaurant amala",
    description: "Commande ton plat et recueille la sagesse de Mama Wisdom.",
    context:
      "Petit restaurant familial, odeur d'amala et de soupe éwa. Mama Wisdom sert elle-même et fait la conversation avec chaque client. Ambiance chaleureuse et paternelle/maternelle.",
    opening:
      "Assieds-toi, mon enfant, je m'occupe de toi. Aujourd'hui c'est amala avec la sauce spéciale… mais d'abord, dis-moi : tu as mangé quoi ce matin ? Un ventre vide ne réfléchit pas bien.",
    objectives: ["faim", "manger", "bon", "plats", "commander", "food", "eat", "hunger"],
    difficulty: "beginner",
  },
  {
    id: "business_deal",
    characterId: "baba_street",
    title: "💰 Business deal",
    description: "Négocie un contrat avec Baba Street, argent et confiance.",
    context:
      "Arrière-salle d'un bar calme en début de soirée. Baba Street propose un deal commercial à l'utilisateur. Il teste sa loyauté et son sens des affaires avant de signer.",
    opening:
      "Avant de parler chiffres, parlons respect. Dans ce business, ta parole vaut plus que ton papier. Alors dis-moi : pourquoi je devrais faire affaire avec toi ?",
    objectives: ["contrat", "confiance", "argent", "partenaire", "affaire", "deal", "business", "trust"],
    difficulty: "advanced",
  },
  {
    id: "studio_enregistrement",
    characterId: "dj_vibes",
    title: "🎵 Studio d'enregistrement",
    description: "DJ Vibes te fait rapper un couplet en argot pur.",
    context:
      "Studio d'enregistrement, micro ouvert, casque, boucle de beat en fond. DJ Vibes derrière la console pousse l'utilisateur à improviser un couplet en argot.",
    opening:
      "Le rouge est à l'enregistrement ! Une take, pas deux. Premier couplet : parle de ton quartier et sors-moi deux expressions de rue. C'est parti !",
    objectives: ["chanter", "rap", "son", "rythme", "quartier", "flow", "music", "beat"],
    difficulty: "advanced",
  },
  {
    id: "plage_tarkwa",
    characterId: "prof_slang",
    title: "🏖️ Plage de Tarkwa Bay",
    description: "Conversation décontractée entre amis sur la plage.",
    context:
      "Plage ensoleillée, vagues, musique au loin, groupes d'amis. Prof Slang est allongé sous un parasol et taquine l'utilisateur sur son niveau d'argot « vacances ».",
    opening:
      "Ah, enfin des vacances ! Alors dis-moi, cerveau studieuse… ici personne ne parle académique. Comment tu dis en argot que tu es super content ?",
    objectives: ["plage", "soleil", "content", "repos", "amis", "chill", "relax", "happy"],
    difficulty: "beginner",
  },
  {
    id: "boutique_sapa",
    characterId: "aunty_business",
    title: "🏪 Boutique de sapa",
    description: "Achète des fringues stylées quand le porte-monnaie dit non.",
    context:
      "Boutique de seconde main branchée, racks de fringues tendance. Aunty Business connaît tous les tricks pour vendre même à ceux qui sont « fauchés ». Humour garanti.",
    opening:
      "Je te connais, toi… tu as le style mais pas le budget, hein ? Pas de problème, ici on négocie TOUT. Quelle taille, et combien tu peux vraiment mettre sur la table ?",
    objectives: ["fringues", "style", "cher", "fauché", "acheter", "clothes", "broke", "shopping"],
    difficulty: "intermediate",
  },
  {
    id: "tournage_nollywood",
    characterId: "baba_street",
    title: "🎭 Tournage Nollywood",
    description: "Baba Street te coache pour jouer une scène en argot.",
    context:
      "Plateau de tournage Nollywood, caméras, réflecteurs, réalisateur nerveux. Baba Street joue le coach de jeu : l'utilisateur doit dire son texte avec le bon argot et la bonne attitude.",
    opening:
      "Silence plateau ! Ta scène : tu menaces ton frère qui a volé ton argent. Le réalisateur veut du VRAI argot, pas du théâtre d'école. Et… action !",
    objectives: ["voler", "frère", "menace", "colère", "argent", "scène", "acting", "steal"],
    difficulty: "advanced",
  },
  {
    id: "reunion_famille",
    characterId: "mama_wisdom",
    title: "🏠 Réunion de famille",
    description: "Mama Wisdom te teste sur les proverbes devant toute la famille.",
    context:
      "Salon familial un dimanche, tous les âges réunis, repas partagé. Mama Wisdom interpelle l'utilisateur devant tout le monde pour qu'il réponde avec sagesse et argot traditionnel.",
    opening:
      "Approche, mon petit, tout le monde t'écoute. Devant cette famille, dis-nous : qu'est-ce que les anciens disent quand le travail paie enfin ? Essaie avec les mots de la rue !",
    objectives: ["famille", "sagesse", "travail", "proverbe", "respect", "family", "wisdom", "work"],
    difficulty: "intermediate",
  },
  {
    id: "nightlife_vi",
    characterId: "dj_vibes",
    title: "🌃 Nightlife Victoria Island",
    description: "Sortie en boîte de nuit, argot nocturne et VIP.",
    context:
      "Boîte de nuit huppée de Victoria Island, laser, VIP, sécurité strict. DJ Vibes aux commandes mais troue un moment pour discuter avec l'utilisateur entre deux mixes.",
    opening:
      "Eh bien voilà le nouveau visage ! Ici c'est VIP mon ami — comment tu dis en argot que la nuit t'appartient ? Fais-moi voir que tu mérites la table dorée !",
    objectives: ["nuit", "boîte", "danse", "VIP", "sortir", "night", "club", "party"],
    difficulty: "advanced",
  },
];

/** Assure la présence des 15 scénarios pour la langue (idempotent). */
export async function ensureScenariosFor(
  ctx: MutationCtx,
  language: string,
): Promise<void> {
  const existing = await ctx.db
    .query("aiScenarios")
    .withIndex("by_language", (q) => q.eq("language", language))
    .collect();
  const have = new Set(existing.map((s) => s.id));
  for (const s of SCENARIOS) {
    if (have.has(s.id)) continue;
    await ctx.db.insert("aiScenarios", {
      id: s.id,
      characterId: s.characterId,
      language,
      title: s.title,
      description: s.description,
      context: s.context,
      opening: s.opening,
      objectives: s.objectives,
      difficulty: s.difficulty,
    });
  }
}

export const seedAiScenarios = mutation({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    await ensureScenariosFor(ctx, args.language);
    const rows = await ctx.db
      .query("aiScenarios")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();
    return { count: rows.length };
  },
  returns: v.object({ count: v.number() }),
});
