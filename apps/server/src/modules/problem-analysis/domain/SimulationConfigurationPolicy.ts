import { validateSimulationConfig, type SimulationConfig, type SimulationSchema } from '@physim/shared';
import { ApiError } from '../../../core/ApiError.ts';
import type { CatalogGateway } from '../../../core/CatalogGateway.ts';
import type { CatalogChoice } from '../../../core/ConfigurationPolicy.ts';

const ADAPTER_SLUGS = ['projectile-motion', 'gas-properties', 'ohms-law', 'wave-on-a-string', 'bending-light', 'build-a-nucleus'];

export class SimulationConfigurationPolicy {
  constructor(private readonly catalog: Pick<CatalogGateway, 'getSchema' | 'list'>) {}

  async availableSchemas(): Promise<SimulationSchema[]> {
    const results = await Promise.all(ADAPTER_SLUGS.map(slug => this.catalog.getSchema(slug).catch(() => null)));
    return results.filter((schema): schema is SimulationSchema => Boolean(schema?.adapterVerified));
  }

  /** Every synced simulation; an empty list keeps analysis text-only instead of failing. */
  async catalogChoices(): Promise<CatalogChoice[]> {
    const simulations = await this.catalog.list().catch(() => []);
    return simulations.map(({ slug, title, titleEn, chapter, adapterVerified }) => ({ slug, title, titleEn, chapter, adapterVerified }));
  }

  /** Accept a suggested slug only when it exists in the synced catalog. */
  async resolveSlug(slug: string | null | undefined): Promise<string | null> {
    if (!slug) return null;
    const choices = await this.catalogChoices();
    return choices.some(choice => choice.slug === slug) ? slug : null;
  }

  async validateInput(config: SimulationConfig | undefined): Promise<void> {
    if (!config) return;
    const schema = await this.catalog.getSchema(config.slug).catch(() => null);
    if (!schema || !schema.adapterVerified) {
      throw new ApiError('SIM_NOT_READY', 409, 'Cấu hình này chưa có adapter được kiểm chứng. Hãy mở mô phỏng ở chế độ tương tác trực tiếp.');
    }
    if (!validateSimulationConfig(schema, config).success) {
      throw new ApiError('INVALID_CONFIG', 400, 'Cấu hình mô phỏng không hợp lệ hoặc không còn khớp phiên bản. Hãy mở lại bài học.');
    }
  }

  async validateOutput(config: SimulationConfig | null): Promise<SimulationConfig | null> {
    if (!config) return null;
    const schema = await this.catalog.getSchema(config.slug).catch(() => null);
    // An otherwise readable question remains useful as text when a simulation has no verified adapter.
    if (!schema || !schema.adapterVerified) return null;
    const pinned = { ...config, version: schema.version };
    if (config.version && config.version !== schema.version) this.invalidOutput();
    if (!validateSimulationConfig(schema, pinned).success) this.invalidOutput();
    return pinned;
  }

  private invalidOutput(): never {
    throw new ApiError('AI_INVALID_RESPONSE', 502, 'AI trả về cấu hình chưa hợp lệ. Chưa áp dụng thay đổi; hãy thử lại.', true);
  }
}
