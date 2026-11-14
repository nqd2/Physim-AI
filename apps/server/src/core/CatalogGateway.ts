import type { EnsureReadyResponse, SimulationSchema, SimulationSummary } from '@physim/shared';

/** Application-facing catalog port; the filesystem implementation lives in its bounded context. */
export interface CatalogGateway {
  list(): Promise<SimulationSummary[]>;
  getSchema(slug: string): Promise<SimulationSchema>;
  ensureReady(slug: string, version?: string): Promise<EnsureReadyResponse>;
  resolveHtml(slug: string, version: string, locale: string): Promise<string>;
}
