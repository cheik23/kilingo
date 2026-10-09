/* ═══════════════════════════════════════════════════════════════════
   LES MOMENTS D'ENGAGEMENT — COPY DES 12 LANGUES (overlay)

   Module B du lot « conversion ». Trois moments où l'utilisateur vient de
   finir quelque chose (première leçon, avatar créé, streak de 3 jours) : on
   ne propose Premium qu'APRÈS, jamais avant.

   Ce qui est interdit ici, et vérifié par `scripts/verify-upgrade.mjs` :
     · aucun compte à rebours, aucune date d'expiration ;
     · aucune quantité limitée (« plus que X places ») ;
     · aucun vocabulaire de perte (« tu perds », « tu vas rater ») ;
     · un seul bouton, jamais deux poids visuels pareils ;
     · le message décrit un GAIN concret, pas une menace.

   Contrat : `getUpgradeCopy(lang)` renvoie `{ upgrade: {…} }` ou
   `undefined`, fusionné par-dessus les dictionnaires de base (voir
   i18n.tsx → applyDictionaryOverlays).

   Clés consommées par components/learner/UpgradeMoment.tsx — aucune
   invention ailleurs.
   ═══════════════════════════════════════════════════════════════════ */

type UpgradeCopy = {
  /** Étiquette au-dessus du titre. */
  badge: string;
  /** Bouton unique du moment. */
  cta: string;
  /** Fermeture du moment (elle est définitive, pas « plus tard »). */
  dismiss: string;
  /** Rappel honnête : aucun paiement n'est branché, on ne peut pas débiter. */
  note: string;
  /** Une entrée par moment, dans l'ordre de déclenchement. */
  moments: {
    /** Première leçon terminée. */
    firstLesson: string;
    /** Avatar créé ou changé. */
    avatar: string;
    /** Trois jours d'affilée. */
    streak3: string;
  };
};

