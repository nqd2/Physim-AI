import type { SimulationCatalog } from '../../domain/SimulationCatalog.ts';
import type { EnsureSimulationReadyRequest } from './EnsureSimulationReady.dto.ts';
export class EnsureSimulationReady {
  constructor(private readonly catalog:SimulationCatalog) {}
  execute(request:EnsureSimulationReadyRequest) { return this.catalog.ensureReady(request.slug,request.version); }
}
