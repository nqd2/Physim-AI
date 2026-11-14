import type { SimulationCatalog, SimulationSchema } from '@physim/shared';

export interface SimulationRepository {
  list(): Promise<SimulationCatalog>;
  find(slug: string): Promise<SimulationSchema | null>;
  resolveAsset(assetPath: string): Promise<string | null>;
}
