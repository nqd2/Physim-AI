import { teachBackAssessmentSchema } from '@physim/shared';
import type { TeachBackSubmission, TutoringGateway } from '../../../../../shared/application/TutoringGateway.ts';
import { DomainError } from '../../../../../shared/domain/DomainError.ts';

export class EvaluateTeachBackUseCase {
  private readonly gateway: TutoringGateway;

  constructor(gateway: TutoringGateway) {
    this.gateway = gateway;
  }

  async execute(submission: TeachBackSubmission) {
    const expected = [...submission.analysis.causalChain].sort();
    const submitted = [...submission.orderedChain].sort();
    if (expected.length !== submitted.length || expected.some((link, index) => link !== submitted[index])) {
      throw new DomainError('INVALID_CAUSAL_CHAIN', 400, 'Hãy sắp xếp đầy đủ các mắt xích đã cho.');
    }
    return teachBackAssessmentSchema.parse(await this.gateway.evaluateTeachBack(submission));
  }
}
