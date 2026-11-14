import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SIX=['ohms-law','projectile-motion','gas-properties','wave-on-a-string','bending-light','build-a-nucleus'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const shaPattern=/^[a-f0-9]{40}$/;
const versionPattern=/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/;

/** Read JSON declarations without evaluating any downloaded simulation code. */
export function readJsonDeclaration(html,name) {
  const found=new RegExp(`(?:window\\.)?phet\\.chipper\\.${name}\\s*=\\s*`).exec(html);
  if(!found)return null;
  const start=found.index+found[0].length;
  if(html[start]!=='{')return null;
  let depth=0,quoted=false,escaped=false;
  for(let i=start;i<html.length;i++){
    const c=html[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;
    else if(c==='{')depth++;
    else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1));}catch{return null;}}
  }
  return null;
}

/** Only exact embedded commits and exact version tags are candidates. Never main/master. */
export function sourceCandidates(slug,version,html) {
  if(!slugPattern.test(slug)||!versionPattern.test(version))throw new Error('Unsafe source identity.');
  const dependencies=readJsonDeclaration(html,'dependencies')||{};
  const buildInfo=readJsonDeclaration(html,'buildInfo')||{};
  const candidates=[];
  const monorepoSha=buildInfo.totalitySHA||dependencies.totality?.sha;
  if(shaPattern.test(monorepoSha||''))candidates.push({repository:'phetsims/totality',ref:monorepoSha,prefix:`${slug}/`,kind:'embedded-monorepo-commit',evidence:'window.phet.chipper.buildInfo.totalitySHA / dependencies.totality.sha'});
  const repositorySha=dependencies[slug]?.sha;
  if(shaPattern.test(repositorySha||''))candidates.push({repository:`phetsims/${slug}`,ref:repositorySha,prefix:'',kind:'embedded-repository-commit',evidence:`window.phet.chipper.dependencies[${slug}].sha`});
  candidates.push({repository:`phetsims/${slug}`,ref:version,prefix:'',kind:'exact-version-tag',evidence:'Release tag and package.json.version must match the pinned HTML version.'});
  candidates.push({repository:`phetsims/${slug}`,ref:`v${version}`,prefix:'',kind:'exact-version-tag',evidence:'Release tag and package.json.version must match the pinned HTML version.'});
  return {dependencies,buildInfo,candidates};
}

function rawUrl(candidate,relative) {
  return `https://raw.githubusercontent.com/${candidate.repository}/${candidate.ref}/${candidate.prefix}${relative}`;
}
async function requestText(url,fetchImpl) {
  let last;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetchImpl(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Physim-AI-source-evidence'}});
      if(response.status===404||response.status===403)return {status:response.status,text:null};
      if(!response.ok){last={status:response.status,text:null};continue;}
      const text=await response.text();
      if(Buffer.byteLength(text)>2*1024*1024)return {status:413,text:null};
      return {status:response.status,text};
    }catch(error){last={status:'network-error',text:null,error:error.name};}
  }
  return last;
}

let compiler;
async function getCompiler() { compiler ||= await import('typescript').then(module=>module.default||module);return compiler; }

