// Additional live checks: nonempty ledger data, native sends, epoch export and time context.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(process.env.METRONOM_TEST_MODULES?new URL('file://'+process.env.METRONOM_TEST_MODULES+'/package.json'):import.meta.url);
const {chromium}=require('playwright');
const base=new URL(process.argv[2]);base.searchParams.set('calm','');base.hash='epoch';
const shots=process.env.SHOTS_DIR||path.join(here,'shots');mkdirSync(shots,{recursive:true});
let total=0,failed=0;const check=(ok,label,detail='')=>{total++;if(!ok)failed++;console.log(`${ok?'PASS':'FAIL'} ${label}${detail?' '+detail:''}`)};
console.log('SOURCE '+createHash('sha256').update(readFileSync(path.join(here,'../index.html'))).digest('hex'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const errors=[],csp=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Content Security Policy|Refused to (connect|execute)/i.test(m.text()))csp.push(m.text())});
 await page.goto(base.href);
 await page.waitForFunction(()=>S.mode==='live'&&S.ready&&S.ms.some(m=>m.n>0)&&SC.cur>=0&&SC.list[SC.cur].id==='epoch',{},{timeout:60000});
 const evidence=await page.evaluate(async()=>{
  const sample=[...S.ms].reverse().find(m=>m.n>0),raw=(await node.call('ledger.getDetailedMomentumsByHeight',[sample.h,1],15000)).list[0];
  const sums={ZNN:0n,QSR:0n};for(const b of raw.blocks)if(b.blockType===2||b.blockType===4){const asset=b.tokenStandard===ZNN?'ZNN':b.tokenStandard===QSR?'QSR':null;if(asset)sums[asset]+=BigInt(b.amount||'0')}
  const expected={ZNN:Number(sums.ZNN)/1e8,QSR:Number(sums.QSR)/1e8},stats=epochStats(EPR.info().s0,EPR.info().cur);
  return{node:S.node,height:sample.h,hash:sample.hash,count:sample.n,sameHash:raw.momentum.hash===sample.hash,sameBlocks:raw.blocks.map(b=>b.hash).sort().join(',')===sample.blocks.map(b=>b.hash).sort().join(','),expected,moved:sample.moved,stats,block:sample.blocks[0].hash};
 });console.log('DETAILS '+JSON.stringify(evidence));
 check(evidence.count>0&&evidence.sameHash&&evidence.sameBlocks,'nonempty momentum account-block hashes match a fresh RPC response',String(evidence.height));
 check(['ZNN','QSR'].every(k=>Math.abs(evidence.expected[k]-evidence.moved[k])<=Math.max(1e-8,Math.abs(evidence.expected[k])*1e-12)),'native send totals match independently summed raw base units');
 const st=evidence.stats;check(st.prod+st.miss+st.unk+st.pending+st.rem===8640&&st.blk<=st.prod,'live epoch categories total exactly 8640 slots',JSON.stringify(st));
 const download=page.waitForEvent('download',{timeout:15000});await page.locator('#rugSave').click();const saved=await download;const exportPath=path.join(shots,'epoch-export.png');await saved.saveAs(exportPath);
 const png=readFileSync(exportPath),dimensions={width:png.readUInt32BE(16),height:png.readUInt32BE(20),bytes:png.length,sha256:createHash('sha256').update(png).digest('hex')};
 check(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&dimensions.width===1856&&dimensions.height===944&&png.length<1048576,'live epoch PNG export is complete and has the expected dimensions',JSON.stringify(dimensions));
 await page.waitForTimeout(1200);await page.screenshot({path:path.join(shots,'mobile-epoch.png')});
 await page.evaluate(hash=>ntOpen(hash),evidence.block);await page.waitForFunction(()=>NT.last||/Lookup failed/.test(document.querySelector('#ntOut').textContent),{},{timeout:30000});
 const observation=await page.evaluate(()=>NT.last);check(observation?.block===evidence.block&&observation.verification.includes('not independently verified')&&observation.bitcoinMapping.includes('not a timestamp proof'),'live time lookup returns an explicitly node-reported observation');
 const fits=await page.locator('.nt-card').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight});check(fits,'live time lookup dialog fits the mobile viewport');
 await page.screenshot({path:path.join(shots,'mobile-time-context.png')});
 check(errors.length===0&&csp.length===0,'additional live controls have no page errors or CSP violations',[...errors,...csp].slice(0,3).join(' | '));
}finally{await browser.close()}
console.log(JSON.stringify({total,passed:total-failed,failed}));process.exit(failed?1:0);
