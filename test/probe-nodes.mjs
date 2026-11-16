// Checks that the public data sources the page depends on are reachable and healthy, from Node.js.
//   node probe-nodes.mjs [wss://other-node:35998 ...]
// Exit code 0 when at least one Zenon node answers and its frontier is fresh (< 60 s old).
// If your environment blocks outbound WebSockets this will fail for every node; verify from a normal
// browser using the production checks described in README.md instead.
import { createRequire } from 'node:module';
const require = createRequire(process.env.METRONOM_TEST_MODULES ? new URL('file://' + process.env.METRONOM_TEST_MODULES + '/package.json') : import.meta.url);
const WebSocket = require('ws');

const DEFAULT = ['wss://node.zenonhub.io:35998', 'wss://node.atsocy.com:35998', 'wss://my.hc1node.com:35998'];
const nodes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;

function probe(url) {
  return new Promise(res => {
    const t0 = Date.now();
    let ws;
    try { ws = new WebSocket(url, { handshakeTimeout: 8000 }); } catch (e) { return res({ url, ok: false, err: String(e) }); }
    const to = setTimeout(() => { try { ws.terminate(); } catch (e) {} res({ url, ok: false, err: 'timeout' }); }, 10000);
    ws.on('error', e => { clearTimeout(to); res({ url, ok: false, err: e.message }); });
    ws.on('open', () => ws.send(JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'ledger.getFrontierMomentum', params: [] },
      { jsonrpc: '2.0', id: 2, method: 'stats.processInfo', params: [] },
      { jsonrpc: '2.0', id: 3, method: 'embedded.pillar.getAll', params: [0, 500] },
      { jsonrpc: '2.0', id: 4, method: 'ledger.getMomentumsByHeight', params: [1, 1] },
    ])));
    ws.on('message', raw => {
      clearTimeout(to);
      let d = JSON.parse(raw.toString()); d = Array.isArray(d) ? d : [d];
      const by = id => d.find(x => x.id === id) || {};
      const f = by(1).result, pi = by(2).result, pl = by(3).result, g = by(4).result;
      let genesis = '';
      try { genesis = Buffer.from(g.list[0].data, 'base64').toString('utf8'); } catch (e) {}
      ws.close();
      res({
        url, ok: !!f, ms: Date.now() - t0,
        height: f && f.height, ageS: f ? Math.round(Date.now() / 1000 - f.timestamp) : null,
        version: pi && pi.version, pillars: pl && pl.list && pl.list.length,
        genesisData: genesis,
      });
    });
  });
}

const rs = await Promise.all(nodes.map(probe));
for (const r of rs) console.log(r.ok
  ? `OK    ${r.url}  height ${r.height}  frontier age ${r.ageS}s  ${r.version}  pillars ${r.pillars}  ${r.ms} ms`
  : `FAIL  ${r.url}  ${r.err}`);
const g = rs.find(r => r.genesisData);
if (g) console.log(`genesis data: ${g.genesisData}`);

async function http(u) {
  try { const r = await fetch(u, { headers: { origin: 'https://example.com' } }); return { ok: r.ok, status: r.status, cors: r.headers.get('access-control-allow-origin'), body: await r.text() }; }
  catch (e) { return { ok: false, err: String(e.cause || e) }; }
}
const b = await http('https://mempool.space/api/v1/blocks');
if (b.ok) { const j = JSON.parse(b.body); console.log(`OK    mempool.space  tip #${j[0].height} (${j[0].extras?.pool?.name || '?'})  CORS ${b.cors || '(not reported to this client)'}`); }
else console.log(`FAIL  mempool.space  ${b.err || b.status}`);

const fresh = rs.some(r => r.ok && r.ageS != null && r.ageS >= -30 && r.ageS < 60);
process.exit(fresh ? 0 : 1);
