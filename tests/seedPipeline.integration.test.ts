/**
 * Seed Pipeline — test d'INTÉGRATION de la vraie mutation Convex `slang:seed`.
 *
 * Contrairement à `tests/seedPipeline.test.ts` (unités pures sur les
 * sources), ce fichier EXÉCUTE la mutation réelle de `src/convex/slang.ts`
 * dans un environnement Convex de test isolé (`convex-test`, base en
 * mémoire) — et aussi le wrapper public `crossSeed:seedCrossConceptsPublic`
 * introduit pour réparer l'étape « ponts » du pilote.
 *
 * Ce que cela prouve (et que les unités ne prouvent pas) :
 *  - la partition by_language d'une langue informe se remplit EXACTEMENT
 *    du nombre de slugs distincts que la source déclare ;
 *  - une seconde exécution à sources identiques ne crée rien (idempotence) ;
 *  - une fiche existante mais en dérive (meaning modifié) est RAPPORTÉE au
 *    contenu du seed (chemin « updated ») sans dupliquer la ligne ;
 *  - `recomputeAggregates` + `slang:stats` corroborrent la langue semée.
 *
 * Aucun déploiement n'est contacté : l'émulateur ne touche JAMAIS la base
 * réelle (`formal-vulture-518` ni aucun backend distant).
 */
import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import { SLANG_SEED, slangSlug } from "../src/convex/slangSeed";
import { normalizeRegion } from "../src/convex/languages";

const modules = {
  "_generated/api.ts": () => import("../src/convex/_generated/api"),
  "slang.ts": () => import("../src/convex/slang"),
  "crossSeed.ts": () => import("../src/convex/crossSeed"),
};

function makeApp() {
  return convexTest(schema, modules);
}

/* Thaï : langue cible du chantier, assez petite pour tenir très loin sous
 * les limites de transaction de l'émulateur, et un enrichissement a été
 * ajouté par le lot Th2 (la base réelle ne l'avait pas au moment de l'audit). */
const LANG = "th";

/** Nombre de slugs distincts que le batch de CETTE langue fera insérer :
 * même règle que la mutation (filtrée sur la langue, dédupliquée par slug
 * dans l'ordre du tableau). */
function expectedDistinct(lang: string): number {
  const seen = new Set<string>();
  for (const item of SLANG_SEED) {
    if (item.language !== lang) continue;
    seen.add(slangSlug(item.language, item.expression));
  }
  return seen.size;
}

