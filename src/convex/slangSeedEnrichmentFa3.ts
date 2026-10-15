import type { SlangSeed } from "./slangSeed";

// LOT PERSAN — fiches d'enrichissement (Lot 6)
// Objectif : enrichir le persan de ~174 → ~224 expressions.
// Sources : argot des réseaux sociaux (Instagram/Telegram 2015-2026+),
// vie étudiante iranienne, quotidien économique moderne à Téhéran.
// Déduplication (slug-based) vis-à-vis de slangSeedEnrichmentFa.ts
// et slangSeedEnrichmentFa2.ts.

export const SLANG_SEED_ENRICHMENT_FA3: SlangSeed[] = [

  // ─── Argot des Réseaux Sociaux (Instagram/Telegram) ─────────────────────
  { language: "fa", expression: "لیکی Take", literal: "Liki take", meaning: "Prendre en photo/vidéo pour les stories", context: "[Époque: 2018-2026+] | [Niveau: VÉRIFIÉ] | [Source: Instagram/Usage jeune] | [Ex: 'Liki take kon, story bezar']", register: "internet", region: "Iran", popularity: 92 },
  { language: "fa", expression: "تریپ", literal: "Trip", meaning: "Voyage, excursion (surtout pour contenu)", context: "[Époque: 2020-2026+] | [Niveau: VÉRIFIÉ] | [Source: Instagram/Travel] | [Ex: 'Trip mamnoon']", register: "internet", region: "Iran", popularity: 90 },
  { language: "fa", expression: "فیدر", literal: "Fider", meaning: "Abonné·e fidèle, fan", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Instagram/Community] | [Ex: 'Fider e!' - Fan !]", register: "internet", region: "Iran", popularity: 88 },
  { language: "fa", expression: "مگاستار", literal: "Megasstar", meaning: "Micro-influenceur·e (petit mais actif)", context: "[Époque: 2018-2026+] | [Niveau: VÉRIFIÉ] | [Source: Instagram/TikTok] | [Ex: 'Megasstar migiri']", register: "internet", region: "Iran", popularity: 85 },
  { language: "fa", expression: "ستوری", literal: "Story", meaning: "Story Instagram/Snapchat", context: "[Époque: 2016-2026+] | [Niveau: VÉRIFIÉ] | [Source: Instagram/Social media] | [Ex: 'Story bezar']", register: "internet", region: "Iran", popularity: 95 },
  { language: "fa", expression: "لایک", literal: "Like", meaning: "J'aime (action sur les réseaux)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux] | [Ex: 'No like dare']", register: "internet", region: "Iran", popularity: 97 },
  { language: "fa", expression: "لايك بزن", literal: "Like bazan", meaning: "Donner un like", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux] | [Ex: 'Like bezaram']", register: "internet", region: "Iran", popularity: 96 },
  { language: "fa", expression: "کامنت", literal: "Comment", meaning: "Commentaire", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux] | [Ex: 'Koment bezar']", register: "internet", region: "Iran", popularity: 94 },
  { language: "fa", expression: "ریپلای", literal: "Reply", meaning: "Répondre à un message/commentaire", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Telegram/Instagram] | [Ex: 'Reply bezaram']", register: "internet", region: "Iran", popularity: 90 },
  { language: "fa", expression: "دیreht", literal: "Direct", meaning: "Message direct (DM)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Instagram/Telegram] | [Ex: 'DiRECT bezaram']", register: "internet", region: "Iran", popularity: 93 },

  // ─── Vie Étudiante ──────────────────────────────────────────────────────
  { language: "fa", expression: "دانشجویی", literal: "Daneshjuyi", meaning: "Vie étudiante, universitaire", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université/Usage] | [Ex: 'Daneshjuyi mikonim']", register: "casual", region: "Iran", popularity: 94 },
  { language: "fa", expression: "آزمون", literal: "Azmun", meaning: "Examen", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Azmun daram']", register: "casual", region: "Iran", popularity: 96 },
  { language: "fa", expression: "تحویل", literal: "Tahvil", meaning: "Remise/devoir", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Tahvil bezaram']", register: "casual", region: "Iran", popularity: 92 },
  { language: "fa", expression: "جریمه", literal: "Jerme", meaning: "Amende (retard/non-respect)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Jerme bekardam']", register: "casual", region: "Iran", popularity: 85 },
  { language: "fa", expression: "درس", literal: "Dars", meaning: "Cours", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Dars bedeam']", register: "casual", region: "Iran", popularity: 96 },
  { language: "fa", expression: "پروفسور", literal: "Proffesor", meaning: "Professeur (emprunt anglais)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université/English] | [Ex: 'Proffesor daram']", register: "internet", region: "Iran", popularity: 90 },
  { language: "fa", expression: "اختصاصی", literal: "Khate'ati", meaning: "Spécialisé, en majeure", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Khate'ati dashte']", register: "casual", region: "Iran", popularity: 88 },
  { language: "fa", expression: "واحد", literal: "Vahid", meaning: "Unité de cours", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Vahid gereftam']", register: "casual", region: "Iran", popularity: 89 },
  { language: "fa", expression: "پایان‌ semester", literal: "Payan-semester", meaning: "Fin de semestre", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Payan semester']", register: "casual", region: "Iran", popularity: 94 },
  { language: "fa", expression: "هدف", literal: "Hedef", meaning: "But, objectif (académique)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Université] | [Ex: 'Hedef dashte']", register: "casual", region: "Iran", popularity: 93 },

  // ─── Quotidien Économique Moderne à Téhéran ─────────────────────────────
  { language: "fa", expression: "تومان", literal: "Tooman", meaning: "Toman (unité monétaire iranienne)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Iran] | [Ex: 'Tooman gereftam']", register: "casual", region: "Iran", popularity: 99 },
  { language: "fa", expression: "دلار", literal: "Dolar", meaning: "Dollar (USD)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Devises] | [Ex: 'Dolar dashte']", register: "internet", region: "Iran", popularity: 97 },
  { language: "fa", expression: "بورس", literal: "Bourse", meaning: "Bourse (valeurs, actions)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Finance] | [Ex: 'Bourse bezaram']", register: "internet", region: "Iran", popularity: 95 },
  { language: "fa", expression: "استارتاپ", literal: "Start-up", meaning: "Startup (néo-entreprise)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Tech] | [Ex: 'Start-up gereftam']", register: "internet", region: "Iran", popularity: 96 },
  { language: "fa", expression: "صاحب کار", literal: "Sâheb-kâr", meaning: "Travailleur, entrepreneur", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Usage] | [Ex: 'Sâheb-kâr dashte']", register: "casual", region: "Iran", popularity: 96 },
  { language: "fa", expression: "کارbano", literal: "Karbano", meaning: "Travailleur, employé", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Emploi] | [Ex: 'Karbano dashte']", register: "casual", region: "Iran", popularity: 95 },
  { language: "fa", expression: "واریز", literal: "Variz", meaning: "Dépôt (argent, chèque)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Banque] | [Ex: 'Variz bezaram']", register: "casual", region: "Iran", popularity: 95 },
  { language: "fa", expression: "برد", literal: "Bard", meaning: "Retrait (distributeur/banque)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Usage] | [Ex: 'Bard bezaram']", register: "casual", region: "Iran", popularity: 94 },
  { language: "fa", expression: "خرید", literal: "Khared", meaning: "Achat", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Usage] | [Ex: 'Khared bezaram']", register: "casual", region: "Iran", popularity: 97 },
  { language: "fa", expression: "فروش", literal: "Forush", meaning: "Vente", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Commerce] | [Ex: 'Foruz bezaram']", register: "casual", region: "Iran", popularity: 95 },
  { language: "fa", expression: "میان", literal: "Mian", meaning: "Entre, intermédiaire (prix/valeur)", context: "[Époque: 2015-2026+] | [Niveau: VÉRIFIÉ] | [Source: Économie/Finance] | [Ex: 'Mian dashte']", register: "casual", region: "Iran", popularity: 89 }
];