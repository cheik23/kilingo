export const LANGUAGES = [
  {
    code: "en",
    name: "Anglais",
    flag: "🇺🇸",
    cities: ["New York", "Londres"],
    countries: "USA · UK",
    description:
      "Le slang de Brooklyn à Shoreditch — hip-hop, séries, TikTok et bodega talk.",
  },
  {
    code: "zh",
    name: "Mandarin",
    flag: "🇨🇳",
    cities: ["Beijing", "Shanghai"],
    countries: "Chine",
    description:
      "Du wǎngluò yǔ des networks au langage des bubble tea — le mandarin qui scrolle vraiment.",
  },
  {
    code: "es",
    name: "Espagnol",
    flag: "🇪🇸",
    cities: ["Madrid", "Mexico"],
    countries: "España · LatAm",
    description:
      "De Vallecas à CDMX — jerga de barrio, reggaetón etseries, sin filtro.",
  },
  {
    code: "ar",
    name: "Arabe",
    flag: "🇸🇦",
    cities: ["Dubaï", "Le Caire"],
    countries: "MENA",
    description:
      "MSA + dialectes de la rue — darija de café, alexandrin de TikTok.",
  },
  {
    code: "ru",
    name: "Russe",
    flag: "🇷🇺",
    cities: ["Moscou", "Saint-Pétersbourg"],
    countries: "Russie",
    description:
      "Le mat qui claque — kladbishchenskiy fraz, memes Telegram et trombones de cour.",
  },
  {
    code: "sw",
    name: "Swahili",
    flag: "🇰🇪",
    cities: ["Nairobi", "Dar es Salaam"],
    countries: "Kenya · Tanzanie",
    description:
      "Sheng de Nairobi au lugha ya mtaani tanzanien — le swahili qui débarde.",
  },
  {
    code: "ln",
    name: "Lingala",
    flag: "🇨🇩",
    cities: ["Kinshasa", "Brazzaville"],
    countries: "RDC · Congo",
    description:
      "L'indoubil de Kin — la rue qui chante, du ndombolo aux réseaux.",
  },
  {
    code: "ha",
    name: "Haoussa",
    flag: "🇳🇬",
    cities: ["Kano", "Zinder"],
    countries: "Nigeria Nord · Niger",
    description:
      "Hausa street de Kano à Kannywood — l'argot du Sahel connecté.",
  },
  {
    code: "yo",
    name: "Yoruba",
    flag: "🇳🇬",
    cities: ["Lagos", "Cotonou"],
    countries: "Nigeria Sud-Ouest · Bénin",
    description:
      "Lagos street et slang Afrobeat — la langue qui fait danser le continent.",
  },
  {
    code: "zu",
    name: "Zoulou",
    flag: "🇿🇦",
    cities: ["Durban", "Johannesburg"],
    countries: "Afrique du Sud",
    description:
      "Township slang et Amapiano — isiZulu eKasi, la rue de Gauteng.",
  },
  {
    code: "wo",
    name: "Wolof",
    flag: "🇸🇳",
    cities: ["Dakar", "Banjul"],
    countries: "Sénégal · Gambie",
    description:
      "Dakar rue et mbalax — le wolof urbain qui trimarde sur la scène.",
  },
  /* ── Lot final : 18 langues (12 + 18 = 30) ──────────────────────────
     Mêmes champs que les précédentes, donc mêmes écrans (onboarding,
     FocusDialog, menus, Hero de la boutique) sans code spécifique. */
  {
    code: "de",
    name: "Allemand",
    flag: "🇩🇪",
    cities: ["Berlin", "Vienne"],
    countries: "Deutschland · Österreich · Schweiz",
    description:
      "Du Kiez-Berlin au Wiener Schmäh — l'allemand de rue, du rap au TikTok.",
  },
  {
    code: "hi",
    name: "Hindi",
    flag: "🇮🇳",
    cities: ["Delhi", "Mumbai"],
    countries: "Inde",
    description:
      "Du Bambaiya de Bombay au Hinglish de Delhi — la rue qui mélange tout.",
  },
  {
    code: "bn",
    name: "Bengali",
    flag: "🇧🇩",
    cities: ["Dhaka", "Kolkata"],
    countries: "Bangladesh · Inde",
    description:
      "L'adda de Dhaka à Kolkata — le bangla des campus et des réseaux.",
  },
  {
    code: "pt",
    name: "Portugais",
    flag: "🇵🇹",
    cities: ["Lisbonne", "São Paulo"],
    countries: "Portugal · Brasil",
    description:
      "De la gíria de Lisbonne au papo do Rio — le portugais qui débarde.",
  },
  {
    code: "ur",
    name: "Ourdou",
    flag: "🇵🇰",
    cities: ["Karachi", "Lahore"],
    countries: "Pakistan · Inde",
    description:
      "L'ourdou de Karachi à Lahore — sher de rue et vannes de cricket.",
  },
  {
    code: "id",
    name: "Indonésien",
    flag: "🇮🇩",
    cities: ["Jakarta", "Surabaya"],
    countries: "Indonésie",
    description:
      "Bahasa gaul de Jakarta — du warung aux réseaux, le bahasa qui scrolle.",
  },
  {
    code: "ja",
    name: "Japonais",
    flag: "🇯🇵",
    cities: ["Tokyo", "Osaka"],
    countries: "Japon",
    description:
      "Du wakamono-kotoba de Shibuya au keigo de bureau — le japonais connecté.",
  },
  {
    code: "tr",
    name: "Turc",
    flag: "🇹🇷",
    cities: ["Istanbul", "Izmir"],
    countries: "Türkiye",
    description:
      "L'argo d'Istanbul entre sokak et réseaux — le turc qui apostrophe.",
  },
  {
    code: "ko",
    name: "Coréen",
    flag: "🇰🇷",
    cities: ["Séoul", "Busan"],
    countries: "Corée du Sud",
    description:
      "Du banmal de Séoul aux répliques de K-drama — le coréen qui chambre.",
  },
  {
    code: "it",
    name: "Italien",
    flag: "🇮🇹",
    cities: ["Rome", "Milan"],
    countries: "Italia · Svizzera",
    description:
      "Du romanesco au milanese — l'italien de bar et de strada, senza filtri.",
  },
  {
    code: "th",
    name: "Thaï",
    flag: "🇹🇭",
    cities: ["Bangkok", "Chiang Mai"],
    countries: "Thaïlande",
    description:
      "Le thaï de Bangkok — street food, lakorn et argot de campus.",
  },
  {
    code: "vi",
    name: "Vietnamien",
    flag: "🇻🇳",
    cities: ["Hanoï", "Saigon"],
    countries: "Việt Nam",
    description:
      "De Hanoï à Saigon — le tiếng lóng des rues et des réseaux.",
  },
  {
    code: "am",
    name: "Amharique",
    flag: "🇪🇹",
    cities: ["Addis-Abeba", "Gondar"],
    countries: "Éthiopie",
    description:
      "L'amharique d'Addis — azmari, fidel et argot de quartier.",
  },
  {
    code: "ig",
    name: "Igbo",
    flag: "🇳🇬",
    cities: ["Enugu", "Onitsha"],
    countries: "Nigeria Sud-Est",
    description:
      "L'igbo d'Enugu à Onitsha — proverbes, Nollywood et slang de campus.",
  },
  {
    code: "fa",
    name: "Persan",
    flag: "🇮🇷",
    cities: ["Téhéran", "Kaboul"],
    countries: "Iran · Afghanistan · Tadjikistan",
    description:
      "Le persan de Téhéran à Kaboul — zaban-e kuche et poésie de réseaux.",
  },
  {
    code: "tl",
    name: "Tagalog",
    flag: "🇵🇭",
    cities: ["Manille", "Cebu"],
    countries: "Pilipinas",
    description:
      "Le Taglish de Manille — jeepney, teleserye et TikTok.",
  },
  {
    code: "pl",
    name: "Polonais",
    flag: "🇵🇱",
    cities: ["Varsovie", "Cracovie"],
    countries: "Polska",
    description:
      "Le polonais de Varsovie — gwara de quartier et memes d'internet.",
  },
  {
    code: "el",
    name: "Grec",
    flag: "🇬🇷",
    cities: ["Athènes", "Thessalonique"],
    countries: "Elláda · Chypre",
    description:
      "Du grec d'Athènes au chypriote — argot de kafeneio et de TikTok.",
  },
] as const;

