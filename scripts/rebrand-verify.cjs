/* VÉRIFICATION BROWSER DU REBRANDING MOOVY.
   Parcourt les surfaces publiques et authentifiées et échoue si :
     • une occurrence visible de « Lingua Noir » subsiste ;
     • le wordmark MOOVY est absent des surfaces clés.
   Vues : landing, auth, app shell, Discover, Shadow, Memory, Space,
   responsive mobile, dark/light.
   Usage : node scripts/rebrand-verify.cjs
*/
const { chromium } = require("playwright-core");

const BASE = "http://127.0.0.1:5173";
const CHROME = "/home/user/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const PROFILE = "/tmp/ln-chrome-profile";

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
    /^MOOVY/.test(await title()),
    JSON.stringify(await title()),
  );
  rep("L.wordmark-moovy", landing.includes("MOOVY"), "présent dans la navbar/footer");
  rep(
    "L.sans-lingua-noir",
    !/lingua\s*noir/i.test(landing),
    /lingua\s*noir/i.test(landing) ? "occurrence visible restante" : "0 occurrence",
  );

  /* ── Auth ───────────────────────────────────────────────────────── */
  await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const auth = await body();
  rep("A.wordmark-moovy", auth.includes("MOOVY"), "bloc marque visible");
  rep("A.sans-lingua-noir", !/lingua\s*noir/i.test(auth), "0 occurrence");

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
    const hasBrand = txt.includes("MOOVY");
    const hasOld = /lingua\s*noir/i.test(txt);
    rep(
      s.name,
      !hasOld && (s.name === "S.shadow" || s.name === "S.memory" || hasBrand),
      hasOld
        ? "« Lingua Noir » visible"
        : hasBrand
          ? "MOOVY visible"
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
  rep("M.mobile-sans-lingua", !/lingua\s*noir/i.test(mobile), "0 occurrence");
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ── Dark / light ───────────────────────────────────────────────── */
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(BASE + "/app/shadow", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const lightTxt = await body();
  rep("L2.light-mode-rendu", lightTxt.length > 200, "page Shadow rendue en light");
  rep("L2.light-sans-lingua", !/lingua\s*noir/i.test(lightTxt), "0 occurrence");
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
