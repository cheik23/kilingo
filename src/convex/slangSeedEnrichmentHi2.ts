// PHASE 3 — LOT 1 : ENRICHISSEMENT HINDI (hi) — +50 expressions, 2010-2026+.
//
// ⚠️ ARITHMÉTIQUE DU TITRE DE COMMANDE : « 62 → 200 » avec un lot de 50 —
// ce lot porte le hindi à 112 fiches ; atteindre 200 suppose ~88 fiches de
// plus dans les lots suivants de la Phase 3 (non couverts ici).
//
// CONVENTION (suite de `slangSeedEnrichmentHi.ts`, vague 2) : expressions en
// ROMAN seul, sans parenthèse ; le devanagari donné par certaines sources
// est cité dans le champ `context`. `validated` est volontairement ABSENT :
// le badge graphique ne s'applique qu'aux langues marquées non relues
// (am, ig), pas au hindi.
//
// SOURCES (toutes ouvertes et extraites en entier ou en partie vérifiable —
// les exemples sont ceux des sources, jamais fabriqués) :
//   • Matador Network, « 15 Hindi Slang Phrases You Need to Know »
//     https://matadornetwork.com/read/15-hindi-slang-phrases-need-know/
//   • Matador Network, « 10 Slang Phrases You'll Need to Know Mumbai »
//     https://matadornetwork.com/life/10-slang-phrases-youll-need-know-mumbai/
//   • Indian Lingua Booking, « Hindi Slang and Youth Language »
//     https://www.indianlinguabooking.in/post/hindi-slang-and-youth-language-you-should-know
//   • Preply, « Hindi Slang Guide »
//     https://preply.com/en/blog/hindi-slang-guide/
//   • HindiPod101, « Hindi Text Slang » (2019)
//     https://www.hindipod101.com/blog/2019/07/23/hindi-text-slang/
//   • Intrepid Travel, « How to Sound Like a Local in India »
//     https://www.intrepidtravel.com/adventures/how-to-sound-like-a-local-in-india/
//   • Kaiwa, « Hindi Social Media Language Guide »
//     https://trykaiwa.com/blog/hindi-social-media-language-guide-realistic
//   • The Indian Express, « Apna Time Aayega » (Gully Boy, 2019)
//     https://indianexpress.com/article/entertainment/bollywood/ranveer-singh-gully-boy-song-apna-time-aayega-5537389/
//
// 404 / non ouvrables (et donc JAMAIS cités) : Ling App hindi slang (404),
// FluentU hindi slang (404), Rosetta Stone (404), IWTYAL (redirige),
// Tandem (404), Culture Trip (timeout).
//
// DÉDUPLICATION : 62 fiches hi existantes non reprises (12 du Lot 3 — yaar,
// bhai, mast, jugaad, chalo, kya baat hai, bakchodi, scene kya hai?, pata
// nahi, bindass, kalesh, ghanta — et 50 de la vague 2 : saala, chal na,
// pagal, time pass, faltu, bakwas, chill maaro, chillar, gyaan, bak bak,
// jaan, babu, shona, bhaijaan, desi, bhaad mein, hatt, chugli, chamcha,
// chappal khayega, gandu, rapchik, bol na bhai, sukoon, lafda, siyappa,
// aukat, moj, paltan, gadha, pakka, tapri, gully, dhanda, dadagiri, maal,
// deewana, patao, full-to, fudu, panga, pawri ho rahi hai, moye moye,
// line maarna, dimaag ki dahi, baap re, arey, chal hat, mujhe kya,
// tumse na ho payega).
//
// NON INTÉGRÉS (faibles ou à écarter) : kudii, pataakhaa, chhori (la source
// elle-même signale ces termes comme potentiellement offensants pour les
// femmes), main character energy (routage anglophone pur).
import type { SlangSeed } from "./slangSeed";

