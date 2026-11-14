import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { SimulationSchema, EnsureReadyResponse } from '@physim/shared';
import { ApiErrorSchema, AnalyzePhotoResponseSchema } from '@physim/shared';
import { createApp, type AppOptions } from '../src/app.ts';
import type { CatalogGateway } from '../src/core/CatalogGateway.ts';
import { CatalogError } from '../src/modules/simulation-catalog/domain/SimulationCatalog.ts';
import { ProviderError, type StructuredLearningProvider, type StructuredTaskRequest } from '../src/infrastructure/openai/index.ts';

const image = { mimeType: 'image/png' as const, base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zf1kAAAAASUVORK5CYII=' };
const schema: SimulationSchema = { slug: 'ohms-law', version: '1.0.0', adapterVerified: true, screens: [{ id: 'ohms-law', name: 'Định luật Ohm', properties: [
  { key: 'voltage', type: 'number', min: 0.1, max: 9, writable: true },
  { key: 'resistance', type: 'number', min: 10, max: 1000, writable: true },
  { key: 'current', type: 'number', writable: false },
], actions: [{ id: 'observe', name: 'Quan sát' }] }] };
const config = { slug: 'ohms-law', version: '1.0.0', screenId: 'ohms-law', values: { voltage: 6, resistance: 100 } };
const context = { problem: 'Giữ điện trở không đổi và tăng hiệu điện thế.', simulationConfig: config, step: 2 as const };
const wireAnalysis = () => ({ status: 'readable', message: 'Đã đọc đề.', transcription: 'Bài tập định luật Ohm.', facts: [{ label: 'U', value: '6', unit: 'V' }], misconceptions: ['Dòng điện bị tiêu hao'], hints: ['Xét quan hệ I, U và R.'], simulationConfig: { slug: 'ohms-law', version: null, screenId: 'ohms-law', values: [{ key: 'voltage', value: 6 }, { key: 'resistance', value: 100 }] } });

function fakeCatalog(overrides: Partial<CatalogGateway> = {}): CatalogGateway {
  return {
    list: async () => [],
    getSchema: async slug => { if (slug !== schema.slug) throw new CatalogError('NOT_FOUND', 'Không tìm thấy.', 404); return structuredClone(schema); },
    ensureReady: async (slug, version) => {
      if (slug !== schema.slug) throw new CatalogError('NOT_FOUND', 'Không tìm thấy.', 404);
      if (version && version !== schema.version) throw new CatalogError('SIMULATION_VERSION_MISMATCH', 'Phiên bản không khớp.', 409);
      return { slug, version: schema.version, locale: 'vi', url: `/simulations/${slug}/${schema.version}/vi.html`, capabilities: ['GET_STATE'], adapterVerified: true, attribution: 'PhET', license: { id: 'CC-BY-NC-4.0', url: 'https://phet.colorado.edu/en/licensing/' } } satisfies EnsureReadyResponse;
    },
    resolveHtml: async () => { throw new CatalogError('NOT_FOUND', 'Không tìm thấy.', 404); },
    ...overrides,
  };
}
async function serve(t: TestContext, options: AppOptions = {}) {
  const app = createApp({ apiKey: '', catalog: fakeCatalog(), ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    get: (url: string) => fetch(base + url),
    post: (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }),
    base,
  };
}
const provider = (reply: (request: StructuredTaskRequest) => unknown): StructuredLearningProvider => ({ complete: async request => reply(request) });

test('health, six samples, catalog and no server learner-state endpoints', async t => {
  const client = await serve(t);
  const health = await (await client.get('/api/v1/health')).json();
  assert.equal(health.ok, true); assert.equal(health.ai.configured, false);
  assert.equal((await (await client.get('/api/v1/lessons')).json()).lessons.length, 6);
  assert.equal((await (await client.get('/api/v1/simulations')).json()).total, 0);
  assert.equal((await (await client.get('/api/v1/simulations/ohms-law/schema')).json()).version, '1.0.0');
  assert.equal((await client.post('/api/v1/simulations/ohms-law/ensure-ready', {})).status, 200);
  const changed = await client.post('/api/v1/simulations/ohms-law/ensure-ready', { version: '0.9.0' });
  assert.equal(changed.status, 409); assert.equal((await changed.json()).error.code, 'SIMULATION_VERSION_MISMATCH');
  assert.equal((await client.get('/api/v1/state')).status, 404);
  assert.equal((await client.post('/api/v1/sessions', { sessionId: 'abc' })).status, 404);
});

test('missing key returns helpful typed error without fake AI output', async t => {
  const client = await serve(t);
  const response = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'test-a', image });
  assert.equal(response.status, 503);
  const body = ApiErrorSchema.parse(await response.json());
  assert.equal(body.error.code, 'AI_NOT_CONFIGURED'); assert.equal(body.error.retryable, false);
});

