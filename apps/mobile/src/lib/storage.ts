import { z } from 'zod';
import {
  AnalyzePhotoResponseSchema,
  CheckWorkResponseSchema,
  EvaluateTeachBackResponseSchema,
  GenerateVariantResponseSchema,
  SimulationConfigSchema,
  SimulationStateSchema,
  type AnalyzePhotoResponse,
  type CheckWorkResponse,
  type EvaluateTeachBackResponse,
  type GenerateVariantResponse,
  type SimulationConfig,
  type SimulationState,
  type SM2State,
} from '@physim/shared';

export interface LearningSession {
  id: string;
  lessonId?: string;
  title: string;
  slug: string;
  version?: string;
  screenId?: string;
  config?: SimulationConfig;
  analysis?: AnalyzePhotoResponse;
  step: 0 | 1 | 2 | 3;
  prediction?: string;
  predictionChecked?: boolean;
  hintCount: number;
  causalOrder: string[];
  explanation: string;
  teachFeedback?: EvaluateTeachBackResponse;
  workFeedback?: CheckWorkResponse;
  generatedVariant?: GenerateVariantResponse;
  variantPrediction?: string;
  variantChecked?: boolean;
  measurements?: SimulationState[];
  completedSteps?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewCard extends SM2State {
  id: string;
  lessonId?: string;
  title: string;
  question: string;
  answer: string;
  slug: string;
  version: string;
  screenId: string;
  config: SimulationConfig;
  createdAt: string;
}

export interface AppSettings {
  serverUrl: string;
  reduceMotion: boolean;
}

export interface DeviceState {
  version: 1;
  settings: AppSettings;
  sessions: Record<string, LearningSession>;
  cards: ReviewCard[];
}

export const DEVICE_STORAGE_KEY = 'physim.mobile.v1';

const identifier = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/)
  .refine(value => !['__proto__', 'prototype', 'constructor'].includes(value), 'Mã định danh không hợp lệ');
const isoDate = z.string().refine(value => Number.isFinite(Date.parse(value)), 'Ngày không hợp lệ');

