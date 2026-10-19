/* ═══════════════════════════════════════════════════════════════════════
   LA LANDING PUBLIQUE — COPY DES 12 LANGUES (overlay)

   PROMPT MAÎTRE §2 : le positionnement « argot africain » n'est plus la
   définition de la marque. Les cartes `fr` et `en` sont repositionnées
   sur un atlas vivant des langues du monde (rédaction neuve, validée
   contre le catalogue). Les dix autres cartes sont reprises VERBATIM du
   dépôt — aucune traduction inventée ici : leur réécriture internationale
   exige des locuteurs natifs (limites documentées dans le rapport final).

   Contrat : `getLandingCopy(lang)` renvoie `{ landing: {…} }` ou
   `undefined`, fusionné par-dessus les dictionnaires de base (voir
   i18n.tsx → applyDictionaryOverlays). `scripts/verify-upgrade.mjs`
   exige 16 clés par langue et refuse :
     · un `languagesValue` ≠ count de `languages.ts` (29) ;
     · un total d'expressions figé dans Landing.tsx (les repli Value de
       CE FICHIER sont exemptés : c'est le dictionnaire i18n).

   Les nombres viennent de `landingStats.getLandingNumbers` ; ces replis
   ne servent qu'avant l'arrivée de la requête.
   ═══════════════════════════════════════════════════════════════════════ */

type LandingCopy = {
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaSecondary: string;
  reassurance: string;
  learners: string;
  features: {
    title: string;
    lead: string;
    languagesValue: string;
    languagesLabel: string;
    expressionsValue: string;
    expressionsLabel: string;
    avatarValue: string;
    avatarLabel: string;
    cultureValue: string;
    cultureLabel: string;
    pronunciationValue: string;
    pronunciationLabel: string;
    verifiedValue: string;
    verifiedLabel: string;
  };
  globeCaption: string;
  /**
   * Sections détaillées. FR et EN uniquement : les 9 autres langues
   * retombent sur le fallback français pour les clés manquantes
   * (comportement standard de `t()`).
   */
  sections?: LandingSections;
};

export type LandingSections = {
  chapters: {
    features: string;
    method: string;
    showcase: string;
    media: string;
    quiz: string;
    system: string;
    pricing: string;
  };
  nav: {
    languages: string;
    method: string;
    modules: string;
    showcase: string;
    quiz: string;
    pricing: string;
    faq: string;
    start: string;
    open: string;
  };
  footer: {
    tagline: string;
    contact: string;
    login: string;
  };
  method: {
    eyebrow: string;
    title: string;
    steps: Array<{ title: string; text: string }>;
    note: string;
  };
  showcase: {
    eyebrow: string;
    title: string;
    lead: string;
    meaningLabel: string;
    contextLabel: string;
    regionLabel: string;
    registerLabel: string;
    listenLabel: string;
  };
  media: {
    eyebrow: string;
    title: string;
    available: string;
    soonBadge: string;
    body: string;
  };
  quiz: {
    eyebrow: string;
    title: string;
    lead: string;
    pickLabel: string;
    correct: string;
    incorrect: string;
    contextIntro: string;
    unavailable: string;
    authedNote: string;
    guestNote: string;
  };
  pricing: {
    cta: string;
    ctaLabel: string;
    eyebrow: string;
    title: string;
    lead: string;
    monthlyLabel: string;
    annualLabel: string;
    perDayLabel: string;
    discountLabel: string;
    includesTitle: string;
    includes: string[];
    manageSub: string;
    finePrint: string;
  };
  regions: {
    eyebrow: string;
    title: string;
    lead: string;
    chipHint: string;
  };
  system: {
    title: string;
    atlas: { title: string; text: string };
    bridges: { title: string; text: string };
    revisions: { title: string; text: string };
  };
  faq: Array<{ q: string; a: string }>;
};

/* ── FR — sections détaillées ─────────────────────────────────────── */

