/* ═══════════════════════════════════════════════════════════════════════
   VERROUS PREMIUM — COPY DES 12 LANGUES (overlay)

   Trois verrous, donc trois messages de blocage. Ils obéissent à la même
   règle, vérifiée par `scripts/verify-upgrade.mjs` et
   `scripts/verify-premium-locks.mjs` :

     · un blocage annonce un GAIN (« passe à une langue sans perdre
       celle-ci »), jamais une perte (« tu ne peux plus »). Le premier
       se comprend et se respecte ; le second est un rapport de force, et
       une pratique commerciale agressive.

     · aucune URGENCE. Aucune date limite inventée, aucun compte à
       rebours, aucune rareté fabriquée. Le quota Shadow se réinitialise
       vraiment à minuit, et l'heure affichée est l'heure réelle de
       l'utilisateur — pas une menace (« expires in 4h » sur un compteur
       qu'on contrôle soi-même).

     · rien n'est caché. Le plafond s'affiche AVANT d'être rencontré, le
       compteur de quota est visible toute la journée, et les six
       personnages verrouillés sont listés avec leur description : la
       visibilité crée le désir, une liste tronquée crée la déception.

   Contrat : `getPremiumCopy(lang)` renvoie `{ premium: {…} }` ou
   `undefined`, fusionné par-dessus les dictionnaires de base (voir
   i18n.tsx → applyDictionaryOverlays).
   ═══════════════════════════════════════════════════════════════════════ */

type PremiumCopy = {
  lock: {
    languages: { title: string; body: string; cta: string };
    shadow: { title: string; body: string; cta: string };
    characters: { title: string; body: string; cta: string };
  };
  /** `{n}` analyses restantes aujourd'hui. */
  quota: { remaining: string; lastOne: string; unlimited: string; resets: string };
  /** Pastille d'un personnage verrouillé, et l'infobulle qui l'explique. */
  characters: { locked: string; preview: string; tooltip: string };
  /** `{cap}` = plafond du compte. */
  languages: { capHint: string };
  /** Titre de l'invite, commun aux trois blocages. */
  upsell: { title: string; cta: string; finePrint: string };
};

