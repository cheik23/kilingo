/**
 * QUALITY SHIELD — gabarits ourdous avec/sans diacritique (audit 2026-10-24).
 *
 * Les chaînes de gabarit des cas 1, 2 et 6 sont des EXTRAITS RÉELS du
 * catalogue (slangSeedEnrichmentUr.ts / Ur2.ts / Ur3.ts), reprises
 * verbatim ; elles documentent les deux familles que le lot 2 a révélées :
 *   · Ur / Ur3  : « [Époque: …] | [Niveau: VÉRIFIÉ] | [Source: …] | [Ex: '…' - …] »
 *   · Ur2       : « [Epoque: …] | [Niveau: VERIFIE] | [Source: …] | [Ex: …] »
 * Les cas 3, 4, 5, 7 protègent les formats pédagogiques légitimes.
 */
import { describe, expect, test } from "bun:test";
import {
  displayContext,
  isProvenanceTemplate,
} from "../src/lib/pedagogicalContext";

// Cas 1 — gabarit ourdou ACCENTUÉ (extrait réel Ur3, cricket gully).
const GABARIT_ACCENTUE =
  "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Sport Pakistanais] | [Ex: 'Gully cricket match' - Match de cricket dans la ruelle]";

// Cas 2 — gabarit ourdou SANS accent (extrait réel Ur2).
const GABARIT_SANS_ACCENT =
  "[Epoque: 2010+] | [Niveau: VERIFIE] | [Source: Usage universel] | [Ex: Tension na lo, chill maro]";

// Cas 4 — labels pédagogiques valides (format id/am/ig, réel).
const LABEL_THEMATIQUE =
  "[Télétravail] | Travail depuis son domicile via des outils numériques.";

// Cas 5 — format structuré légitime à crochets, sans deux-points de provenance.
const FORMAT_STRUCTURE_LEGITIME =
  "[Sens littéral] | [Sens réel] | [Ex] | [Note]";

// Cas 6 — métadonnées mêlées à l'exemple (famille fa/es, gabarit + contenu).
const MELE_FABARIT =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire] | [Ex: 'چه فازیه؟' - C'est quoi ce délire ?]";

describe("qualityShield — gabarits ourdous avec/sans diacritique", () => {
  test("1. gabarit ourdou avec É» détection + extraction de l'exemple", () => {
    expect(isProvenanceTemplate(GABARIT_ACCENTUE)).toBe(true);
    expect(displayContext(GABARIT_ACCENTUE)).toBe(
      "'Gully cricket match' - Match de cricket dans la ruelle",
    );
  });

  test("2. gabarit ourdou sans accent (Epoque) : détection identique", () => {
    expect(isProvenanceTemplate(GABARIT_SANS_ACCENT)).toBe(true);
    expect(displayContext(GABARIT_SANS_ACCENT)).toBe(
      "Tension na lo, chill maro",
    );
  });

  test("3. le mot « époque » seul, dans un vrai contexte, n'est pas un gabarit", () => {
    const libre = "À cette époque, le mot désignait autre chose.";
    expect(isProvenanceTemplate(libre)).toBe(false);
    expect(displayContext(libre)).toBe(libre);
    const avecCrochet = "L'époque [2010+] a vu naître ce slang.";
    expect(isProvenanceTemplate(avecCrochet)).toBe(false);
    expect(displayContext(avecCrochet)).toBe(avecCrochet);
  });

  test("4. label pédagogique valide : AFFICHÉ INTACT", () => {
    expect(isProvenanceTemplate(LABEL_THEMATIQUE)).toBe(false);
    expect(displayContext(LABEL_THEMATIQUE)).toBe(LABEL_THEMATIQUE);
  });

  test("5. format structuré légitime [Sens littéral] | [Sens réel] | [Ex] | [Note] : intact", () => {
    expect(isProvenanceTemplate(FORMAT_STRUCTURE_LEGITIME)).toBe(false);
    expect(displayContext(FORMAT_STRUCTURE_LEGITIME)).toBe(
      FORMAT_STRUCTURE_LEGITIME,
    );
  });

  test("6. métadonnées mêlées à l'exemple : l'exemple seul est extrait", () => {
    expect(isProvenanceTemplate(MELE_FABARIT)).toBe(true);
    expect(displayContext(MELE_FABARIT)).toBe(
      "'چه فازیه؟' - C'est quoi ce délire ?",
    );
  });

  test("7. écriture ourdoue et caractères Unicode conservés rune à rune", () => {
    // Libre synthétique en graphie arabo-ourde + ponctuation native.
    const libreOurdu = "« یہ مشکل نہیں ہے » — this is no problem، سو؟";
    expect(displayContext(libreOurdu)).toBe(libreOurdu);
    // Gabarit réel : l'Ex extrait est le contenu EXACT (aucune
    // normalisation Unicode, aucune recomposition depuis la
    // translittération), apostrophe et tiret inclus.
    const affiche = displayContext(MELE_FABARIT) ?? "";
    expect([...affiche].length).toBe([..."'چه فازیه؟' - C'est quoi ce délire ?"].length);
    expect(affiche).toContain("چه فازیه؟");
    // Deux-points pleine-largeur (variante CJK documentée) : reconnue.
    const pleineLargeur =
      "[Epoque\uFF1A2010+] | [Niveau\uFF1AVERIFIE] | [Ex\uFF1ABhai, kya scene hai?]";
    expect(isProvenanceTemplate(pleineLargeur)).toBe(true);
    expect(displayContext(pleineLargeur)).toBe("Bhai, kya scene hai?");
  });
});
