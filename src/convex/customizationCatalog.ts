import { v } from "convex/values";
import { mutation } from "./_generated/server";

export type CustomizationType = "avatar" | "hat" | "glasses" | "background";
export type CustomizationRarity = "common" | "rare" | "epic" | "legendary";

export type CustomizationDefinition = {
  itemId: string;
  type: CustomizationType;
  name: string;
  description: string;
  rarity: CustomizationRarity;
  priceGems: number;
  achievementId?: string;
  previewUrl: string;
  nameTranslations: Record<string, string>;
  descriptionTranslations: Record<string, string>;
};

const LANGS = ["fr", "en", "es", "zh", "ar", "ru", "sw", "ln", "ha", "yo", "zu", "wo"] as const;
const typeIndexes: Record<CustomizationType, number> = { avatar: 0, hat: 0, glasses: 0, background: 0 };

const TYPE_WORDS: Record<CustomizationType, Record<(typeof LANGS)[number], string>> = {
  avatar: { fr: "Avatar", en: "Avatar", es: "Avatar", zh: "头像", ar: "الصورة الرمزية", ru: "Аватар", sw: "Kijina", ln: "Avatar", ha: "Hoto", yo: "Àwòrán", zu: "Isithombe", wo: "Raxay" },
  hat: { fr: "Chapeau", en: "Hat", es: "Sombrero", zh: "帽子", ar: "قبعة", ru: "Шляпа", sw: "Kofia", ln: "Kapɔ", ha: "Hatsi", yo: "Adé", zu: "Ikhasi", wo: "Kop" },
  glasses: { fr: "Lunettes", en: "Glasses", es: "Gafas", zh: "眼镜", ar: "نظارات", ru: "Очки", sw: "Miwani", ln: "Miso ya meso", ha: "Manya", yo: "Àwọn ọjọ́", zu: "Izibuko", wo: "Lunettes" },
  background: { fr: "Fond", en: "Background", es: "Fondo", zh: "背景", ar: "خلفية", ru: "Фон", sw: "Mandhari", ln: "Mbandɔ", ha: "Bayansa", yo: "Ìtàn", zu: " Umsemu", wo: "Li mbir" },
};

const RARITY_WORDS: Record<CustomizationRarity, Record<(typeof LANGS)[number], string>> = {
  common: { fr: "Classique", en: "Classic", es: "Clásico", zh: "经典", ar: "كلاسيكي", ru: "Классический", sw: "Kawaida", ln: "Klassique", ha: "Na yau da kullum", yo: "Kọ́wà", zu: "Okujwayelekile", wo: "Taxawaay" },
  rare: { fr: "Rare", en: "Rare", es: "Raro", zh: "稀有", ar: "نادر", ru: "Редкий", sw: "Adimu", ln: "Kokoka", ha: "Mai wuya", yo: "Ẹ̀ṣú", zu: "Okuyingqopho", wo: "Sëriiña" },
  epic: { fr: "Épique", en: "Epic", es: "Épico", zh: "史诗", ar: "ملحمي", ru: "Эпический", sw: "Epiki", ln: "Epiki", ha: "Babba", yo: "Títán", zu: "Okukhulu", wo: "Epik" },
  legendary: { fr: "Légendaire", en: "Legendary", es: "Legendario", zh: "传奇", ar: "أسطوري", ru: "Легендарный", sw: "Legendarisi", ln: "Legendarisi", ha: "Labari", yo: "Àṣà", zu: "Umshumane", wo: "Legendarisi" },
};

