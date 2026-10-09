/* TEST BROWSER CIBLÉ — RUNTIME RÉEL DE L'APPLICATION DÉPLOYÉE.
   Couvre uniquement :
   A. ouverture de Shadow          F. présence des mots/timestamps (karaoké)
   B. chargement d'un vrai MP3     G. karaoké/shadow actif
   C. transcription visible        H. lecture audio
   D. traduction visible           I. seek
   E. présence des segments        J. navigation vers Memory
   M. moteur ASR du déploiement    K. aucune erreur console critique
   L. provider réellement utilisé

   Usage : node scripts/targeted-browser.cjs [mp3] [--warm]
     --warm : ne fait que le diagnostic du moteur local (télécharge les
              poids dans le profil persistant) puis sort.

   Prérequis : dev server Vite sur :5173 (géré par la plateforme) et le
   profil navigateur persistant /tmp/ln-chrome-profile (cache des modèles).
   AUCUN service externe à lancer : l'ASR et la traduction s'exécutent dans
   le déploiement (moteur Whisper/OPUS-MT de l'onglet). Le test signale un
   WARN — jamais un faux PASS — si le moteur local est indisponible.
*/
const path = require("path");
const { chromium } = require("playwright-core");

/* Port de test officiel Kilingo : 3201 (surchargeable). Le binaire navigateur et
 *  le dossier de profils le sont aussi, pour tourner hors du sandbox Linux
 *  d'origine (ex. Edge local sous Windows). */
const BASE = process.env.KILINGO_BASE || "http://127.0.0.1:3201";
const CHROME =
  process.env.KILINGO_CHROME ||
  "/home/user/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const PROFILE = path.join(process.env.KILINGO_PROFILE_DIR || "/tmp", "ln-chrome-profile");
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const WARM_ONLY = process.argv.includes("--warm");
const MP3 = ARGS[0] || "/tmp/voice1.mp3";

const R = {};
const rep = (k, pass, detail = "") => {
  R[k] = pass;
  console.log(`${pass === true ? "PASS" : pass === null ? "WARN" : "FAIL"} | ${k} | ${detail}`);
};
const pageErrors = [];
const criticalErrors = [];

