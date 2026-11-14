import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSourceEvidence } from './phet-source-scan.mjs';

export const METADATA_URL = 'https://phet.colorado.edu/services/metadata/1.3/simulations?format=json&locale=en';
export const EXPECTED_COUNT = 74;
export const CHAPTERS = [
  { id: 'mechanics', title: 'Cơ học' }, { id: 'thermal', title: 'Nhiệt & Chất khí' },
  { id: 'electricity', title: 'Điện & Từ' }, { id: 'waves', title: 'Dao động & Sóng' },
  { id: 'optics', title: 'Quang học' }, { id: 'nuclear', title: 'Nguyên tử & Hạt nhân' }
];
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RENDERER_VERSION = 2;
const OVERRIDES = {
  'greenhouse-effect': ['thermal', 'Bổ sung theo phạm vi thí điểm: hiệu ứng nhà kính.'],
  'projectile-sampling-distributions': ['mechanics', 'Bổ sung theo phạm vi thí điểm: chuyển động ném.'],
  'build-a-nucleus': ['nuclear', 'Mô phỏng hạt nhân chưa có nhãn con Vật lý.'],
  'build-an-atom': ['nuclear', 'Mô phỏng nguyên tử chưa có nhãn con Vật lý.'],
  'quantum-coin-toss': ['nuclear', 'Phép đo lượng tử, nhãn con Vật lý chưa được gán.'],
  'density': ['mechanics', 'Khối lượng riêng và lực đẩy; chưa có nhãn con Vật lý.'],
  'under-pressure': ['mechanics', 'Áp suất chất lỏng; chưa có nhãn con Vật lý.'],
  'curve-fitting': ['mechanics', 'Công cụ xử lý số liệu thực nghiệm; chưa có nhãn con Vật lý.'],
  'fourier-making-waves': ['waves', 'Ưu tiên nội dung tổng hợp sóng thay vì các nhãn lượng tử/quang học.'],
  'quantum-wave-interference': ['nuclear', 'Giao thoa lượng tử, khác sóng cơ học.'],
  'wave-interference': ['waves', 'Mục đa chủ đề sóng/ánh sáng, nhóm sóng.'],
  'waves-intro': ['waves', 'Mục đa chủ đề sóng/ánh sáng, nhóm sóng.'],
  'friction': ['thermal', 'Mục đa chủ đề chuyển động/nhiệt, tập trung sinh nhiệt do ma sát.'],
  'energy-forms-and-changes': ['thermal', 'Mục đa chủ đề năng lượng/nhiệt, tập trung trao đổi nhiệt.'],
  'gas-properties': ['thermal', 'Mục đa chủ đề năng lượng/nhiệt, mô hình khí.'],
  'blackbody-spectrum': ['nuclear', 'Mục đa chủ đề quang/lượng tử, bức xạ vật đen.'],
  'models-of-the-hydrogen-atom': ['nuclear', 'Mục đa chủ đề quang/lượng tử, mô hình nguyên tử.'],
  'pendulum-lab': ['waves', 'Dao động con lắc, trong metadata gắn nhãn chuyển động/năng lượng.'],
  'masses-and-springs': ['waves', 'Dao động lò xo, trong metadata gắn nhãn chuyển động/năng lượng.'],
  'masses-and-springs-basics': ['waves', 'Dao động lò xo, trong metadata gắn nhãn chuyển động.']
};
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const safeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeVersion = /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/;

export function classifySimulation(slug, subjects) {
  if (OVERRIDES[slug]) return { chapter: OVERRIDES[slug][0], chapterReason: OVERRIDES[slug][1], chapterOverride: true };
  const tag = [[11,'electricity'],[8,'thermal'],[9,'nuclear'],[6,'waves'],[10,'optics'],[5,'mechanics'],[7,'mechanics']].find(([id]) => subjects.includes(id));
  if (!tag) throw new Error(`Thiếu ánh xạ chương có bằng chứng: ${slug}`);
  return { chapter: tag[1], chapterReason: `Nhãn chủ đề PhET ${tag[0]}.`, chapterOverride: false };
}

