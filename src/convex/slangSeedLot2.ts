import type { SlangSeed } from "./slangSeed";

/* ═══════════════════════════════════════════════════════════════════
   BATCH LOT 2 — 47 expressions (Phase 2)

   4 langues, 48 lignes fournies, 47 slugs uniques :
   • 11 ko (coréen — « 대박 » était fourni deux fois, les deux fiches
     sont fusionnées en une : waouh/génial, avec les deux exemples) ;
   • 12 ja (japonais) ;
   • 12 tr (turc) ;
   • 12 pl (polonais).

   Garanties, comme les batchs précédents :
   • romanisations entre parenthèses pour ko/ja — même convention que le
     lot chinois (« 牛逼 (niúbī) ») ; `slangSlug` replie la parenthèse
     finale, donc « 안녕 (annyeong) » et « 안녕 » partagent une identité ;
   • deux romanisations corrigées sur la lecture standard : 인싸 (inssa)
     et 아싸 (assa) — la source écrivait « insya » / « assyia » ;
   • registres rabattus sur le vocabulaire du seed : « familier » et
     « courant » → casual ; « argot jeune » → street quand il vit à l'oral
     (헐, 존맛, うざい, Kminić…), internet quand il est né des réseaux
     (인싸, 멘붕, 草, ぴえん…) ;
   • régions en texte libre normalisées par REGION_ALIASES (languages.ts) :
     Corée du Sud → kr, Japon → jp, Türkiye → tr, Pologne → pl ;
   • déduplication automatique par slug côté slang:seed (aucun risque de
     collision : ces 4 codes n'existaient dans aucun batch précédent).

   Effet attendu au prochain build : les badges « Bientôt » de ko, ja,
   tr, pl disparaissent d'eux-mêmes (dérivation `vite.config.ts` →
   `contentLanguages`, et `ALL_LANGS` côté backend, sur ce même tableau).
   ═══════════════════════════════════════════════════════════════════ */