test('analysis normalizes strict provider wire shape and validates pinned config', async t => {
  let received: StructuredTaskRequest | undefined;
  const client = await serve(t, { provider: provider(request => { received = request; return wireAnalysis(); }) });
  const response = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'session-a', image });
  assert.equal(response.status, 200);
  const body = AnalyzePhotoResponseSchema.parse(await response.json());
  assert.deepEqual(body.simulationConfig, config);
  assert.equal(received?.task, 'analyze-photo'); assert.deepEqual(received?.image, image);
  assert.equal(JSON.stringify(received?.input).includes(image.base64), false);
});

test('blurred image asks retake and unsupported simulation remains textual', async t => {
  let mode: 'blur' | 'unsupported' = 'blur';
  const client = await serve(t, { provider: provider(() => {
    const result = wireAnalysis();
    if (mode === 'blur') return { ...result, status: 'unreadable', message: 'Hãy chụp lại ảnh rõ hơn.' };
    return { ...result, simulationConfig: { ...result.simulationConfig, slug: 'unknown-sim' } };
  }) });
  const blur = await (await client.post('/api/v1/learning/analyze-photo', { sessionId: 'blur', image })).json();
  assert.equal(blur.status, 'unreadable'); assert.equal(blur.simulationConfig, null); assert.deepEqual(blur.facts, []);
  assert.equal(blur.transcription, ''); assert.deepEqual(blur.misconceptions, []);
  mode = 'unsupported';
  const text = await (await client.post('/api/v1/learning/analyze-photo', { sessionId: 'text', image })).json();
  assert.equal(text.status, 'no_simulation'); assert.equal(text.simulationConfig, null); assert.ok(text.hints.length > 0);
});

test('invalid model output, duplicate properties and out-of-range config never reach app', async t => {
  let reply: unknown;
  const client = await serve(t, { provider: provider(() => reply) });
  const duplicate = wireAnalysis(); duplicate.simulationConfig.values.push({ key: 'voltage', value: 7 });
  const outside = wireAnalysis(); outside.simulationConfig.values[0]!.value = 100;
  const readonly = wireAnalysis(); readonly.simulationConfig.values.push({ key: 'current', value: 1 });
  for (const data of [{ invented: 'answer' }, duplicate, outside, readonly]) {
    reply = data;
    const response = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'invalid', image });
    assert.equal(response.status, 502); assert.equal((await response.json()).error.code, 'AI_INVALID_RESPONSE');
  }
});

test('work and teach-back validate context before provider; variant changes exactly one condition', async t => {
  let calls = 0, variantValues = [{ key: 'voltage', value: 3 }, { key: 'resistance', value: 100 }];
  const client = await serve(t, { provider: provider(request => {
    calls++;
    if (request.task === 'check-work') return { status: 'checked', message: 'Kiểm tra đơn vị.', firstIncorrectStep: 'Bước 2', hint: 'Xét I = U/R.' };
    if (request.task === 'evaluate-teach-back') return { status: 'evaluated', correct: false, missingLinks: ['Điện trở giữ nguyên'], feedback: 'Cần nêu điều kiện giữ nguyên.' };
    return { status: 'generated', problem: 'Giảm U còn 3 V.', changedCondition: 'Giảm hiệu điện thế.', hints: ['Giữ R không đổi.'], simulationConfig: { slug: 'ohms-law', version: '1.0.0', screenId: 'ohms-law', values: variantValues } };
  }) });
  assert.equal((await client.post('/api/v1/learning/check-work', { sessionId: 'work', image, context })).status, 200);
  assert.equal((await client.post('/api/v1/learning/evaluate-teach-back', { sessionId: 'teach', context, explanation: 'Dòng điện tăng.', orderedLinks: [] })).status, 200);
  assert.equal((await client.post('/api/v1/learning/generate-variant', { sessionId: 'variant', context })).status, 200);
  variantValues = [{ key: 'voltage', value: 3 }, { key: 'resistance', value: 200 }];
  assert.equal((await client.post('/api/v1/learning/generate-variant', { sessionId: 'variant-2', context })).status, 502);
  variantValues = [{ key: 'voltage', value: 6 }];
  assert.equal((await client.post('/api/v1/learning/generate-variant', { sessionId: 'variant-removed-key', context })).status, 502);
  const before = calls;
  const invalidContext = { ...context, simulationConfig: { ...config, values: { voltage: 99 } } };
  assert.equal((await client.post('/api/v1/learning/check-work', { sessionId: 'work', image, context: invalidContext })).status, 400);
  assert.equal(calls, before);
});

