import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════════
   LOT ALLEMAND — « Jugendwort des Jahres 2025 » + argot contemporain
   99 fiches, sur les 107 reçues (voir « fiches écartées » plus bas).

   Sources : la sélection officielle Langenscheidt du Jugendwort des Jahres
   2025 (Checkst du?, Das crazy, Lowkey, Rede!, Sybau, Tot, Tuff, Goonen),
   puis cinq familles d'usage courant — réactions et émotions, amitiés et
   façons de s'adresser, compliments et critiques, réseaux & gaming,
   sorties et relations.

   Conventions (identiques aux lots 1 à 4 et à la vague 1) :
   • registres rabattus sur le vocabulaire du seed : « courant » et
     « familier » → casual ; « argot jeune » oral → street ; « réseaux /
     gaming / internet » → internet ; grossièreté explicite → vulgar.
     Le registre « régional » n'existe pas dans le schéma : il est porté par
     `region` (« Allemagne (Berlin) ») et par le texte de la fiche, comme
     dans tous les lots précédents ;
   • `literal` toujours renseigné : c'est le sens mot à mot qui explique
     l'image, indispensable pour les calques anglais (das crazy, lowkey,
     cringe) et les emprunts (baba, akh, lan) ;
   • aucune fiche ne reprend une expression DÉJÀ semée : `npm run
     verify:seeds` échoue sur toute collision de slug, et il est câblé dans
     `verify:honesty` et la CI.

   FICHES ÉCARTÉES DU LOT REÇU (8) — déjà en base depuis les lots 1 à 4 :
     • Digga   — exclu par le brief lui-même ;
     • Habibi, Ehrenmann, Ehrenfrau, Gönn dir, Abhängen, Chillen,
       Vorglühen, Anmachen — présentes telles quelles dans la base.
   Elles ne sont PAS recopiées ici : un doublon serait rejeté au semis et
   ferait échouer `verify:seeds`. Les quasi-variantes dont le slug diffère
   sont en revanche conservées, car elles existent réellement en allemand
   (Homie / Homies, Akh / Akhi, Läuft / Läuft bei dir!, Feiern /
   Feiern gehen, Macher / Macher-Move, Korb geben / bekommen / kassieren).

   CONTENU ADULTE — « goonen » porte `isAdult: true`. Le champ est OPTIONNEL
   et absent partout ailleurs : absent ne vaut PAS « interdit », il vaut
   « rien à signaler » (exactement la règle de `validated`). Il ne masque
   rien : l'apprenant est prévenu, pas empêché.
   ═══════════════════════════════════════════════════════════════════════ */

