import { Router, type RequestHandler } from 'express';
import { DomainError } from '../../../shared/domain/DomainError.ts';
import type { SimulationRepository } from '../domain/SimulationRepository.ts';
import { EnsureSimulationReadyUseCase } from '../application/use-cases/ensure-simulation-ready/EnsureSimulationReadyUseCase.ts';
import { GetSimulationSchemaUseCase } from '../application/use-cases/get-simulation-schema/GetSimulationSchemaUseCase.ts';
import { ListSimulationsUseCase } from '../application/use-cases/list-simulations/ListSimulationsUseCase.ts';

export function simulationRoutes(repository: SimulationRepository) {
  const router = Router();
  const list = new ListSimulationsUseCase(repository);
  const schema = new GetSimulationSchemaUseCase(repository);
  const ready = new EnsureSimulationReadyUseCase(repository);

  router.get('/', async (_request, response) => {
    response.json(await list.execute());
  });
  router.get('/:slug/schema', async (request, response) => {
    response.json(await schema.execute(request.params.slug));
  });
  router.post('/:slug/ensure-ready', async (request, response) => {
    response.json(await ready.execute(request.params.slug));
  });
  return router;
}

export function simulationHtml(repository: SimulationRepository, corsOrigins: string[]): RequestHandler {
  return async (request, response, next) => {
    const source = request.params.assetPath;
    const assetPath = Array.isArray(source) ? source.join('/') : source;
    const resolved = typeof assetPath === 'string' ? await repository.resolveAsset(assetPath) : null;
    if (!resolved) throw new DomainError('SIM_NOT_FOUND', 404, 'Không tìm thấy tệp mô phỏng.');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Security-Policy', "frame-ancestors " + ["'self'", ...corsOrigins].join(' '));
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.sendFile(resolved, { cacheControl: false }, error => {
      if (error) next(error);
    });
  };
}
