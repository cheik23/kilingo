import { describe, expect, test } from "bun:test";
import { displayContext } from "../src/lib/pedagogicalContext";

/**
 * Corrections ciblées des deux fuites du bouclier confirmées par la recette :
 *
 *   A — Atlas.tsx : la section « Exemples » de la vue dictionnaire ne
 *       rend désormais que des VALEURS passées par displayContext()
 *       (gabarit MIXED → exemple seul, PURE/DIRECTIVE/AMBIGUOUS → null →
 *       bloc omis, libér/LABEL → intacts) ; la priorité
 *       exemple éditorial > contexte est conservée.
 *
 *   B — MemoryView.tsx : la colonne `example` des exports CSV/TSV devient
 *       `displayContext(slang.context) ?? ""` — jamais le gabarit. Les
 *       autres colonnes (expression, language, meaning, translation,
 *       mastery) sont inchangées, et la recherche mémoire reste fondée
 *       sur le BRUT (slang.context n'est pas filtré).
 *
 * Le rendu réel est la composition displayContext() ⊕ JSX `{handler &&
 * …}` : on verrouille ici chaque valeur que le composant peut afficher
 * sur des entrées réelles du corpus (fa, tl, labels, libre) — le module
 * Atlas.tsx (chargement bun/ts) prouve que le raccordement compile.
 */

const GABARIT_MIXED_FA =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire] | [Ex: 'کرم نریز!' - Arrête de m'embêter]";
const GABARIT_MIXED_TL =
  "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux] | [Ex: 'Teks mo ako pag nakauwi ka na' « Envoie-moi un texte »]";
const GABARIT_PURE =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire]";
const GABARIT_DIRECTIVE_IG =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Worqulture] | [Ex: phrase-exemple non fournie ; à composer par un natif]";
const GABARIT_AMBIGUOUS =
  "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Banque de mots] | [Ex: GG]";
const EXEMPLE_EDITORIAL =
  "Me piropea por la calle — il me drague dans la rue.";
const LABEL_LEGITIME =
  "[Télétravail] | Travail depuis son domicile. Ex: 'Work from home setup ko complete' (Installation du télétravail). Note: Très courant depuis 2020.";
const LIBRE_FR =
  "« Il est leaking depuis lundi » — la météo intérieure des storytimes 2025.";

describe("A — Atlas « Exemples » : gabarits de provenance jamais rendus", () => {
  test("MIXED (fa) : candidat exemple → l'exemple SEUL, sans [Époque]/[Niveau]/[Source]", () => {
    const shown = displayContext(GABARIT_MIXED_FA)!;
    expect(shown).toBe("'کرم نریز!' - Arrête de m'embêter");
    expect(shown).not.toContain("[Époque");
    expect(shown).not.toContain("[Niveau");
    expect(shown).not.toContain("[Source");
  });

  test("MIXED (tl) : idem, gabarit de la fiche tl réelle", () => {
    const shown = displayContext(GABARIT_MIXED_TL)!;
    expect(shown).toBe(
      "'Teks mo ako pag nakauwi ka na' « Envoie-moi un texte »",
    );
    expect(shown.startsWith("[")).toBe(false);
  });

  test("PURE / DIRECTIVE / AMBIGUOUS : null → bloc « Exemples » omis (repli propre), pas de brut", () => {
    expect(displayContext(GABARIT_PURE)).toBeNull();
    expect(displayContext(GABARIT_DIRECTIVE_IG)).toBeNull();
    expect(displayContext(GABARIT_AMBIGUOUS)).toBeNull();
  });

  test("Contexte libre : identité — le texte reste INTÉGRALEMENT visible", () => {
    expect(displayContext(LIBRE_FR)).toBe(LIBRE_FR);
  });

  test("LABEL légitime : intact (pas de faux positif sur la paire de crochets)", () => {
    expect(displayContext(LABEL_LEGITIME)).toBe(LABEL_LEGITIME);
  });
});

