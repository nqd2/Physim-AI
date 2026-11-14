import type { SimulationCatalog } from '../../domain/SimulationCatalog.ts';
import type { GetSimulationSchemaRequest } from './GetSimulationSchema.dto.ts';
export class GetSimulationSchema {
  constructor(private readonly catalog:SimulationCatalog) {}
  execute(request:GetSimulationSchemaRequest) { return this.catalog.getSchema(request.slug); }
}
