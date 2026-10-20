import { describe, expect, test } from "bun:test";
import {
  REGISTER_IDS,
  registerKey,
  type RegisterId,
} from "../src/convex/languages";

/* ═══════════════════════════════════════════════════════════════════════
   FILTRES DE REGISTRE — CORRESPONDANCES RÉELLES

   Les chips de DiscoverView envoient un identifiant normalisé
   (urban | colloquial | unfiltered | trending) aux requêtes Convex
   (slang.list / slang.discoveryDeck), qui comparent
   `registerKey(row.register) === registerKey(args.register)`.
   Ces tests verrouillent cette chaîne : chaque registre matche, « tous »
   ne filtre rien, les variantes de casse/d'espaces tombent juste, et une
   valeur inconnue n'est jamais discrètement confondue avec un registre.
   ═══════════════════════════════════════════════════════════════════════ */

/** La correspondance que le backend applique (src/convex/slang.ts). */
const matchesRegister = (
  rowRegister: string,
  filter: string | undefined,
): boolean =>
  filter === undefined || registerKey(rowRegister) === registerKey(filter);

describe("registerKey — identifiants normalisés (ce que la UI envoie)", () => {
  test("les quatre identifiants passent de façon identitaire", () => {
    expect(REGISTER_IDS).toEqual(["urban", "colloquial", "unfiltered", "trending"]);
    for (const id of REGISTER_IDS) {
      expect(registerKey(id)).toBe<RegisterId>(id);
    }
  });

  test("valeur absente → pas de filtre (ÉTAT « Tous » : sans exclusion)", () => {
    // DiscoverView n'envoie AUCUNE clé register quand « Tous » est actif :
    // le backend reçoit undefined ⇒ wantedRegister null ⇒ aucune exclusion.
    expect(matchesRegister("street", undefined)).toBe(true);
    expect(matchesRegister("casual", undefined)).toBe(true);
    expect(matchesRegister("internet", undefined)).toBe(true);
    expect(matchesRegister("vulgar", undefined)).toBe(true);
    // Et une valeur inconnue reste visible sous « Tous » (jamais écartée).
    expect(matchesRegister("familier", undefined)).toBe(true);
  });
});

describe("registerKey — données historiques (legacy)", () => {
  test("street → urban", () => {
    expect(registerKey("street")).toBe("urban");
    expect(matchesRegister("street", "urban")).toBe(true);
    expect(matchesRegister("street", "colloquial")).toBe(false);
  });

  test("casual → colloquial", () => {
    expect(registerKey("casual")).toBe("colloquial");
    expect(matchesRegister("casual", "colloquial")).toBe(true);
    expect(matchesRegister("casual", "unfiltered")).toBe(false);
  });

  test("vulgar → unfiltered", () => {
    expect(registerKey("vulgar")).toBe("unfiltered");
    expect(matchesRegister("vulgar", "unfiltered")).toBe(true);
    expect(matchesRegister("vulgar", "trending")).toBe(false);
  });

  test("internet → trending", () => {
    expect(registerKey("internet")).toBe("trending");
    expect(matchesRegister("internet", "trending")).toBe(true);
    expect(matchesRegister("internet", "urban")).toBe(false);
  });
});

describe("registerKey — variantes de casse et d'espaces (données vivantes)", () => {
  test("casse invariante côté source ET côté filtre", () => {
    expect(registerKey("Street")).toBe("urban");
    expect(registerKey("STREET")).toBe("urban");
    expect(registerKey("Urban")).toBe("urban");
    expect(matchesRegister("Street", "URBAN")).toBe(true);
    expect(matchesRegister("street", "Urban")).toBe(true);
  });

  test("espaces parasites tolérés sans retoucher les données sources", () => {
    expect(registerKey("  casual  ")).toBe("colloquial");
    expect(matchesRegister(" internet ", "trending")).toBe(true);
  });
});

describe("registerKey — valeurs inconnues : jamais confondues", () => {
  test("une valeur hors grille ne matche AUCUN filtre de registre", () => {
    // registre inconnu → null ; null === null false avec tout wantedRegister
    expect(registerKey("familier")).toBe(null);
    expect(registerKey("argot")).toBe(null);
    expect(registerKey("")).toBe(null);
    expect(matchesRegister("familier", "urban")).toBe(false);
    expect(matchesRegister("", "trending")).toBe(false);
    // L'état vide « Rien avec ces filtres » est légal : pas fuite d'autre catégorie.
  });

  test("chaque filtre n'affiche QUE son registre (per_register)", () => {
    const rows = ["street", "casual", "vulgar", "internet"] as const;
    for (const filter of REGISTER_IDS) {
      const hits = rows.filter((r) => matchesRegister(r, filter));
      expect(hits.length).toBe(1);
    }
  });
});
