/* ═══════════════════════════════════════════════════════════════════════
   LA VOIX DE JABARI (i18n ×12)

   Toutes les bulles de la mascotte et tous les messages de guidage
   qu'elle porte passent par ici. C'est une voix unique : tutoiement
   chaleureux, langue de la rue, jamais de jargon, jamais de phrase
   corporate. Si un jour l'app montre une phrase guidance, elle doit
   sonner comme Jabari — donc elle vit dans ce fichier.

   Contrat : getMascotCopy(lang) renvoie { mascot: { … } } ou undefined,
   fusionné par-dessus les dictionnaires de base (voir i18n.tsx).
   ═════════════════════════════════════════════════════════════════════ */

export type MascotStateKey =
  | "idle"
  | "celebrate"
  | "nag"
  | "sleep"
  | "dance"
  | "wave"
  | "think";

/** [idle, celebrate, nag, sleep, dance, wave, think, greet1, greet2, greet3, tap] */
type MascotVoices = Record<
  MascotStateKey | "greet1" | "greet2" | "greet3" | "tap",
  string
>;
type MascotLang = Record<
  | MascotStateKey
  | "greet1"
  | "greet2"
  | "greet3"
  | "tap",
  string
>;

const VOICES: Record<string, MascotLang> = {
  fr: {
    idle: "Prêt à kicker aujourd'hui ?",
    celebrate: "Wesh ! Trop fort toi !",
    nag: "Tu m'abandonnes vraiment là ?",
    sleep: "Je dors un coup, mais je suis là.",
    dance: "Allez, on bouge !",
    wave: "Salut ! Je passe dans le coin.",
    think: "Laisse-moi réfléchir deux secondes…",
    greet1: "Yo, moi c'est Jabari. On apprend les mots que les gens disent pour de vrai.",
    greet2: "Choisis une langue, je te montre où commencer.",
    greet3: "Allez, on commence. Je reste dans ton coin.",
    tap: "Encore ! Je t'aime bien, moi.",
  },
  en: {
    idle: "Ready to kick off today?",
    celebrate: "Wesh! You're actually good at this!",
    nag: "You're really leaving me hanging?",
    sleep: "I'm napping, but I'm right here.",
    dance: "Let's move!",
    wave: "Hey! Just rolling through.",
    think: "Give me two seconds to think…",
    greet1: "Yo, I'm Jabari. We learn the words people actually say.",
    greet2: "Pick a language and I'll show you where to start.",
    greet3: "Let's go. I'm sticking around.",
    tap: "Again! I like you, you know.",
  },
  es: {
    idle: "¿Listo para empezar hoy?",
    celebrate: "¡Wesh! ¡Vas como un clk!",
    nag: "¿Me vas a abandonar de verdad?",
    sleep: "Estoy durmiendo, pero sigo aquí.",
    dance: "¡A mover el cuerpo!",
    wave: "¡Hola! Solo pasaba saludar.",
    think: "Dame dos segundos para pensarlo…",
    greet1: "Ey, soy Jabari. Aprendemos las palabras que la gente usa de verdad.",
    greet2: "Elige un idioma y te muestro por dónde empezar.",
    greet3: "Vamos. Me quedo contigo.",
    tap: "¡Otra vez! Me caes bien, eh.",
  },
  zh: {
    idle: "今天准备好开场了吗？",
    celebrate: "哇！这也太强了吧！",
    nag: "你真要丢下我走了？",
    sleep: "我眯一会儿，但我在。",
    dance: "走起！",
    wave: "嗨！我路过打个招呼。",
    think: "让我想两秒…",
    greet1: "嘿，我是 Jabari。我们学的是人们真正常说的话。",
    greet2: "选一门语言，我带你入门。",
    greet3: "开始吧，我一直在旁边。",
    tap: "再来一次！我挺喜欢你的。",
  },
  ar: {
    idle: "جاهز نبدا اليوم؟",
    celebrate: "واش! أنت قوي بزاف!",
    nag: "غادي تمشي وتخلّيني هنا؟",
    sleep: "نايم شوية، ولكن أنا هنا.",
    dance: "يهزّ!",
    wave: "أهلا! غير مرّيت.",
    think: "خلّيني نفكر جوج ثواني…",
    greet1: "أهلا، أنا جاباري. نتعلّم الكلمات اللي كيقولو الناس فعلا.",
    greet2: "ختار لغة، نورّيك فين تبدا.",
    greet3: "يالله، نبداو. غادي نبقا معاك.",
    tap: "مرة أخرى! عجبني بزاف.",
  },
  ru: {
    idle: "Готов начать сегодня?",
    celebrate: "Вот это да! Ты жжёшь!",
    nag: "Ты правда меня бросаешь?",
    sleep: "Дремлю, но я тут.",
    dance: "Погнали!",
    wave: "Привет! Заглянул по пути.",
    think: "Дай подумать две секунды…",
    greet1: "Йо, я Джабари. Мы учим слова, которые люди реально говорят.",
    greet2: "Выбери язык — покажу, с чего начать.",
    greet3: "Поехали. Я рядом.",
    tap: "Ещё раз! Ты мне нравишься.",
  },
  sw: {
    idle: "Uko tayari kuanza leo?",
    celebrate: "Aise! Umevika!",
    nag: "Kweli unaondoka na mimi?",
    sleep: "Namelala, lakini bado hapa.",
    dance: "Tusogeze!",
    wave: "Habari! Nimekuja kukutumbua.",
    think: "Nipe sekunde chache…",
    greet1: "Habari, mimi ni Jabari. Tunajifunza maneno watu wanayotumia kwa kweli.",
    greet2: "Chagua lugha, nitakuonyesha wapi kuanza.",
    greet3: "Twende. Nitakuwa hapa.",
    tap: "Tena! Nakupenda.",
  },
  ln: {
    idle: "Oyebi lokuta bandá leo?",
    celebrate: "Wesh! Ozali moninga!",
    nag: "Ozali kosala mokolo, tata?",
    sleep: "Nazalí nsépí, kasi nazali ndá?",
    dance: "Bokokolé!",
    wave: "Mbote! Nazali wá ntóke.",
    think: "Bóyísá mabúku ma ntái…",
    greet1: "Mbóte, míyé Jabari. Tékéyamboyá mayéma oyo bato betóyáló naoko.",
    greet2: "Pická lingi, loloko likéyebisa wá kofanda.",
    greet3: "Tókoma. Nasálaka na yo.",
    tap: "Gbalké! Kalamu.",
  },
  ha: {
    idle: "An ka shigar da sabo a yau?",
    celebrate: "Wesh! Ka fi karfi!",
    nag: "Ka son ka raina?",
    sleep: "Ina barci, amma ina nan.",
    dance: "Yi rawa!",
    wave: "Sannu! Na zo don ganawa.",
    think: "Bari na mintuna…",
    greet1: "Sannu, na Jabari. Muna koyi kalmomin da mutane suna fa'atar da gaske.",
    greet2: "Zaɓi harshin, zan nuna mukuwa inda za ka fara.",
    greet3: "Mu fara. Zan kasance tare da kai.",
    tap: "Sake! Na son kai.",
  },
  yo: {
    idle: "Ṣé o ṣe tayọ̀ tẹ́lẹ̀?",
    celebrate: "Wesh! Ó dara púpọ̀!",
    nag: "Ṣé o fẹ́ sọ ọ́ di ọjú rẹ̀ nítorí?",
    sleep: "Mo sùgbọ́n, ṣùgbọ́n mo wà níbí.",
    dance: "Jẹ́ kú àyé!",
    wave: "Báwo! Mo wá láti wò ọ́ ọ̀kan náà.",
    think: "Jẹ́ kí o máa rò ní ọ̀kọ̀jọ́…",
    greet1: "Báwo, mo ní Jabari. A ń kọ́ ọ̀rọ̀ tí àwọn ènìyàn ń tẹ̀lé gbogbo.",
    greet2: "Yàn àmì, èmi yóo fi ibi tí o bẹ̀rẹ̀ sí i hàn ọ.",
    greet3: "Jẹ́ kó à bẹ̀rẹ̀. Emi yóí wà níbí.",
    tap: "Tún kan! Mo fẹ́ ọ.",
  },
  zu: {
    idle: "Ulungiselekile namuhla?",
    celebrate: "Wesh! Uphambene kakhulu!",
    nag: "Uzokweyeka yini kumuntu ongami?",
    sleep: "Ngilele, kodwa ngiyaphila.",
    dance: "Hamba!",
    wave: "Sawubona! Ngize kakhulu.",
    think: "Ngitshele imizuzu emibili…",
    greet1: "Sawubona, ngingu Jabari. Sifunda amagama abantu basebenzisa ngempela.",
    greet2: "Khetha ulimi, ngizokutshela ukuthi uqale kuphi.",
    greet3: "Masiqele. Ngiyakuthola lapho.",
    tap: "Kuphinde! Ngiyakuthanda.",
  },
  wo: {
    idle: "Denm benn yóbbu leh?",
    celebrate: "Wesh! Yaa lay yóbbu!",
    nag: "Ndow dëgg àddina?",
    sleep: "Mayam, walona am naka.",
    dance: "Dund!",
    wave: "Salaam! Toon dugg bi.",
    think: "Deye cis second…",
    greet1: "Salaam, mooy Jabari. Mi leer ay words bi lay ñépp bu bees yeccëg.",
    greet2: "Pick bu language, nagal def lay tekk.",
    greet3: "Dèm-dèm. Rax lekk ci bi.",
    tap: "Kadi! Mo gal bu bëgg.",
  },
};

export function getMascotCopy(lang: string): unknown | undefined {
  const voice = VOICES[lang];
  if (!voice) return undefined;
  return {
    mascot: {
      name: "Jabari",
      ...voice,
    },
  };
}
