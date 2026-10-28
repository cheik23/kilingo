/**
 * P0.2 — SÉCURITÉ DES MUTATIONS PUBLIQUES (convex-test, base en mémoire).
 *
 * Ce fichier EXÉCUTE les vraies fonctions Convex dans l'émulateur
 * (`convex-test`) : aucune base distante n'est contactée, aucun déploiement
 * n'est requis. Il prouve, mutation par mutation :
 *
 *  1. les opérations de semis/maintenance (`slang:seed`,
 *     `slang:recomputeAggregates`, `achievements:seed`) ont QUITTÉ le
 *     registre public — un client HTTP ne peut plus les appeler — et sont
 *     exécutables par la voie interne du CLI d'exploitation ;
 *  2. `aiConversation.ensureSeeds` et `customizationCatalog.seedCatalog`,
 *     qui doivent rester publiques (l'interface s'auto-amorce), exigent un
 *     compte et n'acceptent plus n'importe quelle langue ;
 *  3. l'amorçage administrateur n'est plus offert au premier inscrit ni à
 *     aucun compte depuis l'application : il passe par une fonction INTERNE
 *     (clé admin du déploiement), vise un compte explicitement désigné, et
 *     refuse un second administrateur — y compris au-delà des 200 premiers
 *     comptes ;
 *  4. le journal client reste utilisable SANS compte (événements anonymes
 *     voulus), mais borné : portée structurée, tailles plafonnées, débit
 *     limité, secrets masqués ;
 *  5. `mediaJobs.create` (P0.2.2) exige un compte, dérive la propriété de
 *     la SESSION (aucune propriété client ne désigne autrui), borne titre
 *     et adresse, refuse les cibles internes au réseau du backend, rend la
 *     création idempotente pour un audio déjà en cours et borne le nombre
 *     de transcriptions simultanées par compte ;
 *  6. la politique d'adresse audio (P0.2.3) refuse loopback, plages privées,
 *     link-local, métadonnées et noms à résolution automatique — sauf mode
 *     développement explicite —, suit les redirections À LA MAIN en
 *     revalidant chaque cible et échoue fermé si une cible n'est pas
 *     inspectable ; la relance d'un job est réservée par une garde
 *     transactionnelle (état + fraîcheur) qui préserve la reprise après
 *     échec.
 *
 * Note honnête sur la frontière public/interne : `convex-test` résout les
 * fonctions PAR NOM (`api` et `internal` y sont le même proxy,
 * `filterApi(fullApi)`). Il ne peut donc pas, à lui seul, démontrer qu'une
 * fonction n'est plus adressable par un client. Cette frontière est
 * appliquée par le déploiement Convex, et vérifiée ici par la DÉCLARATION
 * réelle des exports (`internalMutation`), tandis que les handlers, eux,
 * sont exécutés pour de vrai. La preuve finale reste le déploiement (P0.3).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  assertAudioSourceUrl,
  fetchAudioSource,
  LOCAL_SOURCES_ENV,
  MAX_AUDIO_REDIRECTS,
} from "../src/convex/mediaUrlPolicy";
import { ACHIEVEMENT_DEFINITIONS } from "../src/convex/achievementCatalog";
import { CUSTOMIZATION_DEFINITIONS } from "../src/convex/customizationCatalog";
import { CHARACTERS } from "../src/convex/aiCharacters";
import { SCENARIOS } from "../src/convex/aiScenarios";

const modules = {
  "_generated/api.ts": () => import("../src/convex/_generated/api"),
  "slang.ts": () => import("../src/convex/slang"),
  "achievements.ts": () => import("../src/convex/achievements"),
  "analytics.ts": () => import("../src/convex/analytics"),
  "customizationCatalog.ts": () => import("../src/convex/customizationCatalog"),
  "mediaJobs.ts": () => import("../src/convex/mediaJobs"),
  "mediaJobOps.ts": () => import("../src/convex/mediaJobOps"),
  "mediaUrlPolicy.ts": () => import("../src/convex/mediaUrlPolicy"),
  "aiConversation.ts": () => import("../src/convex/aiConversation"),
  "ovAdmin.ts": () => import("../src/convex/ovAdmin"),
};

function makeApp() {
  return convexTest(schema, modules);
}

type App = ReturnType<typeof makeApp>;

/** Message d'erreur d'un appel rejeté (null s'il passe : jamais confondu). */
async function captureError(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Compte de test — email/role/anonymat contrôlés par le scénario. */
async function seedUser(
  t: App,
  options: { email?: string; role?: "admin" | "user" | "member"; anonymous?: boolean } = {},
): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      name: "Compte de test P0.2",
      email: options.email,
      role: options.role,
      isAnonymous: options.anonymous,
    }),
  );
}

/** Rôle du compte en base — `null` quand aucun rôle n'a été écrit. */
async function roleOf(t: App, userId: Id<"users">): Promise<string | null> {
  return await t.run(async (ctx) => (await ctx.db.get(userId))?.role ?? null);
}

/**
 * Source d'un module Convex — l'émulateur `convex-test` résout les fonctions
 * PAR NOM (`api` et `internal` y sont le même proxy, `filterApi(fullApi)`),
 * il ne peut donc PAS démontrer tout seul la frontière public/interne. Cette
 * frontière est appliquée par le déploiement Convex (et par TypeScript via
 * `FilterApi`) ; le contrôle de non-régression porte donc ici sur la
 * déclaration réelle, tandis que le reste du fichier EXÉCUTE les handlers.
 */