const FR_SECTIONS: LandingSections = {
  chapters: {
    features: "La richesse",
    method: "La méthode",
    showcase: "Les mots dans la vie",
    media: "Écouter & décoder",
    quiz: "Essayer sans compte",
    system: "Le système",
    pricing: "Premium",
  },
  nav: {
    languages: "Langues",
    method: "La méthode",
    modules: "Modules",
    showcase: "Expression",
    quiz: "Quiz",
    pricing: "Premium",
    faq: "FAQ",
    start: "Commencer",
    open: "Ouvrir l'app",
  },
  footer: {
    tagline: "Les langues vivent dans les conversations.",
    contact: "Contact",
    login: "Connexion",
  },
  method: {
    eyebrow: "Une langue, mille façons de la vivre",
    title: "Trois temps, aucune magie",
    steps: [
      {
        title: "Découvrir",
        text: "Une expression entre dans ton champ : écriture, audio, région, registre. Ce que tu entends vraiment, pas la version du manuel.",
      },
      {
        title: "Comprendre",
        text: "Le sens, le mot à mot, le contexte d'usage : où elle vit, à qui elle se dit, ce qu'elle implique.",
      },
      {
        title: "Pratiquer",
        text: "Quiz, révision espacée, shadowing : la boucle qui la fait tenir dans ta vraie vie, pas dans un carnet.",
      },
    ],
    note: "Ce que l'app fait déjà — rien de promis au-delà.",
  },
  showcase: {
    eyebrow: "Derrière chaque expression, un monde à découvrir",
    title: "Les mots dans la vraie vie",
    lead: "Une base réellement documentée : chaque expression porte sa langue, sa région, son registre et son contexte d'usage.",
    meaningLabel: "Sens",
    contextLabel: "Contexte",
    regionLabel: "Région",
    registerLabel: "Registre",
    listenLabel: "Écouter",
  },
  media: {
    eyebrow: "Écouter, décoder, comprendre",
    title: "L'immersion, pas la récitation",
    available: "Disponible dans l'app",
    soonBadge: "Bientôt",
    body: "Films, musiques, séries, podcasts : dans l'app (Modules), le vocabulaire que tu apprends se retrouve là où il vit vraiment.",
  },
  quiz: {
    eyebrow: "Essayer sans compte",
    title: "Une question, une réponse — c'est déjà la méthode",
    lead: "Cette carte vient de la même base que l'app ; le sens attendu est corrigé par le même algorithme déterministe que le défi quotidien.",
    pickLabel: "Choisis le bon sens",
    correct: "Exact — sens retenu, contexte affiché.",
    incorrect: "Pas tout à fait : la bonne réponse s'illumine. Un essai, un contexte — c'est déjà la méthode.",
    contextIntro: "Contexte",
    unavailable: "Expression du moment indisponible — reviens dans un instant.",
    authedNote: "Connecté : cette réussite compte pour ton streak et ton XP.",
    guestNote: "Crée un compte pour garder cette expression en mémoire et déclencher tes révisions.",
  },
  pricing: {
    cta: "Passer Premium",
    ctaLabel: "Passer Premium",
    eyebrow: "Kɪ́LINGO Premium",
    title: "Tout débloquer, rester aux commandes",
    lead: "Deux langues en parallèle, le shadowing illimité, les 8 personnages IA : Premium ouvre ce que la pratique quotidienne réclame — à toi de décider quand.",
    monthlyLabel: "Mensuel",
    annualLabel: "Annuel",
    perDayLabel: "par jour",
    discountLabel: "d'économie",
    includesTitle: "Ce que ça ouvre",
    includes: [
      "2 langues suivies en parallèle",
      "Shadowing illimité",
      "Les 8 personnages IA, avec leurs registres",
      "Révisions espacées complètes",
    ],
    manageSub: "Gérer mon abonnement",
    finePrint: "Essai gratuit · sans prélèvement avant la fin · annulation en un clic, via le portail officiel.",
  },
  regions: {
    eyebrow: "Langue · région · contexte",
    title: "Une expression ne se réduit pas à sa traduction",
    lead: "L'argot n'est pas une langue unique : chaque expression porte un pays, un registre, une situation. Le contexte rendu visible, c'est ce qui te permet de l'employer à ta façon.",
    chipHint: "Touche une langue : sa tranche s'illumine, la légende raconte où elle vit.",
  },
  system: {
    title: "Un système d'apprentissage, pas un simple dictionnaire",
    atlas: {
      title: "Atlas & recherche",
      text: "Chercher une expression, comprendre la notion derrière, la suivre d'une communauté à l'autre.",
    },
    bridges: {
      title: "Ponts culturels",
      text: "Une même idée vue dans plusieurs langues : 20 concepts universels croisés entre les 29 du catalogue.",
    },
    revisions: {
      title: "Mémoire espacée",
      text: "Quiz, favoris, révisions espacées : ce que tu découvres reste dans ta mémoire au bon moment.",
    },
  },
  faq: [
    {
      q: "À qui s'adresse Kɪ́LINGO ?",
      a: "À toutes celles et tous ceux qui croisent des langues vivantes — de l'argot urbain au langage familier, d'une région à l'autre — et qui veulent comprendre d'abord, employer ensuite.",
    },
    {
      q: "Quelles langues sont couvertes ?",
      a: "29 langues du monde entier, des plus courantes (anglais, espagnol, mandarin…) aux langues moins représentées ailleurs (wolof, yoruba, lingala, amharique, igbo). Chacune avec un corpus documenté dont la mesure est visible sur cette page.",
    },
    {
      q: "Ce n'est pas un cours complet de langue ?",
      a: "Kɪ́LINGO documente les expressions et les usages vivants : registres, contextes, nuances. Ce n'est pas une grammaire académique — c'est ce qui te permet de comprendre ce que les gens disent vraiment.",
    },
    {
      q: "Comment sont vérifiées les expressions ?",
      a: "Chaque fiche porte sa langue, sa région, son registre et son contexte d'usage. Les fiches sans validation complète sont marquées comme telles dans l'app (badge « à valider »). Cette page n'affiche que des données présentes dans la base.",
    },
    {
      q: "Est-ce gratuit ?",
      a: "Découvrir (expression du jour, quiz, catalogue) est gratuit, sans compte ni carte. La progression, les révisions et l'avatar demandent un compte. Premium ouvre plus de langues en parallèle, le shadowing illimité et les 8 personnages — l'essai est gratuit et l'annulation tient en un clic.",
    },
  ],
};

