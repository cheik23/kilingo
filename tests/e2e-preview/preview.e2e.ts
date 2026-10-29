/* Scénario E2E réel de la Preview hébergée.

   Sans bypass Vercel, la suite est ignorée AVANT toute navigation protégée :
   aucun faux succès. Voir docs/recette-preview-e2e.md. */

import type { Page } from "@playwright/test";

import {
  expect,
  expectCleanNetwork,
  expectNoBrowserErrors,
  test,
} from "./fixtures";
import { listMailIds, mailToken, waitForOtp } from "./mail";
import {
  BYPASS_SECRET,
  PREVIEW_CONVEX_ORIGIN,
  TEST_EMAIL,
  maskedEmail,
} from "./target";

test.describe.configure({ mode: "serial" });

test.skip(
  !BYPASS_SECRET,
  "Bypass Vercel absent : définir VERCEL_AUTOMATION_BYPASS_SECRET (voir docs/recette-preview-e2e.md)",
);
test.skip(!TEST_EMAIL, "PREVIEW_TEST_EMAIL absent : compte de test non configuré");

type ConvexResult<T> = T;

async function backend<T>(
  page: Page,
  kind: "query" | "mutation",
  path: string,
  args: Record<string, unknown> = {},
): Promise<ConvexResult<T>> {
  return (await page.evaluate(
    async ({ requestKind, requestPath, requestArgs, convexOrigin }) => {
      const key = Object.keys(localStorage).find((name) =>
        name.startsWith("__convexAuthJWT"),
      );
      const token = key ? localStorage.getItem(key) : null;
      if (!token) throw new Error("session absente");
      const response = await fetch(`${convexOrigin}/api/${requestKind}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: requestPath,
          args: requestArgs,
          format: "json",
        }),
      });
      const json = (await response.json()) as {
        status: string;
        value?: unknown;
        errorMessage?: string;
      };
      if (json.status !== "success") {
        throw new Error(json.errorMessage ?? "erreur Convex");
      }
      return json.value;
    },
    {
      requestKind: kind,
      requestPath: path,
      requestArgs: args,
      convexOrigin: PREVIEW_CONVEX_ORIGIN,
    },
  )) as T;
}

function assertNotSso(page: Page): void {
  if (/vercel\.com\/sso/.test(page.url())) {
    throw new Error(
      "Vercel SSO : la Preview a redirigé vers l'authentification Vercel — bypass absent ou refusé",
    );
  }
}

/**
 * Le pseudo est demandé après le chargement du profil, pas forcément avant
 * la première navigation : on laisse à la requête le temps d'aboutir au lieu
 * de conclure trop tôt (constaté au run P0.3.12).
 */
async function completeNicknameIfAsked(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", {
    name: /Comment tu veux qu'on te nomme/i,
  });
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  await dialog
    .getByRole("textbox")
    .fill(`E2E${Date.now().toString(36).slice(-4)}`);
  await page.getByRole("button", { name: /Valider mon pseudo/i }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

async function signInThroughUi(page: Page): Promise<void> {
  const mail = await mailToken();
  const seen = await listMailIds(mail);
  const since = Date.now();

  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  assertNotSso(page);
  await expect(
    page.getByRole("heading", { name: /Entre dans le mouvement/i }),
  ).toBeVisible();

  await page.getByPlaceholder("name@example.com").fill(TEST_EMAIL);
  await page.getByRole("button", { name: /Recevoir mon code/i }).click();
  await expect(
    page.getByRole("heading", { name: /Vérifie ta boîte mail/i }),
  ).toBeVisible();

  const code = await waitForOtp(mail, seen, since);
  await page.getByRole("textbox").first().fill(code);
  await page.getByRole("button", { name: /Vérifier le code/i }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 45_000 });
  assertNotSso(page);

  // Un compte neuf passe par l'onboarding « Choisis ton focus ». On attend
  // d'abord que l'état ait fini de charger : sans cette attente, la
  // vérification pouvait tomber trop tôt et laisser l'onboarding ouvert
  // (constaté au premier run réel P0.3.12).
  const focusHeading = page.getByRole("heading", { name: /Choisis ton focus/i });
  const discoveryLink = page.getByRole("link", { name: /Découverte/i }).first();
  await expect(focusHeading.or(discoveryLink)).toBeVisible({ timeout: 30_000 });

  if (await focusHeading.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /^Anglais/ }).first().click();
    await page.getByRole("button", { name: /^Continuer$/ }).click();
    await expect(
      page.getByRole("heading", { name: /Ton lifestyle/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Lancer mon premier jour/i }).click();
  }
  await completeNicknameIfAsked(page);
  await expect(discoveryLink).toBeVisible();
}

test("Preview : connexion, découverte, favoris, SRS et Shadow", async ({
  page,
  net,
}) => {
  test.setTimeout(180_000);
  const addedByTest: string[] = [];

  await test.step("protection et rendu de la page", async () => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    assertNotSso(page);
    expect(response?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /Les langues du monde/i }).first(),
    ).toBeVisible();
    const rootLength = await page.locator("#root").evaluate((node) => node.innerHTML.length);
    expect(rootLength, "React n'a pas hydraté la page").toBeGreaterThan(100);
    expect(net.convexHosts.size, "aucune requête Convex observée au chargement").toBeGreaterThan(0);
  });

  await test.step(`connexion OTP (${maskedEmail(TEST_EMAIL)})`, async () => {
    await signInThroughUi(page);
  });

  await test.step("découverte, favori visible puis retiré", async () => {
    await page.goto("/app/discover", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Mode découverte/i }),
    ).toBeVisible();
    const addFavorite = page.getByRole("button", {
      name: "Ajouter aux favoris",
    }).first();
    await expect(addFavorite).toBeVisible();
    await addFavorite.click();
    await expect(page.getByText(/ajouté à tes favoris/i).first()).toBeVisible();

    await page.goto("/app/memory", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("❤ FAVORI").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Retirer des favoris" })
      .first()
      .click();
    // Le favori pur disparaît de Ma mémoire une fois retiré (il n'y figurait
    // que comme favori) : on vérifie le toast puis l'absence du badge.
    await expect(page.getByText(/retiré de tes favoris/i).first()).toBeVisible();
    await expect(page.getByText("❤ FAVORI")).toHaveCount(0);
  });

  await test.step("SRS : carte créée, révisée, XP non doublé, nettoyée", async () => {
    await page.goto("/app/discover", { waitUntil: "domcontentloaded" });
    // Compte de test dédié : on repart d'un deck vide pour que « carte créée
    // puis nettoyée » reste mesurable, même après un run interrompu.
    const deckBefore = await backend<Array<{ slang: { _id: string } }>>(
      page,
      "query",
      "learning:myDeck",
    );
    for (const row of deckBefore) {
      await backend(page, "mutation", "learning:removeFromSrs", {
        slangId: row.slang._id,
      });
    }
    const beforeIds = new Set<string>();

    await page.getByRole("button", { name: "Apprendre", exact: true }).first().click();
    // La mutation est lancée en arrière-plan : naviguer tout de suite peut
    // l'interrompre. On attend qu'elle soit réellement persistée.
    await expect
      .poll(
        async () => {
          const deck = await backend<Array<unknown>>(page, "query", "learning:myDeck");
          return deck.length;
        },
        { timeout: 20_000 },
      )
      .toBe(1);
    await page.goto("/app/memory", { waitUntil: "domcontentloaded" });
    // Le badge est rendu en minuscules dans le DOM (majuscules via CSS).
    await expect(page.getByText(/en cours/i).first()).toBeVisible();

    await page.getByRole("button", { name: /Réviser maintenant/ }).click();
    await expect(
      page.getByRole("heading", { name: /Session de révision/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Révéler$/ }).click();
    await page.getByRole("button", { name: /^Acquis/ }).click();
    await expect(
      page.getByText(/Prochaine revue|Session enregistrée/).first(),
    ).toBeVisible();

    const readXp = async () =>
      (await backend<{ totalXp: number }>(page, "query", "learning:myStats"))
        .totalXp;

    // La révision vient d'accorder de l'XP en arrière-plan : on attend que le
    // total se stabilise avant de mesurer l'idempotence de NOTRE session.
    let stableXp = await readXp();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.waitForTimeout(500);
      const next = await readXp();
      if (next === stableXp) break;
      stableXp = next;
    }

    const sessionKey = `e2e-ui-${Date.now().toString(36)}`;
    const sessionArgs = {
      language: "en",
      kind: "e2e",
      durationSeconds: 10,
      itemsLearned: 0,
      sessionKey,
    };
    const first = await backend<{ xpGain: number }>(
      page,
      "mutation",
      "learning:recordSession",
      sessionArgs,
    );
    const afterFirst = await readXp();
    const second = await backend<{ xpGain: number }>(
      page,
      "mutation",
      "learning:recordSession",
      sessionArgs,
    );
    const afterSecond = await readXp();
    expect(afterFirst - stableXp, "XP de la première session").toBe(first.xpGain);
    expect(second.xpGain, "session rejouée : XP différent").toBe(first.xpGain);
    expect(afterSecond, "l'XP a été crédité deux fois").toBe(afterFirst);

    // Nettoyage : uniquement les cartes apparues pendant ce scénario.
    const deckAfter = await backend<
      Array<{ card: { _id: string }; slang: { _id: string } }>
    >(page, "query", "learning:myDeck");
    for (const row of deckAfter) {
      if (beforeIds.has(row.card._id)) continue;
      addedByTest.push(row.card._id);
      await backend(page, "mutation", "learning:removeFromSrs", {
        slangId: row.slang._id,
      });
    }
  });

  await test.step("Shadow : page et quota Preview, aucun service payant", async () => {
    await page.goto("/app/shadow", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/LA SCÈNE/i).first()).toBeVisible();
    await expect(page.getByText(/analyses Shadow restantes/i).first()).toBeVisible();
    expect(addedByTest.length, "aucune carte de test nettoyée").toBeGreaterThan(0);
  });

  await test.step("réseau et erreurs navigateur", async () => {
    expectCleanNetwork(net);
    expectNoBrowserErrors(net);
  });
});