const DESCRIPTION_WORDS: Record<CustomizationType, Record<(typeof LANGS)[number], string>> = {
  avatar: { fr: "Personnalise ton avatar", en: "Personalize your avatar", es: "Personaliza tu avatar", zh: "个性化你的头像", ar: "خصّص صورتك الرمزية", ru: "Настройте свой аватар", sw: "Badilisha kijina chako", ln: "M personalize avatar na yo", ha: "Tsara da hoto na", yo: "Ṣàtúnṣe àwòrán rẹ", zu: "Personnalisa isithombe sakho", wo: "Soppi raaxay" },
  hat: { fr: "Ajoute une touche de style à ton avatar", en: "Add a stylish detail to your avatar", es: "Añade estilo a tu avatar", zh: "为头像增添时尚细节", ar: "أضف لمسة أنيقة إلى صورتك", ru: "Добавьте стиль своему аватару", sw: "Ongeza mtindo kwa kijina chako", ln: "Yeba lisusu na avatar na yo", ha: "Ƙara salo ga hotonka", yo: "Fi ìṣàfẹ́ni sí àwòrán rẹ", zu: "Faka isithombe sakho ngobuso", wo: "Yokk li mbir bu bees raaxay bi" },
  glasses: { fr: "Affirme ton look", en: "Make your look unmistakable", es: "Define tu estilo", zh: "彰显你的风格", ar: "أبرز إطلالتك", ru: "Подчеркните свой стиль", sw: "Onyesha mtindo wako", ln: "Bongola|style na yo", ha: "Nuna saloninka", yo: "Fi àṣà ní kedere", zu: "Bonisa indlela yakho", wo: "Ñaanu-it mootu" },
  background: { fr: "Transforme ton espace avec cette ambiance", en: "Transform your space with this atmosphere", es: "Transforma tu espacio con este ambiente", zh: "用此氛围改变你的空间", ar: "غيّر مساحتك بهذه الأجواء", ru: "Преобразите пространство этой атмосферой", sw: "Badilisha nafasi yako kwa mazingira haya", ln: "Yebola esika na yo na atmosphere oyo", ha: "Canza bayansa", yo: "Yí àtàn náà padà sí", zu: "Guqula inda yakho ngeze lezi", wo: "Yoonk seen bi ndo li mbir bi" },
};

function localizedName(type: CustomizationType, index: number, lang: (typeof LANGS)[number]): string {
  return `${TYPE_WORDS[type][lang]} ${String(index + 1).padStart(2, "0")}`;
}

function localizedDescription(type: CustomizationType, rarity: CustomizationRarity, lang: (typeof LANGS)[number]): string {
  return `${DESCRIPTION_WORDS[type][lang]} · ${RARITY_WORDS[rarity][lang]}`;
}

function makeItem(
  itemId: string,
  type: CustomizationType,
  name: string,
  description: string,
  previewUrl: string,
  rarity: CustomizationRarity,
  priceGems: number,
  achievementId?: string,
  overrideTranslations?: Partial<Record<(typeof LANGS)[number], { name: string; description: string }>>,
): CustomizationDefinition {
  const index = typeIndexes[type]++;
  const nameTranslations = Object.fromEntries(LANGS.map((lang) => [lang, overrideTranslations?.[lang]?.name ?? localizedName(type, index, lang)]));
  const descriptionTranslations = Object.fromEntries(LANGS.map((lang) => [lang, overrideTranslations?.[lang]?.description ?? localizedDescription(type, rarity, lang)]));
  return { itemId, type, name, description, rarity, priceGems, achievementId, previewUrl, nameTranslations, descriptionTranslations };
}

