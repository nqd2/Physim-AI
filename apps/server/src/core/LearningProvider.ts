/** Application port: use cases do not depend on an AI vendor or HTTP transport. */
export type LearningTask =
  | 'analyze-photo'
  | 'check-work'
  | 'evaluate-teach-back'
  | 'generate-variant';

export type StructuredTaskRequest = {
  task: LearningTask;
  input: unknown;
  schema: Record<string, unknown>;
  image?: { mimeType: 'image/jpeg' | 'image/png'; base64: string };
};

export interface StructuredLearningProvider {
  complete(request: StructuredTaskRequest): Promise<unknown>;
}
