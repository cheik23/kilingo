/* ═══════════════════════════════════════════════════════════════════════
   LA PWA — COPY DES 12 LANGUES (overlay)

   Aucune des six dictionnaires historiques ne portait ces chaînes : le lot
   PWA les introduit d'un bloc. L'overlay couvre donc les 12 langues, pour
   la même raison que `i18n.avatar.ts` : le repli français sur un module
   entier est ce que l'utilisateur voit immédiatement quand il change de
   langue.

   Contrat : `getPwaCopy(lang)` renvoie `{ pwa: {…} }` ou `undefined`,
   fusionné par-dessus les dictionnaires de base (voir i18n.tsx →
   applyDictionaryOverlays).

   Clés consommées par components/PwaRuntime.tsx et les Réglages.
   ═══════════════════════════════════════════════════════════════════════ */

type PwaCopy = {
  offline: {
    /** Bandeau fixe en haut de l'écran. */
    banner: string;
    /** Message des états vides quand une query Convex ne peut pas répondre. */
    message: string;
    /** Bouton de rechargement. */
    retry: string;
    /** Tooltip du bouton désactivé : pourquoi il ne fait rien. */
    tooltip: string;
  };
  install: {
    button: string;
    /** Affiché quand l'app tourne déjà en mode standalone. */
    installed: string;
    /** Repli iOS : pas d'évènement `beforeinstallprompt` à déclencher. */
    manual: string;
    dismissed: string;
  };
};

const PWA: Record<string, PwaCopy> = {
  fr: {
    offline: {
      banner: "Hors ligne — mode lecture",
      message: "Je garde tout au chaud pour ton retour 🌙",
      retry: "Réessayer",
      tooltip: "Connexion requise",
    },
    install: {
      button: "Installer l'app",
      installed: "L'app est déjà installée",
      manual: "Sur iPhone : Partager → Sur l'écran d'accueil",
      dismissed: "Installation suggérée plus tard",
    },
  },
  en: {
    offline: {
      banner: "Offline — read-only mode",
      message: "I'm keeping everything warm for your return 🌙",
      retry: "Try again",
      tooltip: "Connection required",
    },
    install: {
      button: "Install app",
      installed: "The app is already installed",
      manual: "On iPhone: Share → Add to Home Screen",
      dismissed: "Install suggestion dismissed",
    },
  },
  es: {
    offline: {
      banner: "Sin conexión — modo lectura",
      message: "Lo guardo todo caliente para tu vuelta 🌙",
      retry: "Reintentar",
      tooltip: "Se necesita conexión",
    },
    install: {
      button: "Instalar la app",
      installed: "La app ya está instalada",
      manual: "En iPhone: Compartir → Añadir a inicio",
      dismissed: "Sugerencia de instalación descartada",
    },
  },
  zh: {
    offline: {
      banner: "离线 — 只读模式",
      message: "我把一切都保温着，等你回来 🌙",
      retry: "重试",
      tooltip: "需要网络连接",
    },
    install: {
      button: "安装应用",
      installed: "应用已安装",
      manual: "在 iPhone 上：分享 → 添加到主屏幕",
      dismissed: "已关闭安装提示",
    },
  },
  ar: {
    offline: {
      banner: "غير متصل — وضع القراءة",
      message: "أحتفظ بكل شيء دافئًا حتى يعودتك 🌙",
      retry: "أعد المحاولة",
      tooltip: "يلزم الاتصال",
    },
    install: {
      button: "ثبّت التطبيق",
      installed: "التطبيق مثبّت بالفعل",
      manual: "على iPhone: مشاركة → إضافة إلى الشاشة الرئيسية",
      dismissed: "تم رفض اقتراح التثبيت",
    },
  },
  ru: {
    offline: {
      banner: "Офлайн — режим чтения",
      message: "Держу всё тёплым к твоему возвращению 🌙",
      retry: "Повторить",
      tooltip: "Нужно подключение",
    },
    install: {
      button: "Установить приложение",
      installed: "Приложение уже установлено",
      manual: "На iPhone: Поделиться → На экран «Домой»",
      dismissed: "Предложение установки отклонено",
    },
  },
  sw: {
    offline: {
      banner: "Nje ya mtandao — hali ya kusoma",
      message: "Nayakutisha kila kitu mpaka urudi 🌙",
      retry: "Jaribu tena",
      tooltip: "Inahitaji muunganisho",
    },
    install: {
      button: "Sasisha programu",
      installed: "Programu tayari imewekwa",
      manual: "Kwenye iPhone: Shiriki → Weka kwenye Skrini ya Nyumbani",
      dismissed: "Ushauri wa kusasisha umekataliwa",
    },
  },
  ln: {
    offline: {
      banner: "Pasembi — mode ya bomoko",
      message: "Nazalika mobembo nyonso koy-embo moninga na bóyebi 🌙",
      retry: "Bobongisa lisusu",
      tooltip: "Moko moninga ebandeli",
    },
    install: {
      button: "Bóngá programme",
      installed: "Programme ebongisami yáká",
      manual: "Na iPhone: Kabongá → Bóngá na écran ya Ndako",
      dismissed: "Mokano ya kobonga programme etandali",
    },
  },
  ha: {
    offline: {
      banner: "Babu haɗi — yanayin karantawa",
      message: "Ina tsare abinci na da jima 🌙",
      retry: "Sake gwada",
      tooltip: "Ana buƙatar haɗi",
    },
    install: {
      button: "Shigar da app",
      installed: "An riga an shigar da app",
      manual: "A kan iPhone: Raba → Ƙara zuwa allon gida",
      dismissed: "An soke shawara shigar",
    },
  },
  yo: {
    offline: {
      banner: "Àì sí ìntánẹ́ẹtì — ìmú-ìtàn àdìrẹ́",
      message: "Mo fi gbogbo rẹ̀ ní ìwà-òtútù lí o bá padà 🌙",
      retry: "Tún gbìyànjú",
      tooltip: "Àìtọ́ ìntánẹ́ẹtì",
    },
    install: {
      button: "Fi ọ̀pọ̀ ìlé",
      installed: "Ọ̀pọ̀ ìlé ti fi tẹ́lẹ̀",
      manual: "Lórí iPhone: Pín → Fi sí ojú-ìwé ìbẹ̀rẹ̀",
      dismissed: "Ìtànlé ọ̀pọ̀ ìlé ti fagilé",
    },
  },
  zu: {
    offline: {
      banner: "Ngaphandle kwenethwezi — imo yekufunda",
      message: "Ngiyigcine konke kusheshe uma ubuyela 🌙",
      retry: "Zama futhi",
      tooltip: "Kuxhunywe inthanethi",
    },
    install: {
      button: "Faka uhlelo",
      installed: "Uhlelo selufakiwe",
      manual: "Ku-iPhone: Yabelana → Faka ekhasini likhaya",
      dismissed: "Isiqondiso sokufaka siyichululiwe",
    },
  },
  wo: {
    offline: {
      banner: "Kone ngay def tey — mode bu bees",
      message: "Doy def teg mi yi ngay yóbbu nga fahaama 🌙",
      retry: "Hawtata",
      tooltip: "Saxul bu nekkul network",
    },
    install: {
      button: "Install application bi",
      installed: "Application bi dinu install",
      manual: "Ci iPhone: Raan → Tukulo screen bu kër",
      dismissed: "Tëmbë bi installsalaama yi naka",
    },
  },
};

export function getPwaCopy(lang: string): unknown | undefined {
  const pwa = PWA[lang];
  if (!pwa) return undefined;
  return { pwa };
}
