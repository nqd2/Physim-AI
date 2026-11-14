import type { SimulationConfig, SimulationSchema, SimulationSummary } from '@physim/shared';

/** Catalog entry the AI may suggest for interactive use, even without a verified adapter. */
export type CatalogChoice = Pick<SimulationSummary, 'slug' | 'title' | 'titleEn' | 'chapter' | 'adapterVerified'>;

/** Both learning contexts depend on this port, not on a catalog persistence mechanism. */
export interface ConfigurationPolicy {
  availableSchemas(): Promise<SimulationSchema[]>;
  catalogChoices(): Promise<CatalogChoice[]>;
  resolveSlug(slug: string | null | undefined): Promise<string | null>;
  validateInput(config: SimulationConfig | undefined): Promise<void>;
  validateOutput(config: SimulationConfig | null): Promise<SimulationConfig | null>;
}
