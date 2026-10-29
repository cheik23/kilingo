import { describe, expect, test } from "bun:test";
import { SLANG_SEED } from "../src/convex/slangSeed";
import {
  compileExpression,
  expressionMatches,
  hasContinuousScript,
  normalizeForLexicalMatch,
} from "../src/lib/lexicalMatch";

const matches = (haystack: string, expression: string, language?: string) =>
  expressionMatches(haystack, expression, language);

describe("normalisation lexicale", () => {
  test("casse, accents, apostrophes, tirets et espaces", () => {
    expect(normalizeForLexicalMatch("  C’EST   Mort — Là! ")).toBe(
      "c'est mort la!",
    );
    expect(normalizeForLexicalMatch("Läuft bei dir")).toBe("lauft bei dir");
    expect(normalizeForLexicalMatch("casse–couilles")).toBe("casse couilles");
  });

  test("les marques non latines sont préservées", () => {
    // Supprimer les harakat ou les matras changerait le mot, pas seulement
    // son apparence : la normalisation ne touche qu'aux diacritiques latins.
    expect(normalizeForLexicalMatch("كَتَبَ")).toBe("كَتَبَ");
    expect(normalizeForLexicalMatch("हिन्दी")).toBe("हिन्दी");
  });
});

describe("faux positifs dans des mots plus longs", () => {
  test("PE ne matche pas « peut »", () => {
    expect(
      matches(
        "Et mes concitoyens ne demandent pas ce que votre pays peut faire",
        "PE",
      ),
    ).toBe(false);
  });

  test("PE isolé reste détecté, casse et ponctuation comprises", () => {
    expect(matches("An athlete PE, never sold", "PE")).toBe(true);
    expect(matches("PE", "PE")).toBe(true);
    expect(matches("« pe »", "PE")).toBe(true);
    expect(matches("P.E.", "PE")).toBe(false);
    expect(matches("PEA", "PE")).toBe(false);
    expect(matches("peut", "PE")).toBe(false);
    expect(matches("pes", "PE")).toBe(true); // pluriel régulier « PEs »
  });

  test("expressions courtes bornées", () => {
    expect(matches("the captain", "cap")).toBe(false);
    expect(matches("a cap", "cap")).toBe(true);
    expect(matches("caps", "cap")).toBe(true);
    expect(matches("my dog", "OG")).toBe(false);
    expect(matches("an OG", "OG")).toBe(true);
    expect(matches("learn", "rn")).toBe(false);
    expect(matches("rn", "rn")).toBe(true);
    expect(matches("41st", "41")).toBe(false);
    expect(matches("41", "41")).toBe(true);
  });

  test("aucun match au milieu ou à la fin d'un mot plus long", () => {
    expect(matches("stand", "stan")).toBe(false);
    expect(matches("hyper", "hype")).toBe(false);
    expect(matches("ration", "ratio")).toBe(false);
    expect(matches("duration", "ratio")).toBe(false);
    expect(matches("flower", "flow")).toBe(false);
    expect(matches("hermano", "mano")).toBe(false);
    expect(matches("capsule", "cap")).toBe(false);
  });

  test("les flexions régulières restent détectées", () => {
    expect(matches("I ghosted him", "ghost")).toBe(true);
    expect(matches("the launch flopped", "flop")).toBe(true);
    expect(matches("planned and plugged", "plan")).toBe(true);
    expect(matches("buying fakes", "fake")).toBe(true);
    expect(matches("customs opened my sneakers", "custom")).toBe(true);
    expect(matches("they ratioed him", "ratio")).toBe(true);
    expect(matches("hyped for the drop", "hype")).toBe(true);
    expect(matches("stanning hard", "stan")).toBe(true);
  });
});

describe("expressions composées, casse et ponctuation", () => {
  test("les expressions composées restent détectables", () => {
    expect(matches("They spin the block every night", "spin the block")).toBe(
      true,
    );
    expect(matches("Spinning the block", "spin the block")).toBe(false);
    expect(matches("C’est mort, on y va", "c'est mort")).toBe(true);
    expect(matches("Casse couilles, ce type", "casse-couilles")).toBe(true);
    expect(matches("un ad lib génial", "ad-lib")).toBe(true);
    expect(matches("Y’all are wild", "y'all")).toBe(true);
    expect(matches("I’m dead", "I'm dead")).toBe(true);
  });

  test("ponctuation finale ignorée sans casser les bornes", () => {
    expect(matches("you good", "you good?")).toBe(true);
    expect(matches("you good?", "you good?")).toBe(true);
    expect(matches("you gooding", "you good?")).toBe(false);
    expect(matches("it's giving", "it's giving…")).toBe(true);
    expect(matches("Alter, komm", "Alter!")).toBe(true);
    expect(matches("Altercation", "Alter!")).toBe(false);
  });

  test("accents latins pliés des deux côtés", () => {
    expect(matches("Esta canon, tío", "está cañón")).toBe(true);
    expect(matches("Lauft bei dir, Alter", "Läuft bei dir!")).toBe(true);
    expect(matches("Una canonica distinta", "está cañón")).toBe(false);
  });
});

