import { isConfigSupported, type SimConfig, type SimulationSchema } from '@physim/shared';
import type { ConfigurationValidator } from '../../../shared/application/TutoringGateway.ts';
import { DomainError } from '../../../shared/domain/DomainError.ts';
import type { SimulationRepository } from '../domain/SimulationRepository.ts';

export class CatalogConfigurationValidator implements ConfigurationValidator {
  private readonly repository: SimulationRepository;

  constructor(repository: SimulationRepository) {
    this.repository = repository;
  }

  async simulationFor(config: SimConfig | null): Promise<SimulationSchema | null> {
    if (!config) return null;
    try {
      const simulation = await this.repository.find(config.slug);
      return simulation?.bridgeMode === 'guided' ? simulation : null;
    } catch (error) {
      if (error instanceof DomainError && error.code === 'CATALOG_NOT_READY') return null;
      throw error;
    }
  }

  async verified(config: SimConfig | null): Promise<SimConfig | null> {
    const simulation = await this.simulationFor(config);
    return config && simulation && isConfigSupported(simulation, config) ? config : null;
  }
}