export function selectCatalog(metadata) {
  if (!Array.isArray(metadata?.projects)) throw new Error('PhET metadata không có projects.');
  const html = metadata.projects.filter(p => p.type === 2).flatMap(project => project.simulations.map(sim => ({project,sim})));
  const physics = html.filter(({sim}) => sim.subjects.includes(4));
  if (physics.length !== 72) throw new Error(`Danh mục Vật lý đã thay đổi (${physics.length}, cần 72). Cần rà soát manifest trước khi đồng bộ.`);
  const entries = [...physics];
  for (const slug of ['greenhouse-effect','projectile-sampling-distributions']) {
    const extra = html.find(({sim}) => sim.name === slug);
    if (!extra) throw new Error(`Không tìm thấy ${slug} trong metadata.`);
    if (!entries.some(({sim}) => sim.name === slug)) entries.push(extra);
  }
  const result = entries.map(({project,sim}) => {
    if (!safeSlug.test(sim.name) || !safeVersion.test(project.version.string)) throw new Error('Slug hoặc phiên bản không hợp lệ.');
    return {
      slug: sim.name, title: sim.localizedSimulations.en.title, titleEn: sim.localizedSimulations.en.title,
      version: project.version.string, subjects: sim.subjects,
      ...classifySimulation(sim.name, sim.subjects), metadataId: sim.id,
      metadataUpdatedAt: new Date(sim.updateTime).toISOString(), metadataLicenseUrls: sim.licenseUrls,
      sourcePage: `https://phet.colorado.edu/en/simulations/${sim.name}`
    };
  }).sort((a,b) => a.slug.localeCompare(b.slug));
  validateCatalogCount(result);
  return result;
}
export function validateCatalogCount(items, count = EXPECTED_COUNT) {
  if (items.length !== count || new Set(items.map(x => x.slug)).size !== count) throw new Error(`Cần đúng ${count} slug duy nhất.`);
  if (items.some(x => !safeSlug.test(x.slug) || !safeVersion.test(x.version))) throw new Error('Slug hoặc phiên bản manifest không an toàn.');
}
function decodeTitle(value) {
  const names='nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(' ');
  const entities=Object.fromEntries(names.map((name,index)=>[name,String.fromCodePoint(160+index)]));
  return value.replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))
    .replace(/&([a-zA-Z]+);/g,(match,name)=>entities[name]??match)
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/[\u202a-\u202e\u2066-\u2069]/g,'').trim();
}
function readJsonAssignment(html, name) {
  const match = new RegExp(`(?:window\\.)?phet\\.chipper\\.${name}\\s*=\\s*`).exec(html);
  if (!match) return null;
  const start = match.index + match[0].length;
  if (html[start] !== '{') return null;
  let depth=0, quoted=false, escape=false;
  for(let i=start;i<html.length;i++) {
    const c=html[i];
    if(quoted) { if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue; }
    if(c==='"')quoted=true;
    else if(c==='{')depth++;
    else if(c==='}'&&--depth===0) { try{return JSON.parse(html.slice(start,i+1));}catch{return null;} }
  }
  return null;
}
export function inspectHtml(html, {slug,version,locale}) {
  if (html.length < 10000 || !/<\/html\s*>/i.test(html)) throw new Error('HTML mô phỏng bị thiếu hoặc không hoàn chỉnh.');
  const read = key => html.match(new RegExp(`window\\.phet\\.chipper\\.${key}\\s*=\\s*['"]([^'"]+)['"]`))?.[1];
  if (read('project') !== slug || read('version') !== version) throw new Error(`HTML không khớp slug/phiên bản ${slug}@${version}.`);
  if (read('locale') !== locale || html.match(/<html[^>]+lang=['"]([^'"]+)/i)?.[1] !== locale) throw new Error(`Sai locale ${slug}: cần ${locale}.`);
  const timestamp = read('buildTimestamp');
  const date = timestamp ? new Date(timestamp) : null;
  const license = /This file is licensed under Creative Commons Attribution-NonCommercial 4\.0/i.test(html)
    ? { id:'CC-BY-NC-4.0', url:'https://creativecommons.org/licenses/by-nc/4.0/' }
    : /This file is licensed under Creative Commons Attribution 4\.0|Creative Commons Attribution 4\.0 International/i.test(html)
      ? { id:'CC-BY-4.0', url:'https://creativecommons.org/licenses/by/4.0/' } : null;
  if (!license) throw new Error(`Không xác định được giấy phép từ HTML ${slug}.`);
  const localizedStrings=readJsonAssignment(html,'strings')?.[locale];
  const nativeTitle=localizedStrings && Object.entries(localizedStrings).find(([key])=>key.endsWith(`/${slug}.title`))?.[1];
  return {
    title: decodeTitle(typeof nativeTitle==='string'?nativeTitle:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || slug)),
    releaseDate: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    license, declared: { slug:read('project'), version:read('version'), locale:read('locale'), buildTimestamp:timestamp },
    attribution: `Mô phỏng của PhET Interactive Simulations, University of Colorado Boulder, ${license.id}. Physim-AI thêm cầu nối điều khiển; giữ nguyên mô phỏng và thông báo bản quyền.`
  };
}
export async function fetchWithRetry(url, { fetchImpl = fetch, retries = 3, timeoutMs = 120000, delay = ms => new Promise(r=>setTimeout(r,ms)) } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        const error = Object.assign(new Error(`HTTP ${response.status}: ${url}`),{status:response.status});
        if (response.status < 500 && response.status !== 429 && response.status !== 408) throw Object.assign(error,{permanent:true});
        throw error;
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      last = error;
      if (error.permanent || attempt === retries) throw error;
      await delay(Math.min(5000,250 * 2 ** attempt));
    }
  }
  throw last;
}
export async function downloadSimulation(entry, { storageDir, fetchImpl = fetch, previous, log = console.log } = {}) {
  const failures = [];
  for (const locale of ['vi','en']) {
    const sourceUrl = `https://phet.colorado.edu/sims/html/${entry.slug}/${entry.version}/${entry.slug}_${locale}.html`;
    const originalPath = path.join('originals',entry.slug,entry.version,`${entry.slug}_${locale}.html`);
    const absolute = path.join(storageDir,originalPath);
    try {
      let bytes;
      try {
        bytes = await fs.readFile(absolute);
        inspectHtml(bytes.toString('utf8'), {...entry,locale});
        if (previous?.locale === locale && previous.version === entry.version && previous.sha256 !== sha256(bytes)) throw new Error('Cached source checksum mismatch');
      } catch { bytes = await fetchWithRetry(sourceUrl,{fetchImpl}); }
      const html = bytes.toString('utf8');
      const evidence = inspectHtml(html,{...entry,locale});
      const hash = sha256(bytes);
      if (previous?.version === entry.version && previous.locale === locale && previous.sha256 !== hash) throw Object.assign(new Error(`Nguồn ${entry.slug}@${entry.version} thay đổi checksum. Không kích hoạt.`),{integrityFailure:true});
      await fs.mkdir(path.dirname(absolute),{recursive:true});
      await fs.writeFile(absolute,bytes);
      log(`${entry.slug}@${entry.version} [${locale}] ${Math.round(bytes.length/1024)} KiB`);
      return { ...entry, ...evidence, locale, sourceUrl, sha256:hash, originalPath:originalPath.replaceAll('\\','/'), bytes:bytes.length, fallbackReason:locale==='en'?failures.join('; '):null };
    } catch (error) { if(error.integrityFailure)throw error;failures.push(`${locale}: ${error.message}`); }
  }
  throw new Error(`Không tải/xác minh được ${entry.slug}: ${failures.join('; ')}`);
}

