import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  selectCatalog, validateCatalogCount, inspectHtml, fetchWithRetry, downloadSimulation,
  injectBridge, sha256, activateGeneration, adapterForEntry
} from '../scripts/phet-pipeline.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function temporary(t) {
  const base=path.join(root,'.qa');await fs.mkdir(base,{recursive:true});
  const dir=await fs.mkdtemp(path.join(base,'phet-pipeline-test-'));
  t.after(async()=>{if(!dir.startsWith(base+path.sep))throw new Error('Unsafe test cleanup');await fs.rm(dir,{recursive:true,force:true});});
  return dir;
}
function html(slug='ohms-law',version='1.0.0',locale='vi',extra='') {
  return `<!DOCTYPE html><html lang="${locale}"><head><title>Ph&acirc;n r&atilde;</title></head><body>
<!-- This file is licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). -->
<script>window.phet={};window.phet.chipper={};window.phet.chipper.project='${slug}';window.phet.chipper.version='${version}';window.phet.chipper.locale='${locale}';window.phet.chipper.buildTimestamp='2026-10-29 01:02:37 UTC';window.phet.chipper.strings={"${locale}":{"TEST/${slug}.title":"Định luật Ohm"}};</script>
${' '.repeat(12000)}${extra}</body></html>`;
}
const entry={slug:'ohms-law',version:'1.0.0',chapter:'electricity',title:'Ohm',titleEn:'Ohm'};
async function source(storageDir,slug='ohms-law') {
  const value={...entry,slug,locale:'vi',originalPath:`originals/${slug}/1.0.0/${slug}_vi.html`};
  const content=html(slug);await fs.mkdir(path.dirname(path.join(storageDir,value.originalPath)),{recursive:true});
  await fs.writeFile(path.join(storageDir,value.originalPath),content);
  return {...value,sha256:sha256(content)};
}

