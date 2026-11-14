import { Platform } from 'react-native';
import {
  analysisSchema,
  catalogSchema,
  ensureReadySchema,
  teachBackAssessmentSchema,
  variantSchema,
  workDiagnosisSchema,
} from '@physim/shared';
import type { Analysis, TeachBackAssessment } from '@physim/shared';

export type Photo = { mimeType: 'image/jpeg' | 'image/png'; base64: string };
type Health = { status: 'ok' | 'degraded'; catalogReady: boolean; aiConfigured: boolean };

export const initialServer = process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export function normalizeServer(value: string) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Nhập địa chỉ máy chủ HTTP hoặc HTTPS, ví dụ https://physim.example.edu.');
  }
  if (url.pathname !== '/') throw new Error('Chỉ nhập địa chỉ gốc của máy chủ.');
  return url.origin;
}

async function request<T>(
  server: string,
  path: string,
  parse: (value: unknown) => T,
  body?: object,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(new URL('/api/v1' + path, server), {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || 'Máy chủ chưa xử lý được yêu cầu này.');
    return parse(result);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Yêu cầu mất quá nhiều thời gian. Hãy thử lại.');
    if (error instanceof TypeError) throw new Error('Không kết nối được. Kiểm tra địa chỉ máy chủ trong Cài đặt.');
    if (error instanceof SyntaxError) throw new Error('Địa chỉ máy chủ chưa trả về dữ liệu Physim-AI.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const object = <T>(data: unknown) => data as T;

export const api = {
  health: (server: string) => request(server, '/health', (data) => {
    const health = object<Health | null>(data);
    if (!health || !['ok', 'degraded'].includes(health.status) ||
        typeof health.catalogReady !== 'boolean' || typeof health.aiConfigured !== 'boolean') {
      throw new Error('Địa chỉ này chưa trả về trạng thái máy chủ Physim-AI.');
    }
    return health;
  }),
  catalog: (server: string) => request(server, '/simulations', (data) => catalogSchema.parse(data)),
  simulation: (server: string, slug: string) =>
    request(server, '/simulations/' + encodeURIComponent(slug) + '/ensure-ready', (data) => ensureReadySchema.parse(data), {}),
  analyze: (server: string, image: Photo) =>
    request(server, '/learning/analyze-photo', (data) => analysisSchema.parse(data), { image }),
  check: (server: string, image: Photo, analysis: Analysis) =>
    request(server, '/learning/check-work', (data) => workDiagnosisSchema.parse(data), { image, analysis }),
  teach: (server: string, analysis: Analysis, orderedChain: string[], explanation: string) =>
    request(server, '/learning/evaluate-teach-back', (data) => teachBackAssessmentSchema.parse(data),
      { analysis, orderedChain, explanation }),
  variant: (server: string, analysis: Analysis, assessment: TeachBackAssessment) =>
    request(server, '/learning/generate-variant', (data) => variantSchema.parse(data), { analysis, assessment }),
};
