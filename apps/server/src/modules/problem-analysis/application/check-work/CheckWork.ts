import { CheckWorkResponseSchema, type CheckWorkRequest, type CheckWorkResponse } from './CheckWorkDto.ts';
import type { StructuredLearningProvider } from '../../../../core/LearningProvider.ts';
import { validateLearningImage } from '../../domain/ImagePolicy.ts';
import type { ConfigurationPolicy } from '../../../../core/ConfigurationPolicy.ts';
import { invalidOutput, learningOutputSchemas } from '../../../../core/StructuredOutput.ts';

export class CheckWork {
  constructor(private readonly provider: StructuredLearningProvider, private readonly configs: ConfigurationPolicy) {}
  async execute(request: CheckWorkRequest): Promise<CheckWorkResponse> {
    validateLearningImage(request.image);
    await this.configs.validateInput(request.context.simulationConfig);
    const { image, ...input } = request;
    const raw = await this.provider.complete({ task: 'check-work', image, input, schema: learningOutputSchemas['check-work'] });
    const parsed = CheckWorkResponseSchema.safeParse(raw);
    if (!parsed.success) invalidOutput();
    if (parsed.data.status === 'unreadable') return { ...parsed.data, firstIncorrectStep: null, hint: 'Hãy chụp rõ toàn bộ các bước làm và gửi lại.' };
    return parsed.data;
  }
}
