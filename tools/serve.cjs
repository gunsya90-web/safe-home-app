const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (relative.split('/').some(x => x.startsWith('.')) || !/^(index\.html|resident\.html|field\.html|situation\.html|facilities\.html|data-review\.html|sw\.js|manifest\.webmanifest|(js|css|icons)\/[^/]+)$/.test(relative)) { res.writeHead(404); return res.end(); }
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', function () { process.stdout.write('SAFE-HOME http://127.0.0.1:' + this.address().port + '\n'); });
