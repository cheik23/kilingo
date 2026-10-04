/* PREUVE DE DÉGRADATION — le moteur local est INJOIGNABLE.

   Le cas réel : réseau d'entreprise qui bloque le téléchargement des poids,
   navigateur sans WASM, mémoire insuffisante. L'application ne doit JAMAIS
   rester bloquée sur un spinner : elle doit basculer sur le pipeline serveur
   (worker auto-hébergé → Groq) et livrer des sous-titres, avec le badge
   correspondant.

   Méthode : profil navigateur NEUF (aucun cache de modèle) + blocage réseau
   de huggingface.co et du CDN du runtime ONNX. On vérifie ensuite :
     1. le diagnostic annonce honnêtement « Moteur local indisponible » ;
     2. l'upload bascule sur le pipeline serveur ;
     3. des sous-titres apparaissent réellement (pas de faux succès) ;
     4. aucune erreur critique, aucun blocage.

   Usage : node scripts/fallback-proof.cjs [mp3]
*/
const { chromium } = require("playwright-core");

const BASE = "http://127.0.0.1:5173";
const CHROME = "/home/user/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const PROFILE = "/tmp/ln-chrome-fallback";
const MP3 = process.argv[2] || "/tmp/ln_en_test.mp3";
const BLOCKED = /(^|\.)huggingface\.co|cdn-lfs|jsdelivr\.net|hf-mirror/i;

const R = {};
const rep = (k, pass, detail = "") => {
  R[k] = pass;
  console.log(`${pass === true ? "PASS" : pass === null ? "WARN" : "FAIL"} | ${k} | ${detail}`);
};
const pageErrors = [];
const criticalErrors = [];

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

  let blocked = 0;
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (BLOCKED.test(url)) {
      blocked++;
      return route.abort();
    }
    return route.continue();
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      if (!/401|404|Failed to load resource|net::|WebSocket|huggingface|jsdelivr|ERR_FAILED|ERR_BLOCKED/i.test(t))
        criticalErrors.push(t);
    }
  });

  const body = () => page.evaluate(() => document.body.innerText);

  /* Session invitée + onboarding (profil neuf : les deux sont nécessaires). */
  await page.goto(BASE + "/app/shadow", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  if (/\/auth/.test(page.url())) {
    await page.getByText(/Continuer en invit/i).first().click({ timeout: 15000 });
    await page.waitForTimeout(1800);
  }
  if (/ÉTAPE\s*1|premier jour/i.test(await body())) {
    await page.locator("button").filter({ hasText: /Anglais/i }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator("button").filter({ hasText: /Continuer/i }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    if (/premier jour/i.test(await body())) {
      await page.locator("button").filter({ hasText: /Lancer mon premier jour/i }).first().click().catch(() => {});
      await page.waitForTimeout(1500);
    }
  }
  await page.goto(BASE + "/app/shadow", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  /* 1. Diagnostic : le moteur local DOIT se déclarer indisponible (honnête),
        et annoncer ce qui prend le relais. */
  let diag = "";
  try {
    await page.getByText(/Tester le moteur de transcription/i).first().click({ timeout: 10000 });
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      diag = await page.evaluate(() => {
        const hit = [...document.querySelectorAll("p")].find((el) =>
          /indisponible|browser_whisper_local|faster-whisper|groq|ASR_/i.test(el.textContent || ""),
        );
        return hit ? (hit.textContent || "").trim() : "";
      });
      if (diag) break;
    }
  } catch (e) {
    diag = "diagnostic indisponible: " + String(e).slice(0, 60);
  }
  rep(
    "1.moteur-local-déclaré-indisponible",
    /Moteur local indisponible/i.test(diag),
    diag.slice(0, 190) || "aucun message",
  );
  rep("1.requêtes-poids-bloquées", blocked > 0, `${blocked} requêtes vers les hôtes de modèles bloquées`);

  /* 2-3. Upload : bascule sur le pipeline serveur, sous-titres réels. */
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached", timeout: 15000 });
  await input.setInputFiles(MP3);

  let fallbackBadge = "";
  let segments = 0;
  for (let i = 0; i < 90; i++) {
    const txt = await body();
    if (/transcription automatique de l'audio/i.test(txt))
      fallbackBadge = "transcription automatique de l'audio (repli Groq)";
    else if (/faster-whisper \(local\)/i.test(txt))
      fallbackBadge = "transcription faster-whisper (local)";
    else if (/transcription Whisper locale/i.test(txt))
      fallbackBadge = "transcription Whisper locale (moteur local — inattendu ici)";
    segments = await page.evaluate(() => document.querySelectorAll('[id^="subtitle-"]').length);
    if (segments > 0 && fallbackBadge) break;
    await page.waitForTimeout(2000);
  }
  rep(
    "2.repli-serveur-actif",
    /repli Groq|faster-whisper \(local\)/.test(fallbackBadge),
    fallbackBadge || "aucun badge transcriptSource",
  );
  rep(
    "3.sous-titres-livrés-malgré-le-blocage",
    segments > 0,
    `${segments} sous-titres synchronisés`,
  );
  rep(
    "4.aucun-blocage-silencieux",
    !/traitement impossible|Upload impossible|une erreur est survenue/i.test(await body()) ||
      segments > 0,
    segments > 0 ? "le flux s'est terminé" : "flux interrompu",
  );
  rep(
    "5.aucune-erreur-critique",
    pageErrors.length === 0 && criticalErrors.length === 0,
    pageErrors.length || criticalErrors.length
      ? JSON.stringify({ pageErrors: pageErrors.slice(0, 2), console: criticalErrors.slice(0, 2) })
      : "0 erreur",
  );

  await browser.close();
  const pass = Object.values(R).filter((v) => v === true).length;
  const warn = Object.values(R).filter((v) => v === null).length;
  const fail = Object.values(R).filter((v) => v === false).length;
  console.log(`\n=== BILAN DÉGRADATION: ${pass} PASS, ${warn} WARN, ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR DRIVER:", e);
  process.exit(2);
});