const UPGRADE: Record<string, UpgradeCopy> = {
  fr: {
    badge: "Tu viens de faire un vrai pas",
    cta: "Voir ce que Premium débloque",
    dismiss: "Masquer ce rappel",
    note:
      "Ce bouton ne débite rien : il t'emmène à la page des tarifs. Le paiement se fait ensuite sur la page de Lemon Squeezy, où tu vois le prix et la date du premier prélèvement avant de valider.",
    moments: {
      firstLesson:
        "Ta première leçon est derrière toi. Premium enlève le plafond du shadowing et ouvre les 11 langues du catalogue, pas seulement 3.",
      avatar:
        "Ton avatar est en place. Premium ajoute l'export Anki / CSV en un clic et les 8 personnages IA au choix.",
      streak3:
        "Trois jours d'affilée. Premium garde ton streak hors de l'équation : tu practiques quand tu veux, sans compteur qui te presse.",
    },
  },
  en: {
    badge: "You just took a real step",
    cta: "See what Premium unlocks",
    dismiss: "Hide this reminder",
    note:
      "This button charges nothing: it takes you to the pricing page. Payment then happens on the Lemon Squeezy page, where you see the price and the first charge date before you confirm.",
    moments: {
      firstLesson:
        "Your first lesson is done. Premium lifts the shadowing limit and opens all 11 catalogue languages, not just 3.",
      avatar:
        "Your avatar is set. Premium adds one-click Anki / CSV export and all 8 AI characters to pick from.",
      streak3:
        "Three days in a row. Premium takes the streak out of the equation: practise when you want, with no counter rushing you.",
    },
  },
  es: {
    badge: "Acabas de dar un paso real",
    cta: "Ver qué desbloquea Premium",
    dismiss: "Ocultar este recordatorio",
    note:
      "Este botón no cobra nada: te lleva a la página de precios. El pago se hace después en la página de Lemon Squeezy, donde ves el precio y la fecha del primer cobro antes de confirmar.",
    moments: {
      firstLesson:
        "Tu primera lección ya está hecha. Premium quita el límite del shadowing y abre los 11 idiomas del catálogo, no solo 3.",
      avatar:
        "Tu avatar está listo. Premium añade la exportación Anki / CSV en un clic y los 8 personajes IA a elegir.",
      streak3:
        "Tres días seguidos. Premium saca la racha de la ecuación: practica cuando quieras, sin ningún contador metiéndote prisa.",
    },
  },
  zh: {
    badge: "你刚刚迈出了一步",
    cta: "看看 Premium 能解锁什么",
    dismiss: "隐藏此提醒",
    note:
      "这个按钮不扣款，只把你带到价格页。付款随后在 Lemon Squeezy 的页面完成，你可以在确认前看到价格和首次扣款日期。",
    moments: {
      firstLesson:
        "你的第一节课已经完成。Premium 解除跟读次数上限，并开放目录中全部 11 种语言，而不只是 3 种。",
      avatar:
        "你的头像已就位。Premium 增加一键导出 Anki / CSV，并提供全部 8 个 AI 角色可选。",
      streak3:
        "连续三天。Premium 让连胜不再影响练习：你想什么时候练就什么时候练，没有倒计时催你。",
    },
  },
  ar: {
    badge: "خطوتَ للتو خطوة حقيقية",
    cta: "اكتشف ما يفتحه Premium",
    dismiss: "إخفاء هذا التذكير",
    note:
      "هذا الزر لا يخصم شيئًا: ينقلك إلى صفحة الأسعار. يتم الدفع بعد ذلك في صفحة Lemon Squeezy، حيث ترى السعر وتاريخ أول خصم قبل التأكيد.",
    moments: {
      firstLesson:
        "أنهيت درسك الأول. Premium يرفع حد التكرار الصوتي ويفتح لغات الكتالوج الـ11، لا ثلاثًا فقط.",
      avatar:
        "صورتك جاهزة. Premium يضيف التصدير إلى Anki / CSV بضغطة واحدة، ويفتح الشخصيات الثماني.",
      streak3:
        "ثلاثة أيام متتالية. Premium يخرج السلسلة من المعادلة: تدرّب متى شئت، دون عدّاد يستعجلك.",
    },
  },
  ru: {
    badge: "Ты только что сделал реальный шаг",
    cta: "Посмотреть, что открывает Premium",
    dismiss: "Скрыть напоминание",
    note:
      "Эта кнопка ничего не списывает: она ведёт на страницу цен. Оплата проходит затем на странице Lemon Squeezy, где до подтверждения видно цену и дату первого списания.",
    moments: {
      firstLesson:
        "Первый урок позади. Premium снимает ограничение на повторение и открывает все 11 языков каталога, а не три.",
      avatar:
        "Аватар готов. Premium добавляет экспорт в Anki / CSV в один клик и все 8 ИИ-персонажей на выбор.",
      streak3:
        "Три дня подряд. Premium убирает серию из уравнения: тренируйся когда хочешь, без счётчика, который торопит.",
    },
  },
  sw: {
    badge: "Ulikuwa hatua moja kweli",
    cta: "Angalia Premium inachofungua",
    dismiss: "Ficha hii",
    note:
      "Kitufe hiki hakichakati chochote: kinakuendesha kwenye ukurasa wa bei. Malipo hufanyika kisha kwenye ukurasa wa Lemon Squeezy, ambapo unaona bei na tarehe ya malipo ya kwanza kabla ya kuthibitisha.",
    moments: {
      firstLesson:
        "Somo lako la kwanza limekwisha. Premium huondoa kipimo cha marudio na kufungua lugha zote 11 za katalogi, si tatu tu.",
      avatar:
        "Avatar yako iko tayari. Premium inaongeza uagizaji wa Anki / CSV kwa moja bonye na wahusika wote 8 wa AI.",
      streak3:
        "Siku tatu mfululizo. Premium inaondoa mfululizo kwenye hesabu: jifunze unapotaka, bila kihesabu kukupungusha.",
    },
  },
  ln: {
    badge: "Osali kimbeni moninga ya bosolo",
    cta: "Tala Premium elandini nzete",
    dismiss: "Hidinga memo oyo",
    note:
      "Kituye oyo ekosakisi te: ekotisa yo na peji ya mbongo. Malipo ekotamboma na peji ya Lemon Squeezy, kote oyo yo talebi mbongo mpe banda ya kondimela.",
    moments: {
      firstLesson:
        "Lesson yaoko ya ntoke ya sila. Premium ekabolaka motombo ya shadowing pe ebandela moninga ya maloba oyo esato na ba oyo.",
      avatar:
        "Avatar yaoko ekalaki. Premium ekotisa export Anki / CSV kwa clic 조사unique pe bantu ba AI ba misato.",
      streak3:
        "Mbalaka tato oyo elandani. Premium ekabolaka streak na bolingo: koyekola makoute oyo katelwoyo, komonoka te kombo ya koamba.",
    },
  },
  ha: {
    badge: "Ka yi ɗauki mataki na gaske",
    cta: "Duba abin Premium ke buɗe",
    dismiss: "Rufe wannan sanarwa",
    note:
      "Wannan mabuɗi ba ya kuma kowane: yana kai ka shafiyar farashin. Biyan an ɗauka a gaban a kan shafiyar Lemon Squeezy, kana ka ga kudi da ranar biyan na farko kafin ka tabbatar.",
    moments: {
      firstLesson:
        "Karfafin da farko ya ka an ƙare. Premium ya rage iyakan shadowing kuma ya buɗe dukkanin kalmomin 11, ba 3 kawai.",
      avatar:
        "Hoto ɗinka ka na nan lokacin. Premium ya ƙara fitarwa Anki / CSV da click kuma dukkanin haruffa 8 na AI.",
      streak3:
        "Kwanaki 3 a jere. Premium ya kaɗe adadi daga lissafin: ka koyi duk lokacin da ka yi, ba tare da matakan sau ba.",
    },
  },
  yo: {
    badge: "O ṣe ìṣẹ́ tuntun ti tó dára",
    cta: "Wo ohun tí Premium ń ṣe",
    dismiss: "Pa ìtànúsì yìí",
    note:
      "Tẹ̀lé yìí kò bá gba owó: ó ń ọ̀kọ̀ ìwé àkọ́kọ́ ọfẹ́. Àwọn owó máa bá ṣe lórí ojú-ìwé Lemon Squeezy, níbi tí o bá rí iye àti ọjọ́ ìsanwó akọ́kọ́ ṣáájú ìfẹ́rànṣe.",
    moments: {
      firstLesson:
        "Kọ́ọ̀kan ní gbogbo ìkọ́kọ́ rẹ ti parí. Premium yóo pa àmì ìtọ́kọ̀ sí i, kí o sì gbé 11 èdè kúrò, kìí kan 3 nìkan.",
      avatar:
        "Àvátààrì rẹ ti wà. Premium yóo fi àtúnṣe Anki / CSV ní ẹ̀tàn, kí o sì gbé àwọn eréké AI 8 láti yíyàn.",
      streak3:
        "Ọjọ́ mẹ́ta lẹ́lékan. Premium yóo pa ìlà ọjọ́ kúrò: kọ́ ẹ̀kọ́ ní gbogbo ìgbà tí o fẹ́, láìsí ìṣìṣẹ́jú.",
    },
  },
  zu: {
    badge: "Uthe wena into esaba khona",
    cta: "Bona okuphakemayo oku Premium kuvula",
    dismiss: "Funca lesi sibiko",
    note:
      "Lesi button akusukeli mali: likuthumela ekhasini yamapheshana. Ukukhokha kwenziwa ekhasini ye-Lemon Squeezy, lapho ubona inani nokusuku lokukhokhwa okokuqala ngaphambi kokugcina.",
    moments: {
      firstLesson:
        "Isifundo sakho sokuqala siqediwe. Premium khipha umkhawulo wokupinda futhi ivula zonke izilimi ezingu-11, hhayi ezintathu kuphela.",
      avatar:
        "I-avatar yakho isibekiwe. Premium ingeze ukukhipha i-Anki / CSV ngokuchofoza kanye futhi zonke izinhundlo ezingu-8 ze-AI.",
      streak3:
        "Izinsuku ezingathathu ngaphambili. Premium khipha ukuqhubeka ekubalweni: qeqesha nini noma ungafuna, ngaphandle kokubala.",
    },
  },
  wo: {
    badge: "Dafay wala sa yi mbir tey teg",
    cta: "Gis Premium bu lay teg",
    dismiss: "Falfal bu bés biy",
    note:
      "Bouton bi bi nekkati safari: efi di yóbbu na fees bi. Teggi di di done ci Lemon Squeezy, fo nga yeem nddi te tekkati ndi laye teggi te.",
    moments: {
      firstLesson:
        "Kurs bu bees bu ggis bu pari. Premium di((- sanq yeccatu ngay def tey)) tekk ci yebbu nekk yi 11 bu bees, kìi ci 3 dara.",
      avatar:
        "Avatar bu yës bu dal. Premium bu baara mbirtu Anki / CSV ci click bu bees, tekk ci yoro AI 8.",
      streak3:
        "Bës bu yopp 3 di xool. Premium dë bu is streak naata: def teg ci waati wala ci yëng ci seen wala, tekk bu ngi lay tekkas.",
    },
  },
};

export function getUpgradeCopy(lang: string): unknown | undefined {
  const copy = UPGRADE[lang];
  if (!copy) return undefined;
  return { upgrade: copy };
}

/** Exposé pour `scripts/verify-upgrade.mjs`. */
export const UPGRADE_LANGS = Object.keys(UPGRADE);
export const UPGRADE_MOMENT_KEYS = [
  "firstLesson",
  "avatar",
  "streak3",
] as const;
export type UpgradeMomentKey = (typeof UPGRADE_MOMENT_KEYS)[number];