function sourceOf(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

/** Nom du constructeur Convex utilisé pour déclarer une fonction exportée. */
function declarationOf(source: string, name: string): string | undefined {
  return new RegExp(`export const ${name} = (\\w+)\\(`).exec(source)?.[1];
}

/* ═══════════════════════════════════════════════════════════════════
   1 · SEMIS ET MAINTENANCE : PLUS D'ACCÈS PUBLIC
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2 — seed/agrégats retirés du registre public", () => {
  test("les écritures de semis/maintenance sont déclarées internes", () => {
    const slang = sourceOf("../src/convex/slang.ts");
    const achievements = sourceOf("../src/convex/achievements.ts");

    expect(declarationOf(slang, "seed")).toBe("internalMutation");
    expect(declarationOf(slang, "recomputeAggregates")).toBe("internalMutation");
    expect(declarationOf(achievements, "seed")).toBe("internalMutation");

    // Ce qui doit RESTER public le reste : les lectures du catalogue et la
    // boucle de jeu (aucune régression de produit au passage).
    expect(declarationOf(slang, "seedPlan")).toBe("query");
    expect(declarationOf(slang, "stats")).toBe("query");
    expect(declarationOf(achievements, "recordActivity")).toBe("mutation");
  });

  test("aucun seed public ne subsiste dans les modules sensibles", () => {
    const sensitive: Array<[string, string[]]> = [
      ["../src/convex/slang.ts", ["seed", "recomputeAggregates"]],
      ["../src/convex/achievements.ts", ["seed"]],
    ];
    for (const [file, names] of sensitive) {
      const source = sourceOf(file);
      for (const name of names) {
        expect(declarationOf(source, name)).not.toBe("mutation");
      }
    }
  });

  test("la voie d'exploitation reste ouverte : internal.slang.seed s'exécute", async () => {
    const t = makeApp();
    // Sans langue, le seed refuse de semer un demi-catalogue — le message
    // prouve que la fonction INTERNE est bien résolue et exécutée.
    const error = await captureError(t.mutation(internal.slang.seed, {}));
    expect(error).toMatch(/utilise le pilote|language/i);
    // Et ce refus n'a rien écrit.
    const rows = await t.run(async (ctx) => (await ctx.db.query("slangExpressions").collect()).length);
    expect(rows).toBe(0);
  });

  test("le seed interne garde son découpage par langue (contrat du pilote)", async () => {
    const t = makeApp();
    const error = await captureError(t.mutation(internal.slang.seed, {}));
    expect(error).toMatch(/language/i);
    // Le pilote appuie sur ce contrat : une langue par appel.
    const result = await t.mutation(internal.slang.seed, { language: "th" });
    expect(result.language).toBe("th");
    expect(result.inserted).toBeGreaterThan(0);
    expect(result.total).toBe(result.seeded);
  });

  test("le pilote de semis appelle bien les fonctions INTERNES", () => {
    const pilot = readFileSync(new URL("../scripts/seed-backend.mjs", import.meta.url), "utf8");
    expect(pilot).toContain('runFn("internal.slang.seed"');
    expect(pilot).toContain('runFn("internal.slang.recomputeAggregates"');
    // Aucun retour au chemin public : le CLI le refuserait ou, pire, un
    // client pourrait le refaire à la main.
    expect(pilot).not.toContain('runFn("slang:seed"');
    expect(pilot).not.toContain('runFn("slang:recomputeAggregates"');
    // La lecture du plan reste publique et sans écriture.
    expect(pilot).toContain('runFn("slang:seedPlan"');
  });

  test("internal.slang.recomputeAggregates reste exécutable (partition vide)", async () => {
    const t = makeApp();
    const result = await t.mutation(internal.slang.recomputeAggregates, { language: "th" });
    expect(result.language).toBe("th");
    expect(result.inLanguage).toBe(0);
    expect(result.catalogTotal).toBe(0);
  });

  test("internal.achievements.seed amorce le catalogue puis ne duplique rien", async () => {
    const t = makeApp();
    const first = await t.mutation(internal.achievements.seed, {});
    expect(first.total).toBe(ACHIEVEMENT_DEFINITIONS.length);
    expect(first.inserted).toBe(ACHIEVEMENT_DEFINITIONS.length);
    expect(first.updated).toBe(0);

    const again = await t.mutation(internal.achievements.seed, {});
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(ACHIEVEMENT_DEFINITIONS.length);

    const count = await t.run(async (ctx) => (await ctx.db.query("achievements").collect()).length);
    expect(count).toBe(ACHIEVEMENT_DEFINITIONS.length);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   2 · AUTO-AMORÇAGE PUBLIC, MAIS AUTHENTIFIÉ ET BORNÉ
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2 — aiConversation.ensureSeeds", () => {
  test("un appel anonyme est rejeté et n'écrit rien", async () => {
    const t = makeApp();
    const error = await captureError(t.mutation(api.aiConversation.ensureSeeds, { language: "yo" }));
    expect(error).toMatch(/Not signed in/i);
    const counts = await t.run(async (ctx) => ({
      characters: (await ctx.db.query("aiCharacters").collect()).length,
      scenarios: (await ctx.db.query("aiScenarios").collect()).length,
    }));
    expect(counts).toEqual({ characters: 0, scenarios: 0 });
  });

  test("une langue inventée est refusée (aucune amplification d'écriture)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    const error = await captureError(asUser.mutation(api.aiConversation.ensureSeeds, { language: "langue-inventee" }));
    expect(error).toMatch(/Langue non prise en charge/);
    const count = await t.run(async (ctx) => (await ctx.db.query("aiCharacters").collect()).length);
    expect(count).toBe(0);
  });

  test("un compte connecté sème sa langue, une seule fois (idempotence)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.aiConversation.ensureSeeds, { language: "yo" });
    const characters = await asUser.query(api.aiConversation.listCharacters, { language: "yo" });
    const scenarios = await asUser.query(api.aiConversation.listScenarios, { language: "yo" });
    expect(characters.length).toBe(CHARACTERS.length);
    expect(scenarios.length).toBe(SCENARIOS.length);

    await asUser.mutation(api.aiConversation.ensureSeeds, { language: "yo" });
    const counts = await t.run(async (ctx) => ({
      characters: (await ctx.db.query("aiCharacters").collect()).length,
      scenarios: (await ctx.db.query("aiScenarios").collect()).length,
    }));
    expect(counts).toEqual({ characters: CHARACTERS.length, scenarios: SCENARIOS.length });
  });

  test("startConversation applique le même périmètre de langues", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    const error = await captureError(
      asUser.mutation(api.aiConversation.startConversation, {
        characterId: "baba_street",
        scenarioId: "market_ng",
        language: "langue-inventee",
      }),
    );
    expect(error).toMatch(/Langue non prise en charge/);
    const count = await t.run(async (ctx) => (await ctx.db.query("aiCharacters").collect()).length);
    expect(count).toBe(0);
  });
});

describe("P0.2 — customizationCatalog.seedCatalog", () => {
  test("un appel anonyme est rejeté et n'écrit rien", async () => {
    const t = makeApp();
    const error = await captureError(t.mutation(api.customizationCatalog.seedCatalog, {}));
    expect(error).toMatch(/Not signed in/i);
    const count = await t.run(async (ctx) => (await ctx.db.query("customizationCatalog").collect()).length);
    expect(count).toBe(0);
  });

  test("un compte connecté amorce le catalogue, puis le rejeu n'écrit PLUS rien", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });

    const first = await asUser.mutation(api.customizationCatalog.seedCatalog, {});
    expect(first.total).toBe(CUSTOMIZATION_DEFINITIONS.length);
    expect(first.inserted).toBe(CUSTOMIZATION_DEFINITIONS.length);
    expect(first.skipped).toBe(0);

    // P0.2.1 — un appel répété sur un catalogue conforme ne rejoue plus 85
    // patches : il ne fait que LIRE et constate la conformité (`skipped`).
    const again = await asUser.mutation(api.customizationCatalog.seedCatalog, {});
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.skipped).toBe(CUSTOMIZATION_DEFINITIONS.length);

    const count = await t.run(async (ctx) => (await ctx.db.query("customizationCatalog").collect()).length);
    expect(count).toBe(CUSTOMIZATION_DEFINITIONS.length);
  });

  test("une dérive est RÉPARÉE (le seed reste réparateur, pas seulement idempotent)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.customizationCatalog.seedCatalog, {});

    // Un item corrompu en base (prix modifié) : le seed doit le corriger.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("customizationCatalog")
        .withIndex("by_item", (q) => q.eq("itemId", "avatar-lion"))
        .unique();
      await ctx.db.patch(row!._id, { priceGems: 999_999 });
    });

    const repaired = await asUser.mutation(api.customizationCatalog.seedCatalog, {});
    expect(repaired.updated).toBe(1);
    expect(repaired.skipped).toBe(CUSTOMIZATION_DEFINITIONS.length - 1);
    const price = await t.run(async (ctx) =>
      (
        await ctx.db
          .query("customizationCatalog")
          .withIndex("by_item", (q) => q.eq("itemId", "avatar-lion"))
          .unique()
      )!.priceGems,
    );
    expect(price).toBe(
      CUSTOMIZATION_DEFINITIONS.find((definition) => definition.itemId === "avatar-lion")!.priceGems,
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 · AMORÇAGE ADMINISTRATEUR — INTERNE, EXPLICITE, UNIQUE
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2 — amorçage administrateur (bootstrapAdmin)", () => {
  test("aucune voie publique d'auto-élévation ne subsiste", () => {
    const ovAdmin = sourceOf("../src/convex/ovAdmin.ts");
    // L'ancien `claimAdmin` public a disparu ; l'amorçage est interne.
    expect(declarationOf(ovAdmin, "claimAdmin")).toBeUndefined();
    expect(declarationOf(ovAdmin, "bootstrapAdmin")).toBe("internalMutation");
    // Le rôle ne s'écrit plus que par `setRole` (protégé par requireAdmin)
    // ou par l'amorçage interne.
    expect(declarationOf(ovAdmin, "setRole")).toBe("mutation");
  });

  test("l'amorçage exige un compte désigné explicitement", async () => {
    const t = makeApp();
    // Ni email ni userId : refusé.
    expect(await captureError(t.mutation(internal.ovAdmin.bootstrapAdmin, {}))).toMatch(
      /exactement un des deux/,
    );
    // Les deux à la fois : refusé (pas d'ambiguïté sur la cible).
    const userId = await seedUser(t, { email: "proprietaire@kilingo.test" });
    expect(
      await captureError(
        t.mutation(internal.ovAdmin.bootstrapAdmin, { email: "autre@kilingo.test", userId }),
      ),
    ).toMatch(/exactement un des deux/);

    // Email inconnu : refusé, aucune élévation.
    expect(
      await captureError(t.mutation(internal.ovAdmin.bootstrapAdmin, { email: "inconnu@kilingo.test" })),
    ).toMatch(/Compte introuvable/);
    expect(await roleOf(t, userId)).toBeNull();
  });

  test("le compte désigné devient administrateur, l'appel est idempotent", async () => {
    const t = makeApp();
    // Email stocké avec une casse différente : l'index est sensible à la
    // casse, le repli insensible doit l'atteindre sans ambiguïté.
    const owner = await seedUser(t, { email: "Proprietaire@Kilingo.test" });

    const first = await t.mutation(internal.ovAdmin.bootstrapAdmin, {
      email: "proprietaire@kilingo.test",
    });
    expect(first).toEqual({ ok: true, userId: owner });
    expect(await roleOf(t, owner)).toBe("admin");

    const again = await t.mutation(internal.ovAdmin.bootstrapAdmin, {
      email: "proprietaire@kilingo.test",
    });
    expect(again).toEqual({ ok: true, userId: owner });

    const access = await t.withIdentity({ subject: owner }).query(api.ovAdmin.amIAdmin, {});
    expect(access).toEqual({ admin: true });
  });

  test("un email ambigu (deux comptes à la casse près) ne devine pas : il refuse", async () => {
    const t = makeApp();
    const first = await seedUser(t, { email: "double@kilingo.test" });
    const second = await seedUser(t, { email: "Double@Kilingo.test" });
    const error = await captureError(
      t.mutation(internal.ovAdmin.bootstrapAdmin, { email: "DOUBLE@kilingo.test" }),
    );
    expect(error).toMatch(/ambiguïté/);
    expect(await roleOf(t, first)).toBeNull();
    expect(await roleOf(t, second)).toBeNull();

    // L'identifiant, lui, ne laisse aucune place au doute.
    const resolved = await t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: second });
    expect(resolved).toEqual({ ok: true, userId: second });
    expect(await roleOf(t, second)).toBe("admin");
  });

  test("un compte anonyme ne peut pas être promu", async () => {
    const t = makeApp();
    const ghost = await seedUser(t, { email: "fantome@kilingo.test", anonymous: true });
    const error = await captureError(
      t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: ghost }),
    );
    expect(error).toMatch(/anonyme/);
    expect(await roleOf(t, ghost)).toBeNull();
  });

  test("un administrateur en place bloque toute autre promotion par cette voie", async () => {
    const t = makeApp();
    const owner = await seedUser(t, { email: "proprietaire@kilingo.test" });
    const second = await seedUser(t, { email: "second@kilingo.test" });
    await t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: owner });

    const error = await captureError(
      t.mutation(internal.ovAdmin.bootstrapAdmin, { email: "second@kilingo.test" }),
    );
    expect(error).toMatch(/Un administrateur existe déjà/);
    expect(await roleOf(t, second)).toBeNull();
  });

  test("une promotion par `setRole` bloque l'amorçage, quelle que soit sa position", async () => {
    const t = makeApp();
    // Un administrateur nommé par l'application (pas par l'amorçage) doit
    // bloquer la voie d'amorçage : la lecture d'existence porte sur l'INDEX
    // du rôle (`by role`), pas sur une fenêtre de documents.
    const owner = await seedUser(t, { email: "proprietaire@kilingo.test" });
    await t.run(async (ctx) => {
      for (let index = 0; index < 200; index += 1) {
        await ctx.db.insert("users", { name: `Ancien compte ${index}` });
      }
    });
    await t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: owner });
    const claimer = await seedUser(t, { email: "nouveau@kilingo.test" });

    const error = await captureError(
      t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: claimer }),
    );
    expect(error).toMatch(/Un administrateur existe déjà/);
    expect(await roleOf(t, claimer)).toBeNull();
  });

  test("deux demandes SIMULTANÉES ne nomment qu'un seul administrateur", async () => {
    const t = makeApp();
    const first = await seedUser(t, { email: "un@kilingo.test" });
    const second = await seedUser(t, { email: "deux@kilingo.test" });

    // Ce que `convex-test` permet d'observer : les deux appels partent
    // ensemble. Le simulateur sérialise (ou rejoue) les mutations ; dans les
    // deux cas le résultat DOIT être « au plus un administrateur ».
    const outcomes = await Promise.all([
      captureError(t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: first })),
      captureError(t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: second })),
    ]);

    const admins = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("role", (q) => q.eq("role", "admin"))
        .collect(),
    );
    expect(admins).toHaveLength(1);
    expect(outcomes.filter((error) => error === null)).toHaveLength(1);
    expect(outcomes.filter((error) => error !== null)).toHaveLength(1);
    expect(outcomes.find((error) => error !== null)).toMatch(/Un administrateur existe déjà/);
  });

  test("un administrateur hors des 200 premiers comptes est DÉTECTÉ", async () => {
    const t = makeApp();
    // 200 comptes ordinaires d'abord, l'administrateur ensuite : l'ancien
    // contrôle (`query("users").take(200)`) ne le voyait pas et laissait le
    // compte suivant s'élever. Le contrôle indexé, lui, le voit.
    const admin = await t.run(async (ctx) => {
      for (let index = 0; index < 200; index += 1) {
        await ctx.db.insert("users", { name: `Compte ${index}` });
      }
      return ctx.db.insert("users", { name: "Administrateur historique", role: "admin" });
    });

    const claimer = await seedUser(t, { email: "proprietaire@kilingo.test" });
    const error = await captureError(
      t.mutation(internal.ovAdmin.bootstrapAdmin, { email: "proprietaire@kilingo.test" }),
    );
    expect(error).toMatch(/Un administrateur existe déjà/);
    expect(await roleOf(t, claimer)).toBeNull();
    expect(await roleOf(t, admin)).toBe("admin");
  });

  test("les opérations d'administration rejettent un client anonyme", async () => {
    const t = makeApp();
    const target = await seedUser(t, { email: "membre@kilingo.test" });
    for (const call of [
      captureError(t.mutation(api.ovAdmin.setRole, { userId: target, role: "admin" })),
      captureError(t.query(api.ovAdmin.dashboard, {})),
      captureError(t.query(api.ovAdmin.listContents, {})),
    ]) {
      expect(await call).toMatch(/Connexion requise/);
    }
    expect(await roleOf(t, target)).toBeNull();
  });

  test("l'administrateur amorcé garde les pouvoirs de son rôle, un membre aucun", async () => {
    const t = makeApp();
    const owner = await seedUser(t, { email: "proprietaire@kilingo.test" });
    const member = await seedUser(t, { email: "membre@kilingo.test" });
    await t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: owner });
    const asOwner = t.withIdentity({ subject: owner });
    const asMember = t.withIdentity({ subject: member });

    // `setRole` est protégé par requireAdmin : si l'amorçage n'avait pas
    // réellement posé le rôle, cet appel échouerait.
    const result = await asOwner.mutation(api.ovAdmin.setRole, { userId: member, role: "member" });
    expect(result).toEqual({ ok: true });
    expect(await roleOf(t, member)).toBe("member");

    const dashboard = await asOwner.query(api.ovAdmin.dashboard, {});
    expect(dashboard.totals.users).toBe(2);

    // Un compte ordinaire n'a aucun accès, y compris pour s'auto-promouvoir.
    expect(await captureError(asMember.query(api.ovAdmin.dashboard, {}))).toMatch(/Accès réservé/);
    expect(
      await captureError(asMember.mutation(api.ovAdmin.setRole, { userId: member, role: "admin" })),
    ).toMatch(/Accès réservé/);
    expect(await roleOf(t, member)).toBe("member");
  });

  test("la revue des droits reste exécutable par un administrateur, pas par un membre", async () => {
    const t = makeApp();
    const owner = await seedUser(t, { email: "proprietaire@kilingo.test" });
    await t.mutation(internal.ovAdmin.bootstrapAdmin, { userId: owner });
    const member = await seedUser(t, { email: "membre@kilingo.test" });

    await t.run(async (ctx) => {
      await ctx.db.insert("ovContents", {
        key: "wikimedia:demo",
        source: "wikimedia",
        externalId: "demo",
        kind: "music",
        title: "Contenu de test",
        externalUrl: "https://example.test/demo",
        rightsStatus: "UNKNOWN",
      });
    });

    const review = {
      contentKey: "wikimedia:demo",
      rightsStatus: "CC_ALLOWED" as const,
      commercialUseAllowed: true,
      fullStreamAllowed: true,
      downloadAllowed: false,
      hostingAllowed: true,
      translationAllowed: true,
      derivativeWorkAllowed: true,
      note: "Revue de test P0.2",
    };

    const refused = await captureError(
      t.withIdentity({ subject: member }).mutation(api.ovAdmin.reviewRights, review),
    );
    expect(refused).toMatch(/Accès réservé/);

    const accepted = await t.withIdentity({ subject: owner }).mutation(api.ovAdmin.reviewRights, review);
    expect(accepted).toEqual({ ok: true });
    const state = await t.run(async (ctx) => ({
      content: await ctx.db
        .query("ovContents")
        .withIndex("by_key", (q) => q.eq("key", "wikimedia:demo"))
        .unique(),
      ledger: (await ctx.db.query("ovRightsLedger").collect()).length,
    }));
    expect(state.content?.rightsStatus).toBe("CC_ALLOWED");
    expect(state.content?.rightsReviewedBy).toBe(owner);
    expect(state.ledger).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 bis · OBJECTIFS SUGGÉRÉS ET CACHE DE TRANSCRIPTION
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2.1 — analytics.seedSuggestedGoals", () => {
  test("un appel anonyme ne sème AUCUN objectif (aucune écriture)", async () => {
    const t = makeApp();
    const result = await t.mutation(api.analytics.seedSuggestedGoals, {});
    expect(result).toEqual({ seeded: 0 });
    const count = await t.run(async (ctx) => (await ctx.db.query("goals").collect()).length);
    expect(count).toBe(0);
  });

  test("un compte connecté reçoit ses 3 objectifs suggérés, une seule fois", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });

    expect(await asUser.mutation(api.analytics.seedSuggestedGoals, {})).toEqual({ seeded: 3 });
    const first = await t.run(async (ctx) => ctx.db.query("goals").collect());
    expect(first).toHaveLength(3);
    expect(first.every((goal) => goal.userId === userId && goal.origin === "suggested")).toBe(true);
    expect(first.some((goal) => goal.language === "total")).toBe(true);

    // Rejeu (le frontend rappelle au montage) : plus AUCUNE écriture.
    expect(await asUser.mutation(api.analytics.seedSuggestedGoals, {})).toEqual({ seeded: 0 });
    const second = await t.run(async (ctx) => ctx.db.query("goals").collect());
    expect(second).toHaveLength(3);
  });

  test("un objectif déjà présent n'est jamais écrasé (l'utilisateur reste maître)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    await t.run(async (ctx) =>
      ctx.db.insert("goals", {
        userId,
        language: "total",
        target: 42,
        origin: "custom",
        archived: false,
      }),
    );
    const asUser = t.withIdentity({ subject: userId });
    expect(await asUser.mutation(api.analytics.seedSuggestedGoals, {})).toEqual({ seeded: 0 });
    const goals = await t.run(async (ctx) => ctx.db.query("goals").collect());
    expect(goals).toHaveLength(1);
    expect(goals[0].target).toBe(42);
    expect(goals[0].origin).toBe("custom");
  });

  test("les objectifs semés ne concernent QUE leur propriétaire", async () => {
    const t = makeApp();
    const first = await seedUser(t, { email: "un@kilingo.test" });
    const second = await seedUser(t, { email: "deux@kilingo.test" });
    await t.withIdentity({ subject: first }).mutation(api.analytics.seedSuggestedGoals, {});
    const mine = await t.run(async (ctx) =>
      ctx.db
        .query("goals")
        .withIndex("by_user", (q) => q.eq("userId", second))
        .collect(),
    );
    expect(mine).toHaveLength(0);
  });
});

describe("P0.2.1 — mediaJobs.seedCache (charge client bornée)", () => {
  const chunk = (i: number, text = "bonjour") => ({ i, segments: [{ start: 0, end: 1, text }] });

  async function seedJob(t: App, userId: Id<"users">) {
    return await t.run(async (ctx) =>
      ctx.db.insert("mediaJobs", {
        userId,
        title: "Job de test P0.2.1",
        sourceUrl: "https://example.test/audio.mp3",
        status: "failed",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
  }

  async function cacheOf(t: App, id: Id<"mediaJobs">) {
    return await t.run(async (ctx) => (await ctx.db.get(id))?.chunkCache ?? []);
  }

  test("un appel anonyme est refusé, rien n'est écrit", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const job = await seedJob(t, userId);
    expect(
      await captureError(t.mutation(api.mediaJobs.seedCache, { id: job, entries: [chunk(0)] })),
    ).toMatch(/Connexion requise/);
    expect(await cacheOf(t, job)).toHaveLength(0);
  });

  test("le job d'un autre compte est refusé (aucune écriture croisée)", async () => {
    const t = makeApp();
    const owner = await seedUser(t, { email: "proprietaire@kilingo.test" });
    const intruder = await seedUser(t, { email: "intrus@kilingo.test" });
    const job = await seedJob(t, owner);
    expect(
      await captureError(
        t.withIdentity({ subject: intruder }).mutation(api.mediaJobs.seedCache, {
          id: job,
          entries: [chunk(0)],
        }),
      ),
    ).toMatch(/introuvable/);
    expect(await cacheOf(t, job)).toHaveLength(0);
  });

  test("le propriétaire injecte son cache, le rejeu n'écrit rien", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    const job = await seedJob(t, userId);

    expect(
      await asUser.mutation(api.mediaJobs.seedCache, { id: job, entries: [chunk(0), chunk(1)] }),
    ).toEqual({ stored: 2 });
    expect(await cacheOf(t, job)).toHaveLength(2);

    expect(
      await asUser.mutation(api.mediaJobs.seedCache, { id: job, entries: [chunk(0), chunk(1)] }),
    ).toEqual({ stored: 0 });
    expect(await cacheOf(t, job)).toHaveLength(2);
  });

  test("un index répété DANS la même charge n'est stocké qu'une fois", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const job = await seedJob(t, userId);
    expect(
      await t.withIdentity({ subject: userId }).mutation(api.mediaJobs.seedCache, {
        id: job,
        entries: [chunk(0, "premier"), chunk(0, "second"), chunk(1)],
      }),
    ).toEqual({ stored: 2 });
    const cache = await cacheOf(t, job);
    expect(cache.map((entry) => entry.i)).toEqual([0, 1]);
    expect(cache[0].segments[0].text).toBe("premier");
  });

  test("les charges hors bornes sont rejetées SANS écriture", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    const job = await seedJob(t, userId);

    const tooManyEntries = Array.from({ length: 201 }, (_, index) => chunk(index));
    const tooManySegments = [
      {
        i: 0,
        segments: Array.from({ length: 501 }, (_, index) => ({
          start: index,
          end: index + 1,
          text: "x",
        })),
      },
    ];
    const cases: Array<{ label: string; entries: unknown[] }> = [
      { label: "201 chunks", entries: tooManyEntries },
      { label: "501 segments", entries: tooManySegments },
      { label: "index négatif", entries: [{ i: -1, segments: [] }] },
      { label: "index non entier", entries: [{ i: 1.5, segments: [] }] },
      { label: "index hors plafond", entries: [{ i: 1_000, segments: [] }] },
      { label: "texte de 1001 caractères", entries: [chunk(0, "x".repeat(1_001))] },
      { label: "segment inversé", entries: [{ i: 0, segments: [{ start: 5, end: 1, text: "x" }] }] },
      { label: "start non fini", entries: [{ i: 0, segments: [{ start: Number.NaN, end: 1, text: "x" }] }] },
    ];
    for (const { label, entries } of cases) {
      const error = await captureError(
        asUser.mutation(api.mediaJobs.seedCache, { id: job, entries: entries as never }),
      );
      expect(`${label}: ${error}`).not.toContain("null");
      expect(error).not.toBeNull();
    }
    expect(await cacheOf(t, job)).toHaveLength(0);
  });

  test("un cache de job saturé ne peut pas être gonflé par le client", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const job = await seedJob(t, userId);
    // 600 chunks déjà stockés (plafond serveur) : le client ne peut plus rien
    // ajouter, et le refus est explicite.
    await t.run(async (ctx) =>
      ctx.db.patch(job, {
        chunkCache: Array.from({ length: 600 }, (_, index) => ({ i: index, segments: [] })),
      }),
    );
    expect(
      await captureError(
        t.withIdentity({ subject: userId }).mutation(api.mediaJobs.seedCache, {
          id: job,
          entries: [chunk(999)],
        }),
      ),
    ).toMatch(/saturé/);
    expect(await cacheOf(t, job)).toHaveLength(600);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 ter · CRÉATION D'UN JOB DE TRANSCRIPTION (P0.2.2)
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2.2 — mediaJobs.create", () => {
  const AUDIO = "https://cdn.example.test/episode-1.mp3";

  async function jobsOf(t: App, userId: Id<"users">) {
    return await t.run(async (ctx) =>
      ctx.db
        .query("mediaJobs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
  }

  async function setStatus(t: App, id: Id<"mediaJobs">, status: string) {
    await t.run(async (ctx) => ctx.db.patch(id, { status }));
  }

  test("un appel anonyme est refusé et rien n'est écrit", async () => {
    const t = makeApp();
    expect(
      await captureError(t.mutation(api.mediaJobs.create, { title: "Épisode", sourceUrl: AUDIO })),
    ).toMatch(/Connexion requise/);
    const count = await t.run(async (ctx) => (await ctx.db.query("mediaJobs").collect()).length);
    expect(count).toBe(0);
  });

  test("aucune propriété client ne peut désigner un AUTRE compte (validateur strict)", async () => {
    const t = makeApp();
    const caller = await seedUser(t, { email: "appelant@kilingo.test" });
    const victim = await seedUser(t, { email: "victime@kilingo.test" });
    // Un `userId` glissé dans les arguments est refusé par le validateur :
    // la propriété du job ne peut venir que de la session.
    const error = await captureError(
      t.withIdentity({ subject: caller }).mutation(api.mediaJobs.create, {
        title: "Épisode",
        sourceUrl: AUDIO,
        userId: victim,
      } as never),
    );
    expect(error).toMatch(/Unexpected field `userId`|userId/);
    expect(await jobsOf(t, victim)).toHaveLength(0);
    expect(await jobsOf(t, caller)).toHaveLength(0);
  });

  test("titre et adresse hors bornes sont refusés sans écriture", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    const cases: Array<{ label: string; args: { title: string; sourceUrl: string } }> = [
      { label: "titre vide", args: { title: "   ", sourceUrl: AUDIO } },
      { label: "titre de 201 signes", args: { title: "t".repeat(201), sourceUrl: AUDIO } },
      { label: "adresse vide", args: { title: "Épisode", sourceUrl: "  " } },
      {
        label: "adresse de 2049 signes",
        args: { title: "Épisode", sourceUrl: `https://cdn.example.test/${"a".repeat(2_030)}` },
      },
    ];
    for (const { label, args } of cases) {
      const error = await captureError(asUser.mutation(api.mediaJobs.create, args));
      expect(`${label} → ${error}`).not.toContain("null");
    }
    expect(await jobsOf(t, userId)).toHaveLength(0);
  });

  test("l'adresse audio est validée : jamais une cible interne au serveur", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    const refused = [
      "ftp://cdn.example.test/a.mp3",
      "file:///etc/passwd",
      "https://user:pw@cdn.example.test/a.mp3",
      "http://localhost:8000/a.mp3",
      "http://medias.localhost/a.mp3",
      "http://127.0.0.1:8000/a.mp3",
      "http://2130706433/a.mp3", // IPv4 décimal — normalisé par le parseur
      "http://[::1]:8000/a.mp3",
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://service.internal/a.mp3",
      "pas une url",
      "",
    ];
    for (const sourceUrl of refused) {
      const error = await captureError(
        asUser.mutation(api.mediaJobs.create, { title: "Épisode", sourceUrl }),
      );
      expect(`${sourceUrl} → ${error}`).not.toContain("null");
    }
    expect(await jobsOf(t, userId)).toHaveLength(0);
  });

  test("les sources publiques passent ; une adresse locale exige le mode dev explicite", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    delete process.env[LOCAL_SOURCES_ENV];

    // Hors mode dev (défaut), le local est refusé — y compris le nom Docker.
    for (const sourceUrl of [
      "http://192.168.1.20:8000/audio.mp3",
      "http://host.docker.internal:8000/audio.mp3",
      "http://127.0.0.1:8000/audio.mp3",
    ]) {
      const error = await captureError(
        asUser.mutation(api.mediaJobs.create, { title: "Épisode", sourceUrl }),
      );
      expect(`${sourceUrl} → ${error}`).not.toContain("null");
    }

    for (const sourceUrl of [
      "https://cdn.example.test/ep1.mp3",
      "https://feeds.example.test/podcast/audio.mp3?token=abc",
    ]) {
      const result = await asUser.mutation(api.mediaJobs.create, {
        title: "Épisode",
        sourceUrl,
      });
      expect(result.created).toBe(true);
    }

    // Mode dev EXPLICITE : les essais locaux redeviennent possibles.
    process.env[LOCAL_SOURCES_ENV] = "1";
    try {
      for (const sourceUrl of [
        "http://192.168.1.20:8000/audio.mp3",
        "http://host.docker.internal:8000/audio.mp3",
      ]) {
        const result = await asUser.mutation(api.mediaJobs.create, {
          title: "Épisode",
          sourceUrl,
        });
        expect(result.created).toBe(true);
      }
    } finally {
      delete process.env[LOCAL_SOURCES_ENV];
    }

    expect(await jobsOf(t, userId)).toHaveLength(4);
  });

  test("sous concurrence, le plafond n'est jamais franchi (simulateur)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    for (let index = 0; index < 4; index += 1) {
      await asUser.mutation(api.mediaJobs.create, {
        title: `Épisode ${index}`,
        sourceUrl: `https://cdn.example.test/c${index}.mp3`,
      });
    }

    const outcomes = await Promise.all([
      captureError(
        asUser.mutation(api.mediaJobs.create, {
          title: "A",
          sourceUrl: "https://cdn.example.test/a.mp3",
        }),
      ),
      captureError(
        asUser.mutation(api.mediaJobs.create, {
          title: "B",
          sourceUrl: "https://cdn.example.test/b.mp3",
        }),
      ),
    ]);

    expect(await jobsOf(t, userId)).toHaveLength(5);
    expect(outcomes.filter((error) => error === null)).toHaveLength(1);
  });

  test("la création est idempotente tant que le job tourne, un rejeu reste possible après la fin", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });

    const first = await asUser.mutation(api.mediaJobs.create, { title: "Épisode", sourceUrl: AUDIO });
    expect(first.created).toBe(true);

    // Rejeu de l'interface sur le même audio : MÊME job, aucune seconde
    // transcription payée.
    const replay = await asUser.mutation(api.mediaJobs.create, { title: "Épisode", sourceUrl: AUDIO });
    expect(replay.created).toBe(false);
    expect(replay.jobId).toBe(first.jobId);
    expect(await jobsOf(t, userId)).toHaveLength(1);

    // Un job TERMINÉ ne bloque plus : refaire une transcription reste possible.
    await setStatus(t, first.jobId, "completed");
    const redo = await asUser.mutation(api.mediaJobs.create, { title: "Épisode", sourceUrl: AUDIO });
    expect(redo.created).toBe(true);
    expect(redo.jobId).not.toBe(first.jobId);
    expect(await jobsOf(t, userId)).toHaveLength(2);
  });

  test("un plafond de transcriptions simultanées borne l'empilement de jobs", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids: Id<"mediaJobs">[] = [];
    for (let index = 0; index < 5; index += 1) {
      const result = await asUser.mutation(api.mediaJobs.create, {
        title: `Épisode ${index}`,
        sourceUrl: `https://cdn.example.test/ep${index}.mp3`,
      });
      expect(result.created).toBe(true);
      ids.push(result.jobId);
    }

    const refused = await captureError(
      asUser.mutation(api.mediaJobs.create, {
        title: "Épisode de trop",
        sourceUrl: "https://cdn.example.test/ep-trop.mp3",
      }),
    );
    expect(refused).toMatch(/Trop de transcriptions en cours/);
    expect(await jobsOf(t, userId)).toHaveLength(5);

    // Un job terminé libère la place ; un job en échec aussi (il ne tourne pas).
    await setStatus(t, ids[0], "failed");
    await setStatus(t, ids[1], "completed");
    const afterFinish = await asUser.mutation(api.mediaJobs.create, {
      title: "Après la fin",
      sourceUrl: "https://cdn.example.test/apres.mp3",
    });
    expect(afterFinish.created).toBe(true);
    expect(await jobsOf(t, userId)).toHaveLength(6);
  });

  test("le job créé reste privé : lecture, cache et suppression sont scellés par la session", async () => {
    const t = makeApp();
    const owner = await seedUser(t, { email: "proprietaire@kilingo.test" });
    const intruder = await seedUser(t, { email: "intrus@kilingo.test" });
    const asOwner = t.withIdentity({ subject: owner });
    const asIntruder = t.withIdentity({ subject: intruder });

    const { jobId } = await asOwner.mutation(api.mediaJobs.create, {
      title: "Épisode",
      sourceUrl: AUDIO,
    });

    expect(await asIntruder.query(api.mediaJobs.get, { id: jobId })).toBeNull();
    expect(await asIntruder.query(api.mediaJobs.listMine, {})).toHaveLength(0);
    await asIntruder.mutation(api.mediaJobs.remove, { id: jobId });
    expect(await asOwner.query(api.mediaJobs.get, { id: jobId })).not.toBeNull();
    expect(
      await captureError(
        asIntruder.mutation(api.mediaJobs.seedCache, {
          id: jobId,
          entries: [{ i: 0, segments: [{ start: 0, end: 1, text: "x" }] }],
        }),
      ),
    ).toMatch(/introuvable/);
    expect(await jobsOf(t, intruder)).toHaveLength(0);
  });

  test("l'adresse STOCKÉE est l'adresse normalisée réellement téléchargée", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });
    const { jobId } = await asUser.mutation(api.mediaJobs.create, {
      title: "Épisode",
      sourceUrl: "  HTTPS://CDN.Example.TEST/A.mp3  ",
    });
    const job = await asUser.query(api.mediaJobs.get, { id: jobId });
    // C'est CETTE chaîne que l'action passera à `fetchAudioSource` :
    // aucun écart entre la validation initiale et l'adresse contactée.
    expect(job?.sourceUrl).toBe("https://cdn.example.test/A.mp3");
  });

  test("le parcours légitime de création reste intact (lecture, cache, suppression)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: userId });

    const { jobId, created } = await asUser.mutation(api.mediaJobs.create, {
      title: "  Épisode long  ",
      sourceUrl: `  ${AUDIO}  `,
    });
    expect(created).toBe(true);

    const job = await asUser.query(api.mediaJobs.get, { id: jobId });
    expect(job?.status).toBe("pending");
    expect(job?.currentStep).toBe("media.stepQueued");
    expect(job?.title).toBe("Épisode long"); // espaces retirés
    expect(job?.sourceUrl).toBe(AUDIO);
    expect(job?.userId).toBe(userId);
    expect(await asUser.query(api.mediaJobs.listMine, {})).toHaveLength(1);

    expect(
      await asUser.mutation(api.mediaJobs.seedCache, {
        id: jobId,
        entries: [{ i: 0, segments: [{ start: 0, end: 3, text: "bonjour" }] }],
      }),
    ).toEqual({ stored: 1 });

    await asUser.mutation(api.mediaJobs.remove, { id: jobId });
    expect(await asUser.query(api.mediaJobs.get, { id: jobId })).toBeNull();
  });

  test("l'action de transcription relit le job par la query PROPRIÉTAIRE", () => {
    // Garde statique assumée : `transcribeLongAudio` télécharge et paie des
    // appels ASR, elle ne peut pas être simulée localement (réseau + moteur).
    // Ce contrôle vérifie qu'elle passe bien par la query scellée par la
    // session et qu'elle n'accepte aucun `userId` d'appelant.
    const source = sourceOf("../src/convex/mediaJobRun.ts");
    expect(source).toContain("ctx.runQuery(api.mediaJobs.get");
    expect(source).not.toMatch(/args:\s*\{[^}]*userId/);
    expect(declarationOf(source, "transcribeLongAudio")).toBe("action");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 quater · POLITIQUE D'ADRESSE AUDIO (P0.2.3)
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2.3 — mediaUrlPolicy", () => {
  function refusal(url: string): string | null {
    try {
      assertAudioSourceUrl(url);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  test("mode normal : loopback, privé, link-local, métadonnées et noms trompeurs sont refusés", () => {
    delete process.env[LOCAL_SOURCES_ENV];
    const refused = [
      "http://127.0.0.1:8000/a.mp3",
      "http://localhost/a.mp3",
      "http://localhost./a.mp3",
      "http://LOCALHOST/a.mp3",
      "http://0.0.0.0/a.mp3",
      "http://[::1]:8000/a.mp3",
      "http://[::ffff:127.0.0.1]/a.mp3",
      "http://[::ffff:7f00:1]/a.mp3",
      "http://2130706433/a.mp3",
      "http://10.0.0.5/a.mp3",
      "http://172.16.3.4/a.mp3",
      "http://192.168.1.20/a.mp3",
      "http://100.100.0.1/a.mp3",
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://instance-data/x",
      "http://service.internal/a.mp3",
      "http://host.docker.internal:8000/a.mp3",
      "http://127.0.0.1.nip.io/a.mp3",
      "http://10.0.0.5.sslip.io/a.mp3",
      "ftp://cdn.example.test/a.mp3",
      "file:///etc/passwd",
      "https://user:pw@cdn.example.test/a.mp3",
      "pas une url",
      "",
    ];
    for (const url of refused) {
      expect(`${url} => ${refusal(url)}`).not.toContain("=> null");
    }
  });

  test("mode normal : les sources publiques passent, normalisées", () => {
    delete process.env[LOCAL_SOURCES_ENV];
    for (const url of [
      "https://cdn.example.test/ep1.mp3",
      "http://radio.example.test:8000/live.m3u8",
      "https://feeds.example.test/a.mp3?token=abc#t=10",
    ]) {
      expect(`${url} => ${refusal(url)}`).toContain("=> null");
    }
    // L'URL rendue est celle qui sera réellement contactée : hôte en
    // minuscules, espaces retirés, aucune divergence validation/requête.
    expect(assertAudioSourceUrl("  HTTPS://CDN.Example.TEST/A.mp3  ")).toBe(
      "https://cdn.example.test/A.mp3",
    );
  });

  test("mode dev explicite : le local et le privé repassent, les métadonnées JAMAIS", () => {
    process.env[LOCAL_SOURCES_ENV] = "1";
    try {
      for (const url of [
        "http://127.0.0.1:8000/a.mp3",
        "http://localhost:8000/a.mp3",
        "http://10.0.0.5/a.mp3",
        "http://192.168.1.20:8000/a.mp3",
        "http://host.docker.internal:8000/a.mp3",
        "http://127.0.0.1.nip.io/a.mp3",
      ]) {
        expect(`${url} => ${refusal(url)}`).toContain("=> null");
      }
      for (const url of [
        "http://169.254.169.254/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://instance-data/x",
        "ftp://cdn.example.test/a.mp3",
        "https://user:pw@cdn.example.test/a.mp3",
      ]) {
        expect(`${url} => ${refusal(url)}`).not.toContain("=> null");
      }
    } finally {
      delete process.env[LOCAL_SOURCES_ENV];
    }
  });

  /* ── Redirections : `fetch` injecté, aucun réseau réel ─────────────── */

  type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

  function fakeFetch(script: Array<() => Response>): { calls: string[]; impl: FetchImpl } {
    const calls: string[] = [];
    let step = 0;
    const impl: FetchImpl = async (input) => {
      calls.push(input);
      const make = script[Math.min(step, script.length - 1)];
      step += 1;
      return make();
    };
    return { calls, impl };
  }

  const redirectTo = (location: string) => () =>
    new Response(null, { status: 302, headers: { location } });
  const audioOk = (url?: string) => () => {
    const response = new Response("audio", { status: 200 });
    if (url) Object.defineProperty(response, "url", { value: url });
    return response;
  };

  async function download(
    url: string,
    script: Array<() => Response>,
  ): Promise<{ error: string | null; calls: string[] }> {
    delete process.env[LOCAL_SOURCES_ENV];
    const { calls, impl } = fakeFetch(script);
    try {
      await fetchAudioSource(url, {}, { fetchImpl: impl });
      return { error: null, calls };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), calls };
    }
  }

  test("une redirection vers une adresse interne est refusée (échec fermé)", async () => {
    const { error, calls } = await download("https://cdn.example.test/a.mp3", [
      redirectTo("http://127.0.0.1/evil.mp3"),
    ]);
    expect(error).toMatch(/interne|refusée/);
    expect(calls).toHaveLength(1);
  });

  test("une redirection publique est suivie À LA MAIN et la cible finale est celle contactée", async () => {
    const { error, calls } = await download("https://cdn.example.test/a.mp3", [
      redirectTo("https://cdn2.example.test/b.mp3"),
      audioOk(),
    ]);
    expect(error).toBeNull();
    expect(calls).toEqual([
      "https://cdn.example.test/a.mp3",
      "https://cdn2.example.test/b.mp3",
    ]);
  });

  test("une redirection RELATIVE est résolue contre l'URL courante", async () => {
    const { error, calls } = await download("https://cdn.example.test/dir/a.mp3", [
      redirectTo("/autre/b.mp3"),
      audioOk(),
    ]);
    expect(error).toBeNull();
    expect(calls[1]).toBe("https://cdn.example.test/autre/b.mp3");
  });

  test("une cible NON inspectable est refusée au lieu d'être suivie", async () => {
    const sansLocation = await download("https://cdn.example.test/a.mp3", [
      () => new Response(null, { status: 302 }),
    ]);
    expect(sansLocation.error).toMatch(/non vérifiable/);

    const opaque = await download("https://cdn.example.test/a.mp3", [
      () => ({ status: 0, headers: new Headers(), body: null, url: "" }) as unknown as Response,
    ]);
    expect(opaque.error).toMatch(/opaque|non vérifiable/);
  });

  test("une redirection suivie AUTOMATIQUEMENT vers une adresse interne est refusée", async () => {
    const { error } = await download("https://cdn.example.test/a.mp3", [
      audioOk("http://10.0.0.5/audio.mp3"),
    ]);
    expect(error).toMatch(/privée|locale|interne/);
  });

  test("le nombre de sauts est borné", async () => {
    const { error, calls } = await download(
      "https://cdn.example.test/a.mp3",
      [redirectTo("https://cdn.example.test/suivant.mp3")],
    );
    expect(error).toMatch(/Trop de redirections/);
    expect(calls).toHaveLength(MAX_AUDIO_REDIRECTS + 1);
  });

  test("le téléchargement de l'appelant utilise bien la politique (garde statique)", () => {
    // Les actions de téléchargement ne sont pas simulables localement
    // (réseau + moteur ASR) : on vérifie que le point d'entrée réseau est
    // bien `fetchAudioSource`, jamais un `fetch(...)` brut sur l'URL client.
    const runner = sourceOf("../src/convex/mediaJobRun.ts");
    const hub = sourceOf("../src/convex/mediaHub.ts");
    const hub2 = sourceOf("../src/convex/mediaHub2.ts");
    const hub4 = sourceOf("../src/convex/mediaHub4.ts");
    const studio = sourceOf("../src/convex/ovStudioEngine.ts");
    // `transcribeLongAudio` passe par `fetchAudioSource`, qui revalide
    // lui-même l'adresse stockée (y compris les jobs créés avant P0.2.3).
    expect(runner).toContain("fetchAudioSource(");
    expect(runner).not.toMatch(/fetch\(job\.sourceUrl/);
    // Les actions qui reçoivent une adresse du client valident en plus
    // explicitement, et ne touchent plus une URL client avec le fetch brut.
    for (const source of [hub, hub2, hub4, studio]) {
      expect(source).toContain("assertAudioSourceUrl(");
      expect(source).toContain("fetchAudioSource(");
    }
    expect(hub).not.toMatch(/fetch\(args\.url/);
    expect(hub2).not.toMatch(/fetch\(args\.url/);
    expect(hub4).not.toMatch(/fetch\(args\.previewUrl/);
    expect(studio).not.toMatch(/fetch\(args\.audioUrl/);
    expect(studio).not.toMatch(/fetch\(args\.textUrl/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 quinquies · RELANCE D'UN JOB — GARDE TRANSACTIONNELLE (P0.2.3)
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2.3 — relance d'un job (requireIdle)", () => {
  async function seedJob(
    t: App,
    userId: Id<"users">,
    status: string,
    updatedAt: number,
  ): Promise<Id<"mediaJobs">> {
    return await t.run(async (ctx) =>
      ctx.db.insert("mediaJobs", {
        userId,
        title: "Job de relance",
        sourceUrl: "https://cdn.example.test/ep.mp3",
        status,
        createdAt: 1,
        updatedAt,
      }),
    );
  }

  test("un job en cours et frais ne peut pas être relancé (aucune écriture)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const jobId = await seedJob(t, userId, "transcribing", Date.now());

    const error = await captureError(
      t.mutation(internal.mediaJobOps.start, {
        jobId,
        step: "media.stepDownload",
        requireIdle: true,
      }),
    );
    expect(error).toMatch(/déjà en cours/);
    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("transcribing");
  });

  test("l'étape interne du run (traduction) passe sans garde", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const jobId = await seedJob(t, userId, "transcribing", Date.now());
    await t.mutation(internal.mediaJobOps.start, { jobId, step: "media.stepTranslate" });
    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.currentStep).toBe("media.stepTranslate");
  });

  test("un job échoué reste relançable (reprise légitime)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const jobId = await seedJob(t, userId, "failed", Date.now());
    await t.run(async (ctx) => ctx.db.patch(jobId, { error: "panne réseau" }));

    await t.mutation(internal.mediaJobOps.start, {
      jobId,
      step: "media.stepDownload",
      requireIdle: true,
    });
    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("chunking");
    expect(job?.error).toBeUndefined();
  });

  test("un job BLOQUÉ (aucune progression depuis plus de 3 min) est repris", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const jobId = await seedJob(t, userId, "transcribing", Date.now() - 200_000);
    await t.mutation(internal.mediaJobOps.start, {
      jobId,
      step: "media.stepDownload",
      requireIdle: true,
    });
    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("chunking");
  });

  test("deux relances SIMULTANÉES : une seule réserve le run", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    const jobId = await seedJob(t, userId, "failed", Date.now());
    const outcomes = await Promise.all([
      captureError(
        t.mutation(internal.mediaJobOps.start, {
          jobId,
          step: "media.stepDownload",
          requireIdle: true,
        }),
      ),
      captureError(
        t.mutation(internal.mediaJobOps.start, {
          jobId,
          step: "media.stepDownload",
          requireIdle: true,
        }),
      ),
    ]);
    expect(outcomes.filter((error) => error === null)).toHaveLength(1);
    expect(outcomes.find((error) => error !== null)).toMatch(/déjà en cours/);
  });

  test("l'action de transcription réserve le run avant tout téléchargement", () => {
    const source = sourceOf("../src/convex/mediaJobRun.ts");
    const claimIndex = source.indexOf("requireIdle: true");
    const downloadIndex = source.indexOf("const head = await fetchAudioSource(");
    expect(claimIndex).toBeGreaterThan(0);
    expect(downloadIndex).toBeGreaterThan(claimIndex);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   4 · JOURNAL CLIENT — ANONYME MAIS BORNÉ
   ═══════════════════════════════════════════════════════════════════ */

describe("P0.2 — logClientEvent", () => {
  test("un événement ANONYME reste accepté (parcours avant connexion)", async () => {
    const t = makeApp();
    await t.mutation(api.ovAdmin.logClientEvent, {
      level: "warn",
      scope: "player.error",
      message: "lecteur bloqué avant connexion",
    });
    const row = await t.run(async (ctx) => (await ctx.db.query("ovLogs").collect())[0]);
    expect(row.scope).toBe("player.error");
    expect(row.userId).toBeUndefined();
  });

  test("un compte connecté est tracé (userId enregistré)", async () => {
    const t = makeApp();
    const userId = await seedUser(t);
    await t.withIdentity({ subject: userId }).mutation(api.ovAdmin.logClientEvent, {
      level: "error",
      scope: "player.error",
      message: "échec de lecture",
    });
    const row = await t.run(async (ctx) => (await ctx.db.query("ovLogs").collect())[0]);
    expect(row.userId).toBe(userId);
  });

  test("les entrées invalides sont refusées, sans écriture", async () => {
    const t = makeApp();
    const cases: Array<Record<string, unknown>> = [
      { level: "info", scope: "portée avec espaces", message: "x" },
      { level: "info", scope: "x".repeat(41), message: "x" },
      { level: "info", scope: "player.error", message: "   " },
      { level: "info", scope: "player.error", message: "x".repeat(501) },
      { level: "info", scope: "player.error", message: "ok", meta: "m".repeat(1001) },
    ];
    for (const args of cases) {
      const error = await captureError(t.mutation(api.ovAdmin.logClientEvent, args as never));
      expect(error).not.toBeNull();
    }
    const count = await t.run(async (ctx) => (await ctx.db.query("ovLogs").collect()).length);
    expect(count).toBe(0);
  });

  test("les secrets sont masqués avant écriture (jeton Bearer, JWT)", async () => {
    const t = makeApp();
    await t.mutation(api.ovAdmin.logClientEvent, {
      level: "info",
      scope: "studio.upload",
      message: "upload refusé — clé Bearer sk_live_abcdef0123456789 utilisée",
      meta: "jeton=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    });
    const row = await t.run(async (ctx) => (await ctx.db.query("ovLogs").collect())[0]);
    expect(row.message).toContain("[secret masqué]");
    expect(row.message).not.toContain("sk_live_abcdef0123456789");
    expect(row.meta).toContain("[secret masqué]");
    expect(row.meta).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  test("le débit est plafonné par portée (fenêtre glissante)", async () => {
    const t = makeApp();
    const base = { level: "info" as const, scope: "rights.alert", message: "événement" };
    let accepted = 0;
    let refused: string | null = null;
    for (let index = 0; index < 70; index += 1) {
      const error = await captureError(t.mutation(api.ovAdmin.logClientEvent, base));
      if (error) {
        refused = error;
        break;
      }
      accepted += 1;
    }
    expect(refused).toMatch(/Trop d'événements/);
    expect(accepted).toBe(60);
    const count = await t.run(async (ctx) => (await ctx.db.query("ovLogs").collect()).length);
    expect(count).toBe(60);

    // Une AUTRE portée n'est pas pénalisée par la saturation de celle-ci.
    await t.mutation(api.ovAdmin.logClientEvent, {
      level: "info",
      scope: "studio.upload",
      message: "autre portée",
    });
  });

  test("la ROTATION de portées ne contourne pas le plafond global", async () => {
    const t = makeApp();
    // Le client choisit la portée : il pouvait jusqu'ici inventer une portée
    // neuve à chaque appel et échapper indéfiniment au plafond par portée.
    // Le plafond GLOBAL ne dépend d'aucune valeur fournie par l'appelant.
    let accepted = 0;
    let refusal: string | null = null;
    for (let index = 0; index < 320; index += 1) {
      const error = await captureError(
        t.mutation(api.ovAdmin.logClientEvent, {
          level: "info",
          scope: `rotation.${index}`,
          message: "événement",
        }),
      );
      if (error) {
        refusal = error;
        break;
      }
      accepted += 1;
    }
    expect(refusal).toMatch(/plafond global/);
    expect(accepted).toBe(300);
    const count = await t.run(async (ctx) => (await ctx.db.query("ovLogs").collect()).length);
    expect(count).toBe(300);
  });
});
