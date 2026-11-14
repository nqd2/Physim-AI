import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6F0AAAAASUVORK5CYII=', 'base64');
const sample = { topic: 'Newton’s second law', score: 80, durationSeconds: 120, mode: 'visualize' };

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'study-buddy-test-'));
  const dataDir = path.join(directory, 'data');
  const webDir = path.join(directory, 'web');
  await mkdir(webDir);
  await writeFile(path.join(webDir, 'index.html'), '<h1>Study Buddy</h1>');
  await writeFile(path.join(directory, 'secret.txt'), 'not public');
  const server = createApp({ dataDir, webDir }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { dataDir, webDir, server, url, request: (route, options) => fetch(url + route, options) };
}

function post(body) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

test('health, initial state, static root and private path boundaries', async t => {
  const { request } = await fixture(t);
  assert.deepEqual(await (await request('/api/health')).json(), { ok: true });
  const state = await request('/api/state');
  assert.equal(state.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await state.json(), { profile: { name: 'Alex' }, streak: 0, coins: 0, xp: 0, sessions: [] });
  assert.match(await (await request('/')).text(), /Study Buddy/);
  for (const route of ['/server.js', '/UI.html', '/data/state.json', '/secret.txt', '/.env', '/api/no-such-route', '/uploads/state.json']) {
    assert.equal((await request(route)).status, 404, route);
  }
});

test('sessions persist across restart and concurrent writes preserve all awards', async t => {
  const { request, dataDir, webDir } = await fixture(t);
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => request('/api/sessions', post({ ...sample, clientSessionId: `session-${i}` }))));
  assert.ok(responses.every(response => response.status === 201));
  const state = await (await request('/api/state')).json();
  assert.equal(state.sessions.length, 12);
  assert.equal(state.coins, 60);
  assert.equal(state.xp, 12 * 26);
  assert.equal(state.streak, 1);
  const disk = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.equal(disk.sessions.length, 12);
  const duplicate = await request('/api/sessions', post({ ...sample, clientSessionId: 'session-4' }));
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
  const restarted = createApp({ dataDir, webDir }).listen(0, '127.0.0.1');
  await once(restarted, 'listening');
  t.after(() => new Promise(resolve => restarted.close(resolve)));
  const restored = await (await fetch(`http://127.0.0.1:${restarted.address().port}/api/state`)).json();
  assert.deepEqual(restored, state);
});

test('invalid sessions and cross-origin mutations do not change state', async t => {
  const { request } = await fixture(t);
  const invalid = [null, {}, { ...sample, score: 101 }, { ...sample, score: '80' }, { ...sample, score: 20.5 }, { ...sample, durationSeconds: -1 }, { ...sample, topic: ' ' }, { ...sample, mode: '' }, { ...sample, clientSessionId: '../bad' }];
  for (const body of invalid) assert.equal((await request('/api/sessions', post(body))).status, 400);
  const foreign = post(sample);
  foreign.headers.origin = 'https://foreign.example';
  assert.equal((await request('/api/sessions', foreign)).status, 403);
  const state = await (await request('/api/state')).json();
  assert.equal(state.sessions.length, 0);
  assert.equal(state.xp, 0);
});

test('upload persists image under a generated name and can be retrieved', async t => {
  const { request, dataDir } = await fixture(t);
  const form = new FormData();
  form.append('image', new Blob([PNG], { type: 'image/png' }), '../../bài-tập.png');
  const response = await request('/api/uploads', { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const uploaded = await response.json();
  assert.match(uploaded.url, /^\/uploads\/[a-f0-9-]{36}\.png$/);
  assert.equal(uploaded.name, 'bài-tập.png');
  const downloaded = await request(uploaded.url);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers.get('content-type'), /image\/png/);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), PNG);
  assert.deepEqual(await readFile(path.join(dataDir, 'uploads', path.basename(uploaded.url))), PNG);
});

test('missing, spoofed, unsupported and oversized uploads fail without exposing files', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/uploads', { method: 'POST' })).status, 400);
  for (const [bytes, type, status] of [[Buffer.from('<script>alert(1)</script>'), 'image/png', 415], [PNG, 'text/plain', 415], [Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png', 413]]) {
    const form = new FormData();
    form.append('image', new Blob([bytes], { type }), 'image.png');
    assert.equal((await request('/api/uploads', { method: 'POST', body: form })).status, status);
  }
  const wrongField = new FormData();
  wrongField.append('file', new Blob([PNG], { type: 'image/png' }), 'image.png');
  assert.equal((await request('/api/uploads', { method: 'POST', body: wrongField })).status, 400);
});

test('invalid saved data fails loudly instead of resetting progress', async t => {
  const { dataDir, webDir } = await fixture(t);
  await writeFile(path.join(dataDir, 'state.json'), '{broken');
  assert.throws(() => createApp({ dataDir, webDir }), /Cannot read saved study data/);
});