export type LanguageCode =
  | "en"
  | "zh"
  | "es"
  | "ar"
  | "ru"
  | "sw"
  | "ln"
  | "ha"
  | "yo"
  | "zu"
  | "wo"
  | "de"
  | "hi"
  | "bn"
  | "pt"
  | "ur"
  | "id"
  | "ja"
  | "tr"
  | "ko"
  | "it"
  | "th"
  | "vi"
  | "am"
  | "ig"
  | "fa"
  | "tl"
  | "pl"
  | "el";

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LanguageCode[];

/* ═══════════════════════════════════════════════════════════════════
   REGISTRES — identifiants internes normalisés (multilingue), jamais
   traduits mécaniquement : les composants affichent les libellés via
   i18n (clé `registers.*`). Les anciennes valeurs des données existantes
   (street/casual/vulgar/internet) sont comprises partout.
   ═══════════════════════════════════════════════════════════════════ */

export type RegisterId = "urban" | "colloquial" | "unfiltered" | "trending";

export const REGISTER_IDS: RegisterId[] = [
  "urban",
  "colloquial",
  "unfiltered",
  "trending",
];

/** Ancien identifiant (données existantes) → identifiant normalisé. */
const REGISTER_LEGACY: Record<string, RegisterId> = {
  street: "urban",
  casual: "colloquial",
  vulgar: "unfiltered",
  internet: "trending",
};

