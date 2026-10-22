import { describe, expect, test } from "bun:test";
import { COUNTRIES, normalizeRegion } from "../src/convex/languages";
import {
  DISCOVER_REGION_PREF,
  defaultRegionFor,
  effectiveRegion,
  readDiscoverRegionPref,
  writeDiscoverRegionPref,
} from "../src/lib/discoverRegion";

/* ═══════════════════════════════════════════════════════════════════════
   DÉFAUT RÉGIONAL ESPAGNOL — correspondances RÉELLES.

   Même convention que registers.test.ts : la règle appliquée côté backend
   (src/convex/slang.ts, discoveryDeck / list) est répliquée EXACTEMENT
   ici et appliquée à des lignes de données vivantes — on teste bien le
   filtrage des résultats, pas des noms de fonctions :

     deckMatch = (row.language === lang quand présent) ET
                 (!country OU normalizeRegion(row.region) === normalizeRegion(country))

   Côté UI, `effectiveRegion` est ce que DiscoverView envoie comme
   argument `country` au moment où l'utilisateur choisit une langue.
   ═══════════════════════════════════════════════════════════════════════ */

/** Lignes vivantes : telles que retournées par les seeds espagnol/anglais. */
const ROWS = [
  { language: "es", region: "España" },
  { language: "es", region: "Espagne" },
  { language: "es", region: "Espagne " }, // espaces parasites → normalisation
  { language: "es", region: "Chili" },
  { language: "es", region: "Chile" },
  { language: "es", region: "Mexique" },
  { language: "es", region: "México" },
  { language: "en", region: "US (AAVE)" },
  { language: "en", region: "UK" },
] as const;

const deckMatch = (
  row: { language: string; region: string },
  args: { language?: string; country?: string },
): boolean => {
  if (args.language && row.language !== args.language) return false;
  if (
    args.country &&
    args.country !== "all" && // la UI n'envoie pas `country` pour « Tous »
    normalizeRegion(row.region) !== normalizeRegion(args.country)
  ) {
    return false;
  }
  return true;
};

const deck = (args: { language?: string; country?: string }) =>
  ROWS.filter((r) => deckMatch(r, args));

/* ── 1 · Une demande de deck espagnol ne retourne AUCUNE carte anglaise ── */
describe("deck espagnol — zéro infiltration d'une autre langue", () => {
  test("language « es » : les lignes en/US et en/UK sont exclues", () => {
    const out = deck({ language: "es" });
    expect(out.every((r) => r.language === "es")).toBe(true);
    expect(out.some((r) => r.language === "en")).toBe(false);
    expect(out.length).toBe(ROWS.length - 2);
  });

  test("country « es » n'ajoute aucune latitude de plus : toujours zéro carte en", () => {
    const out = deck({ language: "es", country: "es" });
    expect(out.every((r) => r.language === "es")).toBe(true);
  });
});

/* ── 2 · Espagne par défaut pour un apprenant d'espagnol sans préférence ── */
describe("défaut régional — Espagne pour l'espagnol", () => {
  test("effectiveRegion('es', null) → « es » (code canonique de COUNTRIES.es)", () => {
    expect(defaultRegionFor("es")).toBe("es");
    expect(effectiveRegion("es", null)).toBe("es");
    expect((COUNTRIES["es"] ?? []).some((c) => c.code === "es")).toBe(true);
  });

  test("le défaut est réellement envoyé au serveur : deck es/es = cartes d'Espagne", () => {
    // Le country transmis à discoveryDeck EST effectiveRegion() ; ici « es »
    // ⇒ partition (language es, regionKey "es").
    const out = deck({
      language: "es",
      country: effectiveRegion("es", null),
    });
    expect(out.length).toBe(3); // España + 2 cartes « Espagne »
    const regions = new Set(out.map((r) => normalizeRegion(r.region)));
    expect([...regions]).toEqual(["es"]);
  });
});

/* ── 3 · Une préférence régionale persistée est conservée ─────────────── */
describe("préférence régionale explicite persistée", () => {
  test("clé de persistance + lecture silencieuse sans stockage (bun)", () => {
    expect(DISCOVER_REGION_PREF).toBe("kilingo.discover.region");
    // Sans localStorage (bun) la préférence est null : le défaut régional
    // prend le relais ; en app, writeDiscoverRegionPref persiste sans
    // jamais lever d'exception (try/catch).
    expect(readDiscoverRegionPref()).toBe(null);
    writeDiscoverRegionPref("cl");
    writeDiscoverRegionPref(null);
    expect(readDiscoverRegionPref()).toBe(null);
  });

  test("le code persisté est conservé pour la langue où il existe", () => {
    expect(effectiveRegion("es", "cl")).toBe("cl");
  });
});

/* ── 4 · Une sélection explicite du Chili n'est PAS remplacée ─────────── */
test("Chili explicite : conservé, jamais remplacé par l'Espagne", () => {
  expect(effectiveRegion("es", "cl")).toBe("cl");
  const out = deck({ language: "es", country: effectiveRegion("es", "cl") });
  expect(out.every((r) => normalizeRegion(r.region) === "cl")).toBe(true);
  expect(out.length).toBe(2); // Chili + Chile
});

/* ── 5 · Le choix explicite « tous pays » continue de fonctionner ─────── */
test("« all » explicite : jamais ré-emporté par le défaut Espagne", () => {
  expect(effectiveRegion("es", "all")).toBe("all");
  expect(effectiveRegion("es", "all")).not.toBe("es");
  expect(deck({ language: "es", country: effectiveRegion("es", "all") }).length).toBe(
    ROWS.length - 2,
  );
});

/* ── 6 · Le filtre Espagne ne retourne QUE la région espagnole canonique ── */
test("country es : España / Espagne (casse, espaces) tombent sur « es », rien d'autre", () => {
  expect(normalizeRegion("España")).toBe("es");
  expect(normalizeRegion("espagne")).toBe("es");
  expect(normalizeRegion("spain")).toBe("es");
  expect(normalizeRegion("Espagne ")).toBe("es");
  // Une région qui n'est PAS l'Espagne ne normalise jamais vers « es ».
  expect(normalizeRegion("Chili")).toBe("cl");
  expect(normalizeRegion("México")).toBe("mx");
  expect(deck({ language: "es", country: "es" }).every((r) =>
    ["España", "Espagne", "Espagne "].includes(r.region),
  )).toBe(true);
});

/* ── 7 · Une autre langue n'hérite PAS du défaut régional espagnol ────── */
describe("aucun héritage espagnol hors « es »", () => {
  test("les autres langues restent sur « all » sans explicitRegion", () => {
    expect(defaultRegionFor("en")).toBe("all");
    expect(effectiveRegion("en", null)).toBe("all");
    expect(effectiveRegion("ar", null)).toBe("all");
    expect(effectiveRegion("de", null)).toBe("all");
  });

  test("préférence espagnole inapplicable ailleurs → repli « all »", () => {
    // « es » (Espagne) choisi en espagnol, puis passage à l'anglais :
    // une région n'a de sens que dans sa langue (comportement inchangé).
    expect(effectiveRegion("en", "es")).toBe("all");
    // Langue « all » (TOUTES) : aucune région, même en préférence explicite.
    expect(effectiveRegion("all", "es")).toBe("all");
    expect(effectiveRegion("all", null)).toBe("all");
  });
});
