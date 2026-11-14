import { z } from 'zod';
import { analysisSchema, teachBackAssessmentSchema } from '@physim/shared';

export const generateVariantInput = z.object({
  analysis: analysisSchema,
  assessment: teachBackAssessmentSchema,
}).strict();