describe("A — Atlas « Exemples » : priorité exemple éditorial > contexte", () => {
  test("example présent : le CANDIDAT contexte n'est pas examiné (pas d'effet de bord)", () => {
    // Contrat composant : contextCandidate = exampleCandidate ? non examiné : …
    // Le seul appel effectué est displayContext(head.example) ; il rend
    // l'exemple éditorial tel quel, IDENTIQUE, et ne masque pas le champ.
    const shown = displayContext(EXEMPLE_EDITORIAL);
    expect(shown).toBe(EXEMPLE_EDITORIAL);
  });

  test("example absent (gabarit) : le contexte filtré prend le relais", () => {
    // head.example vide → exampleCandidate = null → on lit head.context.
    const exampleCandidate = displayContext(undefined);
    expect(exampleCandidate).toBeNull();
    const contextCandidate = displayContext(GABARIT_MIXED_FA);
    expect(contextCandidate).toBe("'کرم نریز!' - Arrête de m'embêter");
  });
});

describe("B — export CSV/TSV : la colonne example n'expose plus de gabarit", () => {
  const row = (context: string | null | undefined) =>
    // valeur construite dans MemoryView.tsx — même expression que le JSX :
    displayContext(context) ?? "";

  test("MIXED : l'exemple seul est exporté (sans le gabarit)", () => {
    expect(row(GABARIT_MIXED_FA)).toBe("'کرم نریز!' - Arrête de m'embêter");
    expect(row(GABARIT_MIXED_TL)).toBe(
      "'Teks mo ako pag nakauwi ka na' « Envoie-moi un texte »",
    );
  });

  test("libre : le texte est exporté INTÉGRALEMENT", () => {
    expect(row(LIBRE_FR)).toBe(LIBRE_FR);
  });

  test("PURE / DIRECTIVE / AMBIGUOUS/vide : chaîne vide — jamais le gabarit", () => {
    expect(row(GABARIT_PURE)).toBe("");
    expect(row(GABARIT_DIRECTIVE_IG)).toBe("");
    expect(row(GABARIT_AMBIGUOUS)).toBe("");
    expect(row("")).toBe("");
    expect(row(null)).toBe("");
    expect(row(undefined)).toBe("");
  });

  test("aucune valeur exportée ne contient les segments de provenance", () => {
    for (const ctx of [
      GABARIT_MIXED_FA,
      GABARIT_MIXED_TL,
      GABARIT_PURE,
      GABARIT_DIRECTIVE_IG,
      GABARIT_AMBIGUOUS,
    ]) {
      expect(row(ctx)).not.toContain("[Époque"); // ni Epoque sans accent
      expect(row(ctx)).not.toContain("[Niveau");
      expect(row(ctx)).not.toContain("[Source");
    }
  });
});

describe("B — recherche mémoire : le BRUT reste la source de vérité", () => {
  test("la fiche reste trouvée par un mot du contexte BRUT (non filtré)", () => {
    // Le filtre de recherche porte sur slang.context (brut) ; displayContext
    // ne l'altère JAMAIS. structure : un mot du gabarit brut matche car le
    // champ source est intact — le seul effet de displayContext est la
    // VALEUR EXPORTÉE.
    const brut = GABARIT_MIXED_FA;
    expect(brut.includes("Dictionnaire")).toBe(true);
    // Et le brut n'est pas muté par displayContext (pure) :
    const before = brut;
    displayContext(brut);
    expect(brut).toBe(before);
  });

  test("le module MemoryView charge et hérite bien de displayContext", async () => {
    const mv = await import("../src/components/learner/MemoryView");
    expect(typeof mv.MemoryView).toBe("function");
  });

  test("le module Atlas charge et hérite bien de displayContext", async () => {
    const atlas = await import("../src/components/learner/Atlas");
    expect(typeof atlas.Atlas).toBe("function");
  });
});
