/* ═══════════════════════════════════════════════════════════════════════
   L'UNIVERS — CHAQUE PAGE EST UN LIEU (i18n ×12)

   Un seul endroit pour les neuf lieux du monde Kilingo : le nom du
   lieu (kicker), une phrase d'ambiance (sous-titre court, poétique) et
   une phrase de vide (empty state, simple et rassurante).

   Pourquoi un overlay séparé : le dictionnaire historique reste intact,
   les lieux se posent par-dessus au chargement (mergeInto), exactement
   comme les overlays mod6 / tier3. Une langue ajoutée plus tard n'a
   qu'à fournir ses neuf lieux ici.

   Contrat : getPlacesCopy(lang) renvoie { places: { … } } ou undefined —
   l'appelant (i18n.tsx) sait fusionner, et `t("places.home.kicker")`
   retombe sur le français si une langue manque.
   ═══════════════════════════════════════════════════════════════════════ */

/** Les neuf lieux de l'univers. */
export type PlaceKey =
  | "home"
  | "atlas"
  | "shadow"
  | "conversation"
  | "store"
  | "achievements"
  | "space"
  | "leaderboard"
  | "history"
  | "signs";

/** [kicker (nom du lieu), ambiance (phrase d'ambiance), empty (phrase de vide)] */
type PlaceTriplet = [string, string, string];
type PlacesLang = Record<PlaceKey, PlaceTriplet>;