export function injectBridge(html, entry, adapterVerified) {
  const metadata = JSON.stringify({slug:entry.slug,version:entry.version,locale:entry.locale,adapterVerified}).replaceAll('<','\\u003c');
  const addition = `\n<!-- Physim-AI modification: external educational bridge; original PhET bundle and legal notices preserved. -->\n<script>window.__PHYSIM_SIM__=${metadata};</script>\n<script src="/bridge/adapters.js"></script>\n<script src="/bridge/physim-bridge.js"></script>\n`;
  // Bundled PhET JavaScript contains literal '</body>' debug strings. Only the
  // final document body close is safe; replacing the first match corrupts JS.
  const closing=Array.from(html.matchAll(/<\/body\s*>/gi)).at(-1);
  if(!closing)throw new Error(`Thiếu thẻ đóng body trong ${entry.slug}.`);
  return html.slice(0,closing.index)+addition+html.slice(closing.index);
}
async function optionalJson(file, fallback) { try { return JSON.parse(await fs.readFile(file,'utf8')); } catch(error) { if(error.code==='ENOENT')return fallback;throw error; } }
export async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  const temp=`${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n');
  try { await fs.rename(temp,file); } catch(error) { await fs.unlink(temp).catch(()=>{});throw error; }
}
async function mapLimit(items,limit,work) {
  const result = new Array(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;result[index]=await work(items[index],index);}}));
  return result;
}
export function adapterForEntry(entry, registry) {
  const adapter = registry?.adapters?.[entry.slug];
  return adapter?.verified === true && adapter.version === entry.version && adapter.sourceSha256 === entry.sha256 ? adapter : null;
}
export async function activateGeneration(entries, {storageDir, registry = {}, expectedCount = EXPECTED_COUNT, beforeCommit} = {}) {
  validateCatalogCount(entries,expectedCount);
  const generation = sha256(JSON.stringify({rendererVersion:RENDERER_VERSION,sources:entries.map(e=>[e.slug,e.version,e.locale,e.sha256]),registry})).slice(0,20);
  const generationPath = path.join(storageDir,'generations',generation);
  await fs.mkdir(generationPath,{recursive:true});
  const schemas = {};
  const manifest = [];
  for (const entry of entries) {
    const bytes = await fs.readFile(path.join(storageDir,entry.originalPath));
    if (sha256(bytes)!==entry.sha256) throw new Error(`Nguồn thay đổi trước khi kích hoạt: ${entry.slug}`);
    inspectHtml(bytes.toString('utf8'),entry);
    const adapter = adapterForEntry(entry,registry);
    const schema = adapter?.schema || {slug:entry.slug,version:entry.version,screens:[],properties:[],actions:[],capabilities:['GET_STATE'],adapterVerified:false};
    schemas[entry.slug] = {...schema,slug:entry.slug,version:entry.version,adapterVerified:Boolean(adapter)};
    const htmlPath = path.join('generations',generation,'html',entry.slug,entry.version,`${entry.locale}.html`).replaceAll('\\','/');
    const html = injectBridge(bytes.toString('utf8'),entry,Boolean(adapter));
    await fs.mkdir(path.dirname(path.join(storageDir,htmlPath)),{recursive:true});
    const renderedFile=path.join(storageDir,htmlPath);
    const renderedTemp=`${renderedFile}.${randomUUID()}.tmp`;
    await fs.writeFile(renderedTemp,html);
    await fs.rename(renderedTemp,renderedFile);
    const allowedCapabilities=new Set(['GET_STATE','APPLY_CONFIG','RUN_EXPERIMENT','SWITCH_SCREEN','RESET_SIM','PROPERTY_CHANGED']);
    const capabilities=adapter && Array.isArray(adapter.capabilities)
      ? [...new Set(adapter.capabilities.filter(value=>allowedCapabilities.has(value)))] : ['GET_STATE'];
    manifest.push({...entry,htmlPath,renderedSha256:sha256(html),adapterVerified:Boolean(adapter),capabilities});
  }
  const snapshot = {schemaVersion:1,generation,chapters:CHAPTERS,simulations:manifest};
  await writeJsonAtomic(path.join(generationPath,'manifest.json'),snapshot);
  await writeJsonAtomic(path.join(generationPath,'sim-schemas.json'),{schemaVersion:1,generation,simulations:schemas});
  if(beforeCommit)await beforeCommit(snapshot);
  // One atomic pointer commits both manifest and schemas. A failed generation cannot replace the working set.
  await writeJsonAtomic(path.join(storageDir,'active.json'),{schemaVersion:1,generation,manifestPath:`generations/${generation}/manifest.json`,schemaPath:`generations/${generation}/sim-schemas.json`});
  return snapshot;
}

export async function syncPhet({ root = ROOT, fetchImpl = fetch, concurrency = 6, update = false, log = console.log } = {}) {
  if (!Number.isInteger(concurrency) || concurrency<1 || concurrency>12) throw new Error('Concurrency phải từ 1 đến 12.');
  const storageDir=path.join(root,'apps/server/storage/phet-sims');
  const dataDir=path.join(root,'packages/shared/data');
  const metadataBytes = await fetchWithRetry(METADATA_URL,{fetchImpl});
  const metadata=JSON.parse(metadataBytes.toString('utf8'));
  const discovered=selectCatalog(metadata);
  const lockPath=path.join(dataDir,'phet-catalog.lock.json');
  const existing=await optionalJson(lockPath,null);
  const entries=existing&&!update?existing.simulations:discovered;
  validateCatalogCount(entries);
  const discoveredSlugs=new Set(discovered.map(x=>x.slug));
  if(entries.some(x=>!discoveredSlugs.has(x.slug)))throw new Error('Danh mục đã ghim không còn khớp tập 74 mô phỏng metadata.');
  await fs.mkdir(storageDir,{recursive:true});
  await fs.writeFile(path.join(storageDir,'metadata-source.json'),metadataBytes);
  if(!existing)await writeJsonAtomic(lockPath,{schemaVersion:1,metadataUrl:METADATA_URL,simulations:entries});
  const previous=await optionalJson(path.join(dataDir,'phet-manifest.json'),{simulations:[]});
  const downloaded=await mapLimit(entries,concurrency,entry=>downloadSimulation(entry,{storageDir,fetchImpl,previous:previous.simulations.find(p=>p.slug===entry.slug),log}));
  // Public-source evidence is descriptive only. Missing exact source is recorded,
  // never replaced with an unrelated main branch or used to grant write access.
  await scanSourceEvidence({root,manifest:downloaded,fetchImpl,log});
  const registry=await optionalJson(path.join(dataDir,'adapter-schemas.json'),{});
  const snapshot=await activateGeneration(downloaded,{storageDir,registry,beforeCommit:async snapshot=>{
    await writeJsonAtomic(path.join(dataDir,'phet-manifest.json'),snapshot);
    if(update)await writeJsonAtomic(lockPath,{schemaVersion:1,metadataUrl:METADATA_URL,simulations:entries});
  }});
  log(`Đã kích hoạt ${snapshot.simulations.length} mô phỏng; generation ${snapshot.generation}.`);
  return snapshot;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const concurrencyArg=process.argv.find(a=>a.startsWith('--concurrency='));
  syncPhet({concurrency:concurrencyArg?Number(concurrencyArg.split('=')[1]):6,update:process.argv.includes('--update')})
    .catch(error=>{console.error(`PhET sync thất bại; bộ đang hoạt động được giữ nguyên. ${error.message}`);process.exitCode=1;});
}
