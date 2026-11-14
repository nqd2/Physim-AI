import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { DEFAULT_OPENAI_MODEL, ErrorCodeSchema, SAMPLE_LESSONS } from '@physim/shared';
import { ApiError } from './core/ApiError.ts';
import { findWorkspaceRoot } from './core/workspaceRoot.ts';
import type { CatalogGateway } from './core/CatalogGateway.ts';
import { OpenAIResponsesProvider, ProviderError, type StructuredLearningProvider } from './infrastructure/openai/index.ts';
import { FileSystemSimulationCatalog } from './modules/simulation-catalog/infrastructure/FileSystemSimulationCatalog.ts';
import { CatalogError } from './modules/simulation-catalog/domain/SimulationCatalog.ts';
import { createSimulationCatalogRouter } from './modules/simulation-catalog/presentation/createSimulationCatalogRouter.ts';
import { SimulationConfigurationPolicy } from './modules/problem-analysis/domain/SimulationConfigurationPolicy.ts';
import { AnalyzePhoto } from './modules/problem-analysis/application/analyze-photo/AnalyzePhoto.ts';
import { CheckWork } from './modules/problem-analysis/application/check-work/CheckWork.ts';
import { EvaluateTeachBack } from './modules/coaching-evaluation/application/evaluate-teach-back/EvaluateTeachBack.ts';
import { GenerateVariant } from './modules/coaching-evaluation/application/generate-variant/GenerateVariant.ts';
import { createProblemAnalysisRouter } from './modules/problem-analysis/presentation/createProblemAnalysisRouter.ts';
import { createCoachingEvaluationRouter } from './modules/coaching-evaluation/presentation/createCoachingEvaluationRouter.ts';

const DEFAULT_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:4000', 'http://127.0.0.1:4000'];

