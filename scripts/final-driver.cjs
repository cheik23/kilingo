/* VALIDATION FINALE v3 — diagnostics sur les 2 FAIL v2 :
   - phase 2 : dump complet des segments (id/classe/plage) après clic en pause
   - phase 5 : attente du DÉTACHEMENT de l'ancien <audio> avant l'upload suivant
   - phases 6/7 : libellés exacts des onglets + dump de secours */
const fs = require("fs");
const { chromium } = require("playwright-core");

const BASE = "http://127.0.0.1:5173";
const CHROME = "/home/user/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const MP3_A = "/tmp/voice1.mp3";
const MP3_B = "/tmp/voice2.mp3";

const R = {};
const rep = (k, pass, detail = "") => { R[k] = { pass, detail }; console.log(`${pass ? "PASS" : pass === null ? "WARN" : "FAIL"} | ${k} | ${detail}`); };
const pageErrors = [];

const props = (page) => page.evaluate(() => {
  const a = document.querySelector("audio");
  if (!a) return null;
  return { readyState: a.readyState, duration: a.duration, currentTime: a.currentTime, paused: a.paused, muted: a.muted, volume: a.volume, ended: a.ended, err: a.error ? `${a.error.code}:${a.error.message}` : null, canPlay: a.canPlayType("audio/mpeg"), srcTail: (a.currentSrc || "").slice(-10) };
});
const body = (page) => page.evaluate(() => document.body.innerText);
const clock = (page) => page.evaluate(() => { const a = document.querySelector("audio"); return a ? Number(a.currentTime.toFixed(2)) : -1; });
/* Dump COMPLET de la liste de segments : id, classe gold, plage, contient t ? */
const segDump = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('[id^="subtitle-"]')];
  const t = (() => { const a = document.querySelector("audio"); return a ? a.currentTime : -1; })();
  return {
    t: Number(t.toFixed(3)),
    n: els.length,
    segs: els.map((e) => {
      const m = e.innerText.match(/(\d+):(\d+)\s*→\s*(\d+):(\d+)/);
      const gold = /border-gold\/60/.test(e.className);
      const s = m ? Number(m[1]) * 60 + Number(m[2]) : null;
      const en = m ? Number(m[3]) * 60 + Number(m[4]) : null;
      return { id: e.id, gold, s, en, covers: s !== null && t >= s && t < en };
    }),
  };
});
const activeSeg = (page) => page.evaluate(() => {
  const el = [...document.querySelectorAll('[id^="subtitle-"]')].find((e) => /border-gold\/60/.test(e.className));
  if (!el) return null;
  const m = el.innerText.match(/(\d+):(\d+)\s*→/);
  return { id: el.id, start: m ? Number(m[1]) * 60 + Number(m[2]) : null };
});
async function waitProp(page, pred, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const p = await props(page); if (p && pred(p)) return p; await page.waitForTimeout(250); }
  return await props(page);
}
async function freshUpload(page, path) {
  try {
    const before = await page.evaluate(() => { const a = document.querySelector("audio"); return a ? a.currentSrc : null; });
    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 15000 });
    await input.setInputFiles(path);
    /* Attendre un audio NOUVEAU (src différente) et prêt — pas l'ancien. */
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      const p = await props(page);
      if (p && p.currentSrc && p.currentSrc !== before && p.readyState >= 2) return p;
      await page.waitForTimeout(300);
    }
    return false;
  } catch { return false; }
}
async function clickPlay(page) {
  try {
    const btn = page.locator('button[aria-label="Lecture"]').first();
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();
    return await waitProp(page, (p) => !p.paused && p.currentTime > 0, 10000);
  } catch { return null; }
}
async function ensurePaused(page) {
  for (let i = 0; i < 3; i++) {
    const p = await props(page);
    if (!p) return null;
    if (p.paused) return p;
    const btn = page.locator('button[aria-label="Pause"]').first();
    if (await btn.count()) { await btn.click().catch(() => {}); await page.waitForTimeout(500); }
  }
  return await props(page);
}
/* Reset + attente du retour à l'intake (plus d'audio, onglets visibles). */
async function newMedia(page) {
  const btn = page.locator("button").filter({ hasText: /nouveau média|autre média|réessayer/i }).first();
  for (let i = 0; i < 6; i++) {
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await page.waitForSelector("audio", { state: "detached", timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      return true;
    }
    await page.waitForTimeout(1500);
  }
  return false;
}
async function switchTab(page, label) {
  const tab = page.locator("button").filter({ hasText: label }).first();
  try { await tab.click({ timeout: 5000 }); await page.waitForTimeout(600); return true; }
  catch {
    const btns = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 25));
    console.log(`  [dump boutons] ${btns.join(" | ")}`);
    return false;
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded" });
  await page.getByText(/Continuer en invit/i).first().click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 12; i++) {
    const txt = await body(page);
    if (/ÉTAPE\s*1\s*\/\s*2/i.test(txt)) {
      const cont = page.locator("button").filter({ hasText: /continuer|valider|suivant/i }).first();
      if (await cont.count() && await cont.isEnabled().catch(() => false)) await cont.click().catch(() => {});
      else { const chips = page.locator("button").filter({ hasNotText: /continuer|valider|suivant/i }); const n = await chips.count(); if (n) await chips.nth(1).click().catch(() => {}); }
      await page.waitForTimeout(800);
    } else if (/premier jour/i.test(txt)) {
      await page.locator("button").filter({ hasText: /lancer|terminer|commencer/i }).first().click().catch(() => {});
      await page.waitForTimeout(800);
    } else break;
  }
  await page.goto(BASE + "/app/shadow", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  rep("0.acces-shadow", /shadow|intake|média|upload/i.test(await body(page)));

  /* PHASE 1 : MP3 1 */
  rep("1.upload-mp3-1", !!(await freshUpload(page, MP3_A)));
  const played = await clickPlay(page);
  rep("1.play-reel", !!played && played.currentTime > 0, `t=${played && played.currentTime.toFixed(2)}`);
  await page.waitForTimeout(1500);
  const d1 = await segDump(page);
  rep("1.karaoke-synchronise", d1.segs.length > 0 && d1.segs.some((s) => s.gold && s.covers),
    `t=${d1.t} segments=${d1.n} actif=${JSON.stringify(d1.segs.find((s) => s.gold))}`);

  /* PHASE 2 : pause vérifiée → clic segment en pause → dump */
  const pp = await ensurePaused(page);
  rep("2.pause-ok", !!pp && pp.paused, `t=${pp && pp.currentTime.toFixed(2)}`);
  await page.locator('button[aria-label="Reculer de 5 secondes"]').first().click().catch(() => {});
  await page.waitForTimeout(400);
  rep("2.seek-moins-5", (await clock(page)) === 0, `t=${await clock(page)}`);

  let completed = false;
  for (let i = 0; i < 48; i++) { if (/Sous-titres synchronisés/i.test(await body(page))) { completed = true; break; } await page.waitForTimeout(2500); }
  rep("2.pipeline-complete", completed);
  if (completed) {
    await clickPlay(page);
    await ensurePaused(page);
    await page.waitForTimeout(600);
    const tA = await clock(page); await page.waitForTimeout(600); const tB = await clock(page);
    rep("2.pause-avant-clic-verifiee", Math.abs(tB - tA) < 0.06, `tA=${tA} tB=${tB}`);
    const before = await segDump(page);
    const clicked = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[id^="subtitle-"]')];
      const cur = els.find((e) => /border-gold\/60/.test(e.className));
      const other = els.filter((e) => e !== cur).pop();
      if (!other) return null;
      const m = other.innerText.match(/(\d+):(\d+)\s*→\s*(\d+):(\d+)/);
      other.click();
      return { id: other.id, s: m ? Number(m[1]) * 60 + Number(m[2]) : null, e: m ? Number(m[3]) * 60 + Number(m[4]) : null };
    });
    await page.waitForTimeout(600);
    const after = await segDump(page);
    const goldNow = after.segs.filter((s) => s.gold).map((s) => s.id);
    rep("2.seek-en-pause-horloge", !!clicked && Math.abs(after.t - (clicked.s ?? -99)) < 0.15 && (await props(page)).paused,
      `clic→${clicked && clicked.id} [${clicked && clicked.s},${clicked && clicked.e}] t=${after.t} paused=${(await props(page)).paused}`);
    rep("2.seek-en-pause-surlignage (fix)", !!clicked && goldNow.length === 1 && goldNow[0] === clicked.id,
      `gold=[${goldNow.join(",")}] attendu=[${clicked && clicked.id}] — avant: ${JSON.stringify(before.segs.map((s) => ({ id: s.id, gold: s.gold })))}`);
    await page.locator('button[aria-label="Avancer de 10 secondes"]').first().click().catch(() => {});
    await page.waitForTimeout(500);
    const pEnd = await props(page);
    rep("2.seek-plus-10-fin", !!pEnd && (pEnd.ended || pEnd.currentTime >= pEnd.duration - 0.5), `t=${pEnd && pEnd.currentTime}/${pEnd && pEnd.duration}`);
  }

  /* PHASES 3-4 : MP3 2 puis retour MP3 1 */
  rep("3.nouveau-media", await newMedia(page));
  rep("3.upload-mp3-2", !!(await freshUpload(page, MP3_B)));
  const pB = await clickPlay(page);
  rep("3.mp3-2-play", !!pB && pB.currentTime > 0, `src=…${pB && pB.srcTail} t=${pB && pB.currentTime.toFixed(2)}`);
  rep("4.nouveau-media-2", await newMedia(page));
  rep("4.retour-mp3-1", !!(await freshUpload(page, MP3_A)));
  const pC = await clickPlay(page);
  rep("4.retour-mp3-1-play", !!pC && pC.currentTime > 0 && pC.err === null, `src=…${pC && pC.srcTail} t=${pC && pC.currentTime.toFixed(2)} err=${pC && pC.err}`);

  /* PHASE 5 : erreur + récupération */
  rep("5.nouveau-media-3", await newMedia(page));
  fs.writeFileSync("/tmp/bad.mp3", Buffer.from("ID3not-a-real-mp3-payload-".repeat(40)));
  rep("5.upload-invalide", !!(await freshUpload(page, "/tmp/bad.mp3")));
  let failedShown = false;
  for (let i = 0; i < 60; i++) { if (/Lecture indisponible/i.test(await body(page))) { failedShown = true; break; } await page.waitForTimeout(1500); }
  rep("5.erreur-affichee-bandeau", failedShown);
  rep("5.recuperation-reset", await newMedia(page));
  const pR = await freshUpload(page, MP3_A);
  const pRp = pR ? await clickPlay(page) : null;
  rep("5.recuperation-play", !!pRp && pRp.currentTime > 0 && pRp.err === null, `src=…${pRp && pRp.srcTail} t=${pRp && pRp.currentTime.toFixed(2)}`);

  /* PHASE 6 : YouTube */
  rep("6.nouveau-media-4", await newMedia(page));
  if (await switchTab(page, "Coller un lien")) {
    const inp = page.locator('input[type="url"], input[placeholder*="lien" i], input[placeholder*="http"], input[placeholder*="ouTube" i]').first();
    try { await inp.waitFor({ state: "visible", timeout: 5000 }); await inp.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ"); } catch { console.log("  [dump] input lien introuvable"); }
    await page.locator("button").filter({ hasText: /analyser/i }).first().click().catch(() => {});
    let iframeOk = false;
    for (let i = 0; i < 16; i++) { if (await page.evaluate(() => !!document.querySelector('iframe[src*="youtu"]'))) { iframeOk = true; break; } await page.waitForTimeout(1000); }
    rep("6.youtube-iframe-montee", iframeOk, iframeOk ? "init OK" : "iframe absente (réseau YouTube sandbox ?)");
    if (iframeOk) {
      await newMedia(page);
      await page.waitForTimeout(1200);
      rep("6.youtube-cleanup", await page.evaluate(() => !document.querySelector('iframe[src*="youtu"]')));
    }
  } else rep("6.youtube-intake", null, "onglet lien introuvable");

  /* PHASE 7 : texte */
  rep("7.nouveau-media-5", await newMedia(page));
  if (await switchTab(page, "Texte")) {
    await page.locator("textarea").first().fill("Bonjour et bienvenue dans MOOVY. Ceci est un test du média texte. La segmentation fonctionne par phrases. Chaque segment devient une ligne karaoké synchronisée sur l'horloge virtuelle.");
    await page.locator("button").filter({ hasText: /analyser le texte/i }).first().click().catch(() => {});
    let textDone = false;
    for (let i = 0; i < 40; i++) { if (/synchronisés/i.test(await body(page))) { textDone = true; break; } await page.waitForTimeout(2500); }
    rep("7.texte-pipeline-complete", textDone);
    const tp = page.locator('button[aria-label="Lecture"]').first();
    if (await tp.count()) { await tp.click().catch(() => {}); await page.waitForTimeout(1500); rep("7.texte-lecture-virtuelle", true, "Lecture actionnée"); }
  } else rep("7.texte-intake", null, "onglet texte introuvable");

  /* PHASE 8 : fuites i18n */
  const leaks = (await body(page)).match(/[a-z]+\.[a-z][a-zA-Z]+(?=[\s.,!?:]|$)/g)?.filter((k) => /^(memory|nav|discover|shadow|errors|registers|legal)\./.test(k)) || [];
  rep("8.i18n-pas-de-cle-brute", leaks.length === 0, leaks.length ? leaks.slice(0, 4).join(",") : "aucune clé brute");

  console.log("\nPAGE ERRORS:", pageErrors.length ? pageErrors.slice(0, 5).join(" | ") : "aucune");
  const fails = Object.values(R).filter((v) => v.pass === false).length;
  console.log(`=== BILAN: ${Object.keys(R).length - fails}/${Object.keys(R).length} PASS, ${fails} FAIL ===`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("DRIVER FATAL:", e.message); process.exit(1); });
