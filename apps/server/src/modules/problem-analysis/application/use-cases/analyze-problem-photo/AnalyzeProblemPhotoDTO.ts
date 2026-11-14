import { z } from 'zod';
import { imageSchema } from '@physim/shared';

export const analyzePhotoInput = z.object({ image: imageSchema }).strict();
