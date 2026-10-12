import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════
   BATCH LOT 4 — 23 slugs (24 lignes fournies) — DERNIER LOT

   • 11 am (amharique — Addis-Abeba ; 12 lignes fournies, voir la fusion
     ci-dessous) ;
   • 12 ig (igbo — Enugu, Onitsha, Nollywood).

   ⚠️⚠️ BASE NON VALIDÉE PAR UN NATIF ⚠️⚠️
   Le contenu amharique et igbo ci-dessous est une BASE DE TRAVAIL. Il doit
   être relu par un locuteur natif AVANT toute mise en production
   commerciale : ce sont des langues où les nuances régionales et de registre
   comptent (l'amharique d'Addis n'est pas celui de Gondar ; l'igbo d'Enugu
   n'est pas celui d'Onitsha, et l'orthographe igbo porte des diacritiques
   qui changent le sens). Aucune de ces 23 fiches ne doit être présentée
   comme « vérifiée » tant que cette relecture n'a pas eu lieu.

   Fusion assumée (même règle que « 대박 » au Lot 2) : les deux lignes
   fournies « Ishi (እሺ) » et « Eshi (እሺ) » portent LA MÊME écriture
   guèze ; ce sont deux transcriptions du même mot. Avec l'écriture en
   premier, elles produisent un seul slug (« am:እሺ ») : garder deux fiches
   ferait perdre la seconde en silence au seed. Une fiche unique, donc, avec
   les deux graphies signalées dans le contexte.

   Conventions, comme les lots précédents :
   • amharique : écriture guèze EN PREMIER, romanisation entre parenthèses
     (même règle que ko/ja/zh/hi/bn/ur/th/fa/el) ;
   • igbo : alphabet latin — donc AUCUNE parenthèse, on écrit la forme juste
     (diacritiques compris : « Daalụ », « Ọ dị mma »), comme pour vi/id/tl ;
   • registres rabattus sur le vocabulaire du seed : « courant » et
     « familier » → casual ; « argot jeune » → street (አሪፍ, né des rues
     d'Addis) ;
   • régions en texte libre normalisées par REGION_ALIASES (languages.ts) :
     Éthiopie → et, Nigeria Sud-Est → ng-se ;
   • déduplication automatique par slug côté slang:seed.

   Effet attendu au prochain build : les badges « Bientôt » de am et ig
   disparaissent — et avec eux les DERNIERS du catalogue. Les 29 langues
   d'apprentissage déclarées dans `languages.ts` portent alors toutes du
   contenu : `languageIsComingSoon()` ne peut plus rien retourner de vrai.
   ═══════════════════════════════════════════════════════════════════ */

export const SLANG_SEED_LOT4: SlangSeed[] = [
  // ════════════ AMHARIQUE (am) — Addis-Abeba — 11 ════════════
  { language: "am", expression: "ሰላም (selam)", literal: "« paix » (salutation d'origine sémitique)", meaning: "salut, paix", context: "« Selam, dehna neh? » — salut, tu vas bien ? ; se dit à toute heure, à tout le monde.", register: "casual", region: "Éthiopie", popularity: 88 },
  { language: "am", expression: "ደህና ነህ? (dehna neh?)", literal: "« es-tu en bonne santé ? » — adressé à un HOMME", meaning: "tu vas bien ? (à un homme)", context: "« Selam, dehna neh? » — la question rituelle ; la forme varie selon le sexe de l'interlocuteur.", register: "casual", region: "Éthiopie", popularity: 78 },
  { language: "am", expression: "ደህና ነሽ? (dehna nesh?)", literal: "« es-tu en bonne santé ? » — adressé à une FEMME", meaning: "tu vas bien ? (à une femme)", context: "« Selam, dehna nesh? » — même question, accordée au féminin ; se tromper de forme s'entend.", register: "casual", region: "Éthiopie", popularity: 78 },
  { language: "am", expression: "አመሰግናለሁ (ameseginalehu)", literal: "« je rends grâce » (racine « mesegene »)", meaning: "merci", context: "« Ameseginalehu, betam yikirta » — merci, c'est très gentil.", register: "casual", region: "Éthiopie", popularity: 88 },
  { language: "am", expression: "በጣም (betam)", literal: "« très, extrêmement »", meaning: "très, beaucoup", context: "« Betam tiru new » — c'est très bien.", register: "casual", region: "Éthiopie", popularity: 80 },
  { language: "am", expression: "እሺ (ishi)", literal: "« oui, d'accord » — aussi transcrit « eshi »", meaning: "OK, d'accord", context: "« Ishi, enhid » — d'accord, on y va. Les deux lignes fournies (« ishi » et « eshi ») portaient la même écriture እሺ : fusionnées ici.", register: "casual", region: "Éthiopie", popularity: 86 },
  { language: "am", expression: "አሪፍ (arif)", literal: "de l'anglais « alright » passé par l'argot d'Addis", meaning: "cool, bien (argot des jeunes)", context: "« Arif new! » — c'est cool ! ; mot de la rue d'Addis, compris partout en Éthiopie.", register: "street", region: "Éthiopie", popularity: 74 },
  { language: "am", expression: "ጎበዝ (gobez)", literal: "« habile, dégourdi »", meaning: "intelligent, malin", context: "« Gobez lij new » — c'est un enfant dégourdi ; compliment très courant.", register: "casual", region: "Éthiopie", popularity: 78 },
  { language: "am", expression: "ቆንጆ (konjo)", literal: "« joli, agréable à regarder »", meaning: "beau, belle", context: "« Konjo nat » — elle est belle ; compliment du quotidien.", register: "casual", region: "Éthiopie", popularity: 76 },
  { language: "am", expression: "እንሂድ (enhid)", literal: "« allons » (impératif de « hed », aller)", meaning: "allons-y", context: "« Ishi, enhid » — d'accord, allons-y.", register: "casual", region: "Éthiopie", popularity: 80 },
  { language: "am", expression: "ጥሩ (tiru)", literal: "« bon, choisi, de qualité »", meaning: "bon, bien", context: "« Tiru idee new » — c'est une bonne idée.", register: "casual", region: "Éthiopie", popularity: 82 },

  // ════════════ IGBO (ig) — Enugu, Onitsha, Nollywood — 12 ════════════
  { language: "ig", expression: "Kedu", literal: "« comment ? comment vas-tu ? »", meaning: "comment ça va", context: "« Kedu ka i mere? » — comment vas-tu ? ; la salutation de base, à l'écrit comme à l'oral.", register: "casual", region: "Nigeria Sud-Est", popularity: 86 },
  { language: "ig", expression: "Daalụ", literal: "« merci, sois remercié »", meaning: "merci", context: "« Daalụ nke ukwuu » — merci beaucoup.", register: "casual", region: "Nigeria Sud-Est", popularity: 86 },
  { language: "ig", expression: "Nnọọ", literal: "« viens, sois le bienvenu »", meaning: "bienvenue", context: "« Nnọọ, bịa n'ụlọ » — bienvenue, entre à la maison.", register: "casual", region: "Nigeria Sud-Est", popularity: 82 },
  { language: "ig", expression: "Ọ dị mma", literal: "« c'est bon / ça va » (ọ + dị + mma)", meaning: "c'est bien, OK", context: "« Ọ dị mma, anyị ga-aga » — c'est bon, on y va.", register: "casual", region: "Nigeria Sud-Est", popularity: 84 },
  { language: "ig", expression: "Biko", literal: "« je t'en prie »", meaning: "s'il te plaît", context: "« Biko, nyem aka » — s'il te plaît, aide-moi.", register: "casual", region: "Nigeria Sud-Est", popularity: 84 },
  { language: "ig", expression: "Ọ dị egwu", literal: "littéralement « c'est effrayant » — devenu admiration", meaning: "c'est génial, waouh", context: "« Ọ dị egwu! » — c'est incroyable ! ; l'exagération est le compliment.", register: "casual", region: "Nigeria Sud-Est", popularity: 78 },
  { language: "ig", expression: "I mere nke ọma", literal: "« tu as fait de la bonne manière »", meaning: "tu as bien fait", context: "« I mere nke ọma! » — bravo, tu as bien travaillé.", register: "casual", region: "Nigeria Sud-Est", popularity: 76 },
  { language: "ig", expression: "Ka anyị gaa", literal: "« que nous allions » (ka + anyị + gaa)", meaning: "allons-y", context: "« Ka anyị gaa oriri » — allons à la fête.", register: "casual", region: "Nigeria Sud-Est", popularity: 80 },
  { language: "ig", expression: "Ọ gbara m gharịị", literal: "« ça m'a tourné autour » — l'esprit qui décroche", meaning: "ça me dépasse, c'est fou", context: "« Ọ gbara m gharịị! » — je n'en reviens pas ! ; l'étonnement qui submerge.", register: "casual", region: "Nigeria Sud-Est", popularity: 70 },
  { language: "ig", expression: "Ụmụ nne", literal: "« les enfants de la mère »", meaning: "frères et sœurs, la famille", context: "« Ụmụ nne, anyị ga-ezukọ » — la famille, on va se réunir ; s'emploie aussi pour un groupe d'amis proches.", register: "casual", region: "Nigeria Sud-Est", popularity: 78 },
  { language: "ig", expression: "Eziokwu", literal: "« vérité » (ezi + okwu, la vraie parole)", meaning: "vraiment, c'est vrai", context: "« Eziokwu, i kwuru eziokwu » — vraiment, tu as dit la vérité.", register: "casual", region: "Nigeria Sud-Est", popularity: 82 },
  { language: "ig", expression: "Ọ dị nma", literal: "« c'est beau / c'est bon » — variante dialectale de « mma »", meaning: "ça va bien", context: "« Ọ dị nma, imela » — ça va bien, merci ; forme plus courante à l'ouest du pays.", register: "casual", region: "Nigeria Sud-Est", popularity: 74 },
];
