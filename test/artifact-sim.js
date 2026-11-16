// Serves index.html the way a locked-down embed (e.g. the claude.ai artifact viewer) would:
// strict CSP with connect-src 'self' inside a sandboxed iframe (opaque origin, no outside network).
// Use it to confirm the page falls back to its labelled simulation within ~2 s instead of hanging.
//
//   node artifact-sim.js [--html ../index.html] [--port 8790]   then open http://localhost:8790/
const http = require('http'), fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const HTML = path.resolve(__dirname, arg('html', '../index.html'));
const PORT = +arg('port', 8790);
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob:; media-src data: blob:; connect-src 'self'";
http.createServer((q, s) => {
  if (q.url.startsWith('/frame')) { s.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP }); return s.end(fs.readFileSync(HTML)); }
  s.writeHead(200, { 'content-type': 'text/html' });
  s.end('<!doctype html><body style="margin:0;background:#222"><iframe id=f sandbox="allow-scripts" src="/frame" style="border:0;width:100vw;height:100vh"></iframe></body>');
}).listen(PORT, '127.0.0.1', () => console.log(`artifact-sim on http://localhost:${PORT}  (html: ${path.relative(process.cwd(), HTML)})`));
