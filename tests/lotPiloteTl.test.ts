import { describe, expect, test } from "bun:test";
import { displayContext } from "../src/lib/pedagogicalContext";
import { SLANG_SEED_ENRICHMENT_TL } from "../src/convex/slangSeedEnrichmentTl";
import { SLANG_SEED_ENRICHMENT_TL as SLANG_PRISTINE } from "./fixtures/slangSeedEnrichmentTl.before-pilot";

/**
 * Lot pilote tl (audit-quality-shield/lot-pilote) — non-régression.
 *
 * 19 fiches de slangSeedEnrichmentTl.ts ont été nettoyées : le gabarit de
 * provenance `[Époque: …] | [Niveau: …] | [Source: …] | [Ex: …]` a été retiré,
 * le corps du segment Ex (exemple + traduction + note déjà intégrée) est
 * conservé VERBATIM. Rien d'autre n'a été touché.
 *
 * ADDENDUM (audit-quality-shield/lot-pilote/validation-linguistique) :
 * 2 corrections linguistiques approuvées s'ajoutent au nettoyage mécanique —
 * tl:Guize (context, exemple complet + « chez Rain ») et tl:Sana all
 * (context, « la chance ! »). Voir corrections-linguistiques-tl.json.
 *
 * Ce test compare le fichier vivant au snapshot `avant/` (copie octet pour
 * octet prise avant toute modification, SHA-256 7ea1f28f…) et vérifie le
 * comportement du Quality Shield après nettoyage.
 */

/* Les 19 fiches du lot (ordre du fichier). */
const LOT_TL = [
  "Teks",
  "Wer na u?",
  "Hir na me",
  "Guize",
  "OTW / OMW",
  "OL ka ba?",
  "SLR",
  "Kyah",
  "PM is the key",
  "LP",
  "SKL",
  "FKL",
  "Ge",
  "Kati",
  "Sharks",
  "Sags",
  "Scoobs",
  "Forda ang ferson",
  "Sana all",
] as const;

/** Extraction du corps Ex — même règle que corrige-tl.mjs (audit v3). */
function corpsEx(old: string): string {
  const anchor = "| [Ex:";
  const idx = old.indexOf(anchor);
  if (idx < 0) return "";
  let body = old.slice(idx + anchor.length);
  const tail = /\](\s*)$/.exec(body);
  if (!tail) return "";
  body = body.slice(0, body.length - 1 - tail[1].length);
  if (body.startsWith(" ")) body = body.slice(1);
  return body;
}

const key = (lang: string, expr: string) => `${lang}:${expr}`;
const byKey = () => {
  const m = new Map<string, (typeof SLANG_SEED_ENRICHMENT_TL)[number]>();
  for (const f of SLANG_SEED_ENRICHMENT_TL) m.set(key(f.language, f.expression), f);
  return m;
};
const byKeyP = () => {
  const m = new Map<string, (typeof SLANG_PRISTINE)[number]>();
  for (const f of SLANG_PRISTINE) m.set(key(f.language, f.expression), f);
  return m;
};

