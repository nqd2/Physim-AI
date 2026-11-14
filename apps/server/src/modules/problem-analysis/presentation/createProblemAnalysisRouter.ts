import { Router } from 'express';
import { AnalyzePhotoRequestSchema, CheckWorkRequestSchema } from '@physim/shared';
import type { AnalyzePhoto } from '../application/analyze-photo/AnalyzePhoto.ts';
import type { CheckWork } from '../application/check-work/CheckWork.ts';

export function createProblemAnalysisRouter(useCases: { analyzePhoto: AnalyzePhoto; checkWork: CheckWork }): Router {
  const router = Router();
  router.post('/analyze-photo', async (req, res) => {
    const input = AnalyzePhotoRequestSchema.parse(req.body);
    res.json(await useCases.analyzePhoto.execute(input));
  });
  router.post('/check-work', async (req, res) => {
    const input = CheckWorkRequestSchema.parse(req.body);
    res.json(await useCases.checkWork.execute(input));
  });
  return router;
}
