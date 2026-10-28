import { describe, expect, test } from "bun:test";
import { displayContext, isProvenanceTemplate } from "../src/lib/pedagogicalContext";

/**
 * Bouclier d'affichage des contextes pédagogiques.
 *
 * Défaut corrigé : 1 742 fiches (sur 6 601) portaient un scaffolding de
 * provenance de catalogue dans le champ `context`, rendu tel quel à
 * l'apprenant :
 *   `[Époque: …] | [Niveau: VÉRIFIÉ] | [Source: …] | [Ex: …]`
 * Ces métadonnées de provenance ne doivent jamais atteindre l'apprenant.
 *
 * La règle d'audit (`GABARIT`, segment crochets) est TROP LARGE : elle
 * flague aussi les labels pédagogiques légitimes `[Label] | Sens. Ex: …`.
 * Ces faux positifs (538 fiches) doivent être PRÉSERVÉS.
 */

describe("pedagogicalContext — détection des gabarits de provenance", () => {
  test("un scaffolding de provenance complet est détecté", () => {
    const scaffold =
      "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux (FilipinoPod101, 2019)] | [Ex: 'Teks mo ako pag nakauwi ka na' « Envoie-moi un texte »]";
    expect(isProvenanceTemplate(scaffold)).toBe(true);
    // MIXED (classification-v3 : tl:Teks) — l'exemple réel extrait s'affiche,
    // sans le gabarit de provenance ; jamais la chaîne brute.
    expect(displayContext(scaffold)).toBe(
      "'Teks mo ako pag nakauwi ka na' « Envoie-moi un texte »",
    );
  });

  test("variante sans accent (« Epoque ») et clés multiples = toujours détecté", () => {
    expect(
      isProvenanceTemplate("[Epoque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire]"),
    ).toBe(true);
    // Deux segments de provenance suffisent, quelle que soit la clé.
    expect(isProvenanceTemplate("[Source: Dictionnaire] | [Ex: 'test']")).toBe(true);
  });

  test("un label pédagogique sans deux-points + contenu valide = PRÉSERVÉ", () => {
    const valid =
      "[Télétravail] | Travail depuis son domicile. Ex: 'Work from home setup ko complete' (Installation du télétravail). Note: Très courant depuis 2020 pendant la pandémie.";
    expect(isProvenanceTemplate(valid)).toBe(false);
    expect(displayContext(valid)).toBe(valid);
  });

  test("un seul [Ex: …] en milieu de phrase = conservé (pas de faux positif)", () => {
    const sentence = "Il a répondu [Ex: jamais] sans plus de précision.";
    expect(isProvenanceTemplate(sentence)).toBe(false);
    expect(displayContext(sentence)).toBe(sentence);
  });
});

describe("pedagogicalContext — préservation des écritures non latines", () => {
  test("contexte arabe intact, sans corruption", () => {
    const ar = "مفيش حاجة — Il n'y a rien";
    expect(displayContext(ar)).toBe(ar);
  });

  test("contexte chinois intact", () => {
    const zh = "梦想是955 — Mon rêve c'est un 955";
    expect(displayContext(zh)).toBe(zh);
  });

  test("contexte bengali et thaï intacts", () => {
    const bn = "Sei concert ta fata fati chhilo! — Ce concert était génial";
    const th = "เขาเจ้าชู้มาก — il drague beaucoup";
    expect(displayContext(bn)).toBe(bn);
    expect(displayContext(th)).toBe(th);
  });

  test("diacritiques et translittération intacts", () => {
    const ig = "Ọ ga-adị mma — ça ira bien";
    expect(displayContext(ig)).toBe(ig);
  });

  test("exemple entre guillemets avec expression étrangère reste intact", () => {
    const quoted = "[Politesse ritualisée] | Ex: 'Befarmaeed' (Allez-y, je vous en prie).";
    expect(displayContext(quoted)).toBe(quoted);
  });
});

describe("pedagogicalContext — repli discret, jamais de bloc creux", () => {
  test("contexte vide ou whitespace → null (aucun bloc trompeur)", () => {
    expect(displayContext("")).toBeNull();
    expect(displayContext("   ")).toBeNull();
    expect(displayContext(null)).toBeNull();
    expect(displayContext(undefined)).toBeNull();
  });

  test("jamais de statut faux ni d'exemple inventé : on MASQUE, on ne remplit pas", () => {
    // Un scaffolding ne produit ni « vérifié », ni un contenu de rechange :
    // le seul résultat possible est null (bloc masqué).
    const scaffold = "[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire] | [Ex: 'x']";
    expect(displayContext(scaffold)).toBeNull();
  });

  test("meaning === literal n'est PAS un signe d'invalidité (non testé ici)", () => {
    // Le module ne touche jamais meaning/literal : il porte sur le contexte.
    // Une fiche où meaning === literal reste entièrement affichable.
    const meaning = "prototype (paire)";
    expect(displayContext("Un contexte valide avec meaning égal au literal.")).toBe(
      "Un contexte valide avec meaning égal au literal.",
    );
    expect(meaning).toBe("prototype (paire)");
  });
});

describe("pedagogicalContext — aucune mutation des données sources", () => {
  test("displayContext est pur : l'objet/chaîne source n'est pas modifié", () => {
    const src = { context: "[Époque: x] | [Source: y] | [Ex: z]" };
    const before = JSON.stringify(src);
    displayContext(src.context);
    expect(JSON.stringify(src)).toBe(before);
  });

  test("la chaîne retournée est identique (pas de normalisation Unicode)", () => {
    const accented = "café naïve — déjà vu";
    expect(displayContext(accented)).toBe(accented);
  });
});