describe("proclitiques et flexions par langue", () => {
  test("article défini arabe : الراب contient راب", () => {
    expect(matches("الراب العربي", "راب", "ar")).toBe(true);
    expect(matches("راب", "راب", "ar")).toBe(true);
  });

  test("préfixes de classe nominale (lingala, zoulou)", () => {
    expect(matches("Tokolia malamu", "kolia", "ln")).toBe(true);
    expect(matches("Uthandeka kakhulu", "thandeka", "zu")).toBe(true);
    expect(matches("Ngiyezwa kahle", "zwa", "zu")).toBe(true);
  });

  test("e- prosthétique espagnol devant s + consonne", () => {
    expect(matches("Es poilear el juego", "spoilear", "es")).toBe(false);
    expect(matches("Voy a espoilear el final", "spoilear", "es")).toBe(true);
    expect(matches("Voy a spoilear el final", "spoilear", "es")).toBe(true);
  });

  test("suffixes haoussa observés dans le catalogue", () => {
    expect(matches("Fansan da shi", "fansa", "ha")).toBe(true);
    expect(matches("Gwagwarmayar siyasa", "gwagwarmaya", "ha")).toBe(true);
    expect(matches("Fushinsa ya tashi", "fushi", "ha")).toBe(true);
  });
});

describe("écritures sans séparateur de mots", () => {
  test("inclusion directe documentée pour les scripts continus", () => {
    expect(matches("Je suis très 佛系 aujourd'hui", "佛系")).toBe(true);
    expect(matches("대박이다", "대박")).toBe(true);
    expect(matches("やばいよ", "やばい")).toBe(true);
    expect(matches("สนุกมาก", "สนุก")).toBe(true);
    expect(hasContinuousScript("대박이다")).toBe(true);
    expect(hasContinuousScript("PE")).toBe(false);
    // Une ligne mixte ne doit pas rouvrir l'inclusion pour une expression
    // latine : « peut » reste un mot, même précédé de CJK.
    expect(matches("Je 看 peut", "PE")).toBe(false);
    expect(matches("我peut看", "PE")).toBe(false);
    expect(matches("我看 PE 鞋", "PE")).toBe(true);
    expect(compileExpression("佛系")?.continuousScript).toBe(true);
    expect(compileExpression("PE")?.continuousScript).toBe(false);
  });
});

describe("expressions non comparables", () => {
  test("une expression sans caractère porteur de sens est ignorée", () => {
    expect(compileExpression("")).toBeNull();
    expect(compileExpression("  ?!… ")).toBeNull();
    expect(matches("anything", "…")).toBe(false);
  });
});

describe("exemples du catalogue", () => {
  const majorLanguages = new Set([
    "en",
    "fr",
    "es",
    "ru",
    "ar",
    "hi",
    "zh",
    "ko",
  ]);

  type CatalogMiss = { key: string; language: string; context: string };

  /** Tous les contextes où l'ancienne recherche par sous-chaîne matchait. */
  const catalogCases = SLANG_SEED.flatMap((entry) => {
    const context = entry.context ?? "";
    const normalizedContext = normalizeForLexicalMatch(context);
    const normalizedExpression = normalizeForLexicalMatch(entry.expression);
    if (!normalizedContext.includes(normalizedExpression)) return [];
    return [{ entry, context }];
  });

  const measure = (accept: (entry: (typeof catalogCases)[number]["entry"]) => boolean) => {
    const checked: CatalogMiss[] = [];
    const misses: CatalogMiss[] = [];
    for (const { entry, context } of catalogCases) {
      if (!accept(entry)) continue;
      const item = {
        key: `${entry.language}:${entry.expression}`,
        language: entry.language,
        context,
      };
      checked.push(item);
      if (!expressionMatches(context, entry.expression, entry.language)) {
        misses.push(item);
      }
    }
    return { checked, misses };
  };

  test("les huit langues principales ne perdent aucun contexte", () => {
    const { checked, misses } = measure((entry) =>
      majorLanguages.has(entry.language),
    );
    expect(checked.length).toBeGreaterThan(1000);
    expect(misses.map((m) => m.key)).toEqual([]);
  });

  test("catalogue complet : pertes mesurées et bornées", () => {
    const { checked, misses } = measure(() => true);
    expect(checked.length).toBeGreaterThan(4500);
    // 30 formes restantes sur 4 749 contextes (0,63 %) sont des variantes
    // orthographiques ou lexicales (translittérations persanes, redoublement
    // zoulou, « pararing » igbo), pas des flexions régulières. Toute hausse
    // serait une régression : le seuil est volontairement serré.
    expect(misses.length).toBeLessThanOrEqual(30);
    // P0.3.6 — le lot exact est épinglé : une variante qui disparaîtrait
    // ailleurs ne peut pas être compensée par une autre perte du même total.
    expect(misses.map((m) => m.key).sort()).toEqual([
      "bn:Phupham",
      "bn:Spin",
      "bn:Thakuma",
      "fa:Aghdam",
      "fa:Asheg",
      "fa:Befarma",
      "fa:Daste shoor",
      "fa:Delbar",
      "fa:Ghoroush kon",
      "fa:Jigar",
      "fa:Khab dare",
      "fa:Khahesh kon",
      "fa:Mahboobe",
      "fa:Mizban",
      "fa:Setoode",
      "fa:Sorkh-e joon",
      "fa:an",
      "fa:baz",
      "fa:dige shode",
      "fa:digikarde",
      "fa:ravan",
      "id:Awokawok",
      "id:Racun",
      "ig:Para",
      "pl:Kac",
      "tl:Hiya",
      "tl:Tampo",
      "tr:Sevgili",
      "tr:Yavuklu",
      "zu:isgubhu",
    ]);
    const languages = new Set(misses.map((m) => m.language));
    for (const language of majorLanguages) {
      expect(languages.has(language)).toBe(false);
    }
  });
});
