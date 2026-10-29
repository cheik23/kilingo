#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   RECETTE PREVIEW KILINGO — P0.3.9

   Rejoue automatiquement sur la Preview Convex isolée ce qui avait été
   validé à la main en P0.3.8 : garde-fous de destination, disponibilité,
   authentification OTP réelle, découverte, favoris, SRS (dont le rejet
   d'un `expectedLastReview` périmé et l'idempotence des sessions), et
   verrouillage des fonctions internes.

   Aucune dépendance : Node >= 20 (fetch natif). Aucun secret n'est
   journalisé : ni OTP, ni jeton, ni mot de passe de boîte.

   Usage :
     node scripts/verify-preview.mjs                 # recette complète
     node scripts/verify-preview.mjs --api-only      # sans navigateur Vercel
     node scripts/verify-preview.mjs --json out.json # reçu machine

   Variables (voir docs/recette-preview.md) :
     PREVIEW_BASE_URL       URL de la Preview Vercel
     PREVIEW_CONVEX_URL     URL du backend Convex Preview
     PREVIEW_TEST_EMAIL     compte de test (OTP réel)
     MAILTM_API_TOKEN       jeton mail.tm (ou MAILTM_ADDRESS + MAILTM_PASSWORD)
     VERCEL_AUTOMATION_BYPASS_SECRET  bypass Vercel (facultatif, UI seulement)
     PREVIEW_ALLOW_LOCAL=1  autorise explicitement 127.0.0.1/localhost

   Codes de sortie : 0 = tout passe · 1 = échec · 2 = garde-fou refusé
                     3 = bloqué (Preview inaccessible / auth indisponible)
   ═══════════════════════════════════════════════════════════════════════ */

import { writeFileSync } from "node:fs";

import { loadLocalPreviewEnv } from "./preview/load-local-env.mjs";
import {
  assertPreviewBackendUrl,
  assertPreviewUrl,
} from "./preview/preview-hosts.mjs";

// Variables locales de la recette (fichier ignoré par Git), avant toute
// lecture de `process.env` par les constantes ci-dessous. En CI, le fichier
// est absent : les secrets Actions restent seuls en jeu.
loadLocalPreviewEnv();

const DEFAULTS = {
  baseUrl: "https://kilingo-50xuh7gpo-g-c35c.vercel.app",
  convexUrl: "https://neat-wombat-556.convex.cloud",
};

const OTP_TIMEOUT_MS = Number(process.env.PREVIEW_OTP_TIMEOUT_MS ?? 120_000);
const HTTP_TIMEOUT_MS = Number(process.env.PREVIEW_HTTP_TIMEOUT_MS ?? 20_000);

const args = process.argv.slice(2);
const API_ONLY = args.includes("--api-only");
const NO_AUTH = args.includes("--no-auth");
let authConfigMissing = false;
let blockReason = null;
const JSON_OUT = (() => {
  const i = args.indexOf("--json");
  return i >= 0 ? args[i + 1] : null;
})();

const results = [];

/* ── Sortie ───────────────────────────────────────────────────────── */

const PASS = "PASS";
const FAIL = "FAIL";
const SKIP = "SKIP";

