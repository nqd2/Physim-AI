import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { catalogSchema, type SimulationCatalog, type SimulationSchema } from '@physim/shared';
import { DomainError } from '../../../shared/domain/DomainError.ts';
import type { SimulationRepository } from '../domain/SimulationRepository.ts';

const htmlAssetPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.html$/u;

export class FileSystemSimulationRepository implements SimulationRepository {
  private readonly catalogPath: string;
  private readonly htmlDir: string;
  private cached?: { signature: string; catalog: SimulationCatalog };

  constructor(storageDir: string) {
    this.catalogPath = resolve(storageDir, 'sim-schemas.json');
    this.htmlDir = resolve(dirname(this.catalogPath), 'phet-sims');
  }

  async list(): Promise<SimulationCatalog> {
    try {
      const file = await stat(this.catalogPath);
      const signature = [file.mtimeMs, file.ctimeMs, file.size, file.ino].join(':');
      if (this.cached?.signature === signature) return this.cached.catalog;
      const catalog = catalogSchema.parse(JSON.parse(await readFile(this.catalogPath, 'utf8')));
      this.cached = { signature, catalog };
      return catalog;
    } catch {
      throw new DomainError('CATALOG_NOT_READY', 503, 'Thư viện mô phỏng chưa sẵn sàng. Hãy chạy pnpm phet:sync trên máy chủ.');
    }
  }

  async find(slug: string): Promise<SimulationSchema | null> {
    return (await this.list()).simulations.find(simulation => simulation.slug === slug) ?? null;
  }

  async resolveAsset(assetPath: string): Promise<string | null> {
    const catalog = await this.list();
    if (!htmlAssetPattern.test(assetPath) || !catalog.simulations.some(simulation => simulation.assetPath === assetPath)) {
      return null;
    }
    const asset = resolve(this.htmlDir, assetPath);
    try {
      return (await stat(asset)).isFile() ? asset : null;
    } catch {
      return null;
    }
  }
}
