import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════════
   LOT THAÏ — fiches d'enrichissement (Lot 2)

   Objectif : enrichir le thaï de 12 → ~62 expressions en ajoutant 50
   expressions couvrant l'argot contemporain, la culture internet et le
   langage quotidien. Déduplication (slug-based) vis-à-vis des 12
   existantes (slangSeedLot3.ts) et entre candidats : le slangSlug ne
   retire pas les signes de ton du thaï (hors plage NFD \u0300), mais
   les signes de ton du thaï (combining marks) sont remplacés par un
   espace au pliage [^p{L}p{N}] : deux mots ne différant que par le ton
   partagent donc le même slug (เจ๋ง = เจ๊ง) — séparer par la forme.
   ═══════════════════════════════════════════════════════════════════════ */

export const SLANG_SEED_ENRICHMENT_TH: SlangSeed[] = [
  { language: "th", expression: "เบื่อ", literal: "« lasé, blasé »", meaning: "ennui, saoulé (aussi : déçu d'une situation)", context: "« เบื่อมากเลย » — je n'en peux vraiment plus.", register: "casual", region: "Thaïlande", popularity: 88 },
  { language: "th", expression: "เอาเลย", literal: "« get it » (impératif)", meaning: "fonce, on y va !", context: "« เอาเลย, ยิ้งยิ้งยิ้ง » — on y va, tous ensemble !", register: "casual", region: "Thaïlande", popularity: 84 },
  { language: "th", expression: "ขำ", literal: "« rire » (forma onomatopéique)", meaning: "ça fait rire, c'est drôle", context: "« ขำโคตรๆ » — trop drôle de ouf !", register: "casual", region: "Thaïlande", popularity: 82 },
  { language: "th", expression: "ฮา", literal: "onomatopée du rire (« hahaha »)", meaning: "hilarant, tout drôle", context: "« ฮาหนักโคตร » — j'ai explosé de rire (mème du net).", register: "internet", region: "Thaïlande", popularity: 86 },
  { language: "th", expression: "หรอ", literal: "« çà ? » particule interrogative", meaning: "ah ouais ? (rétorquer avec ironie)", context: "« หรอก เดี๋ยวพิสูจน์ให้ดู » — oh ouais ? je te prouve ça tout de suite.", register: "casual", region: "Thaïlande", popularity: 82 },
  { language: "th", expression: "อ้าว", literal: "interjection de surprise", meaning: "huh ? vraiment ?", context: "« อ้าว เดี๋ยวก่อน » — attendez, quoi ?", register: "casual", region: "Thaïlande", popularity: 88 },
  { language: "th", expression: "โหด", literal: "« sauvage, féroce »", meaning: "de fou, balèze (musique, performance)", context: "« สวยโหด » — la beauté féroce, trop classe.", register: "casual", region: "Thaïlande", popularity: 84 },
  { language: "th", expression: "เจ๋ง", literal: "« cool » (argot rétro mais toujours là)", meaning: "classe, génial", context: "« เจ๋งแว้ว » — trop classe ! (régent, rétro héritage des années 90).", register: "casual", region: "Thaïlande", popularity: 82 },
  { language: "th", expression: "เจ๊งแล้ว", literal: "« effondré, fauché » แล้ว (déjà)", meaning: "cassé, en faillite, percé (c'est déjà fichu)", context: "« เจ๊งแล้วไปเลย » — je suis déjà fauché, tant pis.", register: "casual", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "เวิ่นเว้อ", literal: "« vague, vague de balivernes »", meaning: "à la campa (parler à revanche)", context: "« เวิ่นเว้อกันตลอด » — ils parlent à revanche tout le temps.", register: "casual", region: "Thaïlande", popularity: 72 },
  { language: "th", expression: "เริ่ด", literal: "« frappant, manifestant »", meaning: "casserolesque, fulgurante", context: "« เริ่ดมากกกก » — trop fulgurant !!", register: "casual", region: "Thaïlande", popularity: 78 },
  { language: "th", expression: "เวอร์", literal: "de l'anglais « over » ? (de l'ordre du « ver »)", meaning: "exagéré, trop de mise en scène", context: "« เวอร์ไปเลยเวรกรรม » — ç'en est trop laid.", register: "casual", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "โสด", literal: "« célibataire »", meaning: "célibataire (souvent auto-moqué)", context: "« โสดสุดปุ๋ย » — célibataire à vie (auto-depreciation).", register: "casual", region: "Thaïlande", popularity: 82 },
  { language: "th", expression: "ฟิน", literal: "de l'anglais « feeliz? » (satisfait)", meaning: "aux anges, comblé", context: "« ฟินขั้นเทพ » — comblé au niveau dieu.", register: "internet", region: "Thaïlande", popularity: 84 },
  { language: "th", expression: "ไฟดับ", literal: "« panne de courant »", meaning: "tout s'écroule, cloué au sol", context: "« ไฟดับหนักเลย » — efondrement total, j'ai plus un watt.", register: "internet", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "อลังการ", literal: "« spectaculaire »", meaning: "impressionnant, à couper le souffle", context: "« น่าอลังการ » — qu'est-ce que c'est spectaculaire !", register: "casual", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "หมั่นไส้", literal: "origine discutée (dialectal)", meaning: "agaçant, qui frappe à cœur ouvert", context: "« หมั่นไส้มากเลย » — quel agaçant !", register: "casual", region: "Thaïlande", popularity: 78 },
  { language: "th", expression: "เจ็บ", literal: "« ça fait mal »", meaning: "ça pique (moral ou physique)", context: "« เจ็บเลยเดี๋ยวหยุดเจ็บเอง » — ça pique, ça s'arrangera tout seul.", register: "casual", region: "Thaïlande", popularity: 78 },
  { language: "th", expression: "แตก", literal: "« éclaté, explosé »", meaning: "chamboulé, cassé après un choc affectif", context: "« แตกเลยคนนี้ » — c'est cassé, il/elle est comme figé(e).", register: "casual", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "กาว", literal: "« colle »", meaning: "collant, plaqué à quelqu'un", context: "« กาวมาแปลปล่อนอีกแล้ว » — il/elle s'est encore collé(e).", register: "internet", region: "Thaïlande", popularity: 78 },
  { language: "th", expression: "เลิศ", literal: "« excellent »", meaning: "excellent, top du top", context: "« เลิศมากปูเลี้ยง? » — top de chez top !", register: "casual", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "บึ้งตุ๊บป่อง", literal: "onomatopée de la colère d'eau douce bloquée (bueng-tueb-pong)", meaning: "boudeur, de mauvaise pop", context: "« บึ้งตุ๊บป่องไปมา » — la boude enragée continue.", register: "internet", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "ขาดใจ", literal: "« hors souffle »", meaning: "hors d'haleine, ahuri", context: "« ขาดใจไปคนเดียว » — j'en perds le souffle tout seul.", register: "casual", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "หมดใจ", literal: "« cœur vidé »", meaning: "âme gravéement ou prise (plus de cœur)", context: "« หมดใจกะเขาไปแล้ว » — mon cœur s'est éteint pour lui/elle.", register: "casual", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "เมาท์", literal: "de l'anglais « mouth »", meaning: "brandir la langue (enseignement/attaque verbale)", context: "« เมาท์กันนักหนา » — se lancer des piques.", register: "internet", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "เมิน", literal: "du « เมินทูนมักมาก » (ignorer ostensiblement)", meaning: "faire mine de rien, prétendre ne pas voir", context: "« เมินตูน – » — il/elle fait mine de t'ignorer.", register: "internet", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "ห่วย", literal: "origine argotiqueฏ discutée", meaning: "minable, de basse qualité", context: "« ห่วยแฮปเป้นักหนา » — quel minable tel qu'il est.", register: "street", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "ห่วยแตก", literal: "« minable au sens périmé »", meaning: "pourri du cul, la bête noire", context: "« ห่วยแตกโคตร » — pourri de chez pourri !", register: "street", region: "Thaïlande", popularity: 78 },
  { language: "th", expression: "วาสนา", literal: "sanskrit « vasnā » (destin)", meaning: "que-limers, maigre part", context: "« โคตรวาสนา » — quel destin au mauvais dé !", register: "casual", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "แนม", literal: "du dialectal « แนม »", meaning: "se retrouver vitefait / du rapide", context: "« แนมนะเนี่ย » — on reste ensemble, là ?", register: "internet", region: "Thaïlande", popularity: 72 },
  { language: "th", expression: "อื้อฉาว", literal: "« scandalement bruyant »", meaning: "scandale popping, fait surface", context: "« อื้อฉาวอินเทร็ด » — quel scandale sur Instagram !", register: "internet", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "โหงวเฮ้ง", literal: "du teochew « hiang ia » (parade)", meaning: "se mettre en scène ostensiblement", context: "« โหงวเฮ้งกันป่วนนักหนา » — ils se mettent en scène entre eux.", register: "internet", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "โลเล", literal: "sens largement apprové en Thaïlande", meaning: "peu importe, laisse couler", context: "« โลเลได้เลย » — laisse couler, pas grave.", register: "internet", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "กาก", literal: "« déchets » (en germes « กาก »)", meaning: "nul, raté, sans valeur", context: "« กากไอเดีย » — idée nulle, trolle.", register: "casual", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "นัดบอด", literal: "« ตกลง เห็น » rendez-vous + « บอด » coupe", meaning: "rencontre ciblée (blind date)", context: "« นัดบอดกันคืนนี้ » — rendez-vous tonêt ce soir.", register: "casual", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "จีบ", literal: "« flirt »", meaning: "draguer, appâter", context: "« จีบสาวโคตรเจ๊ง » — il flirte avec les filles.", register: "casual", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "ป่วน", literal: "« perturbant, dérangeant »", meaning: "chahuteur, tourbillon", context: "« ป่วนปั่นหนัก » — tourbillon de chahut.", register: "casual", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "เถิดเตี้ย", literal: "onomatopée du claquement maladroit", meaning: "maladroit, qui bricole et trébuche", context: "« เถิดเตี้ยมากเลย » — on est vraiment maladroit à ce point !", register: "casual", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "กรู", literal: "variante de « กู » (je)", meaning: "je / moi (pronom vulgare de première personne)", context: "« กรูไม่รู้เอง » — je ne le sais moi-même pas.", register: "vulgar", region: "Thaïlande", popularity: 70 },
  { language: "th", expression: "อ๋อ", literal: "« a-ha » interjection d'acquisition", meaning: "ah, j'ai compris !", context: "« อ๋อ ทำไมไม่บอกตั้งแต่ต้น » — ah, tu savais tout le temps ?", register: "casual", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "กู / มึง", literal: "« je / tu » (pronons vulgaires, à l'origine sanskrit)", meaning: "moi / toi (prognostic vulgaires, entre potes)", context: "« หวังดี กูแต่ใจ? มึงไม่รู้หรือ » — je te dis pourtant, tu vois ?", register: "vulgar", region: "Monde thaï", popularity: 88 },
  { language: "th", expression: "เฟี้ยว", literal: "« flashy »", meaning: "toute étonnante, élégante, éclatante", context: "« แต่งตัวเฟี้ยวดี » — le look est éclatant.", register: "casual", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "ปลื้ม", literal: "« submergé de tendresse »", meaning: "craquer, fantasmé de quelqu'un", context: "« ปลื้มเลยเขา » — j'ai craqué pour lui.", register: "casual", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "ยี้", literal: "« nausée »", meaning: "cringe, ne pas en pouvoir plus", context: "« ยี้จนหมดความรัง? » — cringe au meme dé ?", register: "internet", region: "Thaïlande", popularity: 76 },
  { language: "th", expression: "เก๋า", literal: "de « เก่า » (âgé)", meaning: "vétéran, vieux kraken, celui qui sait tout", context: "« เก๋าเกี้ยวเฮง » — il est trop « vétéran ».", register: "casual", region: "Thaïlande", popularity: 72 },
  { language: "th", expression: "เสือก", literal: "de « ลอบ » (s'infiltrer)", meaning: "s'inviter dans une conversation qui ne nous concerne pas", context: "« เสือกคุยกับคนอื่น » — il s'invite sans y être convié.", register: "casual", region: "Thaïlande", popularity: 72 },
  { language: "th", expression: "ปิ๊ง", literal: "onomatopée de « ding » du cloche", meaning: "éclair de génie, idée qui sort", context: "« ปิ๊งโคตรปิ๊งมโหฬาร » — idea géniale !", register: "internet", region: "Thaïlande", popularity: 74 },
  { language: "th", expression: "เผิ่ย", literal: "dérivée de « เหนื่อย » (fatigué)", meaning: "cramé, épuisé (mot des jeunes)", context: "« เหนื่อยเหรอ? เผิ่ยเจ็บนัก » — tu es vraiment fatigué(e) ?", register: "internet", region: "Thaïlande", popularity: 78 },
  { language: "th", expression: "ตูมตาย", literal: "« ตูม » (gros) + « ตาย » (mourir)", meaning: "énorme, sans limite", context: "« เห็นไอเดียตูมตาย » — l'idée énorme là, à gogo !", register: "internet", region: "Thaïlande", popularity: 80 },
  { language: "th", expression: "กรุ้งกริ๊ง", literal: "onomatopée « clinq-cloing »", meaning: "éclatant, brillant (mode, paillettes)", context: "« กรุ้งกริ๊งดีแล้ว » — look brillant, ça claque !", register: "casual", region: "Thaïlande", popularity: 72 },
];