test('bad MIME, invalid base64 and request DTO are rejected before the provider', async t => {
  let calls = 0;
  const client = await serve(t, { provider: provider(() => { calls++; return wireAnalysis(); }) });
  for (const invalid of [
    { sessionId: 'bad', image: { mimeType: 'image/svg+xml', base64: image.base64 } },
    { sessionId: 'bad', image: { mimeType: 'image/png', base64: 'dGV4dA==' } },
    { sessionId: 'bad', image: { mimeType: 'image/png', base64: '%%%=' } },
    { sessionId: 'bad', image: { mimeType: 'image/png', base64: Buffer.from(image.base64, 'base64').subarray(0, 40).toString('base64') } },
    { sessionId: 'bad', image: { mimeType: 'image/jpeg', base64: Buffer.from([255,216,255,217]).toString('base64') } },
    { sessionId: '../bad', image },
    { sessionId: 'bad', image, apiKey: 'should-not-be-accepted' },
  ]) assert.equal((await client.post('/api/v1/learning/analyze-photo', invalid)).status, 400);
  assert.equal(calls, 0);
});

test('complete JPEG images are accepted and oversized base64 returns the image limit error', async t => {
  let calls = 0;
  const client = await serve(t, { provider: provider(() => { calls++; return wireAnalysis(); }) });
  const jpeg = await readFile(new URL('./fixtures/authored-mark.jpg', import.meta.url));
  const valid = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'jpeg', image: { mimeType: 'image/jpeg', base64: jpeg.toString('base64') } });
  assert.equal(valid.status, 200); assert.equal(calls, 1);
  const tooLarge = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'big', image: { mimeType: 'image/png', base64: 'A'.repeat(Math.ceil(10 * 1024 * 1024 / 3) * 4 + 4) } });
  assert.equal(tooLarge.status, 413); assert.equal((await tooLarge.json()).error.code, 'IMAGE_TOO_LARGE'); assert.equal(calls, 1);
});

test('CORS allows configured development origin and rejects foreign origins', async t => {
  const client = await serve(t, { allowedOrigins: ['https://class.example'] });
  const allowed = await fetch(client.base + '/api/v1/health', { headers: { Origin: 'https://class.example' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://class.example');
  const sameOrigin = await fetch(client.base + '/api/v1/health', { headers: { Origin: client.base } });
  assert.equal(sameOrigin.status, 200);
  const changedScheme = await fetch(client.base + '/api/v1/health', { headers: { Origin: client.base.replace('http:', 'https:') } });
  assert.equal(changedScheme.status, 403); assert.equal(changedScheme.headers.get('access-control-allow-origin'), null);
  const denied = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'x', image }, { Origin: 'https://foreign.example' });
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('provider errors use public codes and unknown errors do not leak input or secrets', async t => {
  let error: Error = new ProviderError('AI_RATE_LIMITED', 'Hãy thử lại.', 429, true);
  const client = await serve(t, { provider: provider(() => { throw error; }) });
  let response = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'a', image });
  assert.equal(response.status, 429); assert.equal(ApiErrorSchema.parse(await response.json()).error.code, 'AI_RATE_LIMIT');
  error = new ProviderError('AI_REFUSED', 'Không xử lý được.', 422, false);
  response = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'b', image });
  assert.equal(ApiErrorSchema.parse(await response.json()).error.code, 'AI_REFUSAL');
  error = new Error('secret-key-and-private-solution');
  response = await client.post('/api/v1/learning/analyze-photo', { sessionId: 'c', image });
  assert.equal(response.status, 500); assert.equal((await response.text()).includes(error.message), false);
});

test('only Expo export and resolved simulation files are served', async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'physim-server-'));
  assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir()) + path.sep + 'physim-server-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const webDir = path.join(folder, 'web'); await mkdir(webDir);
  await writeFile(path.join(webDir, 'index.html'), '<!doctype html><title>Physim</title>');
  const simulation = path.join(folder, 'simulation.html'); await writeFile(simulation, '<!doctype html><title>PhET</title>');
  const client = await serve(t, { webDir, catalog: fakeCatalog({ resolveHtml: async (slug, version, locale) => {
    if (slug !== 'ohms-law' || version !== '1.0.0' || locale !== 'vi') throw new CatalogError('NOT_FOUND', 'Không tìm thấy.', 404);
    return simulation;
  } }) });
  assert.equal((await client.get('/')).status, 200);
  assert.equal((await client.get('/lab/example')).status, 200);
  const html = await client.get('/simulations/ohms-law/1.0.0/vi.html');
  assert.equal(html.status, 200); assert.equal(html.headers.get('cache-control'), 'no-cache');
  assert.equal((await client.get('/simulations/ohms-law/2.0.0/vi.html')).status, 404);
  for (const url of ['/.env', '/%2eenv', '/server.js', '/storage/phet-sims/active.json', '/bridge/../app.ts']) assert.equal((await client.get(url)).status, 404);
});
