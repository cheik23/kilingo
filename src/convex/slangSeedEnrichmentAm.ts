import type { SlangSeed } from "./slangSeed";

/* ═════════════════════════════════════════════════════════════════
   LOT AMHARIQUE — 35 expressions amhariques (24 + 13)

   Conventions :
   • écriture guèze EN PREMIER, romanisation entre parenthèses — même règle
     que ko/ja/zh/hi/bn/ur/th/fa/el ; `slangSlug` replie la parenthèse finale,
     donc « ሰላም (selam) » et « ሰላም » partagent une seule identité ;
   • contexte au format 4 segments (« [chapeau] | explication | Ex: '…' |
     Note: … ») comme les lots d'enrichissement les plus récents ;
   • `validated: false` sur TOUTES les fiches : le type `SlangSeed` réserve
     ce champ aux lots non relus par un locuteur natif (amharique et igbo)
     et l'UI ne signale que `validated === false` — l'absence de champ ne veut
     PAS dire « vérifié » ;
   • région « Éthiopie » (→ code pays « et » par REGION_ALIASES) : Addis-Abeba
     est citée dans le TEXTE, jamais dans le champ `region`, qui doit rester
     normalisable en code pays ;
   • registres rabattus sur le vocabulaire du schéma : courant → casual,
     oral de la rue → street ;
   • déduplication par slug, garantie par `npm run verify:seeds`.
   ════════════════════════════════════════════════════════ */

