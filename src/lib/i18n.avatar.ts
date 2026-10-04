/* ═══════════════════════════════════════════════════════════════════════
   L'AVATAR — COPY DES 12 LANGUES (overlay)

   Tout ce qui touche au look de l'utilisateur vit ici :
     · `space.rpm.*`   le studio Ready Player Me (bouton, studio intégré,
                       carte de secours quand l'iframe est bloquée) ;
     · `customization.section.*` les deux onglets de la forge —
                       « Style » (grille emoji) et « Avatar 3D ».

   Les trois dictionnaires historiques (fr / en / es) portent déjà une
   partie de ces chaînes ; les neuf autres langues tombaient sur le repli
   français, ce qui cassait la promesse « voix cohérente dans les 12
   langues ». Cet overlay les couvre toutes.

   Contrat : getAvatarCopy(lang) renvoie
   { space: { rpm: {…} }, customization: { section: {…} } } ou undefined,
   fusionné par-dessus les dictionnaires de base (voir i18n.tsx →
   applyDictionaryOverlays).
   ═══════════════════════════════════════════════════════════════════════ */

type RpmCopy = {
  button: string;
  title: string;
  hint: string;
  studio: string;
  saved: string;
  removed: string;
  error: string;
  remove: string;
  open: string;
  loading: string;
  /* Carte de secours : le studio RPM est bloqué dans l'aperçu enrichi. */
  fallback: string;
  openTab: string;
  pasteHint: string;
  paste: string;
  useLink: string;
  badLink: string;
};

/** Les deux onglets de la forge : « Style » (emoji) / « Avatar 3D ». */
type SectionCopy = { style: string; avatar3d: string };

