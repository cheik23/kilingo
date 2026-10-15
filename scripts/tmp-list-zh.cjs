const fs = require("fs");

function slangSlug(language, expression) {
  const base = expression
    .replace(/\s*\([^()]*\)\s*$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return `${language}:${base}`;
}

const slugs = new Set();
const exprs = [];

// Inline entries in slangSeed.ts
const aggregate = fs.readFileSync("src/convex/slangSeed.ts", "utf8");
const lineRe = /\{\s*language:\s*"zh",\s*expression:\s*"((?:[^"\\]|\\.)*)"/g;
let m;
while ((m = lineRe.exec(aggregate)) !== null) {
  const expr = JSON.parse('"' + m[1] + '"');
  exprs.push(expr);
  slugs.add(slangSlug("zh", expr));
}

// Enrichment file entries
const my = fs.readFileSync("src/convex/slangSeedEnrichmentZh.ts", "utf8");
const blockRe = /\n    expression: "((?:[^"\\]|\\.)*)",/g;
while ((m = blockRe.exec(my)) !== null) {
  const expr = JSON.parse('"' + m[1] + '"');
  exprs.push(expr);
  slugs.add(slangSlug("zh", expr));
}

console.log("total zh expressions:", exprs.length, "unique slugs:", slugs.size);
console.log(JSON.stringify(exprs, null, 0));
