import { describe, expect, test } from "bun:test";
import { displayContext } from "../src/lib/pedagogicalContext";

/**
 * LOT 2 du bouclier pédagogique — 12 emplacements de rendu direct.
 *
 * Tous les composants lot 2 décident de leur rendu UNIQUEMENT via
 * displayContext() : l'échéance de rendu est EXACTEMENT la sortie de
 * displayContext() sur la donnée brute — gabarit PURE/DIRECTIVE/AMBIGUOUS
 * → null (aucun fallback brut), MIXED → exemple seul, LABEL/libre →
 * intact. Ces tests verrouillent la décision de rendu sur des entrées
 * RÉELLES du corpus (seeds fa/ig/es/tl, conversationрия, dictionnaire
 * libre) et le chargement des modules raccordés.
 */

const GABARIT_PURE =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire]";
const GABARIT_MIXED_FA =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire] | [Ex: 'کرم نریز!' - Arrête de m'embêter]";
const GABARIT_MIXED_ES =
  "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux] | [« me piropea por la calle » — me drague dans la rue]";
const GABARIT_DIRECTIVE_IG =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Worqulture] | [Ex: phrase-exemple non fournie ; à composer par un natif]";
const GABARIT_AMBIGUOUS =
  "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Banque de mots] | [Ex: GG]";
const LABEL_LEGITIME =
  "[Télétravail] | Travail depuis son domicile. Ex: 'Work from home setup ko complete' (Installation du télétravail). Note: Très courant depuis 2020.";
const LIBRE_FR =
  "« Il est leaking depuis lundi » — la météo intérieure des storytimes 2025.";

describe("lot 2 — décision de rendu partagée (12 emplacements)", () => {
  test("PURE : null → le bloc de contexte ne s'affiche pas (Atlas, DiscoverView…)", () => {
    expect(displayContext(GABARIT_PURE)).toBeNull();
  });

  test("DIRECTIVE (ig) : null → aucune consigne interne rendue", () => {
    const shown = displayContext(GABARIT_DIRECTIVE_IG);
    expect(shown).toBeNull();
  });

  test("AMBIGUOUS : null → pas d'exemple tronqué ni de token nu", () => {
    expect(displayContext(GABARIT_AMBIGUOUS)).toBeNull();
  });

  test("MIXED (fa) : l'exemple seul, jamais le gabarit", () => {
    const shown = displayContext(GABARIT_MIXED_FA)!;
    expect(shown).toBe("'کرم نریز!' - Arrête de m'embêter");
    expect(shown).not.toContain("[Époque");
    expect(shown).not.toContain("[Source");
  });

  test("MIXED (es/pt, partie libre) : le contenu sans les clés de provenance", () => {
    const shown = displayContext(GABARIT_MIXED_ES)!;
    expect(shown).toBe("« me piropea por la calle » — me drague dans la rue");
    expect(shown).not.toContain("[Niveau");
  });

  test("LABEL légitime : intact — aucune paire de crochets traitée en erreur", () => {
    expect(displayContext(LABEL_LEGITIME)).toBe(LABEL_LEGITIME);
  });

  test("libre : intact", () => {
    expect(displayContext(LIBRE_FR)).toBe(LIBRE_FR);
  });

  test("vide / absent : null — l'interface voit un bloc masqué, pas une chaîne vide", () => {
    expect(displayContext("")).toBeNull();
    expect(displayContext(null)).toBeNull();
    expect(displayContext(undefined)).toBeNull();
  });

  test("ingestion uniforme : null → les composants ne réaffichent jamais le brut", () => {
    // Le motif commun des 12 emplacements est
    // `{displayContext(x.context) && <p>{displayContext(x.context)}</p>}` :
    // si la fonction renvoie null, l'expression vaut null → aucun fallback
    // brut possible. Garantie structurelle : displayContext(null) === null.
    expect(displayContext(GABARIT_PURE)).toBeNull();
    expect(displayContext(GABARIT_DIRECTIVE_IG)).toBeNull();
    expect(displayContext(GABARIT_AMBIGUOUS)).toBeNull();
  });
});

describe("lot 2 — modules réellement raccordés (chargement bun/ts)", () => {
  test("ExpressionDetailCard charge et exporte ses deux blocs", async () => {
    const mod = await import("../src/components/learner/ExpressionDetailCard");
    expect(typeof mod.ExpressionDetailCard).toBe("function");
    expect(typeof mod.ExpressionCultureBlock).toBe("function");
  });

  test("SubtitlePanel charge (ContextAccordion + ligne méta filtrées en interne)", async () => {
    const mod = await import("../src/components/learner/SubtitlePanel");
    expect(mod.SubtitlePanel).toBeDefined();
  });

  test("DailySlangCard charge", async () => {
    const mod = await import("../src/components/learner/DailySlangCard");
    expect(mod.DailySlangCard).toBeDefined();
  });
});