/**
 * Clé normalisée d'un registre, quel que soit l'âge de la donnée.
 * Retourne null pour une valeur inconnue (affichée brute).
 */
export function registerKey(r: string): RegisterId | null {
  const legacy = REGISTER_LEGACY[r];
  if (legacy) return legacy;
  return (REGISTER_IDS as readonly string[]).includes(r) ? (r as RegisterId) : null;
}

/**
 * Libellé localisé : côté React, préférer t(`registers.${id}`) via i18n ;
 * cette clé FR sert de fallback (landing, textes hors provider).
 */
export function registerLabel(register: string): string {
  return REGISTERS[registerKey(register) ?? register] ?? register;
}

/** Libellés français (fallback hors i18n — landing, textes figés). */
export const REGISTERS: Record<string, string> = {
  urban: "Urbain",
  colloquial: "Familier",
  unfiltered: "Sans filtre",
  trending: "Tendance",
  // identifiants hérités, mêmes libellés
  street: "Urbain",
  casual: "Familier",
  vulgar: "Sans filtre",
  internet: "Tendance",
};

/* ═══════════════════════════════════════════════════════════════════
   PAYS — vrai paramètre du moteur de découverte. Les données stockent
   `region` en texte libre (« España », « US (AAVE) », « Mexique »…);
   `normalizeRegion` le rabat sur un code pays stable pour filtrer pour
   de vrai (Espagne ⇒ aucune expression US).
   ═══════════════════════════════════════════════════════════════════ */

export type CountryOption = { code: string; label: string; flag: string };

