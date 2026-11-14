import http from 'node:http';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {SAMPLE_LESSONS} from '../packages/shared/src/lessons.ts';
const cases=[
{slug:'ohms-law',version:'1.4.33',screenId:'main',values:{voltage:6,resistance:300},action:'observe',evidence:'ohm'},
{slug:'projectile-motion',version:'1.0.36',screenId:'intro',values:{speed:20,angle:40,height:2,airResistance:false},action:'fire',evidence:'projectile'},
{slug:'gas-properties',version:'1.1.12',screenId:'ideal',values:{injectionTemperatureK:300,heavyParticles:150,lightParticles:0,widthNm:10,holdConstant:'temperature'},action:'observe',evidence:'gas'},
{slug:'wave-on-a-string',version:'1.2.6',screenId:'main',values:{frequency:1.5,amplitude:0.75,tension:0.8,damping:0,waveMode:'OSCILLATE'},action:'run',evidence:'wave'},
{slug:'bending-light',version:'1.2.7',screenId:'intro',values:{angleDeg:45,upperMedium:'air',lowerMedium:'glass',wavelengthNm:650,laserOn:true,showNormal:true,showAngles:true},action:'observe',evidence:'optics'},
{slug:'build-a-nucleus',version:'1.1.12',screenId:'decay',values:{protons:6,neutrons:6},action:'observe',evidence:'nucleus'}];
// Exercise the app's authored sample contract, not a second copy of its settings.
for(const item of cases){
  const lesson=SAMPLE_LESSONS.find(candidate=>candidate.slug===item.slug);
  assert.ok(lesson,'Every verified adapter needs an authored sample');
  item.screenId=lesson.config.screenId;item.values=lesson.config.values;
  item.action=lesson.experiment.action;item.args=lesson.experiment.args;
}
const publish=process.argv.includes('--publish');
await mkdir('.qa',{recursive:true});
const token='six-contract-current-load-12345',raws=new Map();
for(const item of cases)raws.set(item.slug,await readFile(`apps/server/storage/phet-sims/originals/${item.slug}/${item.version}/${item.slug}_vi.html`,'utf8'));
const server=http.createServer(async(req,res)=>{try{
const u=new URL(req.url,'http://localhost'),item=cases.find(i=>i.slug===u.searchParams.get('slug'))||cases[0];
if(u.pathname==='/'){
res.setHeader('Content-Type','text/html; charset=utf-8');const origin=`http://127.0.0.1:${server.address().port}`;
res.end(`<iframe id="sim" style="width:1000px;height:750px" src="/sim.html?slug=${item.slug}&physimParentOrigin=${encodeURIComponent(origin)}&physimLoadId=${token}"></iframe><script>window.messages=[];window.addEventListener('message',e=>{let m=e.data;if(typeof m==='string'){try{m=JSON.parse(m)}catch{return}}window.messages.push(m)});document.querySelector('iframe').onload=()=>document.querySelector('iframe').contentWindow.postMessage(JSON.stringify({protocol:'physim-bridge',version:1,loadId:'${token}',type:'INIT',requestId:'init',payload:{}}),location.origin);</script>`);
}else if(u.pathname==='/sim.html'){
res.setHeader('Content-Type','text/html; charset=utf-8');const raw=raws.get(item.slug),i=raw.lastIndexOf('</body>');assert.ok(i>=0);
res.end(raw.slice(0,i)+`<script>window.__PHYSIM_SIM__=${JSON.stringify({slug:item.slug,version:item.version,locale:'vi',adapterVerified:true})};</script><script src="/bridge/adapters.js"></script><script src="/bridge/physim-bridge.js"></script>`+raw.slice(i));
}else if(u.pathname.startsWith('/bridge/')){res.setHeader('Content-Type','text/javascript');res.end(await readFile(path.join('apps/server/src/phet-bridge',path.basename(u.pathname))));}
else{res.statusCode=404;res.end();}
}catch(error){res.statusCode=500;res.end(error.message);}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const candidates=[process.env.PHYSIM_BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
let executablePath;for(const candidate of candidates){try{await access(candidate);executablePath=candidate;break;}catch{}}
const browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true,args:['--disable-gpu','--in-process-gpu']});
const report={schemaVersion:1,verifiedAt:new Date().toISOString(),adapters:{}};
try{for(const item of cases){
const page=await browser.newPage({viewport:{width:1050,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
await page.goto(`http://127.0.0.1:${server.address().port}/?slug=${item.slug}`);
await page.waitForFunction(()=>window.messages.some(m=>m?.type==='READY'),null,{timeout:55000});
const ask=(type,payload={})=>page.evaluate(({type,payload,token})=>new Promise((resolve,reject)=>{
const requestId='test-'+Math.random().toString(36).slice(2);
const listener=event=>{let data=event.data;if(typeof data==='string'){try{data=JSON.parse(data)}catch{return}}if(data.requestId===requestId){removeEventListener('message',listener);clearTimeout(timer);resolve(data)}};
const timer=setTimeout(()=>{removeEventListener('message',listener);reject(Error('Bridge timeout '+type))},30000);
addEventListener('message',listener);document.querySelector('iframe').contentWindow.postMessage(JSON.stringify({protocol:'physim-bridge',version:1,loadId:token,requestId,type,payload}),location.origin);
}),{type,payload,token});
const ready=await page.evaluate(()=>window.messages.find(m=>m?.type==='READY'));
assert.equal(ready.payload.schema.adapterVerified,true,item.slug+' adapter must be enabled');
const applied=await ask('APPLY_CONFIG',{slug:item.slug,version:item.version,screenId:item.screenId,values:item.values});assert.equal(applied.type,'RESULT',JSON.stringify(applied));
for(const [key,value] of Object.entries(item.values)){if(typeof value==='number')assert.ok(Math.abs(applied.payload.values[key]-value)<1e-7,`${item.slug}.${key}: ${value} != ${applied.payload.values[key]}`);else assert.equal(applied.payload.values[key],value,item.slug+'.'+key);}
const action=await ask('RUN_EXPERIMENT',{action:item.action,...(item.args?{args:item.args}:{})});assert.equal(action.type,'RESULT',JSON.stringify(action));assert.ok(action.payload.measurement);
const invalid=await ask('APPLY_CONFIG',{screenId:item.screenId,values:{...item.values,unregistered:99}});assert.equal(invalid.payload.code,'INVALID_CONFIG');
const reset=await ask('RESET_SIM');assert.equal(reset.type,'RESULT',JSON.stringify(reset));
if(item.slug==='build-a-nucleus'){const switched=await ask('SWITCH_SCREEN',{screenId:'chart'});assert.equal(switched.type,'RESULT',JSON.stringify(switched));assert.equal(switched.payload.screenId,'chart');assert.equal((await ask('APPLY_CONFIG',{screenId:'chart',values:{protons:2,neutrons:2}})).type,'RESULT');assert.equal((await ask('RUN_EXPERIMENT',{action:'observe'})).payload.measurement.massNumber,4);}
assert.deepEqual(errors,[],item.slug+' browser errors');
const evidence=JSON.parse(await readFile(`packages/shared/data/adapter-evidence/${item.slug}.json`,'utf8'));const sourceSha256=createHash('sha256').update(raws.get(item.slug)).digest('hex');assert.equal(evidence.sourceSha256,sourceSha256);
const map={applyConfig:'APPLY_CONFIG',runExperiment:'RUN_EXPERIMENT',switchScreen:'SWITCH_SCREEN',resetSim:'RESET_SIM',getState:'GET_STATE',telemetry:'PROPERTY_CHANGED'};
const capabilities=Object.entries(ready.payload.capabilities).filter(([key,value])=>value).map(([key])=>map[key]);
report.adapters[item.slug]={version:item.version,sourceSha256,verified:true,capabilities,schema:ready.payload.schema,checks:[...evidence.checks,'full iframe INIT/READY transport','config apply/read via bridge','registered experiment through bridge','invalid complete config rejected','bridge RESET_SIM'],measurement:action.payload.measurement,evidenceFile:`adapter-evidence/${item.slug}.json`};
if(publish)await writeFile(`packages/shared/data/adapter-evidence/${item.slug}.json`,JSON.stringify({...evidence,transportVerifiedAt:new Date().toISOString(),transportMeasurement:action.payload.measurement},null,2));console.log('PASS',item.slug,JSON.stringify(action.payload.measurement));
}finally{await page.close();}}
if(publish)await writeFile('packages/shared/data/adapter-schemas.json',JSON.stringify(report,null,2));await writeFile('.qa/bridge-six-contracts-report.json',JSON.stringify(report,null,2));console.log(publish?'All six verified schemas published.':'All six bridge contracts passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