function record(status, name, detail = "") {
  results.push({ status, name, detail });
  const tag = status.padEnd(4);
  console.log(`${tag} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    record(PASS, name, typeof detail === "string" ? detail : "");
    return true;
  } catch (error) {
    record(FAIL, name, clean(error));
    return false;
  }
}

function clean(error) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Request ID: [a-f0-9]+/gi, "Request ID: …")
    .replace(/\s+/g, " ")
    .slice(0, 320);
}

class GuardError extends Error {}
class BlockedError extends Error {}

function invariant(condition, message) {
  if (!condition) throw new GuardError(message);
}

/* ── HTTP / Convex ─────────────────────────────────────────────────── */

async function request(url, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

async function postJson(url, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  let json = null;
  try {
    json = JSON.parse(res.text);
  } catch {
    /* réponse non JSON : gérée par l'appelant */
  }
  return { ...res, json };
}

function assertPreviewTargets() {
  const baseRaw = process.env.PREVIEW_BASE_URL ?? DEFAULTS.baseUrl;
  const isLocal = ["127.0.0.1", "localhost", "[::1]"].includes(
    (() => {
      try {
        return new URL(baseRaw).hostname;
      } catch {
        return "";
      }
    })(),
  );

  let base;
  if (isLocal) {
    invariant(
      process.env.PREVIEW_ALLOW_LOCAL === "1",
      "URL locale refusée sans PREVIEW_ALLOW_LOCAL=1",
    );
    base = new URL(baseRaw);
  } else {
    // Liste blanche partagée (P0.3.11). L'hôte immuable du déploiement n'est
    // accepté que si le workflow CI l'a validé (`PREVIEW_CI=1`).
    base = assertPreviewUrl(baseRaw, {
      allowDeploymentHost: process.env.PREVIEW_CI === "1",
    });
  }

  const convex = assertPreviewBackendUrl(process.env.PREVIEW_CONVEX_URL ?? DEFAULTS.convexUrl);

  invariant(base.hostname !== convex.hostname, "URL frontend et backend identiques");

  return { base, convex };
}

/* ── Client Convex ─────────────────────────────────────────────────── */

function makeConvex(convexUrl) {
  return async function call(kind, path, callArgs = {}, token) {
    const res = await postJson(
      `${convexUrl}/api/${kind}`,
      { path, args: callArgs, format: "json" },
      token,
    );
    const payload = res.json;
    if (!payload) {
      throw new Error(`HTTP ${res.status} sans corps JSON pour ${path}`);
    }
    if (payload.status !== "success") {
      throw new Error(`${path} → ${payload.errorMessage ?? "erreur inconnue"}`);
    }
    return payload.value;
  };
}

/* ── Boîte de test (mail.tm) ───────────────────────────────────────── */

const MAIL_API = "https://api.mail.tm";

async function mailToken() {
  if (process.env.MAILTM_API_TOKEN) return process.env.MAILTM_API_TOKEN;
  const address = process.env.MAILTM_ADDRESS;
  const password = process.env.MAILTM_PASSWORD;
  if (!address || !password) return null;
  const res = await postJson(`${MAIL_API}/token`, { address, password });
  if (res.status !== 200 || !res.json?.token) {
    throw new Error(`mail.tm : authentification refusée (HTTP ${res.status})`);
  }
  return res.json.token;
}

/** L'API mail.tm renvoie tantôt un tableau brut, tantôt `hydra:member`. */
function mailList(json) {
  if (Array.isArray(json)) return json;
  return json?.["hydra:member"] ?? [];
}

async function listMailIds(token) {
  const res = await request(`${MAIL_API}/messages?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) throw new Error(`mail.tm : liste HTTP ${res.status}`);
  const json = JSON.parse(res.text);
  return new Set(mailList(json).map((m) => m.id));
}

async function readMail(token, id) {
  const res = await request(`${MAIL_API}/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) return null;
  return JSON.parse(res.text);
}

function extractCode(message) {
  const body = [message?.text, ...(message?.html ?? []).map((h) => h.value)]
    .filter(Boolean)
    .join("\n")
    .replace(/<[^>]+>/g, " ");
  const match = body.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

async function waitForOtp(token, seenIds, since) {
  const deadline = Date.now() + OTP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await request(`${MAIL_API}/messages?page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 200) {
      const list = mailList(JSON.parse(res.text));
      for (const summary of list) {
        if (seenIds.has(summary.id)) continue;
        if (new Date(summary.createdAt).getTime() < since - 60_000) continue;
        const full = await readMail(token, summary.id);
        const code = extractCode(full);
        if (code) return code;
      }
    }
    await new Promise((r) => setTimeout(r, 4_000));
  }
  throw new BlockedError(
    "aucun code OTP reçu dans le délai — vérifier MAILTM_* et la boîte de test",
  );
}

/* ── Phases ────────────────────────────────────────────────────────── */