/** Choix proposés par langue d'apprentissage. */
export const COUNTRIES: Record<LanguageCode, CountryOption[]> = {
  en: [
    { code: "us", label: "États-Unis", flag: "🇺🇸" },
    { code: "uk", label: "Royaume-Uni", flag: "🇬🇧" },
    { code: "jm", label: "Jamaïque", flag: "🇯🇲" },
    { code: "za", label: "Afrique du Sud", flag: "🇿🇦" },
    { code: "af", label: "Afrique", flag: "🌍" },
  ],
  es: [
    { code: "es", label: "España", flag: "🇪🇸" },
    { code: "mx", label: "México", flag: "🇲🇽" },
    { code: "ar", label: "Argentina", flag: "🇦🇷" },
    { code: "co", label: "Colombia", flag: "🇨🇴" },
    { code: "cl", label: "Chile", flag: "🇨🇱" },
    { code: "ve", label: "Venezuela", flag: "🇻🇪" },
    { code: "pe", label: "Perú", flag: "🇵🇪" },
    { code: "pr", label: "Puerto Rico", flag: "🇵🇷" },
    { code: "latam", label: "LatAm", flag: "🌎" },
    { code: "car", label: "Caraïbes", flag: "🏝️" },
  ],
  zh: [{ code: "cn", label: "中国", flag: "🇨🇳" }],
  ar: [
    { code: "eg", label: "Égypte", flag: "🇪🇬" },
    { code: "ma", label: "Maroc", flag: "🇲🇦" },
    { code: "lb", label: "Liban", flag: "🇱🇧" },
    { code: "gulf", label: "Golfe", flag: "🕌" },
    { code: "lev", label: "Levant", flag: "🌊" },
    { code: "magh", label: "Maghreb", flag: "🌍" },
    { code: "mena", label: "MENA", flag: "🌐" },
  ],
  ru: [{ code: "ru", label: "Russie", flag: "🇷🇺" }],
  // ── Langues africaines (Chantier 4) ──────────────────────────────────
  sw: [
    { code: "ke", label: "Kenya", flag: "🇰🇪" },
    { code: "tz", label: "Tanzanie", flag: "🇹🇿" },
  ],
  ln: [
    { code: "cd", label: "RDC (Kinshasa)", flag: "🇨🇩" },
    { code: "cg", label: "Congo-Brazzaville", flag: "🇨🇬" },
  ],
  ha: [
    { code: "ng-n", label: "Nigeria Nord", flag: "🇳🇬" },
    { code: "ne", label: "Niger", flag: "🇳🇪" },
  ],
  yo: [
    { code: "ng-sw", label: "Nigeria Sud-Ouest", flag: "🇳🇬" },
    { code: "bj", label: "Bénin", flag: "🇧🇯" },
  ],
  zu: [{ code: "za", label: "Afrique du Sud", flag: "🇿🇦" }],
  wo: [
    { code: "sn", label: "Sénégal", flag: "🇸🇳" },
    { code: "gm", label: "Gambie", flag: "🇬🇲" },
  ],
  /* ── Lot final : mêmes pays que la carte (LANGUAGE_GEO), plus les
     variantes régionales utiles au filtre de découverte. ─────────────── */
  de: [
    { code: "de", label: "Deutschland", flag: "🇩🇪" },
    { code: "at", label: "Österreich", flag: "🇦🇹" },
    { code: "ch", label: "Schweiz", flag: "🇨🇭" },
  ],
  hi: [
    { code: "in", label: "Inde", flag: "🇮🇳" },
  ],
  bn: [
    { code: "bd", label: "Bangladesh", flag: "🇧🇩" },
    { code: "in", label: "Inde (Bengale-Occidental)", flag: "🇮🇳" },
  ],
  pt: [
    { code: "pt", label: "Portugal", flag: "🇵🇹" },
    { code: "br", label: "Brasil", flag: "🇧🇷" },
    { code: "ao", label: "Angola", flag: "🇦🇴" },
    { code: "mz", label: "Moçambique", flag: "🇲🇿" },
  ],
  ur: [
    { code: "pk", label: "Pakistan", flag: "🇵🇰" },
    { code: "in", label: "Inde", flag: "🇮🇳" },
  ],
  id: [
    { code: "id", label: "Indonesia", flag: "🇮🇩" },
  ],
  ja: [
    { code: "jp", label: "日本", flag: "🇯🇵" },
  ],
  tr: [
    { code: "tr", label: "Türkiye", flag: "🇹🇷" },
  ],
  ko: [
    { code: "kr", label: "대한민국", flag: "🇰🇷" },
  ],
  it: [
    { code: "it", label: "Italia", flag: "🇮🇹" },
    { code: "ch", label: "Svizzera", flag: "🇨🇭" },
  ],
  th: [
    { code: "th", label: "ประเทศไทย", flag: "🇹🇭" },
  ],
  vi: [
    { code: "vn", label: "Việt Nam", flag: "🇻🇳" },
  ],
  am: [
    { code: "et", label: "ኢትዮጵያ", flag: "🇪🇹" },
  ],
  ig: [
    { code: "ng-se", label: "Nigeria Sud-Est", flag: "🇳🇬" },
  ],
  fa: [
    { code: "ir", label: "ایران", flag: "🇮🇷" },
    { code: "af", label: "افغانستان", flag: "🇦🇫" },
    { code: "tj", label: "Тоҷикистон", flag: "🇹🇯" },
  ],
  tl: [
    { code: "ph", label: "Pilipinas", flag: "🇵🇭" },
  ],
  pl: [
    { code: "pl", label: "Polska", flag: "🇵🇱" },
  ],
  el: [
    { code: "gr", label: "Ελλάδα", flag: "🇬🇷" },
    { code: "cy", label: "Κύπρος", flag: "🇨🇾" },
  ],
};

