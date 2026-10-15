const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src', 'convex');
const seedFiles = fs.readdirSync(srcDir).filter(f => /^slangSeed.*\.ts$/.test(f) && f !== 'slangSeed.ts');

(async () => {
  const byLang = {};
  for (const file of seedFiles) {
    const modPath = path.join(srcDir, file).split(path.sep).join('/');
    const mod = await import('file:///' + modPath.replace(/\\/g, '/').replace(/^//, ''));
    for (const k of Object.keys(mod)) {
      if (k.startsWith('SLANG_SEED')) {
        const arr = mod[k];
        for (const e of arr) {
          byLang[e.language] = (byLang[e.language] || 0) + 1;
        }
      }
    }
  }
  console.log('vi count:', byLang.vi);
  console.log('total (aggregated from seed files):', Object.values(byLang).reduce((a, b) => a + b, 0));
  console.log('byLang vi:', byLang.vi, 'expected 74');
  if (byLang.vi !== 74) {
    console.error('UNEXPECTED vi count:', byLang.vi);
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
