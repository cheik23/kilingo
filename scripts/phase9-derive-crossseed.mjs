import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import ts from 'typescript';

const CONV = path.resolve(process.cwd(), 'src/convex');

// ── Transpile + import (même mécanique que verify-seed-uniqueness.mjs) ─────
function transpile(src, file, out) {
  const code = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true },
  }).outputText.replace(/("[.\/]+slangSeed[A-Za-z0-9_\.]*)"/g, (m, p1) => `${p1.replace(/\.ts$/, '')}.mjs"`);
  writeFileSync(path.join(out, file.replace(/\.ts$/, '.mjs')), code, 'utf8');
}

const work = mkdtempSync(path.join(tmpdir(), 'xseed-'));
const files = readdirSync(CONV).filter(n => /^slangSeed.*\.ts$/.test(n)).sort();
for (const f of files) transpile(readFileSync(path.join(CONV, f), 'utf8'), f, work);
const mod = await import(pathToFileURL(path.join(work, 'slangSeed.mjs')).href);
const slangSeed = [...mod.SLANG_SEED];

// ── Config : langues déjà couvertes par le RAW d'origine (8) ───────────────
const COVERED = new Set(['en', 'fr', 'ha', 'ln', 'sw', 'wo', 'yo', 'zu']);

// ── Concepts : signaux français dérivés du vocabulaire du RAW existant ────
// (labels_fr + gloses FR des entrées déjà en RAW ; synonymes placés
//  explicitement ici, la DONNÉE n'a jamais été inventée : on ne fait
//  qu'interroger le champ meaning/literal FR du catalogue.)
const CONCEPTS = {
  argent: ['argent', 'fric', 'monnaie', 'cash', 'money', 'sous'],
  fauche: ['fauché', 'pauvre', 'broke', 'sans argent', 'sans un sou'],
  ami: ['ami', 'pote', 'copain', 'frère', 'bestie', 'friend', 'bro'],
  probleme: ['problème', 'galère', 'souci', 'embrouille', 'malheur', 'drame'],
  fete: ['fête', 'pétard', 'soirée', 'teuf', 'ambiance', 'célébration', 'party'],
  police: ['police', 'flic', 'keuf'],
  quartier: ['quartier', 'cité', 'rue', 'hood'],
  cool: ['cool', 'tranquille', 'génial', 'super', 'top', 'stylé'],
  danse: ['danse', 'dancing', 'danser', 'dansè'],
  genre: ['rap', 'musique', 'hip-hop', 'hip hop', 'genre musical', 'freestyle'],
  plat: ['rue', 'street food', 'manger', 'plat', 'bouffe', 'resto', 'nourriture'],
  amour: ['amour', 'cœur', 'love', 'romance', 'aimer'],
  hustle: ['hustle', 'bosse', 'démène', 'débrouille', 'business', 'grind'],
  salutation: ['salut', 'bonjour', 'saluer', 'greeting', 'bienvenue', 'ça va', 'comment vas-tu'],
  merci: ['merci', 'gratitude', 'grateful'],
  adieu: ['au revoir', 'adieu', 'bye'],
  exclamation: ['surprise', 'incroyable', 'exclamation', 'ah', 'wow'],
  famille: ['famille', 'parents', 'family', 'sibling'],
  respect: ['respect', 'honneur', 'pudeur', 'honte'],
  dieu: ['dieu', 'destin', 'allah', 'prière', 'divin'],
};

// nommage ang极管 : subcorpus
const fold = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

//Indices de mots entiers (ASCII) — évite « bon » dans « bonbon »
const hits = (text, signals) => {
  const f = fold(text);
  for (const s of signals) {
    const fs = fold(s);
    const re = new RegExp(`(^|[^a-z])${fs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    if (re.test(f)) return s;
  }
  return null;
};

// malgré doublon d'un concept via mêmes expressions
const usedExpr = new Set(); // lang|expr
const out = []; // lignes ajoutées
const stats = new Map();

const entries = slangSeed.filter(e => COVERED.has(e.language) === false);

// classement par score : signal le plus « centré » s'il est au début de meaning
for (const [slug, signals] of Object.entries(CONCEPTS)) {
  const cands = [];
  for (const e of entries) {
    const hitM = e.meaning && hits(e.meaning, signals);
    const hitL = e.literal && hits(e.literal, signals);
    if (!hitM && !hitL) continue;
    const text = hitM ? e.meaning : e.literal;
    // bonus si le signal est proche du début (plus on entre au cœur du texte)
    const pos = fold(text).length ? fold(text).indexOf(fold(hitM ?? hitL)) / fold(text).length : 1;
    cands.push({ e, score: (e.popularity ?? 60) - pos * 20 - text.length * 0.005 });
  }
  cands.sort((a, b) => b.score - a.score);
  const perLang = new Map();
  const taken = [];
  for (const { e } of cands) {
    const key = e.language + '|' + e.expression;
    if (usedExpr.has(key)) continue;
    if ((perLang.get(e.language) ?? 0) >= 3) continue;
    perLang.set(e.language, (perLang.get(e.language) ?? 0) + 1);
    usedExpr.add(key);
    let gloss = e.meaning ?? e.literal ?? '';
    if (gloss.length > 140) {
      const cut = gloss.slice(0, 140);
      gloss = cut.slice(0, cut.lastIndexOf(' ')) + '…';
    }
    taken.push(e);
    out.push(`${slug}|${e.language}|${e.expression}|${gloss}`);
    stats.set(e.language, (stats.get(e.language) ?? 0) + 1);
  }
}

writeFileSync(path.join(work, 'cross-add-raw.txt'), out.join('\n'), 'utf8');
console.log('lignes générées:', out.length);
console.log('par langue:', Object.fromEntries([...stats.entries()].sort().map(([k, v]) => [k, v])));
console.log('fichier:', path.join(work, 'cross-add-raw.txt'));
