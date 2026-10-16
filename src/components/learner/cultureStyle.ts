/* ═══════════════════════════════════════════════════════════════════
   MODE CULTURE — méta visuelle partagée (PHASE 10-B)

   Une seule source pour la grille (« /app/culture », Phase 10-A) et
   la vue détaillée (« /app/culture/:slug », Phase 10-B) : le même
   concept garde son emoji et sa teinte d'un écran à l'autre.
   Pure présentation — la donnée reste dans crossSeed.ts.
   ═══════════════════════════════════════════════════════════════════ */

export type ConceptStyle = { emoji: string; ring: string };

export const CONCEPT_STYLE: Record<string, ConceptStyle> = {
  argent:            { emoji: "💰", ring: "from-amber-400/30 to-orange-400/20" },
  fauche:            { emoji: "🪙", ring: "from-yellow-400/30 to-amber-400/20" },
  ami:               { emoji: "🤝", ring: "from-sky-400/30 to-cyan-400/20" },
  probleme:          { emoji: "⚠️", ring: "from-rose-400/30 to-red-400/20" },
  fete:              { emoji: "🎉", ring: "from-fuchsia-400/30 to-purple-400/20" },
  police:            { emoji: "🚨", ring: "from-blue-400/30 to-indigo-400/20" },
  quartier:          { emoji: "🏙", ring: "from-teal-400/30 to-emerald-400/20" },
  cool:              { emoji: "😎", ring: "from-lime-400/30 to-green-400/20" },
  danse:             { emoji: "💃", ring: "from-pink-400/30 to-rose-400/20" },
  genre:             { emoji: "🎵", ring: "from-violet-400/30 to-purple-400/20" },
  plat:              { emoji: "🍲", ring: "from-orange-400/30 to-amber-400/20" },
  amour:             { emoji: "❤️", ring: "from-red-400/30 to-rose-400/20" },
  hustle:            { emoji: "🛠", ring: "from-stone-400/30 to-neutral-400/20" },
  salutation:        { emoji: "👋", ring: "from-emerald-400/30 to-teal-400/20" },
  merci:             { emoji: "🙏", ring: "from-green-400/30 to-emerald-400/20" },
  adieu:             { emoji: "👋", ring: "from-cyan-400/30 to-sky-400/20" },
  exclamation:       { emoji: "❗", ring: "from-amber-400/30 to-yellow-400/20" },
  famille:           { emoji: "👪", ring: "from-blue-400/30 to-sky-400/20" },
  respect:           { emoji: "🫡", ring: "from-indigo-400/30 to-blue-400/20" },
  dieu:              { emoji: "✨", ring: "from-amber-300/30 to-yellow-300/20" },
};

export const DEFAULT_CONCEPT_STYLE: ConceptStyle = {
  emoji: "🌐",
  ring: "from-white/20 to-white/10",
};
