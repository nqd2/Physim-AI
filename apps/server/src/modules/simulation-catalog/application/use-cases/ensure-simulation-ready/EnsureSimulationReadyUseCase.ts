import { DomainError } from '../../../../../shared/domain/DomainError.ts';
import type { SimulationRepository } from '../../../domain/SimulationRepository.ts';
import { GetSimulationSchemaUseCase } from '../get-simulation-schema/GetSimulationSchemaUseCase.ts';

export class EnsureSimulationReadyUseCase {
  private readonly schema: GetSimulationSchemaUseCase;
  private readonly repository: SimulationRepository;

  constructor(repository: SimulationRepository) {
    this.repository = repository;
    this.schema = new GetSimulationSchemaUseCase(repository);
  }

  async execute(slug: string) {
    const simulation = await this.schema.execute(slug);
    if (!await this.repository.resolveAsset(simulation.assetPath)) {
      throw new DomainError('SIM_NOT_READY', 503, 'Tệp mô phỏng chưa sẵn sàng. Hãy chạy pnpm phet:sync trên máy chủ.');
    }
    return { simulation, url: '/phet-sims/' + encodeURIComponent(simulation.assetPath) };
  }
}
