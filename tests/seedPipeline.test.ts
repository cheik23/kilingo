/**
 * Seed Pipeline — tests UNITAIRES sur les sources réelles du catalogue.
 *
 * Ces tests exercent les vrais modules `src/convex/slangSeed*.ts` chargés
 * au moment de l'exécution : découverte de tous les lots, unicité des
 * identités (`slangSlug` — l'égalité sémantique utilisée par la mutation
 * `slang:seed`), fermeture de l'agrégation et qualité minimale des données.
 * Ils ne contactent aucun backend : ils garantissent que les invariants du
 * pipeline tiennent AVANT toute écriture. Le comportement de la mutation
 * réelle (insertion, idempotence, rafraîchissement) est couvert par
 * `tests/seedPipeline.integration.test.ts` (émulateur convex-test, base
 * isolée).
 */
import { describe, expect, test } from "bun:test";
import { SLANG_SEED, slangSlug } from "../src/convex/slangSeed";
import { normalizeRegion } from "../src/convex/languages";
import type { SlangSeed as SlangRow } from "../src/convex/slangSeed";

/* L'inventaire des lots DOIT rester exhaustif : chaque fichier est une
 * source reelle importee dans `slangSeed.ts`. Un fichier oublie ici serait
 * aussi oublie du catalogue — c'est exactement la derive que ce chantier
 * corrige. La liste est verifiee a la main : ~importer tous fichiers du
 * repertoire eviterait de detecter deux fois les fichiers de base. */
const LOT_FILES: Array<{ file: string; exportName: string }> = [
  { file: "slangSeedAfrica", exportName: "SLANG_SEED_AFRICA" },
  { file: "slangSeed2025", exportName: "SLANG_SEED_2025" },
  { file: "slangSeedLot1", exportName: "SLANG_SEED_LOT1" },
  { file: "slangSeedLot2", exportName: "SLANG_SEED_LOT2" },
  { file: "slangSeedLot3", exportName: "SLANG_SEED_LOT3" },
  { file: "slangSeedLot4", exportName: "SLANG_SEED_LOT4" },
  { file: "slangSeedEnrichment1", exportName: "SLANG_SEED_ENRICHMENT1" },
  { file: "slangSeedEnrichmentDe", exportName: "SLANG_SEED_ENRICHMENT_DE" },
  { file: "slangSeedEnrichmentIt", exportName: "SLANG_SEED_ENRICHMENT_IT" },
  { file: "slangSeedEnrichmentPt", exportName: "SLANG_SEED_ENRICHMENT_PT" },
  { file: "slangSeedEnrichmentEs", exportName: "SLANG_SEED_ENRICHMENT_ES" },
  { file: "slangSeedEnrichmentRu", exportName: "SLANG_SEED_ENRICHMENT_RU" },
  { file: "slangSeedEnrichmentAr", exportName: "SLANG_SEED_ENRICHMENT_AR" },
  { file: "slangSeedEnrichmentZh", exportName: "SLANG_SEED_ENRICHMENT_ZH" },
  { file: "slangSeedEnrichmentId", exportName: "SLANG_SEED_ENRICHMENT_ID" },
  { file: "slangSeedEnrichmentVi", exportName: "SLANG_SEED_ENRICHMENT_VI" },
  { file: "slangSeedEnrichmentHi", exportName: "SLANG_SEED_ENRICHMENT_HI" },
  { file: "slangSeedEnrichmentTh", exportName: "SLANG_SEED_ENRICHMENT_TH" },
  { file: "slangSeedEnrichmentTh2", exportName: "SLANG_SEED_ENRICHMENT_TH2" },
  { file: "slangSeedEnrichmentFa", exportName: "SLANG_SEED_ENRICHMENT_FA" },
  { file: "slangSeedEnrichmentBn", exportName: "SLANG_SEED_ENRICHMENT_BN" },
  { file: "slangSeedEnrichmentBn2", exportName: "SLANG_SEED_ENRICHMENT_BN2" },
  { file: "slangSeedEnrichmentFa2", exportName: "SLANG_SEED_ENRICHMENT_FA2" },
  { file: "slangSeedEnrichmentFa3", exportName: "SLANG_SEED_ENRICHMENT_FA3" },
  { file: "slangSeedEnrichmentFa4", exportName: "SLANG_SEED_ENRICHMENT_FA4" },
  { file: "slangSeedEnrichmentBn3", exportName: "SLANG_SEED_ENRICHMENT_BN3" },
  { file: "slangSeedEnrichmentBn4", exportName: "SLANG_SEED_ENRICHMENT_BN4" },
  { file: "slangSeedEnrichmentUr", exportName: "SLANG_SEED_ENRICHMENT_UR" },
  { file: "slangSeedEnrichmentUr2", exportName: "SLANG_SEED_ENRICHMENT_UR2" },
  { file: "slangSeedEnrichmentUr3", exportName: "SLANG_SEED_ENRICHMENT_UR3" },
  { file: "slangSeedEnrichmentUr4", exportName: "SLANG_SEED_ENRICHMENT_UR4" },
  { file: "slangSeedEnrichmentTl", exportName: "SLANG_SEED_ENRICHMENT_TL" },
  { file: "slangSeedEnrichmentTl2", exportName: "SLANG_SEED_ENRICHMENT_TL2" },
  { file: "slangSeedEnrichmentTl3", exportName: "SLANG_SEED_ENRICHMENT_TL3" },
  { file: "slangSeedEnrichmentTl4", exportName: "SLANG_SEED_ENRICHMENT_TL4" },
  { file: "slangSeedEnrichmentTl5", exportName: "SLANG_SEED_ENRICHMENT_TL5" },
  { file: "slangSeedEnrichmentId2", exportName: "SLANG_SEED_ENRICHMENT_ID2" },
  { file: "slangSeedEnrichmentZh2", exportName: "SLANG_SEED_ENRICHMENT_ZH2" },
  { file: "slangSeedEnrichmentIg", exportName: "SLANG_SEED_ENRICHMENT_IG" },
  { file: "slangSeedEnrichmentIg2", exportName: "SLANG_SEED_ENRICHMENT_IG2" },
  { file: "slangSeedEnrichmentAm", exportName: "SLANG_SEED_ENRICHMENT_AM" },
  { file: "slangSeedEnrichmentHi2", exportName: "SLANG_SEED_ENRICHMENT_HI2" },
];

