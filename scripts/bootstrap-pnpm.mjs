import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).packageManager.split('@').at(-1);
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Use the official pnpm installation for your platform. This portable bootstrap is for Windows x64.');
const target=path.join(root,'.toolchain','pnpm12');
await fs.mkdir(target,{recursive:true});
const metadata=await fetch(`https://registry.npmjs.org/@pnpm/exe.win32-x64/${version}`,{signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw new Error(`Registry status ${r.status}`);return r.json();});
const url=metadata.dist.tarball;
const probe=await fetch(url,{headers:{Range:'bytes=0-0'},signal:AbortSignal.timeout(30000)});
const total=Number(probe.headers.get('content-range')?.split('/')[1]);
await probe.arrayBuffer();
if(probe.status!==206||!Number.isSafeInteger(total)||total<=0)throw new Error('Registry did not provide a valid byte range.');
console.log(`Downloading pnpm ${version} (${Math.ceil(total/1048576)} MB).`);
const chunkSize=1048576;
const chunks=Array.from({length:Math.ceil(total/chunkSize)},(_,i)=>({start:i*chunkSize,end:Math.min(total-1,(i+1)*chunkSize-1),file:path.join(target,`${version}-${i}.part`)}));
let next=0,complete=0;
async function worker(){
  while(next<chunks.length){
    const c=chunks[next++];
    if((await fs.stat(c.file).catch(()=>({size:0}))).size===c.end-c.start+1){complete++;continue;}
    for(let retry=0;;retry++){
      try{
        const r=await fetch(url,{headers:{Range:`bytes=${c.start}-${c.end}`},signal:AbortSignal.timeout(45000)});
        if(r.status!==206||r.headers.get('content-range')!==`bytes ${c.start}-${c.end}/${total}`)throw new Error('Unexpected package range.');
        const data=Buffer.from(await r.arrayBuffer());
        if(data.length!==c.end-c.start+1)throw new Error('Incomplete package chunk.');
        await fs.writeFile(c.file,data);complete++;
        console.log(`pnpm download: ${complete}/${chunks.length}`);break;
      }catch(error){if(retry>=7)throw error;}
    }
  }
}
await Promise.all(Array.from({length:8},worker));
const archive=Buffer.concat(await Promise.all(chunks.map(c=>fs.readFile(c.file))));
if(`sha512-${createHash('sha512').update(archive).digest('base64')}`!==metadata.dist.integrity)throw new Error('Package integrity verification failed.');
const tar=gunzipSync(archive);let executable;
for(let offset=0;offset+512<=tar.length;){
  const header=tar.subarray(offset,offset+512);
  const name=header.subarray(0,100).toString().replace(/\0.*$/s,'');
  if(!name)break;
  const size=parseInt(header.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8)||0;
  if(name==='package/pnpm.exe')executable=tar.subarray(offset+512,offset+512+size);
  offset+=512+Math.ceil(size/512)*512;
}
if(!executable||executable.subarray(0,2).toString()!=='MZ')throw new Error('Verified package has no Windows executable.');
await fs.writeFile(path.join(target,'pnpm.exe'),executable);
await fs.writeFile(path.join(target,'package-metadata.json'),JSON.stringify({version,source:url,integrity:metadata.dist.integrity},null,2));
for(const c of chunks)await fs.unlink(c.file);
console.log(`Verified pnpm ${version} installed at ${target}`);
