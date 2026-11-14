import { GenerateVariantResponseSchema, type GenerateVariantRequest, type GenerateVariantResponse } from './GenerateVariantDto.ts';
import type { StructuredLearningProvider } from '../../../../core/LearningProvider.ts';
import { validateSingleConditionChange } from '../../domain/VariantPolicy.ts';
import type { ConfigurationPolicy } from '../../../../core/ConfigurationPolicy.ts';
import { invalidOutput, learningOutputSchemas, normalizeStructuredOutput } from '../../../../core/StructuredOutput.ts';

export class GenerateVariant {
  constructor(private readonly provider: StructuredLearningProvider, private readonly configs: ConfigurationPolicy) {}
  async execute(request: GenerateVariantRequest): Promise<GenerateVariantResponse> {
    await this.configs.validateInput(request.context.simulationConfig);
    const raw = await this.provider.complete({ task: 'generate-variant', input: { ...request, availableSchemas: await this.configs.availableSchemas() }, schema: learningOutputSchemas['generate-variant'] });
    const parsed = GenerateVariantResponseSchema.safeParse(normalizeStructuredOutput(raw));
    if (!parsed.success) invalidOutput();
    const response = parsed.data;
    response.simulationConfig = await this.configs.validateOutput(response.simulationConfig);
    validateSingleConditionChange(request.context.simulationConfig, response.simulationConfig);
    return response;
  }
}