test('pinned official metadata selects exactly 72 physics + 2 additions, deterministically maps six chapters',async()=>{
  // Use the tracked catalog evidence, so clean-checkout tests never need network or downloaded HTML.
  const locked=JSON.parse(await fs.readFile(path.join(root,'packages/shared/data/phet-catalog.lock.json'),'utf8'));
  const metadata={projects:locked.simulations.map(item=>({
    type:2,name:`html/${item.slug}`,version:{string:item.version},simulations:[{
      name:item.slug,subjects:item.subjects,id:item.metadataId,updateTime:Date.parse(item.metadataUpdatedAt),
      localizedSimulations:{en:{title:item.titleEn}},licenseUrls:item.metadataLicenseUrls
    }]
  }))};
  metadata.projects.push({type:0,name:'legacy-physics',version:{string:'1.0.0'},simulations:[{name:'legacy-physics',subjects:[4]}]});
  const catalog=selectCatalog(metadata);
  assert.equal(catalog.length,74);assert.equal(new Set(catalog.map(e=>e.slug)).size,74);
  assert.equal(catalog.find(e=>e.slug==='greenhouse-effect').chapter,'thermal');
  assert.equal(catalog.find(e=>e.slug==='projectile-sampling-distributions').chapter,'mechanics');
  assert.equal(catalog.find(e=>e.slug==='build-a-nucleus').chapter,'nuclear');
  assert.equal(new Set(catalog.map(e=>e.chapter)).size,6);
  assert.deepEqual(selectCatalog(metadata),catalog);
  assert.throws(()=>validateCatalogCount([entry,entry],2),/duy nhất/);
  assert.throws(()=>validateCatalogCount([{...entry,slug:'../bad'}],1),/an toàn/);
});
test('HTML evidence rejects wrong slug/version/locale and incomplete files, preserves real Vietnamese title',()=>{
  const result=inspectHtml(html(),{...entry,locale:'vi'});
  assert.equal(result.title,'Định luật Ohm');assert.equal(result.license.id,'CC-BY-NC-4.0');
  assert.equal(result.releaseDate,'2026-10-29T01:02:37.000Z');
  assert.equal(inspectHtml(html().replace('window.phet.chipper.strings=','window.otherStrings='),{...entry,locale:'vi'}).title,'Phân rã');
  assert.throws(()=>inspectHtml(html(),{...entry,locale:'en'}),/locale/);
  assert.throws(()=>inspectHtml(html(),{...entry,version:'9.0.0',locale:'vi'}),/phiên bản/);
  assert.throws(()=>inspectHtml('<html></html>',{...entry,locale:'vi'}),/không hoàn chỉnh/);
});
test('transient 503 retries; permanent 404 does not retry',async()=>{
  let calls=0;
  const output=await fetchWithRetry('https://example.test/sim',{fetchImpl:async()=>++calls<3?new Response('',{status:503}):new Response('ready'),delay:async()=>{}});
  assert.equal(output.toString(),'ready');assert.equal(calls,3);
  calls=0;
  await assert.rejects(fetchWithRetry('https://example.test/missing',{fetchImpl:async()=>{calls++;return new Response('',{status:404});},delay:async()=>{}}),/404/);
  assert.equal(calls,1);
});
test('wrong Vietnamese locale falls back to English; cached validated file avoids second download',async t=>{
  const storageDir=await temporary(t);const calls=[];
  const fetchImpl=async url=>{calls.push(url);return new Response(html('ohms-law','1.0.0','en'));};
  const result=await downloadSimulation(entry,{storageDir,fetchImpl,log:()=>{}});
  assert.equal(result.locale,'en');assert.equal(calls.length,2);assert.match(result.fallbackReason,/Sai locale/);
  const again=await downloadSimulation(entry,{storageDir,previous:result,fetchImpl:async url=>url.endsWith('_vi.html')?new Response('',{status:404}):Promise.reject(Error('English cache should be used')),log:()=>{}});
  assert.equal(again.sha256,result.sha256);
});
test('changing the bytes of a pinned source fails closed rather than silently switching locale',async t=>{
  const storageDir=await temporary(t);const previous={...entry,locale:'vi',sha256:sha256(html())};let calls=0;
  await assert.rejects(downloadSimulation(entry,{storageDir,previous,fetchImpl:async()=>{calls++;return new Response(html('ohms-law','1.0.0','vi','changed'));},log:()=>{}}),/checksum/);
  assert.equal(calls,1);
});
test('generation activation is deterministic and failed validation keeps both previous manifest and schema active',async t=>{
  const storageDir=await temporary(t);const entries=[await source(storageDir),await source(storageDir,'gas-properties')];
  const first=await activateGeneration(entries,{storageDir,expectedCount:2});
  const pointer=await fs.readFile(path.join(storageDir,'active.json'),'utf8');
  const second=await activateGeneration(entries,{storageDir,expectedCount:2});
  assert.equal(second.generation,first.generation);
  await assert.rejects(activateGeneration(entries.slice(0,1),{storageDir,expectedCount:2}),/2 slug/);
  await assert.rejects(activateGeneration(entries,{storageDir,expectedCount:2,beforeCommit:async()=>{throw Error('disk error');}}),/disk error/);
  assert.equal(await fs.readFile(path.join(storageDir,'active.json'),'utf8'),pointer);
  await fs.appendFile(path.join(storageDir,entries[0].originalPath),'tampered');
  await assert.rejects(activateGeneration(entries,{storageDir,expectedCount:2}),/Nguồn thay đổi/);
  assert.equal(await fs.readFile(path.join(storageDir,'active.json'),'utf8'),pointer);
});
test('adapter writes require verified exact version + source SHA; bridge insertion retains original notices and bundle',()=>{
  const value={...entry,sha256:'a'.repeat(64)};
  const record={verified:true,version:'1.0.0',sourceSha256:value.sha256,schema:{screens:[]}};
  assert.equal(adapterForEntry(value,{adapters:{'ohms-law':record}}),record);
  assert.equal(adapterForEntry({...value,sha256:'b'.repeat(64)},{adapters:{'ohms-law':record}}),null);
  assert.equal(adapterForEntry({...value,version:'2.0.0'},{adapters:{'ohms-law':record}}),null);
  const original=html(),rendered=injectBridge(original,{...entry,locale:'vi'},false);
  assert.ok(rendered.includes('Creative Commons Attribution-NonCommercial'));
  assert.ok(rendered.includes('/bridge/adapters.js'));assert.ok(rendered.includes('"adapterVerified":false'));
  assert.equal(rendered.slice(0,original.indexOf('</body>')),original.slice(0,original.indexOf('</body>')));
});
test('bridge injection never changes a literal closing-body string inside the PhET JavaScript bundle',()=>{
  const original=html('ohms-law','1.0.0','vi',"<script>const debug='</body></html>';window.example=debug;</script>");
  const rendered=injectBridge(original,{...entry,locale:'vi'},false);
  assert.ok(rendered.includes("const debug='</body></html>';window.example=debug;"));
  const injection=rendered.slice(original.lastIndexOf('</body>'),rendered.lastIndexOf('</body>'));
  assert.ok(injection.includes('window.__PHYSIM_SIM__'));
  assert.equal(rendered.replace(injection,''),original);
});
