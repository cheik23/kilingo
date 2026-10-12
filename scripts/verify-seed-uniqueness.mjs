#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * ASSERTION — AUCUN SLUG EN DOUBLE DANS LES SEEDS D'ARGOT
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * `slang:seed` déduplique par slug : la première occurrence gagne, les
 * suivantes sont COMPTÉES COMME « skipped » ET JETÉES. Le seed renvoie
 * « success » dans les deux cas. Une collision est donc une perte de données
 * parfaitement silencieuse — une fiche écrite, relue, commitée, jamais servie.
 *
 * Le cas s'est produit au Lot 4 : « Ishi » et « Eshi » sont deux
 * transcriptions du même mot amharique እሺ. Écrites en guèze d'abord, elles
 * produisent un slug identique (« am:እሺ ») ; sans relecture attentive, la
 * seconde fiche aurait disparu en base. Ce script transforme cette vigilance
 * en vérification automatique.
 *
 * CE QU'IL VÉRIFIE, ET COMMENT
 *
 *   • il charge le seed AGRÉGÉ (`slangSeed.ts` → `SLANG_SEED`), c'est-à-dire
 *     exactement ce que `slang:seed` insère — pas une approximation ;
 *   • il importe `slangSlug` DEPUIS LE MODULE RÉEL et calcule les slugs avec
 *     LUI. Aucune copie de la logique ici : une copie dériverait au premier
 *     changement (repli de la parenthèse finale, normalisation Unicode…) et
 *     le test validerait alors une règle qui n'est plus celle du backend ;
 *   • il charge aussi chaque batch (`slangSeed*`) pour dire DANS QUEL FICHIER
 *     chaque conflit a été déclaré — sans quoi la correction commence par une
 *     chasse au fichier.
 *
 * Les fichiers `.ts` sont transpilés à la volée avec le `typescript` du
 * projet (dépendance directe, donc présente en CI) puis importés comme ESM
 * dans un dossier temporaire. Aucun bundler, aucune dépendance ajoutée, rien
 * n'est écrit dans le dépôt.
 *
 * SORTIE : 0 si tous les slugs sont uniques, 1 sinon (avec le détail des
 * conflits). Utilisé tel quel par `npm run verify:seeds` et par la CI.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexDir = path.join(projectDir, "src", "convex");

/** Le module qui agrège tout : c'est LUI que `slang:seed` consomme. */
const AGGREGATE = "slangSeed.ts";

/**
 * Transpile les `slangSeed*.ts` en ESM importables.
 *
 * Deux détails qui comptent :
 *   • `isolatedModules` : transpilation fichier par fichier, sans résolution
 *     de types — c'est tout ce dont on a besoin pour lire des données ;
 *   • les imports relatifs sont suffixés en `.mjs` : Node exige une extension
 *     en ESM, et les sources écrivent `from "./slangSeed"`. Les seeds
 *     n'importent QUE leurs voisins `./slangSeed*`, la réécriture est donc
 *     sans ambiguïté.
 */
function transpileSeeds(seedFiles, outDir) {
  for (const file of seedFiles) {
    const source = readFileSync(path.join(convexDir, file), "utf8");
    const code = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          isolatedModules: true,
        },
      })
      .outputText.replace(/from "(\.\/[A-Za-z0-9_]+)"/g, 'from "$1.mjs"');
    writeFileSync(path.join(outDir, file.replace(/\.ts$/, ".mjs")), code, "utf8");
  }
}

/** Toutes les entrées d'un module, quel que soit le nom de l'export. */
function seedEntriesOf(module) {
  const entries = [];
  for (const value of Object.values(module)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && typeof item === "object" && "language" in item && "expression" in item) {
        entries.push(item);
      }
    }
  }
  return entries;
}

