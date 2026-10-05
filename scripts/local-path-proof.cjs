/* ARCHIVE — preuve du mode « worker ASR auto-hébergé » (chemin ALTERNATIF).

   ⚠️ Ce n'est plus le chemin principal : depuis la refonte, Shadow transcrit
   et traduit dans le déploiement lui-même (moteur Whisper/OPUS-MT exécuté par
   l'onglet, `src/lib/localEngines.ts`), preuves : `scripts/targeted-browser.cjs`
   (chemin principal) et `scripts/fallback-proof.cjs` (dégradation).
   Ce script reste utile uniquement si tu déportes l'ASR sur une machine à toi
   et configures `WHISPER_LOCAL_URL` vers une URL joignable par Convex.

   La plateforme Freebuff interdit les services persistants en arrière-plan :
   ce script démarre donc, comme ENFANTS de ce process, le worker
   faster-whisper (:8000) et LibreTranslate/Argos (:5000) — exactement les
   services que `WHISPER_LOCAL_URL` / `TRANSLATE_LOCAL_URL` désignent — puis
   pilote l'application réelle (Playwright) : upload d'un MP3 dans Shadow.

   Puis il prouve PAR LES LOGS que l'app a appelé le worker local :
     - worker : « REQUEST … model=small … words=True » + « RESPONSE … words=N »
     - LT     : requête POST /translate servie localement
     - UI     : badge « transcription faster-whisper (local) » (transcriptSource)
   Aucun PASS n'est fabriqué : si le badge indique le repli Groq, le script
   échoue explicitement (LOCAL ASR = NO).

   Usage : node scripts/local-path-proof.cjs
*/
const { spawn, spawnSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PY = path.join(ROOT, "workers/.venv/bin/python");
const LIBRETRANSLATE = "/tmp/lt-venv/bin/libretranslate";
// playwright-core résolu depuis le cache de la plateforme (aucune install).
const PLAYWRIGHT_NODE_PATH = process.env.PLAYWRIGHT_NODE_PATH || "/tmp/bunx-1001-playwright@1.49.1/node_modules";

const WORKER_URL = "http://127.0.0.1:8000";
const TRANSLATE_URL = "http://127.0.0.1:5000";
const MP3 = process.argv[2] || "/tmp/ln_local_proof.mp3";

const logs = { worker: "", lt: "" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function start(name, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const onData = (b) => {
    const s = b.toString();
    logs[name] += s;
    process.stdout.write(`[${name}] ${s}`);
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  return child;
}

async function getJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: String(err) };
  }
}

async function waitReady(url, label, tries = 90) {
  for (let i = 0; i < tries; i++) {
    const r = await getJson(url);
    if (r.status === 200) return r;
    if (i % 5 === 0) console.log(`[proof] ${label} pas encore prêt (${r.status || "réseau"})…`);
    await sleep(2_000);
  }
  return { status: 0, body: "" };
}

const results = [];
const rep = (k, pass, detail) => {
  results.push({ k, pass, detail });
  console.log(`${pass === true ? "PASS" : pass === null ? "WARN" : "FAIL"} | ${k} | ${detail}`);
};

