const https = require('https');
const host = 'api.github.com';
const pathReq = '/repos/leancode/kilingo/issues?state=all&per_page=100';
const opts = {
  hostname: host,
  path: pathReq,
  headers: {
    'User-Agent': 'kilingo-issue-lookup',
    'Accept': 'application/vnd.github+json',
  },
};
function request(path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, path, headers, method: 'GET' }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
(async () => {
  try {
    const issues = await request(pathReq, opts.headers);
    const hits = issues.filter(i =>
      i.title && /phase 2|lots? 1 + 2|de, pt, it|de pt it|slangseedlot/i.test(i.title + ' ' + (i.body || ''))
    );
    console.log('total open issues:', issues.filter(i=>i.state==='open').length);
    console.log('total closed issues:', issues.filter(i=>i.state==='closed').length);
    console.log('matching hits:', hits.length);
    for (const h of hits.slice(0, 20)) {
      console.log(`- #${h.number} [${h.state}] ${h.title}`);
    }
  } catch (e) {
    console.error('request failed', e.message);
  }
})();
