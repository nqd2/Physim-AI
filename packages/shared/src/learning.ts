import { z } from 'zod';
import { SimulationConfigSchema, SimulationSlugSchema } from './simulation.ts';

export const DEFAULT_OPENAI_MODEL='gpt-5.4-mini-2026-03-17';
export const MAX_IMAGE_BYTES=10*1024*1024;
export const SessionIdSchema=z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
export const LearningImageSchema=z.object({
  mimeType:z.enum(['image/jpeg','image/png']),
  base64:z.string().min(4).max(Math.ceil(MAX_IMAGE_BYTES/3)*4).regex(/^[A-Za-z0-9+/]+={0,2}$/)
}).strict();
export type LearningImage=z.infer<typeof LearningImageSchema>;
export const LearningContextSchema=z.object({
  problem:z.string().min(1).max(12000),slug:SimulationSlugSchema.optional(),
  simulationConfig:SimulationConfigSchema.optional(),step:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]).optional(),
  priorHints:z.array(z.string().max(3000)).max(12).optional()
}).strict();
export type LearningContext=z.infer<typeof LearningContextSchema>;
export const AnalyzePhotoRequestSchema=z.object({sessionId:SessionIdSchema,image:LearningImageSchema}).strict();
export const CheckWorkRequestSchema=z.object({sessionId:SessionIdSchema,image:LearningImageSchema,context:LearningContextSchema}).strict();
export const EvaluateTeachBackRequestSchema=z.object({
  sessionId:SessionIdSchema,context:LearningContextSchema,
  explanation:z.string().min(1).max(6000),orderedLinks:z.array(z.string().max(1000)).max(12)
}).strict();
export const GenerateVariantRequestSchema=z.object({sessionId:SessionIdSchema,context:LearningContextSchema}).strict();
export const FactSchema=z.object({label:z.string().min(1),value:z.string(),unit:z.string().optional()});
export const AnalyzePhotoResponseSchema=z.object({
  status:z.enum(['readable','unreadable','no_simulation']),message:z.string(),transcription:z.string(),
  facts:z.array(FactSchema),misconceptions:z.array(z.string()),hints:z.array(z.string()),simulationConfig:SimulationConfigSchema.nullable(),
  /** A catalog simulation to open interactively when no verified adapter can be configured. */
  simulationSlug:SimulationSlugSchema.nullable().optional()
}).strict();
export const CheckWorkResponseSchema=z.object({
  status:z.enum(['checked','unreadable']),message:z.string(),firstIncorrectStep:z.string().nullable(),hint:z.string()
}).strict();
export const EvaluateTeachBackResponseSchema=z.object({
  status:z.literal('evaluated'),correct:z.boolean(),missingLinks:z.array(z.string()),feedback:z.string()
}).strict();
export const GenerateVariantResponseSchema=z.object({
  status:z.literal('generated'),problem:z.string().min(1),changedCondition:z.string().min(1),hints:z.array(z.string()),simulationConfig:SimulationConfigSchema.nullable()
}).strict();
export type AnalyzePhotoRequest=z.infer<typeof AnalyzePhotoRequestSchema>;
export type AnalyzePhotoResponse=z.infer<typeof AnalyzePhotoResponseSchema>;
export type CheckWorkRequest=z.infer<typeof CheckWorkRequestSchema>;
export type CheckWorkResponse=z.infer<typeof CheckWorkResponseSchema>;
export type EvaluateTeachBackRequest=z.infer<typeof EvaluateTeachBackRequestSchema>;
export type EvaluateTeachBackResponse=z.infer<typeof EvaluateTeachBackResponseSchema>;
export type GenerateVariantRequest=z.infer<typeof GenerateVariantRequestSchema>;
export type GenerateVariantResponse=z.infer<typeof GenerateVariantResponseSchema>;