export const SLANG_SEED_LOT2: SlangSeed[] = [
  // ════════════ CORÉEN (ko) — Séoul, banmal et slang de K-drama — 11 ════════════
  { language: "ko", expression: "안녕 (annyeong)", literal: "racine sino-coréenne 安寧, la paix", meaning: "salut (familier, entre jeunes)", context: "« 안녕, 잘 지냈어? » — salut, tout va bien depuis ?", register: "casual", region: "Corée du Sud", popularity: 86 },
  { language: "ko", expression: "대박 (daebak)", literal: "« grand » + « frapper » — le gros coup", meaning: "waouh, dingue ; génial, incroyable", context: "« 대박, 진짜? » — sérieux ? ; « 대박 사건! » — un truc de fou !", register: "casual", region: "Corée du Sud", popularity: 84 },
  { language: "ko", expression: "오빠 (oppa)", literal: "grand frère (employé par une fille)", meaning: "grand frère ; le copain, dit par une femme", context: "« 오빠, 뭐 해? » — frérot, tu fais quoi ?", register: "casual", region: "Corée du Sud", popularity: 82 },
  { language: "ko", expression: "화이팅 (hwaiting)", literal: "de l'anglais « fighting » (courage)", meaning: "allez ! courage !", context: "« 시험 화이팅! » — bonne chance pour l'examen !", register: "casual", region: "Corée du Sud", popularity: 80 },
  { language: "ko", expression: "케미 (kemi)", literal: "de l'anglais « chemistry »", meaning: "alchimie entre personnes", context: "« 둘이 케미 좋다 » — ces deux-là ont une de ces alchimies.", register: "internet", region: "Corée du Sud", popularity: 70 },
  { language: "ko", expression: "인싸 (inssa)", literal: "de l'anglais « insider »", meaning: "personne populaire, bien intégrée", context: "« 그 애 완전 인싸야 » — il/elle est totalement dans le coup.", register: "internet", region: "Corée du Sud", popularity: 72 },
  { language: "ko", expression: "아싸 (assa)", literal: "de l'anglais « outsider »", meaning: "personne en marge, qui reste dans son coin", context: "« 나 오늘 아싸 » — aujourd'hui je reste dans mon coin.", register: "internet", region: "Corée du Sud", popularity: 68 },
  { language: "ko", expression: "멘붕 (menbung)", literal: "« mental » + « breakdown » (fusion)", meaning: "craquage mental, panique", context: "« 시험 전에 멘붕 » — le craquage d'avant-examen.", register: "internet", region: "Corée du Sud", popularity: 71 },
  { language: "ko", expression: "존맛 (jonmat)", literal: "« putain » (존) + « goût » (맛)", meaning: "trop bon (à s'en relever la nuit)", context: "« 이 라면 존맛 » — ces nouilles, c'est une tuerie.", register: "street", region: "Corée du Sud", popularity: 74 },
  { language: "ko", expression: "극한직업 (geukhan jigeop)", literal: "« métier extrême » (titre du film 2019)", meaning: "boulot de forçat, vraie galère", context: "« 이건 극한직업이야 » — ça, c'est un métier de l'extrême.", register: "casual", region: "Corée du Sud", popularity: 62 },
  { language: "ko", expression: "헐 (heol)", literal: "onomatopée de stupeur", meaning: "oh là là ! (surprise, choc)", context: "« 헐, 진짜? » — oh là là, sérieux ?", register: "street", region: "Corée du Sud", popularity: 76 },

  // ════════════ JAPONAIS (ja) — Shibuya, keigo et slang des réseaux — 12 ════════════
  { language: "ja", expression: "お疲れ様 (otsukaresama)", literal: "« votre fatigue » — merci d'avoir peiné", meaning: "bravo pour ton travail (formule universelle)", context: "« お疲れ様です » — merci pour tout, au bureau comme en famille.", register: "casual", region: "Japon", popularity: 88 },
  { language: "ja", expression: "やばい (yabai)", literal: "à l'origine « dangereux » — aujourd'hui tout et son contraire", meaning: "dingue (positif ou négatif selon le ton)", context: "« これやばい! » — c'est dingue !", register: "casual", region: "Japon", popularity: 90 },
  { language: "ja", expression: "まじで (maji de)", literal: "« sérieux » + particule", meaning: "sérieux ? vraiment ?", context: "« まじで？ » — sérieux ?", register: "casual", region: "Japon", popularity: 85 },
  { language: "ja", expression: "うざい (uzai)", literal: "de « うざったい », pénible", meaning: "lourd, agaçant", context: "« あの上司うざい » — ce chef est insupportable.", register: "street", region: "Japon", popularity: 76 },
  { language: "ja", expression: "キモい (kimoi)", literal: "abréviation de « 気持ち悪い » (malaise)", meaning: "dégueu, flippant, répugnant", context: "« それキモい » — ça, c'est glauque.", register: "street", region: "Japon", popularity: 74 },
  { language: "ja", expression: "エモい (emoi)", literal: "de l'anglais « emotional »", meaning: "émouvant, nostalgique", context: "« この曲エモい » — cette chanson me prend aux tripes.", register: "internet", region: "Japon", popularity: 72 },
  { language: "ja", expression: "ぴえん (pien)", literal: "bruit d'un petit pleur", meaning: "petit chagrin mignon (pleurs en emoji)", context: "« ぴえん、会いたい » — bouh, tu me manques.", register: "internet", region: "Japon", popularity: 70 },
  { language: "ja", expression: "草 (kusa)", literal: "« herbe » — le rire 笑/ｗ ressemble à de l'herbe", meaning: "mdr, lol", context: "« それ草 » — mdr.", register: "internet", region: "Japon", popularity: 78 },
  { language: "ja", expression: "それな (sore na)", literal: "« c'est ça » + particule", meaning: "exactement, tellement vrai", context: "« A: 疲れた B: それな » — A : crevé. B : tellement.", register: "internet", region: "Japon", popularity: 80 },
  { language: "ja", expression: "りょ (ryo)", literal: "abréviation de « 了解 » (ryōkai, compris)", meaning: "OK, reçu (réponse express)", context: "« 明日ね りょ » — à demain, ok.", register: "internet", region: "Japon", popularity: 72 },
  { language: "ja", expression: "ワンチャン (wanchan)", literal: "de l'anglais « one chance »", meaning: "y'a peut-être moyen, une chance", context: "« ワンチャン行ける » — y'a moyen que j'y aille.", register: "internet", region: "Japon", popularity: 68 },
  { language: "ja", expression: "尊い (toutoi)", literal: "« précieux, vénérable » (sens religieux à l'origine)", meaning: "trop précieux (pour une idole, un personnage)", context: "« 推しが尊い » — mon idole, c'est trop.", register: "internet", region: "Japon", popularity: 66 },

  // ════════════ TURC (tr) — Istanbul, sokak et termes d'adresse — 12 ════════════
  { language: "tr", expression: "Kanka", literal: "de « kan kardeşi » (frère de sang)", meaning: "pote, frérot", context: "« Naber kanka? » — quoi de neuf, frérot ?", register: "casual", region: "Türkiye", popularity: 88 },
  { language: "tr", expression: "Abi", literal: "« grand frère » (terme d'adresse)", meaning: "grand frère (respectueux et chaleureux)", context: "« Tamam abi » — ok frérot.", register: "casual", region: "Türkiye", popularity: 86 },
  { language: "tr", expression: "Abla", literal: "« grande sœur » (terme d'adresse)", meaning: "grande sœur", context: "« Teşekkürler abla » — merci grande sœur.", register: "casual", region: "Türkiye", popularity: 78 },
  { language: "tr", expression: "Hayırdır?", literal: "« y a-t-il du bien ? » (formule d'usage)", meaning: "qu'est-ce qui se passe ? (bon ou mauvais)", context: "« Hayırdır, bir şey mi oldu? » — qu'est-ce qui t'amène, il y a un souci ?", register: "casual", region: "Türkiye", popularity: 66 },
  { language: "tr", expression: "Çok iyi", literal: "« très bien »", meaning: "trop bien, génial", context: "« Bu çok iyi! » — c'est trop bien !", register: "casual", region: "Türkiye", popularity: 82 },
  { language: "tr", expression: "Süper", literal: "de l'anglais « super »", meaning: "super", context: "« Süper bir film » — un film super.", register: "casual", region: "Türkiye", popularity: 80 },
  { language: "tr", expression: "Aynen", literal: "de « aynı » (le même)", meaning: "exactement, tout à fait", context: "« Aynen öyle » — exactement.", register: "casual", region: "Türkiye", popularity: 84 },
  { language: "tr", expression: "Boşver", literal: "« vide » + « donne » — largue ça", meaning: "laisse tomber", context: "« Boşver, önemli değil » — laisse tomber, c'est rien.", register: "casual", region: "Türkiye", popularity: 82 },
  { language: "tr", expression: "Kafana takma", literal: "« ne le mets pas dans ta tête »", meaning: "t'en fais pas, ne rumine pas", context: "« Kafana takma kardeşim » — t'en fais pas, mon frère.", register: "casual", region: "Türkiye", popularity: 72 },
  { language: "tr", expression: "Hadi ya!", literal: "« allez » + « eh » (incrédulité)", meaning: "sans blague ! / allez, quoi !", context: "« Hadi ya, ciddi misin? » — sans blague, tu es sérieux ?", register: "casual", region: "Türkiye", popularity: 76 },
  { language: "tr", expression: "Bayıldım", literal: "« je me suis pâmé » (bayılmak)", meaning: "j'ai adoré", context: "« Bu şarkıya bayıldım » — je suis fou de cette chanson.", register: "casual", region: "Türkiye", popularity: 78 },
  { language: "tr", expression: "Sıkıntı yok", literal: "« il n'y a pas de souci »", meaning: "pas de souci", context: "« Sıkıntı yok, hallederiz » — pas de souci, on gère.", register: "casual", region: "Türkiye", popularity: 74 },

  // ════════════ POLONAIS (pl) — Varsovie, ulica et slang des jeunes — 12 ════════════
  { language: "pl", expression: "Cześć", literal: "« honneur » (salutation d'origine)", meaning: "salut (le plus courant)", context: "« Cześć, jak się masz? » — salut, comment tu vas ?", register: "casual", region: "Pologne", popularity: 88 },
  { language: "pl", expression: "Siema", literal: "de « siemasz » (salutation des jeunes)", meaning: "wesh, salut (très familier)", context: "« Siema, co tam? » — wesh, quoi de neuf ?", register: "casual", region: "Pologne", popularity: 80 },
  { language: "pl", expression: "Spoko", literal: "abréviation de « spokojnie » (tranquillement)", meaning: "cool, pas de souci", context: "« Spoko, nie ma sprawy » — cool, pas de problème.", register: "casual", region: "Pologne", popularity: 84 },
  { language: "pl", expression: "Zajebisty", literal: "de « zajebać » (à l'origine très vulgaire)", meaning: "trop cool, génial (vulgarité légère)", context: "« To jest zajebiste! » — c'est trop cool !", register: "street", region: "Pologne", popularity: 78 },
  { language: "pl", expression: "Masakra!", literal: "« massacre » (exagération)", meaning: "c'est dingue ! (dans les deux sens)", context: "« Masakra, ale impreza! » — c'est fou, quelle soirée !", register: "street", region: "Pologne", popularity: 76 },
  { language: "pl", expression: "Ogarnąć", literal: "de « garnąć » (rassembler, ranger)", meaning: "gérer, s'occuper de", context: "« Ogarnę to jutro » — je gère ça demain.", register: "casual", region: "Pologne", popularity: 74 },
  { language: "pl", expression: "Kminić", literal: "argot : « piger » (de « kmina », la combine)", meaning: "piger, comprendre", context: "« Nie kminie tego » — je capte pas.", register: "street", region: "Pologne", popularity: 64 },
  { language: "pl", expression: "Fajny", literal: "de l'allemand « fein » (fin, délicat)", meaning: "sympa, cool", context: "« Fajny film » — un film sympa.", register: "casual", region: "Pologne", popularity: 82 },
  { language: "pl", expression: "Super", literal: "de l'anglais « super »", meaning: "super", context: "« Super robota! » — super boulot !", register: "casual", region: "Pologne", popularity: 80 },
  { language: "pl", expression: "Luz", literal: "« mou, relâché » (de « luźny »)", meaning: "relax, tranquille", context: "« Luz, nie spinaj się » — relax, stresse pas.", register: "casual", region: "Pologne", popularity: 70 },
  { language: "pl", expression: "Nara", literal: "abréviation de « na razie » (pour l'instant)", meaning: "à plus, bye", context: "« Nara, do zobaczenia! » — bye, à plus !", register: "casual", region: "Pologne", popularity: 72 },
  { language: "pl", expression: "Bycza", literal: "de « byk » (taureau) — « la classe »", meaning: "trop cool, au top", context: "« Bycza impreza! » — soirée au top !", register: "street", region: "Pologne", popularity: 58 },
];
