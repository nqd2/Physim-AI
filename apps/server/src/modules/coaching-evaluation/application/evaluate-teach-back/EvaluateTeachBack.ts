import { EvaluateTeachBackResponseSchema, type EvaluateTeachBackRequest, type EvaluateTeachBackResponse } from './EvaluateTeachBackDto.ts';
import type { StructuredLearningProvider } from '../../../../core/LearningProvider.ts';
import type { ConfigurationPolicy } from '../../../../core/ConfigurationPolicy.ts';
import { invalidOutput, learningOutputSchemas } from '../../../../core/StructuredOutput.ts';

export class EvaluateTeachBack {
  constructor(private readonly provider: StructuredLearningProvider, private readonly configs: ConfigurationPolicy) {}
  async execute(request: EvaluateTeachBackRequest): Promise<EvaluateTeachBackResponse> {
    await this.configs.validateInput(request.context.simulationConfig);
    const raw = await this.provider.complete({ task: 'evaluate-teach-back', input: request, schema: learningOutputSchemas['evaluate-teach-back'] });
    const parsed = EvaluateTeachBackResponseSchema.safeParse(raw);
    if (!parsed.success) invalidOutput();
    return parsed.data;
  }
}
