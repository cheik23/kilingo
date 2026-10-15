// PHASE 3 — LOT 2/7 : ENRICHISSEMENT THAÏ (th) — +50 expressions, 2010-2026+.
//
// ⚠️ ARITHMÉTIQUE DU TITRE DE COMMANDE : « 62 → 200 » avec un lot de 50 —
// ce lot porte le thaï à 112 fiches ; atteindre 200 suppose ~88 fiches de
// plus dans les lots suivants de la Phase 3 (non couverts ici). Même avertissement
// que `slangSeedEnrichmentHi2.ts` (lot hindi de la même phase).
//
// SOURCES (toutes ouvertes et relues — les exemples sont ceux des sources,
// jamais fabriqués ; une page sans exemple thaï est notée comme telle) :
//   • ThaiPod101, « Our Guide to Thai Internet & Text Slang » (liste 2018)
//     https://www.thaipod101.com/blog/2019/07/23/thai-text-slang/
//   • Learn Thai with Mod, « Top 10 Popular Thai Slang Words and Phrases of
//     Year 2021 »
//     https://learnthaiwithmod.com/2020/12/video-top-10-popular-thai-slang-words-and-phrases-of-year-2021/
//   • Learn Thai with Mod, « Dictionary of New Words » (projet Royal Institute,
//     éd. 4, article 2014)
//     https://learnthaiwithmod.com/2014/06/update-new-thai-slang-in-dictionary-of-new-words/
//   • Preply, « Thai slang essentials: 30 phrases » (guide 2026)
//     https://preply.com/en/blog/thai-slang/
//   • Time Out Bangkok, « Gen Z Thai slang: 8 words you'll hear in Bangkok
//     right now »
//     https://www.timeout.com/bangkok/things-to-do/gen-z-thai-slang
//
// 404 / non ouvrables (et donc JAMAIS cités) : Time Out « Thai slang words
// you need to know » (404 — l'article Time Out ci-dessus est celui qui a
// été lu à la place), ThaiPod101 « thai-slang-words » 2018 (introuvable),
// CIEE « Top 10 Thai slang words » (page non exploitable).
//
// DÉDUPLICATION : les 62 fiches th existantes ne sont pas reprises (12 du
// Lot 3 — สบายดี, ไม่เป็นไร, อร่อย, สนุก, ใจเย็นๆ, ขอบคุณ, ครับ/ค่ะ, ใจดี,
// ฝรั่ง, ไฮโซ, อร่อยมาก, สวย — et 50 de `slangSeedEnrichmentTh.ts`).
// Piège de slug vérifié à la main : le pliage `[^\p{L}\p{N}]` remplace les
// signes de ton et voyelles combinés thaïs par un espace, donc « ปัง »
// (ป + ั + ง) aurait EXACTEMENT le slug de « ปิ๊ง » déjà en base (ป + ิ๊ + ง
// → « ป ง ») : ปัง est écarté du lot, tout comme อิอิ (slug « อ อ », collision
// avec อ๋อ). `npm run verify:seeds` tranche sur le reste (exit 1 au moindre
// slug en double).
//
// `validated` reste ABSENT : le badge « non relu » ne s'applique qu'aux
// langues marquées am/ig (voir le commentaire du champ dans slangSeed.ts).
//
// NON INTÉGRÉS (collisions, doublons ou candidats faibles — 105 candidats
// sourcés relevés, 50 retenus) :
//   • collisions de slug confirmées : ปัง (mêmes lettres que ปิ๊ง déjà en
//     base une fois les signes de ton remplacés par un espace), อิอิ (même
//     pliage que อ๋อ) ;
//   • doublons sémantiques : ชิล (variante de ชิว), จัดหนัก/จัดใหญ่/
//     จัดแน่น (frères de จัดเต็ม), แบบจุกๆ (porte déjà จุก), ป่าว
//     (frère de ป่ะ), เฮ้ย ;
//   • candidats faibles ou hors cible : เล้าหลือ, ยอมใจ, โนเวย์เสตชั่น,
//     มีหัวไว้คั่นหู, ขนแขนแสตนอั้ป, เดี๊ยะ, เซียะ, จอย, อินดี้,
//     เบา ๆ, ว้าวซ่า, เจ็บจี๊ด, จุ๊บจุ๊บ, ดึงดาว, พีค, แบ๊ว, เหวอ,
//     หมดแก้ว, ตังค์หมด, สวัสดีเว้ย, จัดให้, มันดีมาก, นึกออกป่ะ,
//     จิง, เหน, เสด, คับ, พิม, เด่ว, ซิส, นาง, ชี, ผู้, สาย, สาย.ฝ,
//     งงไปอีก, ถามใจดู, ตะมุตะมิ ;
//   • reportés à un lot ultérieur : หลัว (concurrent direct de ขุ่นแม่/
//     ตัวแม่ dans la même famille « pronoms du cœur »).
import type { SlangSeed } from "./slangSeed";