/** Alias région (texte libre des données) → code pays stable. */
const REGION_ALIASES: Record<string, string> = {
  // EN
  us: "us",
  usa: "us",
  uk: "uk",
  jamaique: "jm",
  "afrique du sud": "za",
  afrique: "af",
  // ES
  espana: "es",
  spain: "es",
  mexico: "mx",
  mexique: "mx",
  argentina: "ar",
  argentine: "ar",
  colombia: "co",
  colombie: "co",
  chile: "cl",
  chili: "cl",
  venezuela: "ve",
  peru: "pe",
  "porto rico": "pr",
  latam: "latam",
  caribe: "car",
  caraibes: "car",
  // ZH
  chine: "cn",
  china: "cn",
  // AR
  egypte: "eg",
  maroc: "ma",
  liban: "lb",
  golfe: "gulf",
  levant: "lev",
  maghreb: "magh",
  mena: "mena",
  // RU
  russie: "ru",
  russia: "ru",
  france: "fr",
  // SW — Kenya · Tanzanie
  kenya: "ke",
  nairobi: "ke",
  tanzanie: "tz",
  tanzania: "tz",
  "dar es salaam": "tz",
  zanzibar: "tz",
  // LN — RDC · Congo-Brazzaville
  rdc: "cd",
  congo: "cd",
  kinshasa: "cd",
  kin: "cd",
  "congo-brazzaville": "cg",
  brazzaville: "cg",
  // HA — Nigeria Nord · Niger
  "nigeria nord": "ng-n",
  kano: "ng-n",
  kannywood: "ng-n",
  niger: "ne",
  niamey: "ne",
  // YO — Nigeria Sud-Ouest · Bénin
  "nigeria sud-ouest": "ng-sw",
  "lagos street": "ng-sw",
  lagos: "ng-sw",
  afrobeat: "ng-sw",
  benin: "bj",
  cotonou: "bj",
  // ZU — Afrique du Sud
  township: "za",
  amapiano: "za",
  gauteng: "za",
  durban: "za",
  // WO — Sénégal · Gambie
  senegal: "sn",
  dakar: "sn",
  mbalax: "sn",
  "rap sn": "sn",
  gambie: "gm",
  gambia: "gm",
  banjul: "gm",
  // ── Lot final : libellés des pays proposés par les 18 nouvelles langues.
  // Sans ces alias, une expression de région « Brasil » ne serait jamais
  // retenue par le filtre pays « br » (le label et le code diffèrent).
  allemagne: "de",
  germany: "de",
  deutschland: "de",
  autriche: "at",
  osterreich: "at",
  austria: "at",
  suisse: "ch",
  schweiz: "ch",
  svizzera: "ch",
  inde: "in",
  india: "in",
  bangladesh: "bd",
  portugal: "pt",
  brasil: "br",
  bresil: "br",
  brazil: "br",
  angola: "ao",
  mozambique: "mz",
  pakistan: "pk",
  indonesie: "id",
  indonesia: "id",
  japon: "jp",
  japan: "jp",
  turkiye: "tr",
  turquie: "tr",
  turkey: "tr",
  "coree du sud": "kr",
  "south korea": "kr",
  italie: "it",
  italia: "it",
  italy: "it",
  thailande: "th",
  thailand: "th",
  vietnam: "vn",
  "viet nam": "vn",
  ethiopie: "et",
  ethiopia: "et",
  "nigeria sud-est": "ng-se",
  iran: "ir",
  afghanistan: "af",
  tadjikistan: "tj",
  tajikistan: "tj",
  philippines: "ph",
  pilipinas: "ph",
  pologne: "pl",
  polska: "pl",
  poland: "pl",
  grece: "gr",
  greece: "gr",
  ellada: "gr",
  chypre: "cy",
  cyprus: "cy",
};

/**
 * « US (AAVE) » → "us" · « España » → "es" · « Mexique » → "mx".
 * Insensible casse/accents ; le contenu entre parenthèses est ignoré.
 */
export function normalizeRegion(region: string): string {
  const base = region
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")
    .trim();
  return REGION_ALIASES[base] ?? base;
}

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CEFRLevel = (typeof CEFR_LEVELS)[number];

/** XP thresholds for each CEFR level. Index 0 = A1 threshold. */
export const LEVEL_XP: Record<CEFRLevel, number> = {
  A1: 0,
  A2: 120,
  B1: 400,
  B2: 900,
  C1: 1600,
  C2: 2600,
};

