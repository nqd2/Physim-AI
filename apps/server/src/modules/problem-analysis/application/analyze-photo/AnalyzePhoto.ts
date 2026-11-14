import { AnalyzePhotoResponseSchema, type AnalyzePhotoRequest, type AnalyzePhotoResponse } from './AnalyzePhotoDto.ts';
import type { StructuredLearningProvider } from '../../../../core/LearningProvider.ts';
import { validateLearningImage } from '../../domain/ImagePolicy.ts';
import type { ConfigurationPolicy } from '../../../../core/ConfigurationPolicy.ts';
import { invalidOutput, learningOutputSchemas, normalizeStructuredOutput } from '../../../../core/StructuredOutput.ts';

export class AnalyzePhoto {
  constructor(private readonly provider: StructuredLearningProvider, private readonly configs: ConfigurationPolicy) {}

  async execute(request: AnalyzePhotoRequest): Promise<AnalyzePhotoResponse> {
    validateLearningImage(request.image);
    const [availableSchemas, catalog] = await Promise.all([this.configs.availableSchemas(), this.configs.catalogChoices()]);
    const raw = await this.provider.complete({ task: 'analyze-photo', image: request.image, input: { sessionId: request.sessionId, availableSchemas, catalog }, schema: learningOutputSchemas['analyze-photo'] });
    const parsed = AnalyzePhotoResponseSchema.safeParse(normalizeStructuredOutput(raw));
    if (!parsed.success) invalidOutput();
    const response = parsed.data;
    if (response.status === 'unreadable') return { ...response, simulationConfig: null, simulationSlug: null, transcription: '', facts: [], misconceptions: [], hints: [] };
    const config = await this.configs.validateOutput(response.simulationConfig);
    // Without a verified adapter, a related catalog simulation still opens for direct interaction.
    const simulationSlug = config?.slug ?? await this.configs.resolveSlug(response.simulationSlug ?? response.simulationConfig?.slug);
    return { ...response, simulationConfig: config, simulationSlug, status: simulationSlug ? 'readable' : 'no_simulation' };
  }
}
