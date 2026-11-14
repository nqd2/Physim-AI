import { DomainError } from '../../../../../shared/domain/DomainError.ts';
import type { SimulationRepository } from '../../../domain/SimulationRepository.ts';

export class GetSimulationSchemaUseCase {
  private readonly repository: SimulationRepository;

  constructor(repository: SimulationRepository) {
    this.repository = repository;
  }

  async execute(slug: string) {
    const simulation = await this.repository.find(slug);
    if (!simulation) throw new DomainError('SIM_NOT_FOUND', 404, 'Không tìm thấy mô phỏng.');
    return simulation;
  }
}
