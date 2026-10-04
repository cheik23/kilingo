export type AchievementCategory = "lang" | "streak" | "quiz" | "conv" | "explore" | "collect";
export type AchievementTier = "bronze" | "silver" | "gold";

export type AchievementDefinition = {
  achievementId: string;
  category: AchievementCategory;
  title: string;
  description: string;
  target: number;
  reward: { xp: number; gems: number; badgeId?: string };
  icon: string;
  tier: AchievementTier;
  metric: string;
  titleTranslations: Record<string, string>;
  descriptionTranslations: Record<string, string>;
};

const LANGS = ["fr", "en", "es", "zh", "ar", "ru", "sw", "ln", "ha", "yo", "zu", "wo"] as const;
const CATEGORY_WORDS: Record<AchievementCategory, Record<(typeof LANGS)[number], string>> = {
  lang: { fr: "Expressions", en: "Expressions", es: "Expresiones", zh: "表达", ar: "تعبيرات", ru: "Выражения", sw: "Misemo", ln: "Maloba", ha: "Maganganu", yo: "Ọ̀rọ̀", zu: "Izisho", wo: "Mbises bu bees" },
  streak: { fr: "Jours de streak", en: "Streak days", es: "Días de racha", zh: "连续天数", ar: "أيام السلسلة", ru: "Дни серии", sw: "Siku mfululizo", ln: "Mikolo", ha: "Kwana", yo: "Ọjọ̀", zu: "Izinsuku", wo: "Bisse bu top级" },
  quiz: { fr: "Quiz", en: "Quizzes", es: "Cuestionarios", zh: "测验", ar: "اختبارات", ru: "Викторины", sw: "Majaribio", ln: "Quiz", ha: "Gwaji", yo: "Ìdíwọ̀", zu: "Izivivinyo", wo: "Quiz" },
  conv: { fr: "Conversations", en: "Conversations", es: "Conversaciones", zh: "对话", ar: "محادثات", ru: "Беседы", sw: "Mazungumzo", ln: "Maloba", ha: "Tattaunawa", yo: "Ìjíròrò", zu: "Ingxoxo", wo: "Mbises" },
  explore: { fr: "Explorations", en: "Explorations", es: "Exploraciones", zh: "探索", ar: "استكشافات", ru: "Исследования", sw: "Uchunguzi", ln: "Kozwa", ha: "Bincike", yo: "Ìwòlé", zu: "Ukuhlola", wo: "Kop" },
  collect: { fr: "Collections", en: "Collection items", es: "Colecciones", zh: "收藏", ar: "مجموعات", ru: "Коллекции", sw: "Mkusanyiko", ln: "Kekoko", ha: "Tattara", yo: "Àwọn àkójọ", zu: "Izinto", wo: "Tig collection" },
};

const SPECIAL_FR: Record<string, string> = {
  "yoruba-master-500": "Maître du Yoruba",
  polyglotte: "Polyglotte",
  "african-explorer": "Explorateur Africain",
  fire: "En feu",
  comeback: "Revenant",
  marathon: "Marathonien",
  perfection: "Perfectionniste",
  fast: "Rapide",
  endurance: "Endurance",
  actor: "Acteur Né",
  negotiator: "Négociateur",
  fluent: "Fluent",
  "atlas-master": "Atlas Master",
  "shadow-pro": "Shadow Pro",
  "cultural-bridge": "Pont Culturel",
  collector: "Collectionneur",
  "loot-hunter": "Chasseur de Loot",
  "gems-master": "Gems Master",
};

const ICONS: Record<AchievementCategory, string> = {
  lang: "🗣️", streak: "🔥", quiz: "🧠", conv: "🎭", explore: "🧭", collect: "💎",
};

function tierFor(_target: number, index: number): AchievementTier {
  if (index >= 2) return "gold";
  if (index === 1) return "silver";
  return "bronze";
}

function make(
  id: string,
  category: AchievementCategory,
  target: number,
  metric: string,
  index: number,
): AchievementDefinition {
  const tier = tierFor(target, index);
  const special = id.startsWith("yoruba-master")
    ? "Maître du Yoruba"
    : id.startsWith("perfection")
      ? "Perfectionniste"
      : id.startsWith("fast")
        ? "Rapide"
        : id.startsWith("actor")
          ? "Acteur Né"
          : SPECIAL_FR[id] ?? `${CATEGORY_WORDS[category].fr} ${target}`;
  const title = `${special} ${["Bronze", "Argent", "Or"][index] ?? tier}`;
  const description = `${target} ${CATEGORY_WORDS[category].fr.toLowerCase()}${metric.includes("perfect") ? " parfait" : metric.includes("fast") ? " rapide" : ""}`;
  const titleTranslations = Object.fromEntries(LANGS.map((lang) => [lang, id.startsWith("yoruba-master") || id.startsWith("perfection") || id.startsWith("fast") || id.startsWith("actor") ? title : id === "polyglotte" && index === 0 ? "Polyglotte" : id === "african-explorer" && index === 0 ? "Explorateur Africain" : `${CATEGORY_WORDS[category][lang]} ${target}`]));
  const descriptionTranslations = Object.fromEntries(LANGS.map((lang) => [lang, `${target} ${CATEGORY_WORDS[category][lang].toLowerCase()}`]));
  return {
    achievementId: id,
    category,
    title,
    description,
    target,
    reward: { xp: Math.max(20, Math.min(500, target * 2 + index * 20)), gems: Math.max(5, Math.min(100, Math.round(target / 5) + index * 5)), ...(tier === "gold" ? { badgeId: id } : {}) },
    icon: ICONS[category],
    tier,
    metric,
    titleTranslations,
    descriptionTranslations,
  };
}

