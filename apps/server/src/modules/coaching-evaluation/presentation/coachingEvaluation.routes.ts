import { Router } from 'express';
import type { TutoringGateway } from '../../../shared/application/TutoringGateway.ts';
import { validateImage } from '../../../shared/infrastructure/http/validateImage.ts';
import type { LearningRequestLimiter } from '../../../shared/infrastructure/http/limitLearningRequests.ts';
import { checkWorkInput } from '../application/use-cases/check-handwritten-work/CheckHandwrittenWorkDTO.ts';
import { CheckHandwrittenWorkUseCase } from '../application/use-cases/check-handwritten-work/CheckHandwrittenWorkUseCase.ts';
import { evaluateTeachBackInput } from '../application/use-cases/evaluate-teach-back/EvaluateTeachBackDTO.ts';
import { EvaluateTeachBackUseCase } from '../application/use-cases/evaluate-teach-back/EvaluateTeachBackUseCase.ts';

export function coachingEvaluationRoutes(gateway: TutoringGateway, limit: LearningRequestLimiter) {
  const router = Router();
  const checkWork = new CheckHandwrittenWorkUseCase(gateway);
  const evaluateTeachBack = new EvaluateTeachBackUseCase(gateway);

  router.post('/check-work', limit(async (request, response) => {
    const { image, analysis } = checkWorkInput.parse(request.body);
    response.json(await checkWork.execute(validateImage(image), analysis));
  }));
  router.post('/evaluate-teach-back', limit(async (request, response) => {
    response.json(await evaluateTeachBack.execute(evaluateTeachBackInput.parse(request.body)));
  }));
  return router;
}
