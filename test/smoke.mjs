// End-to-end smoke test for index.html (Playwright + Chromium).
//
//   node smoke.mjs                      local: mock node + mock mempool served with vercel.json headers,
//                                       plus the locked-down "artifact" embed. No internet needed.
//   node smoke.mjs --url https://x.app  production: checks headers, live mainnet connection, every scene.
//
// Env: CHROME_PATH=/path/to/chrome  (optional; otherwise run `npx playwright install chromium` once)
//      PORT=8787 ART_PORT=8790       (local mode ports)
// Screenshots go to test/shots/. Exit code 0 = all checks passed.
import { createRequire } from 'node:module';
const testRequire = createRequire(process.env.METRONOM_TEST_MODULES ? new URL('file://' + process.env.METRONOM_TEST_MODULES + '/package.json') : import.meta.url);
const { chromium } = testRequire('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = process.env.SHOTS_DIR || path.join(HERE, 'shots'); mkdirSync(SHOTS, { recursive: true });
const URL_ARG = (() => { const i = process.argv.indexOf('--url'); return i > 0 ? process.argv[i + 1].replace(/\/$/, '') : null; })();
const PORT = +(process.env.PORT || 8787), ART_PORT = +(process.env.ART_PORT || 8790);
const SCENES = ['blocks', 'chain', 'glyphs', 'dial', 'constellation', 'waterfall', 'clocks', 'loom', 'timeline', 'epoch', 'heat', 'lostlink', 'spiral', 'history', 'pillars'];

let failed = 0;
const ok = (cond, label, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!cond) failed++; return cond; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function watch(page) {
  const errs = [], csp = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to (connect|load|apply|execute)/i.test(t)) csp.push(t.slice(0, 200)); });
  return { errs, csp };
}
async function waitFor(page, expr, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(expr)) return true; } catch (e) {} await sleep(250); }
  return false;
}
async function sweep(page, tag, frame = page) {
  // let the intro finish so a hash pin switches straight away
  await waitFor(frame, "SC.cur>=0 && SC.list[SC.cur].id!=='intro'", 20000);
  const bad = [];
  for (const id of SCENES) {
    await frame.evaluate(h => { location.hash = h; }, id);
    const got = await waitFor(frame, `SC.cur>=0 && SC.list[SC.cur].id===${JSON.stringify(id)}`, 6000);
    await sleep(id === 'spiral' || id === 'history' ? 3500 : 1800);
    await page.screenshot({ path: path.join(SHOTS, `${tag}_${id}.png`) });
    if (!got) bad.push(id);
  }
  ok(bad.length === 0, `${tag}: all ${SCENES.length} scenes can be pinned and render`, bad.length ? 'missing: ' + bad.join(', ') : '');
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--disable-gpu'] });
const kids = [];
try {
  if (process.argv.includes('--regression')) await regression(); else if (URL_ARG) await production(URL_ARG); else await local();
} finally {
  await browser.close();
  for (const k of kids) k.kill();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);

/* ---------------------------------------------------------------- local */
async function local() {
  const start = (file, args, port) => new Promise((res, rej) => {
    const k = spawn(process.execPath, [path.join(HERE, file), ...args, '--port', String(port)], { cwd: HERE, stdio: ['ignore', 'pipe', 'inherit'] });
    kids.push(k); k.on('exit', c => rej(new Error(`${file} exited ${c}`)));
    k.stdout.on('data', d => { const s = d.toString(); process.stdout.write('      ' + s); if (/ on http/.test(s)) res(); });
  });
  await start('mock-node.js', ['--html', '../index.html', '--headers', '../vercel.json'], PORT);
  await start('artifact-sim.js', ['--html', '../index.html'], ART_PORT);
  const base = `http://localhost:${PORT}/`, q = `?node=ws://localhost:${PORT}/ws&btcapi=http://localhost:${PORT}`;

  // 1. headers from vercel.json are applied and the page is not blocked by its own CSP
  const vj = JSON.parse(readFileSync(path.join(HERE, '../vercel.json'), 'utf8'));
  const want = vj.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
  const r = await fetch(base);
  ok(r.headers.get('content-security-policy') === want, 'mock serves the vercel.json CSP');

  // 2. desktop, live (mock) data
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const w = watch(page);
  await page.goto(base + q);
  ok(await waitFor(page, "S.mode==='live' && S.ready", 20000), 'connects to the node and goes LIVE', await page.evaluate("document.querySelector('#statusTxt').textContent"));
  ok(/MOMENTUM [\d,]+ · SLOT [\d,]+ · MISSED/.test(await page.evaluate("document.querySelector('#hudH').textContent")), 'HUD shows the two time axes');
  ok(await waitFor(page, 'S.btc>0', 15000), 'Bitcoin tip loaded from the mempool API', 'BTC #' + await page.evaluate('S.btc'));
  ok(await waitFor(page, 'S.pillars.length>0', 15000), 'pillar list loaded', await page.evaluate('S.pillars.length') + ' pillars');
  await sweep(page, 'local');

  // 3. time notary
  await page.evaluate("location.hash='blocks'"); await sleep(800);
  const hash = await page.evaluate("(()=>{for(let i=S.ms.length-1;i>=0;i--){const m=S.ms[i];if(m.blocks&&m.blocks.length)return m.blocks[0].hash}})()");
  await page.keyboard.press('n'); await sleep(300);
  await page.fill('#ntI', hash || ''); await page.keyboard.press('Enter');
  const cert = await waitFor(page, "/NOT BEFORE/.test(document.querySelector('#ntOut').innerText)", 8000);
  await page.screenshot({ path: path.join(SHOTS, 'local_notary.png') });
  ok(!!hash && cert, 'time notary returns a certificate for an account block');
  await page.keyboard.press('Escape'); ok(!(await page.evaluate('NT.open')), 'Esc closes the notary');
  ok(w.errs.length === 0, 'no page errors (desktop)', w.errs.slice(0, 3).join(' | '));
  ok(w.csp.length === 0, 'no CSP violations with the production headers', w.csp.slice(0, 2).join(' | '));

  // 4. stream overlay
  const ov = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const wo = watch(ov);
  await ov.goto(base + q + '&overlay&calm');
  ok(await waitFor(ov, "SC.cur>=0 && document.documentElement.classList.contains('overlay') && getComputedStyle(document.querySelector('#ticker')).display!=='none'", 20000), '?overlay starts a scene and shows the ticker');
  await ov.goto(base + q + '&overlay#dial');
  ok(await waitFor(ov, "SC.cur>=0 && SC.list[SC.cur].id==='dial'", 20000), '?overlay#dial pins the dial');
  await ov.screenshot({ path: path.join(SHOTS, 'local_overlay_dial.png') });
  ok(wo.errs.length === 0, 'no page errors (overlay)', wo.errs.slice(0, 3).join(' | '));

  // 5. forced simulation is labelled
  const sm = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const ws = watch(sm);
  await sm.goto(base + '?sim');
  ok(await waitFor(sm, "/SIMULATED DATA/.test(document.querySelector('#statusTxt').textContent)", 8000), '?sim is labelled SIMULATED DATA');
  ok(ws.errs.length === 0, 'no page errors (sim)');

  // 6. phone layout
  const mo = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const wm = watch(mo);
  await mo.goto(base + q);
  await waitFor(mo, "S.mode==='live' && S.ready", 20000);
  await sweep(mo, 'mobile');
  ok(wm.errs.length === 0, 'no page errors (390×844)', wm.errs.slice(0, 3).join(' | '));

  // 7. locked-down embed (no network): must fall back to the labelled simulation quickly
  const ar = await browser.newPage({ viewport: { width: 1280, height: 760 } }); const wa = watch(ar);
  const t0 = Date.now(); await ar.goto(`http://localhost:${ART_PORT}/`);
  let fr = null; for (let i = 0; i < 40 && !fr; i++) { fr = ar.frames().find(f => f.url().includes('/frame')); if (!fr) await sleep(100); }
  const simOk = !!fr && await waitFor(fr, "S.mode==='sim' && S.ready", 6000);
  ok(simOk, 'sandboxed embed falls back to simulation', `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (simOk) await sweep(ar, 'embed', fr);
  ok(wa.errs.length === 0, 'no page errors (embed)', wa.errs.slice(0, 3).join(' | '));
}

/* ----------------------------------------------------------- production */
async function production(base) {
  const r = await fetch(base + '/');
  ok(r.status === 200, `GET ${base}/`, `HTTP ${r.status}`);
  const config = JSON.parse(readFileSync(path.join(HERE, '../vercel.json'), 'utf8'));
  const policy = config.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
  ok(r.headers.get('content-security-policy') === policy, 'exact CSP header matches the reviewed source');
  const { createHash } = await import('node:crypto');
  ok(createHash('sha256').update(await r.text()).digest('hex') === createHash('sha256').update(readFileSync(path.join(HERE, '../index.html'))).digest('hex'), 'deployed page matches the reviewed source');
  ok(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff header present');
  for (const p of ['/test/smoke.mjs', '/AGENT_HANDOFF.md', '/docs/ARCHITECTURE.md', '/README.md', '/vercel.json', '/scripts/build.mjs', '/.git/config', '/.env']) {
    const x = await fetch(base + p); ok(x.status === 404, `${p} is not deployed`, `HTTP ${x.status}`);
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const w = watch(page);
  await page.goto(base + '/');
  const live = await waitFor(page, "S.mode==='live' && S.ready", 30000);
  const st = await page.evaluate("document.querySelector('#statusTxt').textContent");
  if (!ok(live, 'connects to a public Zenon node and goes LIVE', st)) {
    console.log('      If the status says SIMULATED DATA · NO NODE REACHABLE, this test machine probably cannot open');
    console.log('      outbound wss:// connections. Verify in a normal browser instead (AGENT_HANDOFF.md §5.5, step 3).');
  } else {
    const info = await page.evaluate("({node:S.node,frontier:S.frontier,age:Math.round(Date.now()/1000-S.lastTs),hud:document.querySelector('#hudH').textContent})");
    ok(info.age < 90, 'frontier is fresh', `node ${info.node}, momentum #${info.frontier}, ${info.age}s old`);
    console.log('      HUD: ' + info.hud);
    ok(await waitFor(page, 'S.btc>0', 20000), 'Bitcoin tip loaded from mempool.space', 'BTC #' + await page.evaluate('S.btc'));
    ok(await waitFor(page, 'S.pillars.length>0', 20000), 'pillars loaded', await page.evaluate('S.pillars.length') + ' pillars');
    ok(await waitFor(page, 'S.hs!=null', 45000), 'history since genesis loaded');
  }
  await sweep(page, 'prod');
  ok(w.errs.length === 0, 'no page errors', w.errs.slice(0, 3).join(' | '));
  ok(w.csp.length === 0, 'no CSP violations', w.csp.slice(0, 2).join(' | '));
  const ov = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await ov.goto(base + '/?overlay#dial');
  ok(await waitFor(ov, "SC.cur>=0 && SC.list[SC.cur].id==='dial'", 30000), '?overlay#dial works');
  await ov.screenshot({ path: path.join(SHOTS, 'prod_overlay_dial.png') });
}

// Regression controls for failure modes observed during the source review.
async function regression() {
  const mock = spawn(process.execPath, [path.join(HERE, 'mock-node.js'), '--headers', '../vercel.json', '--port', String(PORT)], { cwd: HERE, stdio: ['ignore', 'pipe', 'inherit'] });
  kids.push(mock);
  await new Promise((resolve, reject) => {
    mock.on('error', reject); mock.on('exit', code => reject(new Error('Mock exited ' + code)));
    mock.stdout.on('data', data => { if (data.toString().includes(' on http')) resolve(); });
  });
  const base = `http://localhost:${PORT}/`, nodeBase = `ws://localhost:${PORT}`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const observed = watch(page);
  const url = endpoints => base + '?node=' + encodeURIComponent(endpoints) + '&btcapi=' + encodeURIComponent(base.slice(0, -1));
  await page.goto(url(nodeBase + '/silent,' + nodeBase + '/ws'));
  ok(await waitFor(page, "S.mode==='live'&&S.ready&&node.url.endsWith('/ws')", 11000), 'silent RPC endpoint fails over to the next node');
  await page.goto(url(nodeBase + '/stale,' + nodeBase + '/ws'));
  ok(await waitFor(page, "S.mode==='live'&&S.ready&&node.url.endsWith('/ws')", 11000), 'stale frontier is rejected before LIVE');
  await page.evaluate('node.ws.close()');
  ok(await waitFor(page, "S.mode==='reconnecting'", 2000), 'socket loss removes the LIVE state');
  ok(await waitFor(page, "S.mode==='live'&&node.alive", 11000), 'socket loss recovers through failover');
  await page.evaluate('(()=>{const previous=S.lastTs;S.lastTs-=120;checkConnection();S.lastTs=previous})()');
  ok(await page.evaluate("S.mode==='reconnecting'&&document.querySelector('#statusTxt').textContent==='RECONNECTING…'"), 'watchdog labels a stale connection before reconnecting');
  ok(await waitFor(page, "S.mode==='live'&&node.alive", 11000), 'watchdog recovers fresh data');

  await page.goto(url(nodeBase + '/silent'));
  const hadBitcoin = await waitFor(page, 'S.btc>=976100', 3000);
  ok(await waitFor(page, "S.mode==='sim'&&S.ready", 14000), 'an open socket without RPC data reaches labelled simulation');
  ok(hadBitcoin && await page.evaluate('S.btc===976000&&btcWs===null&&btcController.signal.aborted'), 'fallback discards real Bitcoin data and stops its transport');
  await page.waitForTimeout(1500);
  ok(await page.evaluate("S.mode==='sim'&&!node.alive"), 'late connection work cannot overwrite simulation mode');

  const forced = await browser.newPage(); const requests = [];
  forced.on('request', request => requests.push(request.url()));
  await forced.goto(base + '?sim&node=%20,%20&btcapi=javascript:invalid');
  ok(await waitFor(forced, "S.mode==='sim'&&S.ready", 3000), 'invalid overrides use safe defaults and simulation stays explicit');
  await forced.waitForTimeout(500);
  ok(requests.every(u => new URL(u).origin === new URL(base).origin), 'forced simulation makes no third-party requests');
  ok(await forced.evaluate('NODES.length===3&&BTC_API==="https://mempool.space"'), 'empty or unsafe endpoint overrides do not remove failover');
  await forced.close();

  await page.goto(url(nodeBase + '/ws'));
  await waitFor(page, "S.mode==='live'&&S.ready", 11000);
  const nativeClassification=await page.evaluate("classify({blockType:2,tokenStandard:'zts1example',token:{symbol:'ZNN',decimals:8},amount:'100000000'}).kind");
  ok(nativeClassification==='zts','a custom token named ZNN is not classified as native ZNN');
  await page.keyboard.press('n'); await page.waitForTimeout(150);
  ok(await page.evaluate("document.activeElement.id==='ntI'&&document.querySelector('#notary').getAttribute('aria-modal')==='true'"), 'notary opens as a labelled dialog and focuses its input');
  await page.focus('#ntX'); await page.keyboard.press('Shift+Tab');
  ok(await page.evaluate("document.activeElement===document.querySelector('#ntF button')"), 'dialog keyboard focus stays inside the notary');
  const hash = await page.evaluate("S.ms.flatMap(m=>m.blocks).find(b=>b.hash)?.hash");
  await page.fill('#ntI', hash); await page.press('#ntI', 'Enter');
  ok(await waitFor(page, "NT.last&&NT.last.verification.includes('not independently verified')&&NT.last.bitcoinMapping.includes('not a timestamp proof')", 8000), 'copied observation records its trust boundary');
  await page.keyboard.press('Escape');
  await page.goto(url(nodeBase + '/badbounds'));
  await waitFor(page, "S.mode==='live'&&S.ready", 11000);
  const badHash = await page.evaluate("S.ms.flatMap(m=>m.blocks).find(b=>b.hash)?.hash");
  await page.keyboard.press('n'); await page.fill('#ntI', badHash); await page.press('#ntI', 'Enter');
  ok(await waitFor(page, "/inconsistent node-reported/.test(document.querySelector('#ntOut').textContent)&&NT.last===null", 8000), 'inconsistent time bounds cannot produce a certificate');
  ok(observed.errs.length === 0, 'regression controls have no page errors', observed.errs.join(' | '));
  ok(observed.csp.length === 0, 'regression controls respect the script hash policy', observed.csp.join(' | '));
  await page.close();
}