const PREMIUM: Record<string, PremiumCopy> = {
  fr: {
    lock: {
      languages: {
        title: "Une langue à la fois en formule gratuite",
        body: "Tu peux suivre une langue active à la fois, et elle ne disparaît jamais : Premium ouvre deux langues en parallèle, sans compteur, ou bien tu passes l'autre en mode révision. Rien n'est effacé — l'ancienne langue et son XP restent là, en attente.",
        cta: "Suivre deux langues à la fois",
      },
      shadow: {
        title: "Cinq analyses par jour, puis le compteur repart demain",
        body: "Tu as utilisé tes 5 analyses Shadow du jour. Le compteur repart à minuit chez toi. Premium, c'est un nombre illimité de shadowings, sans compteur et sans plafond.",
        cta: "Shadowing illimité",
      },
      characters: {
        title: "Deux personnages sont ouverts, les six autres t'attendent",
        body: "Baba Street et Mama Wisdom sont déjà à toi, avec tous leurs scénarios. Premium ouvre les six autres — chacun avec sa voix, son registre et son argot. Tu gardes les conversations que tu as déjà eues.",
        cta: "Ouvrir les 8 personnages",
      },
    },
    quota: {
      remaining: "{n} analyses Shadow restantes aujourd'hui",
      lastOne: "Dernière analyse Shadow aujourd'hui",
      unlimited: "Shadowing illimité",
      resets: "Compteur remis à zéro à {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Aperçu",
      tooltip: "Débloquez ce personnage avec Kilingo Premium",
    },
    languages: { capHint: "{cap} langue active en formule gratuite" },
    upsell: {
      title: "Premium",
      cta: "Voir Premium",
      finePrint: "7 jours d'essai ·Sans prélèvement avant la fin · annulation en un clic",
    },
  },
  en: {
    lock: {
      languages: {
        title: "One active language on the free plan",
        body: "You can keep one active language at a time, and it never disappears: Premium opens two languages in parallel, with no counter — or you switch the other one to review mode. Nothing is erased: the previous language and its XP stay put.",
        cta: "Keep two languages going",
      },
      shadow: {
        title: "Five analyses a day, then the counter starts over tomorrow",
        body: "You've used today's 5 Shadow analyses. The counter resets at midnight where you are. Premium means an unlimited number of shadowings — no counter, no ceiling.",
        cta: "Unlimited shadowing",
      },
      characters: {
        title: "Two characters are open, the other six are waiting",
        body: "Baba Street and Mama Wisdom are already yours, with all their scenarios. Premium opens the other six — each with its own voice, register and slang. Conversations you've already had stay open.",
        cta: "Unlock all 8 characters",
      },
    },
    quota: {
      remaining: "{n} Shadow analyses left today",
      lastOne: "Last Shadow analysis for today",
      unlimited: "Unlimited shadowing",
      resets: "Counter resets at {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Preview",
      tooltip: "Unlock this character with Kilingo Premium",
    },
    languages: { capHint: "{cap} active language on the free plan" },
    upsell: {
      title: "Premium",
      cta: "See Premium",
      finePrint: "7-day trial · nothing charged before it ends · cancel in one click",
    },
  },
  es: {
    lock: {
      languages: {
        title: "Un idioma activo a la vez en el plan gratuito",
        body: "Puedes tener un idioma activo a la vez, y no desaparece nunca: Premium abre dos idiomas en paralelo, sin contador, o pasas el otro a modo revisión. No se borra nada: el idioma anterior y su XP siguen ahí.",
        cta: "Seguir dos idiomas a la vez",
      },
      shadow: {
        title: "Cinco análisis al día, y el contador vuelve a empezar mañana",
        body: "Has usado tus 5 análisis Shadow de hoy. El contador se reinicia a medianoche en tu zona horaria. Premium es un número ilimitado de shadowings, sin contador ni techo.",
        cta: "Shadowing ilimitado",
      },
      characters: {
        title: "Dos personajes están abiertos, los otros seis te esperan",
        body: "Baba Street y Mama Wisdom ya son tuyos, con todos sus escenarios. Premium abre los otros seis, cada uno con su voz, su registro y su argot. Las conversaciones que ya tienes siguen abiertas.",
        cta: "Abrir los 8 personajes",
      },
    },
    quota: {
      remaining: "Quedan {n} análisis Shadow hoy",
      lastOne: "Último análisis Shadow de hoy",
      unlimited: "Shadowing ilimitado",
      resets: "El contador se reinicia a las {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Vista previa",
      tooltip: "Desbloquea este personaje con Kilingo Premium",
    },
    languages: { capHint: "{cap} idioma activo en el plan gratuito" },
    upsell: {
      title: "Premium",
      cta: "Ver Premium",
      finePrint: "7 días de prueba · sin cobro antes de que acabe · cancela en un clic",
    },
  },
  zh: {
    lock: {
      languages: {
        title: "免费版同时只能进行一门语言",
        body: "你可以同时保持一门活跃语言，而且它永远不会消失：想换到新的语言，可以升级 Premium，或把原来那门转为复习模式。没有任何内容被删除——原来的语言和它的经验值都还在。",
        cta: "同时进行两门语言",
      },
      shadow: {
        title: "每天 5 次分析，之后明天重新开始",
        body: "你今天已经用完 5 次 Shadow 分析。计数会在你所在时区的午夜重置。Premium 是无限次跟读，没有计数，也没有上限。",
        cta: "无限跟读",
      },
      characters: {
        title: "两个角色已开放，另外六个在等你",
        body: "Baba Street 和 Mama Wisdom 已经属于你，全部场景都能用。Premium 开放其余六个——每个都有自己的口音、语域和俚语。你已经进行过的对话仍然保留。",
        cta: "解锁全部 8 个角色",
      },
    },
    quota: {
      remaining: "今天还剩 {n} 次 Shadow 分析",
      lastOne: "今天最后一次 Shadow 分析",
      unlimited: "无限跟读",
      resets: "计数将于 {time} 重置",
    },
    characters: {
      locked: "Premium",
      preview: "预览",
      tooltip: "使用 Kilingo Premium 解锁此角色",
    },
    languages: { capHint: "免费版可保持 {cap} 门活跃语言" },
    upsell: { title: "Premium", cta: "查看 Premium", finePrint: "7 天试用 · 到期前不扣款 · 一键取消" },
  },
  ar: {
    lock: {
      languages: {
        title: "لغة واحدة نشطة في الخطة المجانية",
        body: "يمكنك إبقاء لغة واحدة نشطة في وقت واحد، وهي لا تختفي أبدًا: للانتقال إلى لغة جديدة، إمّا إلى Premium أو اجعل الأخرى في وضع المراجعة. لا يُحذف شيء: اللغة السابقة ونقاط خبرةتها تبقى كما هي.",
        cta: "اتّبع لغتين في وقت واحد",
      },
      shadow: {
        title: "خمس تحليلات في اليوم، ثم يعود العدّ غدًا",
        body: "استهلكت تحليلات Shadow الخمسة اليوم. يعود العدّ إلى منتصف الليل عندك. Premium يعني عددًا غير محدود من التكرارات، بلا عدّاد وبلا سقف.",
        cta: "تكرار غير محدود",
      },
      characters: {
        title: "شخصيتان مفتوحتان، وستّ في انتظارك",
        body: "Baba Street و Mama Wisdom لكما أصلًا بكل مشاهدهما. Premium يفتح الستّ الباقيات، لكل منها صوته وسجله ولهجه. المحادثات التي أجريتها تبقى مفتوحة.",
        cta: "افتح الشخصيات الثماني",
      },
    },
    quota: {
      remaining: "بقيت {n} تحليلات Shadow اليوم",
      lastOne: "آخر تحليل Shadow اليوم",
      unlimited: "تكرار غير محدود",
      resets: "يُعاد العدّ عند {time}",
    },
    characters: {
      locked: "Premium",
      preview: "معاينة",
      tooltip: "افتح هذه الشخصية مع Kilingo Premium",
    },
    languages: { capHint: "{cap} لغة نشطة في الخطة المجانية" },
    upsell: { title: "Premium", cta: "اطّلع على Premium", finePrint: "7 أيام تجريبية · لا خصم قبل انتهائها · إلغاء بنقرة واحدة" },
  },
  ru: {
    lock: {
      languages: {
        title: "Один активный язык в бесплатном плане",
        body: "Одновременно активным может быть один язык, и он никуда не исчезает: Premium открывает два языка параллельно, без счётчика, либо ты переводишь прежний в режим повторения. Ничего не удаляется — прежний язык и его опыт остаются на месте.",
        cta: "Два языка одновременно",
      },
      shadow: {
        title: "Пять анализов в день, дальше счётчик сбрасывается завтра",
        body: "Ты исчерпал 5 анализов Shadow на сегодня. Счётчик сбрасывается в полночь по твоему времени. Premium — это безлимит повторений: без счётчика и без потолка.",
        cta: "Безлимитное повторение",
      },
      characters: {
        title: "Два персонажа открыты, остальные шесть ждут",
        body: "Baba Street и Mama Wisdom уже твои, со всеми сценариями. Premium открывает остальных шесть — у каждого свой голос, регистр и сленг. Диалоги, которые уже есть, остаются доступными.",
        cta: "Открыть все 8 персонажей",
      },
    },
    quota: {
      remaining: "Осталось {n} анализов Shadow сегодня",
      lastOne: "Последний анализ Shadow сегодня",
      unlimited: "Безлимитное повторение",
      resets: "Счётчик сбросится в {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Предпросмотр",
      tooltip: "Откройте этого персонажа с Kilingo Premium",
    },
    languages: { capHint: "{cap} активный язык в бесплатном плане" },
    upsell: { title: "Premium", cta: "Посмотреть Premium", finePrint: "7 дней пробно · без списаний до конца · отмена в один клик" },
  },
  sw: {
    lock: {
      languages: {
        title: "Lugha moja inayotumika kwenye mpango wa bure",
        body: "Unaweza kuwa na lugha moja inayotumika kwa wakati mmoja, na haionishi kamwe: kuingia kwenye lugha nyingine, yako Premium au weka ile nyingine katika hali ya mapitio. Hakuna kinachofutwa — lugha na uzoefu wake hubaki pale walipokuwa.",
        cta: "Fuatilia lugha mbili kwa wakati mmoja",
      },
      shadow: {
        title: "Uchambuzi tano kwa siku, kisha kihisi huanza upya kesho",
        body: "Umetumia uchambuzi wako 5 wa Shadow leo. Kihisi huanza upya usiku wa saa 12 kwenye eneo lako. Premium ni idadi isiyo ya kikomo ya marudio, bila kihisi wala kikomo.",
        cta: "Marudio bila kikomo",
      },
      characters: {
        title: "Wahusika wawili wamefunguliwa, wengine watu wanakusubiri",
        body: "Baba Street na Mama Wisdom tayari ni wako, pamoja na nafuasi zao zote. Premium hufungua wengine wote sita — kila mmoja kwa sauti, kirejelea na sarufi yake. Mazungumzo uliyoyatoka tayali yatabaki wazi.",
        cta: "Fungua wahusika wote 8",
      },
    },
    quota: {
      remaining: "Umebakiwa na uchambuzi {n} wa Shadow leo",
      lastOne: "Uchambuzi wa mwisho wa Shadow leo",
      unlimited: "Marudio bila kikomo",
      resets: "Kihisi hitaanza upya saa {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Onyesho",
      tooltip: "Fungua mhusika huyu na Kilingo Premium",
    },
    languages: { capHint: "Lugha {cap} inayotumika kwenye mpango wa bure" },
    upsell: { title: "Premium", cta: "Angalia Premium", finePrint: "Siku 7 za jaribio · hakuna kukatwa kabla ya kumaliza · ghairi kwa kubofya moja" },
  },
  ln: {
    lock: {
      languages: {
        title: "Mokoko moko na mosala na formule ya mbote",
        body: "Okoki koka mokoko moko moninga oyo eketi moloko, kati ekotamboma te: soke eka mosala moko oyo elandani, to premier Premium, to bondisa ekoko oyo ekotani na mode de révision. Elefeko tini ekotamboma: eloko oyo oyo déjà ekobana na XP ye.",
        cta: "Suivi eloko mokoko na mongo",
      },
      shadow: {
        title: "Analyse yangu moko na moloko, depois compteur ebandaka lisusu",
        body: "Oyo usangi analyse 5 za Shadow na moloko oyo. Compteur ebandaka lisusu na mbanga ya t-shambei na yo. Premium = nombre sans limite ya shadowing, sans compteur.",
        cta: "Shadowing sans limite",
      },
      characters: {
        title: "Bavuki mokoko bayengololi, baye motoba bayekotoba",
        body: "Baba Street na Mama Wisdom ekosalaka na yo, poko na masitu yabo. Premium ekopaya motoba oyo el Remaining — mokoko moko na voix, registre na argot yanga. Malakisi oyo osalaka déjà ekotumba.",
        cta: "Paya bavuki ba 8",
      },
    },
    quota: {
      remaining: "Analyse {n} za Shadow zasala na moloko oyo",
      lastOne: "Analyse ya mwisho ya Shadow na moloko oyo",
      unlimited: "Shadowing sans limite",
      resets: "Compteur ebanda lisusu na {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Mwons",
      tooltip: "Fungola mosani oyo na Kilingo Premium",
    },
    languages: { capHint: "Lokoko {cap} oyo eketi moloko na formule ya mbote" },
    upsell: { title: "Premium", cta: "Tala Premium", finePrint: "Mikolo 7 ya trial · ekotanga te ntete ya prepayment · boboli na klik moko" },
  },
  ha: {
    lock: {
      languages: {
        title: "Harshe yi guda a cikin kyauta na shirin kyauta",
        body: "Za ka iya riyan harshen da guda daya a lokacin daya, kuma ba ta tafi ba da cewa: don ka maye wata harshen, ko ka biyo Premium, ko ka mayan taccan daga ƙa zuwa babban kwanaki. Babba wani ba a share ba — harshen da kalmominsa sun tsaya ko dai.",
        cta: "Biyo harshen guda biyu tare",
      },
      shadow: {
        title: "Bincike guda a rana, sai akaifira da yawa",
        body: "An yi amfani da binciken Shadow 5 na yau. Kaitawa yana sake farawa da dare a cikin yankinka. Premium yana nufin adadi marar iyaka na shadowing, babu kaitawa, babu iyaka.",
        cta: "Shadowing marar iyaka",
      },
      characters: {
        title: "Yanayi biyu an buɗe, wasu da suka yi buɗe na saita ka",
        body: "Baba Street da Mama Wisdom an riga suna, tare da duk wasu dama. Premium yana buɗe sauran da suka yi buɗe—kowa yana da shi, harkinsa da harshensa. Tattaunawa da ka riga yi za a ci gaba.",
        cta: "Buɗe duk yanayi 8",
      },
    },
    quota: {
      remaining: "An bincike {n} na Shadow a yau",
      lastOne: "Bincike na ƙarshe na Shadow a yau",
      unlimited: "Shadowing marar iyaka",
      resets: "Kaitawa zai sake farawa da {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Hotuna",
      tooltip: "Buɗe wannan hali da Kilingo Premium",
    },
    languages: { capHint: "Harshe guda {cap} a cikin shirin kyauta" },
    upsell: { title: "Premium", cta: "Duba Premium", finePrint: "Kwanaki 7 na gwaji · babu karɓi kafin ya ƙare · soke da click" },
  },
  yo: {
    lock: {
      languages: {
        title: "Èdè kan nìkan ní ọ̀nà ọfẹ́",
        body: "O lè ní èdè kan nìkan tí ń ṣiṣẹ́ lọ́wọ́lọ́wọ́, ó kò máa parí láìkan: láti bẹ̀rẹ̀ sì èdè tuntun, o tẹ́lẹ̀ Premium tàbí o dá èdé tẹ́lẹ̀ sí ìtọ́sọ́nà. A kò fagilé ohunkóhun: èdé tẹ́lẹ̀ àti ẹ̀yà-ìwé rẹ̀ wà níbí.",
        cta: "Tẹ́lé èdè méjì lọ́wọ́lọ́wọ́",
      },
      shadow: {
        title: "Ìtúpalẹ̀ márùn-ún ní ọjọ́, kí ó sì bẹ̀rẹ̀ lọ́wọ́ ní ọjọ́ tókàn",
        body: "O ti lo gbogbo ìtúpalẹ̀ Shadow 5 rẹ̀ ní ọjọ́. Ka náà máa tún bẹ̀rẹ̀ ní ìrọ̀lẹ́ ní ọ̀nà àdùkọ́ rẹ. Premium jẹ́ nǹgba Shadow alágbára, kò ní ka náà, kò ní ọ̀pọ̀.",
        cta: "Shadow alágbára",
      },
      characters: {
        title: "Àwọn ènìyàn méjèèjì ti wà, àwọn mìíràn ní mẹ́fa tì wà",
        body: "Baba Street àti Mama Wisdom ti jẹ́ ọwọ́ tẹ́lẹ̀, pẹ̀lú gbogbo ìṣèwájú wọn. Premium ṣí àwọn mìíràn mẹ́fa — kọ̀ọ̀kan ní ọ̀kan ohùn, ní àtún-ìmọ̀ àti argót rẹ̀. Ìjíròrò tí o ti ní kò ní sọ́.",
        cta: "Ṣí àwọn ènìyàn 8",
      },
    },
    quota: {
      remaining: "Ìtúpalẹ̀ Shadow {n} kún ní ọjọ́",
      lastOne: "Ìtúpalẹ̀ Shadow tí ó kùní ní ọjọ́",
      unlimited: "Shadow alágbára",
      resets: "Ka náà máa tún bẹ̀rẹ̀ ní {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Ìwò",
      tooltip: "Ṣí ẹni yìí pẹ̀lú Kilingo Premium",
    },
    languages: { capHint: "Èdè gusa {cap} tí ń ṣiṣẹ́ lọ́wọ́lọ́wọ́ ní ọ̀nà ọfẹ́" },
    upsell: { title: "Premium", cta: "Wo Premium", finePrint: "Ọjọ́ 7 ìdánwò · kò sí owó tí ó bá gba tẹ́lẹ́ · fagilé pẹ̀lú ìtẹ́ kan" },
  },
  zu: {
    lock: {
      languages: {
        title: "Ulimi olunye olufakile nendlela ymahhala",
        body: "Unga ne- ulimi olunye olufakile ngesikhathi esisodwa, futhi awuyomi nanini: ukuze uqale ulimi olusha, noma uthole i-Premium, noma wehlisise olunye ube sesimelweni sokubuyekeza. Akukho okulahlekelwa — ulimi oludala neminyakathelo yakalo kuhlala kanjalo.",
        cta: "Landela izilimi ezimbili ngesikhathi esisodwa",
      },
      shadow: {
        title: "Izidlizi zintathu ngosuku, bese ibalwa iphinde nkusasa",
        body: "Uselise yonke izidlizi zakho ezingaba-5 ze-Shadow namuhla. Ibalwa liqala phakathi midnight endaweni yakho. I-Premium isho inombolo engaleli ye-shadowing, ngaphandle kwe-ibalwa nokwesitha.",
        cta: "I-shadowing engaleli",
      },
      characters: {
        title: "Abalingani ababili bavulekile, abanye abangu-6 bakulindele",
        body: "Baba Street noMama Wisdom sewongakho, kanye nemizame yabo yonke. I-Premium ivula abanye abangu-6 — ngamunye enezwi lakhe, ukubhala kwakhe ne-argot yakhe. Izinkulumo ozisithandileyo zihlale zivulekile.",
        cta: "Vula abalingani be-8",
      },
    },
    quota: {
      remaining: "Kusele izidlizi ezingu-{n} ze-Shadow namuhla",
      lastOne: "Isidlizi sokusaba ze-Shadow namuhla",
      unlimited: "I-shadowing engaleli",
      resets: "Ibalwa liqala phakathi {time}",
    },
    characters: {
      locked: "Premium",
      preview: "Ukubuka",
      tooltip: "Vula lo mlingisi nge-Kilingo Premium",
    },
    languages: { capHint: "Ulimi olulodwa olufakile nendlela ymahhala" },
    upsell: { title: "Premium", cta: "Bona i-Premium", finePrint: "Izinsuku ezingaba-7 zokuhlola · akukho okutholakalwa ngaphambi kokuphela · khansela ngokuchofuka okukodwa" },
  },
  wo: {
    lock: {
      languages: {
        title: "Làkk bu benn yen ne formulation gratis",
        body: "Mbaa nga fann een làkk bi dikk, kì mo dugg dara: booba bëgg benn làkk bu bees, wala nga Premium, wala boola benn bi topp na mode dégg bu bees. Nu dëgg mbir, mo watta: làkk bees àdow bi XP ye cocagna wér.",
        cta: "Topp làkk yi benn, yi benn",
      },
      shadow: {
        title: "Analyse yam yi tekk, ki noon bi dibann kuruk yi nun",
        body: "Yëggaa analyze Shadow 5 yi bës yi tekk. Kountar bi dikaan an Loop bi nu ci waxtu wópp. Premium mo unlimited shadowing, kì kenn kountar, kì kenn ba bëgg tekk bi mbëg te.",
        cta: "Shadowing unlimited",
      },
      characters: {
        title: "Sama yi dée èpp bu bees, yi gg yi mbu woy sant bëcc àdd",
        body: "Baba Street mi Mama Africa lan joox bu bees, ci seen yi gg. Premium daal yi gg yi säkk, kulleen benn nit nekk, nekk ak woy sug vu. Kuy fecc bu bees kenn dugg a nga dugg te.",
        cta: "Tekki sama yi 8",
      },
    },
    quota: {
      remaining: "Analyze Shadow {n} di tigë yi tekk",
      lastOne: "Analyze Shadow bi léem yi tekk",
      unlimited: "Shadowing unlimited",
      resets: "Kountar bi dibaan an Loop ci {time}",
    },
    characters: {
      locked: "Premium",
      preview: "N glimps",
      tooltip: "Ubbi mbindaan bi ak Kilingo Premium",
    },
    languages: { capHint: "Làkk bu benn ne formulation gratis" },
    upsell: { title: "Premium", cta: "Gis Premium", finePrint: "Biss 7 bu sant · kenn nu bëgg léeb bu dugg · kansile na clic moko" },
  },
};

export const PREMIUM_COPY_LANGS = Object.keys(PREMIUM);

export function getPremiumCopy(lang: string): unknown | undefined {
  const copy = PREMIUM[lang];
  if (!copy) return undefined;
  return { premium: copy };
}
