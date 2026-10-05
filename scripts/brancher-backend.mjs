#!/usr/bin/env node
/**
 * Prépare le backend Convex local (Docker) et branche le projet dessus.
 *
 * Idempotent : peut être relancé autant de fois que voulu.
 *
 *   1. démarre le conteneur (docker compose up -d)
 *   2. génère une clé admin et l'écrit dans .env.local
 *   3. pousse JWKS / JWT_PRIVATE_KEY / SITE_URL côté serveur Convex
 *   4. pousse le schéma + génère src/convex/_generated
 *   5. rejoue les seeds d'argot
 *
 * Pourquoi un script Node et pas un .cmd : la clé admin contient un « | »,
 * qui est un caractère spécial en batch. Ici, aucune ambiguïté.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Où vit la base Convex locale. Par défaut, le dossier frère du projet :
 * le chemin se déduit de l'emplacement du script, donc le projet reste
 * déplaçable (et le dossier projet a pu être renommé sans casser le
 * démarrage). KILINGO_CONVEX_DIR permet de pointer ailleurs.
 */
const convexDir = process.env.KILINGO_CONVEX_DIR
  ? path.resolve(process.env.KILINGO_CONVEX_DIR)
  : path.resolve(projectDir, "..", "convex-local");

if (!existsSync(path.join(convexDir, "docker-compose.yml"))) {
  console.error(
    `\nBase Convex locale introuvable : ${convexDir}\n` +
      `Attendu : un dossier « convex-local » contenant docker-compose.yml, ` +
      `à côté du projet (ou pointé par KILINGO_CONVEX_DIR).\n`,
  );
  process.exit(1);
}

const CONVEX_URL = "http://127.0.0.1:33210";
const SITE_URL = "http://host.docker.internal:33211";

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: opts.cwd ?? projectDir,
    encoding: "utf8",
    // `shell: true` sur Windows passe par cmd.exe : le `input` n'atteint
    // alors jamais le processus enfant (les variables finissaient VIDE).
    // On n'utilise le shell que pour docker/npx.cmd, jamais pour stdin.
    shell: opts.noShell ? false : true,
    stdio: opts.quiet ? ["pipe", "pipe", "pipe"] : "inherit",
    input: opts.input,
  });
}

const NPM = process.platform === "win32" ? "npx.cmd" : "npx";

function step(n, total, label) {
  console.log(`\n[${n}/${total}] ${label}`);
}

// --- 0. Docker doit tourner -------------------------------------------
step(0, 5, "Vérification de Docker");
try {
  run("docker", ["info", "--format", "{{.ServerVersion}}"], { quiet: true, cwd: convexDir });
} catch {
  console.error(
    "\nDocker Desktop n'est pas lancé.\n" +
      "Ouvre Docker Desktop, attends 'Engine running', puis relance ce script.\n",
  );
  process.exit(1);
}

// --- 1. Backend --------------------------------------------------------
step(1, 5, "Démarrage du backend Convex");
run("docker", ["compose", "up", "-d"], { cwd: convexDir });

// La clé admin est régénérée à chaque recréation du conteneur : on la relit.
step(2, 5, "Clé admin → .env.local");
const keyOut = run(
  "docker",
  ["compose", "exec", "-T", "backend", "./generate_admin_key.sh"],
  { cwd: convexDir, quiet: true },
);
const adminKey = keyOut.trim().split("\n").pop().trim();
if (!adminKey.includes("|")) {
  console.error("Clé admin inattendue :", adminKey);
  process.exit(1);
}

const envPath = path.join(projectDir, ".env.local");
const envBody = [
  `CONVEX_SELF_HOSTED_URL=${CONVEX_URL}`,
  `CONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}`,
  `VITE_CONVEX_URL=${CONVEX_URL}`,
  // VITE_CONVEX_SITE_URL n'est PAS écrit ici : c'est le CLI `convex dev`
  // qui en tient la main dans .env.local. L'écrire aussi créait un doublon
  // (« Found multiple ... environment variables ») et le CLI refusait
  // ensuite de maintenir la valeur.
  "CONVEX_SITE_URL=http://localhost:5173",
  "",
].join("\n");
writeFileSync(envPath, envBody, "utf8");
console.log("   .env.local écrit (clé admin masquée).");

