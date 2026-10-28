import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { LanguageCode } from "./languages";

/* ═══════════════════════════════════════════════════════════════════
   PONTS CULTURELS (Phase 4/4) — seed verbatim + lecture publique.

   Format source : CONCEPT|label_fr|label_en (en-tête) puis
   CONCEPT|lang|expression|gloss_fr. Upsert idempotent par slug :
   réexécuter le seed met à jour, ne duplique jamais.
   ═══════════════════════════════════════════════════════════════════ */

const RAW = `
argent|Argent|Money
fauche|Être fauché|Broke
ami|Ami / pote|Friend
probleme|Problème / galère|Trouble
fete|Fête|Party
police|Police|Police
quartier|Quartier|Hood
cool|Cool / bon|Cool
danse|Danse|Dance
genre|Genre musical|Music genre
plat|Plat de rue|Street food
amour|Amour|Love
hustle|Se démener|Hustle
salutation|Salutation|Greeting
merci|Merci|Thanks
adieu|Au revoir|Goodbye
exclamation|Exclamation|Exclamation
famille|Famille|Family
respect|Respect / honneur|Respect
dieu|Dieu / destin|God & destiny
argent|ha|naira|monnaie, argent
argent|yo|owó|fric
argent|sw|pamba|fric (argot coton)
argent|ln|mbongo|argent
argent|zu|imali|fric
argent|wo|alal|richesse, argent
argent|en|cash|fric
argent|fr|fric|argent familier
fauche|yo|sapa|être fauché
fauche|ha|sapa|fauché (pidgin)
fauche|en|broke|fauché
fauche|fr|fauché|sans argent
fauche|sw|maskini|pauvre
ami|wo|xarit|pote
ami|yo|ọrẹ́|ami
ami|ha|aboki|pote
ami|zu|mngani|pote
ami|sw|chali|gars, pote
ami|ln|ndeko|frère, pote
ami|en|cuz|cousin, pote
ami|fr|pote|ami familier
probleme|ha|wahala|galère
probleme|sw|matata|problèmes
probleme|wo|coono|malheur, galère
probleme|ln|mokakatano|problème
probleme|fr|galère|situation difficile
probleme|en|drama|embrouille
fete|yo|owambe|grande fête
fete|zu|braai|barbecue-fête
fete|sw|sherehe|fête
fete|fr|teuf|soirée
fete|en|party|fête
fete|ln|ambiance|ambiance de fête
police|yo|ọlọ́pàá|keufs
police|ha|dan sanda|flic
police|zu|maponya|police (argot SA)
police|sw|maaskari|police
police|fr|keufs|police (verlan)
police|en|ops|police (argot)
quartier|zu|kasi|quartier, hood
quartier|sw|mtaa|quartier, rue
quartier|en|block|quartier, rue
quartier|fr|cité|quartier populaire
quartier|ln|mboka|coin, pays
cool|zu|lekker|cool, bon
cool|wo|baax|bon, cool
cool|yo|dára|bon
cool|sw|poa|cool, tranquille
cool|ln|malamu|bon, bien
cool|en|cool|cool
cool|fr|chanmé|génial (verlan)
danse|yo|shaku shaku|danse shaku
danse|zu|gina|danser
danse|wo|simb|danse traditionnelle
danse|ln|ndombolo|danse ndombolo
genre|zu|amapiano|amapiano
genre|wo|mbalax|mbalax
genre|ln|rumba|rumba congolaise
genre|sw|bongo flava|bongo flava
genre|yo|afrobeats|afrobeats
plat|ha|suya|brochettes épicées
plat|yo|amala|plat d'igname
plat|zu|bunny chow|pain farci au curry
plat|sw|nyama choma|grillade
plat|ln|pondu|feuilles de manioc
plat|wo|ceeb u jën|riz au poisson (thiéboudienne)
amour|yo|ifẹ́|amour
amour|wo|mbëggeel|amour
amour|zu|uthando|amour
amour|sw|mapenzi|amour
amour|ln|bolingo|amour
amour|fr|amour|amour
hustle|yo|waka|se démener, hustler
hustle|wo|liggéey|travail, bosser
hustle|sw|kibarua|petit boulot
hustle|en|hustle|se démener
hustle|fr|taf|boulot
salutation|wo|na nga def|comment vas-tu
salutation|yo|bawo ni|comment ça va
salutation|zu|sawubona|bonjour (je te vois)
salutation|sw|mambo vipi|quoi de neuf
salutation|ha|sannu|bonjour
salutation|ln|mbote|bonjour
salutation|fr|ça va ?|salutation
salutation|en|what's up|quoi de neuf
merci|wo|jërëjëf|merci
merci|yo|e ṣe|merci
merci|zu|ngiyabonga|merci
merci|sw|asante|merci
merci|ln|matondo|merci
merci|ha|muná gódè|merci
adieu|zu|sala kahle|au revoir (reste bien)
adieu|yo|o dabọ|au revoir
adieu|sw|kwaheri|au revoir
adieu|ha|sai an jima|au revoir (à bientôt)
exclamation|zu|eish|eh ! (surprise)
exclamation|fr|wesh|eh ! / salut (verlan)
exclamation|en|yikes|ouh là
famille|wo|mbokk|famille, parent
famille|yo|ẹbí|famille
famille|zu|umndeni|famille
famille|sw|familia|famille
famille|ln|libota|famille
respect|wo|kersa|honte, pudeur (respect)
respect|yo|ìbà|respect, hommage
respect|zu|hlonipha|respecter
respect|sw|heshima|respect
dieu|yo|orí|tête, destin
dieu|wo|Yàlla|Dieu
dieu|zu|uNkulunkulu|Dieu
dieu|sw|Mungu|Dieu
dieu|ln|Nzambe|Dieu
dieu|ha|Allah|Dieu
argent|vi|Lì xì|L'argent de chance donné dans une enveloppe rouge lors du Nouvel An vietnamien (Tết).
argent|ur|Paisa|Argent
argent|fa|واریز|Dépôt (argent, chèque)
argent|vi|Đứng hình|Bugger, rester sous le choc, être totalement pétrifié par la surprise.
argent|zh|氪金玩家 (Kè jīn wán jiā)|Un joueur 'Pay-to-Win' qui achète sa victoire avec de l'argent réel / Par extension, un fils de riche qui réussit grâce à l'argent de ses…
argent|ig|Ego na-eme ihe niile|L'argent débloque tout — constat pragmatique, à moitié sarcastique
argent|ru|Бабки|Argent, fric, thune
argent|ig|Ego na-emeghe ụzọ|Les ressources financières débloquent quand toutes les autres portes sont closes
argent|vi|Cháy túi|Être complètement fauché, n'avoir plus un sous en poche (poche percée/brûlée).
argent|ig|Ego na-ekwu|L'argent donne la voix et l'influence
argent|ar|على بلاطة كدة ('Ala Balata Kida)|Pour te dire les choses cash / Sans tourner autour du pot.
argent|zh|潜规 (Qián guī)|Pistoner / Imposer des contreparties officieuses à quelqu'un.
argent|tl|Underworked|Sous-occupé
argent|ur|Mali|Affaires, argent
argent|tl|Breakout room|Salle de sous-groupes
argent|pl|Dobra|bon, d'accord, ok
argent|zh|单身狗的悲伤 (Dān shēn gǒu de bēi shāng)|Le désarroi comique d'un célibataire noyé sous les démonstrations amoureuses des autres.
argent|id|Nabung|Épargner de l'argent
argent|de|Kohle|fric
argent|pl|Kasa|le fric, la caisse
argent|es|plata|argent
argent|de|Knete|fric
argent|pt|Grana|fric, thune
argent|de|Para|fric, pognon
argent|pl|Forsa|le fric, les moyens
argent|it|Che palle!|quelle barbe !
argent|ur|فُل پیسہ واسول (full paisa vasool)|Ça valait tout le prix, j'ai eu mon dû
argent|ar|فلوس|argent
argent|ar|دراهم (darāhim)|argent
argent|es|Lana|fric, argent
argent|ja|意味深 (imi shin)|lourd de sens, sous-entendu
argent|tr|Kumar|le jeu d'argent
argent|es|varo|argent
argent|hi|Chillar|grotte, minable, quasiment rien
argent|it|Flexare|frimer, exhiber ses fringues, son argent ou sa réussite
argent|tl|Titikman|goûter (avec un sous-entendu grivois documenté par la source)
argent|it|Avere le mani bucate|être dépensier, jeter l'argent par les fenêtres
argent|pt|Pila|réal, fric (unité de compte)
argent|ru|кэш (kesh)|liquides
fauche|id|Bokek|Sans un sou
fauche|zh|精致穷 (jīngzhìqióng)|Gagner peu mais tout dépenser pour une vie soignée, photogénique et sans dette impossible
fauche|ig|Ogbenye anaghị ata anya ehi|La place de chacun dans le partage décide de ce qu'il peut prétendre recevoir
fauche|th|เจ๊งแล้ว|cassé, en faillite, percé (c'est déjà fichu)
fauche|zh|吃土 (chī tǔ)|fauché
fauche|id|Budak|gosse / esclave ? en Jakarta : « pauvre type »
fauche|it|Essere al verde|être fauché
fauche|pt|Quebrado|fauché (aussi : cassé, épuisé)
fauche|ig|Owu ite|être fauché, la pauvreté
fauche|pt|Tô liso|je suis fauché
fauche|es|Estar sin blanca|être fauché
ami|ur|Bhai|Frere
ami|ur|Yaar|Pote, mec
ami|bn|Ami korte|I do
ami|tl|Kuya|Frère aîné
ami|bn|Ami|Ami
ami|ig|Nwanne m|Frère ou sœur de cœur : terme d'affection valable sans lien de sang
ami|tl|Friendzone|Friendzone (mis friend)
ami|id|Abang|« Frère » — appellatif du vendeur et du run
ami|bn|Bestie|Best friend (English borrowing)
ami|ar|أخويا (Akhoya)|Mon frère / Bro / Mon meilleur pote (terme d'affection fraternelle absolu).
ami|hi|भाई (bhai)|frère ; mec (terme d'adresse universel)
ami|tl|Pare|Pote, mec (terme d'adresse entre hommes)
ami|ar|حبيبي (ḥabībī)|mon pote, mon chéri
ami|ur|یار (yaar)|pote
ami|hi|यार (yaar)|pote, mec
ami|tr|Kanka|pote, frérot
ami|ar|تكرم عينك يا غالي (Tekram 'Aynak Ya Ghali)|Avec l'immense plaisir mon cher ami ! / À ton service avec joie !
ami|id|Agan / Gan|Monsieur / Cher ami / Bro (utilisé principalement sur les forums de vente et en e-commerce).
ami|ig|Nwanne dị na mba|La fraternité existe partout : loin de chez soi, on trouve des alliés qui font famille
ami|id|Bro / Sis|frère / sœur (très courant entre amis)
ami|it|Ciao bello / Ciao bella|salut l'ami / la belle (amical)
ami|de|Bruder|frère, frérot
ami|hi|Saala|salaud, canaille (insulte de base de Bollywood)
ami|tr|Abi|grand frère (respectueux et chaleureux)
ami|vi|Ghế lâu|pote attitré (la place toujours réservée)
ami|vi|Chú mèo|bro, frérot (adresse complice)
ami|de|Bro|frérot
ami|pl|Ziomek|pote, gars
ami|pt|Irmão|frère, frérot
ami|el|Αδερφέ (adelfe)|frère, mec (entre potes)
ami|zh|吃大户 (Chī dà hù)|Faire payer les personnes fortunées, profiter de la générosité d'un ami qui gagne bien sa vie.
ami|ko|형 (hyeong)|grand frère (dit par un garçon)
ami|el|φίλη (fili)|ami(e)
ami|it|Bro|frère, frérot
ami|el|Αδερφός (adelfos)|frère, frangin
ami|pt|Parça|pote, partenaire
ami|pt|Parceiro|pote, allié
ami|pl|Ziom|pote, frère
ami|ko|오빠 (oppa)|grand frère ; le copain, dit par une femme
ami|vi|Cạn tình cạn nghĩa|N'avoir plus aucune pitié, agir sans aucun scrupule envers un ancien ami ou conjoint.
ami|de|Kumpel|pote, copain
ami|tr|Gardaş|frère (Anatolie)
ami|ko|절친 (jeolchin)|ami intime, meilleur ami
ami|es|Boludo|idiot (insulte) ; mec, pote (entre proches)
ami|fa|مخلص (mokhles)|salut, l'ami (affectueux, entre hommes surtout)
ami|ig|Alobam|mon pote de confiance, mon camarade
ami|fa|داداش (dadash)|frangin, pote
ami|ja|ネ友 (netomo)|ami en ligne
ami|pl|Ziomal|pote (argot)
ami|ja|リア友 (riatomo)|ami dans la vraie vie
ami|it|Zio|mon pote (jeune) ; oncle
ami|es|compa|pote
ami|fa|داش (dâsh)|frérot, mec
ami|zh|老铁|pote fidèle
ami|es|cuate|pote
ami|zh|小哥哥 (xiǎo gēge)|jeune homme (adressé)
probleme|am|ችግር የለም (chigir yelem)|pas de problème, de rien, ne t'en fais pas
probleme|zh|吃瓜不嫌事大 (Chī guā bù xián shì dà)|Plus il y a de drame et de chaos, plus le spectacle est réjouissant pour les spectateurs.
probleme|ur|Masla|Probleme
probleme|zh|孔乙己文学 (Kǒngyǐjǐ wénxué)|Le malheur du lettré de Lu Xun transposé au sort des diplômés surqualifiés
probleme|th|ไม่เป็นไร (mai pen rai)|pas de souci, ce n'est rien
probleme|ur|Jhol|Embrouille, erreur, anomalie
probleme|zh|神操作 (Shén cāo zuò)|Un coup de maître, une astuce lumineuse, une résolution de problème complètement géniale.
probleme|ig|Imi bewe, anya ebewe|Le malheur d'un proche est le nôtre : la peine se partage dans la communauté
probleme|ur|Bindass|Sans souci, cool
probleme|ar|فهلوة (Fahlawa)|L'art de la débrouille à l'égyptienne, trouver une solution informelle à n'importe quel problème.
probleme|ar|مو مشكلة|Pas de souci
probleme|ar|مافيش مشكلة|Pas de souci
probleme|pt|Treta|embrouille, embrouille
probleme|bn|বিনদাস (bindaas)|insouciant, sans souci
probleme|bn|ঝোল (jhol)|problème, embrouille
probleme|de|Verwirrt|perplexe, confus
probleme|pt|Drama|drame, cinéma
probleme|hi|बिंदास (bindass)|sans souci, cool
probleme|pl|Spoko|cool, pas de souci
probleme|tr|Sorun değil|pas de problème
probleme|pt|Tranquilo|tranquille, pas de souci
probleme|el|Δράμα (drama)|le drame, le cinéma
probleme|de|Kein Ding|pas de souci
probleme|it|Che sbatti!|quelle galère ! (jeune)
probleme|hi|Lafda|drâme, dispute, embrouille
probleme|es|pedo|ivre / problème (selon contexte)
probleme|tr|Problem yok|y'a pas de problème
probleme|tr|Sıkıntı yok|pas de souci
probleme|es|Qué hueva|quelle galère, c'est trop pénible
probleme|de|Skill Issue|manque de compétence (souvent une blague)
probleme|ru|Ровный|Calme, normal, sans problème
probleme|ru|напряг (napryag)|galère, contrainte
probleme|es|Quilombo|bazar, bordel, embrouille
probleme|it|Mannaggia|punaise, mince alors
probleme|hi|Kaand|l'affaire problématique, le drame croustillant dont la rumeur court
probleme|pl|Kicha|la déveine, la galère
probleme|ko|극한직업 (geukhan jigeop)|boulot de forçat, vraie galère
probleme|it|Scialla!|tranquille, détends-toi, pas de souci
fete|id|Lebaran|Fête de l'Aïd — le sommet social annuel
fete|vi|Đi bão|Descendre en scooter faire la fête dans la rue après un succès sportif (forme verbale de *Bão*).
fete|am|መልካም ምሽት (Melkam mishet)|Passe une bonne soirée / Bonne fin de journée.
fete|ur|Patakha|Personne tres attirante
fete|ru|Туса|Fête, soirée
fete|ru|Тусовка|Fête, rassemblement, boîte
fete|zh|打工是不可能打工的 (dǎgōng shì bù kěnéng dǎgōng de)|Célébration ironique du refus des petits boulots aliénants
fete|am|እንኳን አብሮ አደረሰን (Enkwan abro aderesan)|Merci, joyeuse fête à toi/vous aussi !
fete|am|ምሽት ይህልም (Mishet yihilm)|Passe une bonne soirée / Que tu passes une agréable soirée.
fete|ig|Emume|Le moment de fête partagé : mariage, festival, communion du clan
fete|hi|Pawri ho rahi hai|on est en mode fête (mème viral 2021)
fete|zh|负能量爆棚 (Fù néng liàng bào péng)|Un concentré de pessimisme toxique, une ambiance au fond du gouffre.
fete|zh|拉满 (lāmǎn)|Porter un attribut au maximum : ambiance, effort, passion
fete|de|Feierabend|fin de la journée de travail (mot culturel)
fete|ko|분위기 (bunwigi)|l'ambiance, le climat
fete|fa|باحال (bâhâl)|cool, sympa, amusant
fete|vi|Tháo chạy|Prendre la fuite à toutes jambes, déserter une soirée ou un mauvais plan.
fete|vi|Quẩy|faire la fête, mettre le feu
fete|ko|갑분싸 (gapbunssa)|ambiance glaciale d'un coup
fete|el|Γλέντι (glenti)|la bamboche, la bringue
fete|pl|Imprezka|petite fête, soirée sympa
fete|ja|空気読め (kuuki yome)|lis l'ambiance ! (KY)
fete|ko|눈치 (nunchi)|l'art de lire l'ambiance, le tact
fete|fa|ضدحال زدن (zedd-e hâl zadan)|casser l'ambiance, doucher l'enthousiasme
fete|pl|Impreza|la soirée, la fête
fete|de|Feiern|faire la fête
fete|es|Juerga|fête, virée
fete|it|Vibe|ambiance, énergie qui se dégage
fete|fa|پارتی داشتن (pârti dâshtan)|avoir des relations, bénéficier de piston
fete|el|Πανηγύρι (panigyri)|la grande fête, le grand bazar
fete|el|Γλεντάω (glentao)|faire la fête, faire la bringue
fete|ja|ノリ (nori)|le délire, l'ambiance
fete|es|rumba|fête
fete|pl|Balować|faire la fête, faire la bringue
fete|pt|Farra|fête, virée
fete|pt|Vibe|ambiance, énergie qui se dégage
fete|ja|空気読めない (kuuki yomenai)|ne pas savoir lire l'ambiance (KY)
fete|es|Mala onda|mauvaise ambiance ; sale mentalité
fete|ru|чилл|ambiance calme
fete|de|Feiern gehen|sortir faire la fête
fete|hi|Mauj-masti|la fête, l'éclate et la rigolade
fete|ar|سهرة|soirée, nuit blanche festive
fete|ig|Oringo|le fun, l'ambiance festive
fete|pt|Esquenta|apéro, mise en jambes avant la fête
police|ru|мент (ment)|flic
police|es|Cana|la police ; « caer en cana » = se faire arrêter
police|ig|Ndi Eke|la police, les flics
police|ru|легавый|flic
police|hi|Paandu|le flic de base (moqueur)
police|es|tira|flic
police|es|Yuta|la police, les flics
quartier|vi|Bánh tráng trộn|Le snack de rue par excellence des jeunes vietnamiens (galettes de riz coupées, mangue verte, piment, bœuf séché).
quartier|id|Kampung|Quartier-village dense
quartier|fa|Mahalle|Quartier, voisinage
quartier|fa|Sange|Rue piétonne, promenade
quartier|fa|Koocheh|Rue étroite, allée
quartier|id|Nongkrong|Traîner ensemble, squatter un café ou un coin de rue entre amis pour discuter sans but précis.
quartier|vi|Đi nhậu|Aller descendre des bières et manger des tapas (*Môi*) dans un buibui de rue (*Quán nhậu*).
quartier|tl|Sari-sari store|Petite épicerie de quartier
quartier|zh|脏摊儿 (zāngtānr)|L'échoppe de rue ordurière et délicieuse, dîner des fins de soirée
quartier|bn|Gali|Rue, langage de rue
quartier|el|Γειτονιά (geitonia)|le quartier (la zone, l'ambiance)
quartier|hi|Tapri|le kiosque/pourpoint du quartier (l'endroit du chill)
quartier|tl|Balut|Œuf de canard fertilisé (snack de rue)
quartier|pt|Cria|gamin du quartier, enfant du coin
quartier|hi|Dadagiri|domination, tyranie de quartier
quartier|de|Kiez|quartier chaud (Berlin)
quartier|de|Homie|pote proche
quartier|it|Maranza|jeune qui joue les caïds de quartier (tuta, marques, attitude)
quartier|pt|Quebrada|le quartier, la périphérie (d'où l'on vient)
quartier|pt|Malandro|filou, débrouillard de rue
quartier|bn|Gali type|Type de gars de rue
quartier|ig|Nkolo|mon quartier, mon crew
quartier|el|Τσαμπουκάς (tzaboukas)|la provoc, l'agressivité de rue
quartier|bn|শাহবাগী (shahbagi)|étiquette politique chargée, contestée (milieu libéral laïque)
quartier|de|Homies|potes, gars du quartier
quartier|ig|Arubam|mon pote de rue, mon G
quartier|el|Κουτσαβάκι (koutsavaki)|le petit voyou, le caïd de quartier
quartier|es|ñero|gars de rue
cool|am|በጣም አሪፍ (Betam arif)|Génial / Super / Très bien.
cool|id|Anak Jaksel|Personne au style de vie branché qui mélange frénétiquement l'anglais et l'indonésien dans une même phrase ('Which is', 'Literally',…
cool|ur|Street style|Style urbain
cool|id|Santuy|Reste cool, tranquille, sans pression.
cool|id|Gokil|Dingue, hallucinant, génial ou hilarant (utilisé pour une situation ou une personne).
cool|ur|Zabardast|Genial, excellent
cool|ar|جامد|Génial, super (Égypte)
cool|ur|PSL|Tournoi T20 de cricket de Pakistan
cool|es|guay|génial, chouette
cool|bn|Drip|Drip (style fashionable)
cool|de|geil|cool, génial
cool|ja|すごい (sugoi)|génial, incroyable
cool|bn|ফাটাফাটি (fatafati)|génial, fantastique
cool|am|ተርምህ ቀን ብቃት ባቢስ በተሞች (Terem qen betabay bayekom)|Génial / Super / Très bien (formule de vœu).
cool|pt|Legal|cool, sympa
cool|ja|かっこいい (kakkoii)|cool, beau, classe
cool|fa|خفن (khafan)|génial, impressionnant, « trop bien »
cool|bn|Super Hit|Succès immense
cool|vi|Đỉnh của chóp|le top du top (2020)
cool|vi|Trai phó|Citadin stylé, jeune homme élégant au fait des dernières tendances de la capitale.
cool|es|chido|cool, sympa
cool|zh|牛|génial, balèze
cool|am|አትጨነቅ (Atcheneq)|Ne t'inquiète pas ! / Sois tranquille / Pas de panique.
cool|pt|Massa|génial, top
cool|it|Figo|cool, stylé
cool|de|Hammer!|génial, dingue
cool|ko|최고 (choego)|le top, le meilleur
cool|es|molar|être cool, plaître
cool|tr|Süper|super
cool|pl|Super|super
cool|tl|Astig|cool, stylé
cool|ja|おしゃれ (oshare)|stylé, à la mode
cool|ko|멋지다 (meotjida)|stylé, magnifique
cool|zh|骚操作|Coup génial ou très insolent, astuce bluffante
cool|zh|松弛感 (sōngchí gǎn)|Allure décomplexée : rester cool quand tout part de travers, voilà l'aisance
cool|it|Spettacolo!|génial !
cool|fa|ایول (eyval)|cool, excellent
cool|ar|هايل|Excellent, génial
cool|pt|Fica tranquilo|sois tranquille, t'inquiète
cool|ar|حاجة فاخر من الآخر (Haja Fakher Min Al-Akher)|Du grand art ! / Qualité premium / Chef-d'œuvre / Le top du top.
cool|vi|Êm|cool, tranquille
cool|it|Bello!|super !, trop bien !
cool|el|Γαμάτο (gamato)|génial, d'enfer (vulgaire)
cool|ko|최고야 (choegoya)|c'est le top, c'est parfait
cool|pl|Zajebisty|trop cool, génial (vulgarité légère)
cool|hi|मस्त (mast)|génial, cool
cool|ig|Ọ dị egwu|c'est génial, waouh
cool|th|เจ๋ง|classe, génial
cool|pl|Spox|cool, ok (texto)
cool|el|Κοριτσάρα (koritsara)|super nana, fille canon
cool|tr|Çok iyi|trop bien, génial
cool|el|Στυλ (styl)|le style, le chic
cool|ru|крутой (krutoy)|cool, dur
cool|ru|Улет|Quelque chose de génial, qui 'décolle'
cool|th|เลิศ|excellent, top du top
cool|ru|имба (imba)|trop fort, déséquilibré (au sens « génial »)
cool|hi|Rapchik|classe, très stylé, top
cool|de|Geilomat|trop cool, génial (Berlin)
cool|hi|Tashan|l'attitude, le style, la prestance
danse|el|Χορεύω (chorevo)|danser
danse|el|Χορός (choros)|la danse ; le bal
danse|el|Πίστα (pista)|la piste de danse
danse|es|perreo|danse reggaeton
danse|es|perrear|danser le perreo
danse|ar|dabke|danse traditionnelle
danse|zh|蹦迪|aller en boîte, danser
genre|ur|Rap|Rap (musique ourdoue moderne)
genre|id|Sound-nya candu|La musique/l'audio est hyper entêtant(e), impossible de se la sortir de la tête.
genre|vi|Đu idol|Suivre passionnément un groupe de musique/artiste (K-Pop/V-Pop), acheter ses albums et aller à ses concerts.
genre|ur|Track|Morceau de musique
genre|vi|Nổi da gà|Avoir la chair de poule (d'émotion, de peur ou en écoutant une musique sublime).
genre|zh|网抑云 (wǎngyìyún)|L'heure où les commentaires de NetEase Cloud Music se noient dans la mélancolie
genre|th|โหด|de fou, balèze (musique, performance)
genre|hi|Gully|la ruelle (culture rap / gully boi)
genre|el|Μπουζούκια (bouzoukia)|les bouzoukia (grands clubs de musique)
genre|ru|хип-хоп|hip-hop
genre|ig|Gbedu|la fiesta, le son (musique)
genre|zh|说唱|rap chinois
genre|zh|嘻哈|hip-hop
genre|ar|راب|rap arabe
genre|ru|фристайл|freestyle
genre|es|urbano|musique urbaine latino
genre|ar|هيب هوب|hip-hop
genre|ar|shaabi|musique populaire
genre|ru|баттл|battle rap
plat|zh|大吃一惊 (Dà chī yī jīng)|Être extrêmement surpris, en rester sans voix.
plat|zh|吃独食 (Chī dú shí)|Garder tous les profits pour soi, refuser de partager un bon plan ou une opportunité.
plat|zh|吃饼 (Chī bǐng)|Gober les fausses promesses du patron, être naïf face aux beaux discours managériaux.
plat|vi|Cẩu lương|Démonstration publique d'affection étalée devant des célibataires (variante littéraire/sino-vietnamienne de *Cơm chó*).
plat|id|Nasi goreng|Riz frit — le plat national par excellence
plat|tl|Sisig|Plat de porc sizzling épicé
plat|vi|Ăn hại cơm cha mẹ|Bon à rien, parasite qui vit aux crochets de ses parents sans travailler ni étudier.
plat|vi|Ăn ốc nói mò|Parler sans savoir, colporter des rumeurs sans aucune preuve ou affirmer des choses fausses.
plat|bn|Chotpoti|Chotpoti (street food)
plat|id|Mie ayam|Nouilles au poulet (street food effervescente)
plat|id|Gerobak|Chariot de street food mobile
plat|fa|Befarma|S'il vous plaît, allez-y (offre de nourriture/place)
plat|bn|Adda khana|Manger lors de l'adda
plat|ig|Chop life|profiter de la vie, se faire plaisir
plat|am|እንጀራህ ይባረክ (Injerah yibarek)|Que ton foyer ne manque jamais de nourriture / Béni soit ton repas.
plat|pt|Chato|pénible, casse-pieds
plat|ig|Akwụkwọ nri|Les légumes-feuilles, les feuilles comestibles de la cuisine igbo
plat|th|แกง|piquer, faire une blague à quelqu'un (le « manger »)
plat|tr|Çiğ köfte|çiğ köfte (street food, aussi prétexte à sortie)
plat|ko|개맛있어 (gae masisseo)|trop bon (à manger)
plat|ja|ぼっち飯 (bocchi meshi)|manger seul
plat|pt|Manjar|maîtriser, s'y connaître, capter
plat|pt|Guria|meuf, nana (sud)
plat|es|Ponerse morado|manger comme quatre, se gaver
plat|es|Morfar|bouffer, manger
plat|de|Drama machen|en faire tout un plat
plat|ig|Ita mgbe|faire l'école buissonnière, sécher les cours
plat|tl|SLR|désolé pour la réponse tardive (souvent : téléphone à plat)
amour|fa|Asheghane|Amoureuse, en amour
amour|bn|Prem|Love, deep affection
amour|ig|Obi m|Mon amour, mon chéri(e) : le terme d'affection du quotidien
amour|fa|Ghalb|Cœur (usage affectif)
amour|vi|Thả tim|Liker avec un cœur sur Facebook/Zalo/TikTok, exprimer son adoration.
amour|fa|Mahboobe|Amour, bien-aimé(e)
amour|id|Baper|Prendre les choses trop à cœur, être sentimental ou réagir de manière exagérée à une remarque ou un geste.
amour|tl|Labyu|Je t'aime
amour|ar|يا روح قلبي (Ya Rooh Qalbi)|Mon âme / Mon trésor / Mon amour (surnom d'une tendresse infinie).
amour|tl|Love language|Langue d'amour (5 love languages)
amour|id|Kepo|Être trop curieux, indiscret, aimer fouiner dans la vie des autres.
amour|ur|Janu|Mon amour (affectueux)
amour|bn|Dil|Cœur
amour|id|Warung|Échoppe de voisinage — le cœur du petit commerce
amour|th|ใจเย็นๆ (jai yen yen)|calme-toi, prends ton temps
amour|zh|秋天的第一杯奶茶 (qiūtiān de dì yī bēi nǎichá)|Rituel d'amour de l'automne : recevoir (ou s'offrir) le premier thé lacté de la saison
amour|ar|زي السكر (Zay Al-Sokkar)|Adorable / Adorable à souhait / Un amôur / Trop mignon.
amour|ig|Ọ dị m n'obi|Ce que j'ai à cœur, ma sincérité assumée
amour|tr|Canım|mon cœur, chéri(e)
amour|bn|Crush|Crush (amour)
amour|vi|Iu|coeur, aime (gentille)
amour|pl|Kochanie|chéri(e)
amour|vi|Idol|star préférée, idole, cœur officiel des fans
amour|el|Αγαπώ (agapo)|j'aime (d'amour), je t'aime
amour|zh|破防了 (Pò fáng le)|J'ai complètement craqué ! / Mes larmes ont coulé sans retenir ! / Touché en plein cœur !
amour|ig|Obi ọma|Bonté de cœur : bienveillance active, générosité sans calcul
amour|zh|真爱粉 (Zhēn ài fěn)|Un vrai passionné sincère, un fan authentique qui soutient l'artiste pour son talent.
amour|th|ใจดี (jai dee)|gentil, bienveillant
amour|el|Αγάπη (agapi)|l'amour
amour|ko|연애 (yeonae)|la vie amoureuse, sortir ensemble
amour|ar|زي العسل على قلبي (Zay Al-'Asal 'Ala Qalbi)|Un pur bonheur / Un régal / Ça me fait tellement plaisir.
amour|ko|짝사랑 (jjaksarang)|amour non partagé
amour|am|ልብ አድርግ (lib adirig)|prends note, retiens bien, fais attention
amour|tr|Aşkım|mon amour
amour|el|Αγάπη μου (agapi mou)|mon amour
amour|ur|جانو (janu)|mon amour (affectueux)
amour|tl|Hugot|Réplique profonde et émotionnelle (souvent sur l'amour)
amour|ur|میری جان (meri jaan)|Mon cœur (compliment suprême entre amis)
amour|th|นก|se faire larguer, être refusé (amour non rendu)
amour|hi|Deewana|fou d'amour, accro
amour|tr|Allah aşkına|pour l'amour de Dieu, je t'en supplie
amour|ko|두근두근 (dugeun dugeun)|battements de cœur, palpitations
amour|hi|Babu|monsieur, cheri, fame de cœur
amour|de|Liebling|chéri, mon amour
amour|de|Crush|béguin, coup de cœur
amour|it|Red flag|signal d'alarme (surtout en amour)
amour|pl|Wkuwać|apprendre par cœur à la dure
amour|pl|Zakuć|bûcher, apprendre par cœur
amour|pt|Talaricagem|trahison en amour
amour|de|Herzschmerz|chagrin d'amour
hustle|ur|Jugaad|Systeme D, debrouille, hack
hustle|hi|जुगाड़ (jugaad)|système D, débrouille (mot culturel fort)
hustle|tl|Hustle|Travail acharné, side hustle
hustle|hi|Dhanda|le business, le commerce de fortune
hustle|pt|Malandragem|débrouille, savoir-faire de rue
hustle|pl|Cwaniactwo|la débrouille, la manigance
hustle|it|Grindare|enchaîner les parties pour progresser
hustle|ru|горбатиться (gorbatit'sya)|bosser dur
salutation|ar|اهلا وسهلا|Bienvenue
salutation|ar|سلام|Salut, bonjour (court)
salutation|am|እንደምን አለህ (Endemin aleh?)|comment vas-tu ? — question posée à un homme
salutation|pt|E aí?|salut, ça va ?
salutation|el|Γεια (geia)|salut
salutation|ar|هلا|Salut, bonjour
salutation|am|እንኳን ደህና መጣህ (enkuwan dehna metah)|bienvenue — à un homme
salutation|th|สบายดี (sabai dee)|ça va bien
salutation|am|ሰላም (selam)|salut, paix
salutation|bn|Kemon Acho|Comment vas-tu ?
salutation|el|Γεια σου (geia sou)|salut (à une personne)
salutation|pl|Cześć|salut (le plus courant)
salutation|id|Bisa dikondisikan|Ça va se goupiller / On va trouver un arrangement / T'inquiète, je gère.
salutation|tr|Selam|salut
salutation|fa|چطوری (chetori)|comment vas-tu
salutation|el|τι κάνεις (ti kaneis)|comment vas-tu
salutation|ko|안녕 (annyeong)|salut (familier, entre jeunes)
salutation|vi|Ét ô ét|ça va, tout va bien (sur le ton de la bouffonnerie)
salutation|zh|拜拜|Salut / au revoir (familier)
salutation|ig|Ndewo|Salutation générale et respectueuse, équivalent de « bonjour » en toutes saisons
salutation|it|Come va?|ça va ?
salutation|it|Come stai?|comment vas-tu ?
salutation|id|Sampurasun|Bonjour (sundanais politesse)
salutation|ur|Kya haal hai|Comment ca va
salutation|ig|Nnọọ|bienvenue
salutation|vi|Ổn|ça va, d'accord
salutation|pl|W porządku|ça va, d'accord, correct
salutation|bn|কেমন আছিস? (kemon achis?)|comment vas-tu ? (familièrement, entre proches)
salutation|de|Passt schon|ça va, c'est bon
salutation|de|Moin|salut à toute heure
salutation|pl|Hej|salut
salutation|it|Ciao ciao|salut salut
salutation|pt|Salve|salut (entre jeunes)
salutation|tr|İyi misin?|ça va ? (inquiétude)
salutation|de|Servus|salut (Bavière / Autriche)
salutation|ig|Ọ dị mma|c'est bien, OK
salutation|tl|Kumusta|comment ça va
salutation|pt|Tá|OK, ça va
salutation|ur|کیا حال ہے (kya haal hai)|comment ça va
salutation|bn|কি অবস্থা (ki obostha)|comment ça va ?
salutation|hi|Thik hain|ça va, d'accord
salutation|ur|اور بھائی، کیا حال؟ (aur bhai, kya haal?)|Salut bro, ça dit quoi ?
salutation|tr|Nasıl gidiyor?|comment ça se passe ?
salutation|fa|چت شده؟ (chet shode?)|qu'est-ce qui t'arrive ?, ça va pas ?
salutation|es|va|ok, d'accord
salutation|id|Asena|n'importe comment, chacun son tempo
merci|tl|Maraming salamat|Merci beaucoup
merci|fa|Merci|Merci (taarof basique)
merci|fa|Tashakor게م|Merci beaucoup (taarof)
merci|fa|Tashakor|Merci (formel)
merci|am|እግዚአብሔር ይመስገን (egziabher yimesgen)|Dieu merci, grâce à Dieu — la louange qui suit « je vais bien »
merci|am|አመሰግናለሁ፣ እግዚአብሔር ይባርክህ (Ameseginalehu, Egziabher yibarkih)|Merci infiniment / Que Dieu te bénisse (adressé à un homme).
merci|am|እግዚአብሔር ይስጥልኝ (egziabher yistilign)|merci — le remerciement chargé de foi, pour un don ou un grand service
merci|zh|吃水不忘挖井人 (Chī shuǐ bù wàng wā jǐng rén)|N'oublie jamais de faire preuve de gratitude envers ceux qui t'ont aidé à réussir.
merci|th|ขอบคุณ (kop khun)|merci
merci|ar|يعطيك العافية|Merci beaucoup
merci|ar|الله يبارك فيك|Merci (réponse)
merci|tl|Salamat|merci
merci|ig|Chukwu gozie gị|Bénédiction chaleureuse qui élève la gratitude après un service rendu
merci|ig|Daalụ|merci
merci|pt|Valeu|merci, c'est cool
merci|ar|تسلم|Merci (réponse affectueuse)
merci|it|Grazie mille|merci mille fois
merci|tr|Sağ ol|merci, c'est gentil
merci|ko|수고했어 (sugohaesseo)|merci pour ton travail
merci|tl|Utang na loob|Dette de gratitude, reconnaissance éternelle
merci|tr|Eyvallah|merci, ça marche (argot)
merci|tr|Ellerine sağlık|merci pour ce repas (compliment à la cuisinière)
merci|ja|お疲れ様 (otsukaresama)|bravo pour ton travail (formule universelle)
merci|pt|Brigado|merci (familier)
merci|pt|Vlw|merci (texto)
merci|th|แต๊งกิ้วหลาย|merci beaucoup
merci|zh|拴Q (shuān Q)|merci (ironique, souvent lassé)
merci|it|Grazie al cazzo|merci, sans blague (ironique, vulgaire)
merci|zh|栓Q (shuān Q)|merci (sarcastique)
merci|ko|ㄳ (gamsa, texto)|merci (texto)
merci|es|genio|génial, merci
adieu|ig|Ka ọ dị|Au revoir, à bientôt
adieu|am|ደህና ሁኚ (Dehna hugni)|Au revoir / Porte-toi bien (adressé à une femme).
adieu|am|ደህና ሁኑ (Dehna hunu)|Au revoir à vous tous / Portez-vous bien (forme de politesse ou collective).
adieu|am|ደህና ሁን (dehna hun)|au revoir, porte-toi bien — à un homme
adieu|ar|مع السلامة|Au revoir
adieu|th|บุย|au revoir (mignon)
adieu|ko|ㅂㅂ (bye bye, texto)|bye bye (texto)
adieu|pt|Paz|paix (salut urbain, au revoir)
adieu|pl|Nara|à plus, bye
adieu|tl|GBU|que Dieu te bénisse (au revoir texto)
exclamation|tl|Grabe|Incroyable
exclamation|id|Bjir|Exclamation de stupeur (génération TikTok)
exclamation|id|Anjay|Exclamation de surprise, d'admiration ou de stupéfaction (équivalent de 'Wouah !' ou 'Incroyable !').
exclamation|zh|牛逼 (niúbī)|incroyable, balèze
exclamation|ar|يا عيني (Ya 'Eyni)|Quel bonheur ! / Magnifique ! / Ah la la ! (exclamation de satisfaction ou de nostalgie poétique).
exclamation|vi|Đô mạnh|Avoir une descente incroyable, tenir très bien l'alcool sans flancher.
exclamation|el|όπα (opa)|exclamation de joie : hop !
exclamation|id|Semwah|Exclamation lassante des réseaux (constat fatigué)
exclamation|fa|به به (bah bah)|wow, magnifique
exclamation|th|หรอ|ah ouais ? (rétorquer avec ironie)
exclamation|zh|买它|Exclamation virale des livestreams shopping (Li Jiaqi)
exclamation|vi|Quèo|ah oui, si tu te croires
exclamation|vi|Ừ hi|ah ah ouais (fed up moqueuse)
exclamation|zh|你人还怪好的 (nǐ rén hái guài hǎo de)|Compliment surprise au ton de campagne, format mème
exclamation|tl|Issh|Issh (expression de surprise)
exclamation|tr|Vay be|wow, la vache
exclamation|hi|क्या बात है (kya baat hai)|bravo, wow (approbation chaleureuse)
exclamation|th|อ๋อ|ah, j'ai compris !
exclamation|fa|وای (vây)|oh !, wow !, aïe !
exclamation|fa|Rohollah|Par Dieu (expressions de surprise)
exclamation|ar|يا خابر (Ya Khaber)|Mon Dieu ! / Quelle histoire ! / Incroyable (exclamation de surprise devant une information complexe).
exclamation|th|อ้าว|huh ? vraiment ?
exclamation|de|Wild|incroyable, dingue
exclamation|tl|Petmalu|incroyable, hors norme
exclamation|ja|よっしゃ (yossha)|yes !, c'est parti
exclamation|pt|Vixe|oula ! (surprise, souci)
exclamation|ig|Mba|Refus catégorique, protestation amicale, exclamation d'étonnement
exclamation|el|Καλώς τα (kalos ta)|ah, te voilà ! (accueil)
exclamation|tr|Ha|ah ! (je vois)
exclamation|ko|대박 (daebak)|waouh, dingue ; génial, incroyable
exclamation|es|hostia|putain (surprise)
exclamation|ko|헐 (heol)|oh là là ! (surprise, choc)
exclamation|hi|Achcha|ah, d'accord ; bon ; de l'interrogation à l'approbation selon le ton
exclamation|ur|کمال ہے (kamaal hai)|C'est incroyable !
exclamation|ko|레전드 (rejeondeu)|légendaire, incroyable
exclamation|de|Das crazy|« ah ouais », « c'est fou » (réaction passe-partout)
exclamation|pt|Meu Deus|mon Dieu ! (surprise, soulagement, exaspération)
exclamation|pt|Eita|oh !, eh ben !
exclamation|ar|يخرب بيتك|Expression affectueuse/exclamation (ironie)
exclamation|de|Unnormal|incroyable, anormalement fort
exclamation|it|Pazzesco!|dingue, incroyable
exclamation|es|la hostia|quelque chose d'incroyable
exclamation|bn|উরি বাবা (uri baba)|oh là là !, exclamation de surprise
exclamation|bn|জ্ঞানী (gyaani)|utilisée ironiquement : « ah, le génie »
exclamation|es|cuático|incroyable, dingue
exclamation|it|Mecojoni!|eh ben dis donc ! (surprise, admiration, parfois ironie)
exclamation|it|Mizzica!|mince ! eh ben ! (surprise ou agacement)
exclamation|hi|Dhaansu|stupéfiant, wow
famille|zh|家人们谁懂啊 (jiārénmen shéi dǒng a)|SOS comique au public : comprenez-moi, c'est indescriptible
famille|ru|Предки|Parents (père et mère)
famille|th|จัดเต็ม|tout donner, y aller à fond
famille|zh|全职儿女 (quánzhí érnǚ)|Jeunes adultes « salariés » par leurs parents pour rester à la maison : courses, cuisine, compagnie
famille|ig|Anụrị|Le bien-être qui se dit à haute voix : bonne nouvelle, naissance, vœux de famille
famille|ko|막내 (mangnae)|le benjamin (de la famille, du groupe)
famille|ig|Ụmụ nne|frères et sœurs, la famille
famille|ru|родня (rodnya)|famille
famille|vi|Full nhà|doté dès la naissance (tout le budget familial déjà compté)
respect|ig|Nneka|Respect sacré de la mère et refuge maternel
respect|zh|社死现场 (Shè sǐ xiàn chǎng)|Le moment exact de la honte suprême en public.
respect|fa|Fersomja|Honte, perdre la face
respect|tl|Hiya|Sentiment de honte, de timidité ou de bienséance
respect|ru|кринж (krinzh)|la honte, le second degré douloureux
respect|vi|Mặt dày|Sans-gêne, effronté, n'avoir aucune honte à insister ou réclamer.
respect|de|Respekt|respect, chapeau
respect|zh|社死 (shè sǐ)|honte tellement intense qu'on « meurt » socialement
respect|am|እባክዎን (Ebakwon)|S'il vous plaît / Je vous en prie (forme de politesse marquant le respect).
respect|id|Muka tebal|Être sans vergogne, effronté, n'avoir aucune honte à réclamer ou mal agir.
respect|tr|Yazıklar olsun|honte à toi
respect|ig|Onye wetara ọjị wetara ndụ|Offrir la kola est le premier acte d'amitié, de respect et d'accueil
respect|ur|کیا بات ہے! (kya baat hai!)|Respect ! Carrément ! (impression, bonne nouvelle)
respect|hi|Pakka|c'est sûr, parole d'honneur
respect|fa|جریمه|Amende (retard/non-respect)
respect|tr|Şerefsiz|sans honneur, salaud (vulgaire)
respect|pt|Vergonha alheia|honte par procuration
respect|pt|Moral|respect ; la bonne attitude
respect|th|งามไส้|quelle honte, quelle plaisanterie
respect|ko|창피 (changpi)|la honte, honteux
respect|hi|Bhaijaan|grand frère respecté (persona de Salman Khan)
respect|de|Fremdschämen|honte par procuration (cringe)
respect|ko|쪽팔려 (jjokpallyeo)|la honte, se sentir tout con
respect|pt|Passar vergonha|avoir honte en public
respect|tr|Şerefe|à ta santé (trinquer)
respect|de|Ehrenlos|sans honneur, abusé
respect|ko|ㅎㄷㄷ (hudeok, texto)|frissons, respect impressionné
respect|it|Bella lì|ça déchire, respect (jeune)
respect|ar|عيب|c'est mal, pas bien
respect|ur|استاد (ustaad)|Le pro, titre de respect entre potes
respect|ar|حشومة|honte, gêne
respect|ru|кринжовать|avoir la honte
respect|hi|Ji|« monsieur/madame » affectueux, parfois sarcastique selon l'entité
dieu|ar|ربنا يستر (Rabbana Yastur)|Que Dieu nous en préserve ! / Espérons que tout se passe bien / Pourvu qu'il n'y ait pas de dégâts !
dieu|am|እግዚአብሔር ይመስገን፣ ደህና ነኝ (Egziabher yimesgen, dehna megn)|Grâce à Dieu, je vais bien / Ça va très bien.
dieu|ig|Chukwu kere ụwa|Vœu d'émerveillement et de reconnaissance devant un accomplissement merveilleux
dieu|vi|Sướng tê người|Un plaisir divin, être au paradis (après un massage, un bon plat ou une excellente nouvelle).
dieu|ig|Ihe Chukwu kwuru ga-eme|Confiance totale dans la providence : ce qui est promis arrivera
dieu|am|አይነካህ (Aynekah)|Que Dieu te protège de tout mal ! / Santé à toi !
dieu|zh|学神 (xuéshén)|Élève brillant sans effort apparent : dix minutes de révision, notes parfaites
dieu|ar|الله معك|Que Dieu te protège
dieu|am|መንገዱን ያቅናልህ (Mengedun yaqinalih)|Que Dieu facilite ta route et tes démarches / Bon succès dans ton trajet.
dieu|ar|والله (wallah)|je te jure
dieu|ig|Chukwu nọ nso|Réconfort : la providence est aux côtés de celui qui traverse une épreuve
dieu|zh|yyds|GOAT, le meilleur de tous les temps
dieu|vi|Trời ơi|oh mon dieu (exclamation)
dieu|id|Astaga|oh mon Dieu (exclamation)
dieu|ja|神 (kami)|divin, parfait (admiratif)
dieu|ur|واللہ (wallahi)|Je le jure (pour insister sur la vérité)
dieu|el|Θεός (theos)|un dieu (parfait, admiration)
dieu|tr|İnşallah|si Dieu le veut
dieu|id|Yaampun|mais bordel / oh la la
dieu|tr|Kısmet|le destin (surtout amoureux)
dieu|ko|세상에 (sesang-e)|mon dieu, c'est pas possible
dieu|it|Oddio!|mon dieu !
dieu|zh|天秀|Une performance très impressionnante
dieu|pl|Boski|divin, canon
dieu|ko|갓 (gat)|dieu, de génie (préfixe admiratif)
dieu|tr|Maşallah|mashallah (protection, admiration)
dieu|ur|اللہ کی قسم (allah ki qasam)|Je jure devant Allah, c'est vrai
dieu|ja|神対応 (kamitaiou)|une réaction parfaite, un service au top
dieu|th|เทพ|excellent, d'un niveau divin
dieu|ko|맙소사 (mapsosa)|mon dieu, miséricorde
dieu|ja|神回 (kamikai)|un épisode divin, culte
dieu|fa|خدایی؟ (khodâyi?)|sérieux ? vraiment ?
dieu|de|Inshallah|si Dieu veut
dieu|pt|Mds|mon Dieu ! (surprise, exaspération)
dieu|th|วาสนา|que-limers, maigre part
dieu|de|Wallah|je le jure, promis
dieu|de|Mashallah|mashallah (admiration, protection)
dieu|hi|Bhains ki aankh|oh là là ! mon Dieu !
`;

