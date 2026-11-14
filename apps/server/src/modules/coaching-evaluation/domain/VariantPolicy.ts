import type { SimulationConfig } from '@physim/shared';
import { ApiError } from '../../../core/ApiError.ts';

export function validateSingleConditionChange(base: SimulationConfig | undefined, variant: SimulationConfig | null): void {
  if (!base || !variant) return;
  const baseKeys = Object.keys(base.values), variantKeys = Object.keys(variant.values);
  const sameKeys = baseKeys.length === variantKeys.length && baseKeys.every(key => Object.hasOwn(variant.values, key));
  const changed = baseKeys.filter(key => base.values[key] !== variant.values[key]);
  if (base.slug !== variant.slug || base.screenId !== variant.screenId || !sameKeys || changed.length !== 1) {
    throw new ApiError('AI_INVALID_RESPONSE', 502, 'Biến thể chưa giữ đúng yêu cầu thay đổi một điều kiện. Hãy thử lại.', true);
  }
}
