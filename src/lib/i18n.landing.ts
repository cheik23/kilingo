/* ═══════════════════════════════════════════════════════════════════════
   LA LANDING PUBLIQUE — COPY DES 12 LANGUES (overlay)

   La landing était intégralement en français codé en dur dans le JSX :
   un visiteur anglophone, swahili ou wolof lisait une page qu'il ne pouvait
   pas comprendre — sur la page qui doit convertir. Cet overlay la couvre
   dans les 12 langues.

   Contrat : `getLandingCopy(lang)` renvoie `{ landing: {…} }` ou
   `undefined`, fusionné par-dessus les dictionnaires de base (voir
   i18n.tsx → applyDictionaryOverlays).

   Les nombres (11 langues, 2363 expressions, 85 avatars) ne sont PAS des
   chaînes : ils viennent de `landingStats` côté Convex. Seuls le libellé et
   les pluriels sont traduits, via `{n}`.
   ═══════════════════════════════════════════════════════════════════════ */

type LandingCopy = {
  badge: string;
  /** Titre du hero. `{days}` permit de Tester une variante. */
  title: string;
  subtitle: string;
  cta: string;
  ctaSecondary: string;
  reassurance: string;
  /** Bandeau social proof : `{n}` apprenants. */
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
  };
  globeCaption: string;
};