type Parsed = {
  slug: string;
  labelFr: string;
  labelEn: string;
  entries: { lang: string; expr: string; gloss: string }[];
};

/** Parse le bloc verbatim (aucune donnée inventée, ordre conservé). */
export function parseCrossData(raw: string): Parsed[] {
  const bySlug = new Map<string, Parsed>();
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const parts = l.split("|").map((p) => p.trim());
    if (parts.length === 3) {
      // En-tête de concept : CONCEPT|label_fr|label_en
      const [slug, labelFr, labelEn] = parts;
      if (!bySlug.has(slug)) {
        bySlug.set(slug, { slug, labelFr, labelEn, entries: [] });
      }
    } else if (parts.length === 4) {
      // Entrée : CONCEPT|lang|expression|gloss_fr
      const [slug, lang, expr, gloss] = parts;
      let c = bySlug.get(slug);
      if (!c) {
        c = { slug, labelFr: slug, labelEn: slug, entries: [] };
        bySlug.set(slug, c);
      }
      if (!c.entries.some((e) => e.lang === lang && e.expr === expr)) {
        c.entries.push({ lang, expr, gloss });
      }
    }
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Tous les concepts, triés par slug (lecture publique). */
export const getCrossConcepts = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("crossConcepts").collect();
    return rows
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((r) => ({
        slug: r.slug,
        labelFr: r.labelFr,
        labelEn: r.labelEn,
        entries: r.entries,
      }));
  },
  returns: v.array(
    v.object({
      slug: v.string(),
      labelFr: v.string(),
      labelEn: v.string(),
      entries: v.array(
        v.object({ lang: v.string(), expr: v.string(), gloss: v.string() }),
      ),
    }),
  ),
});

