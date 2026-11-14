import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { guided } from './phet-guided.mjs';

const storage = fileURLToPath(new URL('../apps/server/storage/', import.meta.url));
const catalog = JSON.parse(await readFile(join(storage, 'sim-schemas.json'), 'utf8'));
const entries = new Map(catalog.simulations.map(entry => [entry.assetPath, entry]));
const onlyGuided = process.argv.includes('--guided');
const selected = catalog.simulations.filter(entry => !onlyGuided || entry.bridgeMode === 'guided');
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/host') {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html><html lang="vi"><body>
      <iframe title="PhET" style="width:940px;height:660px" id="sim"></iframe>
      <script>
        const frame = document.querySelector('#sim');
        window.messages = [];
        window.addEventListener('message', event => {
          if (event.origin === location.origin && event.source === frame.contentWindow) {
            window.messages.push(JSON.parse(event.data));
          }
        });
        const url = new URL('/' + new URLSearchParams(location.search).get('asset'), location.origin);
        url.searchParams.set('physimParent', location.origin);
        url.searchParams.set('physimChannel', 'smoke-test');
        url.searchParams.set('homeScreen', 'false');
        if (url.pathname.startsWith('/ohms-law-')) url.searchParams.set('a11y', '');
        frame.src = url.href;
      </script>
      </body></html>`);
    return;
  }
  const name = url.pathname.slice(1);
  if (!entries.has(name)) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  createReadStream(join(storage, 'phet-sims', name)).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.PHYSIM_CHROME,
  channel: process.env.PHYSIM_BROWSER_CHANNEL,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
}).catch(error => {
  server.close();
  throw error;
});

async function command(page, type, payload = {}) {
  const id = await page.evaluate(({ type, payload }) => {
    const requestId = crypto.randomUUID();
    document.querySelector('#sim').contentWindow.postMessage(JSON.stringify({
      type, payload, requestId, version: 1, channel: 'smoke-test',
    }), location.origin);
    return requestId;
  }, { type, payload });
  const response = await page.waitForFunction(id => window.messages.find(message => message.requestId === id), id, { timeout: 8000 });
  return response.jsonValue();
}

async function exercise(page, entry) {
  const { smoke, screen } = guided[entry.slug];
  const result = await command(page, 'GET_STATE');
  assert.equal(result.type, 'ACK', JSON.stringify(result));
  const before = result.payload.values;
  const [firstProperty] = Object.keys(smoke.values);
  const rejected = await command(page, 'APPLY_CONFIG', {
    screenId: 'main', values: { ...smoke.values, unknownProperty: true },
  });
  assert.equal(rejected.payload.code, 'INVALID_VALUE');
  const unchanged = await command(page, 'GET_STATE');
  assert.equal(unchanged.payload.values[firstProperty], before[firstProperty]);
  const configured = await command(page, 'APPLY_CONFIG', { screenId: 'main', values: smoke.values });
  assert.equal(configured.type, 'ACK', JSON.stringify(configured));
  for (const [id, value] of Object.entries(smoke.values)) {
    const actual = configured.payload.values[id];
    if (typeof value === 'number') assert.ok(Math.abs(actual - value) < 0.001, `${id}: expected ${value}, got ${actual}`);
    else assert.equal(actual, value);
  }
  const action = await command(page, 'RUN_EXPERIMENT', { actionId: screen.actions[0].id });
  assert.equal(action.type, 'ACK', JSON.stringify(action));
  assert.ok(smoke.passes(action.payload.values[smoke.reading]), JSON.stringify(action));
  await page.waitForFunction(({ property, expected }) => window.messages.some(message =>
    message.type === 'PROPERTY_CHANGED' && Math.abs(message.payload.values[property] - expected) < 0.001),
  { property: firstProperty, expected: smoke.values[firstProperty] }, { timeout: 8000 });
  const reset = await command(page, 'RESET_SIM');
  assert.equal(reset.type, 'ACK', JSON.stringify(reset));
  for (const key of Object.keys(smoke.values)) assert.equal(reset.payload.values[key], before[key]);
  if (entry.slug === 'ohms-law') {
    await page.evaluate(() => { window.messages.length = 0; });
    const voltageSlider = page.frameLocator('#sim').getByRole('slider').first();
    await voltageSlider.press('ArrowUp');
    await page.waitForFunction(initial => window.messages.some(message =>
      message.type === 'PROPERTY_CHANGED' && message.payload.values.voltage > initial),
    before.voltage, { timeout: 8000 });
  }
}

async function run(entry) {
  const file = await readFile(join(storage, 'phet-sims', entry.assetPath));
  assert.equal(createHash('sha256').update(file).digest('hex'), entry.sha256);
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
  try {
    await page.goto(`${origin}/host?asset=${encodeURIComponent(entry.assetPath)}`, { waitUntil: 'domcontentloaded' });
    const startup = await page.waitForFunction(() =>
      (window.messages ?? []).find(message => message.type === 'READY' || message.type === 'ERROR'),
    undefined, { timeout: 35_000 });
    const ready = await startup.jsonValue();
    assert.equal(ready.type, 'READY', JSON.stringify(ready));
    assert.ok(ready.payload.screenIds.length, 'PhET reported no screens');
    if (entry.bridgeMode === 'guided') await exercise(page, entry);
    else {
      const state = await command(page, 'GET_STATE');
      assert.equal(state.type, 'ACK');
      const rejected = await command(page, 'RUN_EXPERIMENT', { actionId: 'measure' });
      assert.equal(rejected.payload.code, 'UNSUPPORTED');
    }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

let cursor = 0;
let failures = 0;
try {
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < selected.length) {
      const entry = selected[cursor++];
      try {
        await run(entry);
        console.log(`PASS ${entry.slug}${entry.bridgeMode === 'guided' ? ' (guided)' : ''}`);
      } catch (error) {
        console.error(`FAIL ${entry.slug}: ${error.message}`);
        failures++;
      }
    }
  }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`${selected.length - failures}/${selected.length} mô phỏng đạt kiểm tra trình duyệt.`);
if (failures) process.exitCode = 1;