const sessionSchema = z.object({
  id: identifier,
  lessonId: z.string().max(160).optional(),
  title: z.string().min(1).max(500),
  slug: z.string().max(100),
  version: z.string().max(100).optional(),
  screenId: z.string().max(100).optional(),
  config: SimulationConfigSchema.optional(),
  analysis: AnalyzePhotoResponseSchema.optional(),
  step: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  prediction: z.string().max(12000).optional(),
  predictionChecked: z.boolean().optional(),
  hintCount: z.number().int().min(0).max(100),
  causalOrder: z.array(z.string().max(1000)).max(24),
  explanation: z.string().max(12000),
  teachFeedback: EvaluateTeachBackResponseSchema.optional(),
  workFeedback: CheckWorkResponseSchema.optional(),
  generatedVariant: GenerateVariantResponseSchema.optional(),
  variantPrediction: z.string().max(12000).optional(),
  variantChecked: z.boolean().optional(),
  measurements: z.array(SimulationStateSchema).max(1000).optional(),
  completedSteps: z.array(z.number().int().min(0).max(3)).max(4).optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const cardSchema = z.object({
  id: identifier,
  lessonId: z.string().max(160).optional(),
  title: z.string().min(1).max(500),
  question: z.string().min(1).max(12000),
  answer: z.string().max(12000),
  slug: z.string().min(1).max(100),
  version: z.string().min(1).max(100),
  screenId: z.string().min(1).max(100),
  config: SimulationConfigSchema,
  createdAt: isoDate,
  repetitions: z.number().int().min(0),
  intervalDays: z.number().int().min(0),
  easeFactor: z.number().finite().min(1.3),
  dueAt: isoDate,
  lastReviewedAt: isoDate.optional(),
}).superRefine((card, context) => {
  if (card.config.slug !== card.slug || card.config.screenId !== card.screenId || (card.config.version && card.config.version !== card.version)) {
    context.addIssue({ code: 'custom', message: 'Cấu hình ôn tập không khớp mô phỏng, phiên bản hoặc màn hình.', path: ['config'] });
  }
});

/** A base path is allowed for an Express server behind a reverse proxy. */
export function normalizeServerUrl(value: string): string {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Nhập địa chỉ server bắt đầu bằng http:// hoặc https://.');
  }
  let parsed: URL;
  try { parsed = new URL(trimmed); }
  catch { throw new Error('Địa chỉ server không hợp lệ.'); }
  if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Địa chỉ server không được chứa tài khoản, mật khẩu, truy vấn hoặc dấu #.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

interface BrowserAddress { protocol: string; hostname: string; port: string; origin: string }

export function defaultServerUrl(hostUri?: string, browser?: BrowserAddress): string {
  if (browser && ['http:', 'https:'].includes(browser.protocol)) {
    if (!['8081', '19000', '19006'].includes(browser.port)) return browser.origin;
    const host = browser.hostname.includes(':') ? `[${browser.hostname.replace(/^\[|\]$/g, '')}]` : browser.hostname;
    return `${browser.protocol}//${host}:4000`;
  }
  if (hostUri) {
    try {
      const host = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname;
      if (host) return `http://${host}:4000`;
    } catch { /* Settings remains available when the development host is absent. */ }
  }
  return 'http://localhost:4000';
}

export function initialDeviceState(serverUrl: string): DeviceState {
  return { version: 1, settings: { serverUrl, reduceMotion: false }, sessions: Object.create(null) as Record<string, LearningSession>, cards: [] };
}

/** Keep valid entries if a single local session/card was damaged. */
export function decodeDeviceState(raw: string | null, fallback: DeviceState): { state: DeviceState; recovered: boolean } {
  if (!raw) return { state: fallback, recovered: false };
  let candidate: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid state');
    candidate = value as Record<string, unknown>;
  } catch { return { state: fallback, recovered: true }; }
  if (candidate.version !== 1) return { state: fallback, recovered: true };
  let recovered = false;
  let settings = fallback.settings;
  const rawSettings = candidate.settings;
  if (rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)) {
    const fields = rawSettings as Record<string, unknown>;
    try {
      settings = { serverUrl: normalizeServerUrl(String(fields.serverUrl ?? '')), reduceMotion: fields.reduceMotion === true };
    } catch { recovered = true; }
  } else { recovered = true; }
  const sessions = Object.create(null) as Record<string, LearningSession>;
  if (candidate.sessions && typeof candidate.sessions === 'object' && !Array.isArray(candidate.sessions)) {
    for (const [key, value] of Object.entries(candidate.sessions)) {
      const parsed = sessionSchema.safeParse(value);
      if (parsed.success && parsed.data.id === key) sessions[key] = parsed.data;
      else recovered = true;
    }
  } else { recovered = true; }
  const cards: ReviewCard[] = [];
  const ids = new Set<string>();
  if (Array.isArray(candidate.cards)) {
    for (const value of candidate.cards) {
      const parsed = cardSchema.safeParse(value);
      if (parsed.success && !ids.has(parsed.data.id)) {
        cards.push({ ...parsed.data, config: { ...parsed.data.config, version: parsed.data.version } });
        ids.add(parsed.data.id);
      } else recovered = true;
    }
  } else { recovered = true; }
  return { state: { version: 1, settings, sessions, cards }, recovered };
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Serializing writes prevents an older async save from overwriting newer progress. */
export function createDeviceStore(adapter: StorageAdapter, key = DEVICE_STORAGE_KEY) {
  let queue = Promise.resolve();
  return {
    async read(fallback: DeviceState) {
      await queue;
      return decodeDeviceState(await adapter.getItem(key), fallback);
    },
    write(state: DeviceState): Promise<void> {
      const snapshot = JSON.stringify(state);
      const operation = queue.catch(() => {}).then(() => adapter.setItem(key, snapshot));
      queue = operation;
      return operation;
    },
  };
}

export function createId(prefix = 'session'): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}-${id}`;
}

export function validateSession(session: LearningSession): LearningSession {
  return sessionSchema.parse(session);
}

export function validateCard(card: ReviewCard): ReviewCard {
  const parsed = cardSchema.parse(card);
  return { ...parsed, config: { ...parsed.config, version: parsed.version } };
}