/** Un concept avec ses entrées enrichies (PHASE 10-B). */
type ConceptDetailEntry = {
  lang: string;
  expr: string;
  gloss: string;
  /** Contexte enrichi (issu de slangExpressions) ou null — le composant
   *  ContextParser gère le fallback brut. */
  context: string | null;
  literal: string | null;
  register: string | null;
  region: string | null;
};

/** Clé de jointure crossConcepts ↔ slangExpressions : on enlève la
 *  translittération entre parenthèses (« 氪金玩家 (Kè jīn wán jiā) ») et on
 *  normalise casse/espaces — les deux sources partagent la même chaîne dans
 *  la grande majorité des cas, la variante décore seulement. */
function joinKey(expr: string): string {
  const base = expr.replace(/\s*\([^)]*\)\s*/g, " ").trim().toLowerCase();
  return base.length > 0 ? base : expr.trim().toLowerCase();
}

/**
 * Détail d'un concept (lecture publique) — toutes les langues.
 * Enrichissement via la base slang : quand l'expression existe aussi dans
 * `slangExpressions`, on ramène son `context` (souvent le format 4 parties
 * rendu par <ContextParser/>) ainsi que registre et région. Rien n'est
 * inventé à l'affichage : sans correspondance, `context` reste null.
 */
export const getConceptDetails = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const row = await ctx.db
      .query("crossConcepts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!row) return null;

    // Un seul passage par langue présente dans le concept (index by_language,
    // cap généreux : le seed fait ~85 fiches par langue en moyenne).
    const langs = [...new Set(row.entries.map((e) => e.lang))];
    const perLang = await Promise.all(
      langs.map(async (lang) => {
        const slang = await ctx.db
          .query("slangExpressions")
          // Le seed des ponts n'utilise que les codes du catalogue ; le
          // cast raccorde la chaîne libre à l'union littérale du schéma.
          .withIndex("by_language", (q) => q.eq("language", lang as LanguageCode))
          .take(200);
        const map = new Map<string, (typeof slang)[number]>();
        for (const s of slang) map.set(joinKey(s.expression), s);
        return [lang, map] as const;
      }),
    );
    const byLang = new Map(perLang);

    const entries: ConceptDetailEntry[] = row.entries.map((e) => {
      const s = byLang.get(e.lang)?.get(joinKey(e.expr));
      return {
        lang: e.lang,
        expr: e.expr,
        gloss: e.gloss,
        context: s?.context ?? null,
        literal: s?.literal ?? null,
        register: s?.register ?? null,
        region: s?.region ?? null,
      };
    });
    return {
      slug: row.slug,
      labelFr: row.labelFr,
      labelEn: row.labelEn,
      entries,
    };
  },
  returns: v.nullable(
    v.object({
      slug: v.string(),
      labelFr: v.string(),
      labelEn: v.string(),
      entries: v.array(
        v.object({
          lang: v.string(),
          expr: v.string(),
          gloss: v.string(),
          context: v.union(v.string(), v.null()),
          literal: v.union(v.string(), v.null()),
          register: v.union(v.string(), v.null()),
          region: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
});

/** Cœur du seed, partagé entre la mutation interne et le wrapper public :
 *  le pilote d'exploitation (`scripts/seed-backend.mjs`) passe par le CLI
 *  Convex, qui ne peut exécuter QUE des fonctions publiques (`npx convex run`).
 *  L'ancienne étape 4 du pilote visait `crossSeed:seedCrossConcepts` (interne)
 *  et échouait donc à chaque exécution complète du pilote. */
/** Sérialisation canonique : clés triées récursivement. La comparaison
 *  naïve `JSON.stringify(a) !== JSON.stringify(b)` était sensible à l'ORDRE
 *  des clés : le même contenu lu depuis Convex repartait avec un ordre
 *  différent et déclenchait des patchs fantômes à chaque re-exécution du
 *  seed (idempotence brisée : 20 « updates » sur des contenus identiques). */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

async function seedCrossConceptsImpl(ctx: MutationCtx) {
  const parsed = parseCrossData(RAW);
  const existing = await ctx.db.query("crossConcepts").collect();
  const bySlug = new Map(existing.map((r) => [r.slug, r]));
  let created = 0;
  let updated = 0;
  for (const p of parsed) {
    const row = bySlug.get(p.slug);
    if (!row) {
      await ctx.db.insert("crossConcepts", p);
      created += 1;
    } else if (
      row.labelFr !== p.labelFr ||
      row.labelEn !== p.labelEn ||
      canonicalJson(row.entries) !== canonicalJson(p.entries)
    ) {
      await ctx.db.patch(row._id, {
        labelFr: p.labelFr,
        labelEn: p.labelEn,
        entries: p.entries,
      });
      updated += 1;
    }
  }
  // Nettoyage : concepts disparus du seed (sécurité).
  const keep = new Set(parsed.map((p) => p.slug));
  for (const row of existing) {
    if (!keep.has(row.slug)) {
      await ctx.db.delete(row._id);
    }
  }
  return { concepts: parsed.length, created, updated };
}

const SeedCrossReturns = v.object({
  concepts: v.number(),
  created: v.number(),
  updated: v.number(),
});

/** Seed idempotent : upsert par slug.
 *  PHASE 11 (C-3) — INTERNE : historiquement appelé depuis le client (Atlas,
 *  à chaque montage) ; l'écriture est réservée à l'exploitation.
 *  Le seed reste idempotent, donc rejouable à volonté.
 *  ATTENTION : ce seed est un upsert PURGEANT — les concepts absents du
 *  seed sont supprimés de la table `crossConcepts` (et rien d'autre).
 *
 *  SÉCURITÉ : AUCUN wrapper public n'existe, volontairement. Une mutation
 *  publique sans argument aurait permis à n'importe quel client de lancer
 *  la purge de `crossConcepts`. Le CLI Convex authentifié exécute les
 *  fonctions INTERNES (`npx convex run internal.crossSeed.seedCrossConcepts`,
 *  voir docs.convex.dev/cli/overview : « Run a public or internal Convex
 *  query, mutation, or action »), ce qui suffit au pilote d'exploitation
 *  `scripts/seed-backend.mjs` — et laisse l'application sans chemin d'accès. */
export const seedCrossConcepts = internalMutation({
  args: {},
  handler: (ctx) => seedCrossConceptsImpl(ctx),
  returns: SeedCrossReturns,
});
