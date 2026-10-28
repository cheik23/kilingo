import { describe, expect, test } from "bun:test";
import { displayContext } from "../src/lib/pedagogicalContext";

/**
 * LOT 1 du bouclier pédagogique — ContextParser + landing publique.
 *
 * Les composants décident de leur rendu UNIQUEMENT via displayContext()
 * (aucun fallback brut de réintroduit). Chaque échéance de rendu est donc
 * exactement la sortie de displayContext() sur la donnée brute — testée ici
 * sur les 5 verdicts du module. Le module ContextParser.tsx réel est
 * importé pour prouver que le raccordement compile et charge (bun/ts).
 */
const GABARIT_MIXED =
  "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux] | [Ex: 'Teks mo ako pag nakauwi ka na' « Envoie-moi un texte »]";
const GABARIT_PURE =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire]";
const GABARIT_DIRECTIVE =
  "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Worqulture] | [Ex: à compléter par un natif]";
const GABARIT_AMBIGUOUS =
  "[Époque: 2020+] | [Niveau: VÉRIFIÉ] | [Source: Banque de mots] | [Ex: GG]";
const LABEL_LEGITIME =
  "[Télétravail] | Travail depuis son domicile. Ex: 'Work from home setup ko complete' (Installation du télétravail). Note: Très courant depuis 2020.";
const LIBRE = "« Il est leaking depuis lundi » — la météo intérieure des storytimes 2025.";

describe("lot 1 — décision de rendu partagée (ContextParser + landing)", () => {
  test("MIXED : le composant affiche l'exemple seul, jamais le gabarit", () => {
    const shown = displayContext(GABARIT_MIXED);
    expect(shown).toBe(
      "'Teks mo ako pag nakauwi ka na' « Envoie-moi un texte »",
    );
    expect(shown).not.toContain("[Époque");
    expect(shown).not.toContain("[Source");
  });

  test("PURE / DIRECTIVE / AMBIGUOUS : null → aucun bloc rendu, aucun fallback brut", () => {
    expect(displayContext(GABARIT_PURE)).toBeNull();
    expect(displayContext(GABARIT_DIRECTIVE)).toBeNull();
    expect(displayContext(GABARIT_AMBIGUOUS)).toBeNull();
  });

  test("LABEL : identité intégrale — information culturelle préservée", () => {
    expect(displayContext(LABEL_LEGITIME)).toBe(LABEL_LEGITIME);
  });

  test("libre : identité — les exemples de la landing continuent de s'afficher", () => {
    expect(displayContext(LIBRE)).toBe(LIBRE);
  });

  test("vide / absent : null — jamais « null » ni « undefined » rendus", () => {
    expect(displayContext("")).toBeNull();
    expect(displayContext(null)).toBeNull();
    expect(displayContext(undefined)).toBeNull();
  });
});

describe("lot 1 — parcours ContextParser réel (module chargé)", () => {
  test("le module compiles/charge et exporte le parseur", async () => {
    const mod = await import("../src/components/learner/ContextParser");
    expect(typeof mod.parseContext).toBe("function");
    expect(typeof mod.ContextParser).toBe("function");
  });

  test("fallback protégé : un gabarit MIXED ne réintroduit pas le texte brut", async () => {
    const { parseContext } = await import(
      "../src/components/learner/ContextParser"
    );
    const shown = displayContext(GABARIT_MIXED)!;
    // Pas de « | » dans l'exemple extrait → parse null → le composant rend
    // `shown` (l'exemple filtré), jamais `context` (la chaîne brute).
    expect(parseContext(shown)).toBeNull();
    expect(shown.startsWith("[Époque")).toBe(false);
  });

  test("LABEL : le rendu structuré reste branché sur la valeur (intacte)", async () => {
    const { parseContext } = await import(
      "../src/components/learner/ContextParser"
    );
    const shown = displayContext(LABEL_LEGITIME)!;
    // LABEL sans tube canonique → format libre, fallback = shown === brut légitime.
    expect(shown).toBe(LABEL_LEGITIME);
    expect(parseContext(shown)).toBeNull();
  });
});

describe("lot 1 — entrées réelles des 2 emplacements de la landing", () => {
  test("showcase (api.slang.trending) : gabarit → masqué ; exemple FR → intact", () => {
    // Les fiches « trending » peuvent porter le scaffolding de provenance
    // (toutes langues). Les contextes libres FR/CITATIONS passent intacts.
    expect(displayContext(GABARIT_MIXED)).not.toContain("[Niveau");
    expect(displayContext(LIBRE)).toBe(LIBRE);
  });

  test("quiz (api.dailySlang.getDailySlang) : le contexte de l'énigme suit la même règle", () => {
    expect(displayContext(GABARIT_PURE)).toBeNull();
    expect(displayContext(LABEL_LEGITIME)).toBe(LABEL_LEGITIME);
  });
});
