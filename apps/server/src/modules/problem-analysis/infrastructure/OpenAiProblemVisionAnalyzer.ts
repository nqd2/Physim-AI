import { analysisSchema, simConfigSchema, variantSchema, type Analysis, type ProblemImage, type SimulationSchema, type Variant } from '@physim/shared';
import { z } from 'zod';
import type { VariantSubmission } from '../../../shared/application/TutoringGateway.ts';
import { DomainError } from '../../../shared/domain/DomainError.ts';
import type { OpenAiClientAdapter } from '../../../shared/infrastructure/openai/OpenAiClientAdapter.ts';

const modelValue = z.union([
  z.number(),
  z.boolean(),
  z.string(),
  z.strictObject({ x: z.number(), y: z.number() }),
]);
const modelConfig = z.strictObject({
  slug: z.string(),
  screenId: z.string(),
  values: z.array(z.strictObject({ id: z.string(), value: modelValue })),
  actionId: z.string().nullable(),
});
const modelAnalysis = z.strictObject({
  problemText: z.string(),
  facts: z.array(z.string()),
  misconception: z.strictObject({
    question: z.string(),
    choices: z.array(z.string()),
    correctIndex: z.number().int(),
    explanation: z.string(),
  }),
  hints: z.array(z.strictObject({ text: z.string(), config: modelConfig.nullable() })),
  causalChain: z.array(z.string()),
  config: modelConfig.nullable(),
});
const photoOutput = z.strictObject({
  status: z.enum(['readable', 'unreadable', 'not_physics']),
  analysis: modelAnalysis.nullable(),
});
const variantOutput = z.strictObject({
  question: z.string(),
  expectedObservation: z.string(),
  config: modelConfig.nullable(),
});

function toConfig(config: z.output<typeof modelConfig> | null) {
  if (!config) return null;
  const values = Object.fromEntries(config.values.map(({ id, value }) => [id, value]));
  if (Object.keys(values).length !== config.values.length) return null;
  const parsed = simConfigSchema.safeParse({ ...config, values });
  return parsed.success ? parsed.data : null;
}

function capabilities(simulation: SimulationSchema) {
  return {
    slug: simulation.slug,
    title: simulation.title,
    screens: simulation.screens.map(screen => ({
      id: screen.id,
      title: screen.title,
      properties: screen.properties.filter(property => property.writable),
      actions: screen.actions,
    })),
  };
}

export class OpenAiProblemVisionAnalyzer {
  private readonly ai: OpenAiClientAdapter;

  constructor(ai: OpenAiClientAdapter) {
    this.ai = ai;
  }

  async analyzePhoto(image: ProblemImage, simulations: SimulationSchema[]): Promise<Analysis> {
    const result = await this.ai.ask('physics_problem_photo', photoOutput, [
      'Chép đề đọc được trong ảnh, giữ số và đơn vị. Bỏ qua tên học sinh và phần nhận dạng cá nhân.',
      'Nếu ảnh mờ hoặc thiếu đề, trả status unreadable. Nếu đề không về Vật lý, trả status not_physics. Trong hai trường hợp đó analysis là null.',
      'Với đề đọc được, trả các dữ kiện, một câu dự đoán có 2–4 lựa chọn, chỉ số đáp án tính từ 0 và giải thích ngắn.',
      'Đưa 2–4 gợi ý theo thứ tự tăng dần và 2–5 mắt xích nhân quả theo thứ tự đúng.',
      'Chỉ cung cấp config cho một mô phỏng thực sự minh họa được bài và dùng đúng ID, đơn vị, kiểu, bước nhảy và khoảng đã cho. Hints dùng cùng mô phỏng với config. Với một config, liệt kê mỗi giá trị dưới dạng cặp id và value, actionId là null khi không cần. Nếu không phù hợp, đặt config thành null.',
    ].join(' '), { simulations: simulations.map(capabilities) }, image);
    if (result.status === 'unreadable') {
      throw new DomainError('IMAGE_UNREADABLE', 422, 'Chưa đọc được đề. Hãy chụp lại rõ chữ và đủ phần đề.');
    }
    if (result.status === 'not_physics') {
      throw new DomainError('NOT_PHYSICS_PROBLEM', 422, 'Hãy gửi ảnh chứa một đề Vật lý.');
    }
    if (!result.analysis) {
      throw new DomainError('AI_INCOMPLETE', 502, 'Phản hồi AI chưa đủ dữ liệu để mở bài học. Hãy thử lại.');
    }

    const candidate = result.analysis;
    const parsed = analysisSchema.safeParse({
      ...candidate,
      config: toConfig(candidate.config),
      hints: candidate.hints.map(hint => ({ ...hint, config: toConfig(hint.config) })),
    });
    if (!parsed.success) {
      throw new DomainError('AI_INCOMPLETE', 502, 'Phản hồi AI chưa đủ dữ liệu để mở bài học. Hãy thử lại.');
    }
    return parsed.data;
  }

  async generateVariant(submission: VariantSubmission, simulation: SimulationSchema | null): Promise<Variant> {
    const result = await this.ai.ask('physics_adaptive_variant', variantOutput, [
      'Dựa vào nhận xét teach-back để đặt đúng một câu hỏi Điều gì xảy ra nếu, giữ cùng trọng tâm của đề gốc.',
      'Chỉ đổi một điều kiện riêng lẻ. expectedObservation mô tả hệ quả cần quan sát bằng tiếng Việt.',
      'Nếu có mô phỏng phù hợp và config gốc, giữ nguyên slug, screenId, actionId và toàn bộ ID trong values. Chỉ thay giá trị ứng với điều kiện thay đổi và tuân theo phạm vi. Nếu không minh họa được, dùng config null.',
    ].join(' '), { submission, simulation: simulation ? capabilities(simulation) : null });
    const parsed = variantSchema.safeParse({ ...result, config: toConfig(result.config) });
    if (!parsed.success) {
      throw new DomainError('AI_INCOMPLETE', 502, 'AI chưa tạo được câu hỏi biến thể hợp lệ. Hãy thử lại.');
    }
    return parsed.data;
  }
}