export const SLANG_SEED_ENRICHMENT_TH2: SlangSeed[] = [
  // ─── Thaïlande des réseaux — couples, cœur, refus (ThaiPod101) ──────────
  {
    language: "th",
    expression: "คู่จิ้น",
    literal: "(littéral non donné dans la source)",
    meaning: "couple imaginaire dont on rêve (le « ship »)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'นักแสดงชายและนักแสดงหญิงคู่นั้นเป็นคู่จิ้นคู่ใหม่' - deux comédiens auxquels le fandom souhaite une vraie histoire ; cœur de la culture BL et T-Pop]",
    register: "internet",
    region: "Thaïlande",
    popularity: 86,
  },
  {
    language: "th",
    expression: "กิ๊ก",
    literal: "(littéral non donné dans la source)",
    meaning: "plus qu'une amie mais pas une copine : une histoire à côté",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'เขาเจ้าชู้มาก มีกิ๊กทั่วบ้านทั่วเมือง' - relation secondaire qui n'est ni amie ni petite amie]",
    register: "casual",
    region: "Thaïlande",
    popularity: 76,
  },
  {
    language: "th",
    expression: "นก",
    literal: "oiseau",
    meaning: "se faire larguer, être refusé (amour non rendu)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'น้ำเป็นคนสวย แต่นกตลอด' - « être niché » : le rendez-vous ne vient jamais, platane des réseaux thaïs]",
    register: "internet",
    region: "Thaïlande",
    popularity: 84,
  },
  {
    language: "th",
    expression: "เท",
    literal: "verser",
    meaning: "larguer, plaquer (quelqu'un)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'แนทเพิ่งโดนเทมา' - la source rattache le mot à « เททิ้ง » (verser et jeter)]",
    register: "casual",
    region: "Thaïlande",
    popularity: 82,
  },
  {
    language: "th",
    expression: "เผือก",
    literal: "igname",
    meaning: "être curieux, se mêler des affaires des autres",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'เขาชอบเผือกเรื่องชาวบ้านสุด ๆ' - orthographe adoucie d'un mot grossier, reste familier mais supportable en ligne]",
    register: "casual",
    region: "Thaïlande",
    popularity: 74,
  },
  {
    language: "th",
    expression: "ขิง",
    literal: "gingembre",
    meaning: "se vanter, faire le malin",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'นางช่างขิงได้ทุกเรื่อง' - la source rattache le mot au calembour « ซุยขี้ขิง »]",
    register: "internet",
    region: "Thaïlande",
    popularity: 74,
  },
  {
    language: "th",
    expression: "อวย",
    literal: "donner (sens vieilli)",
    meaning: "louer excessivement quelqu'un",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อย่าอวยนางให้มากไป' - éloges survoltés, typiques entre fans]",
    register: "internet",
    region: "Thaïlande",
    popularity: 76,
  },
  {
    language: "th",
    expression: "โป๊ะแตก",
    literal: "soupe de fruits de mer épicée",
    meaning: "le secret est dévoilé",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'หมิงโป๊ะแตก โดนจับได้ว่าทำศัลยกรรม' - image du panier de pêche qui se renverse : la vérité se répand, presque toujours un mauvais secret]",
    register: "internet",
    region: "Thaïlande",
    popularity: 86,
  },
  {
    language: "th",
    expression: "มองแรง",
    literal: "regarder fort",
    meaning: "dévisager avec colère, lancette du regard",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'แก้มโกรธอะไรแนนเหรอ มองแนนแรงเชียว' - le regard qui dit tout sans un mot]",
    register: "casual",
    region: "Thaïlande",
    popularity: 72,
  },
  {
    language: "th",
    expression: "แอ๊บ",
    literal: "(littéral non donné dans la source)",
    meaning: "faire semblant, jouer la comédie",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อย่ามาแอ๊บหน่อยเลย' - lié à แอ๊บแบ็ว, « faire le mignon »]",
    register: "casual",
    region: "Thaïlande",
    popularity: 76,
  },
  {
    language: "th",
    expression: "นอยด์",
    literal: "(de « noid » dans « paranoid »)",
    meaning: "s'angoisser, trop réfléchir",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'จะนอยด์ไปทำไม ไม่มีอะไรซักหน่อย' - l'anxiété anticipée, très employé par les jeunes]",
    register: "internet",
    region: "Thaïlande",
    popularity: 78,
  },
  {
    language: "th",
    expression: "มโน",
    literal: "esprit (sens religieux d'origine)",
    meaning: "imaginer, rêver éveillé",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อย่ามโน เค้าไม่ได้ชอบแกซักหน่อย' - se faire des films sur quelqu'un]",
    register: "casual",
    region: "Thaïlande",
    popularity: 82,
  },
  {
    language: "th",
    expression: "ลำไย",
    literal: "longan",
    meaning: "agaçant, pénible",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อย่าลำไย' - le fruit sucré devenu synonyme de personne reloue ; origine discutée selon la source]",
    register: "casual",
    region: "Thaïlande",
    popularity: 76,
  },
  {
    language: "th",
    expression: "เกาเหลา",
    literal: "soupe de nouilles sans nouilles",
    meaning: "ne pas s'entendre",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'เอกับบีเกาเหลากัน' - expliqué par « ไม่กินเส้น » (ne pas manger de nouilles) : ne pas s'accorder]",
    register: "casual",
    region: "Thaïlande",
    popularity: 68,
  },
  {
    language: "th",
    expression: "หัวร้อน",
    literal: "tête chaude",
    meaning: "colérique, qui chauffe vite",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'ทอมเป็นคนหัวร้อน' - calque de l'anglais « hot-headed », très courant dans le gaming]",
    register: "casual",
    region: "Thaïlande",
    popularity: 80,
  },

  // ─── Look, adulation, classe (ThaiPod101) ──────────────────────────────
  {
    language: "th",
    expression: "ตั้ลล๊าก",
    literal: "(littéral non donné — la source le rattache à « น่ารัก »)",
    meaning: "mignon, adorable",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: pas d'exemple thaï dans la source - déformation affectueuse de น่ารัก, explosée en ligne]",
    register: "internet",
    region: "Thaïlande",
    popularity: 74,
  },
  {
    language: "th",
    expression: "ชิว",
    literal: "(de l'anglais « chill out »)",
    meaning: "détendu, poser",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'เย็นนี้มานั่งชิวกัน' - ce soir on se pose, sans pression]",
    register: "casual",
    region: "Thaïlande",
    popularity: 78,
  },
  {
    language: "th",
    expression: "งานดี",
    literal: "bon travail",
    meaning: "bien fichu, beau/belle",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'ผู้ชายคนนั้นงานดีมาก' - louange passe-partout : qualité, plats, personnes]",
    register: "internet",
    region: "Thaïlande",
    popularity: 80,
  },
  {
    language: "th",
    expression: "แซ่บ",
    literal: "épicé, délicieux",
    meaning: "sexy, canon",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'ผู้หญิงคนนั้นหุ่นแซ่บมาก' - du piment à la plastique : même mot pour les deux]",
    register: "casual",
    region: "Thaïlande",
    popularity: 86,
  },
  {
    language: "th",
    expression: "เกรียน",
    literal: "très court (les cheveux)",
    meaning: "insupportable, provocateur (troll)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'เด็กนั่นเกรียนมาก' - la source le rattache aux élèves aux cheveux courts et à l'agressivité en ligne]",
    register: "street",
    region: "Thaïlande",
    popularity: 72,
  },
  {
    language: "th",
    expression: "เทพ",
    literal: "dieu",
    meaning: "excellent, d'un niveau divin",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'ตั้มเล่นบอลอย่างเทพ' - qualifier quelqu'un de « เทพ », c'est le haut du panier]",
    register: "internet",
    region: "Thaïlande",
    popularity: 84,
  },
  {
    language: "th",
    expression: "โลกสวย",
    literal: "monde beau",
    meaning: "naïf-optimiste (souvent péjoratif)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อย่ามาโลกสวย' - « ne me fais pas ton idéaliste » : cynisme urbain]",
    register: "casual",
    region: "Thaïlande",
    popularity: 72,
  },
  {
    language: "th",
    expression: "ตัวแม่",
    literal: "mère",
    meaning: "la meilleure de son domaine, la daronne",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'แอมเป็นตัวแม่ด้านแฟชั่น' - le titre de celui ou celle qui règne sur un terrain]",
    register: "internet",
    region: "Thaïlande",
    popularity: 78,
  },
  {
    language: "th",
    expression: "แม่ก็คือแม่",
    literal: "la mère c'est la mère",
    meaning: "la mère reste la mère : irréfutable",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'แม่ก็คือแม่ ลูกเกดถ่ายแบบได้ปังมาก' - réservé aux stars établies (la source cite Patcharapa et Metinee)]",
    register: "internet",
    region: "Thaïlande",
    popularity: 80,
  },
  {
    language: "th",
    expression: "ดีต่อใจ",
    literal: "bon pour le cœur",
    meaning: "ça fait du bien",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'หนังเรื่องนี้ดีต่อใจ' - pour tout ce qui réconforte : film, plat, attention]",
    register: "casual",
    region: "Thaïlande",
    popularity: 78,
  },
  {
    language: "th",
    expression: "ที่แท้ทรู",
    literal: "(jeu de mots avec l'anglais « true »)",
    meaning: "vraiment, pour de vrai",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อาหารจานนี้เป็นของดีที่แท้ทรู' - remplace จริง par un « true » espiègle]",
    register: "internet",
    region: "Thaïlande",
    popularity: 72,
  },
  {
    language: "th",
    expression: "เอาที่สบายใจ",
    literal: "prendre ce qui met à l'aise",
    meaning: "comme tu voudras (souvent sarcastique)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'จะไปก็ไป เอาที่สบายใจเลย' - la source insiste : le ton décide si c'est sincère ou ironique]",
    register: "casual",
    region: "Thaïlande",
    popularity: 76,
  },

  // ─── Orthographes mignonnes — le « baby talk » des ados (ThaiPod101) ───
  {
    language: "th",
    expression: "จุงเบย",
    literal: "(probable faute de frappe devenue mignonne)",
    meaning: "intensifieur mignon plaqué après un adjectif",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: la source donne la forme réelle « แพงจังเลย » - les ados écrivent จุงเบย pour sonner plus doux]",
    register: "internet",
    region: "Thaïlande",
    popularity: 70,
  },
  {
    language: "th",
    expression: "ตะเอง",
    literal: "(de « ตัวเอง »)",
    meaning: "toi (affectueux, contraction mignonne)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'ตะเองอยากกินอันนั้นมั่ย' - prononciation déformée par les ados pour sonner tendre]",
    register: "internet",
    region: "Thaïlande",
    popularity: 70,
  },
  {
    language: "th",
    expression: "อัลไล",
    literal: "(prononciation déformée de « อะไร »)",
    meaning: "quoi ? (mignon)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อัลไลอยู่ในกล่อง' - les ados rallongent la voyelle pour adoucir la question]",
    register: "internet",
    region: "Thaïlande",
    popularity: 72,
  },
  {
    language: "th",
    expression: "ฝุดฝุด",
    literal: "(prononciation déformée)",
    meaning: "intensifieur mignon après un adjectif",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'แพงฝุดฝุด' - « cher à mort » façon adorable]",
    register: "internet",
    region: "Thaïlande",
    popularity: 66,
  },
  {
    language: "th",
    expression: "ชิมิ",
    literal: "(de « ใช่มั๊ย »)",
    meaning: "c'est bien ça, non ?",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'อันนี้กินได้ชิมิ' - le « right? » mignon des textos thaïs]",
    register: "internet",
    region: "Thaïlande",
    popularity: 76,
  },
  {
    language: "th",
    expression: "จร้า",
    literal: "brillant (sens du mot non déformé)",
    meaning: "particule finale douce et décontractée",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'เธอเอาอันนี้ไปกินได้จร้า' - orthographe rallongée pour adoucir la phrase]",
    register: "casual",
    region: "Thaïlande",
    popularity: 72,
  },
  {
    language: "th",
    expression: "บุย",
    literal: "(de « บาย », anglais « bye »)",
    meaning: "au revoir (mignon)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'ไปแล้วนะ บุย' - le bye rewrité en voyelle thaïe mignonne]",
    register: "internet",
    region: "Thaïlande",
    popularity: 66,
  },
  {
    language: "th",
    expression: "นาจา",
    literal: "(voyelles détournées)",
    meaning: "particule finale qui adoucit une affirmation",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'แอบมองเธออยู่นาจา' - l'affirmation sonne comme une confidence]",
    register: "internet",
    region: "Thaïlande",
    popularity: 74,
  },
  {
    language: "th",
    expression: "ขุ่นแม่",
    literal: "mère (déformation de « คุณแม่ »)",
    meaning: "icône admirée, la reine",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'คอนเสิร์ตของขุ่นแม่ปังมาก' - de แม่ et ตัวแม่ : la star qu'on vénère, souvent une chanteuse ou une actrice]",
    register: "internet",
    region: "Thaïlande",
    popularity: 78,
  },
  {
    language: "th",
    expression: "555",
    literal: "5 (ห้า = cinq) frappé trois fois",
    meaning: "hahaha (rire)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'มุกเมื่อกี้ตลกมาก 555' - le « 5 » thaï se lit « ha » : trois 5 = trois rires, plus rapide à taper que ฮ่า ๆ ๆ]",
    register: "internet",
    region: "Monde thaïphone",
    popularity: 94,
  },
  {
    language: "th",
    expression: "ป่ะ",
    literal: "(abréviation de « รึเปล่า »)",
    meaning: "…, non ? (question relâchée)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (ThaiPod101)] | [Ex: 'ไปเที่ยวกันป่ะ' - contraction parlée et écrite de รึเปล่า ; la source groupe ป่ะ et ป่าว ensemble]",
    register: "casual",
    region: "Thaïlande",
    popularity: 82,
  },

  // ─── Top 10 de l'année 2021 (Learn Thai with Mod) ──────────────────────
  {
    language: "th",
    expression: "จริงดิ",
    literal: "(littéral non donné dans la source)",
    meaning: "sérieux ? (c'est vrai ?)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Learn Thai with Mod)] | [Ex: 'B: จริงดิ' - présent dans le Top 10 des expressions populaires 2021 de la source]",
    register: "internet",
    region: "Thaïlande",
    popularity: 88,
  },
  {
    language: "th",
    expression: "ไม่พูดเยอะ เจ็บคอ",
    literal: "ne parle pas trop ; la gorge fait mal",
    meaning: "c'est évident, inutile d'en dire plus",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Learn Thai with Mod)] | [Ex: 'ไม่พูดเยอะ เจ็บคอ' - Top 10 2021 : l'évidence ne se commente pas]",
    register: "casual",
    region: "Thaïlande",
    popularity: 82,
  },
  {
    language: "th",
    expression: "เป็นอะไรมากป่ะ",
    literal: "avoir quelque chose de grave, non ?",
    meaning: "y a quoi qui ne va pas, toi ?",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Learn Thai with Mod)] | [Ex: 'เป็นอะไรมากป่ะ' - Top 10 2021 : réplique face à un comportement incompréhensible]",
    register: "casual",
    region: "Thaïlande",
    popularity: 80,
  },
  {
    language: "th",
    expression: "อย่าหาทำ",
    literal: "ne va pas chercher à faire",
    meaning: "ne tente même pas, ce n'est pas la peine",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Learn Thai with Mod)] | [Ex: 'อย่าหาทำ' - Top 10 2021 : claque sec sur une idée jugée absurde]",
    register: "internet",
    region: "Thaïlande",
    popularity: 86,
  },

  // ─── Nouveaux mots officiels — Dictionary of New Words, éd. 4 (2014) ───
  {
    language: "th",
    expression: "จัดเต็ม",
    literal: "(famille « จัด… », littéral non donné dans la source)",
    meaning: "tout donner, y aller à fond",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Presse (Learn Thai with Mod / Royal Institute)] | [Ex: pas d'exemple thaï dans la source - la source le range avec จัดหนัก, จัดใหญ่ et จัดแน่น : même idée d'effort maximal]",
    register: "casual",
    region: "Thaïlande",
    popularity: 82,
  },
  {
    language: "th",
    expression: "แต๊งกิ้วหลาย",
    literal: "(transcription joyeuse de l'anglais « thank you »)",
    meaning: "merci beaucoup",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Presse (Learn Thai with Mod / Royal Institute)] | [Ex: pas d'exemple thaï dans la source - retenue par le projet de dictionnaire des nouveaux mots en 2014]",
    register: "casual",
    region: "Thaïlande",
    popularity: 70,
  },
  {
    language: "th",
    expression: "เม้าธ์มอย",
    literal: "(de l'anglais « mouth »)",
    meaning: "bavarder, potiner",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Presse (Learn Thai with Mod / Royal Institute)] | [Ex: pas d'exemple thaï dans la source - terme retenu pour le dictionnaire des nouveaux mots, éd. 4]",
    register: "casual",
    region: "Thaïlande",
    popularity: 78,
  },
  {
    language: "th",
    expression: "ชัวร์ป้าบ",
    literal: "« ชัวร์ » de l'anglais « sure » + renfort",
    meaning: "sûr à 100 %, sûr et certain",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Presse (Learn Thai with Mod / Royal Institute)] | [Ex: pas d'exemple thaï dans la source - la source note que ชัวร์ est un emprunt à l'anglais]",
    register: "casual",
    region: "Thaïlande",
    popularity: 74,
  },
  {
    language: "th",
    expression: "งามไส้",
    literal: "(littéral non donné dans la source)",
    meaning: "quelle honte, quelle plaisanterie",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Presse (Learn Thai with Mod / Royal Institute)] | [Ex: 'งามไส้มั้ยหล่ะ เค้าอยู่ประเทศไทยมา 10 ปีแล้วแต่ยังพูดภาษาไทยไม่ได้' - ironie auto-mockeuse]",
    register: "casual",
    region: "Thaïlande",
    popularity: 74,
  },

  // ─── Guide de slang 2026 (Preply) + Gen Z de Bangkok (Time Out) ────────
  {
    language: "th",
    expression: "จุก",
    literal: "(littéral non donné dans la source)",
    meaning: "sans voix, bouleversé (de surprise ou d'émotion)",
    context:
      "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Usage (Preply)] | [Ex: pas d'exemple thaï dans la source - se dit d'un moment qui coupe le souffle : scène de série, morceau, révélation]",
    register: "internet",
    region: "Thaïlande",
    popularity: 82,
  },
  {
    language: "th",
    expression: "ติ่ง",
    literal: "(littéral non donné dans la source)",
    meaning: "fan hardcore, fan absolu",
    context:
      "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Usage (Preply)] | [Ex: pas d'exemple thaï dans la source - le fan-club thaïlandais, mot clé du fandom K-Pop/T-Pop et des séries BL]",
    register: "internet",
    region: "Thaïlande",
    popularity: 88,
  },
  {
    language: "th",
    expression: "แกง",
    literal: "curry",
    meaning: "piquer, faire une blague à quelqu'un (le « manger »)",
    context:
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Presse (Time Out Bangkok)] | [Ex: pas d'exemple thaï dans la source (l'exemple de l'article est en anglais) - argot Gen Z entendu à Bangkok « right now » : quelqu'un de berné par une fausse info est « ถูกแกง »]",
    register: "internet",
    region: "Bangkok",
    popularity: 84,
  },
];
