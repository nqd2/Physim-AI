import { workDiagnosisSchema, type Analysis, type ProblemImage } from '@physim/shared';
import type { TutoringGateway } from '../../../../../shared/application/TutoringGateway.ts';

export class CheckHandwrittenWorkUseCase {
  private readonly gateway: TutoringGateway;

  constructor(gateway: TutoringGateway) {
    this.gateway = gateway;
  }

  async execute(image: ProblemImage, analysis: Analysis) {
    return workDiagnosisSchema.parse(await this.gateway.checkWork(image, analysis));
  }
}
