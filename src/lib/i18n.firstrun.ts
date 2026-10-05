/* ═══════════════════════════════════════════════════════════════════════
   LE PREMIER LANCEMENT — COPY DES 12 LANGUES (overlay)

   Deux aides nées du même constat : au premier lancement, rien n'expliquait
   à l'écran pourquoi l'app seemed inerte.

   1. `onboarding.*` — la porte d'onboarding ne doit plus avaler l'app. La
      permettre de passer outre, puis rappeler discrètement que sans langue
      de focus les quiz, les cartes et la révision restent vides.
   2. `conv.stepCharacter` / `conv.stepScenario` — le bouton « Commencer » de
      la conversation était désactivé « sans raison visible » (un `title`
      n'apparaît ni au doigt ni au lecteur d'écran). Ces deux libellés
      BECOMENT l'affichage permanent des prérequis, au-dessus du bouton.

   Contrat : `getFirstRunCopy(lang)` renvoie `{ onboarding: {…},
   conv: { stepCharacter, stepScenario } }` ou `undefined`, fusionné par-dessus
   les dictionnaires de base (voir i18n.tsx → applyDictionaryOverlays).

   Les six langues historiques gardaient ces clés en dur ; le passage par
   l'overlay les étend aux six langues africaines, qui tombaient sur le
   français par `fill()`. On s'appuie ici sur le vocabulaire déjà employé
   dans i18n.african.ts (`nav.noFocus`, `nav.changeFocus`) plutôt que sur
   des formulations neuves.
   ═══════════════════════════════════════════════════════════════════════ */

type FirstRunCopy = {
  onboarding: {
    /** Échappatoire de la porte d'onboarding, posée en bas d'écran. */
    exploreFirst: string;
    /** Rappel affiché dans l'app une fois l'onboarding écarté. */
    noFocusHint: string;
    /** Bouton du rappel : rouvre le sélecteur de langues. */
    pickFocus: string;
  };
  conv: {
    /** Prérequis affiché au-dessus du bouton « Commencer ». */
    stepCharacter: string;
    stepScenario: string;
  };
};

const FIRST_RUN: Record<string, FirstRunCopy> = {
  fr: {
    onboarding: {
      exploreFirst: "Explorer d'abord, choisir plus tard",
      noFocusHint:
        "Aucune langue de focus sélectionnée : quiz, cartes et révision restent vides tant que tu n'en choisis pas.",
      pickFocus: "Choisir mes langues",
    },
    conv: { stepCharacter: "Personnage", stepScenario: "Scénario" },
  },
  en: {
    onboarding: {
      exploreFirst: "Explore first, choose later",
      noFocusHint:
        "No focus language selected: quizzes, cards and review stay empty until you pick one.",
      pickFocus: "Pick my languages",
    },
    conv: { stepCharacter: "Character", stepScenario: "Scenario" },
  },
  es: {
    onboarding: {
      exploreFirst: "Explorar primero, elegir después",
      noFocusHint:
        "Ningún idioma de enfoque seleccionado: los cuestionarios, las tarjetas y el repaso siguen vacíos hasta que elijas uno.",
      pickFocus: "Elegir mis idiomas",
    },
    conv: { stepCharacter: "Personaje", stepScenario: "Escenario" },
  },
  zh: {
    onboarding: {
      exploreFirst: "先浏览，稍后再选",
      noFocusHint: "尚未选择专注语言：测验、卡片和复习将一直空白，直到你选择一门。",
      pickFocus: "选择我的语言",
    },
    conv: { stepCharacter: "角色", stepScenario: "场景" },
  },
  ar: {
    onboarding: {
      exploreFirst: "استكشف أولًا، واختر لاحقًا",
      noFocusHint:
        "لم تختر لغة تركيز بعد: تظل الاختبارات والبطاقات والمراجعة فارغة حتى تختار واحدة.",
      pickFocus: "اختر لغاتي",
    },
    conv: { stepCharacter: "الشخصية", stepScenario: "السيناريو" },
  },
  ru: {
    onboarding: {
      exploreFirst: "Сначала посмотреть, выбрать позже",
      noFocusHint:
        "Фокусный язык не выбран: квизы, карточки и повторение останутся пустыми, пока ты не выберешь один.",
      pickFocus: "Выбрать языки",
    },
    conv: { stepCharacter: "Персонаж", stepScenario: "Сценарий" },
  },
  sw: {
    onboarding: {
      exploreFirst: "Angalia kwanza, chagua baadaye",
      noFocusHint:
        "Hakuna lugha ya kipaumbele: majaribio, kadi na marudio zitabaki tupu hadi uchague moja.",
      pickFocus: "Chagua lugha zangu",
    },
    conv: { stepCharacter: "Mwandishi", stepScenario: "Hali" },
  },
  ln: {
    onboarding: {
      exploreFirst: "Tala lisusu, pona simba",
      noFocusHint:
        "Lokota te ya.focus: quiz, carte na révision ekotoba nzete kote osa poni bolamu.",
      pickFocus: "Pona lugha na ngai",
    },
    conv: { stepCharacter: "Motó", stepScenario: "Nzembo" },
  },
  ha: {
    onboarding: {
      exploreFirst: "Duba farko, zaɓi baya",
      noFocusHint:
        "Babu harshen mai mafi girma: quiz, kataye da maimaita za su tsaya ne kai ka zaɓi ko da dayawa.",
      pickFocus: "Zaɓi harshhe",
    },
    conv: { stepCharacter: "Wani", stepScenario: "Yanayin" },
  },
  yo: {
    onboarding: {
      exploreFirst: "Wo kí a kíyè lẹ́yìn, yan lẹ́yìn",
      noFocusHint:
        "Kò sí èdè tí a fókù: àyẹ̀wò, káàrọ̀ àti àtúnṣe máa kò ní ohun tití o mọ̀ èdè kan.",
      pickFocus: "Yan èdè rẹ",
    },
    conv: { stepCharacter: "Àrò", stepScenario: "Àmì" },
  },
  zu: {
    onboarding: {
      exploreFirst: "Buka kuqala, khetha emva",
      noFocusHint:
        "Awukho ulimi olugxanile: imibuzo, amakhadi neukuphinda zizohlala zitempty kuze ukhethe ulimi.",
      pickFocus: "Khetha izilimi zakho",
    },
    conv: { stepCharacter: "Umuntu", stepScenario: "Isimo" },
  },
  wo: {
    onboarding: {
      exploreFirst: "Siiñ ci tekk, tann ci topp",
      noFocusHint:
        "Amul làkk bu ndal: quiz, carte ak_revision di lay wëcc ku ci tekk yi nekk.",
      pickFocus: "Tann làkk yi",
    },
    conv: { stepCharacter: "Kër", stepScenario: "Li yóbbu" },
  },
};

export function getFirstRunCopy(lang: string): unknown | undefined {
  return FIRST_RUN[lang];
}