// --- 2. Secrets d'auth Convex -----------------------------------------
// Convex Auth n'est pas supporté par le CLI en self-hosted : ces trois
// variables doivent être poussées à la main, sinon la connexion invité échoue.
step(3, 5, "Secrets d'auth (JWKS / JWT_PRIVATE_KEY / SITE_URL)");
const jwks = readFileSync(path.join(convexDir, "jwks.json"), "utf8").trim();
const privatePem = readFileSync(path.join(convexDir, "jwt_private.pem"), "utf8").trim();
for (const [name, value] of [
  ["JWKS", jwks],
  ["JWT_PRIVATE_KEY", privatePem],
  ["SITE_URL", SITE_URL],
]) {
  // Contrainte Windows mesurée : `npx` ne peut pas être lancé sans shell,
  // et avec shell=true le `input` de execFileSync n'atteint pas l'enfant
  // (la variable finissait VIDE → JWKS sans clé, signature JWT cassée).
  // Le seul chemin fiable ici : écrire dans un fichier puis pipe via bash.
  const tmp = path.join(convexDir, `.env-${name}.tmp`);
  writeFileSync(tmp, value, "utf8");
  try {
    run("bash", ["-c", `cat "${tmp}" | npx convex env set ${name}`], {
      cwd: projectDir,
      quiet: true,
      noShell: true,
    });
    console.log(`   ${name} défini.`);
  } catch (err) {
    console.error(`   ÉCHEC sur ${name} :`, String(err.stdout ?? "").split("\n")[0]);
    process.exit(1);
  } finally {
    rmSync(tmp, { force: true });
  }
}

// Vérification : sans ça, une clé corrompue ne se voit qu'au premier clic.
try {
  const probe = run("curl", ["-s", `${SITE_URL}/.well-known/jwks.json`], {
    quiet: true,
  });
  const parsed = JSON.parse(probe);
  if (!parsed?.keys?.[0]?.n) throw new Error("JWKS sans clé publique");
  console.log("   JWKS servi par le site proxy : OK");
} catch {
  console.error("   ÉCHEC : le site proxy ne sert pas une JWKS exploitable.");
  process.exit(1);
}

// --- 3. Schéma + codegen -----------------------------------------------
step(4, 5, "Schéma Convex + génération des types");
run(NPM, ["convex", "dev", "--once", "--typecheck", "disable"]);

// `convex dev` écrit lui-même VITE_CONVEX_SITE_URL dans .env.local : si le
// script vient d'y écrire la même variable, le fichier se retrouve avec un
// doublon et le CLI refuse ensuite de mettre à jour la valeur
// ("Found multiple ... environment variables"). On déduplique en finissant.
function dedupeEnvFile(file) {
  if (!existsSync(file)) return;
  const seen = new Set();
  const lines = readFileSync(file, "utf8").split("\n");
  const kept = [];
  for (const line of lines) {
    const name = line.split("=")[0]?.trim();
    if (!name || line.trimStart().startsWith("#")) {
      kept.push(line);
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    kept.push(line);
  }
  writeFileSync(file, kept.join("\n"), "utf8");
}
dedupeEnvFile(envPath);

// --- 4. Données --------------------------------------------------------
step(5, 5, "Seeds d'argot");
run(NPM, ["convex", "run", "slang:seed"]);
run(NPM, ["convex", "run", "crossSeed:seedCrossConcepts"]);

console.log("\n✅ Backend prêt.");
console.log(`   Convex   : ${CONVEX_URL}`);
console.log(`   Site/auth: ${SITE_URL}`);
console.log("   App      : http://localhost:5173  (npm run dev)\n");