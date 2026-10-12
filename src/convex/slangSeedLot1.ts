import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════
   BATCH LOT 1 — 36 expressions (Phase 2 complément)

   3 langues, 36 lignes, aucune duplication avec les batches existants :
   • 12 de (allemand — nord, Bavière, slang Berlin/Hambourg) ;
   • 12 pt (portugais brésilien — rue, argot jeune, internet) ;
   • 12 it (italien — Rome, banlieue, slang des réseaux).

   Garanties, conformément aux batchs précédents :
   • registres rabattus sur le vocabulaire du seed : « courant/familier » →
     casual ; « argot jeune » sur l'oral → street, sur les réseaux → internet ;
   • régions en texte libre normalisées par REGION_ALIASES (languages.ts) :
     Allemagne → DE, Brésil → BR, Italie → IT ;
   • déduplication automatique par slug côté slang:seed (aucun risque de
     collision : ces 3 codes n'existaient dans aucun batch précédent).

   Effet attendu au prochain build : les badges « Bientôt » de de, pt, it
   disparaissent d'eux-mêmes (dérivation `vite.config.ts` → `contentLanguages`,
   et `ALL_LANGS` côté backend, sur ce même tableau).
   ═══════════════════════════════════════════════════════════════════ */

export const SLANG_SEED_LOT1: SlangSeed[] = [
  // ════════════ ALLEMAND (de) — Nord, Bavière, Berlin/Hambourg — 12 ════════════
  { language: "de", expression: "Moin", literal: "(salutation nordiqueInformelle)", meaning: "salut à toute heure", context: "« Moin, wie geht's? » — le hello express du nord de l'Allemagne, à toute heure.", register: "casual", region: "Allemagne (nord)", popularity: 80 },
  { language: "de", expression: "Servus", literal: "(de l'allemand méridional « servus »)", meaning: "salut (Bavière / Autriche)", context: "« Servus, grüß dich! » — le salut du sud, aussi pour au revoir.", register: "casual", region: "Allemagne (Bavière)", popularity: 78 },
  { language: "de", expression: "geil", literal: "(littéralement « excité »)", meaning: "cool, génial", context: "« Das Konzert war geil! » — le classique absolu de l'admiration jeune.", register: "casual", region: "Allemagne", popularity: 88 },
  { language: "de", expression: "krass", literal: "(littéralement « violent »)", meaning: "waouh, dingue", context: "« Krass, echt jetzt? » — l'expression multimédia de l'étonnement.", register: "casual", region: "Allemagne", popularity: 82 },
  { language: "de", expression: "Alter!", literal: "(de « alter Mann » — vieux mec)", meaning: "eh mec ! (entre amis)", context: "« Alter, wo warst du? » — l'appellatif de surprise entre potes.", register: "street", region: "Allemagne (Berlin)", popularity: 74 },
  { language: "de", expression: "Bock haben", literal: "(de « Bock » — élan, envie)", meaning: "être partant", context: "« Hast du Bock auf Pizza? » — l'envie folklorique du resto.", register: "casual", region: "Allemagne", popularity: 84 },
  { language: "de", expression: "null Bock", literal: "(littéralement « zéro élan »)", meaning: "aucune envie", context: "« Heute null Bock auf Schule. » — l'humeur estudiantine du jour.", register: "street", region: "Allemagne", popularity: 70 },
  { language: "de", expression: "Quatsch", literal: "(de « Quatsch » — bêtise)", meaning: "des bêtises, n'importe quoi", context: "« Das ist doch Quatsch! » — le rejet du non-sens, courant.", register: "casual", region: "Allemagne", popularity: 86 },
  { language: "de", expression: "Kumpel", literal: "(de « Kumpel » — compagnon)", meaning: "pote, copain", context: "« Er ist mein bester Kumpel. » — le pote du quotidien.", register: "casual", region: "Allemagne", popularity: 72 },
  { language: "de", expression: "Läuft bei dir!", literal: "(de « laufen » — fonctionner, rouler)", meaning: "ça roule pour toi ! (compliment jeune)", context: "« Note maximale ? Läuft bei dir! » — le compliment du succès rapide.", register: "street", region: "Allemagne (Berlin)", popularity: 76 },
  { language: "de", expression: "Digga", literal: "(de « Dicker » — le gras, le poton)", meaning: "eh mec (Hambourg / Berlin)", context: "« Digga, was geht? » — le vocatif urbain du nord-est.", register: "street", region: "Allemagne (Hambourg)", popularity: 78 },
  { language: "de", expression: "Feierabend", literal: "(de « Feier » + « Abend » — fin de fête du soir)", meaning: "fin de la journée de travail (mot culturel)", context: "« Endlich Feierabend! » — la libération quotidienne, cœur culturel allemand.", register: "casual", region: "Allemagne", popularity: 92 },

  // ════════════ PORTUGAIS BRÉSIL (pt) — rue, jeunes, internet — 12 ════════════
  { language: "pt", expression: "E aí?", literal: "(de « e aí » — et là)", meaning: "salut, ça va ?", context: "« E aí, tudo bem? » — le salut express du Brésil urbain.", register: "casual", region: "Brésil", popularity: 92 },
  { language: "pt", expression: "Beleza?", literal: "(de « beleza » — beauté)", meaning: "tout va bien ?", context: "« Fala, beleza? » — la vérification amicale, très courante.", register: "casual", region: "Brésil", popularity: 88 },
  { language: "pt", expression: "Cara", literal: "(de « cara » — visage)", meaning: "mec, type", context: "« Fala, cara! » — l'appellatif masculin standard.", register: "casual", region: "Brésil", popularity: 90 },
  { language: "pt", expression: "Mano", literal: "(de « mano » — frangin)", meaning: "frangin, bro", context: "« Mano, que jogo incrível! » — le frangin du foot et de la rue.", register: "street", region: "Brésil", popularity: 84 },
  { language: "pt", expression: "Legal", literal: "(de « legal » — légal, cool)", meaning: "cool, sympa", context: "« Que legal te ver! » — l'admiration spontanée.", register: "casual", region: "Brésil", popularity: 86 },
  { language: "pt", expression: "Massa", literal: "(de « massa » — pâte, chose bien)", meaning: "génial, top", context: "« Essa música é massa. » — le compliment musical jeune.", register: "casual", region: "Brésil", popularity: 82 },
  { language: "pt", expression: "Rolê", literal: "(de « rolo » — roulement, sortie)", meaning: "sortie, balade entre amis", context: "« Vamos dar um rolê no centro? » — l'invitation à flâner.", register: "street", region: "Brésil", popularity: 80 },
  { language: "pt", expression: "Bora!", literal: "(de « embora » — en dehors, parti)", meaning: "on y va !", context: "« Bora, o filme já vai começar! » — l'impératif de départ.", register: "casual", region: "Brésil", popularity: 88 },
  { language: "pt", expression: "Galera", literal: "(de « galera » — ruelle, groupe)", meaning: "le groupe, les potes", context: "« A galera chegou. » — l'arrivée du crew, toute l'équipe.", register: "casual", region: "Brésil", popularity: 78 },
  { language: "pt", expression: "Sacar", literal: "(de « sacar » — sortir, piger)", meaning: "piger, comprendre", context: "« Não saquei nada da aula. » — l'échec de compréhension, familial.", register: "casual", region: "Brésil", popularity: 80 },
  { language: "pt", expression: "Tá ligado?", literal: "(de « estar ligado » — être branché)", meaning: "tu vois ? t'es au courant ?", context: "« Tá ligado que ele voltou? » — la vérification de l'info partagée.", register: "street", region: "Brésil", popularity: 76 },
  { language: "pt", expression: "Ficar de boa", literal: "(de « ficar » + « boa » — rester bien)", meaning: "chill, se la couler douce", context: "« Hoje eu vou ficar de boa em casa. » — le plan détente du week-end.", register: "casual", region: "Brésil", popularity: 82 },

  // ════════════ ITALIEN (it) — Rome, banlieue, réseaux — 12 ════════════
  { language: "it", expression: "Ciao bello / Ciao bella", literal: "(de « ciao » + « bello / bella » — beau/belle)", meaning: "salut l'ami / la belle (amical)", context: "« Ciao bella, come stai? » — le salut affectueux, très courant.", register: "casual", region: "Italie", popularity: 90 },
  { language: "it", expression: "Dai!", literal: "(de « dai » — donne, viens)", meaning: "allez ! viens !", context: "« Dai, andiamo! » — l'incitation collective au départ.", register: "casual", region: "Italie", popularity: 92 },
  { language: "it", expression: "Che figata!", literal: "(de « figata » — chose qui fige, étonne)", meaning: "trop cool !", context: "« Che figata questo posto! » — l'admiration du lieu, jeune.", register: "casual", region: "Italie", popularity: 84 },
  { language: "it", expression: "Boh", literal: "(onomatopée d'incertitude)", meaning: "j'en sais rien (haussement d'épaules)", context: "« Boh, non lo so. » — l'incertitude assumée, universelle.", register: "casual", region: "Italie", popularity: 88 },
  { language: "it", expression: "Magari!", literal: "(de « magari » — si seulement, pourtant)", meaning: "j'aimerais tellement !", context: "« Vieni con noi? — Magari! » — l'envie immédiate, enthousiaste.", register: "casual", region: "Italie", popularity: 86 },
  { language: "it", expression: "In bocca al lupo", literal: "(de « nel bocca del lupo » — dans la gueule du loup)", meaning: "bonne chance (réponse : Crepi!)", context: "« In bocca al lupo per l'esame! » — le vœu de chance rituel.", register: "casual", region: "Italie", popularity: 90 },
  { language: "it", expression: "Ragazzi", literal: "(de « ragazzo » — garçon, gars)", meaning: "les gars, tout le monde", context: "« Ragazzi, si parte! » — l'appel à départ du groupe.", register: "casual", region: "Italie", popularity: 88 },
  { language: "it", expression: "Figo", literal: "(de « figo » — beau, inside)", meaning: "cool, stylé", context: "« Che motorino figo! » — l'admiration du style, jeune.", register: "casual", region: "Italie", popularity: 82 },
  { language: "it", expression: "Che palle!", literal: "(de « palle » — balles, sous-entendu pénible)", meaning: "quelle barbe !", context: "« Che palle, ancora compiti? » — le lassitude des devoirs, familier.", register: "street", region: "Italie (Rome)", popularity: 74 },
  { language: "it", expression: "Ammazza!", literal: "(de « ammazzare » — tuer, ici étonner)", meaning: "waouh, purée ! (Rome)", context: "« Ammazza, che gol! » — l'étonnement sportif, roman.", register: "street", region: "Italie (Rome)", popularity: 78 },
  { language: "it", expression: "Daje!", literal: "(de « dai » + emphase)", meaning: "allez, vas-y ! (Rome, jeune)", context: "« Daje Roma, daje! » — l'impératif chaleureux de la ville.", register: "street", region: "Italie (Rome)", popularity: 80 },
  { language: "it", expression: "Grande!", literal: "(de « grande » — grand, ici chef)", meaning: "tu es un chef ! (compliment)", context: "« Hai pagato tu? Grande! » — le compliment du mec qui assume.", register: "casual", region: "Italie", popularity: 82 },
];
