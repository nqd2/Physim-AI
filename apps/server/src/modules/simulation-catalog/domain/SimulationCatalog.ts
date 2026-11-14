import type { EnsureReadyResponse, SimulationSchema, SimulationSummary, ErrorCode } from '@physim/shared';

export interface SimulationCatalog {
  list(): Promise<SimulationSummary[]>;
  getSchema(slug: string): Promise<SimulationSchema>;
  ensureReady(slug: string, version?: string): Promise<EnsureReadyResponse>;
  resolveHtml(slug: string, version: string, locale: string): Promise<string>;
}

export class CatalogError extends Error {
  readonly retryable: boolean;
  readonly statusCode: number;
  constructor(readonly code: ErrorCode, message: string, readonly status: number) {
    super(message);
    this.name = 'CatalogError';
    this.statusCode = status;
    this.retryable = code === 'SIMULATION_NOT_READY';
  }
}
