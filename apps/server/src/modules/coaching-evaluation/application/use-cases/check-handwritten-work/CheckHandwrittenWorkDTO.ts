import { z } from 'zod';
import { analysisSchema, imageSchema } from '@physim/shared';

export const checkWorkInput = z.object({ image: imageSchema, analysis: analysisSchema }).strict();