describe("Lot pilote tl — fidélité de l'extraction", () => {
  test("19 fiches ciblées, toutes présentes dans le fichier vivant et le snapshot", () => {
    expect(LOT_TL.length).toBe(19);
    const cur = byKey();
    const pris = byKeyP();
    for (const expr of LOT_TL) {
      expect(cur.has(key("tl", expr))).toBe(true);
      expect(pris.has(key("tl", expr))).toBe(true);
    }
  });

  test("aucun gabarit technique ne reste dans les contextes corrigés", () => {
    const cur = byKey();
    for (const expr of LOT_TL) {
      const ctx = cur.get(key("tl", expr))!.context;
      expect(ctx?.startsWith("[")).toBe(false);
      expect(ctx).not.toContain("[Époque");
      expect(ctx).not.toContain("[Niveau");
      expect(ctx).not.toContain("[Source");
      expect(ctx?.startsWith("Ex:")).toBe(false);
    }
  });

  // Exceptions (addendum) : les 2 corrections linguistiques approuvées
  // remplacent l'exemple mécanique — verbatim testé dans le test dédié ci-dessous.
  const CORRECTIONS_LINGUISTIQUES = new Set(["Guize", "Sana all"]);

  test("l'exemple extrait correspond EXACTEMENT au contenu source autorisé", () => {
    const cur = byKey();
    const pris = byKeyP();
    for (const expr of LOT_TL) {
      if (CORRECTIONS_LINGUISTIQUES.has(expr)) continue;
      const attendu = corpsEx(pris.get(key("tl", expr))!.context ?? "");
      expect(cur.get(key("tl", expr))!.context).toBe(attendu);
    }
  });

  test("2 corrections linguistiques approuvées (addendum) appliquées verbatim", () => {
    const cur = byKey();
    expect(cur.get("tl:Guize")!.context).toBe(
      "'Guize, pasyal tayo kina Rain!' « Les gars, on va chez Rain ! »",
    );
    expect(cur.get("tl:Sana all")!.context).toBe(
      "'May boyfriend na siya, sana all!' « Elle a un copain, la chance ! »",
    );
  });

  test("aucune traduction ni note utile n'a disparu (invariants des corps Ex)", () => {
    const cur = byKey();
    // Spot-checks verbatim : guillemets, ponctuation, note intégrée.
    expect(cur.get("tl:Teks")!.context).toBe(
      "'Teks mo ako pag nakauwi ka na' « Envoie-moi un texto quand tu seras rentré »",
    );
    expect(cur.get("tl:PM is the key")!.context).toBe(
      "'Buyer: HM po ang sweater? / You: PM is the key' « Le prix ? / Envoie-moi un DM pour les détails »",
    );
    expect(cur.get("tl:Ge")!.context).toBe(
      "'Tol, teammates tayo. / Ge.' « On co-op ? / Ok vas-y ! »",
    );
    expect(cur.get("tl:Sana all")!.context).toBe(
      "'May boyfriend na siya, sana all!' « Elle a un copain, la chance ! »",
    );
  });

  test("le bouclier préserve intégralement les contenus libres corrigés", () => {
    const cur = byKey();
    for (const expr of LOT_TL) {
      const ctx = cur.get(key("tl", expr))!.context;
      expect(displayContext(ctx)).toBe(ctx);
    }
  });

  test("les fiches hors lot sont strictement inchangées (tous champs)", () => {
    expect(SLANG_SEED_ENRICHMENT_TL.length).toBe(SLANG_PRISTINE.length);
    const cur = byKey();
    const pris = byKeyP();
    let horsLot = 0;
    for (const [k, pf] of pris) {
      const cf = cur.get(k)!;
      if (LOT_TL.includes(k.slice(3) as (typeof LOT_TL)[number])) {
        // seul `context` a changé sur le lot ; tout le reste est identique
        for (const champ of ["language", "expression", "literal", "meaning", "register", "region", "popularity", "validated"] as const) {
          expect((cf as never)[champ]).toBe((pf as never)[champ]);
        }
      } else {
        horsLot++;
        expect(JSON.stringify(cf)).toBe(JSON.stringify(pf));
      }
    }
    expect(horsLot).toBe(SLANG_PRISTINE.length - LOT_TL.length);
  });

  test("l'ordre et les gabarits des fiches exclues (ex. Rapsi) sont intacts", () => {
    expect(byKey().get("tl:Rapsi")!.context).toBe(
      byKeyP().get("tl:Rapsi")!.context,
    );
    expect(byKey().get("tl:Rapsi")!.context?.startsWith("[Époque")).toBe(true);
    // Le bouclier extrait toujours l'exemple des fiches non corrigées.
    const rapsi = byKeyP().get("tl:Rapsi")!.context!;
    expect(displayContext(rapsi)).toBe(corpsEx(rapsi));
  });
});
