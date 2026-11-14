import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const files=['registry.js','adapters/ohms-law.js','adapters/physics.js','adapters/gas.js','adapters/wave.js','adapters/optics-nucleus.js'];
const source=[];
for(const file of files)source.push(await readFile(path.join(directory,file),'utf8').catch(error=>{if(error.code==='ENOENT'&&file!=='registry.js')return '';throw error;}));
await writeFile(path.join(directory,'adapters.js'),source.join('\n'),'utf8');