const RPM: Record<string, RpmCopy> = {
  fr: {
    button: "Créer mon avatar 3D",
    title: "Ton avatar 3D",
    hint: "Habille ton personnage, choisis sa couleur, puis reviens ici : il t'attend.",
    studio: "Studio Ready Player Me",
    saved: "Avatar 3D enregistré",
    removed: "Avatar 3D retiré",
    error: "Impossible d'enregistrer cet avatar",
    remove: "Revenir à mon emoji",
    open: "Ouvrir le studio",
    loading: "Ton avatar arrive…",
    fallback: "Le studio 3D ne charge pas dans cet aperçu.",
    openTab: "Ouvrir dans un nouvel onglet",
    pasteHint: "Tu as créé ton avatar ailleurs ? Colle son lien ici.",
    paste: "Lien de ton avatar .glb",
    useLink: "Utiliser ce lien",
    badLink: "Ce lien n'est pas une adresse d'avatar Ready Player Me.",
  },
  en: {
    button: "Create my 3D avatar",
    title: "Your 3D avatar",
    hint: "Dress your character, pick a colour, then come back: it'll be waiting here.",
    studio: "Ready Player Me studio",
    saved: "3D avatar saved",
    removed: "3D avatar removed",
    error: "Couldn't save this avatar",
    remove: "Back to my emoji",
    open: "Open the studio",
    loading: "Your avatar is coming…",
    fallback: "The 3D studio doesn't load in this preview.",
    openTab: "Open in a new tab",
    pasteHint: "Made your avatar somewhere else? Paste its link here.",
    paste: "Your .glb avatar link",
    useLink: "Use this link",
    badLink: "That link isn't a Ready Player Me avatar address.",
  },
  es: {
    button: "Crear mi avatar 3D",
    title: "Tu avatar 3D",
    hint: "Viste a tu personaje, elige su color y vuelve: te estará esperando.",
    studio: "Estudio Ready Player Me",
    saved: "Avatar 3D guardado",
    removed: "Avatar 3D eliminado",
    error: "No se pudo guardar este avatar",
    remove: "Volver a mi emoji",
    open: "Abrir el estudio",
    loading: "Tu avatar llega…",
    fallback: "El estudio 3D no carga en esta vista previa.",
    openTab: "Abrir en una pestaña nueva",
    pasteHint: "¿Creaste tu avatar en otro sitio? Pega su enlace aquí.",
    paste: "Enlace de tu avatar .glb",
    useLink: "Usar este enlace",
    badLink: "Ese enlace no es una dirección de avatar de Ready Player Me.",
  },
  zh: {
    button: "创建我的 3D 头像",
    title: "你的 3D 头像",
    hint: "给你的角色换装、挑颜色，然后回到这里，它就在等你。",
    studio: "Ready Player Me 工作室",
    saved: "3D 头像已保存",
    removed: "3D 头像已移除",
    error: "无法保存这个头像",
    remove: "回到我的表情",
    open: "打开工作室",
    loading: "你的头像马上就来…",
    fallback: "这个预览里加载不了 3D 工作室。",
    openTab: "在新标签页打开",
    pasteHint: "你在别处做好头像了？把链接贴在这里。",
    paste: "你的 .glb 头像链接",
    useLink: "使用这个链接",
    badLink: "这个链接不是 Ready Player Me 的头像地址。",
  },
  ar: {
    button: "أنشئ صورتي ثلاثية الأبعاد",
    title: "صورتك ثلاثية الأبعاد",
    hint: "رتّب ملابس شخصيتك، اختر اللون، ثم عد إلى هنا: ستنظرك.",
    studio: "استوديو Ready Player Me",
    saved: "تم حفظ الصورة ثلاثية الأبعاد",
    removed: "تمت إزالة الصورة ثلاثية الأبعاد",
    error: "تعذّر حفظ هذه الصورة",
    remove: "العودة إلى رمز الوجه",
    open: "افتح الاستوديو",
    loading: "صورتك في الطريق…",
    fallback: "الاستوديو ثلاثي الأبعاد لا يُحمَّل في هذه المعاينة.",
    openTab: "افتح في لسان جديد",
    pasteHint: "أنشأت صورتك في مكان آخر؟ الصق رابطها هنا.",
    paste: "رابط صورتك بصيغة ‎.glb",
    useLink: "استخدم هذا الرابط",
    badLink: "هذا الرابط ليس عنوان صورة من Ready Player Me.",
  },
  ru: {
    button: "Создать 3D-аватар",
    title: "Твой 3D-аватар",
    hint: "Одень персонажа, выбери цвет и возвращайся: он будет ждать тебя.",
    studio: "Студия Ready Player Me",
    saved: "3D-аватар сохранён",
    removed: "3D-аватар удалён",
    error: "Не удалось сохранить этот аватар",
    remove: "Вернуться к моему эмодзи",
    open: "Открыть студию",
    loading: "Аватар уже в пути…",
    fallback: "3D-студия не загружается в этом превью.",
    openTab: "Открыть в новой вкладке",
    pasteHint: "Создал аватар в другом месте? Вставь ссылку сюда.",
    paste: "Ссылка на твой .glb-аватар",
    useLink: "Использовать ссылку",
    badLink: "Это не ссылка на аватар Ready Player Me.",
  },
  sw: {
    button: "Unda avatar yangu ya 3D",
    title: "Avatar yako ya 3D",
    hint: "Vaa nguo ya mhusika wako, chagua rangi, kisha rudi hapa: atakuwa anakusubiri.",
    studio: "Studio ya Ready Player Me",
    saved: "Avatar ya 3D imehifadhiwa",
    removed: "Avatar ya 3D imeondolewa",
    error: "Imeshindikana kuhifadhi avatar hiyo",
    remove: "Rudi kwenye emoji yangu",
    open: "Fungua studio",
    loading: "Avatar yako inakuja…",
    fallback: "Studio ya 3D haipakiwi katika mwonekano huu.",
    openTab: "Fungua kwenye kichupo kipya",
    pasteHint: "Umefanya avatar mahali pengine? Bandika kiungo chake hapa.",
    paste: "Kiungo cha avatar yako ya .glb",
    useLink: "Tumia kiungo hiki",
    badLink: "Kiungo hiki si kiko cha avatar ya Ready Player Me.",
  },
  ln: {
    button: "Sala eloko na ngó ya 3D",
    title: "Eloko na ngó ya 3D",
    hint: "Lapa motó ya moto na ngó, tángan mboki, pe midi ko: ekotambola yo.",
    studio: "Eselo ya Ready Player Me",
    saved: "Eloko na ngó ya 3D ebongisami",
    removed: "Eloko na ngó ya 3D eliminisami",
    error: "Tokotela kosala eloko na ngó oyo",
    remove: "Kota na emoji na ngó",
    open: "Sala eselo",
    loading: "Eloko na ngó ya koyeba…",
    fallback: "Eselo ya 3D ekotéyema komonanga oyo.",
    openTab: "Sala na tabi nzembo",
    pasteHint: "Osala eloko na ngó nhóni selo? Bakayisa lien na ngó oyo awá.",
    paste: "Lien ya eloko na ngó ya .glb",
    useLink: "Bokoka lien oyo",
    badLink: "Lien oyo ezali lien ya eloko na ngó ya Ready Player Me.",
  },
  ha: {
    button: "Ƙirƙiriƙiriƙiri hoton na 3D na",
    title: "Hotonka 3D na",
    hint: "Sanya abaya ga yafi, zaɓiɓɓi lafiya, ka koma nan: yana jiran ka.",
    studio: "Studio na Ready Player Me",
    saved: "An adana hoton 3D",
    removed: "An sace hoton 3D",
    error: "Ba a yi nasara adana hoton nan",
    remove: "Koma zuwa emoji na",
    open: "Buɗe studio",
    loading: "Hotonka tana zuwa…",
    fallback: "Studio na 3D ba ta buɗe ba tare da wannan hotonka.",
    openTab: "Buɗe a cikin tabo na sabo",
    pasteHint: "Ka yi hoton a wani wuri? Sanya mahaɗin sa a nan.",
    paste: "Mahaɗin hotonka na .glb",
    useLink: "Yi amfani da mahaɗin nan",
    badLink: "Mahaɗin nan ba adireshin hoton Ready Player Me ba ne.",
  },
  yo: {
    button: "Ṣẹ̀dá àwòrán mi 3D",
    title: "Àwòrán rẹ 3D",
    hint: "Dress àwọn àǹgùn rẹ, yàn àwọ̀rẹ̀, kí o sọ̀dọ̀ sí íbí: ń dúró tì ọ.",
    studio: "Ilé ìṣẹ̀dá Ready Player Me",
    saved: "A ti pamọ́ àwòrán 3D",
    removed: "A ti yọ àwòrán 3D kúrú",
    error: "A kò lè pamọ́ àwòrán yìí",
    remove: "Padà sí emojì mi",
    open: "Ṣí ilé ìṣẹ̀dá",
    loading: "Àwòrán rẹ ń dé…",
    fallback: "Ilé ìṣẹ̀dá 3D kò ṣi tí ó máa ṣe nínú àrìjìrì yìí.",
    openTab: "Ṣí ní tábì tuntun",
    pasteHint: "Ṣẹ̀dá àwòrán rẹ ní ọ̀kan àyé? Fi ọ̀nà rẹ̀ sílẹ̀ níbí.",
    paste: "Ọ̀nà àwòrán rẹ .glb",
    useLink: "Lo ọ̀nà náà",
    badLink: "Ọ̀nà náà kì í ọ̀nà àwòrán Ready Player Me.",
  },
  zu: {
    button: "Dala isithombe sami 3D",
    title: "Isithombe sakho 3D",
    hint: "Gqoca ingubo yakhe, khetha umbala, bese ubuyela lapha: uzokulindela.",
    studio: "Istudio ye-Ready Player Me",
    saved: "Isithombe 3D sigcinjwe",
    removed: "Isithombe 3D susiwe",
    error: "Akekho noku-sigcina lesi thombe",
    remove: "Phinda kwe-emoji yami",
    open: "Vula istudio",
    loading: "Isithombe sakho siyafika…",
    fallback: "Istudio 3D ayilayezi kuleyo siboniso.",
    openTab: "Vula ethabu lensha",
    pasteHint: "Wakhe isithombe kwelinye inda? Namathisela isixhumana sa lapha.",
    paste: "Isixhumana sesithombe sakho se-.glb",
    useLink: "Sebenzisa lesi sixhumana",
    badLink: "Lesi sixhumana asusiyo isithombe se-Ready Player Me.",
  },
  wo: {
    button: "Joxaan mbir mi 3D",
    title: "Mbir ndao yi 3D",
    hint: "Féere mbir yi, tángan flaas bu bees, dugg seen: lay deg bu dëgg.",
    studio: "Studio bu Ready Player Me",
    saved: "Mbir mi 3D buugg bu dee",
    removed: "Mbir mi 3D buis bees",
    error: "Dara la gis mbir bi",
    remove: "Dugg ci seen emoji bu bees",
    open: "Tekki studio bi",
    loading: "Mbir ndao mi diay…",
    fallback: "Studio bu 3D bu bees bu dugg ci seen bi.",
    openTab: "Tekki liiwa bu bees",
    pasteHint: "Joxaan mbir yi fecc bu bës? Bës askan yi ci seen bi.",
    paste: "Askan mbir yi mi .glb",
    useLink: "Jëf askan bi",
    badLink: "Askan bi sax ci mbir bu Ready Player Me.",
  },
};

const SECTIONS: Record<string, SectionCopy> = {
  fr: { style: "Style", avatar3d: "Avatar 3D" },
  en: { style: "Style", avatar3d: "3D avatar" },
  es: { style: "Estilo", avatar3d: "Avatar 3D" },
  zh: { style: "风格", avatar3d: "3D 头像" },
  ar: { style: "الإطلالة", avatar3d: "صورة 3D" },
  ru: { style: "Стиль", avatar3d: "3D-аватар" },
  sw: { style: "Mtindo", avatar3d: "Avatar ya 3D" },
  ln: { style: "Motó", avatar3d: "Eloko na ngó 3D" },
  ha: { style: "Salo", avatar3d: "Hoton 3D" },
  yo: { style: "Ìwọ́n", avatar3d: "Àwòrán 3D" },
  zu: { style: "Isitayela", avatar3d: "Isithombe 3D" },
  wo: { style: "Faat", avatar3d: "Mbir 3D" },
};

export function getAvatarCopy(lang: string): unknown | undefined {
  const rpm = RPM[lang];
  const section = SECTIONS[lang];
  if (!rpm || !section) return undefined;
  return { space: { rpm }, customization: { section } };
}
