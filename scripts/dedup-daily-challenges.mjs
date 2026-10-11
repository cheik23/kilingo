#!/usr/bin/env node
/**
 * `scripts/dedup-daily-challenges.mjs`
 *
 * Supprime les doublons dans la table Convex `dailyChallenges`.
 *
 * Logique de nettoyage :
 *  - On groupe par `(dayKey, language)` (clé logique du défi du jour).
 *  - Pour chaque groupe, on ne garde que le document le plus récent (par `_id`
 *    / insertion). Les autres sont supprimés.
 *  - Les lignes sans `language` sont ignorées (elles ne participent pas à la
 *    clé logique).
 *
 * Usage :
 *   node scripts/dedup-daily-challenges.mjs
 *
 * Prérequis :
 *   - `CONVEX_DEPLOY_KEY` positionné dans l'environnement (ex. depuis
 *     `.env.production`). Cette clé n'est jamais lue/printée ici ; seul
 *     l'agent de déploiement Convex l'utilise.
 *   - Le projet Convex `formal-vulture-518`.
 *
 * Idempotence : le script est sûr à relancer. Une fois les doublons retirés,
 *   il ne trouve plus rien à supprimer et affiche simplement le compte final.
 */

import { v } from "convex/values";

const siteEnv = process.env.CONVEX_SITE_URL ?? "https://formal-vulture-518.convex.cloud";
const deployKey = process.env.CONVEX_DEPLOY_KEY;

if (!deployKey) {
  console.error(
    "ERREUR : CONVEX_DEPLOY_KEY n'est pas positionné dans l'environnement.\n" +
      "Dans un terminal Windows PowerShell :\n" +
      "  $env:CONVEX_DEPLOY_KEY = (Get-Content .env.production -Raw).Split("=")[1].Trim()\n" +
      "ou dans cmd.exe :\n" +
      '  for /f "delims=" %i in (.env.production) do set CONVEX_DEPLOY_KEY=%i\n' +
      "Puis relance : node scripts/dedup-daily-challenges.mjs\n",
  );
  process.exit(2);
}

// ----------------------------------------------------------------------
// Convex client sans SDK lourd — requêtes HTTP brutes (Convex REST API).
// On utilise le route /api/query pour lire et /api/mutation pour écrire.
// ----------------------------------------------------------------------

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} : ${body.slice(0, 500)}`);
  }
  return res.json();
}

function queryBody(fn, args) {
  return {
    table: "dailyChallenges",
    sql: null,
    predicate: null,
    function: { name: fn, args },
  };
}

async function convexQuery(fn, args) {
  const payload = queryBody(fn, args);
  const body = JSON.stringify(payload);
  const res = await fetchJson(`${siteEnv}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deployKey}`,
    },
    body,
  });
  return res.result;
}

async function convexMutation(fn, args) {
  const payload = { table: "dailyChallenges", sql: null, predicate: null, function: { name: fn, args } };
  const body = JSON.stringify(payload);
  const res = await fetchJson(`${siteEnv}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deployKey}`,
    },
    body,
  });
  const out = (res as any).result;
  if (out === null || out === undefined) {
    throw new Error(`mutation ${fn} a retourné un résultat vide pour les args ${JSON.stringify(args)}`);
  }
  return out;
}

// ----------------------------------------------------------------------
// Étape 1 — compter les documents totaux (pour information).
// ----------------------------------------------------------------------
let totalBefore = 0;
try {
  totalBefore = await convexQuery("countDailyChallenges", {});
} catch (err) {
  console.error("Impossible de compter les dailyChallenges :", err);
  process.exit(3);
}

// ----------------------------------------------------------------------
// Étape 2 — explorer par (dayKey, language). On utilise une requête paginée
//   sur l'index `by_day_language` pour être sûr de balayer tout le tableau
//   sans tenir tout en mémoire si la table grossit.
// ----------------------------------------------------------------------
const BATCH = 256;

interface Row {
  _id: string;
  dayKey: string;
  language: string;
  createdAt?: number;
}

async function streamByDayLanguage(onRow: (row: Row) => void | Promise<void>) {
  let cursor: string | null = null;
  let exhausted = false;
  while (!exhausted) {
    const args: any = { limit: BATCH };
    if (cursor) args.cursor = cursor;
    const rows = await convexQuery("listDailyChallengesByDayLanguage", args) as Row[];
    if (!rows || rows.length === 0) {
      exhausted = true;
      continue;
    }
    for (const row of rows) {
      await onRow(row);
    }
    cursor = (rows[rows.length - 1] as any)._id as string | null;
    exhausted = rows.length < BATCH;
  }
}

// ----------------------------------------------------------------------
// Étape 3 — identifier les doublons et supprimer les plus anciens.
// ----------------------------------------------------------------------
const groups = new Map<string, Row[]>();

await streamByDayLanguage((row) => {
  if (!row.language) return; // sans langue = hors du périmètre de nettoyage
  const key = `${row.dayKey}::${row.language}`;
  const existing = groups.get(key);
  if (existing) {
    existing.push(row);
  } else {
    groups.set(key, [row]);
  }
});

let duplicates = 0;
let kept = 0;

for (const [, rows] of groups) {
  if (rows.length <= 1) {
    kept += rows.length;
    continue;
  }
  // On trie par _id décroissant (approximation de "le plus récent en premier").
  rows.sort((a, b) => (b._id < a._id ? -1 : b._id > a._id ? 1 : 0));
  const keptRow = rows[0];
  kept += 1;
  for (let i = 1; i < rows.length; i += 1) {
    duplicates += 1;
    await convexMutation("deleteDailyChallenge", { challengeId: rows[i]._id }).catch((err) => {
      console.warn("échec suppression de", rows[i]._id, err);
    });
  }
}

// ----------------------------------------------------------------------
// Étape 4 — compteurs finaux.
// ----------------------------------------------------------------------
let totalAfter = 0;
try {
  totalAfter = await convexQuery("countDailyChallenges", {});
} catch (err) {
  console.warn("Impossible de relire le total après nettoyage :", err);
}

console.log("=== Nettoyage doublons dailyChallenges ===");
console.log(`documents avant : ${totalBefore}`);
console.log(`documents après : ${totalAfter}`);
console.log(`groupes (dayKey, language) : ${groups.size}`);
console.log(`doublons supprimés : ${duplicates}`);
console.log(`lignes conservées (uniques) : ${kept}`);
console.log("=== Fin ===");
