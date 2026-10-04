/**
 * Extraction directe d'objets git (sans commande git, lecture seule).
 * Objectif : récupérer src/components/learner/MemoryView.tsx depuis
 * le commit 2ecc7ee0a24caee4aba7413257c999d0fa83a6cb (parent du commit
 * de nettoyage qui l'a supprimé).
 *
 * Usage : bun scripts/extract-memory-view.mjs [chemin>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const START_COMMIT = "2ecc7ee0a24caee4aba7413257c999d0fa83a6cb";
const TARGET_PATH = process.argv[2] ?? "src/components/learner/MemoryView.tsx";
const OUT_PATH = process.argv[3] ?? null; // si fourni : écrit le blob à cet emplacement

function readObject(sha) {
  const path = `.git/objects/${sha.slice(0, 2)}/${sha.slice(2)}`;
  const raw = inflateSync(readFileSync(path));
  const nul = raw.indexOf(0);
  const header = raw.subarray(0, nul).toString(); // ex: "commit 312" | "tree 102" | "blob 20400"
  const [type, size] = header.split(" ");
  return { type, size: Number(size), body: raw.subarray(nul + 1) };
}

/** Résout un chemin ("src/a/b.tsx") dans un arbre, en suivant les sous-arbres. */
function resolvePath(treeSha, segments) {
  let tree = readObject(treeSha);
  if (tree.type !== "tree") throw new Error(`attendu tree, reçu ${tree.type}`);
  for (let i = 0; i < segments.length; i++) {
    const body = tree.body; // Buffer — parsing strictement par octets
    let pos = 0;
    let found = null;
    while (pos < body.length) {
      const sp = body.indexOf(0x20, pos); // espace
      const nul = body.indexOf(0x00, sp); // NUL
      const name = body.subarray(sp + 1, nul).toString("utf8");
      const sha = body.subarray(nul + 1, nul + 21).toString("hex");
      pos = nul + 21;
      if (name === segments[i]) {
        found = { sha };
        break;
      }
    }
    if (!found) return null;
    const obj = readObject(found.sha);
    if (i === segments.length - 1) {
      if (obj.type !== "blob") throw new Error(`attendu blob, reçu ${obj.type}`);
      return obj.body.toString();
    }
    if (obj.type !== "tree") return null;
    tree = obj;
  }
  return null;
}

const commit = readObject(START_COMMIT);
const treeMatch = /^tree ([0-9a-f]{40})/m.exec(commit.body.toString());
if (!treeMatch) throw new Error("arbre racine introuvable dans le commit");
const rootTree = treeMatch[1];

console.error(`[extract] commit ${START_COMMIT.slice(0, 8)} — tree ${rootTree.slice(0, 8)}`);
const content = resolvePath(rootTree, TARGET_PATH.split("/"));
if (content === null) {
  console.error(`[extract] ${TARGET_PATH} INTROUVABLE dans ce commit`);
  process.exit(1);
}
console.error(`[extract] ${TARGET_PATH} — ${content.length} octets récupérés`);
if (OUT_PATH) {
  writeFileSync(OUT_PATH, content);
  console.error(`[extract] restauré → ${OUT_PATH}`);
} else {
  process.stdout.write(content);
}
