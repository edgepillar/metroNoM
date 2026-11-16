// Mock znnd + mock mempool.space for local testing of index.html.
// Serves index.html over HTTP (optionally with the response headers from vercel.json, so the CSP is exercised),
// a znnd-shaped JSON-RPC WebSocket at /ws, and mempool.space-shaped REST + WebSocket routes under /api.
// Response shapes follow go-zenon v0.0.10 and mempool.space as observed on 2026-11-16.
//
//   node mock-node.js [--html ../index.html] [--port 8787] [--headers ../vercel.json]
//   then open  http://localhost:8787/?node=ws://localhost:8787/ws&btcapi=http://localhost:8787
//
// Timing: a momentum every 10 s with ~18 % missed slots (higher than mainnet's long-run ~7 %, to exercise the
// missed-slot visuals); a Bitcoin block every 75 s. ~6 % of send blocks carry proof-of-work plasma.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const HTML = path.resolve(__dirname, arg('html', '../index.html'));
const PORT = +arg('port', 8787);
const HDR = (() => { const f = arg('headers', ''); if (!f) return {}; try { const v = JSON.parse(fs.readFileSync(path.resolve(__dirname, f), 'utf8')); const out = {}; for (const r of v.headers || []) for (const h of r.headers) out[h.key.toLowerCase()] = h.value; return out; } catch (e) { console.error('cannot read headers from', f, e.message); process.exit(1); } })();
const TICK = 10, GEN = 1637755200;
const EMB = { pillar: 'z1qxemdeddedxpyllarxxxxxxxxxxxxxxxsy3fmg', sentinel: 'z1qxemdeddedxsentynelxxxxxxxxxxxxxwy0r2r', stake: 'z1qxemdeddedxstakexxxxxxxxxxxxxxxxjv8v62', liquidity: 'z1qxemdeddedxlyquydytyxxxxxxxxxxxxflaaae', accelerator: 'z1qxemdeddedxaccelerat0rxxxxxxxxxxp4tk22', token: 'z1qxemdeddedxt0kenxxxxxxxxxxxxxxxxh9amk0' };
const rh = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const ZNN = 'zts1znnxxxxxxxxxxxxx9z4ulx', QSR = 'zts1qsrxxxxxxxxxxxxxmrhjll', NONE = 'zts1qqqqqqqqqqqqqqqqtq587y';
const pillars = Array.from({ length: 98 }, (_, i) => ({ name: i === 7 ? 'edgepillar.com' : 'mockpillar' + i, rank: i, type: 1, ownerAddress: 'z1qown' + i, producerAddress: 'z1qprod' + i, withdrawAddress: 'z1qw' + i, giveMomentumRewardPercentage: 50, giveDelegateRewardPercentage: 100, isRevocable: false, revokeCooldown: 0, revokeTimestamp: 0, currentStats: { producedMomentums: i % 9 === 0 ? 1 : 3, expectedMomentums: 3 }, weight: String(Math.round(3.8e13 * Math.pow(0.965, i))) }));
function blocks() {
  if (Math.random() > 0.03) return [];
  const out = [];
  const pairs = 1 + Math.floor(Math.random() * Math.random() * 4);
  const users = ['q','p','z','r','y'].map(letter => 'z1' + letter.repeat(38)); // Synthetic, non-spendable fixture addresses.
  for (let i = 0; i < pairs; i++) {
    const c = ['pillar', 'sentinel', 'stake', 'liquidity', 'accelerator'][Math.floor(Math.random() * 5)];
    const pow = Math.random() < 0.06;
    const sh = rh(64);
    out.push({ blockType: 2, address: users[Math.floor(Math.random() * users.length)], toAddress: EMB[c], amount: '0', tokenStandard: NONE, token: null, usedPlasma: 52500, fusedPlasma: pow ? 0 : 52500, difficulty: pow ? 78750000 : 0, hash: sh, fromBlockHash: '0'.repeat(64), height: 1 });
    out.push({ blockType: 5, address: EMB[c], toAddress: EMB[c], amount: '0', tokenStandard: NONE, token: null, usedPlasma: 0, fusedPlasma: 0, difficulty: 0, hash: rh(64), fromBlockHash: sh, height: 1 });
  }
  if (Math.random() < 0.08) out.push({ blockType: 4, address: EMB.token, toAddress: users[1], amount: String(Math.floor(Math.random() * 3e8)), tokenStandard: ZNN, token: { symbol: 'ZNN', decimals: 8 }, usedPlasma: 0, fusedPlasma: 0, difficulty: 0, hash: rh(64), fromBlockHash: '0'.repeat(64), height: 1 });
  if (Math.random() < 0.05) out.push({ blockType: 2, address: users[2], toAddress: users[4], amount: '125000000000', tokenStandard: QSR, token: { symbol: 'QSR', decimals: 8 }, usedPlasma: 21000, fusedPlasma: 21000, difficulty: 0, hash: rh(64), fromBlockHash: '0'.repeat(64), height: 1 });
  return out;
}
// build chain: last ~30h of momentums
const chain = new Map();
let H = 14670000, now = Math.floor(Date.now() / 1000 / TICK) * TICK, ts = now - 11000 * TICK;
for (let i = 0; i < 11000; i++) { ts += TICK; if (Math.random() < 0.07) continue; H++; chain.set(H, mk(H, ts)); }
let FRONT = H;
function mk(h, ts) { return { momentum: { version: 1, chainIdentifier: 1, hash: rh(64), previousHash: rh(64), height: h, timestamp: ts, data: '', content: [], changesHash: rh(64), publicKey: 'x', signature: 'y', producer: 'z1qprod' + Math.floor(Math.random() * 98) }, blocks: blocks().map(b => ({ ...b, momentumAcknowledged: { hash: rh(64), height: h - 1 - (Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0) } })) }; }
function mom(h) { const d = chain.get(h); if (d) return d; const t = GEN + Math.round((h - 1) * 10 * (1.03 + 0.035 * h / 14.68e6) + Math.sin(h / 4e5) * 3e4); return { momentum: { height: h, timestamp: t, hash: rh(64), producer: 'z1qprod1', content: [] }, blocks: [] }; }
const subs = new Set();
setInterval(() => {
  const t = Math.floor(Date.now() / 1000 / TICK) * TICK;
  if (Math.random() < 0.18) return; // missed slot
  FRONT++; const d = mk(FRONT, t); chain.set(FRONT, d);
  for (const [ws, id] of subs) try { ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'ledger.subscription', params: { subscription: id, result: [{ hash: d.momentum.hash, height: FRONT }] } })); } catch (e) { }
}, TICK * 1000);
function handle(req, ws) {
  const { id, method, params = [] } = req; let result = null;
  if (method === 'ledger.subscribe') { result = '0x' + rh(32); if (params[0] === 'momentums') subs.add([ws, result]); }
  else if (method === 'ledger.getFrontierMomentum') result = {...chain.get(FRONT).momentum,timestamp:ws.behavior==='/stale'?GEN:chain.get(FRONT).momentum.timestamp};
  else if (method === 'ledger.getDetailedMomentumsByHeight') { const [h, c] = params; const list = []; for (let x = h; x < h + c && x <= FRONT; x++) if (chain.has(x)) list.push(chain.get(x)); result = { list, count: FRONT }; }
  else if (method === 'ledger.getMomentumsByHeight') { const [h, c] = params; const list = []; for (let x = h; x < h + c && x <= FRONT; x++) list.push(mom(x).momentum); result = { list, count: FRONT }; }
  else if (method === 'ledger.getAccountBlockByHash') { for (const [h, d] of chain) for (const b of d.blocks) if (b.hash === params[0]) { const m = d.momentum; result = Object.assign({}, b, { confirmationDetail: { numConfirmations: FRONT - h + 1, momentumHeight: h, momentumHash: m.hash, momentumTimestamp: m.timestamp } }); } }
  else if (method === 'ledger.getAccountBlocksByPage') { let best = null; for (const [h, d] of chain) for (const b of d.blocks) if (b.address === params[0] && (!best || h > best[0])) best = [h, b, d.momentum]; result = { list: best ? [Object.assign({}, best[1], { confirmationDetail: { numConfirmations: FRONT - best[0] + 1, momentumHeight: best[0], momentumHash: best[2].hash, momentumTimestamp: best[2].timestamp } })] : [], count: best ? 1 : 0 }; }
  else if (method === 'embedded.pillar.getAll') result = { count: 98, list: pillars };
  else return { jsonrpc: '2.0', id, error: { code: -32601, message: 'no method ' + method } };
  if(ws.behavior==='/badbounds' && method==='ledger.getAccountBlockByHash' && result) result={...result,confirmationDetail:{...result.confirmationDetail,momentumHeight:1,momentumTimestamp:GEN}};
  return { jsonrpc: '2.0', id, result };
}
// ---- mock mempool.space ----
const BTC = []; { let t = Math.floor(Date.now() / 1000) - 240, hh = 976100; for (let i = 0; i < 30; i++) { BTC.unshift({ id: rh(64), height: hh - i, timestamp: t, tx_count: 1000 + Math.floor(Math.random() * 4000), size: 1.6e6, extras: { pool: { name: ['Foundry USA', 'AntPool', 'ViaBTC', 'F2Pool', 'MARA Pool'][i % 5] } } }); t -= Math.max(30, Math.round(-Math.log(Math.random()) * 600)); if (i === 6) t += 900; } }
const btcSubs = new Set();
setInterval(() => { const top = BTC[BTC.length - 1]; const b = { id: rh(64), height: top.height + 1, timestamp: Math.floor(Date.now() / 1000), tx_count: 2500, size: 1.5e6, extras: { pool: { name: 'MockPool' } } }; BTC.push(b); for (const ws of btcSubs) try { ws.send(JSON.stringify({ block: b })); } catch (e) { } }, 75000);
const srv = http.createServer((q, s) => {
  const u = q.url.split('?')[0];
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  if (u === '/api/blocks/tip/height') { s.writeHead(200, cors); return s.end(String(BTC[BTC.length - 1].height)); }
  let mt = u.match(/^\/api\/v1\/mining\/blocks\/timestamp\/(\d+)$/);
  if (mt) { const ts = +mt[1]; let b = BTC[0]; for (const x of BTC) if (x.timestamp <= ts) b = x; s.writeHead(200, cors); return s.end(JSON.stringify({ height: b.height, hash: b.id, timestamp: new Date(b.timestamp * 1000).toISOString() })); }
  let m = u.match(/^\/api\/v1\/blocks(?:\/(\d+))?$/);
  if (m) { const top = m[1] ? +m[1] : BTC[BTC.length - 1].height; const out = BTC.filter(b => b.height <= top).slice(-15).reverse(); s.writeHead(200, cors); return s.end(JSON.stringify(out)); }
  if (u !== '/' && u !== '/index.html') { s.writeHead(404); return s.end(); }
  s.writeHead(200, Object.assign({ 'content-type': 'text/html; charset=utf-8' }, HDR)); s.end(fs.readFileSync(HTML));
});
const wss = new WebSocketServer({ noServer: true });
const bws = new WebSocketServer({ noServer: true });
srv.on('upgrade', (req, sock, head) => {
  const u = req.url.split('?')[0];
  if (['/ws','/silent','/stale','/badbounds'].includes(u)) wss.handleUpgrade(req, sock, head, ws => { ws.behavior=u; wss.emit('connection', ws, req); });
  else if (u === '/api/v1/ws') bws.handleUpgrade(req, sock, head, ws => { btcSubs.add(ws); ws.on('close', () => btcSubs.delete(ws)); });
  else sock.destroy();
});
wss.on('connection', ws => {
  ws.on('message', m => { if(ws.behavior==='/silent')return; const d = JSON.parse(m); const r = Array.isArray(d) ? d.map(x => handle(x, ws)) : handle(d, ws); ws.send(JSON.stringify(r)); });
  ws.on('close', () => { for (const s of [...subs]) if (s[0] === ws) subs.delete(s); });
});
srv.listen(PORT, '127.0.0.1', () => console.log(`mock znnd + mempool on http://localhost:${PORT}  (html: ${path.relative(process.cwd(), HTML)}${Object.keys(HDR).length ? ', with vercel.json headers' : ''})`));