async function run() {
  console.log("=== RECETTE PREVIEW KILINGO (P0.3.9) ===\n");

  let targets;
  try {
    targets = assertPreviewTargets();
    record(
      PASS,
      "gardes.cibles",
      `frontend=${targets.base.origin} · backend=${targets.convex.origin}`,
    );
  } catch (error) {
    record(FAIL, "gardes.cibles", clean(error));
    return finish(2);
  }

  const baseUrl = targets.base.origin;
  const convexUrl = targets.convex.origin;
  const call = makeConvex(convexUrl);

  /* 1 — Disponibilité backend */
  const version = await step("backend.version", async () => {
    const res = await request(`${convexUrl}/version`);
    invariant(res.status === 200 && res.text.trim().length > 0, `HTTP ${res.status}`);
    return res.text.trim().slice(0, 80);
  });

  /* 2 — Authentification OTP réelle */
  const email = process.env.PREVIEW_TEST_EMAIL?.trim();
  let token = null;
  let mail = null;

  if (!version) {
    record(SKIP, "auth.otp", "backend injoignable");
  } else if (!email) {
    record(SKIP, "auth.otp", "PREVIEW_TEST_EMAIL absent");
    if (!NO_AUTH) authConfigMissing = true;
  } else {
    const authOk = await step("auth.otp", async () => {
      mail = await mailToken();
      invariant(mail, "MAILTM_API_TOKEN ou MAILTM_ADDRESS/MAILTM_PASSWORD requis");

      const seen = await listMailIds(mail);
      const since = Date.now();

      await call("action", "auth:signIn", {
        provider: "email-otp",
        params: { email },
      });

      const code = await waitForOtp(mail, seen, since);
      const signed = await call("action", "auth:signIn", {
        provider: "email-otp",
        params: { email, code },
      });
      token = signed?.tokens?.token ?? null;
      invariant(token, "aucun jeton renvoyé après validation du code");
      return `code reçu et validé pour ${email.replace(/^(.{2}).*(@.*)$/, "$1***$2")}`;
    });

    if (authOk) {
      await step("auth.session", async () => {
        const user = await call("query", "users:currentUser", {}, token);
        invariant(user && typeof user._id === "string", "currentUser vide");
        return `compte ${user._id.slice(0, 8)}…`;
      });
    }
  }

  /* 3 — Découverte */
  let stable = null;
  if (!token) {
    record(SKIP, "decouverte.deck", "session indisponible");
  } else {
    await step("decouverte.deck", async () => {
      const items = await call(
        "query",
        "slang:discoveryDeck",
        { language: "en", limit: 12 },
        token,
      );
      invariant(Array.isArray(items) && items.length > 0, "deck vide");
      stable =
        items.find((x) => x.expression === "6-7") ??
        items.find((x) => x.expression === "no cap") ??
        items[0];
      invariant(stable?._id, "expression sans identifiant");
      return `${items.length} expressions · témoin « ${stable.expression} »`;
    });
  }

  /* 4 — Favoris (aller-retour, état rendu à l'identique) */
  if (!token || !stable) {
    record(SKIP, "favoris.aller-retour", "session ou expression témoin indisponible");
  } else {
    await step("favoris.aller-retour", async () => {
      const favorites = await call("query", "favorites:favoriteSlangIds", {}, token);
      if (favorites.includes(stable._id)) {
        await call("mutation", "favorites:toggleSlangFavorite", { slangId: stable._id }, token);
      }
      const added = await call(
        "mutation",
        "favorites:toggleSlangFavorite",
        { slangId: stable._id },
        token,
      );
      invariant(added?.favorite === true, "le favori n'a pas été créé");
      const list = await call("query", "favorites:favoriteSlangIds", {}, token);
      invariant(list.includes(stable._id), "favori absent de favoriteSlangIds");
      const joined = await call(
        "query",
        "favorites:mySlangFavorites",
        { language: "en" },
        token,
      );
      invariant(
        joined.some((row) => row.slang._id === stable._id),
        "favori absent de mySlangFavorites (jointure)",
      );
      const removed = await call(
        "mutation",
        "favorites:toggleSlangFavorite",
        { slangId: stable._id },
        token,
      );
      invariant(removed?.favorite === false, "le favori n'a pas été retiré");
      return "ajout, jointure et retrait vérifiés";
    });
  }

  /* 5 — SRS : carte, révision, CAS périmé, session idempotente, nettoyage */
  if (!token || !stable) {
    record(SKIP, "srs.cycle", "session ou expression témoin indisponible");
  } else {
    await step("srs.carte-et-revue", async () => {
      // Le compte de test est dédié : on repart d'un état connu pour CE témoin.
      await call("mutation", "learning:removeFromSrs", { slangId: stable._id }, token);
      const added = await call("mutation", "learning:addToSrs", { slangId: stable._id }, token);
      invariant(added?.ok === true, `addToSrs → ${JSON.stringify(added)}`);

      const deck = await call("query", "learning:myDeck", {}, token);
      const entry = deck.find((row) => row.slang._id === stable._id);
      invariant(entry, "carte absente de myDeck après addToSrs");
      const card = entry.card;
      const expected = card.lastReview ?? null;

      const review = await call(
        "mutation",
        "learning:reviewCardMutation",
        { cardId: card._id, rating: "good", expectedLastReview: expected },
        token,
      );
      invariant(review?.intervalDays >= 1, "intervalle non repoussé");
      invariant(review?.xpGain > 0, "aucun XP accordé");
      invariant(review?.status !== "new", "statut non avancé");

      let staleRejected = false;
      try {
        await call(
          "mutation",
          "learning:reviewCardMutation",
          { cardId: card._id, rating: "good", expectedLastReview: expected },
          token,
        );
      } catch (error) {
        staleRejected = /stale_review/.test(String(error));
      }
      invariant(staleRejected, "la révision périmée n'a pas été refusée");

      const sessionKey = `e2e-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      const sessionArgs = {
        language: "en",
        kind: "srs",
        durationSeconds: 45,
        itemsLearned: 1,
        sessionKey,
      };
      const first = await call("mutation", "learning:recordSession", sessionArgs, token);
      const second = await call("mutation", "learning:recordSession", sessionArgs, token);
      invariant(
        first.xpGain === second.xpGain && first.streak === second.streak,
        "session rejouée : XP/streak différents (idempotence rompue)",
      );

      await call("mutation", "learning:removeFromSrs", { slangId: stable._id }, token);
      const after = await call("query", "learning:myDeck", {}, token);
      invariant(
        !after.some((row) => row.slang._id === stable._id),
        "carte non nettoyée après removeFromSrs",
      );

      return `intervalle ${review.intervalDays} j · statut ${review.status} · XP ${review.xpGain} · session dédupliquée`;
    });
  }

  /* 6 — Verrous des fonctions protégées */
  await step("securite.fonctions-internes", async () => {
    const internals = [
      "slang:seed",
      "ovAdmin:bootstrapAdmin",
      "aiCharacters:seedAiCharacters",
      "crossSeed:seedCrossConcepts",
      "achievements:seed",
    ];
    for (const path of internals) {
      const res = await postJson(`${convexUrl}/api/mutation`, {
        path,
        args: {},
        format: "json",
      });
      invariant(
        /Could not find public function/.test(res.json?.errorMessage ?? ""),
        `${path} est exposée publiquement`,
      );
    }
    return `${internals.length} mutations internes non exposées`;
  });

  await step("securite.catalogue-anonyme", async () => {
    const catalog = await postJson(`${convexUrl}/api/mutation`, {
      path: "customizationCatalog:seedCatalog",
      args: {},
      format: "json",
    });
    invariant(
      /Not signed in/.test(catalog.json?.errorMessage ?? ""),
      "seedCatalog accepte un appel anonyme",
    );
    return "seedCatalog refuse un client anonyme";
  });

  /* Propriétaire d'un job média : deux identités, un job, aucune écriture
     croisée. Un job vide est créé puis supprimé par le compte de test ;
     seul le compte anonyme (jetable) subsiste, sans donnée métier. */
  if (!token) {
    record(SKIP, "securite.proprietaire-job", "session indisponible");
  } else {
    await step("securite.proprietaire-job", async () => {
      const runId = Date.now().toString(36);
      const created = await call(
        "mutation",
        "mediaJobs:create",
        {
          title: `e2e-p039-${runId}`,
          sourceUrl: `https://example.com/e2e-${runId}.mp3`,
        },
        token,
      );
      invariant(created?.jobId, "job non créé");

      try {
        const owned = await call(
          "mutation",
          "mediaJobs:seedCache",
          { id: created.jobId, entries: [] },
          token,
        );
        invariant(owned !== undefined, "seedCache propriétaire sans réponse");

        const anon = await call("action", "auth:signIn", { provider: "anonymous" });
        const anonToken = anon?.tokens?.token;
        invariant(anonToken, "seconde identité indisponible");
        let foreignRejected = false;
        try {
          await call(
            "mutation",
            "mediaJobs:seedCache",
            { id: created.jobId, entries: [] },
            anonToken,
          );
        } catch (error) {
          foreignRejected = /introuvable pour ce compte/i.test(String(error));
        }
        invariant(foreignRejected, "un autre compte peut écrire dans le job");
        return "job vide créé, écriture propriétaire acceptée, écriture étrangère refusée";
      } finally {
        await call("mutation", "mediaJobs:remove", { id: created.jobId }, token).catch(
          () => undefined,
        );
      }
    });
  }

  /* 7 — Shadow : quota lu depuis le backend Preview */
  if (!token) {
    record(SKIP, "shadow.quota", "session indisponible");
  } else {
    await step("shadow.quota", async () => {
      const quota = await call("query", "premium:getShadowQuota", {}, token);
      invariant(typeof quota?.remaining === "number", "quota sans `remaining`");
      invariant(
        typeof quota?.limit === "number" || quota?.unlimited === true,
        "quota sans `limit` exploitable",
      );
      const limit = quota.unlimited ? "∞" : quota.limit;
      return `reste ${quota.remaining}/${limit} · fuseau ${quota.timezone}`;
    });
  }

  /* 8 — Frontend hébergé : cible réelle du bundle (bypass Vercel requis) */
  if (API_ONLY) {
    record(SKIP, "ui.frontend-heberge", "--api-only : non exécuté");
  } else {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const headers = bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {};

    const page = await request(`${baseUrl}/`, { headers });
    if (page.status === 301 || page.status === 302 || page.status === 307) {
      const location = page.headers.get("location") ?? "";
      if (/sso-api|vercel\.com\/sso/.test(location)) {
        blockReason =
          "Vercel SSO (302) — définir VERCEL_AUTOMATION_BYPASS_SECRET (Protection Bypass for Automation)";
        record("SKIP", "ui.frontend-heberge", blockReason);
        return finish(3);
      }
      record(FAIL, "ui.frontend-heberge", `redirection inattendue vers ${location.slice(0, 80)}`);
      return finish(1);
    }
    if (page.status !== 200) {
      record(FAIL, "ui.frontend-heberge", `page HTTP ${page.status}`);
      return finish(1);
    }

    await step("ui.frontend-heberge", async () => {
      const script = page.text.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];
      invariant(script, "bundle principal introuvable dans le HTML");
      const bundleUrl = new URL(script, baseUrl).toString();
      const bundle = await request(bundleUrl, { headers });
      invariant(bundle.status === 200, `bundle HTTP ${bundle.status}`);
      const convexHost = new URL(convexUrl).hostname;
      invariant(
        bundle.text.includes(convexHost),
        `le bundle ne référence pas ${convexHost}`,
      );
      for (const forbidden of ["formal-vulture-518.convex.cloud", "impartial-pony-692.convex.cloud"]) {
        invariant(
          !bundle.text.includes(forbidden),
          `le bundle référence une cible interdite (${forbidden})`,
        );
      }
      const auth = await request(`${baseUrl}/auth`, { headers });
      invariant(auth.status === 200, `/auth HTTP ${auth.status}`);
      return `bundle lié à ${convexHost} · /auth 200`;
    });
  }

  return finish(0);
}

function finish(exitCode) {
  const pass = results.filter((r) => r.status === PASS).length;
  const fail = results.filter((r) => r.status === FAIL).length;
  const skip = results.filter((r) => r.status === SKIP).length;
  if (exitCode === 0 && fail > 0) exitCode = 1;
  if (exitCode === 0 && authConfigMissing) {
    exitCode = 3;
    blockReason = "PREVIEW_TEST_EMAIL manquant (ou --no-auth pour un contrôle partiel)";
  }
  console.log(`\n=== BILAN : ${pass} PASS · ${fail} FAIL · ${skip} SKIP ===`);

  if (JSON_OUT) {
    writeFileSync(
      JSON_OUT,
      JSON.stringify({ at: new Date().toISOString(), results, exitCode }, null, 2),
    );
    console.log(`reçu : ${JSON_OUT}`);
  }
  if (exitCode === 2) console.log("Garde-fou : cible refusée, aucune requête d'écriture.");
  if (exitCode === 3) console.log(`Recette bloquée : ${blockReason ?? "voir docs/recette-preview.md"}`);
  return exitCode;
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`ERREUR DRIVER : ${clean(error)}`);
    process.exitCode = 1;
  });
