const fs = require('fs');
const path = require('path');

const base = path.join(process.cwd(), 'src/convex');

function countEntries(filePath) {
  const s = fs.readFileSync(filePath, 'utf8');
  let inArray = false, depth = 0;
  const counts = new Map();
  for (const line of s.split(/\r?\n/)) {
    const t = line.trim();
    if (!inArray && t.startsWith('export const') && t.includes('[')) inArray = true;
    if (!inArray) continue;
    for (const ch of t) { if (ch === '[') depth++; else if (ch === ']') depth--; }
    if (depth < 0) break;
    if (t.startsWith('{') && t.includes('language:')) {
      const m = t.match(/language:\s*"([^"]+)"/);
      if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
  }
  return counts;
}

function countEntriesFromSource(src) {
  let inArray = false, depth = 0;
  const counts = new Map();
  for (const line of src.split(/\r?\n/)) {
    const t = line.trim();
    if (!inArray && t.startsWith('export const') && t.includes('[')) inArray = true;
    if (!inArray) continue;
    for (const ch of t) { if (ch === '[') depth++; else if (ch === ']') depth--; }
    if (depth < 0) break;
    if (t.startsWith('{') && t.includes('language:')) {
      const m = t.match(/language:\s*"([^"]+)"/);
      if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
  }
  return counts;
}

function total(c) { return [...c.values()].reduce((a, b) => a + b, 0); }

// EXTRA from slangSeed.ts (before slangSlug)
const seedSrc = fs.readFileSync(path.join(base, 'slangSeed.ts'), 'utf8');
const slugIdx = seedSrc.indexOf('export function slangSlug');
const extraCounts = countEntriesFromSource(seedSrc.slice(0, slugIdx));

const africaCounts = countEntries(path.join(base, 'slangSeedAfrica.ts'));
const seed2025Counts = countEntries(path.join(base, 'slangSeed2025.ts'));
const lot1Counts = countEntries(path.join(base, 'slangSeedLot1.ts'));
const lot2Counts = countEntries(path.join(base, 'slangSeedLot2.ts'));

const all = new Map(extraCounts);
[[africaCounts], [seed2025Counts], [lot1Counts], [lot2Counts]].forEach(c => {
  for (const [k, v] of c) all.set(k, (all.get(k) || 0) + v);
});

console.log('=== MERGED SLANG_SEED (actual) ===');
const sorted = [...all.entries()].sort((a, b) => a[0].localeCompare(b[0]));
sorted.forEach(([k, v]) => console.log('  ' + k + ': ' + v));
console.log('Total languages: ' + all.size);
console.log('Total entries: ' + total(all));

console.log('');
console.log('=== EXPECTED SET (from slang.ts dev check) ===');
const expected = ['en', 'zh', 'es', 'ar', 'ru', 'sw', 'ln', 'ha', 'yo', 'zu', 'wo', 'de', 'pt', 'it', 'ko', 'ja', 'tr', 'pl', 'fr'];
let allPresent = true;
expected.forEach(c => {
  const present = all.has(c);
  if (!present) allPresent = false;
  console.log('  ' + c + ': ' + (present ? all.get(c) + ' √' : 'MISSING X'));
});
console.log('Expected count: ' + expected.length);

console.log('');
console.log('=== RESULT ===');
if (allPresent && all.size === expected.length) {
  console.log('ALL 19 EXPECTED LANGUAGES PRESENT IN SLANG_SEED');
} else {
  console.log('DISCREPANCY FOUND');
  console.log('Missing from expected:');
  for (const code of expected) {
    if (!all.has(code)) console.log('  ' + code + ' MISSING');
  }
  console.log('Extra in seed not in expected:');
  for (const [k, v] of sorted) {
    if (!expected.includes(k)) console.log('  ' + k + ': ' + v);
  }
}
