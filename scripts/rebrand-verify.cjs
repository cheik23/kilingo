/* VÉRIFICATION BROWSER DU REBRANDING KILINGO.
   Parcourt les surfaces publiques et authentifiées et échoue si :
     • une ancienne marque (MOOVY ou Lingua Noir) reste visible ;
     • le wordmark KILINGO est absent des surfaces clés.
   Vues : landing, auth, app shell, Discover, Shadow, Memory, Space,
   responsive mobile, dark/light.
   Usage : node scripts/rebrand-verify.cjs
*/
const path = require("path");
const { chromium } = require("playwright-core");

/** Marques abandonnées. Le motif doit couvrir les trois écritures vues dans le
 *  dépôt : « Moovy », « Lingua Noir », « lingua-noir » ET la forme concaténée
 *  « linguanoir » (préfixe de cache du service worker, ancien domaine). Un motif
 *  trop étroit laisse passer des occurrences à l'ceil nu. */
const ANCIENNES = /moovy|lingua[\s-]*noir/i;

/* Port de test officiel Kilingo : 3201 (surchargeable). Le binaire navigateur et
 *  le dossier de profils le sont aussi, pour tourner hors du sandbox Linux
 *  d'origine (ex. Edge local sous Windows). */
const BASE = process.env.KILINGO_BASE || "http://127.0.0.1:3201";
const CHROME =
  process.env.KILINGO_CHROME ||
  "/home/user/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const PROFILE = path.join(process.env.KILINGO_PROFILE_DIR || "/tmp", "ln-chrome-profile");

const R = {};
const rep = (k, pass, detail = "") => {
  R[k] = pass;
  console.log(`${pass === true ? "PASS" : pass === null ? "WARN" : "FAIL"} | ${k} | ${detail}`);
};

(async () => {
  const browser = await chromium.launchPersistentContext(PROFILE, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = browser.pages()[0] || (await browser.newPage());
  const body = () => page.evaluate(() => document.body.innerText);
  const title = async () => page.title();

  /* ── Landing ────────────────────────────────────────────────────── */
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const landing = await body();
  rep(
    "L.titre-document",
    /^KILINGO/.test(await title()),
    JSON.stringify(await title()),
  );
  rep("L.wordmark-kilingo", landing.includes("KILINGO"), "présent dans la navbar/footer");
  rep(
    "L.sans-kilingo",
    !ANCIENNES.test(landing),
    ANCIENNES.test(landing) ? "ancienne marque encore visible" : "0 occurrence",
  );

  /* ── Auth ───────────────────────────────────────────────────────── */
  await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const auth = await body();
  rep("A.wordmark-kilingo", auth.includes("KILINGO"), "bloc marque visible");
  rep("A.sans-kilingo", !ANCIENNES.test(auth), "0 occurrence");

  /* Session invitée si nécessaire, puis onboarding déterministe. */
  if (/Continuer en invité/i.test(auth)) {
    await page.getByText(/Continuer en invité/i).first().click({ timeout: 15000 });
    await page.waitForTimeout(1800);
  }
  if (/ÉTAPE\s*1|premier jour/i.test(await body())) {
    await page.locator("button").filter({ hasText: /Anglais/i }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator("button").filter({ hasText: /Continuer/i }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    if (/premier jour/i.test(await body())) {
      await page.locator("button").filter({ hasText: /Lancer mon premier jour/i }).first().click().catch(() => {});
      await page.waitForTimeout(1800);
    }
  }

  /* ── Surfaces authentifiées ─────────────────────────────────────── */
  const appSurfaces = [
    { name: "S.app-home", path: "/app" },
    { name: "S.discover", path: "/app/discover" },
    { name: "S.shadow", path: "/app/shadow" },
    { name: "S.memory", path: "/app/memory" },
    { name: "S.space", path: "/app/space" },
  ];
  let lastText = "";
  for (const s of appSurfaces) {
    await page.goto(BASE + s.path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    const txt = await body();
    lastText = txt;
    const hasBrand = txt.includes("KILINGO");
    const hasOld = ANCIENNES.test(txt);
    rep(
      s.name,
      !hasOld && (s.name === "S.shadow" || s.name === "S.memory" || hasBrand),
      hasOld
        ? "ancienne marque encore visible"
        : hasBrand
          ? "KILINGO visible"
          : "page rendue (marque non contextuelle)",
    );
  }

  /* ── Responsive mobile (375 px) ─────────────────────────────────── */
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const mobile = await body();
  const noHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 2,
  );
  rep("M.mobile-375-rendu", mobile.length > 200 && noHScroll, `scrollWidth OK: ${noHScroll}, texte: ${mobile.length} car.`);
  rep("M.mobile-sans-lingua", !ANCIENNES.test(mobile), "0 occurrence");
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ── Dark / light ───────────────────────────────────────────────── */
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(BASE + "/app/shadow", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const lightTxt = await body();
  rep("L2.light-mode-rendu", lightTxt.length > 200, "page Shadow rendue en light");
  rep("L2.light-sans-lingua", !ANCIENNES.test(lightTxt), "0 occurrence");
  await page.emulateMedia({ colorScheme: "dark" });

  await browser.close();
  const pass = Object.values(R).filter((v) => v === true).length;
  const warn = Object.values(R).filter((v) => v === null).length;
  const fail = Object.values(R).filter((v) => v === false).length;
  console.log(`\n=== REBRAND: ${pass} PASS, ${warn} WARN, ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR DRIVER:", e);
  process.exit(2);
});