export function levelFromXp(xp: number): CEFRLevel {
  let level: CEFRLevel = "A1";
  for (const l of CEFR_LEVELS) {
    if (xp >= LEVEL_XP[l]) level = l;
  }
  return level;
}

export function levelProgress(xp: number): number {
  const level = levelFromXp(xp);
  const idx = CEFR_LEVELS.indexOf(level);
  if (level === "C2") return 100;
  const next = CEFR_LEVELS[idx + 1];
  const cur = LEVEL_XP[level];
  const nextXp = LEVEL_XP[next];
  return Math.min(100, Math.round(((xp - cur) / (nextXp - cur)) * 100));
}

const DAY_MS = 86_400_000;

/* ═══════════════════════════════════════════════════════════════════
   Machine à états du SRS — learning → confirming → mastered.
   learning   : carte en cours d'acquisition.
   confirming : revue "pour être sûr" — good/easy la valide définitivement.
   mastered   : ne sera PLUS JAMAIS proposée (due = null).
   ═══════════════════════════════════════════════════════════════════ */

export type CardStatus = "new" | "learning" | "confirming" | "mastered";

export type ReviewOutcome = {
  status: CardStatus;
  intervalDays: number;
  /** timestamp de la prochaine revue, ou null pour une carte maîtrisée. */
  due: number | null;
  /** vrai quand la carte vient de passer en "mastered" (feedback UI). */
  justMastered: boolean;
};

export function advanceCard(status: CardStatus, rating: "again" | "hard" | "good" | "easy", now: number): ReviewOutcome {
  const inDays = (d: number) => now + d * DAY_MS;

  // mastered : exclu de toutes les files — ne devrait plus être noté.
  if (status === "mastered") {
    return { status: "mastered", intervalDays: 0, due: null, justMastered: false };
  }

  if (status === "confirming") {
    // La revue "pour être sûr" : good/easy valident définitivement.
    if (rating === "good" || rating === "easy") {
      return { status: "mastered", intervalDays: 0, due: null, justMastered: true };
    }
    // again / hard → retour en apprentissage.
    const interval = rating === "again" ? 1 : 2;
    return {
      status: "learning",
      intervalDays: interval,
      due: inDays(interval),
      justMastered: false,
    };
  }

  // status === "learning" (ou "new" traité comme learning au premier pas).
  switch (rating) {
    case "again":
      return { status: "learning", intervalDays: 1, due: inDays(1), justMastered: false };
    case "hard":
      return { status: "learning", intervalDays: 2, due: inDays(2), justMastered: false };
    case "good":
      return { status: "confirming", intervalDays: 2, due: inDays(2), justMastered: false };
    case "easy":
      // Confirmation accélérée : 1 j au lieu de 2.
      return { status: "confirming", intervalDays: 1, due: inDays(1), justMastered: false };
  }
}

/**
 * Simplified FSRS-style spaced-repetition update (legacy interval math,
 * kept for existing fields easeFactor/repetitions).
 * rating: again | hard | good | easy
 */
export function reviewCard(
  card: { easeFactor: number; intervalDays: number; repetitions: number },
  rating: "again" | "hard" | "good" | "easy",
  now: number,
): { easeFactor: number; intervalDays: number; repetitions: number; nextReview: number } {
  let ease = card.easeFactor;
  let interval = card.intervalDays;
  let reps = card.repetitions;

  if (rating === "again") {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === "hard") {
    interval = Math.max(1, interval * 1.2);
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === "good") {
    if (reps === 0) {
      interval = 1;
    } else {
      interval = Math.max(1, interval * ease);
    }
    reps += 1;
  } else {
    interval = Math.max(1, interval * ease * 1.3);
    ease = ease + 0.15;
    reps += 1;
  }

  return {
    easeFactor: Math.round(ease * 100) / 100,
    intervalDays: Math.round(interval * 100) / 100,
    repetitions: reps,
    nextReview: now + interval * DAY_MS,
  };
}

export function newCardDefaults(now: number) {
  return {
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReview: now,
    createdAt: now,
    // Machine à états : toute carte neuve démarre en apprentissage.
    status: "learning" as const,
    due: now,
    consecutiveFails: 0,
    lastRating: null,
  };
}

