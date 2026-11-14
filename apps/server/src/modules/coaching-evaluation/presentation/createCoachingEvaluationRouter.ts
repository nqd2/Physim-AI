import { Router } from 'express';
import { EvaluateTeachBackRequestSchema, GenerateVariantRequestSchema } from '@physim/shared';
import type { EvaluateTeachBack } from '../application/evaluate-teach-back/EvaluateTeachBack.ts';
import type { GenerateVariant } from '../application/generate-variant/GenerateVariant.ts';

export function createCoachingEvaluationRouter(useCases: { evaluateTeachBack: EvaluateTeachBack; generateVariant: GenerateVariant }): Router {
  const router = Router();
  router.post('/evaluate-teach-back', async (req, res) => {
    res.json(await useCases.evaluateTeachBack.execute(EvaluateTeachBackRequestSchema.parse(req.body)));
  });
  router.post('/generate-variant', async (req, res) => {
    res.json(await useCases.generateVariant.execute(GenerateVariantRequestSchema.parse(req.body)));
  });
  return router;
}
