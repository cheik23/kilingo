import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════
   BATCH LOT 3 — 108 expressions (Phase 2)

   9 langues, 108 lignes, aucune duplication avec les batches existants :
   • 12 hi (hindi — Delhi, Bombay, Hinglish) ;
   • 12 bn (bengali — Dhaka, Kolkata) ;
   • 12 ur (ourdou — Karachi, Lahore) ;
   • 12 id (indonésien — Jakarta, bahasa gaul) ;
   • 12 th (thaï — Bangkok, argot de campus) ;
   • 12 vi (vietnamien — Hanoï, Saigon) ;
   • 12 fa (persan — Téhéran, Kaboul, Douchanbé) ;
   • 12 tl (tagalog — Manille, Taglish) ;
   • 12 el (grec — Athènes, Chypre).

   Garanties, comme les batchs précédents :
   • écritures non latines EN PREMIER, romanisation entre parenthèses —
     même convention que le lot coréen/japonais (« 안녕 (annyeong) ») et le
     lot chinois (« 牛逼 (niúbī) »). `slangSlug` replie la parenthèse finale,
     donc « यार (yaar) » et « यार » partagent une identité ;
   • registres rabattus sur le vocabulaire du seed : « courant » et
     « familier » → casual ; « argot jeune » → street quand il vit à l'oral
     (बकचोदी, gokil, phê, eyval…), internet quand il est né des réseaux
     (कलेश sur X/Twitter, baper et mager sur les messageries) ;
   • régions en texte libre normalisées par REGION_ALIASES (languages.ts) :
     Inde → in, Bangladesh → bd, Pakistan → pk, Indonésie → id,
     Thaïlande → th, Việt Nam → vn, Iran → ir, Philippines → ph,
     Grèce → gr. Chaque langue garde UNE région principale, comme les lots
     précédents (« Allemagne (Berlin) » plutôt qu'une liste) ;
   • déduplication automatique par slug côté slang:seed (aucun risque de
     collision : ces 9 codes n'existaient dans aucun batch précédent).

   Effet attendu au prochain build : les badges « Bientôt » de hi, bn, ur,
   id, th, vi, fa, tl, el disparaissent d'eux-mêmes (dérivation
   `vite.config.ts` → `contentLanguages`, et `ALL_LANGS` côté backend, sur
   ce même tableau). 19 + 9 = 28 langues servies.
   ═══════════════════════════════════════════════════════════════════ */

// Remarque de déduplication (2026-10-15, câblage agrégat) : fiches retirées
// en doublon slug — premier déclarant conservé : ur:scene on hai, ur:boss, tl:chika.

export const SLANG_SEED_LOT3: SlangSeed[] = [
  // ════════════ HINDI (hi) — Delhi, Bombay, Hinglish — 12 ════════════
  { language: "hi", expression: "यार (yaar)", literal: "« compagnon » (du persan/ourdou « yār »)", meaning: "pote, mec", context: "« Arre yaar, kya haal hai? » — l'appellatif du copain, de Delhi à Bombay.", register: "casual", region: "Inde", popularity: 88 },
  { language: "hi", expression: "भाई (bhai)", literal: "« frère »", meaning: "frère ; mec (terme d'adresse universel)", context: "« Bhai, ek chai dena » — frérot, sors-moi un thé.", register: "casual", region: "Inde", popularity: 90 },
  { language: "hi", expression: "मस्त (mast)", literal: "« enivré, grisé » à l'origine", meaning: "génial, cool", context: "« Movie mast thi! » — le film était top.", register: "casual", region: "Inde", popularity: 86 },
  { language: "hi", expression: "जुगाड़ (jugaad)", literal: "« assemblage ingénieux » — le système D", meaning: "système D, débrouille (mot culturel fort)", context: "« Jugaad se kaam ho gaya » — ça s'est fait à la débrouille.", register: "casual", region: "Inde", popularity: 84 },
  { language: "hi", expression: "चलो (chalo)", literal: "impératif de « chalna », marcher", meaning: "allez, on y va", context: "« Chalo, der ho rahi hai » — allez, on est en retard.", register: "casual", region: "Inde", popularity: 88 },
  { language: "hi", expression: "क्या बात है (kya baat hai)", literal: "« quelle chose est-ce »", meaning: "bravo, wow (approbation chaleureuse)", context: "« Kya baat hai, jeet gaye! » — bravo, ils ont gagné !", register: "casual", region: "Inde", popularity: 82 },
  { language: "hi", expression: "बकचोदी (bakchodi)", literal: "de « bak » (bavardage) + injure — vulgaire à l'origine", meaning: "conneries, n'importe quoi", context: "« Yeh bakchodi band karo » — arrêtez vos conneries ; très courant chez les jeunes.", register: "street", region: "Inde", popularity: 74 },
  { language: "hi", expression: "Scene kya hai?", literal: "anglicisme « scene » + hindi", meaning: "c'est quoi le plan ?", context: "« Aaj raat scene kya hai? » — on fait quoi ce soir ?", register: "street", region: "Inde", popularity: 72 },
  { language: "hi", expression: "पता नहीं (pata nahi)", literal: "« pata » (adresse, trace) + négation", meaning: "j'en sais rien", context: "« Pata nahi, kab aayega » — aucune idée de quand il arrive.", register: "casual", region: "Inde", popularity: 86 },
  { language: "hi", expression: "बिंदास (bindass)", literal: "« sans entrave » (bindaas, du marathi)", meaning: "sans souci, cool", context: "« Bindass life jee raha hai » — il vit sans se prendre la tête.", register: "casual", region: "Inde", popularity: 76 },
  { language: "hi", expression: "कलेश (kalesh)", literal: "sanskrit « kleśa » — tourment, querelle", meaning: "dispute, clash (souvent en ligne)", context: "« Twitter pe kalesh ho gaya » — ça a clashé sur Twitter.", register: "internet", region: "Inde", popularity: 70 },
  { language: "hi", expression: "घंटा (ghanta)", literal: "« cloche » — euphémisme d'une injure", meaning: "rien du tout, que dalle", context: "« Ghanta mila kuch » — il n'a rien eu, que dalle.", register: "street", region: "Inde", popularity: 68 },

  // ════════════ BENGALI (bn) — Dhaka, Kolkata, adda — 12 ════════════
  { language: "bn", expression: "কি অবস্থা (ki obostha)", literal: "« quelle situation ? »", meaning: "comment ça va ?", context: "« Ki obostha bhai? » — alors frérot, quoi de neuf ?", register: "casual", region: "Bangladesh", popularity: 84 },
  { language: "bn", expression: "ভাই (bhai)", literal: "« frère »", meaning: "frère (terme d'adresse)", context: "« Bhai, shahajjo korun » — frère, un coup de main.", register: "casual", region: "Bangladesh", popularity: 88 },
  { language: "bn", expression: "দোস্ত (dost)", literal: "du persan « dost », ami", meaning: "pote, ami", context: "« Amar dost, chol ghure ashi » — mon pote, on va faire un tour.", register: "casual", region: "Bangladesh", popularity: 80 },
  { language: "bn", expression: "মস্তি (masti)", literal: "de « mast », enjoué", meaning: "fun, déconne", context: "« Bondhuder shathe masti » — la déconne entre potes.", register: "casual", region: "Bangladesh", popularity: 78 },
  { language: "bn", expression: "শালা (shala)", literal: "« beau-frère » — injure légère entre proches", meaning: "salaud (affectueux entre amis)", context: "« Shala, ki korchos? » — eh, qu'est-ce que tu fabriques ?", register: "street", region: "Bangladesh", popularity: 72 },
  { language: "bn", expression: "চল (chol)", literal: "impératif de « chôla », marcher", meaning: "allez, viens", context: "« Chol, bazar e jai » — allez, on va au marché.", register: "casual", region: "Bangladesh", popularity: 82 },
  { language: "bn", expression: "ভালো (bhalo)", literal: "« bon, bien »", meaning: "bien, bon", context: "« Eta bhalo idea » — c'est une bonne idée.", register: "casual", region: "Bangladesh", popularity: 86 },
  { language: "bn", expression: "পাগল (pagol)", literal: "« fou » (du sanskrit « pāgala »)", meaning: "fou (souvent affectueux)", context: "« Tui ekdom pagol! » — t'es complètement cinglé !", register: "casual", region: "Bangladesh", popularity: 76 },
  { language: "bn", expression: "ধাক্কা খাওয়া (dhakka khaowa)", literal: "« recevoir un coup » (dhakka, poussée)", meaning: "être choqué, tomber des nues", context: "« Khobor shune dhakka khelam » — j'ai été choqué en apprenant la nouvelle.", register: "casual", region: "Bangladesh", popularity: 70 },
  { language: "bn", expression: "Chill koro", literal: "anglicisme « chill » + « koro », fais", meaning: "détends-toi", context: "« Eto tension koros keno? Chill koro » — pourquoi tant de stress ? Détends-toi.", register: "street", region: "Bangladesh", popularity: 74 },
  { language: "bn", expression: "আড্ডা (adda)", literal: "« réunion informelle » (mot culturel)", meaning: "discussion entre amis, papotage", context: "« Bikale adda hobe » — on se retrouve pour refaire le monde cet après-midi.", register: "casual", region: "Bangladesh", popularity: 84 },
  { language: "bn", expression: "ঝোল (jhol)", literal: "« bouillon, sauce » — sens figuré d'embrouille", meaning: "problème, embrouille", context: "« Kono jhol nai » — il n'y a aucun souci.", register: "casual", region: "Bangladesh", popularity: 72 },

  // ════════════ OURDOU (ur) — Karachi, Lahore, Urdish — 12 ════════════
  { language: "ur", expression: "یار (yaar)", literal: "« compagnon » (persan « yār »)", meaning: "pote", context: "« Yaar, kya haal hai? » — alors pote, quoi de neuf ?", register: "casual", region: "Pakistan", popularity: 88 },
  { language: "ur", expression: "بھائی (bhai)", literal: "« frère »", meaning: "frère (terme d'adresse)", context: "« Bhai, madad karo » — frère, aide-moi.", register: "casual", region: "Pakistan", popularity: 88 },
  { language: "ur", expression: "کیا حال ہے (kya haal hai)", literal: "« quel est ton état ? »", meaning: "comment ça va", context: "« Bhai kya haal hai? » — frérot, comment tu vas ?", register: "casual", region: "Pakistan", popularity: 86 },
  { language: "ur", expression: "زبردست (zabardast)", literal: "du persan « zarb » (coup) + « dast » (main)", meaning: "génial, excellent", context: "« Match zabardast tha! » — le match était génial !", register: "casual", region: "Pakistan", popularity: 84 },
  { language: "ur", expression: "شاباش (shabash)", literal: "du persan « shād bāsh » — sois heureux", meaning: "bravo", context: "« Shabash, achi kaam ki » — bravo, beau travail.", register: "casual", region: "Pakistan", popularity: 80 },
  { language: "ur", expression: "بکواس (bakwas)", literal: "« bavardage » (bak + was)", meaning: "n'importe quoi, foutaises", context: "« Yeh bakwas band karo » — arrête ces âneries.", register: "casual", region: "Pakistan", popularity: 78 },
  { language: "ur", expression: "چلو (chalo)", literal: "impératif de « chalna », marcher", meaning: "allez, on y va", context: "« Chalo, der ho rahi hai » — allez, on est en retard.", register: "casual", region: "Pakistan", popularity: 84 },
  { language: "ur", expression: "پتا نہیں (pata nahi)", literal: "« pata » (trace) + négation", meaning: "j'en sais rien", context: "« Pata nahi, kab tak » — je ne sais pas jusqu'à quand.", register: "casual", region: "Pakistan", popularity: 84 },
  { language: "ur", expression: "جانو (janu)", literal: "de « jaan », l'âme, la vie", meaning: "mon amour (affectueux)", context: "« Janu, khayaal rakhna » — mon cœur, prends soin de toi.", register: "casual", region: "Pakistan", popularity: 76 },
  { language: "ur", expression: "بالکل (bilkul)", literal: "de l'arabe « bil-kull », en tout", meaning: "exactement, tout à fait", context: "« Bilkul sahi kaha » — tu as tout à fait raison.", register: "casual", region: "Pakistan", popularity: 82 },

  // ════════════ INDONÉSIEN (id) — Jakarta, bahasa gaul — 12 ════════════
  { language: "id", expression: "Bro / Sis", literal: "anglicismes « brother » / « sister »", meaning: "frère / sœur (très courant entre amis)", context: "« Bro, udah makan? » — frérot, t'as mangé ?", register: "casual", region: "Indonésie", popularity: 86 },
  { language: "id", expression: "Santai", literal: "« détendu, calme »", meaning: "chill, relax", context: "« Santai aja, gak usah buru-buru » — tranquille, pas besoin de courir.", register: "casual", region: "Indonésie", popularity: 88 },
  { language: "id", expression: "Mantap", literal: "« solide, stable »", meaning: "top, génial", context: "« Makanannya mantap! » — la bouffe est top !", register: "casual", region: "Indonésie", popularity: 86 },
  { language: "id", expression: "Cuy", literal: "variante familière de « coy » (mec)", meaning: "mec, pote", context: "« Gimana cuy? » — alors, quoi de neuf les gars ?", register: "street", region: "Indonésie", popularity: 74 },
  { language: "id", expression: "Woles", literal: "« selow » (de l'anglais « slow ») retourné", meaning: "relax, prends ton temps", context: "« Woles, masih lama » — relax, on a encore le temps.", register: "internet", region: "Indonésie", popularity: 70 },

  // ════════════ THAÏ (th) — Bangkok, argot de campus — 12 ════════════
  { language: "th", expression: "สบายดี (sabai dee)", literal: "« sabai » (bien-être) + « dee » (bon)", meaning: "ça va bien", context: "« Sabai dee mai? » — comment vas-tu ?", register: "casual", region: "Thaïlande", popularity: 88 },
  { language: "th", expression: "ไม่เป็นไร (mai pen rai)", literal: "« ce n'est rien, ça va »", meaning: "pas de souci, ce n'est rien", context: "« Mai pen rai, ok na » — pas de souci, d'accord ?", register: "casual", region: "Thaïlande", popularity: 92 },
  { language: "th", expression: "อร่อย (aroy)", literal: "« savoureux, délicieux »", meaning: "délicieux", context: "« Aroy mak mak! » — c'est super bon !", register: "casual", region: "Thaïlande", popularity: 88 },
  { language: "th", expression: "สนุก (sanuk)", literal: "« agréable, amusant »", meaning: "fun, amusant", context: "« Ngan sanuk di » — la fête est sympa.", register: "casual", region: "Thaïlande", popularity: 84 },
  { language: "th", expression: "ใจเย็นๆ (jai yen yen)", literal: "« cœur froid » — garde ton cœur au frais", meaning: "calme-toi, prends ton temps", context: "« Jai yen yen na » — du calme, respire.", register: "casual", region: "Thaïlande", popularity: 86 },
  { language: "th", expression: "ขอบคุณ (kop khun)", literal: "« merci » (remercier les bienfaits)", meaning: "merci", context: "« Kop khun mak mak » — merci beaucoup.", register: "casual", region: "Thaïlande", popularity: 90 },
  { language: "th", expression: "ครับ/ค่ะ (krup / ka)", literal: "particules de politesse (masculin / féminin)", meaning: "particule de politesse (à la fin de chaque phrase)", context: "« Kop khun krup » — merci (dit par un homme).", register: "casual", region: "Thaïlande", popularity: 90 },
  { language: "th", expression: "ใจดี (jai dee)", literal: "« cœur bon »", meaning: "gentil, bienveillant", context: "« Khun jai dee mak » — tu es très gentil.", register: "casual", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "ฝรั่ง (farang)", literal: "« français » (à l'origine) — tout Occidental", meaning: "étranger occidental", context: "« Farang mai kao jai » — l'Occidental ne comprend pas ; mot passe-partout, jamais neutre.", register: "casual", region: "Thaïlande", popularity: 78 },
  { language: "th", expression: "ไฮโซ (hi-so)", literal: "de l'anglais « high society »", meaning: "chic, haute société", context: "« Raan hi-so mak » — le restaurant fait très huppé.", register: "street", region: "Thaïlande", popularity: 68 },
  { language: "th", expression: "อร่อยมาก (aroy mak)", literal: "« aroy » (délicieux) + « mak » (beaucoup)", meaning: "vraiment délicieux", context: "« Tom yum aroy mak! » — le tom yum, c'est une tuerie !", register: "casual", region: "Thaïlande", popularity: 82 },
  { language: "th", expression: "สวย (suay)", literal: "« beau, belle »", meaning: "beau, belle", context: "« Suay mak » — c'est magnifique.", register: "casual", region: "Thaïlande", popularity: 84 },

  // ════════════ VIETNAMIEN (vi) — Hanoï, Saigon, tiếng lóng — 12 ════════════
  { language: "vi", expression: "Êm", literal: "« doux, calme »", meaning: "cool, tranquille", context: "« Hôm nay êm quá » — aujourd'hui c'est trop tranquille.", register: "casual", region: "Việt Nam", popularity: 76 },
  { language: "vi", expression: "Ổn", literal: "« stable, en ordre »", meaning: "ça va, d'accord", context: "« Ổn rồi, đi thôi » — c'est bon, on y va.", register: "casual", region: "Việt Nam", popularity: 82 },
  { language: "vi", expression: "Vui quá", literal: "« vui » (joyeux) + « quá » (trop)", meaning: "trop fun", context: "« Bữa nay vui quá! » — aujourd'hui, c'était trop bien !", register: "casual", region: "Việt Nam", popularity: 80 },
  { language: "vi", expression: "Chán", literal: "« lassé, blasé »", meaning: "ennuyeux, saoulant", context: "« Chán quá trời » — c'est carrément barbant.", register: "casual", region: "Việt Nam", popularity: 78 },
  { language: "vi", expression: "Ghê", literal: "« effrayant » — devenu intensificateur", meaning: "wow, impressionnant", context: "« Ghê thật! » — ça, c'est balèze !", register: "casual", region: "Việt Nam", popularity: 76 },
  { language: "vi", expression: "Nhậu", literal: "« boire ensemble » (de « tửu », alcool)", meaning: "boire un coup entre amis", context: "« Tối nay đi nhậu nhé? » — on va boire un coup ce soir ?", register: "casual", region: "Việt Nam", popularity: 82 },
  { language: "vi", expression: "Phê", literal: "« défoncé, planant »", meaning: "éclaté, trop bon", context: "« Phê quá! » — c'est trop bon !", register: "street", region: "Việt Nam", popularity: 74 },
  { language: "vi", expression: "Bá đạo", literal: "« bá » (tyran) + « đạo » (voie) — le maître de la voie", meaning: "incroyable, trop fort", context: "« Thằng đó bá đạo ghê » — ce mec est vraiment balèze.", register: "street", region: "Việt Nam", popularity: 72 },
  { language: "vi", expression: "Đi", literal: "« aller » (verbe)", meaning: "allez, viens", context: "« Đi ăn đi » — allez, on va manger.", register: "casual", region: "Việt Nam", popularity: 84 },
  { language: "vi", expression: "Trời ơi", literal: "« ciel » + « ô » — ô ciel !", meaning: "oh mon dieu (exclamation)", context: "« Trời ơi, thật sao? » — oh là là, c'est vrai ?", register: "casual", region: "Việt Nam", popularity: 86 },
  { language: "vi", expression: "Xịn", literal: "« raffiné, de qualité »", meaning: "premium, de qualité", context: "« Xe xịn quá! » — la bagnole est trop classe !", register: "casual", region: "Việt Nam", popularity: 74 },
  { language: "vi", expression: "Né", literal: "« aller » (impératif familier entre jeunes)", meaning: "vas-y, on se bouge", context: "« Né đi cà phê đi » — allez, on va au café.", register: "street", region: "Việt Nam", popularity: 66 },

  // ════════════ PERSAN (fa) — Téhéran, Kaboul, Douchanbé — 12 ════════════
  { language: "fa", expression: "دمت گرم (damet garm)", literal: "« que ton souffle reste chaud »", meaning: "bravo à toi, merci (chaleureux)", context: "« Damet garm, komak kardi » — bravo à toi, tu m'as aidé.", register: "casual", region: "Iran", popularity: 86 },
  { language: "fa", expression: "خسته نباشی (khaste nabashi)", literal: "« ne sois pas fatigué »", meaning: "bon courage (formule universelle)", context: "« Khaste nabashi agha » — bon courage, monsieur ; se dit à qui vient de travailler.", register: "casual", region: "Iran", popularity: 90 },
  { language: "fa", expression: "قربانت (ghorbanet)", literal: "« je me sacrifie pour toi »", meaning: "avec plaisir, je t'en prie", context: "« Ghorbanet, khahesh mikonam » — je t'en prie, avec plaisir.", register: "casual", region: "Iran", popularity: 84 },
  { language: "fa", expression: "بابا (baba)", literal: "« papa » — devenu interjection", meaning: "mec (familier), bonhomme", context: "« Baba, koja budi? » — mec, t'étais où ?", register: "casual", region: "Iran", popularity: 82 },
  { language: "fa", expression: "ایول (eyval)", literal: "« bravo » (emprunt à l'arabe) — argot des jeunes", meaning: "cool, excellent", context: "« Eyval, kar kardi! » — bien joué, tu l'as fait !", register: "street", region: "Iran", popularity: 78 },
  { language: "fa", expression: "بیا (bia)", literal: "impératif de « âmadan », venir", meaning: "viens", context: "« Bia inja » — viens ici.", register: "casual", region: "Iran", popularity: 84 },
  { language: "fa", expression: "عجیب (ajib)", literal: "de l'arabe « ʿajīb », étrange", meaning: "bizarre, étrange", context: "« Che ajib! » — c'est bizarre !", register: "casual", region: "Iran", popularity: 80 },
  { language: "fa", expression: "قشنگ (ghashang)", literal: "« beau, joli »", meaning: "beau, joli", context: "« Che ghashang! » — que c'est beau !", register: "casual", region: "Iran", popularity: 82 },
  { language: "fa", expression: "چطوری (chetori)", literal: "contraction de « che tour-i », comment es-tu", meaning: "comment vas-tu", context: "« Salam, chetori? » — salut, comment tu vas ?", register: "casual", region: "Iran", popularity: 86 },
  { language: "fa", expression: "مخلص (mokhles)", literal: "« dévoué, sincère »", meaning: "salut, l'ami (affectueux, entre hommes surtout)", context: "« Mokhlesim dada » — on est dévoués, frérot.", register: "street", region: "Iran", popularity: 72 },
  { language: "fa", expression: "به به (bah bah)", literal: "onomatopée d'admiration", meaning: "wow, magnifique", context: "« Bah bah, che khoshgel! » — waouh, que c'est joli !", register: "casual", region: "Iran", popularity: 82 },
  { language: "fa", expression: "داداش (dadash)", literal: "diminutif de « dada », frère", meaning: "frangin, pote", context: "« Dadash, chetori? » — frangin, comment tu vas ?", register: "casual", region: "Iran", popularity: 80 },

  // ════════════ TAGALOG (tl) — Manille, Taglish, argot inversé — 12 ════════════
  { language: "tl", expression: "Kumusta", literal: "de l'espagnol « ¿cómo está? »", meaning: "comment ça va", context: "« Kumusta ka na? » — comment vas-tu ?", register: "casual", region: "Philippines", popularity: 88 },
  { language: "tl", expression: "Pare / Mars", literal: "« pare » (compère) / « mars » (de « kumare », commère)", meaning: "pote (masculin)", context: "« Pare, tara na! » — frérot, on y va !", register: "casual", region: "Philippines", popularity: 84 },
  { language: "tl", expression: "Astig", literal: "verlan de « tigas » (dureté)", meaning: "cool, stylé", context: "« Ang astig ng bagong sapatos mo! » — tes nouvelles pompes sont stylées !", register: "street", region: "Philippines", popularity: 80 },
  { language: "tl", expression: "G", literal: "initiale de l'anglais « game »", meaning: "partant, chaud pour", context: "« G ka ba sa outing? » — tu es chaud pour la sortie ?", register: "street", region: "Philippines", popularity: 76 },
  { language: "tl", expression: "Petmalu", literal: "inversion de « malupit » (féroce)", meaning: "incroyable, hors norme", context: "« Petmalu talaga siya! » — il est vraiment incroyable !", register: "street", region: "Philippines", popularity: 74 },
  { language: "tl", expression: "Werpa", literal: "inversion de l'anglais « power »", meaning: "puissance, force", context: "« Ang werpa mo naman! » — quelle force, toi !", register: "street", region: "Philippines", popularity: 72 },
  { language: "tl", expression: "Lodi", literal: "inversion de « idol »", meaning: "idole (admiration)", context: "« Lodi kita! » — tu es mon idole !", register: "street", region: "Philippines", popularity: 74 },
  { language: "tl", expression: "Ganap", literal: "« ce qui se déroule » (verbe « maganap »)", meaning: "l'événement, ce qui se passe", context: "« Ano ang ganap ngayon? » — c'est quoi le programme aujourd'hui ?", register: "casual", region: "Philippines", popularity: 72 },
  { language: "tl", expression: "Charot", literal: "onomatopée de blague — à l'origine « charing »", meaning: "je plaisante, c'est une blague", context: "« Charot lang yun! » — je déconnais !", register: "casual", region: "Philippines", popularity: 78 },
  { language: "tl", expression: "Sus", literal: "abréviation de « Hesus » (exclamation)", meaning: "oh là là (exaspération)", context: "« Sus, ang arte mo! » — oh là là, qu'est-ce que tu es difficile !", register: "casual", region: "Philippines", popularity: 74 },
  { language: "tl", expression: "Salamat", literal: "de l'arabe « salāmāt », salutations", meaning: "merci", context: "« Salamat ha! » — merci hein !", register: "casual", region: "Philippines", popularity: 88 },

  // ════════════ GREC (el) — Athènes, Chypre, kafeneio — 12 ════════════
  { language: "el", expression: "ρε (re)", literal: "vocatif familier, du byzantin « more »", meaning: "eh mec (interpellation)", context: "« Re, ti kaneis? » — eh, comment tu vas ?", register: "casual", region: "Grèce", popularity: 84 },
  { language: "el", expression: "μαλάκα (malaka)", literal: "« mou » (à l'origine masturbateur) — mot tabou", meaning: "connard (affectueux entre amis proches)", context: "« Ela re malaka! » — viens, espèce de con ! ; entre potes, c'est presque un bonjour.", register: "street", region: "Grèce", popularity: 82 },
  { language: "el", expression: "έλα (ela)", literal: "impératif de « erchomai », viens", meaning: "viens / allo (au téléphone)", context: "« Ela, pou eisai? » — allo, t'es où ?", register: "casual", region: "Grèce", popularity: 86 },
  { language: "el", expression: "εντάξει (entaxei)", literal: "« en ordre, bien rangé »", meaning: "OK, ça va", context: "« Entaxei, tha ertho » — d'accord, je viendrai.", register: "casual", region: "Grèce", popularity: 90 },
  { language: "el", expression: "τι κάνεις (ti kaneis)", literal: "« que fais-tu ? »", meaning: "comment vas-tu", context: "« Geia sou, ti kaneis? » — salut, comment tu vas ?", register: "casual", region: "Grèce", popularity: 86 },
  { language: "el", expression: "όπα (opa)", literal: "exclamation (aussi le cri du danseur de sirtaki)", meaning: "exclamation de joie : hop !", context: "« Opa, keros na ghorapsoume! » — hop, on va boire un coup !", register: "casual", region: "Grèce", popularity: 84 },
  { language: "el", expression: "καλησπέρα (kalispera)", literal: "« bon après-midi / bonsoir »", meaning: "bonsoir", context: "« Kalispera se olous » — bonsoir à tous.", register: "casual", region: "Grèce", popularity: 88 },
  { language: "el", expression: "φίλη (fili)", literal: "« amie » (au masculin « filos »)", meaning: "ami(e)", context: "« Ela fili mou » — viens, mon ami(e).", register: "casual", region: "Grèce", popularity: 76 },
  { language: "el", expression: "τέλειος (telios)", literal: "« parfait, achevé »", meaning: "parfait", context: "« Telios, pame! » — parfait, on y va !", register: "casual", region: "Grèce", popularity: 80 },
  { language: "el", expression: "καλά (kala)", literal: "« bien, bon »", meaning: "bien", context: "« Kala eimai, esy? » — je vais bien, et toi ?", register: "casual", region: "Grèce", popularity: 86 },
  { language: "el", expression: "σιγά (siga)", literal: "« doucement, lentement »", meaning: "doucement, pas si vite", context: "« Siga re, perimene! » — doucement, mec, attends !", register: "casual", region: "Grèce", popularity: 74 },
  { language: "el", expression: "ρε συ (re sy)", literal: "« eh toi » (re + sy, tu)", meaning: "eh toi (interpellation amicale)", context: "« Re sy, ti leei? » — eh, toi, quoi de neuf ?", register: "casual", region: "Grèce", popularity: 78 },
];
