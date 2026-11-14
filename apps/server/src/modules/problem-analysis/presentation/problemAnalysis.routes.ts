import { Router } from 'express';
import type { ConfigurationValidator, TutoringGateway } from '../../../shared/application/TutoringGateway.ts';
import { DomainError } from '../../../shared/domain/DomainError.ts';
import { validateImage } from '../../../shared/infrastructure/http/validateImage.ts';
import type { LearningRequestLimiter } from '../../../shared/infrastructure/http/limitLearningRequests.ts';
import type { SimulationRepository } from '../../simulation-catalog/domain/SimulationRepository.ts';
import { analyzePhotoInput } from '../application/use-cases/analyze-problem-photo/AnalyzeProblemPhotoDTO.ts';
import { AnalyzeProblemPhotoUseCase } from '../application/use-cases/analyze-problem-photo/AnalyzeProblemPhotoUseCase.ts';
import { generateVariantInput } from '../application/use-cases/generate-adaptive-variant/GenerateAdaptiveVariantDTO.ts';
import { GenerateAdaptiveVariantUseCase } from '../application/use-cases/generate-adaptive-variant/GenerateAdaptiveVariantUseCase.ts';

export function problemAnalysisRoutes(
  gateway: TutoringGateway,
  repository: SimulationRepository,
  configurations: ConfigurationValidator,
  limit: LearningRequestLimiter,
) {
  const router = Router();
  const analyzePhoto = new AnalyzeProblemPhotoUseCase(gateway, configurations);
  const generateVariant = new GenerateAdaptiveVariantUseCase(gateway, configurations);

  router.post('/analyze-photo', limit(async (request, response) => {
    const { image } = analyzePhotoInput.parse(request.body);
    const validated = validateImage(image);
    const catalog = await repository.list().catch(error => {
      if (error instanceof DomainError && error.code === 'CATALOG_NOT_READY') {
        return { simulations: [] };
      }
      throw error;
    });
    response.json(await analyzePhoto.execute(validated, catalog.simulations.filter(sim => sim.bridgeMode === 'guided')));
  }));

  router.post('/generate-variant', limit(async (request, response) => {
    response.json(await generateVariant.execute(generateVariantInput.parse(request.body)));
  }));

  return router;
}