/* ── EN — sections détaillées ─────────────────────────────────────── */

const EN_SECTIONS: LandingSections = {
  chapters: {
    features: "The richness",
    method: "The method",
    showcase: "Words in real life",
    media: "Listen & decode",
    quiz: "Try without an account",
    system: "The system",
    pricing: "Premium",
  },
  nav: {
    languages: "Languages",
    method: "The method",
    modules: "Modules",
    showcase: "Expression",
    quiz: "Quiz",
    pricing: "Premium",
    faq: "FAQ",
    start: "Start",
    open: "Open the app",
  },
  footer: {
    tagline: "Languages live in conversations.",
    contact: "Contact",
    login: "Sign in",
  },
  method: {
    eyebrow: "One language, a thousand ways to live it",
    title: "Three beats, no magic",
    steps: [
      {
        title: "Discover",
        text: "An expression enters your field: script, audio, region, register. What you actually hear — not the textbook version.",
      },
      {
        title: "Understand",
        text: "Meaning, word-for-word, context of use: where it lives, whom you say it to, what it implies.",
      },
      {
        title: "Practise",
        text: "Quiz, spaced review, shadowing: the loop that makes it survive your real life, not a notebook.",
      },
    ],
    note: "What the app already does — nothing promised beyond.",
  },
  showcase: {
    eyebrow: "Behind every expression, a world to discover",
    title: "Words in real life",
    lead: "A genuinely documented base: every expression carries its language, region, register and context of use.",
    meaningLabel: "Meaning",
    contextLabel: "Context",
    regionLabel: "Region",
    registerLabel: "Register",
    listenLabel: "Listen",
  },
  media: {
    eyebrow: "Listen, decode, understand",
    title: "Immersion, not recitation",
    available: "Available in the app",
    soonBadge: "Coming soon",
    body: "Films, music, series, podcasts: in the app (Modules), the vocabulary you learn shows up where it really lives.",
  },
  quiz: {
    eyebrow: "Try without an account",
    title: "One question, one answer — that's already the method",
    lead: "This card comes from the same base as the app; the expected meaning is checked by the same deterministic algorithm as the daily challenge.",
    pickLabel: "Pick the right meaning",
    correct: "Exact — meaning retained, context shown.",
    incorrect: "Not quite: the right answer lights up. One try, one context — that's already the method.",
    contextIntro: "Context",
    unavailable: "The expression of the moment is unavailable — come back in a moment.",
    authedNote: "Signed in: this counts for your streak and your XP.",
    guestNote: "Create an account to keep this expression in memory and trigger your reviews.",
  },
  pricing: {
    cta: "Go Premium",
    ctaLabel: "Go Premium",
    eyebrow: "Kɪ́LINGO Premium",
    title: "Unlock everything, stay in control",
    lead: "Two languages in parallel, unlimited shadowing, the 8 AI characters: Premium opens what daily practice asks for — you decide when.",
    monthlyLabel: "Monthly",
    annualLabel: "Annual",
    perDayLabel: "per day",
    discountLabel: "off",
    includesTitle: "What it unlocks",
    includes: [
      "2 languages tracked in parallel",
      "Unlimited shadowing",
      "All 8 AI characters, with their registers",
      "Full spaced repetition",
    ],
    manageSub: "Manage my subscription",
    finePrint: "Free trial · no charge before it ends · one-click cancellation via the official portal.",
  },
  regions: {
    eyebrow: "Language · region · context",
    title: "An expression is more than its translation",
    lead: "Slang isn't one language: every expression carries a country, a register, a situation. Made visible, that context is what lets you use it your way.",
    chipHint: "Touch a language: its slice lights up, the legend tells where it lives.",
  },
  system: {
    title: "A learning system, not just a dictionary",
    atlas: {
      title: "Atlas & search",
      text: "Search an expression, understand the notion behind it, follow it from one community to another.",
    },
    bridges: {
      title: "Cultural bridges",
      text: "One idea seen through several languages: 20 universal concepts crossed across the 29 of the catalogue.",
    },
    revisions: {
      title: "Spaced memory",
      text: "Quiz, favourites, spaced reviews: what you discover stays in your memory, at the right time.",
    },
  },
  faq: [
    {
      q: "Who is Kɪ́LINGO for?",
      a: "For everyone who meets living languages — urban slang, casual speech, regional variation — and wants to understand first, then use.",
    },
    {
      q: "Which languages are covered?",
      a: "29 languages from around the world, from the most common (English, Spanish, Mandarin…) to the ones less represented elsewhere (Wolof, Yoruba, Lingala, Amharic, Igbo). Each with a documented corpus whose measure is visible on this page.",
    },
    {
      q: "Is this a full language course?",
      a: "Kɪ́LINGO documents expressions and living usage: registers, contexts, nuances. Not an academic grammar — it's what lets you understand what people actually say.",
    },
    {
      q: "How are expressions verified?",
      a: "Every card carries its language, region, register and context of use. Cards without full validation are marked as such in the app (the « to validate » badge). This page only shows data present in the base.",
    },
    {
      q: "Is it free?",
      a: "Discovery (daily expression, quiz, catalogue) is free, no account or card. Progress, reviews and the avatar need an account. Premium opens more parallel languages, unlimited shadowing and the 8 characters — the trial is free and cancellation takes one click.",
    },
  ],
};