export const SLANG_SEED_ENRICHMENT_DE: SlangSeed[] = [
  // ════════════════ JUGENDWORT DES JAHRES 2025 — 8 ════════════════
  { language: "de", expression: "Checkst du?", literal: "« (tu) vérifies ? » — de l'anglais to check", meaning: "tu comprends ? tu vois ce que je veux dire ?", context: "« Ich hab keine Lust mehr, checkst du? » — j'en peux plus, tu vois ?", register: "casual", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Das crazy", literal: "« ça (le) fou » — calque de l'anglais", meaning: "« ah ouais », « c'est fou » (réaction passe-partout)", context: "« Die Party war das crazy! » — la soirée était incroyable !", register: "casual", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Lowkey", literal: "« à voix basse » (anglicisme)", meaning: "un peu, discrètement, au fond de soi", context: "« Ich bin lowkey müde. » — je suis un peu crevé, mine de rien.", register: "internet", region: "Allemagne", popularity: 64 },
  { language: "de", expression: "Rede!", literal: "« parle ! » — impératif de reden", meaning: "« dis-le ! », « c'est exactement ça ! » (approbation vive)", context: "« Der Film war langweilig. – Rede! » — ce film était ennuyeux. – Exactement, dis-le !", register: "street", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Sybau", literal: "sigle anglais « shut your bitch ass up »", meaning: "ferme-la (souvent ironique entre potes)", context: "« Sybau doch! » — la ferme un peu !", register: "vulgar", region: "Allemagne", popularity: 48 },
  { language: "de", expression: "Tot", literal: "« mort » — détournement du sens propre", meaning: "nul, gênant, complètement raté", context: "« Die Präsentation war komplett tot. » — la présentation était complètement ratée.", register: "street", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Tuff", literal: "« dur, costaud » (anglicisme)", meaning: "stylé, impressionnant, cool", context: "« Dein neues Auto ist echt tuff! » — ta nouvelle caisse est trop stylée !", register: "street", region: "Allemagne", popularity: 56 },
  { language: "de", expression: "Goonen", literal: "de l'anglais « goon » (abruti, sbire)", meaning: "se masturber longuement, sans fin — CONTENU ADULTE", context: "« Der Typ goont schon wieder den ganzen Tag. » — le mec y passe encore la journée entière.", register: "vulgar", region: "Allemagne", popularity: 42, isAdult: true },

  // ════════════════ RÉACTIONS ET ÉMOTIONS — 17 ════════════════
  { language: "de", expression: "Wild", literal: "« sauvage » (anglicisme)", meaning: "incroyable, dingue", context: "« Das Konzert war wild! » — le concert était dingue !", register: "casual", region: "Allemagne", popularity: 74 },
  { language: "de", expression: "Heftig", literal: "« violent, fort »", meaning: "violent, impressionnant", context: "« Der Sturm gestern war heftig. » — la tempête d'hier était violente.", register: "casual", region: "Allemagne", popularity: 78 },
  { language: "de", expression: "Heftig krass", literal: "« violemment crasse » — surenchère", meaning: "vraiment intense", context: "« Die Achterbahn war heftig krass! » — le grand huit était vraiment hard !", register: "casual", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Wahnsinn", literal: "« délire, folie »", meaning: "de la folie", context: "« Das ist doch Wahnsinn! » — c'est de la folie !", register: "casual", region: "Allemagne", popularity: 80 },
  { language: "de", expression: "Heftig nice", literal: "« violemment » + « sympa » — mélange allemand/anglais", meaning: "vraiment génial", context: "« Dein Outfit ist heftig nice! » — ta tenue est trop cool !", register: "casual", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Stabil", literal: "« stable, solide »", meaning: "solide, respectable", context: "« Deine Arbeit ist stabil. » — ton boulot est carré.", register: "street", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Lost", literal: "« perdu » (anglicisme)", meaning: "perdu, à côté de la plaque", context: "« Der Typ ist komplett lost. » — le mec est complètement à l'ouest.", register: "internet", region: "Allemagne", popularity: 68 },
  { language: "de", expression: "Verpeilt", literal: "de « verpeilen », viser à côté", meaning: "à l'ouest, distrait", context: "« Ich hab meinen Schlüssel verpeilt. » — j'ai paumé ma clé.", register: "casual", region: "Allemagne", popularity: 68 },
  { language: "de", expression: "Verwirrt", literal: "« embrouillé, emmêlé »", meaning: "perplexe, confus", context: "« Ich bin total verwirrt. » — je suis complètement perdu.", register: "casual", region: "Allemagne", popularity: 72 },
  { language: "de", expression: "Cringe", literal: "« se recroqueviller » (anglicisme)", meaning: "gênant, embarrassant", context: "« Das Video war mega cringe. » — la vidéo était hyper gênante.", register: "internet", region: "Allemagne", popularity: 80 },
  { language: "de", expression: "Peinlich", literal: "« pénible, affligeant »", meaning: "embarrassant, honteux", context: "« Das war so peinlich! » — c'était trop la honte !", register: "casual", region: "Allemagne", popularity: 76 },
  { language: "de", expression: "Unnormal", literal: "« pas normal » — négation retournée en intensif", meaning: "incroyable, anormalement fort", context: "« Der Typ ist unnormal stark! » — le mec est anormalement fort !", register: "street", region: "Allemagne", popularity: 64 },
  { language: "de", expression: "Bodenlos", literal: "« sans fond »", meaning: "honteux, catastrophique", context: "« Sein Verhalten war bodenlos. » — son comportement était indigne.", register: "internet", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Ehrenlos", literal: "« sans honneur » — de Ehre, honneur", meaning: "sans honneur, abusé", context: "« Das war echt ehrenlos von ihm. » — franchement, il n'a pas assuré.", register: "street", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Ich schwöre", literal: "« je jure »", meaning: "je te jure (pour appuyer une affirmation)", context: "« Ich schwöre, das war echt so! » — je te jure, c'était vraiment comme ça !", register: "casual", region: "Allemagne", popularity: 76 },
  { language: "de", expression: "Safe", literal: "« sûr » (anglicisme)", meaning: "carrément, sûr", context: "« Kommst du morgen? – Safe! » — tu viens demain ? – Carrément !", register: "street", region: "Allemagne", popularity: 72 },
  { language: "de", expression: "Wild einfach", literal: "« sauvage » + « simplement »", meaning: "tout simplement dingue", context: "« Das war wild einfach! » — c'était juste dingue !", register: "internet", region: "Allemagne", popularity: 54 },

  // ════════════════ AMITIÉS ET FAÇONS DE S'ADRESSER — 18 ════════════════
  { language: "de", expression: "Bruder", literal: "« frère »", meaning: "frère, frérot", context: "« Hey Bruder, wie geht's? » — hey frérot, ça va ?", register: "casual", region: "Allemagne", popularity: 84 },
  { language: "de", expression: "Bro", literal: "« frère » (abrégé de l'anglais brother)", meaning: "frérot", context: "« Bro, hast du Feuer? » — frérot, t'as du feu ?", register: "street", region: "Allemagne", popularity: 80 },
  { language: "de", expression: "Bre", literal: "troncation de « Bruder »", meaning: "frérot, pote", context: "« Bre, was geht? » — frérot, quoi de neuf ?", register: "street", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Akh", literal: "de l'arabe « أخ » (frère)", meaning: "frère, frérot", context: "« Akh, komm mal her! » — frérot, viens voir !", register: "street", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Digger", literal: "de « Dicker », le gros — devenu une adresse à Berlin", meaning: "mec, frérot (forme proche de Digga, déjà en base)", context: "« Digger, hast du das gesehen? » — mec, t'as vu ça ?", register: "street", region: "Allemagne", popularity: 78 },
  { language: "de", expression: "Junge", literal: "« garçon » — interpellation exclamative", meaning: "mec, gars", context: "« Junge, was machst du? » — mec, qu'est-ce que tu fous ?", register: "casual", region: "Allemagne", popularity: 76 },
  { language: "de", expression: "Chef", literal: "« chef, patron »", meaning: "chef, patron (adresse amicale ou ironique)", context: "« Chef, kannst du mir helfen? » — chef, tu peux m'aider ?", register: "casual", region: "Allemagne", popularity: 74 },
  { language: "de", expression: "Meister", literal: "« maître »", meaning: "champion, patron", context: "« Meister, gut gemacht! » — champion, bien joué !", register: "casual", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Kollege", literal: "« collègue »", meaning: "collègue ; mec (selon le ton)", context: "« Hey Kollege, alles fit? » — hey l'ancien, tout baigne ?", register: "casual", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Homie", literal: "« pote du quartier » (anglicisme)", meaning: "pote proche", context: "« Homie, wir müssen reden. » — pote, il faut qu'on parle.", register: "street", region: "Allemagne", popularity: 68 },
  { language: "de", expression: "Kumpeltyp", literal: "mot-valise de Kumpel (camarade) et Typ (type)", meaning: "type sympa, bon camarade", context: "« Der Neue ist ein echter Kumpeltyp. » — le nouveau est vraiment sympa.", register: "casual", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Macher", literal: "de « machen », faire — celui qui fait", meaning: "quelqu'un qui agit, qui assure", context: "« Der Typ ist ein echter Macher! » — ce mec, c'est un vrai patron !", register: "street", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Legende", literal: "« légende »", meaning: "légende, personne remarquable", context: "« Du bist eine Legende! » — t'es une légende !", register: "casual", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Ehrenbruder", literal: "« frère d'honneur »", meaning: "frère loyal, pote en or", context: "« Ehrenbruder, danke für alles! » — frérot, merci pour tout !", register: "street", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Atze", literal: "vieux mot berlinois pour « frère »", meaning: "pote, frérot (Berlin)", context: "« Atze, was geht? » — frérot, quoi de neuf ?", register: "street", region: "Allemagne (Berlin)", popularity: 54 },
  { language: "de", expression: "Keule", literal: "« massue, gourdin » — adresse du Nord", meaning: "pote, mec", context: "« Keule, hast du Bock? » — mec, ça te dit ?", register: "casual", region: "Allemagne", popularity: 56 },
  { language: "de", expression: "Lan", literal: "troncation du turc « ulan » (garçon)", meaning: "frère, pote (influence turque)", context: "« Lan, komm mal her! » — frérot, viens voir !", register: "street", region: "Allemagne", popularity: 64 },
  { language: "de", expression: "Schwesti", literal: "diminutif familier de « Schwester » (sœur)", meaning: "copine, sœur (ton affectueux)", context: "« Schwesti, wie geht's? » — ma sœur, ça va ?", register: "casual", region: "Allemagne", popularity: 60 },

  // ════════════════ COMPLIMENTS ET CRITIQUES — 20 ════════════════
  { language: "de", expression: "Stabiler Move", literal: "« geste stable »", meaning: "belle initiative, beau geste", context: "« Stabiler Move, danke! » — bien joué, merci !", register: "street", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Sauber", literal: "« propre »", meaning: "propre, bien joué", context: "« Sauber, das hast du gut hinbekommen! » — nickel, tu as bien géré !", register: "casual", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Geisteskrank", literal: "« malade mental »", meaning: "hallucinant, dingue", context: "« Das war geisteskrank! » — c'était hallucinant !", register: "casual", region: "Allemagne", popularity: 68 },
  { language: "de", expression: "Baba", literal: "du turc « baba », père", meaning: "excellent, impressionnant", context: "« Das Essen war baba! » — la bouffe était excellente !", register: "street", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Bombe", literal: "« bombe »", meaning: "excellent, canon", context: "« Der Film war Bombe! » — le film était canon !", register: "casual", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Brett", literal: "« planche » — ce qui frappe fort", meaning: "un truc énorme, marquant", context: "« Das Konzert war ein Brett! » — le concert était énorme !", register: "street", region: "Allemagne", popularity: 54 },
  { language: "de", expression: "Maschine", literal: "« machine »", meaning: "une machine, quelqu'un de très fort", context: "« Der Typ ist eine Maschine! » — ce mec est une machine !", register: "street", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Macher-Move", literal: "« geste de faiseur » — construit sur Macher", meaning: "action de quelqu'un qui assure", context: "« Das war ein echter Macher-Move! » — ça, c'était un vrai geste de patron !", register: "street", region: "Allemagne", popularity: 52 },
  { language: "de", expression: "Korrekt", literal: "« correct »", meaning: "réglo, sympa", context: "« Der Typ ist echt korrekt. » — ce mec est vraiment réglo.", register: "casual", region: "Allemagne", popularity: 68 },
  { language: "de", expression: "Ehrenloser Move", literal: "« geste sans honneur »", meaning: "geste honteux, coup bas", context: "« Das war ein ehrenloser Move! » — ça, c'était un coup bas !", register: "street", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Schwach", literal: "« faible »", meaning: "faible, nul", context: "« Die Leistung war schwach. » — la performance était faible.", register: "casual", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Lächerlich", literal: "« risible »", meaning: "ridicule", context: "« Das ist doch lächerlich! » — c'est ridicule !", register: "casual", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Komplett lost", literal: "« complètement perdu »", meaning: "complètement à l'ouest", context: "« Der Typ ist komplett lost. » — le mec est complètement à l'ouest.", register: "street", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Unnötig", literal: "« inutile » — de nötig, nécessaire", meaning: "inutile, abusé", context: "« Das war echt unnötig! » — franchement, ce n'était pas nécessaire !", register: "casual", region: "Allemagne", popularity: 64 },
  { language: "de", expression: "Sus", literal: "troncation de « suspekt » (anglicisme)", meaning: "suspect, louche", context: "« Der Typ ist sus. » — le mec est louche.", register: "internet", region: "Allemagne", popularity: 72 },
  { language: "de", expression: "Toxisch", literal: "« toxique »", meaning: "toxique", context: "« Die Beziehung war toxisch. » — la relation était toxique.", register: "internet", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Random", literal: "« aléatoire » (anglicisme)", meaning: "sorti de nulle part", context: "« Das war so random! » — c'était tellement sorti de nulle part !", register: "street", region: "Allemagne", popularity: 64 },
  { language: "de", expression: "Stabil geblieben", literal: "« resté stable »", meaning: "être resté solide (sous pression)", context: "« Du bist stabil geblieben, Respekt! » — tu es resté solide, respect !", register: "casual", region: "Allemagne", popularity: 56 },
  { language: "de", expression: "Auf entspannt", literal: "« sur (le mode) détendu »", meaning: "tranquillement, sans pression", context: "« Ich mach das auf entspannt. » — je le fais tranquille.", register: "casual", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Gönnbar", literal: "de « gönnen », s'accorder quelque chose", meaning: "qui mérite qu'on se fasse plaisir", context: "« Das ist echt gönnbar! » — ça mérite vraiment qu'on se fasse plaisir !", register: "street", region: "Allemagne", popularity: 48 },

  // ════════════════ RÉSEAUX SOCIAUX ET GAMING — 20 ════════════════
  { language: "de", expression: "Aura", literal: "« aura » — mot des réseaux, hérité du vocabulaire gaming", meaning: "charisme, présence", context: "« Der Typ hat mega Aura! » — ce mec dégage un truc de fou !", register: "internet", region: "Allemagne", popularity: 74 },
  { language: "de", expression: "Aura verlieren", literal: "« perdre son aura »", meaning: "perdre la face, se ridiculiser", context: "« Er hat seine Aura verloren. » — il a perdu la face.", register: "internet", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Minus-Aura", literal: "« aura négative »", meaning: "manque de charisme", context: "« Der Typ hat Minus-Aura. » — ce mec n'a aucun charisme.", register: "internet", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Plus-Aura", literal: "« aura positive »", meaning: "beaucoup de charisme", context: "« Sie hat Plus-Aura! » — elle dégage un truc fou !", register: "internet", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Schere heben", literal: "« lever les ciseaux » — geste venu du streaming", meaning: "reconnaître sa faute", context: "« Er hat die Schere gehoben. » — il a fini par reconnaître.", register: "internet", region: "Allemagne", popularity: 50 },
  { language: "de", expression: "Talahon", literal: "mot venu des vidéos TikTok (racine arabe)", meaning: "terme associé à une tendance urbaine des réseaux", context: "« Das ist so Talahon-Style. » — c'est trop ce style de quartier.", register: "internet", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "NPC", literal: "« personnage non joueur »", meaning: "personne prévisible, sans personnalité", context: "« Der Typ ist ein NPC. » — ce mec est un figurant.", register: "internet", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Cringe sein", literal: "« être gênant » — locution construite sur cringe", meaning: "être gênant", context: "« Das Video ist cringe. » — la vidéo est gênante.", register: "internet", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Flexen", literal: "de l'anglais « to flex », contracter (ses muscles)", meaning: "frimer, exhiber", context: "« Er flext mal wieder. » — il frime encore.", register: "street", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Clout", literal: "« influence » (anglicisme)", meaning: "popularité, influence en ligne", context: "« Der Typ hat mega Clout. » — ce mec a une influence de fou.", register: "internet", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Clout chasen", literal: "« courir après l'influence » (clout + to chase)", meaning: "chercher la popularité à tout prix", context: "« Er clout chased nur. » — il ne fait que ça, courir après les vues.", register: "internet", region: "Allemagne", popularity: 54 },
  { language: "de", expression: "Viral gehen", literal: "« aller viral »", meaning: "devenir viral", context: "« Das Video ist viral gegangen! » — la vidéo est devenue virale !", register: "internet", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Abstürzen", literal: "« dégringoler »", meaning: "planter, dérailler (jeu ou personne)", context: "« Das Spiel ist abgestürzt. » — le jeu a planté.", register: "internet", region: "Allemagne", popularity: 64 },
  { language: "de", expression: "Zocken", literal: "« jouer » (aux cartes, à l'origine)", meaning: "jouer aux jeux vidéo", context: "« Ich zocke heute Abend. » — je joue ce soir.", register: "casual", region: "Allemagne", popularity: 78 },
  { language: "de", expression: "Tryhard", literal: "« qui essaie trop fort » (anglicisme)", meaning: "s'acharner, jouer à fond", context: "« Der Typ tryhard so hard. » — ce mec se donne à fond, c'en est gênant.", register: "internet", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Noob", literal: "« débutant » (anglicisme)", meaning: "débutant, nul", context: "« Der Typ ist ein Noob. » — ce mec est un débutant.", register: "internet", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Ragequit", literal: "« quitter de rage » (anglicisme)", meaning: "quitter sous le coup de la rage", context: "« Er hat ragequitted. » — il a rage-quitté.", register: "internet", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "GG", literal: "sigle anglais « good game »", meaning: "bien joué (fin de partie)", context: "« GG, gut gespielt! » — bien joué, belle partie !", register: "internet", region: "Allemagne", popularity: 72 },
  { language: "de", expression: "AFK", literal: "sigle anglais « away from keyboard »", meaning: "absent du clavier", context: "« Ich bin kurz AFK. » — je m'absente deux minutes.", register: "internet", region: "Allemagne", popularity: 68 },
  { language: "de", expression: "Skill Issue", literal: "« problème de compétence » (anglicisme)", meaning: "manque de compétence (souvent une blague)", context: "« Das war ein Skill Issue. » — c'est un manque de skill, voilà tout.", register: "internet", region: "Allemagne", popularity: 62 },

  // ════════════════ SORTIES ET RELATIONS — 16 ════════════════
  { language: "de", expression: "Rumhängen", literal: "« traîner autour »", meaning: "traîner sans but", context: "« Wir hängen nur rum. » — on traîne, c'est tout.", register: "casual", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Feiern gehen", literal: "« aller fêter » — locution de Feiern (déjà en base)", meaning: "sortir faire la fête", context: "« Wir gehen heute feiern! » — on sort ce soir !", register: "casual", region: "Allemagne", popularity: 74 },
  { language: "de", expression: "Abriss", literal: "« démolition »", meaning: "soirée déchaînée", context: "« Die Party war ein Abriss! » — la soirée était une tuerie !", register: "street", region: "Allemagne", popularity: 56 },
  { language: "de", expression: "Vollgas geben", literal: "« donner plein gaz »", meaning: "y aller à fond", context: "« Wir geben Vollgas! » — on y va à fond !", register: "casual", region: "Allemagne", popularity: 66 },
  { language: "de", expression: "Korb geben", literal: "« donner une corbeille » — image de la demande refusée", meaning: "rejeter quelqu'un", context: "« Sie hat ihm einen Korb gegeben. » — elle l'a envoyé balader.", register: "casual", region: "Allemagne", popularity: 60 },
  { language: "de", expression: "Einen Korb kassieren", literal: "« encaisser une corbeille »", meaning: "se prendre un râteau", context: "« Ich hab einen Korb kassiert. » — je me suis pris un râteau.", register: "casual", region: "Allemagne", popularity: 56 },
  { language: "de", expression: "Korb bekommen", literal: "« recevoir une corbeille »", meaning: "se faire rejeter", context: "« Ich hab einen Korb bekommen. » — je me suis fait recaler.", register: "casual", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Anbandeln", literal: "de « anbinden », nouer (un lien)", meaning: "flirter, entamer une relation", context: "« Die beiden bandeln an. » — les deux commencent à flirter.", register: "casual", region: "Allemagne", popularity: 54 },
  { language: "de", expression: "Zusammen abhängen", literal: "« traîner ensemble » — de Abhängen (déjà en base)", meaning: "passer du temps ensemble", context: "« Wir hängen zusammen ab. » — on passe du temps ensemble.", register: "casual", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Auf jemanden stehen", literal: "« se tenir sur quelqu'un »", meaning: "avoir un faible pour quelqu'un", context: "« Ich steh auf sie. » — elle me plaît.", register: "casual", region: "Allemagne", popularity: 72 },
  { language: "de", expression: "Verknallt sein", literal: "de « knallen », claquer — frappé par la flèche", meaning: "avoir un béguin", context: "« Ich bin verknallt. » — j'ai un béguin.", register: "casual", region: "Allemagne", popularity: 62 },
  { language: "de", expression: "Herzschmerz", literal: "« douleur de cœur »", meaning: "chagrin d'amour", context: "« Ich hab Herzschmerz. » — j'ai le cœur en miettes.", register: "casual", region: "Allemagne", popularity: 58 },
  { language: "de", expression: "Situationship", literal: "« relation-situation » (anglicisme)", meaning: "relation ambiguë sans statut clair", context: "« Wir sind in einer Situationship. » — on est dans une relation floue.", register: "internet", region: "Allemagne", popularity: 64 },
  { language: "de", expression: "Ghosten", literal: "« hanter » (anglicisme)", meaning: "disparaître sans explication", context: "« Er hat mich geghostet. » — il m'a lâchée sans un mot.", register: "internet", region: "Allemagne", popularity: 72 },
  { language: "de", expression: "Läuft", literal: "« ça court »", meaning: "ça roule, tout va bien", context: "« Läuft bei dir! » — ça marche pour toi !", register: "casual", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Hölle nein", literal: "« enfer, non »", meaning: "certainement pas !", context: "« Kommst du mit? – Hölle nein! » — tu viens ? – Certainement pas !", register: "internet", region: "Allemagne", popularity: 56 },
];