async function main() {
  const seedFiles = readdirSync(convexDir)
    .filter((name) => /^slangSeed.*\.ts$/.test(name))
    .sort();

  if (!seedFiles.includes(AGGREGATE)) {
    console.error(`✗ ${AGGREGATE} introuvable dans src/convex — rien à vérifier.`);
    process.exit(1);
  }

  const workDir = mkdtempSync(path.join(tmpdir(), "kilingo-seed-check-"));
  let aggregate;

  try {
    transpileSeeds(seedFiles, workDir);

    const load = (file) =>
      import(pathToFileURL(path.join(workDir, file.replace(/\.ts$/, ".mjs"))).href);

    const seedModule = await load(AGGREGATE);
    if (typeof seedModule.slangSlug !== "function") {
      console.error("✗ slangSlug n'est pas exporté par slangSeed.ts : la vérification serait fausse.");
      process.exit(1);
    }
    const { slangSlug } = seedModule;
    aggregate = seedModule.SLANG_SEED;

    if (!Array.isArray(aggregate)) {
      console.error("✗ SLANG_SEED n'est pas un tableau : rien à vérifier.");
      process.exit(1);
    }

    // Provenance : quels batches déclarent ce slug ? (l'agrégat n'est pas
    // consulté ici, il ne ferait que se citer lui-même).
    const declaredIn = new Map();
    for (const file of seedFiles) {
      if (file === AGGREGATE) continue;
      for (const entry of seedEntriesOf(await load(file))) {
        const slug = slangSlug(entry.language, entry.expression);
        if (!declaredIn.has(slug)) declaredIn.set(slug, new Set());
        declaredIn.get(slug).add(file);
      }
    }

    const firstSeen = new Map();
    const conflicts = new Map();

    aggregate.forEach((entry, index) => {
      const slug = slangSlug(entry.language, entry.expression);
      const place = { index, language: entry.language, expression: entry.expression };

      const previous = firstSeen.get(slug);
      if (previous === undefined) {
        firstSeen.set(slug, place);
        return;
      }
      if (!conflicts.has(slug)) conflicts.set(slug, [previous]);
      conflicts.get(slug).push(place);
    });

    if (conflicts.size > 0) {
      const lost = [...conflicts.values()].reduce((n, group) => n + group.length - 1, 0);
      console.error(
        `\n✗ ${conflicts.size} slug(s) en collision dans SLANG_SEED — ` +
          `${lost} fiche(s) seraient jetées SILENCIEUSEMENT par slang:seed.\n`,
      );
      for (const [slug, group] of conflicts) {
        const sources = declaredIn.get(slug);
        console.error(`  slug « ${slug} »`);
        for (const place of group) {
          console.error(`    • ${place.language} | ${place.expression}  (index ${place.index})`);
        }
        console.error(
          `    déclaré dans : ${
            sources ? [...sources].sort().join(", ") : `${AGGREGATE} (entrée inline)`
          }\n`,
        );
      }
      console.error(
        "Corriger en fusionnant les fiches (une seule identité par slug) ou en\n" +
          "rendant les écritures distinctes — puis relancer `npm run verify:seeds`.\n",
      );
      process.exit(1);
    }

    console.log(
      `✓ slugs uniques : ${aggregate.length} entrées, ${firstSeen.size} slugs` +
        ` — aucun doublon (slangSlug de ${AGGREGATE}, ${seedFiles.length} fichiers chargés).`,
    );

    /* ── Budget de lectures Convex ───────────────────────────────────────
       Convex plafonne à 4 096 lectures par exécution. Le semis ET le
       recalcul d'agrégats sont donc découpés PAR LANGUE : chaque exécution
       ne lit qu'une partition. Encore faut-il que la plus grosse partition
       tienne sous la limite — c'est exactement ce qui a cassé à la vague 1
       d'enrichissement (le catalogue a franchi 4 100 fiches, et un seed qui
       lisait tout d'un coup s'est mis à échouer). Ce garde-fou le voit au
       moment du contrôle, pas au moment du déploiement. */
    const READ_LIMIT = 4096;
    const READ_MARGIN = 300; // backfill + lectures d'agrégats dans la même transaction
    const perLanguage = new Map();
    for (const entry of aggregate) {
      perLanguage.set(entry.language, (perLanguage.get(entry.language) ?? 0) + 1);
    }
    const [biggestLang, biggestCount] = [...perLanguage.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (biggestCount > READ_LIMIT - READ_MARGIN) {
      console.error(
        `\n✗ « ${biggestLang} » porte ${biggestCount} fiches : une exécution de ` +
          `slang:seed lirait ${biggestCount} lignes (limite Convex ${READ_LIMIT}).\n` +
          "Découper le semis de cette langue (pages d'offset) avant d'enrichir davantage.\n",
      );
      process.exit(1);
    }
    console.log(
      `✓ budget de lecture : plus grosse partition « ${biggestLang} » = ` +
        `${biggestCount} fiches (limite ${READ_LIMIT}, marge ${READ_MARGIN}) — ` +
        "le semis par langue tient.",
    );

    /* ── Le semis doit RESTER découpé ────────────────────────────────────
       Une régression ici ne se verrait qu'à la prochaine remise en route de
       la base (le seed rejouerait tout le catalogue en une transaction). On
       vérifie donc le code, pas la doc : aucun scan de table complète dans
       slang.ts, et le pilote de semis branché sur le bon chemin. */
    const slangSrc = readFileSync(path.join(convexDir, "slang.ts"), "utf8");
    if (/query\("slangExpressions"\)\s*\.collect\(\)/.test(slangSrc)) {
      console.error(
        "\n✗ slang.ts lit toute la table slangExpressions d'un coup " +
          "(query(...).collect()) : la limite de 4096 lectures par exécution\n" +
          "est dépassée dès ~4 100 fiches. Passer par un index par langue.\n",
      );
      process.exit(1);
    }
    const brancher = readFileSync(path.join(projectDir, "scripts", "brancher-backend.mjs"), "utf8");
    if (/"convex",\s*"run",\s*"slang:seed"/.test(brancher)) {
      console.error(
        "\n✗ scripts/brancher-backend.mjs appelle slang:seed sans langue : " +
          "l'appel échoue (le seed exige une langue par exécution).\n" +
          "Utiliser le pilote : node scripts/seed-backend.mjs.\n",
      );
      process.exit(1);
    }
    console.log("✓ semis découpé par langue : aucun scan complet, pilote en place.");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("✗ vérification impossible :", error);
  process.exit(1);
});
