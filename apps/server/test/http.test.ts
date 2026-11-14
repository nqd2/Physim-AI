import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import type { TutoringGateway } from '../src/shared/application/TutoringGateway.ts';

const simulation = {
  slug: 'ohms-law', title: 'Định luật Ohm', chapter: 'electromagnetism', version: '1.4.33', locale: 'vi',
  assetPath: 'ohms-law-1.4.33-vi-fakehash.html', sha256: '0'.repeat(64), bridgeMode: 'guided',
  screens: [{ id: 'main', title: 'Định luật Ohm', properties: [{ id: 'voltage', label: 'Điện áp', kind: 'number', writable: true, defaultValue: 4.5, range: [0, 9], unit: 'V' }], actions: [{ id: 'measure', label: 'Đo dòng điện' }] }],
};
const analysis = {
  problemText: 'Suất điện động 4,5 V, điện trở 3 Ω. Tính cường độ dòng điện.', facts: ['U = 4,5 V', 'R = 3 Ω'],
  misconception: { question: 'Tăng điện trở thì I thay đổi thế nào?', choices: ['Tăng', 'Giảm'], correctIndex: 1, explanation: 'I = U/R, với U không đổi.' },
  hints: [{ text: 'Viết định luật Ohm.', config: null }], causalChain: ['Giữ nguyên U', 'Tăng R', 'I giảm'],
  config: { slug: 'ohms-law', screenId: 'main', values: { voltage: 4.5 }, actionId: 'measure' },
};
const diagnosis = { firstError: 'Bước 2 dùng phép nhân.', hint: 'Chia U cho R.' };
const assessment = { missingLink: null, feedback: 'Đúng quan hệ giữa R và I.' };
const variant = { question: 'Nếu U tăng lên 6 V thì sao?', expectedObservation: 'I tăng.', config: { ...analysis.config, values: { voltage: 6 } } };
const image = { mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSdoAAAAASUVORK5CYII=' };
let photoCalls = 0;
let invalidConfig = false;
let invalidHint = false;
const model: TutoringGateway = {
  async analyzePhoto() {
    photoCalls++;
    return {
      ...analysis,
      config: invalidConfig ? { ...analysis.config, values: { voltage: 100 } } : analysis.config,
      hints: invalidHint ? [{ text: 'Vẽ mạch điện.', config: { ...analysis.config, slug: 'resistance-in-a-wire' } }] : analysis.hints,
    };
  },
  async checkWork() { return diagnosis; },
  async evaluateTeachBack() { return assessment; },
  async generateVariant() { return variant; },
};

let base: string;
let cleanup: () => Promise<void>;
let storage: string;

before(async () => {
  storage = await mkdtemp(join(tmpdir(), 'physim-http-'));
  const path = join(storage, 'phet-sims');
  await mkdir(path, { recursive: true });
  await writeFile(join(path, simulation.assetPath), '<html lang="vi"><title>Định luật Ohm</title></html>');
  await writeFile(join(storage, 'sim-schemas.json'), JSON.stringify({ schemaVersion: 1, simulations: [simulation] }));
  const server = createApp({ storageDir: storage, model, corsOrigins: ['https://app.example.test'] }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Server did not bind TCP');
  base = `http://127.0.0.1:${address.port}`;
  cleanup = async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(storage, { recursive: true, force: true });
  };
});

after(async () => cleanup?.());

async function post(path: string, body: unknown) {
  return fetch(base + '/api/v1' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('serves the activated catalog and its versioned simulation', async () => {
  const health = await fetch(base + '/api/v1/health');
  assert.deepEqual(await health.json(), { status: 'ok', catalogReady: true, aiConfigured: true });
  const catalog = await fetch(base + '/api/v1/simulations');
  assert.deepEqual(await catalog.json(), { schemaVersion: 1, simulations: [simulation] });
  const schema = await fetch(base + '/api/v1/simulations/ohms-law/schema');
  assert.deepEqual(await schema.json(), simulation);
  const ready = await post('/simulations/ohms-law/ensure-ready', {});
  assert.equal(ready.status, 200);
  const { url } = await ready.json() as { url: string };
  const asset = await fetch(base + url);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-security-policy') ?? '', /frame-ancestors 'self' https:\/\/app\.example\.test/u);
  assert.match(await asset.text(), /Định luật Ohm/u);
});

test('exposes the catalog to the configured web app origin', async () => {
  for (const [origin, expected] of [['https://app.example.test', 'https://app.example.test'], ['https://untrusted.example.test', null]] as const) {
    const response = await fetch(base + '/api/v1/simulations', { headers: { Origin: origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), expected);
    await response.body?.cancel();
  }
});

test('handles each learning endpoint through the tutoring gateway', async () => {
  for (const [slug, input, output] of [
    ['analyze-photo', { image }, analysis],
    ['check-work', { image, analysis }, diagnosis],
    ['evaluate-teach-back', { analysis, orderedChain: analysis.causalChain, explanation: 'Tăng R ở U cố định làm I giảm.' }, assessment],
    ['generate-variant', { analysis, assessment }, variant],
  ] as const) {
    const response = await post('/learning/' + slug, input);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), output);
  }
});

test('rejects image MIME mismatches before sending a request to the gateway', async () => {
  const before = photoCalls;
  const response = await post('/learning/analyze-photo', { image: { ...image, mimeType: 'image/jpeg' } });
  assert.equal(response.status, 400);
  assert.equal(photoCalls, before);
});

test('removes a model configuration that violates catalog bounds', async () => {
  invalidConfig = true;
  try {
    const response = await post('/learning/analyze-photo', { image });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { config: unknown }).config, null);
  } finally {
    invalidConfig = false;
  }
});

test('keeps textual hints when their configuration refers to a different guided simulation', async () => {
  invalidHint = true;
  const manifest = join(storage, 'sim-schemas.json');
  try {
    await writeFile(manifest, JSON.stringify({
      schemaVersion: 1,
      simulations: [simulation, { ...simulation, slug: 'resistance-in-a-wire' }],
    }));
    const response = await post('/learning/analyze-photo', { image });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as { hints: unknown }).hints, [{ text: 'Vẽ mạch điện.', config: null }]);
  } finally {
    invalidHint = false;
    await writeFile(manifest, JSON.stringify({ schemaVersion: 1, simulations: [simulation] }));
  }
});

test('gives a consistent 404 for unknown simulation IDs', async () => {
  const response = await post('/simulations/unknown/ensure-ready', {});
  assert.equal(response.status, 404);
  assert.equal((await response.json() as { error: { code: string } }).error.code, 'SIM_NOT_FOUND');
});
