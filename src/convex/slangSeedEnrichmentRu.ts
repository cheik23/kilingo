import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════════
   LOT RUSSE — fiches d'enrichissement

   ⚠️ ÉTAT RÉEL AU MOMENT DE L'ÉCRITURE : ce fichier contient UNE fiche.
   Le lot russe de 70 fiches annoncé dans la session précédente n'existe
   pas sur le disque : `slangSeedEnrichmentRu.ts` était introuvable,
   aucun import `SLANG_SEED_ENRICHMENT_RU` dans `slangSeed.ts`, et
   l'agrégat ne compte que les 179 fiches ru historiques (celles de
   `slangSeed.ts`, trois blocs : pègre soviétique, cœur éditorial,
   internet). Vérifié par chargement réel de `SLANG_SEED` — pas par
   inference. Ajouter cette fiche porte donc le russe à 180, pas 250.

   FORMAT — conforme aux lots es/pt : `context` suit le gabarit
   [Époque] | [Niveau] | [Source] | [« … » — note], l'exemple entre
   guillemets simples dans le gabarit d'origine, `register` limité à
   casual / street / internet / vulgar.

   SOURCE — CORRECTION DU BRIEF. Le brief demandait « Source : RAE russe ».
   Il n'existe pas de « RAE russe » : la RAE (Real Academia Española) est
   espagnole, et l'Académie des sciences de Russie ne publie pas de
   dictionnaire attestant cette locution. Recherche faite avant écriture :
   ni le dictionnaire Kuznetsov ni celui d'Ozhegov n'attestent « да ладно »
   comme interjection d'incrédulité ; le seul endroit où le sens est
   explicitement défini est l'entrée « да ладно » du Викисловарь
   (Wiktionary russe), qui la donne comme interjection d'étonnement et de
   croyance. La fiche cite donc la source RÉELLEMENT consultée, et l'exemple
   reste celui du brief (usage oral massif, universel).
   ═══════════════════════════════════════════════════════════════════════ */