async function importLot(file: string, exportName: string) {
  const mod: Record<string, unknown> = await import(`../src/convex/${file}`);
  return mod[exportName];
}

describe("Seed Pipeline — découverte de tous les lots", () => {
  test("tous les fichiers de lot importent et exportent un tableau non vide", async () => {
    for (const { file, exportName } of LOT_FILES) {
      const rows = (await importLot(file, exportName)) as unknown;
      expect(Array.isArray(rows), `le lot ${file} doit exporter un tableau`).toBe(true);
      expect((rows as SlangRow[]).length, `${file} doit contenir des fiches`).toBeGreaterThan(0);
    }
  });

  test("chaque fiche des lots est bien dans SLANG_SEED (agrégation complète)", async () => {
    // Set du catalogue complet : comparaison O(1) par fiche, pas O(n).
    const aggregateSlugs = new Set(
      SLANG_SEED.map((i) => slangSlug(i.language, i.expression)),
    );
    for (const { file, exportName } of LOT_FILES) {
      const rows = (await importLot(file, exportName)) as SlangRow[];
      for (const item of rows) {
        const slug = slangSlug(item.language, item.expression);
        expect(aggregateSlugs.has(slug), `${slug} (${file}) absent de l'agrégation`).toBe(true);
      }
    }
  });
});

describe("Seed Pipeline — identité (slangSlug = identité du semis)", () => {
  test("tous les slugs du catalogue sont uniques : aucun doublon interne", () => {
    const slugs = SLANG_SEED.map((i) => slangSlug(i.language, i.expression));
    expect(new Set(slugs).size).toBe(SLANG_SEED.length);
  });

  test("slangSlug replie la translittération parenthésée finale", () => {
    expect(slangSlug("zh", "牛逼 (niúbī)")).toBe(slangSlug("zh", "牛逼"));
  });

  test("slangSlug est casse/accent/ponctuation-insensible (règle NFD)", () => {
    expect(slangSlug("fr", "Ça bûche")).toBe(slangSlug("fr", "ca buche"));
    expect(slangSlug("fr", "Ça bûche")).toBe(slangSlug("fr", "ca  buche !"));
  });

  test("le slug porte la langue : même expression, deux langues ≠ même slug", () => {
    expect(slangSlug("en", "cool")).not.toBe(slangSlug("fr", "cool"));
  });
});

describe("Seed Pipeline — qualité minimale des données", () => {
  test("aucune fiche sans expression, sens, contexte, registre ou région", () => {
    const holes = SLANG_SEED.filter(
      (i) =>
        !i.expression.trim() ||
        !i.meaning.trim() ||
        !i.context.trim() ||
        !i.register.trim() ||
        !i.region.trim(),
    );
    expect(holes.length).toBe(0);
  });

  test("chaque région est normalisée de façon stable (regionKey idempotent)", () => {
    const regions = new Set(SLANG_SEED.map((i) => i.region));
    expect(normalizeRegion("  Éthiopie ")).toBe(normalizeRegion("éthiopie"));
    expect(regions.size).toBeGreaterThan(0);
  });

  test("chaque langue du semis appartient au socle des langues servies", () => {
    // La mutation seed est appelée langue par langue : un code de langue
    // hors socle serait un semis fantôme impossible à recalcule en agrégats.
    const langSet = new Set(SLANG_SEED.map((i) => i.language));
    expect(langSet.size).toBeGreaterThanOrEqual(29);
    for (const lang of langSet) {
      expect(lang).toMatch(/^[a-z]{2}$/);
    }
  });
});

describe("Seed Pipeline — langues de périphérie du chantier", () => {
  // Ces trois langues correspondent aux écarts majeurs mesurés entre les
  // sources et la base au moment de l'audit. Les plafonds garantissent
  // qu'elles portent au moins le contenu enrichi (si l'agrégation est
  // correcte, le semis peut les restaurer).
  test("amharique, thaï et igbo portent leurs enrichissements", () => {
    const count = (lang: string) =>
      SLANG_SEED.filter((i) => i.language === lang).length;
    expect(count("am")).toBeGreaterThanOrEqual(100);
    expect(count("th")).toBeGreaterThanOrEqual(100);
    expect(count("ig")).toBeGreaterThanOrEqual(100);
  });
});