/* ── Les 12 cartes ────────────────────────────────────────────────── */

const LANDING: Record<string, LandingCopy> = {
  /* FR et EN : positionnement international (prompt maître §2). */
  fr: {
    badge: "Atlas vivant · langues · expressions",
    title: "Les langues du monde, comme elles se parlent vraiment.",
    subtitle:
      "Explore les expressions, les mots vivants et les nuances que les manuels oublient parfois. Des langues les plus connues aux voix moins représentées, découvre ce que les gens disent réellement — et ce que leurs mots veulent dire.",
    cta: "Explorer les langues",
    ctaSecondary: "Découvrir une expression",
    reassurance: "Gratuit · aucune carte bancaire",
    learners: "{n} apprenants déjà inscrits",
    features: {
      title: "Tout ce qu'il faut, en un seul endroit",
      lead: "Un catalogue large, un avatar qui te ressemble, et une méthode qui tient dans la vraie vie.",
      languagesValue: "29",
      languagesLabel: "langues du monde entier",
      expressionsValue: "6 600+",
      expressionsLabel: "expressions et argots documentés",
      avatarValue: "3D",
      avatarLabel: "avatar ready to wear",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio intégrée",
      verifiedValue: "Base de données vérifiée",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Every expression comes from a real place.",
    sections: FR_SECTIONS,
  },
  en: {
    badge: "Immersion · living languages · real content",
    title: "The world's languages, as they're actually spoken.",
    subtitle:
      "Explore the expressions, living words and nuances textbooks often miss. From the most widely spoken to the under-represented voices, discover what people really say — and what their words mean.",
    cta: "Explore the languages",
    ctaSecondary: "Discover an expression",
    reassurance: "Free · no credit card",
    learners: "{n} learners already signed up",
    features: {
      title: "Everything you need, in one place",
      lead: "A wide catalogue, an avatar that looks like you, and a method that survives real life.",
      languagesValue: "29",
      languagesLabel: "languages from around the world",
      expressionsValue: "6 600+",
      expressionsLabel: "documented expressions and slang terms",
      avatarValue: "3D",
      avatarLabel: "avatar ready to wear",
      cultureValue: "20",
      cultureLabel: "universal concepts",
      pronunciationValue: "Native audio",
      pronunciationLabel: "Native pronunciation",
      verifiedValue: "Verified database",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Every expression comes from a real place.",
    sections: EN_SECTIONS,
  },
  /* ── ES, ZH, AR, RU : cartes verbatim du dépôt d'origine ── */
  es: {
    badge: "Atlas vivo · lenguas · expresiones",
    title: "Las lenguas del mundo, como se hablan de verdad.",
    subtitle:
      "Explora las expresiones, las palabras vivas y los matices que los manuales a veces pasan por alto. De las lenguas más conocidas a las voces menos representadas, descubre lo que la gente dice de verdad — y lo que sus palabras quieren decir.",
    cta: "Explorar las lenguas",
    ctaSecondary: "Descubrir una expresión",
    reassurance: "Gratis · sin tarjeta bancaria",
    learners: "{n} aprendices ya inscritos",
    features: {
      title: "Todo lo que necesitas, en un solo sitio",
      lead: "Un catálogo amplio, un avatar que se parece a ti y un método que aguanta la vida real.",
      languagesValue: "29",
      languagesLabel: "lenguas de todo el mundo",
      expressionsValue: "6 600+",
      expressionsLabel: "expresiones y argots documentados",
      avatarValue: "3D",
      avatarLabel: "avatar listo para llevar",
      cultureValue: "20",
      cultureLabel: "conceptos universales",
      pronunciationValue: "Audio nativo",
      pronunciationLabel: "Pronunciación nativa",
      verifiedValue: "Base de datos verificada",
      verifiedLabel: "Sin alucinaciones",
    },
    globeCaption: "Cada expresión viene de un lugar real.",
  },
  zh: {
    badge: "活的语言地图 · 语言 · 表达",
    title: "世界语言，如人们真正说出口的那样。",
    subtitle:
      "探索那些教科书常常忽略的表达、鲜活词汇与细微差别。从最通行的语言到较少被听见的声音，了解人们真正在说什么——以及他们的话语意味着什么。",
    cta: "探索语言",
    ctaSecondary: "发现一个表达",
    reassurance: "免费 · 无需银行卡",
    learners: "已有 {n} 位学习者注册",
    features: {
      title: "你所需的一切，尽在一处",
      lead: "庞大的词库、像你的头像，以及真正用得上的方法。",
      languagesValue: "29",
      languagesLabel: "来自世界各地的语言",
      expressionsValue: "6 600+",
      expressionsLabel: "条有据可查的表达与俚语",
      avatarValue: "3D",
      avatarLabel: "可佩戴的头像",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio",
      verifiedValue: "Base de donnees verifiee",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "每个表达都来自真实的地方。",
  },
  ar: {
    badge: "أطلس حيّ · لغات · تعابير",
    title: "لغات العالم كما تُتحدَّث فعلاً.",
    subtitle:
      "استكشف التعبيرات والكلمات الحيّة والفروق الدقيقة التي تغفل عنها الكتب أحياناً. من أشهر اللغات إلى الأصوات الأقل حضوراً، اكتشف ما يقوله الناس حقاً — وما تعنيه كلماتهم.",
    cta: "استكشف اللغات",
    ctaSecondary: "اكتشف تعبيراً",
    reassurance: "مجاني · بدون بطاقة بنكية",
    learners: "{n} متعلماً سجّلوا بالفعل",
    features: {
      title: "كل ما تحتاجه في مكان واحد",
      lead: "كتالوج واسع، صورة رمزية تشبهك، وطريقة تصمد في الحياة الحقيقية.",
      languagesValue: "29",
      languagesLabel: "لغات من جميع أنحاء العالم",
      expressionsValue: "6 600+",
      expressionsLabel: "تعبير ومصطلح موثّق",
      avatarValue: "3D",
      avatarLabel: "صورة رمزية جاهزة",
      cultureValue: "20",
      cultureLabel: "Концепты universales",
      pronunciationValue: "Аудио native",
      pronunciationLabel: "Пrononciation audio",
      verifiedValue: "База данных verifiee",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Каждое выражение — из реального места.",
  },
  ru: {
    badge: "Живой атлас · языки · выражения",
    title: "Языки мира — так, как на них действительно говорят.",
    subtitle:
      "Исследуйте выражения, живые слова и нюансы, которые часто упускают учебники. От самых распространённых языков до голосов, которых мало где услышишь, — узнайте, что люди говорят на самом деле и что значат их слова.",
    cta: "Открыть языки",
    ctaSecondary: "Открыть выражение",
    reassurance: "Бесплатно · без карты",
    learners: "Уже зарегистрировано {n} учеников",
    features: {
      title: "Всё нужное — в одном месте",
      lead: "Большой каталог, аватар похожий на тебя и метод, который работает в жизни.",
      languagesValue: "29",
      languagesLabel: "языков со всего мира",
      expressionsValue: "6 600+",
      expressionsLabel: "документированных выражения и сленга",
      avatarValue: "3D",
      avatarLabel: "готовый аватар",
      cultureValue: "20",
      cultureLabel: "Концепты universales",
      pronunciationValue: "Аудио native",
      pronunciationLabel: "Пrononciation audio",
      verifiedValue: "База данных verifiee",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Каждое выражение — из реального места.",
  },
  /* ── SW, LN, HA, YO, ZU, WO : VERBATIM du dépôt d'origine ── */
  sw: {
    badge: "Kujumbiwa · msamiati wa Afrika · maudhui halisi",
    title: "Jifunze msamiati wa Afrika kwa siku 7",
    subtitle:
      "Hakuna anayesema kama kitabu. Jifunze msamiati, misemo na utamaduni kwa kujumbiwa — sinema, muziki, vitendevyo na vipodcasti unavyopenda — kisha rejesha ulichosikia.",
    cta: "Anza bila malipo",
    ctaSecondary: "Ona jinsi inavyofanya kazi",
    reassurance: "Bure · kadi ya benki hahitajiki",
    learners: "Wanafunzi {n} tayari wamejiandikisha",
    features: {
      title: "Kila unachohitaji, mahali moja",
      lead: "Katalogi nyingi, avatar inayofanana nawe, na njia inayofanya kazi maishani.",
      languagesValue: "29",
      languagesLabel: "lugha kutoka duniani kote",
      expressionsValue: "6 600+",
      expressionsLabel: "misemo na msamiati iliyoandikwa",
      avatarValue: "3D",
      avatarLabel: "avatar tayari kuvaa",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio intégrée",
      verifiedValue: "Base de données vérifiée",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Kila msemo humoka mahali halisi.",
  },
  ln: {
    badge: "Kobima · lingala ya Afrika · masapo ya solo",
    title: "Yeba lingala ya Afrika na mikolo 7",
    subtitle:
      "Moto te ayeboli lokota ya buku. Yeba lingala, maloko na bomoko na kobima — makafili, nzembo, minaka na podcasti oyo ekarisi — kisha balula makayo oyo otona.",
    cta: "Koba gratis",
    ctaSecondary: "Tala ndenge ekosala",
    reassurance: "Gratis · tɛmɛti banki ezingasali",
    learners: "Bato {n} balingi lisukuzi",
    features: {
      title: "Nyonso esengami, molokatu mosusu",
      lead: "Bungi ya biso, avatar elingani na yo, indela ekosala malembe.",
      languagesValue: "29",
      languagesLabel: "mikótá ya mokili mobimba",
      expressionsValue: "6 600+",
      expressionsLabel: "maloko oyo ekotámbola",
      avatarValue: "3D",
      avatarLabel: "avatar ekotambolá",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio intégrée",
      verifiedValue: "Base de données vérifiée",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Maloko nyonso eyima esali na mbala.",
  },
  ha: {
    badge: "Nutsewa · wannan Afirka · abin da gaske",
    title: "Ƙarfi wannan Afirka cikin kwane 7",
    subtitle:
      "Babu wani yake kamar littafi. Koyi wannan, jumla da al'ada, ta hanyar nutsewa — fim, kiɗo, shiryewa da podcast da kake so — sannan sake dubawa abin da ka ji.",
    cta: "Fara kyauta",
    ctaSecondary: "Duba yadda yake aiki",
    reassurance: "Kyauta · babu katin banki",
    learners: "Masu koyo {n} sun riga sun sanya rajista",
    features: {
      title: "Duk abin da kake buƙata, wuri daya",
      lead: "Babban katalogi, siffar da kake kama da kanka, da hanya da tafi na rayuwa.",
      languagesValue: "29",
      languagesLabel: "harsunan duniya baki ɗaya",
      expressionsValue: "6 600+",
      expressionsLabel: "siffa da wannan da aka rubuce",
      avatarValue: "3D",
      avatarLabel: "siffar da za ka iya sanya",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio intégrée",
      verifiedValue: "Base de données vérifiée",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Kowane siffa tana fito daga wuri mai gaske.",
  },
  yo: {
    badge: "Immersion · slang Africa · àkójọ òtòṣìṣàn",
    title: "Iwe gbogbo slang Afrika ní ọjọ́ 7",
    subtitle:
      "Kò sí ẹnìkan tí ń sọ bí ìwé-ìwé. Kọ́ ẹ̀kọ́ àti ìlù àti àwọn àdà kíkọ àti ìlù nípa líle lọ sí ínú àwọn fílm, orin, àwọn ìwé àti àwọn podcast tí o fẹ́ràn, lẹ́yìn náà tún gbé ìhùwàsí rẹ̀ lọ.",
    cta: "Bẹ̀rẹ̀ láìsan",
    ctaSecondary: "Wo bí ó ṣe ṣiṣẹ́",
    reassurance: "Láìsan · kì í ṣe àwọn káàdì ìbanki",
    learners: "Àwọn ẹ̀kọ́ {n} ti tẹ́lẹ̀ forúkọsílẹ̀",
    features: {
      title: "Gbogbo ohun tí o nílò, ní ibí kan",
      lead: "Àkójọ púpọ̀, àwòrán tí ó bẹ̀rẹ̀ sí ọ, àti ọ̀nà tí ó bá ṣiṣẹ́ nínú ìgbésí ayé.",
      languagesValue: "29",
      languagesLabel: "àwọn èdè kárí ayé",
      expressionsValue: "6 600+",
      expressionsLabel: "ìlù àti slang tí a kọ sílẹ̀",
      avatarValue: "3D",
      avatarLabel: "àwòrán tí a ṣe gbé",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio intégrée",
      verifiedValue: "Base de données vérifiée",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Àwọn ìlù kọ̀ọ̀kan wá láti ibí òun.",
  },
  zu: {
    badge: "Ukuhlanganisa · isigaba sase-Afrika · umlayezo wangempela",
    title: "Funda isigaba sase-Afrika ngeminyaka engu-7",
    subtitle:
      "Akekho olukhuluma jengebhuku. Funda ulimi, izisho namasomi ngokuhlanganisa — amafilimu, umculo, izinhundlo kanye nezincwadi ozithandayo — bese uphinda lokho owake wabona.",
    cta: "Qala mahhala",
    ctaSecondary: "Bona ukuthi kusebenza kanjani",
    reassurance: "Mahhala · akukho ikhadi leyasekhenti",
    learners: "Abafundi {n} babesekele khona",
    features: {
      title: "Konke okudingayo, endaweni eyodwa",
      lead: "Ikhatala elikhulu, isithombe esifana nawe, kanye nendlela esebenza empilweni.",
      languagesValue: "29",
      languagesLabel: "izilimi zomhlaba wonke",
      expressionsValue: "6 600+",
      expressionsLabel: "izisho nezigaba ezichazulwe",
      avatarValue: "3D",
      avatarLabel: "isithombe esilungiselelwe",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio intégrée",
      verifiedValue: "Base de données vérifiée",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Isisho ngasinye sivela endaweni yangempela.",
  },
  wo: {
    badge: "Immersion · wannan Afrik · kontë bu wërëy",
    title: "Jàng wannan Afrik ci suli 7",
    subtitle:
      "Kenn ku am bu kenn woys téem. Jàng wannan ak yout ak kultura bi immersion — sinema, musiq,电视剧 ak podcast yeuy nga def bëgg — teus benn yi lay def tey.",
    cta: "Tambali mbir",
    ctaSecondary: "Gis li ndi defe",
    reassurance: "Mbir · kart banquier bu beddingul",
    learners: "Koy {n} di rëgg",
    features: {
      title: "Lool dund bu dox nga bopp bu bees",
      lead: "Liista bu mbaadh, avatar bi lay yër, ak nit mbaad bu bëgg bu topp.",
      languagesValue: "29",
      languagesLabel: "làkk yu àdduna bépp",
      expressionsValue: "6 600+",
      expressionsLabel: "mbaat ak wannan dokku",
      avatarValue: "3D",
      avatarLabel: "avatar bu lay tëm",
      cultureValue: "20",
      cultureLabel: "concepts universels",
      pronunciationValue: "Audio native",
      pronunciationLabel: "Prononciation audio intégrée",
      verifiedValue: "Base de données vérifiée",
      verifiedLabel: "Zero hallucination",
    },
    globeCaption: "Koy mbaat nu fi ci àdd baak bu wërëy.",
  },
};

export function getLandingCopy(lang: string): unknown | undefined {
  const landing = LANDING[lang];
  if (!landing) return undefined;
  return { landing };
}
