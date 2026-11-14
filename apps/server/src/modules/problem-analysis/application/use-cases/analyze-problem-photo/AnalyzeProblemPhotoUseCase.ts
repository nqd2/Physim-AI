import { analysisSchema, type ProblemImage, type SimulationSchema } from '@physim/shared';
import type { ConfigurationValidator, TutoringGateway } from '../../../../../shared/application/TutoringGateway.ts';

export class AnalyzeProblemPhotoUseCase {
  private readonly gateway: TutoringGateway;
  private readonly configurations: ConfigurationValidator;

  constructor(gateway: TutoringGateway, configurations: ConfigurationValidator) {
    this.gateway = gateway;
    this.configurations = configurations;
  }

  async execute(image: ProblemImage, simulations: SimulationSchema[]) {
    const analysis = analysisSchema.parse(await this.gateway.analyzePhoto(image, simulations));
    const config = await this.configurations.verified(analysis.config);
    const hints = await Promise.all(analysis.hints.map(async hint => ({
      ...hint,
      config: config && hint.config?.slug === config.slug ? await this.configurations.verified(hint.config) : null,
    })));
    return { ...analysis, hints, config };
  }
}
