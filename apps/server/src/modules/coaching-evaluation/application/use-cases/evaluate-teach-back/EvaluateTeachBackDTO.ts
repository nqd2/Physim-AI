import { z } from 'zod';
import { analysisSchema } from '@physim/shared';

export const evaluateTeachBackInput = z.object({
  analysis: analysisSchema,
  orderedChain: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  explanation: z.string().trim().min(1).max(2000),
}).strict();
