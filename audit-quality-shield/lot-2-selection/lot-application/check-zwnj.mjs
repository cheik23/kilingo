import { readFileSync } from "node:fs";

const j = JSON.parse(readFileSync("../validation-finale/avant-apres-20-fa.json", "utf8"));
const raw = readFileSync("../../../src/convex/slangSeedEnrichmentFa.ts", "utf8").split(/\r?\n/);
const countZ = (s) => s.split("\u200C").length - 1;

const c = j.candidats.find((x) => x.key === "fa:سه\u200Cسوت (seh soot)");
if (!c) { console.error("candidat سه‌سوت introuvable"); process.exit(1); }
const line = raw[c.ligne - 1];

console.log("ligne", c.ligne);
console.log("ZWNJ expression :", countZ(c.expression));
console.log("ZWNJ literal    :", countZ(c.literal));
console.log("ZWNJ meaning    :", countZ(c.meaning));
console.log("ZWNJ context avant :", countZ(c.context_source));
console.log("ZWNJ context après :", countZ(c.context_propose));
console.log("ZWNJ persan Ex     :", countZ(c.persan));
console.log("ZWNJ total ligne   :", countZ(line));

// Positions réelles des ZWNJ dans la ligne brute
let idx = -1; let n = 0;
while ((idx = line.indexOf("\u200C", idx + 1)) !== -1) {
  n++;
  console.log("ZWNJ #" + n + " à col " + idx + " : ..." + line.slice(Math.max(0, idx - 15), idx + 15) + "...");
}

// Ligne après application simulée : ZWNJ restants
const nouvelle = line.replace(c.context_source, c.context_propose);
console.log("ZWNJ après application simulée :", countZ(nouvelle), "| ligne remplacée trie par trie :", nouvelle !== line);
console.log("diff longueur :", nouvelle.length - line.length, "caractères (élimination du gabarit provenance)");
