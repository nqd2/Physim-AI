import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SimulationSummarySchema, SimulationSchemaSchema, ERROR_MESSAGES,
  type EnsureReadyResponse, type SimulationSchema, type SimulationSummary
} from '@physim/shared';
import { CatalogError, type SimulationCatalog } from '../domain/SimulationCatalog.ts';

type StoredSimulation = SimulationSummary & { htmlPath: string; renderedSha256: string };
type Snapshot = { generation: string; simulations: StoredSimulation[]; schemas: Record<string, SimulationSchema> };
type ActivePointer = { generation: string; manifestPath: string; schemaPath: string };
const defaultStorage = fileURLToPath(new URL('../../../../storage/phet-sims/', import.meta.url));

function containedFile(root: string, relative: string): string {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new CatalogError('SIMULATION_NOT_READY', ERROR_MESSAGES.SIMULATION_NOT_READY, 503);
  const target = path.resolve(root, relative), prefix = path.resolve(root) + path.sep;
  if (!target.startsWith(prefix)) throw new CatalogError('SIMULATION_NOT_READY', ERROR_MESSAGES.SIMULATION_NOT_READY, 503);
  return target;
}

/** Reads a committed generation only. Manifest + schemas change through one atomic pointer. */
export class FileSystemSimulationCatalog implements SimulationCatalog {
  private readonly storageDir: string;
  private readonly manifestPath: string;
  private snapshot: Snapshot | null = null;
  constructor(options: { storageDir?: string; manifestPath?: string } = {}) {
    this.storageDir = path.resolve(options.storageDir ?? defaultStorage);
    this.manifestPath = options.manifestPath ?? path.resolve(this.storageDir, '../../../../packages/shared/data/phet-manifest.json');
  }

  private async readActive(): Promise<Snapshot | null> {
    let pointer: ActivePointer;
    try { pointer = JSON.parse(await fs.readFile(path.join(this.storageDir,'active.json'),'utf8')) as ActivePointer; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new CatalogError('SIMULATION_NOT_READY', ERROR_MESSAGES.SIMULATION_NOT_READY,503); }
    if (!/^[a-f0-9]{20}$/.test(pointer.generation)) throw new CatalogError('SIMULATION_NOT_READY',ERROR_MESSAGES.SIMULATION_NOT_READY,503);
    if (this.snapshot?.generation === pointer.generation) return this.snapshot;
    try {
      const [manifestText,schemaText] = await Promise.all([
        fs.readFile(containedFile(this.storageDir,pointer.manifestPath),'utf8'),
        fs.readFile(containedFile(this.storageDir,pointer.schemaPath),'utf8')
      ]);
      const manifest = JSON.parse(manifestText) as {generation:string; simulations:unknown[]};
      const schemaDocument = JSON.parse(schemaText) as {generation:string; simulations:Record<string,unknown>};
      if(manifest.generation!==pointer.generation || schemaDocument.generation!==pointer.generation || manifest.simulations.length!==74) throw new Error('Invalid generation');
      const simulations = manifest.simulations.map(value => {
        const parsed = SimulationSummarySchema.parse(value), stored = value as {htmlPath:string;renderedSha256:string};
        containedFile(this.storageDir,stored.htmlPath);
        if(!/^[a-f0-9]{64}$/.test(stored.renderedSha256))throw new Error('Invalid rendered checksum');
        return {...parsed,htmlPath:stored.htmlPath,renderedSha256:stored.renderedSha256};
      });
      if(new Set(simulations.map(item=>item.slug)).size!==74)throw new Error('Duplicate slug');
      const schemas = Object.fromEntries(simulations.map(item => {
        const schema=SimulationSchemaSchema.parse(schemaDocument.simulations[item.slug]);
        if(schema.version!==item.version || schema.slug!==item.slug || schema.adapterVerified!==item.adapterVerified)throw new Error('Schema mismatch');
        return [item.slug,schema];
      }));
      this.snapshot={generation:pointer.generation,simulations,schemas};
      return this.snapshot;
    } catch { throw new CatalogError('SIMULATION_NOT_READY',ERROR_MESSAGES.SIMULATION_NOT_READY,503); }
  }

  async list(): Promise<SimulationSummary[]> {
    const active=await this.readActive();
    if(active)return active.simulations.map(item=>SimulationSummarySchema.parse(item));
    // Checked-in metadata keeps the library discoverable on a clean checkout.
    // ensureReady still refuses to serve a file until the whole generation is synced.
    try {
      const manifest=JSON.parse(await fs.readFile(this.manifestPath,'utf8')) as {simulations:unknown[]};
      return manifest.simulations.map(item=>({...SimulationSummarySchema.parse(item),adapterVerified:false,capabilities:[]}));
    } catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw new CatalogError('SIMULATION_NOT_READY',ERROR_MESSAGES.SIMULATION_NOT_READY,503); }
  }

  private async requireEntry(slug:string):Promise<{snapshot:Snapshot;entry:StoredSimulation}> {
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new CatalogError('NOT_FOUND',ERROR_MESSAGES.NOT_FOUND,404);
    const snapshot=await this.readActive();
    if(!snapshot){
      if(!(await this.list()).some(item=>item.slug===slug))throw new CatalogError('NOT_FOUND',ERROR_MESSAGES.NOT_FOUND,404);
      throw new CatalogError('SIMULATION_NOT_READY',ERROR_MESSAGES.SIMULATION_NOT_READY,503);
    }
    const entry=snapshot.simulations.find(item=>item.slug===slug);
    if(!entry)throw new CatalogError('NOT_FOUND',ERROR_MESSAGES.NOT_FOUND,404);
    return {snapshot,entry};
  }

  async getSchema(slug:string):Promise<SimulationSchema> {
    const {snapshot}=await this.requireEntry(slug);
    return structuredClone(snapshot.schemas[slug]!);
  }

  async ensureReady(slug:string,version?:string):Promise<EnsureReadyResponse> {
    const {entry}=await this.requireEntry(slug);
    if(version && version!==entry.version)throw new CatalogError('SIMULATION_VERSION_MISMATCH',ERROR_MESSAGES.SIMULATION_VERSION_MISMATCH,409);
    try { await fs.access(containedFile(this.storageDir,entry.htmlPath)); }
    catch { throw new CatalogError('SIMULATION_NOT_READY',ERROR_MESSAGES.SIMULATION_NOT_READY,503); }
    return {
      slug:entry.slug,version:entry.version,locale:entry.locale,
      url:`/simulations/${entry.slug}/${entry.version}/${entry.locale}.html`,
      capabilities:[...entry.capabilities],adapterVerified:entry.adapterVerified,
      attribution:entry.attribution,license:{...entry.license}
    };
  }

  async resolveHtml(slug:string,version:string,locale:string):Promise<string> {
    const {entry}=await this.requireEntry(slug);
    if(entry.version!==version || entry.locale!==locale)throw new CatalogError('NOT_FOUND',ERROR_MESSAGES.NOT_FOUND,404);
    await this.ensureReady(slug,version);
    return containedFile(this.storageDir,entry.htmlPath);
  }
}
