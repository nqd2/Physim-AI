import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { injectBridge, makeCatalog, getLocalizedHtml } from './phet-pipeline.mjs';

const metadata = {
  categories: {
    4: { name: 'physics', simulationIds: [1, 2] },
    5: { name: 'motion', simulationIds: [1] },
    8: { name: 'heat-and-thermodynamics', simulationIds: [2] }
  },
  projects: [
    { type: 2, version: { string: '1.0.0' }, simulations: [
      { id: 1, name: 'pendulum-lab', localizedSimulations: { en: { title: 'Pendulum Lab', downloadUrl: '/sims/html/pendulum-lab/latest/pendulum-lab_en.html' } } },
      { id: 2, name: 'gases-intro', localizedSimulations: { en: { title: 'Gases Intro', downloadUrl: '/sims/html/gases-intro/latest/gases-intro_en.html' } } }
    ] },
    { type: 1, version: { string: '2.0.0' }, simulations: [{ id: 1, name: 'pendulum-lab' }] }
  ]
};

test('creates unique, version-pinned catalog entries from HTML5 metadata', () => {
  const vi = structuredClone(metadata);
  vi.projects[0].simulations[0].localizedSimulations.vi = {
    title: 'Con lắc', downloadUrl: '/sims/html/pendulum-lab/latest/pendulum-lab_vi.html'
  };
  const entries = makeCatalog(metadata, vi, { extras: [], expected: 2 });
  assert.equal(entries.find(entry => entry.slug === 'pendulum-lab').chapter, 'waves');
  const gases = entries.find(entry => entry.slug === 'gases-intro');
  assert.equal(gases.chapter, 'thermodynamics');
  assert.match(gases.downloads.en, /\/1\.0\.0\/gases-intro_en\.html$/);
  assert.match(entries.find(entry => entry.slug === 'pendulum-lab').downloads.vi, /\/1\.0\.0\/pendulum-lab_vi\.html$/);
  assert.throws(() => makeCatalog(metadata, vi, { extras: [], expected: 3 }), /2.*3/);
});

test('selects English when the Vietnamese URL returns an English document', async () => {
  const doc = locale => `<!doctype html><html lang="${locale}"><script>window.phet={};window.phet.chipper.project='example';window.phet.chipper.version='1.0.0';window.phet.chipper.brand='phet';</script><body></body></html>`;
  const fetcher = async () => new Response(doc('en'), { headers: { 'content-type': 'text/html' } });
  const result = await getLocalizedHtml({ slug: 'example', version: '1.0.0', downloads: { vi: 'https://phet.colorado.edu/vi', en: 'https://phet.colorado.edu/en' } }, fetcher);
  assert.equal(result.locale, 'en');
});

test('bridge injection preserves the original PhET script and is idempotent for the same input', () => {
  const base = '<!doctype html><html><body><!-- license İ --><script>window.phet = {};</script></BoDy></html>';
  const schema = { slug: 'example', version: '1.0.0', screens: [], bridgeMode: 'manual' };
  const first = injectBridge(base, schema, 'window.physimBridge = {};');
  assert.equal(injectBridge(first, schema, 'window.physimBridge = {};'), first);
  assert.match(first, /<!-- license İ --><script>window\.phet = \{\};<\/script>/);
  assert.match(first, /id="physim-bridge"/);
  assert.match(first, /<\/script>\s*<\/BoDy><\/html>$/);
});

test('bridge validates a complete configuration before changing a property', async () => {
  const notifications = [];
  function property(initialValue) {
    let value = initialValue;
    const listeners = new Set();
    return {
      get value() { return value; },
      set value(next) { value = next; for (const listener of listeners) listener(value); },
      lazyLink(listener) { listeners.add(listener); },
      unlink(listener) { listeners.delete(listener); }
    };
  }
  const voltageProperty = property(4);
  const resistanceProperty = property(10);
  const screen = { model: { voltageProperty, resistanceProperty, reset() { voltageProperty.value = 4; resistanceProperty.value = 10; } } };
  const window = {
    parent: null, phet: { joist: { sim: { simScreens: [screen], selectedScreenProperty: property(screen), isConstructionCompleteProperty: property(true) } } },
    ReactNativeWebView: { postMessage: message => notifications.push(JSON.parse(message)) },
    addEventListener() {}
  };
  window.parent = window;
  const schema = {
    bridgeMode: 'guided', slug: 'ohms-law', screens: [{ id: 'main', properties: [
      { id: 'voltage', kind: 'number', writable: true, range: [0, 9] },
      { id: 'resistance', kind: 'number', writable: true, range: [1, 20] }
    ], actions: [{ id: 'measure' }] }]
  };
  const context = vm.createContext({
    window, URLSearchParams, location: { search: '?physimChannel=test' }, setTimeout, clearTimeout,
    document: { getElementById: () => ({ textContent: JSON.stringify(schema) }) }
  });
  vm.runInContext(await readFile(new URL('./physim-bridge.js', import.meta.url), 'utf8'), context);
  assert.equal(notifications[0].type, 'READY');
  const command = (type, payload) => window.physimBridge.receive(JSON.stringify({
    version: 1, channel: 'test', requestId: type, type, payload
  }));
  await command('APPLY_CONFIG', { screenId: 'main', values: { voltage: 7, resistance: 90 } });
  assert.equal(notifications.find(message => message.requestId === 'APPLY_CONFIG').type, 'ERROR');
  assert.equal(voltageProperty.value, 4);
  await command('APPLY_CONFIG', { screenId: 'main', values: { voltage: 7, resistance: 12 } });
  assert.equal(notifications.findLast(message => message.requestId === 'APPLY_CONFIG').payload.values.voltage, 7);
  await command('RESET_SIM', {});
  assert.equal(voltageProperty.value, 4);
});