const PLACES: Record<string, PlacesLang> = {
  fr: {
    home: [
      "La Place",
      "Ici commence ta journée — le monde parle, tu écoutes.",
      "Ta place est encore vide. Choisis une langue et reviens.",
    ],
    atlas: [
      "La Carte",
      "Chaque expression est un point sur la carte du monde.",
      "Rien à cet endroit. Essaie un autre mot ou élargis ton filtre.",
    ],
    shadow: [
      "La Scène",
      "Colle un contenu : la scène s'éclaire et les mots défilent.",
      "La scène est vide. Apporte une vidéo, un fichier ou un texte.",
    ],
    conversation: [
      "Le QG",
      "Pousse la porte — quelqu'un t'attend pour parler.",
      "Personne au comptoir pour cette langue. Reviens dans un instant.",
    ],
    store: [
      "Le Marché",
      "Ici, tes gems deviennent des objets bien à toi.",
      "L'étal est vide pour le moment.",
    ],
    achievements: [
      "Le Mur des Légendes",
      "Chaque exploit laisse une trace sur ce mur.",
      "Aucun exploit ici encore. Un premier pas et le mur se remplit.",
    ],
    space: [
      "Ton Sanctuaire",
      "Ton coin à toi : ton look, tes langues, ta progression.",
      "Ton sanctuaire est encore nu. Personnalise-le.",
    ],
    leaderboard: [
      "L'Arène",
      "Ici, on mesure l'effort de la semaine.",
      "L'arène est déserte. Marque des points pour y entrer.",
    ],
    history: [
      "Le Journal",
      "Tout ce que tu as traversé, page après page.",
      "Le journal est vierge. Ta première session y écrira la première ligne.",
    ],
    signs: [
      "Les Mains",
      "Les mots se signent : regarde, rejoue, répète.",
      "Aucun signe ici pour l'instant. Élargis le filtre.",
    ],
  },
  en: {
    home: [
      "The Square",
      "Your day starts here — the world talks, you listen.",
      "Your square is still empty. Pick a language and come back.",
    ],
    atlas: [
      "The Map",
      "Every expression is a pin on the world map.",
      "Nothing here. Try another word or widen your filter.",
    ],
    shadow: [
      "The Stage",
      "Paste anything: the lights come up and the words roll.",
      "The stage is empty. Bring a video, a file or some text.",
    ],
    conversation: [
      "The Base",
      "Push the door open — someone is waiting to talk.",
      "Nobody at the counter for this language. Come back shortly.",
    ],
    store: [
      "The Market",
      "Here your gems turn into things that are truly yours.",
      "The stalls are empty right now.",
    ],
    achievements: [
      "The Wall of Legends",
      "Every feat leaves a mark on this wall.",
      "No feat here yet. One first step and the wall fills up.",
    ],
    space: [
      "Your Sanctuary",
      "Your own corner: your look, your languages, your progress.",
      "Your sanctuary is still bare. Make it yours.",
    ],
    leaderboard: [
      "The Arena",
      "This is where the week's effort is measured.",
      "The arena is empty. Score points to step in.",
    ],
    history: [
      "The Journal",
      "Everything you have been through, page after page.",
      "The journal is blank. Your first session writes the first line.",
    ],
    signs: [
      "The Hands",
      "Words are signed: watch, replay, repeat.",
      "No sign here yet. Widen the filter.",
    ],
  },
  es: {
    home: [
      "La Plaza",
      "Aquí empieza tu día: el mundo habla y tú escuchas.",
      "Tu plaza sigue vacía. Elige un idioma y vuelve.",
    ],
    atlas: [
      "El Mapa",
      "Cada expresión es un punto en el mapa del mundo.",
      "Nada por aquí. Prueba otra palabra o amplía el filtro.",
    ],
    shadow: [
      "El Escenario",
      "Pega un contenido: se encienden las luces y ruedan las palabras.",
      "El escenario está vacío. Trae un vídeo, un archivo o un texto.",
    ],
    conversation: [
      "El Cuartel",
      "Empuja la puerta: alguien te espera para hablar.",
      "Nadie en la barra para este idioma. Vuelve en un momento.",
    ],
    store: [
      "El Mercado",
      "Aquí tus gemas se vuelven cosas tuyas de verdad.",
      "Los puestos están vacíos por ahora.",
    ],
    achievements: [
      "El Muro de las Leyendas",
      "Cada hazaña deja una marca en este muro.",
      "Aún no hay hazañas. Un primer paso y el muro se llena.",
    ],
    space: [
      "Tu Santuario",
      "Tu rincón: tu imagen, tus idiomas, tu progreso.",
      "Tu santuario aún está desnudo. Personalízalo.",
    ],
    leaderboard: [
      "La Arena",
      "Aquí se mide el esfuerzo de la semana.",
      "La arena está desierta. Suma puntos para entrar.",
    ],
    history: [
      "El Diario",
      "Todo lo que has recorrido, página tras página.",
      "El diario está en blanco. Tu primera sesión escribirá la primera línea.",
    ],
    signs: [
      "Las Manos",
      "Las palabras se.signan: mira, repite, repite.",
      "Aún no hay ninguna seña aquí. Amplía el filtro.",
    ],
  },
  zh: {
    home: [
      "广场",
      "一天从这里开始——世界在说，你在听。",
      "你的广场还空着。选一门语言再回来。",
    ],
    atlas: [
      "地图",
      "每一个说法都是世界地图上的一个点。",
      "这里什么都没有。换个词，或放宽筛选。",
    ],
    shadow: [
      "舞台",
      "贴上内容，灯光亮起，字句滚动。",
      "舞台空着。带一段视频、一个文件或一段文字来。",
    ],
    conversation: [
      "据点",
      "推开门——有人在等你开口。",
      "这门语言暂时没人值班。稍后再来。",
    ],
    store: [
      "集市",
      "在这里，宝石变成真正属于你的东西。",
      "摊位暂时空着。",
    ],
    achievements: [
      "传奇之墙",
      "每一个成就都会在这面墙上留下痕迹。",
      "还没有成就。迈出第一步，墙就满了。",
    ],
    space: [
      "你的圣所",
      "你自己的角落：形象、语言、进度。",
      "你的圣所还空着。把它变成你的样子。",
    ],
    leaderboard: [
      "竞技场",
      "这里衡量一周的努力。",
      "竞技场空无一人。拿分就能进场。",
    ],
    history: [
      "日志",
      "你走过的一切，一页接一页。",
      "日志还是空白。第一次学习会写下第一行。",
    ],
    signs: [
      "双手",
      "词语是用手比出来的：看、跟着做、再来一次。",
      "这里还没有手语。换一个筛选条件吧。",
    ],
  },
  ar: {
    home: [
      "الساحة",
      "يومك يبدأ من هنا — العالم يتحدث وأنت تستمع.",
      "ساحتك ما زالت فارغة. اختر لغة ثم عد.",
    ],
    atlas: [
      "الخريطة",
      "كل تعبير نقطة على خريطة العالم.",
      "لا شيء هنا. جرّب كلمة أخرى أو وسّع الفلتر.",
    ],
    shadow: [
      "المسرح",
      "الصق أي محتوى: تضيء الأضواء وتتدحرج الكلمات.",
      "المسرح فارغ. أحضر مقطعاً أو ملفاً أو نصاً.",
    ],
    conversation: [
      "المقر",
      "افتح الباب — أحدهم ينتظرك لتتحدث.",
      "لا أحد في هذا المقر لهذه اللغة. عُد بعد قليل.",
    ],
    store: [
      "السوق",
      "هنا تتحول جواهرك إلى أشياء لك وحدك.",
      "البسطات فارغة الآن.",
    ],
    achievements: [
      "جدار الأساطير",
      "كل إنجاز يترك أثراً على هذا الجدار.",
      "لا إنجاز بعد. خطوة أولى ويمتلئ الجدار.",
    ],
    space: [
      "ملاذك",
      "زاويتك: مظهرك ولغاتك وتقدمك.",
      "ملاذك ما زال خالياً. اجعله يشبهك.",
    ],
    leaderboard: [
      "الحلبة",
      "هنا يُقاس جهد الأسبوع.",
      "الحلبة خالية. اجمع نقاطاً لتدخلها.",
    ],
    history: [
      "السجل",
      "كل ما مررت به، صفحة بعد صفحة.",
      "السجل أبيض. أول جلسة ستكتب أول سطر.",
    ],
    signs: [
      "اليدان",
      "الكلمات تُشير: شاهد، أعد، كرّر.",
      "لا توجد إشارة هنا بعد. وسّع التصفية.",
    ],
  },
  ru: {
    home: [
      "Площадь",
      "Твой день начинается здесь — мир говорит, ты слушаешь.",
      "Твоя площадь пока пуста. Выбери язык и возвращайся.",
    ],
    atlas: [
      "Карта",
      "Каждое выражение — точка на карте мира.",
      "Здесь ничего нет. Попробуй другое слово или расширь фильтр.",
    ],
    shadow: [
      "Сцена",
      "Вставь что угодно: свет загорается, слова идут чередой.",
      "Сцена пуста. Принеси видео, файл или текст.",
    ],
    conversation: [
      "Штаб",
      "Толкни дверь — тебя уже ждут для разговора.",
      "За стойкой для этого языка никого нет. Загляни чуть позже.",
    ],
    store: [
      "Рынок",
      "Здесь самоцветы превращаются в то, что правда твоё.",
      "Прилавки пока пусты.",
    ],
    achievements: [
      "Стена легенд",
      "Каждый подвиг оставляет след на этой стене.",
      "Пока ни одного подвига. Первый шаг — и стена наполнится.",
    ],
    space: [
      "Твоё убежище",
      "Твой угол: образ, языки, прогресс.",
      "Убежище ещё пусто. Сделай его своим.",
    ],
    leaderboard: [
      "Арена",
      "Здесь измеряют усилие недели.",
      "Арена пуста. Набери очки, чтобы войти.",
    ],
    history: [
      "Журнал",
      "Всё, что ты прошёл, страница за страницей.",
      "Журнал чист. Первая сессия напишет первую строку.",
    ],
    signs: [
      "Руки",
      "Слова показываются руками: смотри, повтори, повтори.",
      "Здесь пока нет знаков. Расширь фильтр.",
    ],
  },
  sw: {
    home: [
      "Uwanja",
      "Siku yako inaanzia hapa — dunia inasema, wewe wasikiliza.",
      "Uwanja wako bado mtupu. Chagua lugha kisha urudi.",
    ],
    atlas: [
      "Ramani",
      "Kila usemi ni alama kwenye ramani ya dunia.",
      "Hakuna kitu hapa. Jaribu neno lingine au panua kichujio.",
    ],
    shadow: [
      "Jukwaa",
      "Bandika maudhui: taa zinawaka na maneno yanapita.",
      "Jukwaa ni tupu. Lete video, faili au maandishi.",
    ],
    conversation: [
      "Kambi",
      "Sukuma mlango — kuna mtu anayekusubiri kuongea.",
      "Hakuna mtu kwa lugha hii. Rudi baada ya muda mfupi.",
    ],
    store: [
      "Soko",
      "Hapa gems zako zinakuwa vitu vyako kweli.",
      "Mabanda ni matupu kwa sasa.",
    ],
    achievements: [
      "Ukuta wa Hadithi",
      "Kila ushindi unaacha alama kwenye ukuta huu.",
      "Hakuna ushindi bado. Hatua moja na ukuta unajaa.",
    ],
    space: [
      "Patakatifu pako",
      "Kona yako: muonekano, lugha, maendeleo.",
      "Patakatifu pako ni tupu. Ifanye yako.",
    ],
    leaderboard: [
      "Uwanja wa Mashindano",
      "Hapa hupimwa jitihada ya wiki.",
      "Uwanja ni mtupu. Pata pointi ili kuingia.",
    ],
    history: [
      "Jarida",
      "Kila ulichopitia, ukurasa kwa ukurasa.",
      "Jarida ni tupu. Kikao chako cha kwanza kitaandika mstari wa kwanza.",
    ],
    signs: [
      "Mikono",
      "Maneno yanaonyeshwa kwa mikono: angalia, rudi, rudi.",
      "Hakuna ishara hapa bado. Panua kichujio.",
    ],
  },
  ln: {
    home: [
      "Esika",
      "Mokolo na yo ebimeli awa — mokili elobaka, yo oyokaka.",
      "Esika na yo ezali mpamba. Pona linga mpe zonga.",
    ],
    atlas: [
      "Karte",
      "Maloba nyonso ezali elembo na karte ya mokili.",
      "Eloko moko te awa. Meka liloba mosusu to fungola filtrɛ.",
    ],
    shadow: [
      "Esika ya masano",
      "Paka eloko: mitinda ezali kongala mpe maloba ezali koleka.",
      "Esika ya masano ezali mpamba. Bika video, fichier to makomi.",
    ],
    conversation: [
      "Ndako ya lisolo",
      "Fungola ndako — moto azali kozela yo mpo na kosolola.",
      "Moto moko te mpo na linga oyo. Zonga sima ya mwa ntango.",
    ],
    store: [
      "Zandu",
      "Awa, gems na yo ekokoma biloko ya yo mpenza.",
      "Biloko ezali mpamba pona ntango oyo.",
    ],
    achievements: [
      "Efelo ya masolo",
      "Eloko nyonso oyo osali etikaki elembo na efelo oyo.",
      "Elembo moko te. Etape ya liboso mpe efelo ekotonda.",
    ],
    space: [
      "Esika na yo ya bule",
      "Etanda na yo: elongi, maloba, matambe.",
      "Esika na yo ya bule ezali mpamba. Salá yango na ndenge na yo.",
    ],
    leaderboard: [
      "Esika ya mpikano",
      "Awa bakomikisa mingi ya pɔsɔ.",
      "Esika ya mpikano ezali mpamba. Zwá pointi mpo na kokota.",
    ],
    history: [
      "Buku ya mikolo",
      "Nyonso oyo olekaki, lokasa na lokasa.",
      "Buku ya mikolo ezali mpamba. Session ya liboso ekokoma molongo ya liboso.",
    ],
    signs: [
      "Mikono",
      "MalobaBondoko kwa mikono: tala, bojongisa, bojongisa.",
      "Koyembo te oyo ekobane na ndembo hapa. Engozza eloko oyo ezalali.",
    ],
  },
  ha: {
    home: [
      "Filin",
      "Ranar ka ta fara nan nan — duniya na magana, kai na saurare.",
      "Filin naka har yanzu babu komewa. Zaɓi harshe ka dawo.",
    ],
    atlas: [
      "Taswira",
      "Kowace magana tabo ne a taswirar duniya.",
      "Babu komai a nan. Gwada wata kalma ko faɗaɗa tace.",
    ],
    shadow: [
      "Dandali",
      "Manna abun ciki: haske na kunnawa kalmomi na wucewa.",
      "Dandali babu komewa. Kawo bidiyo, fayil ko rubutu.",
    ],
    conversation: [
      "Tushe",
      "Tura ƙofar — wani na jiranka don yin magana.",
      "Babu kowa a kan tebur don wannan harshe. Dawo nan gaba kaɗan.",
    ],
    store: [
      "Kasuwa",
      "Nan jewels naka na juya abubuwan da suke naka da gaske.",
      "Kantuna babu komewa a yanzu.",
    ],
    achievements: [
      "Katangar Tatsuniya",
      "Kowace nasara tana barin tabo a wannan katanga.",
      "Babu nasara tukuna. Mataki ɗaya katangar ta cika.",
    ],
    space: [
      "Wuri mai tsarki naka",
      "Kusurwar ka: kamanni, harsuna, ci gaba.",
      "Wuri mai tsarki naka har yanzu babu komewa. Yi shi naka.",
    ],
    leaderboard: [
      "Filin fafatawa",
      "Nan ake auna ƙoƙarin mako.",
      "Filin fafatawa babu kowa. Sami maki don shiga.",
    ],
    history: [
      "Jarida",
      "Duk abin da ka wuce, shafi bayan shafi.",
      "Jarida fari ne. Zaman ka na farko zai rubuta layi na farko.",
    ],
    signs: [
      "Kafafaye",
      "Kalma sun signa: duba, sake, sake.",
      "Babba alama ba a nan nan. Kara filtɗa.",
    ],
  },
  yo: {
    home: [
      "Ọjà Ìta",
      "Ọjọ́ rẹ bẹ̀rẹ̀ níbí — ayé ń sọ̀rọ̀, ìwọ ń gbọ́.",
      "Ọjà rẹ ṣì ṣófo. Yan èdè kan kí o padà wá.",
    ],
    atlas: [
      "Ìwé Àwòrán Ilẹ̀",
      "Gbogbo ọ̀rọ̀ jẹ́ àmì kan lórí àwòrán ilẹ̀ ayé.",
      "Kò sí nǹkan níbí. Gbìyànjú ọ̀rọ̀ mìíràn tàbí ṣí àlẹ̀mọ́.",
    ],
    shadow: [
      "Ibi Ìtàgé",
      "Là kó nǹkan sí: ìmọ́lẹ̀ yóò tan, àwọn ọ̀rọ̀ yóò máa lọ.",
      "Ibi ìtàgé ṣófo. Mú fídíò, fáìlì tàbí ọ̀rọ̀ wá.",
    ],
    conversation: [
      "Ilé Ìjọ̀gbọ̀n",
      "Ti ilẹ̀kùn — ẹnìkan ń dúró dè ọ́ láti bá sọ̀rọ̀.",
      "Kò sí ẹnìkan fún èdè yìí. Padà wá lẹ́yìn ìgbà díẹ̀.",
    ],
    store: [
      "Ọjà",
      "Níbí, àwọn gems rẹ di nǹkan tìrẹ gan-an.",
      "Àwọn ibi títà ṣófo báyìí.",
    ],
    achievements: [
      "Ògiri Àwọn Ìtàn",
      "Gbogbo àṣeyọrí fi àmì sílẹ̀ lórí ògiri yìí.",
      "Kò sí àṣeyọrí síbẹ̀. Ìgbésẹ̀ kan ni ògiri yóò kún.",
    ],
    space: [
      "Ibùjókòó Rẹ",
      "Igun tìrẹ: ìrísí rẹ, àwọn èdè rẹ, ìtẹ̀síwájú rẹ.",
      "Ibùjókòó rẹ ṣì ṣófo. Ṣe é ní tìrẹ.",
    ],
    leaderboard: [
      "Ilé Ìdíje",
      "Níbí ni a ń wọn ìsapá ọ̀sẹ̀.",
      "Ilé ìdíje ṣófo. Gba àwọn àmì kí o lè wọlé.",
    ],
    history: [
      "Ìwé Ìṣẹ̀lẹ̀",
      "Ohun gbogbo tí o ti kọjá, ojú-ìwé dé ojú-ìwé.",
      "Ìwé ìṣẹ̀lẹ̀ fúnfun ni. Ìpàdé rẹ àkọ́kọ́ yóò kọ ìlà àkọ́kọ́.",
    ],
    signs: [
      "Ọwọ́n ẹ́",
      "Ọ̀rọ̀ wọ́n sí i: wo, tún, tún.",
      "Kò sí àmì ìwà hàn níbi tíí. Fẹ̀ sílẹ̀ àwọn àmì.",
    ],
  },
  zu: {
    home: [
      "Isikwele",
      "Usuku lwakho luqala lapha — umhlaba uyakhuluma, wena ulalela.",
      "Isikwele sakho sisenalutho. Khetha ulimi bese ubuya.",
    ],
    atlas: [
      "Ibalazwe",
      "Zonke izisho ziyiphoyinti ebalazweni lomhlaba.",
      "Akukho lutho lapha. Zama elinye igama noma vula isihlungi.",
    ],
    shadow: [
      "Isiteji",
      "Namathisela okuqukethwe: izibani ziyakhanya, amagama ehla.",
      "Isiteji asinalutho. Letha ividiyo, ifayela noma umbhalo.",
    ],
    conversation: [
      "Isizinda",
      "Phusha umnyango — kukhona olindele ukukhuluma nawe.",
      "Akekho kuleli limi. Buya emuva kwesikhashana.",
    ],
    store: [
      "Imakethe",
      "Lapha ama-gems akho aba izinto zakho ngempela.",
      "Izitolo azinalutho okwamanje.",
    ],
    achievements: [
      "Udonga Lwezinganekwane",
      "Yonke impumelelo ishiya uphawu kulolu donga.",
      "Akukho mpumelelo okwamanje. Isinyathelo esisodwa udonga lugcwele.",
    ],
    space: [
      "Indawo yakho engcwele",
      "Ikhona yakho: ukubukeka, izilimi, inqubekela phambili.",
      "Indawo yakho engcwele isenalutho. Yenze ibe ngeyakho.",
    ],
    leaderboard: [
      "Inkundla",
      "Lapha kulingwa umzamo weviki.",
      "Inkundla inalutho. Thola amaphuzu ukuze ungene.",
    ],
    history: [
      "Ijenali",
      "Konke okudlulile, ikhasi ngekhasi.",
      "Ijenali ayinalutho. Iseshini yakho yokuqala izobhala umugqa wokuqala.",
    ],
    signs: [
      "Izandla",
      "Amagama asayenzwa ngezandla: bheka, phinda, phinda.",
      "Akukho isigaba lapha okwamanje. Khulisa ukuhlunga.",
    ],
  },
  wo: {
    home: [
      "Barab",
      "Sa bés du ñu tàmbali fii — àddina di wax, yaw di déglu.",
      "Sa barab bi nekk na lu kese. Tànn ab làkk te dellu.",
    ],
    atlas: [
      "Kart",
      "Bépp kàddu ab màk bi ci kartu àddina.",
      "Amul dara fii. Jéemaat bene wàll walla yaatal sa filtar.",
    ],
    shadow: [
      "Néeg wàll",
      "Pàste ko: làmp yi di tal, kàddu yi di dox.",
      "Néeg wàll bi nekk na lu kese. Indil video, fichier walla bind.",
    ],
    conversation: [
      "Kër",
      "Puuch bunt bi — am na kenn bi di xaar si sa tàmbali.",
      "Amul kenn ci làkk bii. Dellusi ci ginnaaw.",
    ],
    store: [
      "Marché",
      "Fii, sa gems di génne mbir yu ñu la.",
      "Taabal yi nekk na lu kese leegi.",
    ],
    achievements: [
      "Miirum Tànk",
      "Bépp tàmbali daan si miirum bii.",
      "Amul tàmbali. Benn jot ci tànk bi.",
    ],
    space: [
      "Sa kër bu sell",
      "Sa kóok: sam doole, sa làkk, sa tàmbali.",
      "Sa kër bu sell bi nekk na lu kese. Def ko sa mbir.",
    ],
    leaderboard: [
      "Èttu",
      "Fii dañ koy miir tàmbali yu ayu-bés bi.",
      "Èttu bi nekk na lu kese. Jot point ngir bokk.",
    ],
    history: [
      "Kayitu",
      "Bépp lu la jaar, xët ci xët.",
      "Kayitu bi weex na. Sa première session daan na xaaj bi ci wàll.",
    ],
    signs: [
      "Lii",
      "Ligéey bi doy ci seen: xool, diopp, diopp.",
      "Teyir tey ko nekkul. Losaan li kër.",
    ],
  },
};

/**
 * Overlay des lieux pour une langue — fusionné par-dessus le dictionnaire
 * de base au chargement (voir applyDictionaryOverlays dans i18n.tsx).
 */
export function getPlacesCopy(lang: string): unknown | undefined {
  const places = PLACES[lang];
  if (!places) return undefined;
  const out: Record<string, { kicker: string; ambiance: string; empty: string }> = {};
  for (const [key, [kicker, ambiance, empty]] of Object.entries(places)) {
    out[key] = { kicker, ambiance, empty };
  }
  return { places: out };
}
