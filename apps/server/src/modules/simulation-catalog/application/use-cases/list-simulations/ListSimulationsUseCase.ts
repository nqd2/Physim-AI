import type { SimulationRepository } from '../../../domain/SimulationRepository.ts';

export class ListSimulationsUseCase {
  private readonly repository: SimulationRepository;

  constructor(repository: SimulationRepository) {
    this.repository = repository;
  }

  execute() {
    return this.repository.list();
  }
}