function series(category: AchievementCategory, prefix: string, metrics: string[], targets: number[]) {
  return targets.map((target, index) => make(`${prefix}-${target}`, category, target, metrics[index] ?? metrics[0] ?? "total", index));
}

const definitions: AchievementDefinition[] = [
  ...series("lang", "yoruba-master", ["cards:yo"], [100, 300, 500]),
  ...series("lang", "polyglotte", ["languages:mastered"], [3, 5, 8, 12]),
  ...series("lang", "african-explorer", ["languages:african"], [3, 6, 11]),
  ...LANGS.slice(0, 10).map((lang) => make(`first-steps-${lang}`, "lang", 5, `cards:${lang}`, 0)),
  ...LANGS.slice(0, 10).map((lang) => make(`explorer-${lang}`, "lang", 50, `cards:${lang}`, 1)),
  ...series("streak", "fire", ["longestStreak"], [7, 14, 30, 60, 90, 180, 365]),
  ...series("streak", "comeback", ["comebacks"], [1, 3, 7, 14]),
  ...series("streak", "marathon", ["longestStreak"], [100, 200, 365]),
  ...series("streak", "guardian", ["freezeUses"], [1, 3, 10, 30]),
  ...series("streak", "active-days", ["activeDays"], [7, 14, 30, 60, 90, 180, 365]),
  ...series("quiz", "perfection", ["quiz:perfect"], [10, 25, 50, 100]),
  ...series("quiz", "fast", ["quiz:fast"], [5, 20, 50]),
  ...series("quiz", "endurance", ["quiz:total"], [100, 500, 1000]),
  ...series("quiz", "first-quiz", ["quiz:total"], [1, 5, 10]),
  ...series("quiz", "sharp", ["quiz:correct"], [50, 250, 1000]),
  ...series("quiz", "accuracy", ["quiz:accuracy90"], [10, 50, 200]),
  ...series("quiz", "quiz-streak", ["quiz:days"], [7, 14, 30]),
  ...series("quiz", "quiz-xp", ["quiz:xp"], [500, 2000, 10000]),
  ...series("quiz", "quiz-languages", ["quiz:languages"], [3, 6, 11]),
  ...series("quiz", "perfect-any", ["quiz:perfectAny"], [1, 5]),
  ...series("conv", "actor", ["conv:baba"], [5, 20, 50]),
  ...series("conv", "negotiator", ["conv:marche"], [10, 30, 60]),
  ...series("conv", "fluent", ["conv:total"], [50, 100, 200]),
  ...series("conv", "turns", ["conv:turns"], [50, 200, 500]),
  ...series("conv", "quality", ["conv:quality80"], [5, 20]),
  ...series("conv", "characters", ["conv:characters"], [3, 8, 15]),
  ...series("conv", "scenarios", ["conv:scenarios"], [3, 10, 20]),
  ...series("conv", "conv-languages", ["conv:languages"], [3, 5]),
  ...series("conv", "conv-days", ["conv:days"], [7, 30, 90]),
  ...series("explore", "atlas-master", ["atlas:uses"], [50, 200, 500]),
  ...series("explore", "shadow-pro", ["shadow:analyses"], [10, 50, 100]),
  ...series("explore", "cultural-bridge", ["cross:uses"], [10, 15, 20]),
  ...series("explore", "media-collector", ["media:saved"], [10, 50, 200]),
  ...series("explore", "atlas-languages", ["browse:languages"], [3, 6, 12]),
  ...series("explore", "focus-sessions", ["focus:sessions"], [10, 50]),
  ...series("explore", "expression-hunter", ["expressions:discovered"], [25, 100, 500]),
  ...series("collect", "collector", ["cards:total"], [50, 200, 500]),
  ...series("collect", "loot-hunter", ["loot:opened"], [10, 50, 100]),
  ...series("collect", "gems-master", ["gems:balance"], [1000, 5000, 10000]),
  ...series("collect", "favorite-collector", ["favorites:count"], [10, 50, 200]),
  ...series("collect", "deck-languages", ["deck:languages"], [3, 6, 11, 12]),
  ...series("collect", "mastered-cards", ["cards:mastered"], [10, 50]),
  ...series("collect", "perfect-collection", ["quiz:perfect"], [5, 25]),
];

if (definitions.length !== 150) throw new Error(`Achievement catalog must contain 150 items, got ${definitions.length}`);
export const ACHIEVEMENT_DEFINITIONS = definitions;
export const ACHIEVEMENT_LANGUAGES = LANGS;
