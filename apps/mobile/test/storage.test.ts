import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSM2, reviewSM2 } from '@physim/shared';
import {
  createDeviceStore, decodeDeviceState, defaultServerUrl, initialDeviceState, normalizeServerUrl, validateCard,
  type DeviceState, type LearningSession, type ReviewCard,
} from '../src/lib/storage.ts';

const instant = '2026-11-14T08:00:00.000Z';
const session: LearningSession = {
  id: 'session-ohm', lessonId: 'ohms-law', title: 'Định luật Ohm', slug: 'ohms-law',
  version: '1.0.0', screenId: 'main', config: { slug: 'ohms-law', version: '1.0.0', screenId: 'main', values: { voltage: 6, resistance: 500 } },
  step: 2, prediction: 'double', hintCount: 1, causalOrder: ['voltage', 'current'], explanation: 'Giữ điện trở không đổi.',
  createdAt: instant, updatedAt: instant,
};
const card: ReviewCard = {
  id: 'card-ohm', lessonId: 'ohms-law', title: 'Định luật Ohm', question: 'Tăng U thì I thay đổi thế nào?',
  answer: 'I tăng cùng tỉ lệ khi R không đổi.', slug: 'ohms-law', version: '1.0.0', screenId: 'main',
  config: session.config!, createdAt: instant, ...initialSM2(instant),
};
const fresh = () => initialDeviceState('http://localhost:4000');

test('stored progress and review schedule survive a new device store instance', async () => {
  let raw: string | null = null;
  const adapter = { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; } };
  const state: DeviceState = { ...fresh(), sessions: { [session.id]: session }, cards: [reviewSM2(card, 5, instant)] };
  await createDeviceStore(adapter).write(state);
  const result = await createDeviceStore(adapter).read(fresh());
  assert.equal(result.recovered, false);
  assert.deepEqual(result.state.sessions[session.id], session);
  assert.equal(result.state.cards[0]?.dueAt, '2026-11-15T08:00:00.000Z');
  assert.deepEqual(result.state.cards[0]?.config, session.config);
  assert.equal(result.state.cards[0]?.version, '1.0.0');
});

test('decode preserves valid entries and rejects card configuration mismatch and prototype identifiers', () => {
  const maliciousSessions = JSON.parse(JSON.stringify({ [session.id]: session }));
  Object.defineProperty(maliciousSessions, '__proto__', { value: { ...session, id: '__proto__' }, enumerable: true });
  maliciousSessions.constructor = { ...session, id: 'constructor' };
  maliciousSessions.damaged = { id: 'damaged', title: 42 };
  const mismatched = { ...card, config: { ...card.config, slug: 'gas-properties' } };
  const decoded = decodeDeviceState(JSON.stringify({ ...fresh(), sessions: maliciousSessions, cards: [mismatched, { ...card, id: 'card-valid' }] }), fresh());
  assert.equal(decoded.recovered, true);
  assert.equal(Object.getPrototypeOf(decoded.state.sessions), null);
  assert.equal(Object.hasOwn(decoded.state.sessions, '__proto__'), false);
  assert.equal('constructor' in decoded.state.sessions, false);
  assert.deepEqual(Object.keys(decoded.state.sessions), [session.id]);
  assert.equal(decoded.state.cards.length, 1);
  assert.equal(decoded.state.cards[0]?.id, 'card-valid');
});

test('review validation pins saved version and rejects inconsistent replay configuration', () => {
  const { version: _version, ...withoutVersion } = card.config;
  assert.equal(validateCard({ ...card, config: withoutVersion }).config.version, card.version);
  for (const config of [
    { ...card.config, version: '2.0.0' },
    { ...card.config, screenId: 'other' },
    { ...card.config, slug: 'gas-properties' },
  ]) assert.throws(() => validateCard({ ...card, config }));
});

test('read does not overwrite malformed storage and text-only sessions are retained', async () => {
  let writes = 0;
  const store = createDeviceStore({ getItem: async () => '{broken', setItem: async () => { writes++; } });
  const result = await store.read(fresh());
  assert.equal(result.recovered, true);
  assert.equal(writes, 0);
  const textOnly: LearningSession = { ...session, id: 'session-text', slug: '', config: undefined, version: undefined, screenId: undefined };
  const decoded = decodeDeviceState(JSON.stringify({ ...fresh(), sessions: { [textOnly.id]: textOnly } }), fresh());
  assert.equal(decoded.state.sessions[textOnly.id]?.slug, '');
});

test('write queue preserves request order and continues after a failed write', async () => {
  let releaseFirst!: () => void;
  let firstStarted!: () => void;
  const started = new Promise<void>(resolve => { firstStarted = resolve; });
  const blocked = new Promise<void>(resolve => { releaseFirst = resolve; });
  const calls: string[] = [];
  let count = 0;
  const store = createDeviceStore({
    getItem: async () => null,
    setItem: async (_key, value) => {
      calls.push((JSON.parse(value) as DeviceState).settings.serverUrl);
      if (++count === 1) { firstStarted(); await blocked; throw new Error('Storage temporarily unavailable'); }
    },
  });
  const first = store.write(fresh());
  const firstFailure = assert.rejects(first, /temporarily unavailable/);
  await started;
  const next = fresh(); next.settings.serverUrl = 'https://study.example.com';
  const second = store.write(next);
  next.settings.serverUrl = 'https://mutated.example.com';
  assert.deepEqual(calls, ['http://localhost:4000']);
  releaseFirst();
  await Promise.all([firstFailure, second]);
  assert.deepEqual(calls, ['http://localhost:4000', 'https://study.example.com']);
});

test('server URL validation and development defaults preserve the intended server', () => {
  assert.equal(normalizeServerUrl('  https://study.example.com/physim/  '), 'https://study.example.com/physim');
  assert.equal(normalizeServerUrl('http://192.168.1.9:4000/'), 'http://192.168.1.9:4000');
  for (const invalid of ['localhost:4000', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com?key=secret', 'https://example.com#section']) {
    assert.throws(() => normalizeServerUrl(invalid));
  }
  assert.equal(defaultServerUrl('192.168.1.9:8081'), 'http://192.168.1.9:4000');
  assert.equal(defaultServerUrl(undefined, { protocol: 'http:', hostname: 'localhost', port: '8081', origin: 'http://localhost:8081' }), 'http://localhost:4000');
  assert.equal(defaultServerUrl(undefined, { protocol: 'https:', hostname: 'study.example.com', port: '', origin: 'https://study.example.com' }), 'https://study.example.com');
});
