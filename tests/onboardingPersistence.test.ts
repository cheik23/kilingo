import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft,
} from "../src/lib/onboardingPersistence";

/* ═══════════════════════════════════════════════════════════════════════
   ONBOARDING — PERSISTANCE DU BROUILLON (déterministe)

   Défaut diagnostiqué en recette (HEAD 9eed807) : la sélection du focus
   (étape 1) et les intérêts (étape 2) ne vivaient que dans le state React ;
   un rechargement avant « Lancer mon premier jour » reprenait à l'étape 1
   avec Continuer regrisé. Le correctif persiste le BROUILLON
   d'INTERFACE en sessionStorage — l'écriture backend (setFocus, plafond
   Premium côté serveur) reste unique, à la finalisation.

   Ces tests verrouillent la couche pure : round-trip fidèle, rejet des
   brouillons corrompus ou mal typés (jamais d'état trompeur), comportement
   sans storage (navigation privée), nettoyage à la finalisation, et audit
   statique du composant : le brouillon ne contourne ni Convex ni les
   limites Premium.
   ═══════════════════════════════════════════════════════════════════════ */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Stub minimal de sessionStorage pour exercer la couche réellement. */
type MemStorage = {
  store: Map<string, string>;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

function installStorage(): MemStorage {
  const store = new Map<string, string>();
  const stub: MemStorage = {
    store,
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
  (globalThis as Record<string, unknown>).sessionStorage = stub;
  return stub;
}

describe("round-trip fidèle : ce qui est sauvegardé est rechargé ÉGALEMENT", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).sessionStorage;
  });

  test("langues, intérêts et étape survivent à un cycle save → load", () => {
    installStorage();
    const draft: OnboardingDraft = {
      selected: ["en", "es"],
      interests: ["Séries & films", "Hip-hop & rap"],
      step: 1,
    };
    saveOnboardingDraft(draft);
    expect(loadOnboardingDraft()).toEqual(draft);
  });

  test("rechargement à l'étape 1 : la sélection invoquée au Continuer est restaurée", () => {
    installStorage();
    // Scénario de recette : l'utilisateur choisit Anglais puis appuie
    // Continuer ; il recharge avant l'étape 2. Le brouillon doit
    // redonner la sélection, et le composant repasser Continuer à l'état
    // actif (non regrisé).
    saveOnboardingDraft({ selected: ["en"], interests: [], step: 0 });
    expect(loadOnboardingDraft()).toEqual({
      selected: ["en"],
      interests: [],
      step: 0,
    });
  });
});

describe("robustesse : aucune valeur trompeuse n'est réhydratée", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).sessionStorage;
  });

  test("JSON corrompu → null (jamais d'objet à moitié chargé)", () => {
    installStorage();
    sessionStorage.setItem(
      "kilingo.onboarding.draft",
      "{selected: [peut importe",
    );
    expect(loadOnboardingDraft()).toBeNull();
  });

  test("aîné types invalides → null (step hors grille, selected non-string)", () => {
    installStorage();
    sessionStorage.setItem(
      "kilingo.onboarding.draft",
      JSON.stringify({ selected: [42], interests: [], step: 0 }),
    );
    expect(loadOnboardingDraft()).toBeNull();
    sessionStorage.setItem(
      "kilingo.onboarding.draft",
      JSON.stringify({ selected: ["en"], interests: [], step: 5 }),
    );
    expect(loadOnboardingDraft()).toBeNull();
    sessionStorage.setItem(
      "kilingo.onboarding.draft",
      JSON.stringify({ selected: ["en"], interests: [], step: "1" }),
    );
    expect(loadOnboardingDraft()).toBeNull();
  });

  test("plus de 2 langues (contour du plafond) → null", () => {
    installStorage();
    sessionStorage.setItem(
      "kilingo.onboarding.draft",
      JSON.stringify({ selected: ["en", "es", "ar"], interests: [], step: 0 }),
    );
    expect(loadOnboardingDraft()).toBeNull();
  });

  test("doublons dans selected → null", () => {
    installStorage();
    sessionStorage.setItem(
      "kilingo.onboarding.draft",
      JSON.stringify({ selected: ["en", "en"], interests: [], step: 0 }),
    );
    expect(loadOnboardingDraft()).toBeNull();
  });

  test("sans sessionStorage (navigation privée stricte) : load null, save silencieux, aucune exception", () => {
    delete (globalThis as Record<string, unknown>).sessionStorage;
    expect(loadOnboardingDraft()).toBeNull();
    expect(() =>
      saveOnboardingDraft({ selected: ["en"], interests: [], step: 0 }),
    ).not.toThrow();
    expect(clearOnboardingDraft()).toBeUndefined();
  });
});

describe("cycle de vie : le brouillon expire quand le profil serveur fait foi", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).sessionStorage;
  });

  test("save puis clear → load null (après finish réussi)", () => {
    installStorage();
    saveOnboardingDraft({ selected: ["en"], interests: ["Food"], step: 1 });
    expect(loadOnboardingDraft()).not.toBeNull();
    clearOnboardingDraft();
    expect(loadOnboardingDraft()).toBeNull();
  });

  test("clear sans storage ni brouillon : aucun pas", () => {
    installStorage();
    expect(() => clearOnboardingDraft()).not.toThrow();
  });
});

/* ════ AUDIT STATIQUE : le brouillon ne contourne ni le contrat ni les limites ════ */

describe("le brouillon n'écrit JAMAIS au backend — le contrat reste setFocus à la finalisation", () => {
  test("le module de persistance n'importe rien de Convex ni de l'app", () => {
    const lib = read("src/lib/onboardingPersistence.ts");
    expect(lib).not.toMatch(/from ["'].*convex/);
    expect(lib).not.toMatch(/useMutation|api\./);
  });

  test("Onboarding appelle encore setFocus (contrat réel inchangé) et PAS plus tôt que dans finish()", () => {
    const src = read("src/components/learner/Onboarding.tsx");
    expect(src).toMatch(/api\.learning\.setFocus/);
    expect(src).not.toMatch(/setFocus\((?!\{ languages: selected \}).*\)/);
  });

  test("le brouillon est bien purgé après setFocus réussi (pas d'état fictif)", () => {
    const src = read("src/components/learner/Onboarding.tsx");
    const finishIdx = src.indexOf("await setFocus");
    const clearIdx = src.indexOf("clearOnboardingDraft()");
    expect(finishIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(finishIdx);
  });

  test("l'init lazy du composant lit UNIQUEMENT le brouillon (le serveur reste la vérité du profil)", () => {
    const src = read("src/components/learner/Onboarding.tsx");
    // L'état initialDépart : useMutation(api.learning.setFocus) est déclaré
    // avant l'état local ; loadOnboardingDraft n'apparaît qu'aux init
    // pures (useState/useMemo), jamais dans une écriture backend.
    expect(src).toMatch(/const draft = useMemo\(\(\) => loadOnboardingDraft\(\), \[\]\)/);
    expect(src).toMatch(/const \[step, setStep\] = useState\(draft\?\.step \?\? 0\)/);
    expect(src).toMatch(/const \[selected, setSelected\] = useState<LanguageCode\[\]>\(/);
    expect(src).toMatch(/const \[interests, setInterests\] = useState<string\[\]>\(draft\?\.interests \?\? \[\]\)/);
  });
});