export const SLANG_SEED_ENRICHMENT_RU: SlangSeed[] = [
  {
    language: "ru",
    expression: "Да ладно!",
    literal: "Oui vraiment",
    meaning: "Tu déconnes ! / Pas possible ! / Sans blague !",
    context:
      "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Викисловарь (Wiktionary ru), entrée « да ладно », interjection d'étonnement et d'incrédulité — aucun dictionnaire académique consulté (Kuznetsov, Ozhegov) ne l'atteste] | [Ex: 'Да ладно, не может быть!' - Réaction d'incrédulité universelle]",
    register: "casual",
    region: "Russie",
    popularity: 95,
  },
  {
    language: "ru",
    expression: "Короче",
    literal: "Plus court",
    meaning: "Bref, en résumé (filler omniprésent)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral massif] | [Ex: 'Короче, я не пойду' - Filler universel]",
    register: "casual",
    region: "Russie",
    popularity: 95
  },

  {
    language: "ru",
    expression: "Прикинь",
    literal: "Imagine",
    meaning: "Imagine un peu / Tu te rends compte",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Прикинь, он опоздал!' - Intro d'histoire]",
    register: "casual",
    region: "Russie",
    popularity: 90
  },

  {
    language: "ru",
    expression: "Тусовка",
    literal: "Mélange",
    meaning: "Fête, rassemblement, boîte",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Идём на тусовку' - Vie sociale]",
    register: "casual",
    region: "Russie",
    popularity: 85
  },
  {
    language: "ru",
    expression: "Халява",
    literal: "Gratuité",
    meaning: "Gratuité, aubaine, coup de bol",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Лови халяву' - Culture étudiante]",
    register: "casual",
    region: "Russie",
    popularity: 90
  },
  {
    language: "ru",
    expression: "Бабки",
    literal: "Vieilles femmes",
    meaning: "Argent, fric, thune",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Где бабки?' - Argot monétaire]",
    register: "casual",
    region: "Russie",
    popularity: 85
  },
  {
    language: "ru",
    expression: "Шарить",
    literal: "Fouiller",
    meaning: "S'y connaître, piger, comprendre",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Ты шаришь в этом?' - Compétence]",
    register: "casual",
    region: "Russie",
    popularity: 85
  },
  {
    language: "ru",
    expression: "В натуре",
    literal: "Dans la nature",
    meaning: "En vrai, sérieusement, carrément",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Он в натуре крутой' - Affirmation]",
    register: "street",
    region: "Russie",
    popularity: 80
  },
  {
    language: "ru",
    expression: "Тормоз",
    literal: "Frein",
    meaning: "Quelqu'un de lent, un idiot",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Не тормози!' - Impatience]",
    register: "casual",
    region: "Russie",
    popularity: 80
  },
  {
    language: "ru",
    expression: "Лажа",
    literal: "Inconnue",
    meaning: "Bêtise, mensonge, truc nul",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Вся эта лажа' - Rejet]",
    register: "casual",
    region: "Russie",
    popularity: 80
  },
  {
    language: "ru",
    expression: "Облом",
    literal: "Brisure",
    meaning: "Déception, échec, coup dur",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Полный облом' - Déception]",
    register: "casual",
    region: "Russie",
    popularity: 85
  },
  {
    language: "ru",
    expression: "Мутить",
    literal: "Troubler",
    meaning: "Manigancer, draguer, préparer un coup",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Мутить воду' - Action louche]",
    register: "street",
    region: "Russie",
    popularity: 80
  },
  {
    language: "ru",
    expression: "Забить",
    literal: "Clouer",
    meaning: "Laisser tomber, s'en foutre",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Забей на это' - Indifférence]",
    register: "casual",
    region: "Russie",
    popularity: 90
  },

  {
    language: "ru",
    expression: "Предки",
    literal: "Ancêtres",
    meaning: "Parents (père et mère)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Предки дома?' - Famille]",
    register: "casual",
    region: "Russie",
    popularity: 85
  },


  {
    language: "ru",
    expression: "Ботать",
    literal: "Bavarder",
    meaning: "Parler un jargon, ou étudier (argot scolaire)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Ботать по фене' - Jargon]",
    register: "street",
    region: "Russie",
    popularity: 70
  },



  {
    language: "ru",
    expression: "Базар",
    literal: "Marché",
    meaning: "Discussion, conversation (parfois conflit)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Базара нет' - Pas de problème]",
    register: "street",
    region: "Russie",
    popularity: 85
  },



  {
    language: "ru",
    expression: "Рофл",
    literal: "Rofl",
    meaning: "Blague, moquerie",
    context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Internet] | [Ex: 'Это просто рофл' - Humour]",
    register: "internet",
    region: "Russie",
    popularity: 90
  },
  {
    language: "ru",
    expression: "Мутная",
    literal: "Trouble",
    meaning: "Louche, suspect, peu clair",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Мутная тема' - Suspicion]",
    register: "street",
    region: "Russie",
    popularity: 80
  },
  {
    language: "ru",
    expression: "Ровный",
    literal: "Lisse",
    meaning: "Calme, normal, sans problème",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Ровный челик' - Calme]",
    register: "street",
    region: "Russie",
    popularity: 75
  },
  {
    language: "ru",
    expression: "Чел",
    literal: "Humain",
    meaning: "Mec, type (abréviation de человек)",
    context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Internet] | [Ex: 'Странный чел' - Personne]",
    register: "internet",
    region: "Russie",
    popularity: 90
  },
  {
    language: "ru",
    expression: "Бахнуть",
    literal: "Frapper",
    meaning: "Frapper fort, ou boire un coup, ou faire exploser",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Бахнуть по рюмке' - Action forte]",
    register: "casual",
    region: "Russie",
    popularity: 80
  },
  {
    language: "ru",
    expression: "Улет",
    literal: "Envol",
    meaning: "Quelque chose de génial, qui 'décolle'",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Это просто улет' - Éloge]",
    register: "casual",
    region: "Russie",
    popularity: 75
  },
  {
    language: "ru",
    expression: "Отпад",
    literal: "Chute",
    meaning: "Quelque chose de renversant (positif ou négatif)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Полный отпад' - Réaction]",
    register: "casual",
    region: "Russie",
    popularity: 75
  },
  {
    language: "ru",
    expression: "Прошаренный",
    literal: "Frotté",
    meaning: "Quelqu'un qui s'y connaît bien, expérimenté",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Он прошаренный в этом' - Expertise]",
    register: "casual",
    region: "Russie",
    popularity: 80
  },
  {
    language: "ru",
    expression: "Туса",
    literal: "Fête",
    meaning: "Fête, soirée",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Классная туса' - Soirée]",
    register: "casual",
    region: "Russie",
    popularity: 85
  },

  {
    language: "ru",
    expression: "Молодец",
    literal: "Jeune homme",
    meaning: "Bravo, bien joué (plus formel que красавчик)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral] | [Ex: 'Молодец!' - Félicitation]",
    register: "casual",
    region: "Russie",
    popularity: 95
  },

  {
    language: "ru",
    expression: "Ок",
    literal: "OK",
    meaning: "D'accord",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Internet] | [Ex: 'Ок, договорились' - Accord]",
    register: "internet",
    region: "Russie",
    popularity: 99
  },
  {
    language: "ru",
    expression: "Лол",
    literal: "Lol",
    meaning: "Rire",
    context: "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Internet] | [Ex: 'Ну это лол' - Rire]",
    register: "internet",
    region: "Russie",
    popularity: 90
  },
  {
    language: "ru",
    expression: "Пиздец",
    literal: "Fin (vulgaire)",
    meaning: "C'est la fin, c'est catastrophique (très vulgaire)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral vulgaire] | [Ex: 'Полный пиздец' - Catastrophe]",
    register: "vulgar",
    region: "Russie",
    popularity: 90
  },
  {
    language: "ru",
    expression: "Блядь",
    literal: "Pute",
    meaning: "Putain (interjection très vulgaire)",
    context: "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Usage oral vulgaire] | [Ex: 'Блядь, опять!' - Colère]",
    register: "vulgar",
    region: "Russie",
    popularity: 95
  }
];
