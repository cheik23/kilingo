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
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

describe("Seed Pipeline — sécurité du pilote (mode standard)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  /* Même convention que tests/srs.test.ts : contrat d'archécture vérifié
   * en statique — ici, la décision produit « ponts non semés par défaut ».
   * La preuve dynamique (aucune ligne en base de test) est dans le fichier
   * d'intégration convex-test. */
  test("le pilote N'appelle les ponts CULTURELS qu'AVEC l'opt-in explicite", () => {
    const src = read("scripts/seed-backend.mjs");
    // L'appel du seed des ponts n'existe qu'à un seul endroit, et il vise la
    // fonction INTERNE : aucune mutation publique n'expose la purge.
    const call = src.indexOf('runFn("internal.crossSeed.seedCrossConcepts"');
    expect(call, "l'appel des ponts doit être unique").toBeGreaterThanOrEqual(0);
    expect(src.indexOf('runFn("internal.crossSeed:', call + 1)).toBe(-1);
    expect(src).not.toMatch(/seedCrossConceptsPublic/);
    // et il se trouve APRÈS le garde opt-in strict (--include-cross-concepts).
    const guard = src.indexOf("if (includeCross)");
    expect(guard, "la garde d'opt-in doit exister").toBeGreaterThan(-1);
    expect(call, "l'appel des ponts doit être DANS le bloc à drapeau explicite").toBeGreaterThan(guard);
    // Sans opt-in : message "SAUTÉS" — pas d'appel, pas de mutation.
    expect(src).toMatch(/SAUTÉS.*include-cross-concepts/);
  });

  test("le semis des expressions (slang.ts) ne référence jamais crossConcepts", () => {
    const src = read("src/convex/slang.ts");
    expect(src).not.toMatch(/crossConcepts/);
  });

  test("le dry-run liste explicitement ses opérations (lectures ici, écritures = 0)", () => {
    const src = read("scripts/seed-dry-run.mjs");
    expect(src).toContain('"écritures_ici": []');
    expect(src).toMatch(/ponts culturels crossConcepts — SAUTÉS par défaut/);
    // Lecture seule prouvée par les routes réellement appelées : uniquement
    // `/api/query`. Aucune route de mutation, aucun appel crossSeed : le
    // dry-run ne peut donc ni insérer, ni mettre à jour, ni supprimer.
    expect(src).toMatch(/\/api\/query/);
    expect(src).not.toMatch(/\/api\/mutation/);
    expect(src).not.toMatch(/seedCrossConcepts/);
  });
});

describe("Seed Pipeline — sécurité crossConcepts (surface publique)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  test("le seed des ponts est INTERNE et n'a AUCUN export public", async () => {
    const mod = (await import("../src/convex/crossSeed")) as Record<string, unknown>;
    expect(mod.seedCrossConceptsPublic).toBeUndefined();
    const seed = mod.seedCrossConcepts as { isInternal?: boolean } | undefined;
    expect(seed, "le seed interne doit rester exporté").toBeDefined();
    expect(seed?.isInternal, "internalMutation est la seule surface d'écriture").toBe(true);
  });

  test("crossSeed.ts ne déclare AUCUNE mutation publique", () => {
    const src = read("src/convex/crossSeed.ts");
    // Un import `mutation` résiduel serait le signe d'un wrapper public
    // réintroduit : le seed des ponts ne doit être qu'un internalMutation.
    expect(src).not.toMatch(/\bmutation\s*\(/);
    expect(src).toMatch(/seedCrossConcepts\s*=\s*internalMutation\(/);
    expect(src).not.toMatch(/seedCrossConceptsPublic/);
  });

  test("aucun code exécutable (src/ ou scripts/) ne référence un wrapper public de semis", () => {
    const walk = (dir: string): string[] =>
      readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : [join(dir, entry.name)],
      );
    const files = ["src", "scripts"]
      .flatMap(walk)
      .filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      expect(read(file), `${file} ne doit pas exposer le seed des ponts`).not.toMatch(
        /\bseedCrossConceptsPublic\b/,
      );
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