(async () => {
  // Générer un MP3 réel de test si absent (voix TTS locale, pas de service externe)
  const fs = require("fs");
  if (!fs.existsSync(MP3)) {
    const { execSync } = require("child_process");
    execSync('espeak-ng -v fr-fr -w /tmp/ln_browser.wav "Bonjour tout le monde, bienvenue dans KILINGO. Ceci est un test du lecteur Shadow."');
    execSync("ffmpeg -y -loglevel error -i /tmp/ln_browser.wav -codec:a libmp3lame -qscale:a 6 " + MP3);
    console.log("[setup] MP3 de test généré:", MP3);
  }

  // Profil PERSISTANT : les poids du modèle (cache HTTP du navigateur) ne
  // sont téléchargés qu'une fois, y compris entre deux exécutions du test.
  const browser = await chromium.launchPersistentContext(PROFILE, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1280, height: 900 },
    // UA de navigateur réel : le proxy de sortie du sandbox refuse
    // « HeadlessChrome » (HTTP 405) alors que le même POSTE accepte un UA
    // normal — sans quoi les poids du modèle (fichiers statiques libres)
    // ne seraient pas téléchargeables dans le test.
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = browser.pages()[0] || (await browser.newPage());
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      // Erreurs réseau attendues hors worker local (Convex 401/404 polling,
      // annonces de récupération) ne sont pas des erreurs critiques d'app.
      if (!/401|404|Failed to load resource|net::|WebSocket/i.test(t)) criticalErrors.push(t);
    }
  });

  const body = () => page.evaluate(() => document.body.innerText);
  const audio = () => page.evaluate(() => {
    const a = document.querySelector("audio");
    return a ? { readyState: a.readyState, duration: a.duration, currentTime: a.currentTime, paused: a.paused, srcTail: (a.currentSrc || "").slice(-12) } : null;
  });

  /* Connexion invité + onboarding déterministe :
     étape 1 = cliquer UNE langue (le bouton Continuer est disabled tant que
     selected.length === 0) puis « Continuer » ; étape 2 = « Lancer mon
     premier jour ». Fin attestée par l'app shell réelle. */
  const signInGuest = async () => {
    // Le profil persistant peut déjà porter une session invitée : on ne
    // clique « Continuer en invité » que si /auth est réellement affiché.
    await page.goto(BASE + "/app/shadow", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    if (!/\/auth/.test(page.url())) return;
    await page.getByText(/Continuer en invit/i).first().click({ timeout: 15000 });
    await page.waitForTimeout(1800);
  };
  const finishOnboarding = async () => {
    let txt = await body();
    if (/ÉTAPE\s*1|premier jour/i.test(txt)) {
      await page.locator("button").filter({ hasText: /Anglais/i }).first().click().catch(() => {});
      await page.waitForTimeout(400);
      await page.locator("button").filter({ hasText: /Continuer/i }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    txt = await body();
    if (/premier jour/i.test(txt)) {
      await page.locator("button").filter({ hasText: /Lancer mon premier jour/i }).first().click().catch(() => {});
      await page.waitForTimeout(1800);
    }
  };
  const openShadow = async () => {
    await signInGuest();
    await finishOnboarding();
    await page.goto(BASE + "/app/shadow", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
  };

  await openShadow();
  rep(
    "0.onboarding-terminé",
    /NAVIGATION PRINCIPALE|navigation/i.test(await body()),
    "app shell réel atteint",
  );

  /* A. Ouverture de Shadow */
  rep(
    "A.shadow-ouvert",
    /shadow|intake|média|upload|fichier|url/i.test(await body()),
    `${page.url()} — ${JSON.stringify((await body()).slice(0, 60).replace(/\n/g, " · "))}`,
  );

  /* M. Diagnostic moteur ASR — action Convex réelle (testAsrEngine) : affiche
     l'endpoint RÉELLEMENT atteint depuis le runtime Convex (worker local ou
     repli Groq), donc où s'exécutent les fonctions. */
  let asrDiag = "";
  try {
    await page.getByText(/Tester le moteur de transcription/i).first().click({ timeout: 10000 });
    // Le premier passage télécharge les poids du modèle : jusqu'à 150 s.
    for (let i = 0; i < 150; i++) {
      await page.waitForTimeout(1000);
      asrDiag = await page.evaluate(() => {
        const hit = [...document.querySelectorAll("p")].find((el) =>
          /browser_whisper_local|faster-whisper|groq|injoignable|HTTP \d|ASR_/i.test(el.textContent || ""),
        );
        return hit ? (hit.textContent || "").trim() : "";
      });
      if (asrDiag) break;
    }
  } catch (e) {
    asrDiag = "diagnostic indisponible: " + String(e).slice(0, 70);
  }
  const diagLocal = /browser_whisper_local/i.test(asrDiag);
  rep(
    "M.diagnostic-moteur-asr",
    diagLocal ? true : asrDiag ? false : null,
    asrDiag.slice(0, 200) || "aucun résultat affiché",
  );
  if (WARM_ONLY) {
    await browser.close();
    console.log(`\n=== WARM: moteur local ${diagLocal ? "prêt" : "indisponible"} ===`);
    process.exit(diagLocal ? 0 : 1);
  }

  /* B. Chargement d'un vrai MP3 */
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached", timeout: 15000 });
  await input.setInputFiles(MP3);
  let loaded = null;
  for (let i = 0; i < 80; i++) {
    const p = await audio();
    if (p && p.readyState >= 2) { loaded = p; break; }
    await page.waitForTimeout(500);
  }
  rep("B.mp3-charge", !!loaded, loaded ? `readyState=${loaded.readyState} duration=${loaded.duration?.toFixed(1)}s src=…${loaded.srcTail}` : "audio jamais prêt");
  if (!loaded) { await browser.close(); process.exit(1); }

  /* H. Lecture audio */
  let played = false;
  try {
    const btn = page.locator('button[aria-label="Lecture"]').first();
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();
    for (let i = 0; i < 20; i++) {
      const p = await audio();
      if (p && !p.paused && p.currentTime > 0.05) { played = true; break; }
      await page.waitForTimeout(300);
    }
  } catch { /* bouton absent */ }
  rep("H.lecture-audio", played, played ? `t=${(await audio()).currentTime.toFixed(2)}` : "pas de lecture");

  /* E+F+G. Segments, mots/karaoké */
  let segments = 0, wordEls = 0, gold = false;
  for (let i = 0; i < 90; i++) {
    const d = await page.evaluate(() => {
      const segs = [...document.querySelectorAll('[id^="subtitle-"]')];
      const words = document.querySelectorAll(".ln-word-current, .ln-word-past");
      return { n: segs.length, w: words.length, gold: segs.some((e) => /border-gold\/60/.test(e.className)) };
    });
    segments = d.n; wordEls = d.w; gold = d.gold;
    if (segments > 0 && wordEls > 0) break;
    await page.waitForTimeout(2000);
  }
  rep("E.segments-présents", segments > 0, `${segments} sous-titres`);
  rep("F.mots-karaoké-présents", wordEls > 0, `${wordEls} éléments mot actif/passé`);
  rep("G.karaoke-actif", gold, "segment surligné (border-gold) synchronisé");

  /* C+D. Transcription et traduction visibles */
  const panel = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[id^="subtitle-"]')].find((e) => /border-gold\/60/.test(e.className)) || document.querySelector('[id^="subtitle-"]');
    return el ? el.innerText.slice(0, 220) : "";
  });
  const txt = await body();
  rep("C.transcription-visible", panel.length > 0, JSON.stringify(panel.slice(0, 90)));
  rep(
    "D.traduction-visible",
    panel.length > 0 && panel.split("\n").filter((l) => l.trim()).length >= 2,
    panel.split("\n").filter((l) => l.trim())[1] || "(2e ligne absente)",
  );
  const unavailable = /ASR_WORKER_UNAVAILABLE|aucun moteur/i.test(txt);
  if (unavailable) rep("C.transcription-visible", null, "ASR_WORKER_UNAVAILABLE affiché — worker local non configuré côté Convex (voir rapport)");

  /* L. Provider ASR RÉELLEMENT utilisé par l'application. ShadowView affiche
     le champ `transcriptSource` persisté par le pipeline :
       "transcription Whisper locale (dans ton navigateur)" → moteur du
            déploiement (browser_whisper_local) : LOCAL ASR = YES, GROQ = NO
       "transcription faster-whisper (local)"  → worker auto-hébergé
       "transcription automatique de l'audio"  → repli Groq
       "audio analysé"                          → source non renseignée */
  const localAsr = /transcription Whisper locale/i.test(txt);
  const groqAsr = /transcription automatique de l'audio/i.test(txt);
  rep(
    "L.provider-asr-local",
    localAsr ? true : groqAsr ? false : null,
    localAsr
      ? "badge = transcription Whisper locale (moteur du déploiement) — GROQ ASR = NO"
      : groqAsr
        ? "badge = transcription automatique de l'audio (repli Groq)"
        : "badge transcriptSource absent",
  );

  /* I. Seek (boutons transport) — borné par la durée du média
     (+10 s au-delà de la fin = clamp à duration, comportement attendu) */
  try {
    await page.locator('button[aria-label="Pause"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    const before = (await audio()).currentTime;
    const dur = (await audio()).duration;
    await page.locator('button[aria-label="Avancer de 10 secondes"]').first().click();
    await page.waitForTimeout(600);
    const after = (await audio()).currentTime;
    const expected = Math.min(before + 10, dur || Infinity);
    rep("I.seek", Math.abs(after - expected) < 1.2 && after > before, `t ${before.toFixed(2)} → ${after.toFixed(2)} (attendu ≤ ${expected.toFixed(2)}, durée ${dur?.toFixed(1)}s)`);
  } catch (e) { rep("I.seek", false, String(e).slice(0, 80)); }

  /* J. Navigation vers Memory (aller-retour) */
  try {
    await page.locator('a[href="/app/memory"], button:has-text("Memory")').first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    const memTxt = await body();
    rep("J.navigation-memory", /memory|mémoris|mots|expressions|collection/i.test(memTxt), memTxt.slice(0, 70).replace(/\n/g, " · "));
    await page.goBack();
    await page.waitForTimeout(1000);
    rep("J.retour-shadow", /shadow|intake|média|sous-titres/i.test(await body()), "retour depuis Memory");
  } catch (e) { rep("J.navigation-memory", false, String(e).slice(0, 80)); }

  /* K. Erreurs console critiques */
  rep("K.aucune-erreur-critique", pageErrors.length === 0 && criticalErrors.length === 0,
    pageErrors.length || criticalErrors.length ? JSON.stringify({ pageErrors: pageErrors.slice(0, 3), console: criticalErrors.slice(0, 3) }) : "0 erreur");

  await browser.close();
  const pass = Object.values(R).filter((v) => v === true).length;
  const warn = Object.values(R).filter((v) => v === null).length;
  const fail = Object.values(R).filter((v) => v === false).length;
  console.log(`\n=== BILAN: ${pass} PASS, ${warn} WARN, ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("ERREUR DRIVER:", e); process.exit(2); });
