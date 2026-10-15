const fs = require('fs');

function countEntries(path) {
  const src = fs.readFileSync(path, 'utf8');
  // Compter les lignes qui commencent par { language: ... dans un array
  const lines = src.split(/\r?\n/);
  let count = 0;
  let inArray = false;
  let braceDepth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('export const') && trimmed.includes('[')) {
      inArray = true;
    }
    if (inArray) {
      if (trimmed.startsWith('{') && trimmed.includes('language:')) {
        count++;
      }
    }
  }
  return count;
}

const files = [
  'src/convex/slangSeedAfrica.ts',
  'src/convex/slangSeed2025.ts',
  'src/convex/slangSeedLot1.ts',
  'src/convex/slangSeedLot2.ts',
];

let grandTotal = 0;
const byLang = new Map();

for (const file of files) {
  const count = countEntries(file);
  grandTotal += count;
  console.log(`${file.padEnd(35)} ${count} entries`);
}

// Lire le fichier agrégé SLANG_SEED
const seedPath = 'src/convex/slangSeed.ts';
const seedSrc = fs.readFileSync(seedPath, 'utf8');
const seedStart = seedSrc.indexOf('export const SLANG_SEED');
const seedBodyStart = seedSrc.indexOf('[', seedStart);
let i = seedBodyStart + 1, depth = 1;
while (depth > 0 && i < seedSrc.length) {
  const ch = seedSrc[i];
  if (ch === '[') depth += 1;
  else if (ch === ']') depth -= 1;
  i++;
}
const seedBody = seedSrc.slice(seedBodyStart + 1, i - 1);
const seedLines = seedBody.split(/\r?\n/);
let seedCount = 0;
for (const line of seedLines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('{') && trimmed.includes('language:')) {
    const m = trimmed.match(/language:\s*"([^"]+)"/);
    if (m) {
      byLang.set(m[1], (byLang.get(m[1]) ?? 0) + 1);
      seedCount++;
    }
  }
}

console.log('\nSLANG_SEED agrégé:');
console.log(`  total: ${seedCount} expressions`);
console.log(`  langues: ${byLang.size}`);
console.log('  par langue:');
for (const [lang, c] of [...byLang.entries()].sort((a,b) => a[0].localeCompare(b[0]))) {
  console.log(`    ${lang.padEnd(4)}: ${c}`);
}
console.log(`\ngrand_total (addition des fichiers): ${grandTotal}`);