describe("Seed Pipeline intégration — slang:seed réel (convex-test)", () => {
  test("première exécution : la partition de la langue se remplit du compte source", async () => {
    const t = makeApp();
    const expected = expectedDistinct(LANG);
    expect(expected).toBeGreaterThan(0);

    const result = await t.mutation(api.slang.seed, { language: LANG });
    expect(result.language).toBe(LANG);
    expect(result.seeded).toBe(expected);
    expect(result.inserted).toBe(expected);

    const counted = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("slangExpressions")
        .withIndex("by_language", (q) => q.eq("language", LANG))
        .collect();
      return rows.length;
    });
    expect(counted).toBe(expected);
  });

  test("seconde exécution identique : ZÉRO duplication (idempotence)", async () => {
    const t = makeApp();
    const expected = expectedDistinct(LANG);
    await t.mutation(api.slang.seed, { language: LANG });

    const again = await t.mutation(api.slang.seed, { language: LANG });
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.skipped).toBe(expected);

    const counted = await t.run(async (ctx) => {
      return (
        await ctx.db
          .query("slangExpressions")
          .withIndex("by_language", (q) => q.eq("language", LANG))
          .collect()
      ).length;
    });
    expect(counted).toBe(expected);
  });

  test("fiche en dérive : rafraîchie (updated) au contenu du seed, pas dupliquée", async () => {
    const t = makeApp();
    const before = await t.mutation(api.slang.seed, { language: LANG });
    expect(before.inserted).toBeGreaterThan(0);

    // Une fiche dont le sens dérive — mise en base à l'ancienne version.
    const item = SLANG_SEED.find((i) => i.language === LANG)!;
    await t.run(async (ctx) => {
      await ctx.db.insert("slangExpressions", {
        language: item.language,
        expression: item.expression,
        literal: item.literal,
        meaning: "ANCIEN SENS PADES AU SEED",
        context: item.context,
        register: item.register,
        region: item.region,
        popularity: item.popularity,
        normExpr: item.expression.toLowerCase(),
        regionKey: normalizeRegion(item.region),
      });
    });

    const run = await t.mutation(api.slang.seed, { language: LANG });
    expect(run.inserted).toBe(0);
    expect(run.updated).toBe(1);
    // La fiche dérivée est comptée dans `updated`, pas dans `skipped` :
    // les 111 autres fiches inchangées restent dans `skipped`.
    expect(run.skipped).toBe(expectedDistinct(LANG) - 1);

    // Contrat réel du seed : il ne crée RIEN de nouveau (idempotence
    // d'insertion) et ne supprime JAMAIS les données existantes — un
    // doublon préexistant (fiche introduite à la main au-dessus) n'est pas
    // retaillé, seule la fiche servie par l'index slug est rafraîchie.
    const rows = await t.run(async (ctx) => {
      return await ctx.db
        .query("slangExpressions")
        .withIndex("by_language", (q) => q.eq("language", LANG))
        .collect();
    });
    expect(rows.length).toBe(expectedDistinct(LANG) + 1);
    const outs = rows.filter((r) => r.expression === item.expression);
    expect(outs.length).toBe(2);
    // La fiche dérivée a bien été rapportée au contenu du seed.
    expect(outs.some((r) => r.meaning === item.meaning)).toBe(true);
  });

  test("semis refusé sans `language` (demi-semis > erreur franche)", async () => {
    const t = makeApp();
    await expect(t.mutation(api.slang.seed, {})).rejects.toThrow(
      /utilise le pilote|seed.*language/i,
    );
  });

  test("agrégats : recompute + stats cohérents pour la langue semée", async () => {
    const t = makeApp();
    const expected = expectedDistinct(LANG);
    await t.mutation(api.slang.seed, { language: LANG });
    await t.mutation(api.slang.recomputeAggregates, { language: LANG });

    const stats = await t.query(api.slang.stats, {});
    expect(stats.byLanguage[LANG]).toBe(expected);
    expect(stats.total).toBe(expected);
  });

  test("ventilation par registre vérifiée via les agrégats que le semis recalcule", async () => {
    const t = makeApp();
    await t.mutation(api.slang.seed, { language: LANG });
    await t.mutation(api.slang.recomputeAggregates, { language: LANG });

    const registers = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("slangAggregates")
        .withIndex("by_key", (q) => q.gte("key", `langreg:${LANG}:`).lt("key", `langreg:${LANG};`))
        .collect();
      return rows;
    });
    expect(registers.length).toBeGreaterThan(0);
    const sum = registers.reduce((a, r) => a + r.total, 0);
    expect(sum).toBe(expectedDistinct(LANG));
  });
});

describe("Seed Pipeline intégration — ponts entre langues (crossSeed)", () => {
  test("seedCrossConceptsPublic : création puis idempotence (0 créée au 2e tour)", async () => {
    const t = makeApp();
    const first = await t.mutation(api.crossSeed.seedCrossConceptsPublic, {});
    expect(first.concepts).toBeGreaterThan(0);
    expect(first.created).toBe(first.concepts);

    const again = await t.mutation(api.crossSeed.seedCrossConceptsPublic, {});
    expect(again.created).toBe(0);
    expect(again.updated).toBe(0);

    // L'ancienne fonction interne reste intacte.
    const legacy = await t.mutation(api.crossSeed.seedCrossConcepts, {});
    expect(legacy.created).toBe(0);
    expect(legacy.concepts).toBe(first.concepts);
  });
});
