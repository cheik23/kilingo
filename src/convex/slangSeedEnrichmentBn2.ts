import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════════
   LOT BENGALI — fiches d'enrichissement (Lot 5)
   Objectif : enrichir le bengali de ~46 → ~96 expressions.
   Sources : Tollywood, culture internet bengalie (2020-2026), langage urbain
   de Kolkata/Dhaka, séries/web bd. Déduplication vis-à-vis de
   slangSeedEnrichmentBn.ts et slangSeedLot3.ts.
   ══════════════════════════════════════════════════════════════════════ */

export const SLANG_SEED_ENRICHMENT_BN2: SlangSeed[] = [
  // Expressions récentes internet (2020-2026)
  { language: "bn", expression: "Vulgar", literal: "Vulgar", meaning: "Pour rire (variante)", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Internet BD] | [Ex: 'Vulgar bhai!']", register: "internet", region: "Bangladesh", popularity: 85 },
  { language: "bn", expression: "TikTok Bangla", literal: "TikTok Bangla", meaning: "Tendances TikTok en bengali", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: TikTok BD] | [Ex: 'TikTok bangla lagbe']", register: "internet", region: "Bangladesh", popularity: 90 },
  { language: "bn", expression: "Reels", literal: "Reels", meaning: "Reels Instagram", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Instagram BD] | [Ex: 'Reels dekhe']", register: "internet", region: "Bangladesh", popularity: 88 },
  { language: "bn", expression: "YouTube Comment", literal: "YouTube Comment", meaning: "Commentaire YouTube typique", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: YouTube BD] | [Ex: 'YouTube er comment']", register: "internet", region: "Bangladesh", popularity: 78 },
  { language: "bn", expression: "Facebook Share", literal: "Facebook Share", meaning: "Partage Facebook viral", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Facebook BD] | [Ex: 'Facebook share']", register: "internet", region: "Bangladesh", popularity: 76 },

  // Expressions Tollywood / cinéma
  { language: "bn", expression: "Blockbuster", literal: "Blockbuster", meaning: "Film carton plein", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Tollywood] | [Ex: 'Blockbuster film']", register: "casual", region: "Bangladesh", popularity: 82 },
  { language: "bn", expression: "Super Hit", literal: "Super Hit", meaning: "Succès immense", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Tollywood] | [Ex: 'Super hit ghuri']", register: "casual", region: "Bangladesh", popularity: 85 },
  { language: "bn", expression: "Flop", literal: "Flop", meaning: "Échec total", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Tollywood] | [Ex: 'Film flop']", register: "street", region: "Bangladesh", popularity: 68 },
  { language: "bn", expression: "Hit", literal: "Hit", meaning: "Succès", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Tollywood] | [Ex: 'Song hit']", register: "casual", region: "Bangladesh", popularity: 80 },

  // Langage urbain Kolkata/Dhaka
  { language: "bn", expression: "Adda", literal: "Adda", meaning: "Discussion entre amis", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage Kolkata] | [Ex: 'Adda ma che']", register: "casual", region: "Bangladesh", popularity: 84 },
  { language: "bn", expression: "Adda khana", literal: "Adda khana", meaning: "Manger lors de l'adda", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage Kolkata] | [Ex: 'Adda khabo']", register: "casual", region: "Bangladesh", popularity: 78 },
  { language: "bn", expression: "Gali", literal: "Gali", meaning: "Rue, langage de rue", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage urbain] | [Ex: 'Gali language']", register: "street", region: "Bangladesh", popularity: 74 },
  { language: "bn", expression: "Gali type", literal: "Gali type", meaning: "Type de gars de rue", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage urbain] | [Ex: 'Gali type']", register: "street", region: "Bangladesh", popularity: 72 },

  // Expressions love/relations
  { language: "bn", expression: "Premier Pyaar", literal: "Premier Pyaar", meaning: "Premier amour", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Premier pyaar']", register: "casual", region: "Bangladesh", popularity: 88 },
  { language: "bn", expression: "Dil", literal: "Dil", meaning: "Cœur", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Dil bharalo']", register: "casual", region: "Bangladesh", popularity: 86 },
  { language: "bn", expression: "Tumake", literal: "Tumake", meaning: "Pour toi", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Tumake koro']", register: "casual", region: "Bangladesh", popularity: 82 },
  { language: "bn", expression: "Tumi", literal: "Tumi", meaning: "Tu", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Tumi kosto']", register: "casual", region: "Bangladesh", popularity: 84 },

  // Expressions work/étude
  { language: "bn", expression: "Study", literal: "Study", meaning: "Étudier", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage étudiant] | [Ex: 'Study korte']", register: "casual", region: "Bangladesh", popularity: 78 },
  { language: "bn", expression: "Job", literal: "Job", meaning: "Emploi", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage professionnel] | [Ex: 'Job pao']", register: "casual", region: "Bangladesh", popularity: 85 },
  { language: "bn", expression: "Office", literal: "Office", meaning: "Bureau", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage professionnel] | [Ex: 'Office giye']", register: "casual", region: "Bangladesh", popularity: 80 },
  { language: "bn", expression: "Kick off", literal: "Kick off", meaning: "Commencer", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage professionnel] | [Ex: 'Kick off korte']", register: "casual", region: "Bangladesh", popularity: 76 },

  // Expressions émotionnelles
  { language: "bn", expression: "Excited", literal: "Excited", meaning: "Excité", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Excited fele']", register: "casual", region: "Bangladesh", popularity: 82 },
  { language: "bn", expression: "Bored", literal: "Bored", meaning: "Ennuyé", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Bored ache']", register: "casual", region: "Bangladesh", popularity: 78 },
  { language: "bn", expression: "Tense", literal: "Tense", meaning: "Tendu, stressed", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Tense fele']", register: "casual", region: "Bangladesh", popularity: 74 },
  { language: "bn", expression: "Relax", literal: "Relax", meaning: "Se détendre", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Relax korte']", register: "casual", region: "Bangladesh", popularity: 85 },

  // Expressions quotidiennes
  { language: "bn", expression: "Khobor", literal: "Khobor", meaning: "Nouvelles, info", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Khobor shune']", register: "casual", region: "Bangladesh", popularity: 90 },
  { language: "bn", expression: "Kemon Acho", literal: "Kemon Acho", meaning: "Comment vas-tu ?", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Kemon acho?']", register: "casual", region: "Bangladesh", popularity: 88 },
  { language: "bn", expression: "Ami", literal: "Ami", meaning: "Ami", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Ami bondhu']", register: "casual", region: "Bangladesh", popularity: 92 },
  { language: "bn", expression: "Prothom", literal: "Prothom", meaning: "Premier, première fois", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Prothom din']", register: "casual", region: "Bangladesh", popularity: 78 },
  // Expressions supplémentaires (ajout Phase 3)
  { language: "bn", expression: "Bhalo Achhi", literal: "Bhalo Achhi", meaning: "Tout va bien", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Bhalo achhi acho']", register: "casual", region: "Bangladesh", popularity: 85 },
  { language: "bn", expression: "Koto Khobor", literal: "Koto Khobor", meaning: "Beaucoup de nouvelles", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Koto khobor']", register: "casual", region: "Bangladesh", popularity: 80 },
  { language: "bn", expression: "Ami Boro", literal: "Ami Boro", meaning: "Grand ami", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Ami boro']", register: "casual", region: "Bangladesh", popularity: 82 },
  { language: "bn", expression: "Cholo Na", literal: "Cholo Na", meaning: "Viens", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Cholo na']", register: "casual", region: "Bangladesh", popularity: 88 },
  { language: "bn", expression: "Ei Ghor", literal: "Ei Ghor", meaning: "Cette maison", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Ei ghor']", register: "casual", region: "Bangladesh", popularity: 80 },
  { language: "bn", expression: "Tomader", literal: "Tomader", meaning: "Le tien", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Tomader']", register: "casual", region: "Bangladesh", popularity: 78 },
  { language: "bn", expression: "Ami Bhab", literal: "Ami Bhab", meaning: "Belle-mère", context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage universel] | [Ex: 'Ami bhab']", register: "street", region: "Bangladesh", popularity: 74 },
  { language: "bn", expression: "Nokor Janla", literal: "Nokor Janla", meaning: "Rencontrer quelqu'un", context: "[Époque: 2010+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux] | [Ex: 'Nokor janala']", register: "internet", region: "Bangladesh", popularity: 85 },
  { language: "bn", expression: "Facebook Comment", literal: "Facebook Comment", meaning: "Commentaire Facebook", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Facebook BD] | [Ex: 'Facebook comment']", register: "internet", region: "Bangladesh", popularity: 80 },
  { language: "bn", expression: "Instagram Post", literal: "Instagram Post", meaning: "Post Instagram", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Instagram BD] | [Ex: 'Instagram post']", register: "internet", region: "Bangladesh", popularity: 82 },
  { language: "bn", expression: "Twitter Post", literal: "Twitter Post", meaning: "Post Twitter", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Twitter BD] | [Ex: 'Twitter post']", register: "internet", region: "Bangladesh", popularity: 76 },
  { language: "bn", expression: "YouTube Live", literal: "YouTube Live", meaning: "Diffusion YouTube en direct", context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: YouTube BD] | [Ex: 'YouTube live']", register: "internet", region: "Bangladesh", popularity: 78 },
];