/** AST evidence is descriptive, not a permission grant or a runtime adapter. */
export async function scanSourceAst(source,filename='model.ts') {
  const ts=await getCompiler();
  const tree=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,filename.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
  const properties=[],screens=[],actions=[],imports=[];
  const text=node=>node?.getText(tree).slice(0,160);
  const line=node=>tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1;
  const literal=node=>{
    if(!node)return undefined;
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
    if(ts.isNumericLiteral(node))return Number(node.text);
    if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
    if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
    if(node.kind===ts.SyntaxKind.NullKeyword)return null;
    if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken&&ts.isNumericLiteral(node.operand))return -Number(node.operand.text);
    if(ts.isArrayLiteralExpression(node)){
      const values=node.elements.map(literal);
      return values.every(value=>value!==undefined)?values:undefined;
    }
    return undefined;
  };
  const objectField=(node,key)=>ts.isObjectLiteralExpression(node??{})?node.properties.find(p=>ts.isPropertyAssignment(p)&&p.name?.getText(tree).replace(/^['"]|['"]$/g,'')===key)?.initializer:undefined;
  const propertyName=node=>{
    const parent=node.parent;
    if(ts.isBinaryExpression(parent)&&parent.right===node)return text(parent.left)?.replace(/^this\./,'');
    if((ts.isVariableDeclaration(parent)||ts.isPropertyDeclaration(parent))&&parent.initializer===node)return text(parent.name);
    return undefined;
  };
  const visit=node=>{
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
    if(ts.isNewExpression(node)){
      const constructor=text(node.expression),args=node.arguments||[];
      if(constructor?.endsWith('Property')){
        const name=propertyName(node);
        if(name){
          const options=args.find(arg=>ts.isObjectLiteralExpression(arg));
          const defaultValue=literal(args[0]);
          const range=objectField(options,'range');
          const values=literal(objectField(options,'validValues'));
          const record={key:name,constructor,line:line(node),writable:false,permission:'evidence-only'};
          if(defaultValue!==undefined)record.defaultValue=defaultValue;
          else if(args[0])record.defaultExpression=text(args[0]);
          if(/^BooleanProperty$/.test(constructor))record.type='boolean';
          else if(/(?:Number|Integer|Double)Property$/.test(constructor))record.type='number';
          else if(/StringProperty$/.test(constructor))record.type='string';
          else if(['number','boolean','string'].includes(typeof defaultValue))record.type=typeof defaultValue;
          if(range&&ts.isNewExpression(range)&&/Range$/.test(text(range.expression)||'')){
            const min=literal(range.arguments?.[0]),max=literal(range.arguments?.[1]);
            if(typeof min==='number')record.min=min;
            if(typeof max==='number')record.max=max;
          }
          if(Array.isArray(values))record.values=values;
          const unit=literal(objectField(options,'units'));
          if(typeof unit==='string')record.unit=unit;
          properties.push(record);
        }
      }
      if(constructor?.endsWith('Screen'))screens.push({constructor,line:line(node),nameExpression:text(objectField(args.find(arg=>ts.isObjectLiteralExpression(arg)),'name'))??null});
    }
    if(ts.isClassDeclaration(node)&&node.name&&node.heritageClauses?.some(clause=>clause.types.some(type=>/Screen$/.test(text(type.expression)||'')))){
      screens.push({className:node.name.text,line:line(node)});
    }
    if(ts.isMethodDeclaration(node)&&node.name){
      const name=node.name.getText(tree);
      if(/^(reset|step|fire|launch|pulse|add|remove|set|observe|measure|run|emit|clear|restart|play|pause)/i.test(name))actions.push({id:name,line:line(node),executable:false,permission:'evidence-only'});
    }
    if(ts.isPropertyAssignment(node)&&node.name&&(ts.isFunctionExpression(node.initializer)||ts.isArrowFunction(node.initializer))){
      const name=node.name.getText(tree).replace(/^['"]|['"]$/g,'');
      if(/^(reset|step|fire|launch|pulse|add|remove|set|observe|measure|run|emit|clear|restart|play|pause)/i.test(name))actions.push({id:name,line:line(node),executable:false,permission:'evidence-only'});
    }
    ts.forEachChild(node,visit);
  };
  visit(tree);
  return {filename,sha256:hash(source),properties,screens,actions,imports:[...new Set(imports)],parseDiagnostics:tree.parseDiagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))};
}

async function findExactSource(slug,version,html,fetchImpl) {
  const {buildInfo,candidates}=sourceCandidates(slug,version,html);
  const probes=[];
  for(const candidate of candidates){
    const url=rawUrl(candidate,'package.json');
    const result=await requestText(url,fetchImpl);
    probes.push({url,status:result.status});
    if(!result.text)continue;
    let pkg;
    try{pkg=JSON.parse(result.text);}catch{probes.at(-1).reason='invalid-package-json';continue;}
    if(pkg.version!==version){probes.at(-1).reason='package-version-mismatch';probes.at(-1).actualVersion=String(pkg.version);continue;}
    // Exact tags must additionally resolve to an immutable commit before crawling.
    if(candidate.kind==='exact-version-tag'){
      const refUrl=`https://api.github.com/repos/${candidate.repository}/git/ref/tags/${candidate.ref}`;
      const ref=await requestText(refUrl,fetchImpl);probes.push({url:refUrl,status:ref.status});
      let object;
      try{object=JSON.parse(ref.text??'{}').object;}catch{continue;}
      if(object?.type==='tag'&&shaPattern.test(object.sha)){
        const tagUrl=`https://api.github.com/repos/${candidate.repository}/git/tags/${object.sha}`;
        const tag=await requestText(tagUrl,fetchImpl);probes.push({url:tagUrl,status:tag.status});
        try{object=JSON.parse(tag.text??'{}').object;}catch{continue;}
      }
      if(object?.type!=='commit'||!shaPattern.test(object.sha??'')){probes.at(-1).reason='tag-not-resolved-to-commit';continue;}
      candidate.tag=candidate.ref;candidate.ref=object.sha;
    }
    return {candidate,packageSha256:hash(result.text),buildInfo,probes};
  }
  return {candidate:null,buildInfo,probes};
}

async function crawlSource(slug,candidate,fetchImpl) {
  const queue=[`js/${slug}-main.ts`,`js/${slug}-main.js`],seen=new Set(),files=[],missing=[];
  while(queue.length&&files.length<24){
    const requested=queue.shift();if(seen.has(requested))continue;seen.add(requested);
    const alternatives=requested.endsWith('.js')?[requested,requested.slice(0,-3)+'.ts']:[requested];
    let body=null,relative=requested,url;
    for(const alternative of alternatives){
      url=rawUrl(candidate,alternative);const response=await requestText(url,fetchImpl);
      if(response.text){body=response.text;relative=alternative;break;}
    }
    if(body===null){missing.push(requested);continue;}
    const evidence=await scanSourceAst(body,relative);
    files.push({...evidence,url});
    for(const specifier of evidence.imports){
      if(!specifier.startsWith('.'))continue;
      const relativeImport=path.posix.normalize(path.posix.join(path.posix.dirname(relative),specifier));
      if(!relativeImport.startsWith('js/')||relativeImport.includes('..'))continue;
      if(!/(?:Model|Screen|Property|Constants|Projectile|Nucleus|Gas|String|Light|Atom)/i.test(path.posix.basename(relativeImport)))continue;
      if(!seen.has(relativeImport))queue.push(relativeImport);
    }
  }
  return {files,missing,truncated:queue.length>0};
}

async function scanOne(entry,{root,fetchImpl,log}) {
  const relative=entry.originalPath??`originals/${entry.slug}/${entry.version}/${entry.slug}_${entry.locale??'vi'}.html`;
  const storage=path.join(root,'apps/server/storage/phet-sims');
  const file=path.resolve(storage,relative);
  if(!file.startsWith(path.resolve(storage)+path.sep))throw new Error('Unsafe original source path.');
  let html;
  try{html=await fs.readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;return {slug:entry.slug,version:entry.version,status:'unavailable',reason:'Pinned original HTML is missing.',properties:[],screens:[],actions:[]};}
  const sourceSha256=hash(Buffer.from(html,'utf8'));
  const exact=await findExactSource(entry.slug,entry.version,html,fetchImpl);
  const base={slug:entry.slug,version:entry.version,sourceSha256,buildInfo:exact.buildInfo,probes:exact.probes,grantsRuntimePermissions:false};
  if(!exact.candidate){
    log(`AST ${entry.slug}@${entry.version}: exact public source unavailable; no permissions inferred.`);
    return {...base,status:'unavailable',reason:'No exact public commit or resolvable matching version tag was available. Current PhET builds identify the non-public totality monorepo. Older main branches are not substituted.',sourceNoticeUrl:`https://github.com/phetsims/${entry.slug}`,files:[],properties:[],screens:[],actions:[]};
  }
  try{
    const scan=await crawlSource(entry.slug,exact.candidate,fetchImpl);
    const items=key=>scan.files.flatMap(f=>f[key].map(value=>({...value,sourcePath:f.filename,sourceUrl:f.url,sourceFileSha256:f.sha256})));
    const record={...base,status:scan.files.length?'scanned':'unavailable',source:exact.candidate,packageSha256:exact.packageSha256,...scan,properties:items('properties'),screens:items('screens'),actions:items('actions')};
    if(!scan.files.length)record.reason='Matching package version was found but no public source entry point was available.';
    log(`AST ${entry.slug}@${entry.version}: ${scan.files.length} files, ${record.properties.length} property declarations (evidence only).`);
    return record;
  }catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND')return {...base,status:'unavailable',source:exact.candidate,reason:'TypeScript AST parser is not installed. Run pnpm install and retry.',files:[],properties:[],screens:[],actions:[]};
    throw error;
  }
}

export async function scanSourceEvidence({root=ROOT,manifest,fetchImpl=fetch,log=console.log}={}) {
  if(!manifest)manifest=JSON.parse(await fs.readFile(path.join(root,'packages/shared/data/phet-manifest.json'),'utf8'));
  const entries=Array.isArray(manifest)?manifest:manifest.simulations;
  const selected=SIX.map(slug=>entries.find(entry=>entry.slug===slug)).filter(Boolean);
  const results=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,selected.length)},async()=>{while(next<selected.length){const index=next++;results[index]=await scanOne(selected[index],{root,fetchImpl,log});}}));
  const artifact={schemaVersion:1,scope:'Matching public source AST evidence; never authorizes bridge writes or actions.',simulations:Object.fromEntries(results.map(result=>[result.slug,result]))};
  const target=path.join(root,'packages/shared/data/phet-source-evidence.json');
  await fs.mkdir(path.dirname(target),{recursive:true});
  const temp=`${target}.${randomUUID()}.tmp`;await fs.writeFile(temp,JSON.stringify(artifact,null,2)+'\n');
  try{await fs.rename(temp,target);}catch(error){await fs.unlink(temp).catch(()=>{});throw error;}
  return artifact;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))scanSourceEvidence().catch(error=>{console.error(error.message);process.exitCode=1;});
