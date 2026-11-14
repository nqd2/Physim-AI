import { CHAPTERS } from '@physim/shared';
import type { SimulationCatalog } from '../../domain/SimulationCatalog.ts';
import type { ListSimulationsResponse } from './ListSimulations.dto.ts';
export class ListSimulations {
  constructor(private readonly catalog:SimulationCatalog) {}
  async execute():Promise<ListSimulationsResponse> {
    const simulations=await this.catalog.list();
    return {simulations,chapters:[...CHAPTERS],total:simulations.length};
  }
}
