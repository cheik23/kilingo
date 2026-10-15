import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const base = join(process.cwd(), 'src/convex');

function countEntries(filePath: string): Map<string, number> {
  const src = readFileSync(filePath, 'utf8');
  let inArray = false;
  let depth = 0;
  const counts = new Map<string, number>();

  for (const line of src.split(/\r?\n/)) {
    const t = line.trim();

    if (!inArray && t.startsWith('export const') && t.includes('[')) {
      inArray = true;
    }
    if (!inArray) continue;

    for (const ch of t) {
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
    }

    if (depth < 0) break;

    if (t.startsWith('{') && t.includes('language:')) {
      const m = t.match(/language:\s*"([^"]+)"/);
      if (m) {
        counts.set(m[1], (counts.get(m[1]) || 0) + 1);
      }
    }
  }

  return counts;
}

function total(counts: Map<string, number>): number {
  return [...counts.values()].reduce((a, b) => a + b, 0);
}

const files: Record<string, string> = {
  'SLANG_SEED_EXTRA (inline)': join(base, 'slangSeed.ts'),
  'SLANG_SEED_AFRICA': join(base, 'slangSeedAfrica.ts'),
  'SLANG_SEED_2025': join(base, 'slangSeed2025.ts'),
  'SLANG_SEED_LOT1': join(base, 'slangSeedLot1.ts'),
  'SLANG_SEED_LOT2': join(base, 'slangSeedLot2.ts'),
};

console.log('=== PER-FILE ENTRY COUNTS ===\n');

let grandTotal = 0;
const grandCounts = new Map<string, number>();

for (const [name, filePath] of Object.entries(files)) {
  let counts: Map<string, number>;

  if (name.includes('inline')) {
    const src = readFileSync(filePath, 'utf8');
    const slugIdx = src.indexOf('export function slangSlug');
    const extraSrc = src.slice(0, slugIdx);
    counts = countEntriesFromSource(extraSrc);
  } else {
    counts = countEntries(filePath);
  }

  const fileTotal = total(counts);
  grandTotal += fileTotal;

  console.log(`${name}: ${fileTotal} entries`);
  console.log('  Languages:', [...counts.keys()].sort().join(', '));

  for (const [lang, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`    ${lang}: ${count}`);
    grandCounts.set(lang, (grandCounts.get(lang) || 0) + count);
  }
  console.log();
}

console.log('=== GRAND TOTAL (merged SLANG_SEED) ===');
console.log(`Total entries: ${grandTotal}`);
console.log(`Languages with content: ${grandCounts.size}`);
console.log('Per-language breakdown (sorted):');
for (const [lang, count] of [...grandCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${lang}: ${count}`);
}

// Check Lot 1 and Lot 2 specifically
console.log('\n=== LOT 1 (de/pt/it) verification ===');
(['de', 'pt', 'it'] as const).forEach(lang => {
  const count = grandCounts.get(lang) || 0;
  console.log(`  ${lang}: ${count} entries ${count > 0 ? '✓ PRESENT' : '✗ MISSING'}`);
});

console.log('\n=== LOT 2 (ko/ja/tr/pl) verification ===');
(['ko', 'ja', 'tr', 'pl'] as const).forEach(lang => {
  const count = grandCounts.get(lang) || 0;
  console.log(`  ${lang}: ${count} entries ${count > 0 ? '✓ PRESENT' : '✗ MISSING'}`);
});

// Duplicates check
console.log('\n=== DUPLICATE CHECK ===');
interface Entry { lang: string; expr: string; }
const allEntries: Entry[] = [];

function* extractEntries(src: string): Generator<Entry> {
  let inArray = false;
  let depth = 0;
  for (const line of src.split(/\r?\n/)) {
    const t = line.trim();
    if (!inArray && t.startsWith('export const') && t.includes('[')) inArray = true;
    if (!inArray) continue;
    for (const ch of t) {
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
    }
    if (depth < 0) break;
    if (t.startsWith('{') && t.includes('language:') && t.includes('expression:')) {
      const lm = t.match(/language:\s*"([^"]+)"/);
      const em = t.match(/expression:\s*"([^"]+)"/);
      if (lm && em) yield { lang: lm[1], expr: em[1] };
    }
  }
}

// EXTRA
{
  const src = readFileSync(join(base, 'slangSeed.ts'), 'utf8');
  const slugIdx = src.indexOf('export function slangSlug');
  for (const e of extractEntries(src.slice(0, slugIdx))) allEntries.push(e);
}
// Others
for (const file of ['slangSeedAfrica.ts', 'slangSeed2025.ts', 'slangSeedLot1.ts', 'slangSeedLot2.ts']) {
  for (const e of extractEntries(readFileSync(join(base, file), 'utf8'))) allEntries.push(e);
}

const seen = new Set<string>();
const dupes: Entry[] = [];
for (const e of allEntries) {
  const key = e.lang + ':' + e.expr.toLowerCase();
  if (seen.has(key)) dupes.push(e);
  seen.add(key);
}

console.log(`Total entries checked: ${allEntries.length}`);
console.log(`Duplicates found: ${dupes.length}`);
if (dupes.length > 0) {
  console.log('Duplicate entries:');
  for (const d of dupes) console.log(`  ${d.lang}: ${d.expr}`);
}

// Helper for inline counting
function countEntriesFromSource(src: string): Map<string, number> {
  let inArray = false;
  let depth = 0;
  const counts = new Map<string, number>();
  for (const line of src.split(/\r?\n/)) {
    const t = line.trim();
    if (!inArray && t.startsWith('export const') && t.includes('[')) inArray = true;
    if (!inArray) continue;
    for (const ch of t) {
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
    }
    if (depth < 0) break;
    if (t.startsWith('{') && t.includes('language:')) {
      const m = t.match(/language:\s*"([^"]+)"/);
      if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
  }
  return counts;
}
