// Data semantics and responsive checks beyond the navigation smoke suite.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(process.env.METRONOM_TEST_MODULES?new URL('file://'+process.env.METRONOM_TEST_MODULES+'/package.json'):import.meta.url);
const {chromium}=require('playwright');
const shots=process.env.SHOTS_DIR||path.join(HERE,'shots');mkdirSync(shots,{recursive:true});
const scenes=['blocks','chain','glyphs','dial','constellation','waterfall','clocks','loom','timeline','epoch','heat','lostlink','spiral','history','pillars'];
let failed=0,total=0;const check=(value,label,detail='')=>{total++;if(!value)failed++;console.log((value?'PASS':'FAIL')+' '+label+(detail?' '+detail:''));};
console.log('SOURCE '+createHash('sha256').update(readFileSync(path.join(HERE,'../index.html'))).digest('hex'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--disable-gpu']});
const local='http://localhost:8857/';
let mock;
try{
 if(process.argv.includes('--mobile')){if(new URL(process.argv.at(-1)).port==='8857')await startMock();await mobile(process.argv.at(-1));}
 else if(process.argv.includes('--live'))await live(process.argv.at(-1));
 else{
  await startMock();
  await fixtures();
 }
}finally{await browser.close();if(mock)mock.kill();}
console.log(JSON.stringify({total,passed:total-failed,failed}));process.exit(failed?1:0);
async function startMock(){
  mock=spawn(process.execPath,[path.join(HERE,'mock-node.js'),'--headers','../vercel.json','--port','8857'],{cwd:HERE,stdio:['ignore','pipe','inherit']});
  await new Promise((resolve,reject)=>{mock.on('error',reject);mock.on('exit',c=>reject(Error('Mock exited '+c)));mock.stdout.on('data',b=>{if(b.toString().includes(' on http'))resolve();});});
}
function target(base,id){const url=new URL(base);url.searchParams.set('calm','');if(url.port==='8857'){url.searchParams.set('node','ws://localhost:8857/ws');url.searchParams.set('btcapi','http://localhost:8857')}url.hash=id;return url.href;}
async function prerequisites(page){try{await page.waitForFunction(()=>S.ready&&S.hs&&S.pillars.length>0&&BT.blocks.length>=3,{},{timeout:60000});return true}catch{const state=await page.evaluate(()=>({mode:S.mode,node:S.node,ready:S.ready,alive:node.alive,loaded:S.ms.length,history:S.hist.length,pillars:S.pillars.length,bitcoin:BT.blocks.length}));check(false,'prerequisite data available',JSON.stringify(state));return false}}
async function fixtures(){
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(local+'?node='+encodeURIComponent('ws://localhost:8857/ws')+'&btcapi='+encodeURIComponent(local.slice(0,-1)));
 await page.waitForFunction(()=>S.ready&&S.pillars.length>0);
 const results=await page.evaluate(()=>{
  node.close();btcStop();SC.paused=true;const results=[];const test=(ok,name,detail)=>results.push({ok:!!ok,name,detail});
  const epoch=Math.floor((Date.now()/1000-GENESIS_TS)/EPOCH),s0=epoch*SLOTS_PER_EPOCH,cur=s0+100;
  const clock=s=>S.clockOff=GENESIS_TS+s*TICK-utcNow();
  const make=(slot,h,blocks=[])=>mkMomentum({momentum:{height:h,timestamp:GENESIS_TS+slot*TICK,hash:h.toString(16).padStart(64,'0'),producer:'producer-a'},blocks});
  const seed=records=>{S.ms=records;S.byH=new Map(records.map(r=>[r.h,r]));S.bySlot=new Map(records.map(r=>[slotOf(r.ts),r]));records.forEach(r=>r.slot=slotOf(r.ts));S.frontier=records.at(-1).h;S.lastTs=records.at(-1).ts;S.mode='live';S.ready=true;};
  seed([make(cur-2,100),make(cur,101)]);clock(cur+2.8);
  test(slotState(cur+1,cur+2,.8,cur-2).st!=='missed','delayed observations are pending rather than confirmed missed slots');
  test(slotState(cur-1,cur+2,.8,cur-2).st==='missed','a gap bounded by consecutive observed momentums is missed');
  test(slotState(cur-3,cur+2,.8,cur-2).st==='unknown','unloaded history remains unknown');
  const interval=slotStats(GENESIS_TS+cur*TICK,GENESIS_TS+(cur+2.8)*TICK);
  test(interval.mo===1&&interval.miss===0&&interval.pending===2,'Bitcoin interval preserves the distinction between known and pending slots',JSON.stringify(interval));
  clock(cur+.8);EPR.render(2,0);let st=EPR.stats;
  test(st.prod+st.miss+st.unk+st.rem+(st.pending||0)===8640,'epoch categories partition exactly 8640 slots',JSON.stringify(st));
  test(st.prod===2&&st.miss===1,'epoch counts derive from loaded momentums and bounded gaps');
  setPillars([{name:'Alpha',producerAddress:'producer-a',weight:'400000000',currentStats:{producedMomentums:2,expectedMomentums:3}},{name:'Beta',producerAddress:'producer-b',weight:'200000000',currentStats:{producedMomentums:1,expectedMomentums:3}},{name:'Gamma',producerAddress:'producer-c',weight:'100000000',currentStats:{producedMomentums:0,expectedMomentums:0}}]);
  updEpoch(true);test(document.querySelector('#eFill').textContent.includes('66.7'),'epoch fill does not substitute cached pillar counters for loaded coverage',document.querySelector('#eFill').textContent);
  test(document.querySelector('#eAvg').textContent==='20.00 s','epoch mean uses the observed inter-momentum interval');
  test(axes(101,GENESIS_TS+(cur+2.8)*TICK,false,GENESIS_TS+cur*TICK).split('MISSED')[1]===axes(101,GENESIS_TS+cur*TICK,false).split('MISSED')[1],'the ticking clock does not inflate observed missed share');
  const native=classify({blockType:2,tokenStandard:ZNN,amount:'125000000',hash:'a'.repeat(64),usedPlasma:21000,fusedPlasma:10000,difficulty:100});
  const custom=classify({blockType:2,tokenStandard:'custom',token:{symbol:'ZNN',decimals:8},amount:'900000000',hash:'b'.repeat(64)});
  test(native.kind==='znn'&&custom.kind==='zts','native transfer classification uses the token standard');
  const m=make(cur,101,[]);m.blocks=[native,custom];
  if(typeof heatSummary==='function'){const heat=heatSummary([m],0);test(heat.hot===1&&heat.fused===1&&heat.mixed===1,'mixed PoW and fusion contributes to both presence counters');test(heat.unknown===1,'missing plasma fields are not labelled as zero-plasma contracts');}
  else{test(false,'mixed PoW and fusion contributes to both presence counters');test(false,'missing plasma fields are not labelled as zero-plasma contracts');}
  test([...hashBits('a'.repeat(64)).slice(0,8)].join('')==='10101010','glyphs preserve the supplied hash bits');
  CH.build();const next=make(cur+1,102);ingest([{momentum:{height:next.h,timestamp:next.ts,hash:next.hash,producer:next.producer},blocks:[]}],false);
  test(CH.conf[0].r.h===102,'chain cubes refresh after bulk catch-up');
  CH.advance(S.ms.at(-1));test(CH.conf.filter(c=>c.r.h===102).length===1,'delayed chain animation skips an already rendered momentum');
  S.hist=[{h:1,ts:GENESIS_TS},{h:100,ts:GENESIS_TS+(cur-2)*TICK}];bus.emit('history');bus.emit('bulk');
  test(S.hs.h.at(-1)===S.frontier,'History and Spiral end at the latest observed momentum');
  test(missedEpoch(S.pillars[1])===2,'waterfall deficits use expected minus produced node counters');
  CO.layout(innerWidth,innerHeight);const oldSize=CO.pos.get('producer-a').s;
  setPillars(S.pillars.map(p=>({...p,weight:p.name==='Alpha'?'100000000':'400000000'})));CO.frame(12,.01,performance.now());
  test(CO.pos.get('producer-a').s<oldSize,'constellation refreshes weights when pillar count stays unchanged');
  LL.reset();test(Number.isFinite(LL.sim.len)&&LL.sim.zeta<=LL.sim.P.length,'illustrative epoch model works with fewer than eight positive-weight pillars');
  TL.compute(600);test(TL.cache.nm===S.ms.filter(r=>r.ts>=serverNow()-86400).length,'24-hour timeline counts only records inside its time window');
  PI.layout(1200,800);test(Math.abs(PI.rects.reduce((n,r)=>n+r.w*r.h,0)-1080*560)<.01,'pillar areas preserve the total treemap area');
  BT.blocks=[];BT.byH.clear();S.btc=0;
  btcMerge([{height:976001,timestamp:1000,id:'a'.repeat(64)},{height:976002,timestamp:999,id:'b'.repeat(64)}],false);
  test(BT.blocks.map(b=>b.h).join(',')==='976001,976002','Bitcoin block ordering uses height despite nonmonotonic timestamps');
  btcMerge([{height:976002,timestamp:1001,id:'c'.repeat(64)}],false);
  test(BT.byH.get(976002).ts===1001,'Bitcoin replaces a changed block at the same height');
  let announcements=0;bus.on('btcblock',()=>announcements++);
  const latest={height:976003,timestamp:1000,id:'d'.repeat(64)};
  go('blocks');btcMerge([latest],true,true);
  btcMerge([{height:976002,timestamp:1001,id:'c'.repeat(64)}],true,true);
  btcMerge([latest],true,true);
  test(S.btc===latest.height&&announcements===1,'lagging Bitcoin snapshots cannot rewind the tip or replay its announcement');
  test(BX.d===-1&&BX.st===null,'non-increasing Bitcoin timestamps do not produce Zenon interval counts');
  if(typeof validateRange==='function'){let rejected=false;try{validateRange([{momentum:{height:1,timestamp:GENESIS_TS,hash:'a'.repeat(64)},blocks:[]}],1,2)}catch(e){rejected=true}test(rejected,'incomplete RPC ranges cannot qualify as complete coverage');}
  else test(false,'incomplete RPC ranges cannot qualify as complete coverage');
  const payloads=Array.from({length:1601},(_,i)=>({blockType:2,hash:(i+5000).toString(16).padStart(64,'0'),address:'sender',toAddress:'recipient',amount:'0',tokenStandard:ZNN,usedPlasma:21000,fusedPlasma:21000,difficulty:0}));
  seed([make(cur,200,payloads)]);BL.layout(false);
  test(BL.sq.size===1600&&BL.caption().includes('1,600 of 1,601'),'mosaic disclosure matches its 1600-block display cap');
  seed([make(cur,300,payloads.slice(0,50).map((b,i)=>({...b,address:'sender-'+i,toAddress:'recipient'})))]);LM.build(serverNow());
  test(LM.lay.bl.length===50&&LM.lay.order.length===36&&LM.lay.shown===35,'loom distinguishes sampled blocks from blocks on displayed threads');
  const sendHash='e'.repeat(64),receiveHash='f'.repeat(64);
  seed([make(cur-1,400,[{...payloads[0],hash:sendHash,address:'alice',toAddress:'bob'}]),make(cur,401,[{...payloads[0],hash:receiveHash,blockType:3,address:'bob',toAddress:'',fromBlockHash:sendHash}])]);LM.build(serverNow());
  test(LM.lay.recvOf.has(sendHash)&&LM.lay.sends.get(sendHash).from==='alice','loom send-to-receive links follow fromBlockHash');
  return results;
 });
 for(const r of results)check(r.ok,r.name,r.detail||'');
 await page.close();
 const unavailable=await browser.newPage();
 await unavailable.goto(local+'?node='+encodeURIComponent('ws://localhost:8857/ws')+'&btcapi='+encodeURIComponent(local+'offline-bitcoin')+'#clocks');
 let selected=true;try{await unavailable.waitForFunction(()=>SC.cur>=0&&SC.list[SC.cur].id==='clocks'&&!document.querySelector('#availability').hidden,{},{timeout:20000});}catch{selected=false}
 check(selected,'an unavailable Bitcoin scene shows an explanation instead of holding the intro forever',selected?'':JSON.stringify(await unavailable.evaluate(()=>({scene:SC.list[SC.cur]?.id,noticeHidden:document.querySelector('#availability').hidden,bitcoin:BT.blocks.length,mode:S.mode}))));await unavailable.close();
 const partial=await browser.newPage();await partial.goto(local+'?node='+encodeURIComponent('ws://localhost:8857/incomplete,ws://localhost:8857/ws')+'&btcapi='+encodeURIComponent(local.slice(0,-1)));
 let complete=true;try{await partial.waitForFunction(()=>S.ready&&node.url.endsWith('/ws'),{},{timeout:11000});}catch{complete=false}
 check(complete,'incomplete node data fails over to a complete source');await partial.close();
 const slow=await browser.newPage();await slow.goto(local+'?node='+encodeURIComponent('ws://localhost:8857/slowhistory')+'&btcapi='+encodeURIComponent(local.slice(0,-1))+'#history');
 let progressive=true;try{await slow.waitForFunction(()=>S.hs&&S.hist.length>=3&&!S.historyComplete&&SC.cur>=0&&SC.list[SC.cur].id==='history'&&document.querySelector('#availability').hidden,{},{timeout:15000})}catch{progressive=false}
 check(progressive,'partial history becomes usable before later sample groups finish');await slow.close();
 const touch=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 touch.on('pageerror',e=>errors.push(e.message));
 await touch.goto(target(local,'blocks'));
 await touch.waitForFunction(()=>SC.list[SC.cur]===BL&&BL.sq.size>0);
 const tile=await touch.evaluate(()=>{
  const r=BL.cv.getBoundingClientRect(),q=BL.sq.values().next().value,cell=r.width/BL.G;
  return {x:r.left+(q.tx+q.ts/2)*cell,y:r.top+(q.ty+q.ts/2)*cell};
 });
 await touch.touchscreen.tap(tile.x,tile.y);
 check(await touch.evaluate("!!BL.hl&&$('#tip').classList.contains('show')&&!NT.open"),'first touch exposes the tile card without opening the notary');
 await touch.touchscreen.tap(tile.x,tile.y);
 check(await touch.evaluate("NT.open&&!BL.hl&&!$('#tip').classList.contains('show')"),'second touch opens the notary and clears the tile card');
 await touch.keyboard.press('Escape');
 await touch.touchscreen.tap(tile.x,tile.y);await touch.touchscreen.tap(4,160);
 check(await touch.evaluate('!BL.hl&&!NT.open'),'touching outside the mosaic releases the scene');
 await touch.close();
 check(errors.length===0,'data controls have no browser errors',errors.join(' | '));
}
async function live(base){
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(target(base,'dial'));if(!await prerequisites(page)){await page.close();return}
 const evidence=await page.evaluate(async()=>{
  const sample=S.ms.at(-10),response=await node.call('ledger.getDetailedMomentumsByHeight',[sample.h,1]);const raw=response.list[0];
  return{node:S.node,mode:S.mode,frontier:S.frontier,age:Date.now()/1000-S.lastTs,pillars:S.pillars.length,bitcoin:S.btc,historyLast:S.hs.h.at(-1),sampleHeight:sample.h,sampleHash:sample.hash,sampleHashMatches:raw.momentum.hash===sample.hash,sampleCountMatches:raw.blocks.length===sample.n,nativeVolume:sample.moved,genesis:S.genesis.btc,loaded:S.ms.length};
 });console.log('LIVE '+JSON.stringify(evidence));check(evidence.mode==='live'&&evidence.age>=-30&&evidence.age<90,'live node frontier is fresh');check(evidence.sampleHashMatches&&evidence.sampleCountMatches,'loaded account blocks match a fresh RPC response at the pinned height');check(evidence.historyLast===evidence.frontier,'live history endpoint follows the current observed frontier');
 const WebSocket=require('ws');let reference=null;
 for(const url of ['wss://node.atsocy.com:35998','wss://my.hc1node.com:35998']){
  if(new URL(url).hostname===evidence.node)continue;
  const result=await new Promise(resolve=>{const ws=new WebSocket(url,{handshakeTimeout:8000});const timer=setTimeout(()=>{ws.terminate();resolve(null)},12000);ws.on('error',()=>{clearTimeout(timer);resolve(null)});ws.on('open',()=>ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'ledger.getMomentumsByHeight',params:[evidence.sampleHeight,1]})));ws.on('message',raw=>{clearTimeout(timer);try{resolve(JSON.parse(raw).result?.list?.[0]||null)}catch{resolve(null)}ws.close()});});
  console.log('REFERENCE '+JSON.stringify({url,available:!!result,height:result?.height,hash:result?.hash}));if(result){reference=result;break}
 }
 check(reference?.hash===evidence.sampleHash,'a second public node agrees at the sampled height',reference?String(reference.height):'reference unavailable');
 for(const scene of scenes){await page.evaluate(id=>{location.hash=id},scene);await page.waitForFunction(id=>SC.cur>=0&&SC.list[SC.cur].id===id,scene,{timeout:30000});check(await page.locator('#statusTxt').innerText().then(t=>t.startsWith('LIVE')),'live scene '+scene);}
 check(errors.length===0,'live audit has no browser errors',errors.join(' | '));await page.close();
}
async function mobile(base){
 const page=await browser.newPage({viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const proto=CanvasRenderingContext2D.prototype,original=proto.fillText;proto.fillText=function(text,x,y,maxWidth){if(window.__capture&&this.canvas.isConnected&&this.globalAlpha>.15&&!this.__clipped){const r=this.canvas.getBoundingClientRect(),m=this.getTransform(),metric=this.measureText(text),width=Math.min(metric.width,maxWidth||Infinity),height=parseFloat(this.font.match(/([\d.]+)px/)?.[1]||12);let left=x-(this.textAlign==='center'?width/2:['right','end'].includes(this.textAlign)?width:0),top=y-(['top','hanging'].includes(this.textBaseline)?0:this.textBaseline==='middle'?height/2:height);const points=[[left,top],[left+width,top],[left,top+height],[left+width,top+height]].map(([a,b])=>({x:r.left+(m.a*a+m.c*b+m.e)*r.width/this.canvas.width,y:r.top+(m.b*a+m.d*b+m.f)*r.height/this.canvas.height}));if(points.some(p=>p.x< -2||p.x>innerWidth+2||p.y< -2||p.y>innerHeight+2))window.__overflow.push(String(text).slice(0,100));}return original.call(this,text,x,y,...(maxWidth===undefined?[]:[maxWidth]));};const clip=proto.clip,save=proto.save,restore=proto.restore;proto.clip=function(...a){this.__clipped=true;return clip.apply(this,a)};proto.save=function(){(this.__clips||=[]).push(!!this.__clipped);return save.call(this)};proto.restore=function(){this.__clipped=this.__clips?.pop()||false;return restore.call(this)};});
 await page.goto(target(base,'dial'));if(!await prerequisites(page)){await page.close();return}
 for(const [width,height]of [[320,568],[390,844],[844,390],[768,1024]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(300);
  for(const id of scenes){await page.evaluate(id=>{location.hash=id},id);await page.waitForFunction(id=>SC.cur>=0&&SC.list[SC.cur].id===id,id,{timeout:10000});
   await page.waitForTimeout(id==='blocks'?3200:1700);
   const overflow=await page.evaluate(()=>{const s=SC.list[SC.cur];s.t0=performance.now()-12000;BX.t=0;window.__overflow=[];window.__capture=true;try{s.frame?.(12,.01,performance.now(),false)}finally{window.__capture=false}return [...new Set(window.__overflow)]});
   const dom=await page.evaluate(()=>{if(document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight)return false;if(SC.list[SC.cur].id==='blocks'){const r=document.querySelector('.mwrap').getBoundingClientRect();return r.top>=document.querySelector('#hud').getBoundingClientRect().bottom+8&&r.bottom<=innerHeight+1}return true});
   await page.screenshot({path:path.join(shots,`${width}x${height}_${id}.png`)});check(overflow.length===0&&dom,`${width}x${height} ${id} canvas labels and page bounds fit`,[...overflow.slice(0,3),...(!dom?['document overflow']:[])].join(' | '));
  }
 }
 check(errors.length===0,'responsive audit has no browser errors',errors.join(' | '));await page.close();
}