/** LOT 1 — 24 expressions initiales (amharicSeedsLot1) */
export const SLANG_SEED_ENRICHMENT_AM: SlangSeed[] = [
{
  language: "am",
  expression: "እንደምን አለህ (Endemin aleh?)",
  literal: "« comment (vas-)tu ? » — እንደምን (comment) + አለህ (tu es)",
  meaning: "comment vas-tu ? — question posée à un homme",
  context:
    "[La question qui suit le salut] | Deuxième grande façon de demander « comment vas-tu ? » avec እንዴት ነህ ? ; la terminaison porte le sexe de l'interlocuteur : እንደምን አለሽ ? à une femme, እንዴት ነዎት ? à une personne respectée. | Ex: 'ሰላም፣ እንደምን አለህ ?' (Salut, comment vas-tu ?) | Note: Formes et sens attestés par les guides de salutations (AmharicTeacher, SpeakFluent, Wikitravel). Le lot proposé écrivait « ndemin aleh » — romanisation amputée de sa première syllabe. La virgule guèze ፣ est la ponctuation attendue après le salut. Phrase-exemple composée.",
  register: "casual",
  region: "Éthiopie",
  popularity: 95,
  validated: false,
},
{
  language: "am",
  expression: "ምን አለ ? (min ale?)",
  literal: "« qu'y a-t-il ? » — ምን (quoi) + አለ (il y a / il a dit)",
  meaning: "quoi de neuf ? qu'est-ce qui se passe ?",
  context:
    "[La question du quartier] | Question brève pour prendre des nouvelles ou jauger une situation, entre proches et dans l'oral urbain d'Addis-Abeba. | Ex: 'ምን አለ ?' (Quoi de neuf ?) | Note: Relevé comme « what's up » familier des rues d'Addis par un guide de salutations urbaines ; le double sens littéral subsiste (« qu'y a-t-il ? »), et la variante explicite « quoi de neuf ? » est ምን አዲስ አለ ?. Le lot proposé portait la région « Add-Abeba » (coquille).",
  register: "street",
  region: "Éthiopie",
  popularity: 90,
  validated: false,
},
{
  language: "am",
  expression: "ምን አዲስ አለ ? (min adis ale?)",
  literal: "« qu'y a-t-il de nouveau ? » — ምን (quoi) + አዲስ (nouveau) + አለ (il y a)",
  meaning: "quoi de neuf ?",
  context:
    "[La relance des nouvelles] | Version explicite de ምን አለ ? : la question porte réellement sur le nouveau, sans la moitié du sens littéral qui reste accrochée à la forme courte. | Ex: 'ምን አዲስ አለ ?' (Quoi de neuf ?) | Note: Forme donnée telle quelle comme « What's new? » par le guide de phrases Wikitravel. Ajout du lot : il occupe le créneau laissé vide par « በየነገሩ », qui n'est pas une tournure de conversation. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 82,
  validated: false,
},
{
  language: "am",
  expression: "እንኳን ደህና መጣህ (enkuwan dehna metah)",
  literal: "« tu es arrivé en paix » — እንኳን (certes, bien) + ደህና (bien) + መጣህ (tu es venu)",
  meaning: "bienvenue — à un homme",
  context:
    "[L'arrivée saluée] | L'hôte accueille en constatant l'arrivée ; le verbe s'accorde : መጣሽ à une femme, መጡ au pluriel et par respect. | Ex: 'እንኳን ደህና መጣህ !' (Bienvenue !) | Note: Formes attestées par les listes de phrases usuelles (Ling, Language Hobo) ; l'expression se dit à celui qui arrive, là où ሰላም sert à toute heure et ደህና ሁን à celui qui part. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 90,
  validated: false,
},
{
  language: "am",
  expression: "እግዚአብሔር ይስጥልኝ (egziabher yistilign)",
  literal: "« que Dieu me le donne » — እግዚአብሔር (Dieu) + ይስጥልኝ (qu'il me donne)",
  meaning: "merci — le remerciement chargé de foi, pour un don ou un grand service",
  context:
    "[Le merci qui remonte au ciel] | Le remerciement passe par Dieu : le suffixe -ልኝ demande « pour moi », donc la formule n'est PAS une bénédiction adressée au bienfaiteur — elle dit la dette de celui qui reçoit. | Ex: 'እግዚአብሔር ይስጥልኝ !' (Que Dieu me le rende ! — formule de gratitude) | Note: Entrée attestée par le dictionnaire AmharicPro (rubrique « thank you ») et par les guides de remerciements ; pour un service ordinaire, አመሰግናለሁ reste la formule neutre. Réservée aux dons, aux aumônes et aux grands services — le lot proposé la glosait « merci beaucoup » sans cette réserve. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 92,
  validated: false,
},
{
  language: "am",
  expression: "እግዚአብሔር ይመስገን (egziabher yimesgen)",
  literal: "« que Dieu soit loué » — እግዚአብሔር (Dieu) + ይመስገን (qu'il soit loué)",
  meaning: "Dieu merci, grâce à Dieu — la louange qui suit « je vais bien »",
  context:
    "[Le « ça va, Dieu merci »] | Réponse reçue à « comment vas-tu ? » : on déclare d'abord son état, puis on rend grâce — la formule accompagne la réponse, elle ne la remplace pas. | Ex: 'ደህና ነኝ፣ እግዚአብሔር ይመስገን' (Je vais bien, Dieu merci) | Note: Formule et usage attestés (AmharicTeacher, Language Hobo, SpeakFluent) ; elle sert aussi à accueillir une bonne nouvelle. Le lot proposé en faisait LA réponse à « comment ça va ? » : c'est ደህና ነኝ qui dit « je vais bien », et le couple est attesté tel quel dans le module de salutations.",
  register: "casual",
  region: "Éthiopie",
  popularity: 96,
  validated: false,
},
{
  language: "am",
  expression: "ችግር የለም (chigir yelem)",
  literal: "« problème il-n'y-a-pas » — ችግር (problème) + የለም (il n'y a pas)",
  meaning: "pas de problème, de rien, ne t'en fais pas",
  context:
    "[La réponse qui dédramatise] | Sert de « de rien » après un merci comme de « pas de souci » devant une contrariété : la formule enlève le poids de la demande. | Ex: 'አመሰግናለሁ ! — ችግር የለም.' (Merci ! — De rien.) | Note: Attestée comme expression idiomatique par les guides de phrases (Language Hobo, Wikitravel) — ce n'est pas un calque de l'anglais ; la variante ችግር የለውም circule, et la réponse voisine au merci est ምንም አይደለም. Phrase-exemple composée.",
  register: "casual",
  region: "Éthiopie",
  popularity: 97,
  validated: false,
},
{
  language: "am",
  expression: "ምንም አይደለም (minim aydellem)",
  literal: "« rien ce-n'est-pas » — ምንም (rien) + አይደለም (il n'est pas)",
  meaning: "de rien, ce n'est rien — la réponse au merci",
  context:
    "[La politesse qui efface la dette] | Réponse directe à un remerciement, plus littérale que ችግር የለም : « il n'y a rien là ». | Ex: 'አመሰግናለሁ ! — ምንም አይደለም.' (Merci ! — De rien.) | Note: Réponse conventionnelle attestée par les guides de phrases (Language Hobo, AmharicTeacher) ; la graphie ምንም አይደል circule chez les apprenants sans être la forme soignée. Phrase-exemple composée.",
  register: "casual",
  region: "Éthiopie",
  popularity: 91,
  validated: false,
},
{
  language: "am",
  expression: "ደህና ሁን (dehna hun)",
  literal: "« sois bien » — ደህና (bien, en bonne santé) + ሁን (sois)",
  meaning: "au revoir, porte-toi bien — à un homme",
  context:
    "[Le congé du quotidien] | L'adieu le plus ordinaire, accordé à l'interlocuteur : ደህና ሁኚ à une femme, ደህና ሁኑ au pluriel et par respect. | Ex: 'ደህና ሁን !' (Porte-toi bien !) | Note: Formes attestées par les guides de salutations (AmharicTeacher, Wikitravel) ; c'est l'équivalent à employer là où ቸር እንሰንብት sonnerait trop écrit. Ajout du lot : la proposition ne donnait que la formule de presse, sans le congé de tous les jours. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 93,
  validated: false,
},
{
  language: "am",
  expression: "ደህና እደር (dehna ider)",
  literal: "« (que tu) passes la nuit en paix » — ደህና (bien) + እደር — formule du soir",
  meaning: "bonne nuit — à un homme",
  context:
    "[Le souhait du soir] | Se dit au moment de se séparer pour la nuit ; l'accord change avec l'interlocuteur : ደህና እደሪ à une femme, ደህና እደሩ au pluriel et par respect. | Ex: 'ደህና እደር !' (Bonne nuit !) | Note: Formes attestées par le module de salutations d'AmharicTeacher ; la décomposition morphologique de እደር n'est volontairement pas donnée ici, faute de source pour la trancher. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 89,
  validated: false,
},
{
  language: "am",
  expression: "መልካም ቀን (melkam qen)",
  literal: "Bonne journée",
  meaning: "Passe une bonne journée / Bonne journée à toi.",
  context:
    "[Le vœu de fin d'échange] | Se dit en quittant quelqu'un qu'on ne reverra pas de la journée, à l'oral comme à l'écrit. | Ex: 'መልካም ቀን !' (Bonne journée !) | Note: Vœu attesté par les listes de phrases usuelles (Ling, Feasa Languages) ; la même construction donne መልካም ልደት (« joyeux anniversaire ») et መልካም አዲስ ዓመት (« bonne année »). À l'arrivée, on dit ሰላም, pas መልካም ቀን. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 85,
  validated: false,
},
{
  language: "am",
  expression: "ቸር እንሰንብት (cher ensenbet)",
  literal: "« bon… que nous passions (le sabbat) » — décomposition ቸር (bon) + እንሰንብት : hypothèse NON confirmée par une source",
  meaning: "portez-vous bien — formule de congé, surtout écrite",
  context:
    "[La signature du dimanche] | La formule prend congé avec solennité ; on la rencontre en clôture de texte et à l'approche du dimanche plutôt que dans une causerie de rue. | Ex: 'ቸር እንሰንብት' (Portez-vous bien) | Note: Graphie attestée en clôture d'un numéro du journal éthiopien Reporter (édition du dimanche) ; sa fréquence à l'oral et sa traduction littérale exacte n'ont PAS pu être établies — les congés du quotidien sont ደህና ሁን / ደህና ሁኚ. À revalider par un locuteur natif : la fiche est conservée pour la graphie, pas pour le sens. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 84,
  validated: false,
},
{
  language: "am",
  expression: "ልብ አድርግ (lib adirig)",
  literal: "« fais (de) ton cœur » — ልብ (cœur, esprit, attention) + አድርግ (fais)",
  meaning: "prends note, retiens bien, fais attention",
  context:
    "[La recommandation à retenir] | En amharique, ልብ dit aussi l'attention : on demande de garder en mémoire ce qui se dit, non de rassembler son courage. | Ex: 'ልብ አድርግ !' (Retiens bien !) | Note: Le dictionnaire Abyssinica glose ልብ አድርግልኝ par « sois mon témoin » (« prends-en note ») et donne ልብ = cœur / mind ; le sens du lot proposé (« fais attention, concentre-toi ») tient donc, mais ce n'est PAS « sois courageux » : cela se dit አይዞህ በርታ. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 81,
  validated: false,
},
{
  language: "am",
  expression: "ኢትዮጵያ ሀገሬ (Ityopiya hagere)",
  literal: "« Éthiopie, mon pays » — ኢትዮጵያ (Éthiopie) + ሀገሬ (mon pays)",
  meaning: "l'Éthiopie, mon pays — l'attachement à la terre natale, souvent chanté",
  context:
    "[Le pays que l'on déclare] | Formule de fierté : on accole « mon pays » au nom du pays, à l'oral comme dans les chants et les discours. | Ex: 'ኢትዮጵያ ሀገሬ !' (L'Éthiopie, mon pays !) | Note: Attestée comme titre d'une chanson connue d'Abraham Gebremedhin (« Ethiopia Hagere ») ; c'est une formule patriotique ordinaire, ni proverbe ni slogan officiel — le lot proposé la présentait comme une expression consacrée. Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 88,
  validated: false,
},
{
  language: "am",
  expression: "ቡና በደላል (buna bedelal)",
  literal: "Boire le café ensemble",
  meaning: "Partager la traditionnelle cérémonie du café pour discuter et nouer des liens.",
  context:
    "[L'invitation au café] | En Éthiopie, le café n'est pas une boisson mais une institution sociale : on invite à la même table pour parler, accueillir un hôte ou éteindre un différend. | Ex: 'Taa, buna betu'. Note: Invitation citée à propos de la cérémonie du café éthiopienne (article du MAA Digital Lab ; patrimoine défendu par l'UNESCO) — la cafetière est la ጀበና, et les trois tours s'appellent abol, tona et baraka. Le lot proposé donnait « ቡና በደላል », non attesté : « ደላላ » signifie « courtier ». Phrase-exemple limitée à la formule.",
  register: "casual",
  region: "Éthiopie",
  popularity: 94,
  validated: false,
},
{
  language: "am",
  expression: "በየነገሩ (beynegeru)",
  literal: "« Quoi qu'il en soit / De toute façon »",
  meaning: "En tout cas / Bref / Quoi qu'il en soit.",
  context:
    "[Tournure de transition discursive] | Utilisé pour recentrer une conversation ou passer à autre chose. Ex: 'Beyenegeru, wede sra ande nmes'. Note: Très courant dans la langue parlée.",
  register: "casual",
  region: "Éthiopie",
  popularity: 83,
  validated: false,
},

/** LOT 2 — 13 expressions supplémentaires (amharicSeedsLot2) */
{
  language: "am",
  expression: "አይዞህ (Ayzoh)",
  literal: "Sois fort / Courage",
  meaning: "Courage ! / Sois fort(e) / Ne t'inquiète pas.",
  context:
    "[Injonction de renforcement moral] | Utilisé pour réconforter quelqu'un qui traverse une épreuve ou ressent de la douleur. Ex: 'Ayzoh, hulum yalfal'. Note: Pour une femme, on dit 'Ayzosh', et au pluriel 'Ayzochih'.",
  register: "casual",
  region: "Éthiopie",
  popularity: 96,
  validated: false,
},
{
  language: "am",
  expression: "ይቅርታ (Yiqirta)",
  literal: "Pardon / Remission",
  meaning: "Pardon / Excusez-moi / Désolé.",
  context:
    "[Mot de politesse standard] | Pour présenter ses excuses ou attirer l'attention de quelqu'un. Ex: 'Yiqirta, menged alfi?'. Note: Incontournable dans les espaces publics.",
  register: "casual",
  region: "Éthiopie",
  popularity: 98,
  validated: false,
},
{
  language: "am",
  expression: "ስምህ ማን ነው? (Simih man new?)",
  literal: "Quel est ton nom ?",
  meaning: "Comment t'appelles-tu ? (à un homme).",
  context:
    "[Question classique] | Pour faire connaissance. Ex: 'Selam, simih man new?'. Note: On dit 'Simish man new?' pour une femme et 'Simwo man new?' avec déférence.",
  register: "casual",
  region: "Éthiopie",
  popularity: 93,
  validated: false,
},
{
  language: "am",
  expression: "አሁንም (Ahunum)",
  literal: "Encore maintenant / Toujours",
  meaning: "Encore / À cet instant précis.",
  context:
    "[Adverbe temporel omniprésent] | Marque la continuité d'un état ou l'urgence d'une action. Ex: 'Ahunum betu new'. Note: Omniprésent dans la conversation courante.",
  register: "casual",
  region: "Éthiopie",
  popularity: 87,
  validated: false,
},
{
  language: "am",
  expression: "ካለ እግዚአብሔር ፈቃድ (Kale Egziabher feqad)",
  literal: "Si Dieu le veut",
  meaning: "Inchallah / Si Dieu le veut / Si tout va bien.",
  context:
    "[Expression de piété] | Pour une action future sous la bénédiction divine. Ex: 'Nage inegenagnalen, kale Egziabher feqad'. Note: Reflète la piété de la culture éthiopienne.",
  register: "casual",
  region: "Éthiopie",
  popularity: 91,
  validated: false,
},
{
  language: "am",
  expression: "ድር ቢያብር አንበሳ ያስራል (Dir biyabir anbessa yasiral)",
  literal: "Si les fils s'unissent, ils peuvent lier un lion",
  meaning: "L'union fait la force / La solidarité permet de surmonter les plus grands obstacles.",
  context:
    "[La toile contre le lion] | Chaque fil est fragile, l'ensemble ligote la bête. Ex: 'Inaaber, dir biyabir anbessa yasiral'. Note: Proverbe attesté avec translittération, littéral et explication par Talk In Amharic ; cousin du 'Igwe bụ ike' igbo déjà au catalogue.",
  register: "street",
  region: "Éthiopie",
  popularity: 96,
  validated: false,
},
{
  language: "am",
  expression: "ቀስ በቀስ እንቁላል በእግሩ ይሄዳል (Qes beqesinqulal be'igru yihedal)",
  literal: "Lentement, l'œuf marche sur ses propres pieds",
  meaning: "Avec de la patience et du temps, les choses les plus difficiles finissent par s'accomplir.",
  context:
    "[L'œuf qui finit par marcher] | L'image dit la patience active : le travail lent obtient ce que la précipitation n'obtient jamais. Ex: 'Tegess, qes beqes enquilal be'igru yihedal'. Note: Proverbe attesté par Talk In Amharic (texte guèze, translittération et explication) ; se dit aux impatients, aux entrepreneurs et aux élèves.",
  register: "street",
  region: "Éthiopie",
  popularity: 89,
  validated: false,
},
{
  language: "am",
  expression: "ማነው? (Manew?)",
  literal: "Qui est-ce ?",
  meaning: "Qui est-ce ? / Qui parle ?",
  context:
    "[Question à la porte/téléphone] | Pour identifier son interlocuteur. Ex: 'Manew beberu lay?'. Note: Élément de conversation quotidienne.",
  register: "casual",
  region: "Éthiopie",
  popularity: 91,
  validated: false,
},
{
  language: "am",
  expression: "እንኳን ደስ አለህ (Enkwan des aleh)",
  literal: "Heureux que cela te réjouisse / Félicitations",
  meaning: "Félicitations ! / Je suis ravi pour toi !",
  context:
    "[ Formule de félicitations] | Utilisé pour féliciter un homme pour un succès, une naissance ou une fête. Ex: 'Enkwan des aleh be'sraw'. Note: Se dit 'Enkwan des alesh' pour une femme et 'Enkwan des alachu' au pluriel.",
  register: "casual",
  region: "Éthiopie",
  popularity: 94,
  validated: false,
},
{
  language: "am",
  expression: "በጣም አሪፍ (Betam arif)",
  literal: "Très excellent / Très cool",
  meaning: "Génial / Super / Très bien.",
  context:
    "[L'expression familière la plus populaire à Addis-Abeba] | 'Betam' (très) + 'arif' (bien/cool). Ex: 'Seraw betam arif new!'. Note: Très usité chez les jeunes et en zone urbaine.",
  register: "street",
  region: "Addis-Abeba",
  popularity: 95,
  validated: false,
},
{
  language: "am",
  expression: "ተርምህ ቀን ብቃት ባቢስ በተሞች (Terem qen betabay bayekom)",
  literal: "Bonne journée très aimable / Very good day",
  meaning: "Génial / Super / Très bien (formule de vœu).",
  context:
    "[Vœu de bonne journée] | Formule chaleureuse pour souhaiter une bonne journée. Ex: 'Terem qen betabay bayekom!'. Note: Variante légèrement différente de 'Melkam qen', plus axée sur la qualité de la journée plutôt que sur le départ.",
  register: "casual",
  region: "Éthiopie",
  popularity: 88,
  validated: false,
},
// Fin du Lot AMHARIQUE — 35 expressions (24 + 13)
// Le détail du tri (fiches conservées, corrigées, remplacées, écartées) et les
// limites de ce lot sont dans l'en-tête ci-dessus — et non ici, pour qu'une
// relecture native tombe dessus avant la première fiche.]
// --- PARTIE 3 (31 à 60) ---
// Amharic Lot 3 — 30 expressions supplémentaires
// Added by user
// --- PARTIE 3 (31 à 60) ---
  // LOT 3 — 30 expressions amhariques supplémentaires (amharicSeedsLot3)
  {
    language: "am",
    expression: "አቤት (Abet)",
    literal: "Oui ? / Me voici / À vos ordres",
    meaning: "Oui ? (réponse polie lorsqu'on appelle votre nom).",
    context: "[Mot d'acquiescement respectueux] | Utilisé pour répondre quand quelqu'un vous interpelle ou vous demande un service. Ex: 'Abebe! - Abet!'. Note: Marque d'éducation et de respect.",
    register: "casual",
    region: "Éthiopie",
    popularity: 98,
    validated: false
  },
  {
    language: "am",
    expression: "አይዞን (Ayzon)",
    literal: "Soyons forts / Courage à nous",
    meaning: "Courage à nous tous ! / Soyons solidaires face à l'épreuve.",
    context: "[Forme collective du réconfort ('Ayzo-')] | Lancé au sein d'un groupe, d'une équipe ou d'une famille traversant un moment difficile. Ex: 'Ayzon, ahunim inasenfalen'. Note: Renforce la cohésion de groupe.",
    register: "casual",
    region: "Éthiopie",
    popularity: 89,
    validated: false
  },
  {
    language: "am",
    expression: "ዋጋው ስንት ነው? (Wagaw sint new?)",
    literal: "Quel est son prix ?",
    meaning: "Combien ça coûte ?",
    context: "[La phrase essentielle pour négocier sur les marchés (Mercato d'Addis-Abeba)] | Ex: 'Selam, ihe wagaw sint new?'. Note: Incontournable dans le commerce.",
    register: "casual",
    region: "Éthiopie",
    popularity: 97,
    validated: false
  },
  {
    language: "am",
    expression: "ውድ ነው (Wid new)",
    literal: "C'est cher / C'est précieux",
    meaning: "C'est trop cher !",
    context: "[Utilisé lors des achats] | Pour indiquer au marchand que le prix proposé est élevé. Ex: 'Betam wid new, qenisaliyn'. Note: Déclencheur habituel de la négociation.",
    register: "casual",
    region: "Éthiopie",
    popularity: 93,
    validated: false
  },
  {
    language: "am",
    expression: "ቀንስልኝ (Qenisalign)",
    literal: "Diminue pour moi",
    meaning: "Fais-moi un prix / Réduis un peu le montant (à un vendeur masculin).",
    context: "[Formule rituelle de marchandage] | Ex: 'Wid new, ebakih qenisalign'. Note: Pour une vendeuse, on dit 'Qenisilingn'.",
    register: "street",
    region: "Éthiopie",
    popularity: 90,
    validated: false
  },
  {
    language: "am",
    expression: "እውነት (Ewnet)",
    literal: "La vérité",
    meaning: "C'est vrai ! / Vraiment ? / Sans blague.",
    context: "[Interjection de confirmation] | S'emploie comme interjection de confirmation ou de surprise dans la discussion. Ex: 'Ewnet! Ihe mereja arif new'. Note: Très courant dans la langue parlée.",
    register: "casual",
    region: "Éthiopie",
    popularity: 96,
    validated: false
  },
  {
    language: "am",
    expression: "በእውነት (Be'ewnet)",
    literal: "En vérité / Sincèrement",
    meaning: "Vraiment / Tout à fait / Sincèrement.",
    context: "[Pour insister sur la sincérité de ses propos] | Ex: 'Be'ewnet ameseginalehu'. Note: Équivalent de 'Truly' ou 'Honestly'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 94,
    validated: false
  },
  {
    language: "am",
    expression: "ሀሰት (Haset / Wushet)",
    literal: "Mensonge / Faux",
    meaning: "C'est faux / C'est un mensonge.",
    context: "[Terme désignant la fausseté] | Utilisé pour contredire fermement une fausse rumeur ou une exagération. Ex: 'Ihe wushet new, atamenaw'. Note: 'Wushet' est le terme le plus populaire à l'oral.",
    register: "casual",
    region: "Éthiopie",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "ቸኩልያለሁ (Chekuliyalehu)",
    literal: "Je suis en hâte / Je me presse",
    meaning: "Je suis pressé(e) / Je dois filer.",
    context: "[Pour prendre congé rapidement ou s'excuser d'un retard] | Ex: 'Yiqirta, ahun chekuliyalehu'. Note: Très usité dans la vie urbaine rythmé.",
    register: "casual",
    region: "Éthiopie",
    popularity: 84,
    validated: false
  },
  {
    language: "am",
    expression: "ዝም በል (Zim bel)",
    literal: "Fais le silence / Tais-toi",
    meaning: "Tais-toi ! / Sois silencieux (à un homme).",
    context: "[Injonction ferme] | Pour demander le silence à un ami ou un enfant. Ex: 'Zim bel, asteway adirig'. Note: Peut paraître brusque selon l'intonation.",
    register: "street",
    region: "Éthiopie",
    popularity: 87,
    validated: false
  },
  {
    language: "am",
    expression: "ና (Na)",
    literal: "Viens !",
    meaning: "Viens ici ! (à un homme).",
    context: "[Impératif du verbe venir au masculin] | Ordre ou invitation rapide à se rapprocher. Ex: 'Wendime, na zihi'. Note: Se dit 'Nay' pour une femme et 'Naw' au pluriel/de déférence.",
    register: "casual",
    region: "Éthiopie",
    popularity: 98,
    validated: false
  },
  {
    language: "am",
    expression: "ሂድ (Hid)",
    literal: "Va-t'en / Va !",
    meaning: "Va ! / Pars ! (à un homme).",
    context: "[Impératif du verbe aller] | Injonction de départ ou d'envoi accomplir une course. Ex: 'Ahun hid, betu wede sra'. Note: Se dit 'Hiji' pour une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 92,
    validated: false
  },
  {
    language: "am",
    expression: "አልገባኝም (Algebagnim)",
    literal: "Cela ne m'est pas rentré dedans",
    meaning: "Je n'ai pas compris.",
    context: "[Tournure négative de la compréhension] | Indique à son interlocuteur que son propos n'a pas été assimilé. Ex: 'Yiqirta, degegamalign, algebagnim'. Note: Indispensable pour l'apprentissage de la langue.",
    register: "casual",
    region: "Éthiopie",
    popularity: 96,
    validated: false
  },
  {
    language: "am",
    expression: "ገባኝ (Gebagn)",
    literal: "C'est rentré en moi",
    meaning: "J'ai compris / Je vois ce que tu veux dire.",
    context: "[Affirmation de la compréhension] | Réponse pour confirmer qu'on suit bien l'explication de son interlocuteur. Ex: 'Eshi, ahun gebagn'. Note: Équivalent de 'I get it'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 97,
    validated: false
  },
  {
    language: "am",
    expression: "መልካም ጉዞ (Melkam guzo)",
    literal: "Bon voyage",
    meaning: "Bon voyage / Bonne route !",
    context: "[Souhait adressé à quelqu'un qui part en trajet court ou long] | Ex: 'Chigir yelem, melkam guzo yihunlih'. Note: Incontournable lors des départs.",
    register: "casual",
    region: "Éthiopie",
    popularity: 93,
    validated: false
  },
  // LOT 4 — 30 expressions amhariques supplémentaires (amharicSeedsLot4)
  {
    language: "am",
    expression: "እባክሽ (Ebakish)",
    literal: "S'il te plaît (à une femme)",
    meaning: "S'il te plaît / Je t'en prie (s'adressant spécifiquement à une femme).",
    context: "Literal: 'Ebak' (priere/demande) + suffixe féminin '-ish'. Meaning: Formule de politesse indispensable lorsqu'on s'adresse à une amie, collègue ou sœur. Ex: 'Ebakish, wuhawn sitegn'. Note: Déclinaison féminine de 'Ebakeh'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 97,
    validated: false
  },
  {
    language: "am",
    expression: "አመሰግናለሁ፣ እግዚአብሔር ይባርክህ (Ameseginalehu, Egziabher yibarkih)",
    literal: "Merci, que Dieu te bénisse",
    meaning: "Merci infiniment / Que Dieu te bénisse (adressé à un homme).",
    context: "Literal: Formule de gratitude spirituelle. Meaning: Utilisé pour exprimer une profonde reconnaissance suite à un acte de générosité ou un soutien moral. Ex: 'Betam ameseginalehu, Egziabher yibarkih'. Note: Se dit 'yibarkish' pour une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 94,
    validated: false
  },
  {
    language: "am",
    expression: "በይ (Bey / Baji)",
    literal: "Dis / Allez (à une femme)",
    meaning: "Allez ! / Vas-y / Dis-moi (interjection d'encouragement féminine).",
    context: "Literal: Impératif du verbe dire au féminin. Meaning: Relance familière et amicale dans une discussion entre amies. Ex: 'Bey, negerign min aderegesh?'. Note: On dit 'Bel' lorsqu'on s'adresse à un homme.",
    register: "street",
    region: "Addis-Abeba",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "በል (Bel)",
    literal: "Dis / Allez (à un homme)",
    meaning: "Allez ! / Vas-y / Alors (interjection de relance masculine).",
    context: "Literal: Impératif du verbe dire au masculin. Meaning: Sert à inciter son interlocuteur à parler ou à passer à l'action. Ex: 'Bel, enidres'. Note: Équivalent oral très fréquent à Addis-Abeba.",
    register: "street",
    region: "Addis-Abeba",
    popularity: 90,
    validated: false
  },
  {
    language: "am",
    expression: "መልካም ምሽት (Melkam mishet)",
    literal: "Bonne soirée",
    meaning: "Passe une bonne soirée / Bonne fin de journée.",
    context: "Literal: 'Melkam' (bon) + 'mishet' (soirée). Meaning: Formule de politesse employée en début ou milieu de soirée pour prendre congé. Ex: 'Melkam mishet yihunlih'. Note: Très usité au travail ou entre amis.",
    register: "casual",
    region: "Éthiopie",
    popularity: 93,
    validated: false
  },
  {
    language: "am",
    expression: "እንኳን አብሮ አደረሰን (Enkwan abro aderesan)",
    literal: "Heureux que nous y soyons arrivés ensemble",
    meaning: "Merci, joyeuse fête à toi/vous aussi !",
    context: "Literal: Formule de réponse festive. Meaning: La réponse rituelle et obligatoire lorsqu'un proche vous souhaite 'Enkwan aderesachu' lors d'une fête. Ex: 'Enkwan aderesachu! - Enkwan abro aderesan!'. Note: Socle de la politesse rituelle éthiopienne.",
    register: "casual",
    region: "Éthiopie",
    popularity: 92,
    validated: false
  },
  {
    language: "am",
    expression: "የኔ አበሻ (Yene Habesha)",
    literal: "Mon Éthiopien / Mon compatriote",
    meaning: "Terme d'affection et de complicité culturelle pan-éthiopienne.",
    context: "Literal: 'Yene' (mon) + 'Habesha' (Éthiopien/Érythréen). Meaning: Exprime la fierté culturelle et le lien de fraternité entre membres de la communauté. Ex: 'Selam new, yene habesha!'. Note: Ancré dans la musique et le sentiment d'appartenance.",
    register: "casual",
    region: "Éthiopie / Diaspora",
    popularity: 95,
    validated: false
  },
  {
    language: "am",
    expression: "አትንገረኝ (Atingeregn)",
    literal: "Ne me dis pas",
    meaning: "Sans blague ! / C'est pas vrai ! / Ne me dis pas que...",
    context: "Literal: 'Atinger' (ne dis pas) + '-egn' (à moi). Meaning: Exclamation de surprise ou d'incrédulité amusée face à un potin ou une nouvelle incroyable. Ex: 'Atingeregn, ewnet new?'. Note: Très vivant dans le langage oral.",
    register: "street",
    region: "Éthiopie",
    popularity: 89,
    validated: false
  },
  {
    language: "am",
    expression: "በሰላም ግባ (Beselam giba)",
    literal: "Rentre en paix (à un homme)",
    meaning: "Rentre bien / Bon retour chez toi.",
    context: "Literal: 'Beselam' (en paix) + 'giba' (entre/rentre). Meaning: Souhait chaleureux adressé à un invité ou un ami qui prend le chemin du retour. Ex: 'Melkam lelit, beselam giba'. Note: Se dit 'Beselam gibi' pour une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 91,
    validated: false
  },
  {
    language: "am",
    expression: "አለ (Ale)",
    literal: "Il y a / Il existe",
    meaning: "Oui, il y en a / C'est disponible / Il est là.",
    context: "Literal: Verbe d'existence à la 3e personne. Meaning: Affirmation d'existence ou de présence. Ex: 'Wuha ale? - Ale!'. Note: Antonyme direct de 'Yelem'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 99,
    validated: false
  },
  {
    language: "am",
    expression: "ነይ (Nay)",
    literal: "Viens ! (à une femme)",
    meaning: "Viens ici ! (adressé spécifiquement à une femme).",
    context: "Literal: Impératif du verbe venir au féminin. Meaning: Injonction amicale pour demander à une amie ou sœur de s'approcher. Ex: 'Ehete, nay zihi'. Note: Déclinaison féminine de 'Na'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 97,
    validated: false
  },
  {
    language: "am",
    expression: "ሂጂ (Hiji)",
    literal: "Va ! (à une femme)",
    meaning: "Va ! / Pars ! (adressé à une femme).",
    context: "Literal: Impératif du verbe aller au féminin. Meaning: Utilisé pour demander à une interlocutrice d'effectuer une course ou de partir. Ex: 'Ahun hiji, wede bet'. Note: Déclinaison féminine de 'Hid'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 91,
    validated: false
  },
  {
    language: "am",
    expression: "ለእኔ (Lene)",
    literal: "Pour moi",
    meaning: "Pour moi / Donne-moi ça.",
    context: "Literal: 'Le-' (pour) + '-ne' (moi). Meaning: Expression utilisée au restaurant, au marché ou lors d'un repas pour indiquer son choix. Ex: 'Lene buna amta'. Note: Essentiel pour commander à manger/boire.",
    register: "casual",
    region: "Éthiopie",
    popularity: 96,
    validated: false
  },
  {
    language: "am",
    expression: "አምጣ (Amta)",
    literal: "Apporte ! (à un homme)",
    meaning: "Apporte-moi / Donne-moi (à un homme).",
    context: "Literal: Impératif du verbe apporter au masculin. Meaning: Utilisé pour demander un objet ou commander au serveur. Ex: 'Wuha amta, ebakih'. Note: Se dit 'Amchi' pour une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 95,
    validated: false
  },
  {
    language: "am",
    expression: "አምጪ (Amchi)",
    literal: "Apporte ! (à une femme)",
    meaning: "Apporte-moi / Donne-moi (à une femme).",
    context: "Literal: Impératif du verbe apporter au féminin. Meaning: Équivalent féminin de 'Amta'. Ex: 'Ebakish, chai amchi'. Note: Très courant au marché et à la maison.",
    register: "casual",
    region: "Éthiopie",
    popularity: 94,
    validated: false
  },
  {
    language: "am",
    expression: "ቆይ (Qoy)",
    literal: "Attends !",
    meaning: "Attends ! / Un instant !",
    context: "Literal: Impératif du verbe attendre. Meaning: Utilisé pour interrompre un mouvement ou demander un temps de réflexion dans la conversation. Ex: 'Qoy, min alesh?'. Note: Interjection omniprésente.",
    register: "casual",
    region: "Éthiopie",
    popularity: 88,
    validated: false,
  },
  // LOT 5 — 30 expressions amhariques supplémentaires (amharicSeedsLot5)
  {
    language: "am",
    expression: "አይነጋገርም (Aynegagerm)",
    literal: "Cela ne se discute pas",
    meaning: "C'est indiscutable ! / C'est clair et net / Absolument.",
    context: "Literal: Forme négative du verbe discuter. Meaning: Utilisé à Addis-Abeba pour valider de manière enthousiaste une évidence ou un accord parfait. Ex: 'Ihe serra betam arif new - Aynegagerm!'. Note: Terme d'argot urbain de confirmation.",
    register: "street",
    region: "Addis-Abeba",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "እንኳን ደስ አለሽ (Enkwan des alesh)",
    literal: "Heureux que cela te réjouisse (à une femme)",
    meaning: "Félicitations ! / Je suis ravi pour toi ! (adressé à une femme).",
    context: "Literal: Formule de félicitation au féminin. Meaning: Utilisé pour congratuler une amie, sœur ou collègue suite à un événement heureux (diplôme, promotion, mariage). Ex: 'Enkwan des alesh be'sraw!'. Note: Déclinaison féminine de 'Enkwan des aleh'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 94,
    validated: false
  },
  {
    language: "am",
    expression: "ስምሽን ማን ነው? (Simish man new?)",
    literal: "Quel est ton nom ? (à une femme)",
    meaning: "Comment t'appelles-tu ? (adressé à une femme).",
    context: "Literal: 'Simish' (ton nom, au féminin) + 'man' (qui) + 'new' (est). Meaning: Question usuelle pour faire connaissance avec une interlocutrice. Ex: 'Selam, simish man new?'. Note: Variante féminine de 'Simih man new?'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 93,
    validated: false
  },
  {
    language: "am",
    expression: "ስምዎ ማን ነው? (Simwo man new?)",
    literal: "Quel est votre nom ? (forme de politesse)",
    meaning: "Comment vous vous appelez ? (adressé avec déférence à un aîné ou un inconnu).",
    context: "Literal: 'Simwo' (votre nom, forme de politesse/pluriel) + 'man' + 'new'. Meaning: Question formelle pour s'adresser à une personne âgée, un supérieur ou un client. Ex: 'Yiqirta, simwo man new?'. Note: Marque de respect essentielle dans la culture amharique.",
    register: "casual",
    region: "Éthiopie",
    popularity: 91,
    validated: false
  },
  {
    language: "am",
    expression: "እባክዎን (Ebakwon)",
    literal: "S'il vous plaît (forme de politesse/pluriel)",
    meaning: "S'il vous plaît / Je vous en prie (forme de politesse marquant le respect).",
    context: "Literal: Forme respectueuse de 'Ebakeh/Ebakish'. Meaning: Utilisé pour adresser une requête polie à un aîné, une figure d'autorité ou un groupe. Ex: 'Ebakwon, menged sitegn'. Note: Pilier de la déférence verbale éthiopienne.",
    register: "casual",
    region: "Éthiopie",
    popularity: 95,
    validated: false
  },
  {
    language: "am",
    expression: "በሰላም ግቢ (Beselam gibi)",
    literal: "Rentre en paix (à une femme)",
    meaning: "Rentre bien / Bon retour chez toi (adressé à une femme).",
    context: "Literal: 'Beselam' (en paix) + 'gibi' (rentre, au féminin). Meaning: Souhait chaleureux adressé à une amie ou collègue qui rentre chez elle le soir. Ex: 'Melkam mishet, beselam gibi'. Note: Déclinaison féminine de 'Beselam giba'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 91,
    validated: false
  },
  {
    language: "am",
    expression: "በሰላም ግቡ (Beselam gibu)",
    literal: "Rentrez en paix (au pluriel/politesse)",
    meaning: "Rentrez bien chez vous / Bon retour à vous tous.",
    context: "Literal: Forme plurielle de la bénédiction de départ. Meaning: Adressé à un groupe de visiteurs ou à une personne que l'on vouvoie lorsqu'elle prend congé. Ex: 'Ameseginalehu le-nleta, beselam gibu'. Note: Formule d'hospitalité très répandue.",
    register: "casual",
    region: "Éthiopie",
    popularity: 90,
    validated: false
  },
  {
    language: "am",
    expression: "መልካም እረፍት (Melkam ireft)",
    literal: "Bon repos",
    meaning: "Bon repos ! / Bon week-end / Repose-toi bien.",
    context: "Literal: 'Melkam' (bon) + 'ireft' (repos/pause). Meaning: Souhait de fin de semaine ou de fin de journée de travail adressé aux collègues. Ex: 'Melkam ireft yihunlachihu'. Note: Incontournable en milieu professionnel.",
    register: "casual",
    region: "Éthiopie",
    popularity: 92,
    validated: false
  },
  {
    language: "am",
    expression: "ቡና ይኑርህ (Buna yinurih)",
    literal: "Que le café soit avec toi",
    meaning: "Que ta maison ne manque jamais de café et d'abondance.",
    context: "Literal: Bénédiction liée au café. Meaning: Souhait traditionnel d'hospitalité et de prospérité formulé après avoir partagé la cérémonie du café. Ex: 'Ameseginalehu le-buna, buna yinurih'. Note: Ancré dans la culture du rituel du café (*Buna tetu*).",
    register: "casual",
    region: "Éthiopie",
    popularity: 84,
    validated: false
  },
  {
    language: "am",
    expression: "እንጀራህ ይባረክ (Injerah yibarek)",
    literal: "Que ton injera soit béni",
    meaning: "Que ton foyer ne manque jamais de nourriture / Béni soit ton repas.",
    context: "Literal: 'Injerah' (ton pain/galette) + 'yibarek' (qu'il soit béni). Meaning: Bénédiction rituelle prononcée en fin de repas pour remercier celui qui vous a offert à manger. Ex: 'Betam ameseginalehu, injerah yibarek'. Note: Hommage à la nourriture nationale éthiopienne.",
    register: "casual",
    region: "Éthiopie",
    popularity: 87,
    validated: false
  },
  {
    language: "am",
    expression: "ውሃ አምጣ (Wuha amta)",
    literal: "Apporte de l'eau (à un homme)",
    meaning: "Donne-moi de l'eau s'il te plaît / Apporte de l'eau.",
    context: "Literal: 'Wuha' (eau) + 'amta' (apporte, masc.). Meaning: Demande courante faite au restaurant, au café ou à la maison. Ex: 'Wuha amta, ebakih'. Note: Pour une femme, on dira 'Wuha amchi'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 94,
    validated: false
  },
  {
    language: "am",
    expression: "ሻይ አምጪ (Chai amchi)",
    literal: "Apporte du thé (à une femme)",
    meaning: "Apporte-moi un thé s'il te plaît (adressé à une femme).",
    context: "Literal: 'Chai' (thé) + 'amchi' (apporte, fém.). Meaning: Phrase classique pour commander un thé dans un salon de thé (*Chai bet*). Ex: 'Chai amchi, ebakish'. Note: Le thé aux épices (*Spiced tea*) est très populaire en Éthiopie.",
    register: "casual",
    region: "Éthiopie",
    popularity: 93,
    validated: false
  },
  {
    language: "am",
    expression: "ሒሳብ (Hisab)",
    literal: "Le compte / Le calcul",
    meaning: "L'addition s'il vous plaît ! / Combien je vous dois ?",
    context: "Literal: Nom désignant la note ou la facture. Meaning: Mot passe-partout prononcé au restaurant ou dans un taxi pour demander l'addition. Ex: 'Yiqirta, hisab amta'. Note: Essentiel pour les déplacements et sorties.",
    register: "casual",
    region: "Éthiopie",
    popularity: 98,
    validated: false
  },
  {
    language: "am",
    expression: "ቀስ በል (Qes bel)",
    literal: "Fais doucement / Sois lent (à un homme)",
    meaning: "Ralentis ! / Doucement / Prends ton temps.",
    context: "Literal: 'Qes' (doucement) + 'bel' (dis/fais). Meaning: Utilisé pour demander à un chauffeur de ralentir ou à un interlocuteur de ne pas se précipiter. Ex: 'Qes bel, chigir yelem'. Note: Se dit 'Qes beji' pour une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 91,
    validated: false
  },
  {
    language: "am",
    expression: "ችኩል (Chikul)",
    literal: "Personne pressée / Impatient",
    meaning: "Impatience / Personne trop pressée ou impulsive.",
    context: "Literal: Adjectif qualifiant l'empressement. Meaning: Utilisé de manière amicale pour taquiner quelqu'un qui veut aller trop vite. Ex: 'Atuhun chikul, qes beqes!'. Note: Tiré de la racine du verbe 'Chekuliyalehu'.",
    register: "street",
    region: "Éthiopie",
    popularity: 82,
    validated: false
  },

  // --- PARTIE 2 (16 à 30) ---
  // LOT 6 — 15 expressions amhariques supplémentaires (amharicSeedsLot6)
  {
    language: "am",
    expression: "አይዞሽ፣ ሁሉም ያንሳል (Ayzosh, hulum yansal)",
    literal: "Courage, tout diminue / s'atténue",
    meaning: "Courage ! Avec le temps, la peine et les épreuves finissent toujours par s'alléger (adressé à une femme).",
    context: "Literal: Injonction de réconfort au féminin. Meaning: Utilisé pour réconforter une amie ou une sœur dans la peine en lui rappelant l'effet apaisant du temps. Ex: 'Ayzosh, hulum yansal, atalqs'. Note: Paroles traditionnelles d'empathie.",
    register: "casual",
    region: "Éthiopie",
    popularity: 90,
    validated: false
  },
  {
    language: "am",
    expression: "እንኳን ደስ አላችሁ (Enkwan des alachihu)",
    literal: "Heureux que cela vous réjouisse (au pluriel)",
    meaning: "Toutes mes félicitations à vous tous !",
    context: "Literal: Formule de félicitation collective. Meaning: S'emploie pour congratuler une famille, un couple ou une équipe lors d'un événement heureux (mariage, naissance, réussite). Ex: 'Enkwan des alachihu be-sefgachihu!'. Note: Formule de politesse festive indispensable.",
    register: "casual",
    region: "Éthiopie",
    popularity: 93,
    validated: false
  },
  {
    language: "am",
    expression: "እግዚአብሔር ይመስገን፣ ደህና ነኝ (Egziabher yimesgen, dehna megn)",
    literal: "Que Dieu soit loué, je vais bien",
    meaning: "Grâce à Dieu, je vais bien / Ça va très bien.",
    context: "Literal: Formule de réponse à la question de santé. Meaning: Réponse rituelle et polie quand on vous demande des nouvelles ('Ndet neh/nesh?'). Ex: 'Dehna neh? - Egziabher yimesgen, dehna megn'. Note: Repère culturel central dans les salutations éthiopiennes.",
    register: "casual",
    region: "Éthiopie",
    popularity: 98,
    validated: false
  },
  {
    language: "am",
    expression: "መልካም የጋብቻ ዘመን (Melkam yegabicha zemen)",
    literal: "Bon temps de mariage",
    meaning: "Heureux mariage ! / Tous mes vœux de bonheur aux mariés.",
    context: "Literal: 'Melkam' (bon) + 'yegabicha' (du mariage) + 'zemen' (temps/ère). Meaning: Souhait formulé lors des cérémonies de mariage éthiopiennes (*Serg*). Ex: 'Le-sergegnochu, melkam yegabicha zemen!'. Note: Incontournable dans les vœux festifs.",
    register: "casual",
    region: "Éthiopie",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "ደህና ሁኚ (Dehna hugni)",
    literal: "Sois en bonne santé / Sois bien (à une femme)",
    meaning: "Au revoir / Porte-toi bien (adressé à une femme).",
    context: "Literal: 'Dehna' (bien) + 'hugni' (sois, fém.). Meaning: Déclinaison féminine de la formule de congé 'Dehna hun'. Ex: 'Melkam mishet, dehna hugni'. Note: S'emploie au quotidien.",
    register: "casual",
    region: "Éthiopie",
    popularity: 95,
    validated: false
  },
  {
    language: "am",
    expression: "ደህና ሁኑ (Dehna hunu)",
    literal: "Soyez en bonne santé (au pluriel/politesse)",
    meaning: "Au revoir à vous tous / Portez-vous bien (forme de politesse ou collective).",
    context: "Literal: Forme plurielle/respectueuse du départ. Meaning: Formule adressée à un groupe de personnes ou à une personne que l'on vouvoie en partant. Ex: 'Ameseginalehu, dehna hunu!'. Note: Marque de politesse accomplie.",
    register: "casual",
    region: "Éthiopie",
    popularity: 94,
    validated: false
  },
  {
    language: "am",
    expression: "ምሽት ይህልም (Mishet yihilm)",
    literal: "Bonne soirée à toi",
    meaning: "Passe une bonne soirée / Que tu passes une agréable soirée.",
    context: "Literal: 'Mishet' (soirée) + 'yihilm' (tu passes). Meaning: Formule de fin de soirée amicale. Ex: 'Melkam yihunligh, mishet yihilm'. Note: Très usité avant le coucher ou la fin d'une réunion.",
    register: "casual",
    region: "Éthiopie",
    popularity: 89,
    validated: false
  },
  {
    language: "am",
    expression: "አሁኑኑ (Ahununu)",
    literal: "Tout de suite maintenant",
    meaning: "Immédiatement / Tout de suite / Sans attendre.",
    context: "Literal: Redoublement renforcé de 'Ahun' (maintenant). Meaning: Exprime l'urgence absolue d'une action à accomplir. Ex: 'Na zihi ahununu!'. Note: Très usité dans les ordres ou urgences.",
    register: "casual",
    region: "Éthiopie",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "በቅድሚያ (Beqidmiya)",
    literal: "En priorité / Tout d'abord",
    meaning: "Premièrement / Tout d'abord / Avant tout.",
    context: "Literal: Locution adverbiale d'ordonnancement. Meaning: Utilisé pour structurer une explication ou un discours. Ex: 'Beqidmiya, ameseginalehu'. Note: Très usité en présentation ou réunion.",
    register: "casual",
    region: "Éthiopie",
    popularity: 86,
    validated: false
  },
  {
    language: "am",
    expression: "መጨረሻ ላይ (Mecheresha lay)",
    literal: "Sur la fin",
    meaning: "À la fin / Enfin / Pour terminer.",
    context: "Literal: 'Mecheresha' (fin) + 'lay' (sur). Meaning: Utilisé pour conclure un récit ou une énumération d'actions. Ex: 'Mecheresha lay, betu wohedin'. Note: Connecteur logique discursif.",
    register: "casual",
    region: "Éthiopie",
    popularity: 87,
    validated: false
  },
  {
    language: "am",
    expression: "ቀስ ብለህ ተናገር (Qes bileh tenager)",
    literal: "Parle en faisant doucement (à un homme)",
    meaning: "Parle plus doucement / Parle moins fort s'il te plaît.",
    context: "Literal: Injonction de modération de la voix. Meaning: Demandé à un ami de baisser d'un ton ou de parler plus lentement pour être compris. Ex: 'Ebakeh, qes bileh tenager, algebagnim'. Note: Se dit 'Qes bilesh tenagery' pour une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 84,
    validated: false
  },
  {
    language: "am",
    expression: "ድምፅህን ቀንስ (Dimtsihin qenis)",
    literal: "Diminue ta voix (à un homme)",
    meaning: "Baisse d'un ton ! / Parle moins fort.",
    context: "Literal: 'Dimts' (voix) + '-ihin' (ta) + 'qenis' (diminue). Meaning: Injonction plus directe pour demander le calme sonore. Ex: 'Tew, dimtsihin qenis!'. Note: Se dit 'Dimtsishin qenisy' pour une femme.",
    register: "street",
    region: "Éthiopie",
    popularity: 81,
    validated: false
  },
  {
    language: "am",
    expression: "እውነት ነው፣ አልተሳሳትክም (Ewnet new, altesasatkim)",
    literal: "C'est vrai, tu ne t'es pas trompé",
    meaning: "C'est exact / Tu as tout à fait raison !",
    context: "Literal: Confirmation d'exactitude. Meaning: S'emploie pour appuyer le jugement ou l'observation correcte de son interlocuteur. Ex: 'Ewnet new, altesasatkim, ihe lik new'. Note: Marque d'approbation enthousiaste.",
    register: "casual",
    region: "Éthiopie",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "ተሳስቻለሁ (Tesaschalehu)",
    literal: "Je me suis trompé",
    meaning: "Je me suis trompé(e) / J'ai commis",
    context: "Literal: Forme première personne du verbe s'égarer. Meaning: Admission d'erreur honnête face à un malentendu ou un oubli. Ex: 'Yeqemt new, tasaschalehu, atamenaw'. Note: Essentiel pour la communication claire et le rétablissement de la confiance.",
    register: "casual",
    region: "Éthiopie",
    popularity: 83,
    validated: false
  },
  // LOT 7 — 15 expressions amhariques supplémentaires (amharicSeedsLot7)
  {
    language: "am",
    expression: "አትጨነቅ (Atcheneq)",
    literal: "Ne sois pas anxieux / Ne t'inquiète pas (à un homme)",
    meaning: "Ne t'inquiète pas ! / Sois tranquille / Pas de panique.",
    context: "Literal: Forme négative du verbe s'inquiéter. Meaning: Utilisé pour rassurer un ami face à un imprévu ou un retard. Ex: 'Atcheneq, hulum yastakakalal'. Note: Se dit 'Atcheneqi' quand on s'adresse à une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 93,
    validated: false
  },
  {
    language: "am",
    expression: "አትጨነቂ (Atcheneqi)",
    literal: "Ne sois pas anxieuse (à une femme)",
    meaning: "Ne t'inquiète pas ! / Sois sereine (adressé à une femme).",
    context: "Literal: Déclinaison féminine de 'Atcheneq'. Meaning: Parole d'apaisement adressée à une sœur, une amie ou une collègue. Ex: 'Ehete, atcheneqi, chigir yelem'. Note: Marque de soutien amical.",
    register: "casual",
    region: "Éthiopie",
    popularity: 92,
    validated: false
  },
  {
    language: "am",
    expression: "መልካም ምግቦች (Melkam migboch)",
    literal: "Bons repas / Bonnes nourritures",
    meaning: "Bon appétit ! / Bon repas à tous.",
    context: "Literal: 'Melkam' (bon) + 'migboch' (repas/nourritures). Meaning: Souhait chaleureux lancé avant de partager le repas autour de l'injera. Ex: 'Le-hulum melkam migboch yihun!'. Note: Incontournable lors des repas de famille.",
    register: "casual",
    region: "Éthiopie",
    popularity: 90,
    validated: false
  },
  {
    language: "am",
    expression: "መልካም በዓላት (Melkam ba'alat)",
    literal: "Bonnes fêtes (au pluriel)",
    meaning: "Joyeuses fêtes à tous ! / Meilleurs vœux pour les fêtes.",
    context: "Literal: Forme plurielle de 'Melkam ba'al'. Meaning: Utilisé pendant la période des vacances ou des grandes célébrations religieuses. Ex: 'Le-ezinulow melkam ba'alat!'. Note: Incontournable lors de Meskel ou Enkutatash.",
    register: "casual",
    region: "Éthiopie",
    popularity: 91,
    validated: false
  },
  {
    language: "am",
    expression: "በእውነት ነው የምልህ (Be'ewnet new yemelih)",
    literal: "C'est en vérité que je te le dis (à un homme)",
    meaning: "Je te le dis très sérieusement / Crois-moi sur parole !",
    context: "Literal: Formule d'insistance sur la sincérité. Meaning: Utilisé pour attester de sa bonne foi lors d'un récit marquant. Ex: 'Be'ewnet new yemelih, ihe neger ewnet new'. Note: Très vivant dans le discours oral.",
    register: "casual",
    region: "Éthiopie",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "በጣም አዝናለሁ (Betam azinalehu)",
    literal: "Je suis très attristé",
    meaning: "Je suis sincèrement désolé(e) / Toutes mes condoléances.",
    context: "Literal: 'Betam' (très) + 'azinalehu' (je suis triste/désolé). Meaning: Expression formelle de sympathie utilisée en cas de deuil, de peine ou pour s'excuser d'une faute grave. Ex: 'Be-negeru betam azinalehu'. Note: Marque de compassion profonde.",
    register: "casual",
    region: "Éthiopie",
    popularity: 94,
    validated: false
  },
  {
    language: "am",
    expression: "መንገዱን ያቅናልህ (Mengedun yaqinalih)",
    literal: "Que Dieu rende ton chemin droit (à un homme)",
    meaning: "Que Dieu facilite ta route et tes démarches / Bon succès dans ton trajet.",
    context: "Literal: Bénédiction traditionnelle de départ. Meaning: Souhait formulé à un voyageur ou à quelqu'un qui démarre une nouvelle entreprise. Ex: 'Melkam guzo, mengedun yaqinalih!'. Note: Bénédiction paternelle/maternelle courante.",
    register: "casual",
    region: "Éthiopie",
    popularity: 87,
    validated: false
  },
  {
    language: "am",
    expression: "አትታበይ (Atitabay)",
    literal: "Ne sois pas orgueilleux (à un homme)",
    meaning: "Reste humble ! / Ne prends pas la grosse tête.",
    context: "Literal: Forme négative du verbe s'enorgueillir. Meaning: Conseil moral pour rappeler à quelqu'un qui a réussi de garder la tête froide. Ex: 'Gobez neh, gin atitabay'. Note: Valeur d'humilité ancrée dans la société éthiopienne.",
    register: "casual",
    region: "Éthiopie",
    popularity: 83,
    validated: false
  },
  {
    language: "am",
    expression: "ትህትና ወርቅ ነው (Tihtina werq new)",
    literal: "L'humilité est de l'or",
    meaning: "L'humilité est la plus précieuse des vertus.",
    context: "Literal: 'Tihtina' (humilité) + 'werq' (or) + 'new' (est). Meaning: Proverbe moral élogeant la modestie face au succès et à la richesse. Ex: 'Atitabay, tihtina werq new'. Note: Principe d'éducation traditionnelle.",
    register: "street",
    region: "Éthiopie",
    popularity: 86,
    validated: false
  },
  {
    language: "am",
    expression: "ቤት ይመችህ (Bet yimechih)",
    literal: "Que la maison te soit confortable (à un homme)",
    meaning: "Fais comme chez toi ! / Sois le bienvenu dans mon foyer.",
    context: "Literal: Injonction d'hospitalité au foyer. Meaning: Formule d'accueil prononcée lorsqu'un invité entre pour la première fois dans sa maison. Ex: 'Nnoo, bet yimechih!'. Note: Reflète la chaleur de l'accueil éthiopien.",
    register: "casual",
    region: "Éthiopie",
    popularity: 89,
    validated: false
  },
  {
    language: "am",
    expression: "ቡናችን ይባረክ (Bunachin yibarek)",
    literal: "Que notre café soit béni",
    meaning: "Bénie soit notre rencontre et notre partage autour du café.",
    context: "Literal: Bénédiction lors du rituel du café. Meaning: Énoncé lors du troisième service du café (*Baraka*) pendant la cérémonie traditionnelle. Ex: 'Egziabher yimesgen, bunachin yibarek'. Note: Troisième et dernière étape sacrée du rituel *Buna tetu*.",
    register: "casual",
    region: "Éthiopie",
    popularity: 85,
    validated: false
  },
  {
    language: "am",
    expression: "አይነካህ (Aynekah)",
    literal: "Que cela ne te touche pas / Qu'aucun mal ne t'atteigne (à un homme)",
    meaning: "Que Dieu te protège de tout mal ! / Santé à toi !",
    context: "Literal: Souhait de protection physique et spirituelle. Meaning: Lancé lorsqu'un ami éternue, trébuche ou échappe à un danger. Ex: 'Aynekah wendime, Egziabher kegna gar new'. Note: Équivalent de 'À tes souhaits / Prends soin de toi'.",
    register: "casual",
    region: "Éthiopie",
    popularity: 88,
    validated: false
  },
  {
    language: "am",
    expression: "ምን ታደርገዋለህ? (Min tadergewaleh?)",
    literal: "Que vas-tu y faire ? (à un homme)",
    meaning: "Qu'y peux-tu ? / C'est comme ça, on n'y peut rien.",
    context: "Literal: Question rhétorique sur l'action impossible. Meaning: Constat de fatalité ou de lâcher-prise face à un dommage irréparable. Ex: 'Ihe neger mere, min tadergewaleh?'. Note: Philosophie de résilience stoïque.",
    register: "casual",
    region: "Éthiopie",
    popularity: 84,
    validated: false
  },
  {
    language: "am",
    expression: "አትርሳ (Atirsa)",
    literal: "N'oublie pas (à un homme)",
    meaning: "N'oublie pas ! / Garde bien cela en mémoire.",
    context: "Literal: Impératif négatif du verbe oublier. Meaning: Utilisé pour rappeler un rendez-vous, une recommandation ou ses origines à un ami. Ex: 'Atirsa, nage inegenagn'. Note: Se dit 'Atirsi' pour une femme.",
    register: "casual",
    region: "Éthiopie",
    popularity: 91,
    validated: false
  },
  {
    language: "am",
    expression: "አልረሳሁትም (Alresahutim)",
    literal: "Je ne l'ai pas oublié",
    meaning: "Je ne l'ai pas oublié / Je m'en souviens très bien.",
    context: "Literal: Verbe oublier conjugué à la forme négative. Meaning: Réponse rassurante pour confirmer qu'une promesse ou un détail est toujours en mémoire. Ex: 'Atirsa! - Alresahutim, chigir yelem'. Note: Engagement de parole.",
    register: "casual",
    region: "Éthiopie",
    popularity: 90,
    validated: false
  }
];
