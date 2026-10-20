import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ═══════════════════════════════════════════════════════════════════════
   FAVORIS — AUDIT DU PARCOURS (statique)

   Ces tests lisent le VRAI code de prod (convex + composants) : ils ne
   remplacent pas un test de bout en bout sur un déploiement Convex de
   test (les scénarios 1–10 sont rejoués manuellement dans le navigateur
   contre le backend réel). Ils verrouillent les invariants que l'audit a
   fixés : authentification systématique, déduplication par requête
   indexée, cœur jamais relié au SRS, favoris présents dans Ma mémoire,
   permissions par utilisateur.
   ═══════════════════════════════════════════════════════════════════════ */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const favFile = () => read("src/convex/favorites.ts");
const discover = () => read("src/components/learner/DiscoverView.tsx");
const memory = () => read("src/components/learner/MemoryView.tsx");
const schema = () => read("src/convex/schema.ts");

describe("schéma des favoris", () => {
  test("table dédiée slangFavorites : userId + slangId stables, pas de texte", () => {
    const s = schema();
    expect(s).toContain("slangFavorites: defineTable({");
    // La liaison est par identifiant d'expression, jamais par texte affiché.
    expect(s).toMatch(/slangId: v\.id\("slangExpressions"\)/);
    expect(s).toMatch(/userId: v\.id\("users"\)/);
  });

  test("index unique par (userId, slangId) pour la déduplication", () => {
    expect(schema()).toMatch(
      /\.index\("by_user_slang", \["userId", "slangId"\]\)/,
    );
  });

  test("pas de deuxième table de favoris slang (une seule structure)", () => {
    const s = schema();
    expect(s.match(/slangFavorites: defineTable/g) ?? []).toHaveLength(1);
  });
});

describe("serveur favorites.ts — permissions et déduplication", () => {
  test("chaque query/mutation vérifie getAuthUserId AVANT de toucher la table", () => {
    const f = favFile();
    // 3 fonctions exportées : favoriteSlangIds, toggleSlangFavorite,
    // mySlangFavorites — chacune doit porter la garde d'auth.
    for (const name of [
      "favoriteSlangIds",
      "toggleSlangFavorite",
      "mySlangFavorites",
    ]) {
      const block = f.slice(f.indexOf(`export const ${name}`));
      expect(block.indexOf("getAuthUserId")).toBeGreaterThan(-1);
      const guard = block.indexOf(
        "userId === null",
        block.indexOf("getAuthUserId"),
      );
      expect(guard).toBeGreaterThan(-1);
    }
  });

  test("toggle deduplique par requête indexée (userId + slangId)", () => {
    const f = favFile();
    expect(f).toMatch(/by_user_slang/);
    expect(f).toMatch(
      /existing\.length > 0[\s\S]*?await ctx\.db\.delete\(row\._id\)/,
    );
  });

  test("les requêtes filtrent par l'utilisateur authentifié et lui seul", () => {
    const f = favFile();
    // Aucun accès sans index utilisateur : les deux queries passent par by_user.
    expect((f.match(/withIndex\("by_user"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(f).not.toMatch(/ctx\.db\.query\("slangFavorites"\)\s*\n?\s*\.collect\(\)/);
  });

  test("toggle refuse un utilisateur non connecté (jamais de simulation)", () => {
    expect(favFile()).toMatch(/if \(userId === null\) throw new Error\("Not signed in"\)/);
  });
});

describe("cœur dans Découverte — action indépendante", () => {
  test("le cœur/swipe droite appelle toggleSlangFavorite", () => {
    expect(discover()).toMatch(/toggleFavorite\(\{ slangId/);
  });

  test("le cœur NE programme PAS de révision (pas de addToSrs dans le chemin cœur)", () => {
    const d = discover();
    // addToSrs n'est appelé que dans learnCurrent (le cerveau), jamais
    // dans commitSwipe (le chemin du cœur).
    const commit = d.slice(
      d.indexOf("const commitSwipe"),
      d.indexOf("const learnCurrent"),
    );
    expect(commit.indexOf("addToSrs")).toBe(-1);
  });

  test("le cœur ne navigue pas (aucune navigation dans le composant)", () => {
    const d = discover();
    expect(d).not.toMatch(/useNavigate/);
    expect(d).not.toMatch(/navigate\(/);
  });

  test("l'état du cœur vient du serveur (favoriteSlangIds), pas du local", () => {
    expect(discover()).toMatch(/api\.favorites\.favoriteSlangIds/);
  });
});

describe("Ma mémoire — le favori reste retrouvable", () => {
  test("la vue fusionne les favoris purs (mySlangFavorites) avec le deck", () => {
    const m = memory();
    expect(m).toMatch(/api\.favorites\.mySlangFavorites/);
  });

  test("pas de doublon favori/deck (le même slang n'apparaît qu'une fois)", () => {
    const m = memory();
    expect(m).toMatch(/srsIds\.has\(f\.slang\._id\)/);
  });

  test("un favori pur n'est jamais compté comme « à revoir » (nextReview max)", () => {
    const m = memory();
    expect(m).toMatch(/nextReview: Number\.MAX_SAFE_INTEGER/);
  });
});
