import cors from 'cors';
import express from 'express';
import type { TutoringGateway } from './shared/application/TutoringGateway.ts';
import { DomainError } from './shared/domain/DomainError.ts';
import { errorHandler } from './shared/infrastructure/http/errorHandler.ts';
import { limitLearningRequests } from './shared/infrastructure/http/limitLearningRequests.ts';
import { CatalogConfigurationValidator } from './modules/simulation-catalog/application/CatalogConfigurationValidator.ts';
import { FileSystemSimulationRepository } from './modules/simulation-catalog/infrastructure/FileSystemSimulationRepository.ts';
import { simulationHtml, simulationRoutes } from './modules/simulation-catalog/presentation/simulation.routes.ts';
import { problemAnalysisRoutes } from './modules/problem-analysis/presentation/problemAnalysis.routes.ts';
import { coachingEvaluationRoutes } from './modules/coaching-evaluation/presentation/coachingEvaluation.routes.ts';

interface AppOptions {
  storageDir: string;
  model?: TutoringGateway;
  corsOrigins?: string[];
}

export function createApp({ storageDir, model, corsOrigins = [] }: AppOptions) {
  const repository = new FileSystemSimulationRepository(storageDir);
  const app = express();
  app.disable('x-powered-by');

  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/phet-sims/:assetPath', simulationHtml(repository, corsOrigins));

  const api = express.Router();
  api.use(cors({ origin: corsOrigins }));
  api.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(express.json({ limit: '12mb' }));

  api.get('/health', async (_request, response) => {
    const catalogReady = await repository.list().then(() => true, () => false);
    const aiConfigured = Boolean(model);
    response.json({ status: catalogReady && aiConfigured ? 'ok' : 'degraded', catalogReady, aiConfigured });
  });
  api.use('/simulations', simulationRoutes(repository));

  if (model) {
    const configurations = new CatalogConfigurationValidator(repository);
    const limit = limitLearningRequests();
    api.use('/learning', problemAnalysisRoutes(model, repository, configurations, limit), coachingEvaluationRoutes(model, limit));
  } else {
    api.post('/learning/:operation', (_request, _response) => {
      throw new DomainError('AI_NOT_CONFIGURED', 503, 'Máy chủ chưa cấu hình OpenAI. Bạn có thể mở bài mẫu để tiếp tục.');
    });
  }
  app.use('/api/v1', api);
  app.use((_request, _response) => {
    throw new DomainError('NOT_FOUND', 404, 'Không tìm thấy đường dẫn.');
  });
  app.use(errorHandler);
  return app;
}