export const SLANG_SEED_ENRICHMENT_HI2: SlangSeed[] = [
  // ─── Bases conversationnelles Hinglish (Matador) ────────────────────────
  { language: "hi", expression: "Achcha", literal: "(pas de littéral donné — la source le glose comme « good / I see »)", meaning: "ah, d'accord ; bon ; de l'interrogation à l'approbation selon le ton", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador)] | [Ex: 'Achcha.' en réponse à un conseil — nuance entre l'interrogation et l'approbation selon le ton] ", register: "casual", region: "Inde", popularity: 66 },
  { language: "hi", expression: "Thik hain", literal: "(littéral non donné dans la source)", meaning: "ça va, d'accord", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador)] | [Ex: 'Thik hain, I'll go see your friend' « Ça va, j'irai voir »] ", register: "casual", region: "Inde", popularity: 68 },
  { language: "hi", expression: "Bas", literal: "(littéral non donné dans la source)", meaning: "ça suffit ; c'est tout", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador)] | [Ex: 'Bas, I'm very full.' « Ça suffit, je suis calé »] ", register: "casual", region: "Inde", popularity: 62 },
  { language: "hi", expression: "Chakkar", literal: "vertige", meaning: "la tourmente, l'imbroglio (y compris une liaison compliquée)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador)] | [Ex: 'In what chakkar have I got myself into?' « Dans quel pétrin je me suis mis ? »] ", register: "casual", region: "Inde", popularity: 56 },
  { language: "hi", expression: "Funda", literal: "contraction de « fundamentals »", meaning: "le fond de la théorie, le principe", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador)] | [Ex: courant chez les étudiantes selon la source] ", register: "casual", region: "Inde", popularity: 62 },
  { language: "hi", expression: "Ji", literal: "(littéral non donné — suffixe de respect)", meaning: "« monsieur/madame » affectueux, parfois sarcastique selon l'entité", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador)] | [Ex: 'Is it fine now, ji?' « C'est bon maintenant, monsieur ? »] ", register: "casual", region: "Inde", popularity: 60 },
  { language: "hi", expression: "Chalega", literal: "« ça marchera » (futur de marches)", meaning: "ça fera l'affaire, j'accepte", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador)] | [Ex: 'Haan, chalega' « Oui, ça marchera »] ", register: "casual", region: "Inde", popularity: 66 },
  // ─── Style & sentiment (Indian Lingua Booking) ─────────────────────────
  { language: "hi", expression: "Jhakaas", literal: "(littéral non donné dans la source)", meaning: "superbe, la classe (de Bollywood aux mèmes)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Culture pop (Indian Lingua Booking)] | [Ex: तेरी जैकेट तो झकास है! « Ta veste est top ! »] ", register: "internet", region: "Inde", popularity: 70 },
  { language: "hi", expression: "Tashan", literal: "(littéral non donné dans la source)", meaning: "l'attitude, le style, la prestance", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Culture pop (Indian Lingua Booking)] | [Ex: उसकी वॉक में क्या टशन है! « Quelle allure dans sa marche ! »] ", register: "street", region: "Inde", popularity: 64 },
  { language: "hi", expression: "Tension mat le", literal: "« ne prends pas la tension »", meaning: "pas de stress, ne t'inquiète pas", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Culture pop (Indian Lingua Booking)] | [Ex: तू टेंशन मत ले। « T'inquiète pas ! »] ", register: "casual", region: "Inde", popularity: 72 },
  // ─── Pidées et memes (Preply) ────────────────────────────────────────────
  { language: "hi", expression: "Bawaal", literal: "(littéral non donné dans la source)", meaning: "la mêlée, le trouble ; aussi « excellent » en légende de mème (Preply, sens contextuel)", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Preply)] | [Ex: Exam के बाद मूड: बवाल! « Mood après l'examen : le chaos ! »] ", register: "street", region: "Inde", popularity: 58 },
  { language: "hi", expression: "Dhamal", literal: "(littéral non donné dans la source)", meaning: "la bombe, l'éclate totale", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Preply)] | [Ex: Party में मस्त धमाल था! « Ça détaille en soirée ! »] ", register: "casual", region: "Inde", popularity: 58 },
  { language: "hi", expression: "Waat lag gayi", literal: "(littéral non donné dans la source)", meaning: "on est dans le pétrin, c'est la galère", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Preply)] | [Ex: वाट लग गई — devanagari de la source, sans phrase d'usage citée] ", register: "street", region: "Inde", popularity: 64 },
  { language: "hi", expression: "Kat", literal: "(devanagari कट — « couper »)", meaning: "filer à l'anglaise, casser la conversation", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Usage (Preply, section texto)] | [Ex: la source le place dans un exercice d'association (mot → « leave abruptly »), sans phrase d'usage] ", register: "internet", region: "Inde", popularity: 48 },
  { language: "hi", expression: "Scene tight hai", literal: "(littéral non donné dans la source)", meaning: "la situation est délicate (ou, selon la source, « vraiment cool »)", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Indian Lingua Booking)] | [Ex: सीन टाइट है। « Le plan est serré ! » - la source documente explicitement le double-sens] ", register: "internet", region: "Inde", popularity: 54 },
  // ─── Rue, villes et quotidien (HindiPod101, Intrepid) ──────────────────
  { language: "hi", expression: "Lag gaye", literal: "(littéral non donné dans la source)", meaning: "on est fichus, c'est foutu", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Intrepid, guide « parler local »)] | [Ex: mauvais train sans argent pour l'hôtel — « on est constatés ! »] ", register: "street", region: "Inde", popularity: 58 },
  { language: "hi", expression: "Katta", literal: "« tu t'es fait couper » (littéral selon l'article)", meaning: "vanne dure après un blocage embarrassant", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Culture pop (Intrepid)] | [Ex: 'Katta!' « T'as été grillé ! » - « rooted in love » selon la source] ", register: "street", region: "Inde", popularity: 52 },
  { language: "hi", expression: "Pet phat gaya", literal: "« mon ventre vient d'éclater »", meaning: "je suis repu, je n'en peux plus", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Intrepid)] | [Ex: après un dîner où on vous ressert plusieurs fois] ", register: "casual", region: "Inde", popularity: 56 },
  { language: "hi", expression: "Phod diya", literal: "« il a détruit/dynamité »", meaning: "tu as assuré, tu as tapé un coup", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Intrepid)] | [Ex: 'Phod diya!' « Tu as déchiré ! » - pour une réussite d'examen ou un exploit] ", register: "street", region: "Inde", popularity: 66 },
  { language: "hi", expression: "Chep", literal: "« la personne-collant »", meaning: "le repetitif qui revient trop sur vos câbles", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Intrepid)] | [Ex: décrit comme « overstaying their welcome »] ", register: "street", region: "Inde", popularity: 50 },
  { language: "hi", expression: "Bhains ki aankh", literal: "« l'œil d'un buffle »", meaning: "oh là là ! mon Dieu !", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Intrepid)] | [Ex: « Woah! », « OMG! » selon la source] ", register: "street", region: "Inde", popularity: 54 },
  { language: "hi", expression: "Kaand", literal: "(littéral non donné dans la source)", meaning: "l'affaire problématique, le drame croustillant dont la rumeur court", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Intrepid)] | [Ex: 'I hear there's a kaand over there that we should check out' « Paraît qu'il y a du drame là-bas, allons voir »] ", register: "street", region: "Inde", popularity: 62 },
  { language: "hi", expression: "Zabardast", literal: "(littéral non donné dans la source)", meaning: "redoutable, de la bombe", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: signal des compliments et de l'admiration (« wow / awesome »)] ", register: "street", region: "Inde", popularity: 74 },
  { language: "hi", expression: "Jhand karna", literal: "(littéral non donné dans la source)", meaning: "gâcher un plan", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: तुम ने सारा प्लान झंड कर दिया « Tu as foutu tout le plan en l'air »] ", register: "street", region: "Inde", popularity: 58 },
  { language: "hi", expression: "Goli dena", literal: "(littéral non donné dans la source)", meaning: "ballonner quelqu'un, poser un lapin", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: कल मेरे दोस्त ने मुझे गोली दे दी « Hier, mon pote m'a posé un lapin »] ", register: "street", region: "Inde", popularity: 60 },
  { language: "hi", expression: "Pakau", literal: "(littéral non donné dans la source)", meaning: "assommant, chiant (l'ennuyeux qui fait dormir)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: मूवी बहुत पकाऊ थी « Le film était assommant »] ", register: "street", region: "Inde", popularity: 58 },
  { language: "hi", expression: "Nautanki", literal: "(littéral non donné — la source dit genre-neutre)", meaning: "la vedette-moi, le drame perpétuel", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: रिया पूरी नौटंकी है « Riya est une reine du drame »] ", register: "casual", region: "Inde", popularity: 62 },
  { language: "hi", expression: "Shana", literal: "(devanagari शाणा)", meaning: "le malin, le too-clever, celui qui joue au plus fin", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: बहुत शाणा बनने की कोशिश मत करो « Cherche pas à jouer les malins »] ", register: "street", region: "Inde", popularity: 50 },
  { language: "hi", expression: "Dhakkan", literal: "« couvercle (de l'entête) »", meaning: "le nul, le jambonneau", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: तुम बिल्कुल ढक्कन हो क्या? « Tu es carrément une buse ? » - insulte douce à garder entre amis] ", register: "street", region: "Inde", popularity: 52 },
  { language: "hi", expression: "Farzi baat", literal: "« les platitudes (discours du vent) »", meaning: "bullshit, le garanti-faux, la fiction compilée", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: प्लीज़, तुम फ़र्ज़ी बात मत करो « S'il-te-plaît, pas de ces discours bidons »] ", register: "street", region: "Inde", popularity: 54 },
  { language: "hi", expression: "Mac-mac karna", literal: "(littéral non donné dans la source)", meaning: "arguer sans fin, la dispute continue", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: दुकानदार मच-मच करता जा रहा था « Le revendeur n'arrêtait pas de bavarder »] ", register: "casual", region: "Inde", popularity: 46 },
  { language: "hi", expression: "Locha", literal: "(littéral non donné dans la source)", meaning: "le pépin, quelque chose qui a buté", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: एक लोचा हो गया है « Il s'est produit une pépin »] ", register: "street", region: "Inde", popularity: 54 },
  { language: "hi", expression: "Mauj-masti", literal: "(littéral non donné dans la source)", meaning: "la fête, l'éclate et la rigolade", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (HindiPod101)] | [Ex: équivalent donné pour l'abréviation texto « ToF »] ", register: "casual", region: "Inde", popularity: 56 },
  { language: "hi", expression: "Dhaansu", literal: "(littéral non donné — la source le glose comme « wow / awesome »)", meaning: "stupéfiant, wow", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Usage (HindiPod101)] | [Ex: dans les compliments (धाँसू), sans phrase-exemple de l'article] ", register: "casual", region: "Inde", popularity: 54 },
  { language: "hi", expression: "Lanka lag gayi", literal: "(littéral non donné dans la source — l'article le glose comme l'équivalent de « WSH »)", meaning: "tout part en catastrophe", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Usage (HindiPod101, textos)] | [Ex: aucun dialogue fourni par la source] ", register: "internet", region: "Inde", popularity: 54 },
  // ─── Cricket et pop-support (Kaiwa, COMPOSITIONS d'un guide) ─────────
  { language: "hi", expression: "Sixer maar diya", literal: "« il a tapé un six »", meaning: "tu as assuré, c'était un coup de maître", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Kaiwa)] | [Ex: guide de réseaux sociaux composé sans attestation indépendante - la source glose « Hit a six » = fait quelque chose d'impressionnant] ", register: "internet", region: "Inde", popularity: 58 },
  { language: "hi", expression: "Out ho gaya", literal: "« il est sorti »", meaning: "éliminé, raté", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Kaiwa)] | [Ex: glossé sur la métaphore cricket — « Got out » = failed] ", register: "internet", region: "Inde", popularity: 54 },
  { language: "hi", expression: "Full toss de di", literal: "« il a offert une full toss »", meaning: "il a rendu la chose trop facile", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Kaiwa)] | [Ex: guide-composé « Gave a full toss » = made it easy] ", register: "internet", region: "Inde", popularity: 52 },
  { language: "hi", expression: "Googly daal di", literal: "« il a lancé une googly »", meaning: "tu as surpris quelqu'un (faux-prix piège)", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Kaiwa)] | [Ex: guide-composé « Bowled a googly » = surprised] ", register: "internet", region: "Inde", popularity: 52 },
  { language: "hi", expression: "Popcorn leke baitha hoon", literal: "« je suis assis avec du popcorn »", meaning: "j'suis installé avec le popcorn : je regarde le drame se dérouler", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Réseaux sociaux (Kaiwa — dialogue composé, pas citation réelle)] | [Ex: 'Popcorn leke baitha hoon' « Jme suis équipé popcorn, j'attends le drame »] ", register: "internet", region: "Inde", popularity: 56 },
  { language: "hi", expression: "Sharma ji ka beta vibes", literal: "« vibes du fils Sharma »", meaning: "la comparaison sarcastique avec le fils modèle", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Réseaux sociaux (Kaiwa — dialogues composés)] | [Ex: le cliché du fils parfait reproché à chacun] ", register: "internet", region: "Inde", popularity: 60 },
  { language: "hi", expression: "Apna Time Aayega", literal: "(littéral non donné dans la source)", meaning: "« mon temps viendra » — le mantra de Gully Boy (2019)", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Presse (Indian Express, 2019)] | [Ex: '#ApnaTimeAayega OUT NOW!' (Ranveer Singh) — la source documente l'accroche, pas sa diffusion comme slang courant] ", register: "internet", region: "Inde", popularity: 72 },
  // ─── Communautaire : documentés mais sans phrase-exemple fiable ─────
  { language: "hi", expression: "Fattu", literal: "(devanagari फट्टू ; une incohérence interne de la source montre aussi डरपोक)", meaning: "le mou, le fuyard, le lâche", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Indian Lingua Booking)] | [Ex: la source ne donne pas de phrase d'usage] ", register: "street", region: "Inde", popularity: 52 },
  { language: "hi", expression: "GG", literal: "« good game »", meaning: "bien joué (du vocabulaire gaming)", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Réseaux sociaux (Preply)] | [Ex: aucun exemple fourni ; classification des « raccourcis chat » de la source] ", register: "internet", region: "Inde", popularity: 52 },
  { language: "hi", expression: "Crush", literal: "(littéral non donné — emprunt anglophone)", meaning: "le béguin", context: "[Époque: 2010-2026+] | [Niveau: COMMUNAUTAIRE] | [Source: Culture pop (Preply)] | [Ex: aucun exemple d'usage fourni par la source] ", register: "casual", region: "Inde", popularity: 58 },
  { language: "hi", expression: "First Class", literal: "(littéral non donné dans la source)", meaning: "première-classe ! (réputation exagérée positive de Mumbai)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador, Mumbai)] | [Ex: 'How was the food? First Class!' « C'était de la bombe ! »] ", register: "street", region: "Mumbai", popularity: 58 },
  { language: "hi", expression: "Paandu", literal: "(littéral non donné — la source le relie à Pandu, nom rural de constables)", meaning: "le flic de base (moqueur)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador, Mumbai)] | [Ex: 'I almost got away, but that paandu caught me' « Je me suis presque échappé, mais un paandu m'a attrapé »] ", register: "street", region: "Mumbai", popularity: 54 },
  { language: "hi", expression: "Dal roti", literal: "« lentilles et pain »", meaning: "le gagne-pain (équivalent de « bread and butter »)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador, Mumbai)] | [Ex: 'If you don't get a good job how will you earn your dal roti?' « Comment tu vivras ? »] ", register: "casual", region: "Mumbai", popularity: 52 },
  { language: "hi", expression: "Beedu", literal: "(littéral non donné dans la source)", meaning: "frérot (version bombaysienne)", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador, Mumbai)] | [Ex: 'Chal beedu, ek sutta nikal ke de' « Allez frérot, sort-moi une clope »] ", register: "street", region: "Mumbai", popularity: 56 },
  { language: "hi", expression: "Satkela", literal: "(littéral non donné dans la source)", meaning: "le gars qui a perdu la tête", context: "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Usage (Matador, Mumbai)] | [Ex: 'That old man is completely satkela' « Ce vieux prof a complètement pété un câble »] ", register: "street", region: "Mumbai", popularity: 46 },
];
