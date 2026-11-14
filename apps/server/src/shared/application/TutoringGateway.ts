import type { Analysis, ProblemImage, SimConfig, SimulationSchema, TeachBackAssessment, Variant, WorkDiagnosis } from '@physim/shared';

export interface TeachBackSubmission {
  analysis: Analysis;
  orderedChain: string[];
  explanation: string;
}

export interface VariantSubmission {
  analysis: Analysis;
  assessment: TeachBackAssessment;
}

export interface TutoringGateway {
  analyzePhoto(image: ProblemImage, simulations: SimulationSchema[]): Promise<Analysis>;
  checkWork(image: ProblemImage, analysis: Analysis): Promise<WorkDiagnosis>;
  evaluateTeachBack(submission: TeachBackSubmission): Promise<TeachBackAssessment>;
  generateVariant(submission: VariantSubmission, simulation: SimulationSchema | null): Promise<Variant>;
}

export interface ConfigurationValidator {
  verified(config: SimConfig | null): Promise<SimConfig | null>;
  simulationFor(config: SimConfig | null): Promise<SimulationSchema | null>;
}