const LANDING: Record<string, LandingCopy> = {
  fr: {
    badge: "Immersion · argot africain · contenu réel",
    title: "Maîtrise l'argot africain en 7 jours",
    subtitle:
      "Personne ne parle comme un manuel. Apprends l'argot, les expressions et la culture africains par l'immersion : films, musique, séries et podcasts qui t'aiment déjà — puis révise ce que tu as entendu.",
    cta: "Commencer gratuitement",
    ctaSecondary: "Voir comment ça marche",
    reassurance: "Gratuit · aucune carte bancaire",
    learners: "{n} apprenants déjà inscrits",
    features: {
      title: "Tout ce qu'il faut, en un seul endroit",
      lead: "Un catalogue large, un avatar qui te ressemble, et une méthode qui tient dans la vraie vie.",
      languagesValue: "11",
      languagesLabel: "langues africaines etaslées",
      expressionsValue: "2 363",
      expressionsLabel: "expressions et argots documentés",
      avatarValue: "3D",
      avatarLabel: "avatar prêt à porter",
    },
    globeCaption: "Chaque expression vient d'un endroit réel.",
  },
  en: {
    badge: "Immersion · African slang · real content",
    title: "Master African slang in 7 days",
    subtitle:
      "Nobody actually speaks like a textbook. Learn the slang, the expressions and the culture through immersion — films, music, series and podcasts you already love — then revise what you actually heard.",
    cta: "Start for free",
    ctaSecondary: "See how it works",
    reassurance: "Free · no credit card",
    learners: "{n} learners already signed up",
    features: {
      title: "Everything you need, in one place",
      lead: "A wide catalogue, an avatar that looks like you, and a method that survives real life.",
      languagesValue: "11",
      languagesLabel: "African and global languages",
      expressionsValue: "2,363",
      expressionsLabel: "documented expressions and slang terms",
      avatarValue: "3D",
      avatarLabel: "avatar ready to wear",
    },
    globeCaption: "Every expression comes from a real place.",
  },
  es: {
    badge: "Inmersión · argot africano · contenido real",
    title: "Domina el argot africano en 7 días",
    subtitle:
      "Nadie habla como un manual. Aprende el argot, las expresiones y la cultura por inmersión — películas, música, series y podcasts que ya te gustan — y repasa lo que realmente oíste.",
    cta: "Empieza gratis",
    ctaSecondary: "Ver cómo funciona",
    reassurance: "Gratis · sin tarjeta bancaria",
    learners: "{n} aprendices ya inscritos",
    features: {
      title: "Todo lo que necesitas, en un solo sitio",
      lead: "Un catálogo amplio, un avatar que se parece a ti y un método que aguanta la vida real.",
      languagesValue: "11",
      languagesLabel: "lenguas africanas y globales",
      expressionsValue: "2.363",
      expressionsLabel: "expresiones y argots documentados",
      avatarValue: "3D",
      avatarLabel: "avatar listo para llevar",
    },
    globeCaption: "Cada expresión viene de un lugar real.",
  },
  zh: {
    badge: "沉浸式 · 非洲俚语 · 真实内容",
    title: "7天掌握非洲俚语",
    subtitle:
      "没人会像教科书那样说话。通过影视、音乐、剧集和你本就喜欢的播客，沉浸式学习俚语、表达与文化——然后复习你真正听到的内容。",
    cta: "免费开始",
    ctaSecondary: "了解运作方式",
    reassurance: "免费 · 无需银行卡",
    learners: "已有 {n} 位学习者注册",
    features: {
      title: "你所需的一切，尽在一处",
      lead: "庞大的词库、像你的头像，以及真正用得上的方法。",
      languagesValue: "11",
      languagesLabel: "非洲及全球语言",
      expressionsValue: "2,363",
      expressionsLabel: "条有据可查的表达与俚语",
      avatarValue: "3D",
      avatarLabel: "可佩戴的头像",
    },
    globeCaption: "每个表达都来自真实的地方。",
  },
  ar: {
    badge: "انغماس · مصطلح أفريقي · محتوى حقيقي",
    title: "أتقِن المصطلح الأفريقي في 7 أيام",
    subtitle:
      "لا أحد يتحدث كما في كتاب. تعلّم المصطلح والتعابير والثقافة عبر الانغماس — أفلام وموسيقى ومسلسلات وبودكاست تحبها — ثم راجع ما سمعته فعلاً.",
    cta: "ابدأ مجاناً",
    ctaSecondary: "اكتشف كيف يعمل",
    reassurance: "مجاني · بدون بطاقة بنكية",
    learners: "{n} متعلماً سجّلوا بالفعل",
    features: {
      title: "كل ما تحتاجه في مكان واحد",
      lead: "كتالوج واسع، وصورة رمزية تشبهك، وطريقة تصمد في الحياة الحقيقية.",
      languagesValue: "11",
      languagesLabel: "لغات أفريقية وعالمية",
      expressionsValue: "2,363",
      expressionsLabel: "تعبير ومصطلح موثّق",
      avatarValue: "3D",
      avatarLabel: "صورة رمزية جاهزة",
    },
    globeCaption: "كل تعبير يأتي من مكان حقيقي.",
  },
  ru: {
    badge: "Погружение · африканский сленг · реальный контент",
    title: "Овладей африканским сленгом за 7 дней",
    subtitle:
      "Никто не говорит как учебник. Учи сленг, выражения и культуру через погружение — фильмы, музыку, сериалы и подкасты, которые ты уже любишь — и повторяй то, что действительно услышал.",
    cta: "Начать бесплатно",
    ctaSecondary: "Как это работает",
    reassurance: "Бесплатно · без карты",
    learners: "Уже зарегистрировано {n} учеников",
    features: {
      title: "Всё нужное — в одном месте",
      lead: "Большой каталог, аватар похожий на тебя и метод, который работает в жизни.",
      languagesValue: "11",
      languagesLabel: "африканских и мировых языков",
      expressionsValue: "2 363",
      expressionsLabel: "документированных выражения и сленга",
      avatarValue: "3D",
      avatarLabel: "готовый аватар",
    },
    globeCaption: "Каждое выражение — из реального места.",
  },
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
      languagesValue: "11",
      languagesLabel: "lugha za Afrika na dunia",
      expressionsValue: "2,363",
      expressionsLabel: "misemo na msamiati iliyoandikwa",
      avatarValue: "3D",
      avatarLabel: "avatar tayari kuvaa",
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
      languagesValue: "11",
      languagesLabel: "mikótá ya Afrika na ya moninga",
      expressionsValue: "2.363",
      expressionsLabel: "maloko oyo ekotámbola",
      avatarValue: "3D",
      avatarLabel: "avatar ekotambolá",
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
      languagesValue: "11",
      languagesLabel: "harshen Afirka da duniya",
      expressionsValue: "2,363",
      expressionsLabel: "siffa da wannan da aka rubuce",
      avatarValue: "3D",
      avatarLabel: "siffar da za ka iya sanya",
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
      languagesValue: "11",
      languagesLabel: "Èdè Afrika àti ayé",
      expressionsValue: "2,363",
      expressionsLabel: "ìlù àti slang tí a kọ sílẹ̀",
      avatarValue: "3D",
      avatarLabel: "àwòrán tí a ṣe gbé",
    },
    globeCaption: "Àwọn ìlù kọ̀ọ̀kan wá láti ibí òun.",
  },
  zu: {
    badge: "Ukuhlanganisa · isigaba sase-Afrika · umlayezo wangempela",
    title: "Funda isigaba sase-Afrika ngeminyaka engu-7",
    subtitle:
      "Akekho olukhuluma njengebhuku. Funda ulimi, izisho namasomi ngokuhlanganisa — amafilimu, umculo, izinhundlo kanye nezincwadi ozithandayo — bese uphinda lokho owake wabona.",
    cta: "Qala mahhala",
    ctaSecondary: "Bona ukuthi kusebenza kanjani",
    reassurance: "Mahhala · akukho ikhadi leyasekhenti",
    learners: "Abafundi {n} babesekele khona",
    features: {
      title: "Konke okudingayo, endaweni eyodwa",
      lead: "Ikhatala elikhulu, isithombe esifana nawe, kanye nendlela esebenza empilweni.",
      languagesValue: "11",
      languagesLabel: "izilimi zase-Afrika nezomhlaba",
      expressionsValue: "2,363",
      expressionsLabel: "izisho nezigaba ezichazulwe",
      avatarValue: "3D",
      avatarLabel: "isithombe esilungiselelwe",
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
      languagesValue: "11",
      languagesLabel: "Làkk yu Afrika ak yu mond",
      expressionsValue: "2.363",
      expressionsLabel: "mbaat ak wannan dokku",
      avatarValue: "3D",
      avatarLabel: "avatar bu lay tëm",
    },
    globeCaption: "Koy mbaat nu fi ci àdd baak bu wërëy.",
  },
};

export function getLandingCopy(lang: string): unknown | undefined {
  const landing = LANDING[lang];
  if (!landing) return undefined;
  return { landing };
}