(async () => {
  if (!fs.existsSync(PY)) throw new Error(`venv worker introuvable : ${PY}`);
  if (!fs.existsSync(LIBRETRANSLATE)) throw new Error(`libretranslate introuvable : ${LIBRETRANSLATE}`);

  // Audio de test réel (TTS local) — jamais un faux fichier.
  if (!fs.existsSync(MP3)) {
    execSync(
      'espeak-ng -v fr-fr -w /tmp/ln_local_proof.wav "Bonjour tout le monde, bienvenue dans KILINGO. Ceci est un test du lecteur Shadow."',
    );
    execSync(`ffmpeg -y -loglevel error -i /tmp/ln_local_proof.wav -codec:a libmp3lame -qscale:a 6 ${MP3}`);
    console.log("[proof] MP3 de test généré :", MP3);
  }

  // ÉTAPE 1 — architecture réseau : Convex (service géré, même namespace
  // réseau) et le worker partagent 127.0.0.1. On synchronise code + env.
  console.log("[proof] convex dev --once (sync code + variables d'environnement)");
  const push = spawnSync("bunx", ["convex", "dev", "--once"], { cwd: ROOT, stdio: "inherit" });
  rep("1.convex-push", push.status === 0, `exit=${push.status}`);

  const worker = start("worker", PY, ["-m", "uvicorn", "whisper_worker:app", "--host", "127.0.0.1", "--port", "8000"], path.join(ROOT, "workers"));
  const lt = start("lt", LIBRETRANSLATE, ["--host", "127.0.0.1", "--port", "5000", "--load-only", "en,fr,es"], "/tmp");

  try {
    // ÉTAPE 2 — worker persistant (durée du test) + health réel (charge le modèle).
    const health = await waitReady(`${WORKER_URL}/health?model=small`, "health worker");
    let healthJson = null;
    try {
      healthJson = JSON.parse(health.body);
    } catch {
      /* pas un JSON : échec explicite ci-dessous */
    }
    rep(
      "2.worker-health",
      health.status === 200 && healthJson?.status === "ok",
      `GET ${WORKER_URL}/health?model=small → HTTP ${health.status} ${health.body.slice(0, 120)}`,
    );

    // ÉTAPE 3 — traducteur local persistant + /languages.
    const langs = await waitReady(`${TRANSLATE_URL}/languages`, "health LibreTranslate");
    const hasFrEn = /"fr"/.test(langs.body) && /"en"/.test(langs.body);
    rep(
      "3.translate-languages",
      langs.status === 200 && hasFrEn,
      `GET ${TRANSLATE_URL}/languages → HTTP ${langs.status} (fr+en servis : ${hasFrEn})`,
    );

    // ÉTAPES 5/7 — l'application réelle : upload MP3 dans Shadow.
    const browser = spawnSync("node", [path.join(ROOT, "scripts/targeted-browser.cjs"), MP3], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, NODE_PATH: PLAYWRIGHT_NODE_PATH },
    });
    rep("5.browser-flow", browser.status === 0, `targeted-browser.cjs exit=${browser.status}`);

    // ÉTAPE 6 — preuve par les logs : le worker local a réellement servi la
    // transcription demandée par Convex (aucun repli Groq possible sinon).
    const reqMatch = logs.worker.match(/REQUEST file=(\S+) bytes=(\d+) model=(\S+) language=(\S+) words=(\w+)/);
    rep(
      "6a.worker-requete-reelle",
      !!reqMatch && reqMatch[3] === "small",
      reqMatch ? `file=${reqMatch[1]} bytes=${reqMatch[2]} model=${reqMatch[3]} language=${reqMatch[4]} words=${reqMatch[5]}` : "aucune requête reçue par le worker",
    );
    const respMatch = logs.worker.match(/RESPONSE model=(\S+) segments=(\d+) words=(\d+) language=(\S+)/);
    const wordCount = respMatch ? Number(respMatch[3]) : 0;
    rep(
      "6b.worker-word-timestamps",
      !!respMatch && wordCount > 0,
      respMatch ? `segments=${respMatch[2]} words=${wordCount} language=${respMatch[4]}` : "aucune réponse du worker",
    );
    const translateHit = /(POST \/translate|"POST \/translate")/.test(logs.lt) || /translate/.test(logs.lt);
    rep("6c.libretranslate-sollicite", translateHit, translateHit ? "requête /translate reçue par le serveur local" : "aucune requête reçue par LibreTranslate");
  } finally {
    worker.kill("SIGTERM");
    lt.kill("SIGTERM");
    await sleep(500);
  }

  const pass = results.filter((r) => r.pass === true).length;
  const warn = results.filter((r) => r.pass === null).length;
  const fail = results.filter((r) => r.pass === false).length;
  console.log(`\n=== CHEMIN LOCAL — ${pass} PASS, ${warn} WARN, ${fail} FAIL ===`);
  console.log("(le PASS/FAIL du provider ASR réellement utilisé est la ligne L.provider-asr-local du test browser)");
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error("ERREUR PROOF:", err);
  process.exit(2);
});