export interface AppOptions {
  catalog?: CatalogGateway;
  provider?: StructuredLearningProvider;
  storageDir?: string;
  webDir?: string;
  bridgeDir?: string;
  allowedOrigins?: string[];
  apiKey?: string;
  model?: string;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const workspaceRoot = findWorkspaceRoot(import.meta.url);
  const catalog = options.catalog ?? new FileSystemSimulationCatalog({ storageDir: options.storageDir ?? path.join(workspaceRoot, 'apps/server/storage/phet-sims') });
  const provider = options.provider ?? new OpenAIResponsesProvider({ apiKey: options.apiKey, model: options.model });
  const configs = new SimulationConfigurationPolicy(catalog);
  const allowedOrigins = new Set(options.allowedOrigins ?? (process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) || DEFAULT_ORIGINS));
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const webDir = path.resolve(options.webDir ?? path.join(workspaceRoot, 'apps/mobile/dist'));
  const bridgeDir = path.resolve(options.bridgeDir ?? path.join(workspaceRoot, 'apps/server/src/phet-bridge'));

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set({ 'X-Request-Id': res.locals.requestId, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    let sameOrigin = false;
    if (origin) {
      try { const parsed = new URL(origin); sameOrigin = parsed.origin === `${req.protocol}://${req.get('host')}`; } catch { /* invalid origin remains rejected */ }
    }
    if (origin && !sameOrigin && !allowedOrigins.has(origin)) return next(new ApiError('VALIDATION_ERROR', 403, 'Nguồn trang web chưa được server cho phép. Hãy kiểm tra ALLOWED_ORIGINS.'));
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.vary('Origin'); }
    if (req.method === 'OPTIONS') {
      res.set({ 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      res.status(204).end(); return;
    }
    next();
  });
  app.use('/api', express.json({ limit: '15mb' }));
  app.get('/api/v1/health', (_req, res) => res.json({ ok: true, service: 'physim-ai', protocolVersion: 1, ai: { configured: Boolean(apiKey?.trim()), model } }));
  app.get('/api/v1/lessons', (_req, res) => res.json({ lessons: SAMPLE_LESSONS }));
  app.use('/api/v1/simulations', createSimulationCatalogRouter(catalog));
  app.use('/api/v1/learning', createProblemAnalysisRouter({ analyzePhoto: new AnalyzePhoto(provider, configs), checkWork: new CheckWork(provider, configs) }));
  app.use('/api/v1/learning', createCoachingEvaluationRouter({ evaluateTeachBack: new EvaluateTeachBack(provider, configs), generateVariant: new GenerateVariant(provider, configs) }));
  app.use('/api', (_req, _res, next) => next(new ApiError('NOT_FOUND', 404, 'API không tồn tại.')));

  app.get('/simulations/:slug/:version/:locale.html', async (req, res) => {
    const filename = await catalog.resolveHtml(String(req.params.slug), String(req.params.version), String(req.params.locale));
    res.set('Cache-Control', 'no-cache');
    res.type('html').sendFile(path.basename(filename), { root: path.dirname(filename) });
  });
  app.get('/bridge/:file', (req, res, next) => {
    const name = String(req.params.file);
    if (!['adapters.js', 'physim-bridge.js'].includes(name)) return next(new ApiError('NOT_FOUND', 404, 'Tệp không tồn tại.'));
    res.set('Cache-Control', 'no-cache');
    res.sendFile(name, { root: bridgeDir });
  });
  // Only the Expo export is public. Source, photos, manifests and secrets are never static roots.
  app.use(express.static(webDir, { dotfiles: 'deny', maxAge: 0, index: 'index.html' }));
  app.get('/{*route}', (req, res, next) => {
    let decodedPath: string;
    try { decodedPath = decodeURIComponent(req.path); } catch { return next(); }
    if (!req.accepts('html') || path.extname(decodedPath) || decodedPath.split('/').some(segment => segment.startsWith('.')) || !existsSync(path.join(webDir, 'index.html'))) return next();
    res.sendFile('index.html', { root: webDir });
  });
  app.use((_req, _res, next) => next(new ApiError('NOT_FOUND', 404, 'Không tìm thấy nội dung này.')));
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (res.headersSent) { res.destroy(); return; }
    let status = 500, code = 'INTERNAL_ERROR', message = 'Server chưa xử lý được yêu cầu. Hãy thử lại.', retryable = true;
    if (error instanceof ZodError) {
      status = 400; code = 'VALIDATION_ERROR'; message = 'Dữ liệu gửi lên chưa hợp lệ. Hãy kiểm tra ảnh và thông tin bài học.'; retryable = false;
      if (error.issues.some(issue => issue.code === 'too_big' && issue.path.at(-1) === 'base64')) { status = 413; code = 'IMAGE_TOO_LARGE'; message = 'Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 10 MB.'; }
      else if (error.issues.some(issue => issue.path.at(-1) === 'mimeType')) { code = 'UNSUPPORTED_IMAGE'; message = 'Hãy chọn ảnh JPEG hoặc PNG.'; }
    }
    else if (error instanceof ApiError || error instanceof ProviderError || error instanceof CatalogError) { ({ status, code, message, retryable } = error); }
    else if (error && typeof error === 'object') {
      const known = error as { status?: number; statusCode?: number; code?: string; type?: string; message?: string };
      if (known.type === 'entity.too.large') { status = 413; code = 'IMAGE_TOO_LARGE'; message = 'Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 10 MB.'; retryable = false; }
      else if (known.type === 'entity.parse.failed') { status = 400; code = 'VALIDATION_ERROR'; message = 'Dữ liệu JSON chưa hợp lệ.'; retryable = false; }
      else if (known.code === 'SIM_NOT_READY') { status = 409; code = 'SIMULATION_NOT_READY'; message = 'Mô phỏng chưa được đồng bộ. Người quản trị cần chạy pnpm phet:sync.'; retryable = true; }
      else if (known.code === 'SIM_NOT_FOUND' || known.status === 404 || known.statusCode === 404) { status = 404; code = 'NOT_FOUND'; message = 'Không tìm thấy mô phỏng hoặc tệp này.'; retryable = false; }
    }
    const aliases: Record<string, string> = { AI_RATE_LIMITED: 'AI_RATE_LIMIT', AI_REFUSED: 'AI_REFUSAL', SIM_NOT_READY: 'SIMULATION_NOT_READY', INVALID_IMAGE: 'UNSUPPORTED_IMAGE' };
    code = aliases[code] ?? code;
    if (!ErrorCodeSchema.safeParse(code).success) { status = 500; code = 'INTERNAL_ERROR'; message = 'Server chưa xử lý được yêu cầu. Hãy thử lại.'; retryable = true; }
    // No raw exception or request body is logged: either may contain a photo, solution or key.
    res.status(status).json({ error: { code, message, retryable }, requestId: String(res.locals.requestId) });
  };
  app.use(handleError);
  return app;
}