function svgBackground(id: number, colors: string[], pattern = "noir"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient><pattern id="p${id}" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 28L28 0" stroke="rgba(255,255,255,.12)" stroke-width="2"/></pattern></defs><rect width="640" height="360" fill="url(#g${id})"/><rect width="640" height="360" fill="url(#p${id})"/><circle cx="${100 + id * 37}" cy="${70 + id * 19}" r="${55 + id * 4}" fill="rgba(212,165,116,.18)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const animalAvatars = [
  ["lion", "Lion", "🦁"], ["tiger", "Tigre", "🐯"], ["bear", "Ours", "🐻"], ["fox", "Renard", "🦊"], ["panda", "Panda", "🐼"], ["koala", "Koala", "🐨"], ["raccoon", "Raton laveur", "🦝"], ["zebra", "Zèbre", "🦓"], ["giraffe", "Girafe", "🦒"], ["elephant", "Éléphant", "🐘"], ["hippo", "Hippopotame", "🦛"], ["rhino", "Rhinocéros", "🦏"], ["camel", "Dromadaire", "🐪"], ["kangaroo", "Kangourou", "🦘"], ["hedgehog", "Hérisson", "🦔"], ["squirrel", "Écureuil", "🐿️"], ["bat", "Chauve-souris", "🦇"], ["polar-bear", "Ours blanc", "🐻‍❄️"], ["owl", "Hibou", "🦉"], ["eagle", "Aigle", "🦅"], ["duck", "Canard", "🦆"], ["swan", "Cygne", "🦢"], ["flamingo", "Flamant rose", "🦩"], ["peacock", "Paon", "🦚"], ["parrot", "Perroquet", "🦜"], ["penguin", "Manchot", "🐧"], ["dove", "Colombe", "🕊️"], ["dodo", "Dodo", "🦤"], ["seal", "Phoque", "🦭"], ["otter", "Loutre", "🦦"], ["beaver", "Castor", "🦫"], ["whale", "Baleine", "🐳"], ["dolphin", "Dauphin", "🐬"], ["shark", "Requin", "🦈"], ["octopus", "Pieuvre", "🐙"], ["squid", "Calmar", "🦑"], ["crab", "Crabe", "🦀"], ["lobster", "Homard", "🦞"], ["shrimp", "Crevette", "🦐"],
] as const;

const styledAvatars = [
  ["singer", "Chanteur", "👨‍🎤"], ["singer-female", "Chanteuse", "👩‍🎤"], ["astronaut", "Astro", "🧑‍🚀"], ["mage", "Mage", "🧙‍♂️"], ["sorceress", "Sorcière", "🧙‍♀️"], ["hero", "Héros", "🦸‍♂️"], ["heroine", "Héroïne", "🦸‍♀️"], ["vampire", "Vampire", "🧛‍♂️"], ["vampira", "Vampiress", "🧛‍♀️"], ["zombie", "Zombie", "🧟‍♂️"],
] as const;

const avatars: CustomizationDefinition[] = [
  makeItem("avatar-lion", "avatar", "Lion", "Avatar classique gratuit", "🦁", "common", 0),
  makeItem("avatar-golden-lion", "avatar", "Lion doré", "Avatar exclusif : Maître du Yoruba 500 expressions", "🦁", "legendary", 0, "yoruba-master-500", {
    fr: { name: "Lion doré", description: "Avatar exclusif : Maître du Yoruba 500 expressions" },
    en: { name: "Golden Lion", description: "Exclusive avatar: Yoruba Master — 500 expressions" },
    es: { name: "León dorado", description: "Avatar exclusivo: Maestro del yoruba — 500 expresiones" },
    zh: { name: "金色雄狮", description: "独家头像：约鲁巴语大师——500 个表达" },
    ar: { name: "الأسد الذهبي", description: "صورة رمزية حصرية: خبير اليوروبا — 500 تعبير" },
    ru: { name: "Золотой лев", description: "Эксклюзивный аватар: мастер йоруба — 500 выражений" },
  }),
];

for (const [index, [slug, name, preview]] of animalAvatars.entries()) {
  if (index === 0) continue;
  const rarity: CustomizationRarity = index % 10 === 0 ? "epic" : index % 4 === 0 ? "rare" : "common";
  const price = rarity === "epic" ? 600 : rarity === "rare" ? 240 : 80;
  avatars.push(makeItem(`avatar-${slug}`, "avatar", name, `Avatar ${rarity === "epic" ? "épique" : rarity === "rare" ? "rare" : "classique"}`, preview, rarity, price));
}
for (const [slug, name, preview] of styledAvatars.slice(0, 9)) {
  avatars.push(makeItem(`avatar-${slug}`, "avatar", name, "Personnage stylisé", preview, slug.includes("female") || slug.includes("heroine") || slug === "vampira" ? "rare" : "epic", slug.includes("female") || slug.includes("heroine") || slug === "vampira" ? 280 : 520));
}
avatars.push(makeItem("avatar-global-polyglot", "avatar", "Globe polyglotte", "Avatar exclusif : maîtrise de 12 langues", "🌍", "legendary", 0, "polyglotte-12", {
  fr: { name: "Globe polyglotte", description: "Avatar exclusif : maîtrise de 12 langues" },
  en: { name: "Polyglot Globe", description: "Exclusive avatar: master 12 languages" },
  es: { name: "Globo polígloto", description: "Avatar exclusivo: domina 12 idiomas" },
  zh: { name: "多语世界", description: "独家头像：掌握 12 种语言" },
  ar: { name: "كرة أرضية متعددة اللغات", description: "صورة رمزية حصرية: إتقان 12 لغة" },
  ru: { name: "Полиглот-глобус", description: "Эксклюзивный аватар: 12 выученных языков" },
}));

const hatSpecs = [
  ["top-hat", "Haut-de-forme", "🎩", "common", 100], ["cap", "Casquette", "🧢", "common", 100], ["graduation", "Toque de：admin", "🎓", "rare", 300], ["construction", "Casque", "⛑️", "common", 100], ["cowboy", "Cowboy", "🤠", "rare", 300], ["crown-marathon", "Couronne du Marathonien", "👑", "epic", 0], ["beret", "Béret", "🎓", "common", 100], ["helmet", "Casque d星际", "🪖", "epic", 800], ["party", "Chapeau de fête", "🥳", "rare", 300], ["fedora", "Fedora", "🎩", "rare", 300], ["headband", "Bandeau", "🎗️", "common", 100], ["sombrero", "Sombrero", "💃", "rare", 300], ["turban", "Turban", "👳", "epic", 800], ["ushanka", "Ushanka", "🧢", "epic", 800], ["laurel", "Couronne de laurier", "🏆", "rare", 300],
] as const;
const hats = hatSpecs.map(([slug, name, preview, rarity, price]) => makeItem(`hat-${slug}`, "hat", name, `Chapeau ${rarity}`, preview, rarity, price, slug === "crown-marathon" ? "marathon-365" : undefined));

const glassesSpecs = [
  ["shades", "Lunettes de soleil", "🕶️", "common", 50], ["round", "Lunettes rondes", "👓", "common", 50], ["goggles", "Lunettes de pilote", "🥽", "rare", 200], ["neon", "Lunettes néon", "😎", "rare", 200], ["pixel", "Lunettes pixel", "🕹️", "rare", 200], ["monocle", " monocle", "🧐", "epic", 500], ["star", "Lunettes étoiles", "🤩", "rare", 200], ["cyber", "Lunettes cyber", "🤖", "epic", 500], ["diamond", "Lunettes diamant", "💎", "epic", 500], ["rose", "Lunettes roses", "🌹", "common", 50],
] as const;
const glasses = glassesSpecs.map(([slug, name, preview, rarity, price]) => makeItem(`glasses-${slug}`, "glasses", name, `Lunettes ${rarity}`, preview, rarity, price));

const backgroundColors = [["#d4a574", "#090909"], ["#f6d365", "#1a0f2e"], ["#b8860b", "#020202"], ["#8b4513", "#080808"], ["#ffd700", "#24140a"], ["#c59b42", "#10151c"], ["#e6c95c", "#2a1608"], ["#a67c00", "#120f0b"], ["#ffe08a", "#17110a"], ["#4b3a16", "#000000"]] as const;
const backgrounds = backgroundColors.map(([a, b], index) => {
  const rarity: CustomizationRarity = index < 6 ? "common" : index < 9 ? "rare" : "epic";
  const price = rarity === "common" ? 150 : rarity === "rare" ? 500 : 1500;
  return makeItem(`background-noir-${index + 1}`, "background", `Ambiance ${index + 1}`, `Fond gradient ${rarity}`, svgBackground(index + 1, [a, b]), rarity, price);
});

export const CUSTOMIZATION_DEFINITIONS: CustomizationDefinition[] = [...avatars, ...hats, ...glasses, ...backgrounds];

if (avatars.length !== 50 || hats.length !== 15 || glasses.length !== 10 || backgrounds.length !== 10 || CUSTOMIZATION_DEFINITIONS.length !== 85) {
  throw new Error(`Customization catalog must contain 50/15/10/10 items, got ${avatars.length}/${hats.length}/${glasses.length}/${backgrounds.length}`);
}

/** Seed idempotent : patch par itemId, jamais de doublon. */
export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    for (const definition of CUSTOMIZATION_DEFINITIONS) {
      const existing = await ctx.db.query("customizationCatalog").withIndex("by_item", (q) => q.eq("itemId", definition.itemId)).unique();
      if (existing) {
        await ctx.db.patch(existing._id, definition);
        updated += 1;
      } else {
        await ctx.db.insert("customizationCatalog", definition);
        inserted += 1;
      }
    }
    return { inserted, updated, total: CUSTOMIZATION_DEFINITIONS.length };
  },
  returns: v.object({ inserted: v.number(), updated: v.number(), total: v.number() }),
});
