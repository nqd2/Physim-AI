import { teachBackAssessmentSchema, workDiagnosisSchema, type Analysis, type ProblemImage, type TeachBackAssessment, type WorkDiagnosis } from '@physim/shared';
import { z } from 'zod';
import type { TeachBackSubmission } from '../../../shared/application/TutoringGateway.ts';
import { DomainError } from '../../../shared/domain/DomainError.ts';
import type { OpenAiClientAdapter } from '../../../shared/infrastructure/openai/OpenAiClientAdapter.ts';

const workOutput = z.strictObject({
  readable: z.boolean(),
  firstError: z.string().nullable(),
  hint: z.string(),
});
const teachBackOutput = z.strictObject({
  missingLink: z.string().nullable(),
  feedback: z.string(),
});

export class OpenAiCoachingEvaluator {
  private readonly ai: OpenAiClientAdapter;

  constructor(ai: OpenAiClientAdapter) {
    this.ai = ai;
  }

  async checkWork(image: ProblemImage, analysis: Analysis): Promise<WorkDiagnosis> {
    const result = await this.ai.ask('physics_handwritten_work', workOutput, [
      'Đọc từng bước trong ảnh, đối chiếu với đề gốc và nêu bước sai đầu tiên. Dùng firstError null nếu các bước nhìn thấy đều đúng.',
      'Đưa một gợi ý sửa để học sinh tự làm tiếp. Nếu ảnh không đọc được hoặc không có bài làm, đặt readable là false.',
    ].join(' '), { problemText: analysis.problemText, facts: analysis.facts }, image);
    if (!result.readable) {
      throw new DomainError('IMAGE_UNREADABLE', 422, 'Chưa đọc được bài nháp. Hãy chụp lại rõ các bước làm.');
    }
    const diagnosis = workDiagnosisSchema.safeParse({ firstError: result.firstError, hint: result.hint });
    if (!diagnosis.success) throw new DomainError('AI_INCOMPLETE', 502, 'Chưa nhận được nhận xét hợp lệ. Hãy thử lại.');
    return diagnosis.data;
  }

  async evaluateTeachBack(submission: TeachBackSubmission): Promise<TeachBackAssessment> {
    const result = await this.ai.ask('physics_teach_back', teachBackOutput, [
      'Đánh giá thứ tự mắt xích và câu giải thích so với quan hệ nhân quả trong đề.',
      'Nêu mắt xích đầu tiên bị đảo hoặc giải thích thiếu trong missingLink. Dùng null khi cả thứ tự và giải thích đều đủ.',
      'Trong feedback, ghi nhận điều học sinh đã hiểu và hỏi một câu ngắn để các em tự bổ sung bước còn thiếu.',
    ].join(' '), submission);
    const assessment = teachBackAssessmentSchema.safeParse(result);
    if (!assessment.success) throw new DomainError('AI_INCOMPLETE', 502, 'Chưa nhận được nhận xét hợp lệ. Hãy thử lại.');
    return assessment.data;
  }
}
