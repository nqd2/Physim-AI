import { variantSchema, type PropertyValue, type SimConfig } from '@physim/shared';
import type { ConfigurationValidator, TutoringGateway, VariantSubmission } from '../../../../../shared/application/TutoringGateway.ts';

function sameValue(a: PropertyValue | undefined, b: PropertyValue | undefined) {
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  return a.x === b.x && a.y === b.y;
}

function changesOneCondition(initial: SimConfig | null, variant: SimConfig | null): boolean {
  if (!initial || !variant || initial.slug !== variant.slug || initial.screenId !== variant.screenId
    || (initial.actionId ?? null) !== (variant.actionId ?? null)) return false;
  const initialKeys = Object.keys(initial.values);
  if (initialKeys.length !== Object.keys(variant.values).length) return false;
  const differences = initialKeys.filter(key => !Object.hasOwn(variant.values, key)
    || !sameValue(initial.values[key], variant.values[key]));
  return differences.length === 1 && Object.hasOwn(variant.values, differences[0]);
}

export class GenerateAdaptiveVariantUseCase {
  private readonly gateway: TutoringGateway;
  private readonly configurations: ConfigurationValidator;

  constructor(gateway: TutoringGateway, configurations: ConfigurationValidator) {
    this.gateway = gateway;
    this.configurations = configurations;
  }

  async execute(submission: VariantSubmission) {
    const initial = await this.configurations.verified(submission.analysis.config);
    const simulation = await this.configurations.simulationFor(initial);
    const variant = variantSchema.parse(await this.gateway.generateVariant({
      ...submission,
      analysis: { ...submission.analysis, config: initial },
    }, simulation));
    const config = changesOneCondition(initial, variant.config)
      ? await this.configurations.verified(variant.config) : null;
    return { ...variant, config };
  }
}
