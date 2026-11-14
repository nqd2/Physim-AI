import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

// Opens the actual pinned, bridge-injected HTML. This is intentionally a browser
// smoke test; the six adapter suites separately verify writes and experiments.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=') || true];
}));
const storage = path.resolve(root, options.storage || 'apps/server/storage/phet-sims');
const reportPath = path.resolve(root, options.report || '.qa/physim-phet-browser-report.json');
const concurrency = Number(options.concurrency || 2);
const timeoutMs = Number(options.timeout || 60_000);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new Error('--concurrency must be 1–3.');
if (!Number.isFinite(timeoutMs) || timeoutMs < 5_000 || timeoutMs > 120_000) throw new Error('--timeout must be 5000–120000 ms.');
const active = JSON.parse(await fs.readFile(path.join(storage, 'active.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(safeFile(storage, active.manifestPath), 'utf8'));
if (manifest.simulations.length !== 74 || new Set(manifest.simulations.map(sim => sim.slug)).size !== 74) {
  throw new Error('The active generation must contain exactly 74 unique simulations.');
}
const filter = options.slugs ? new Set(String(options.slugs).split(',')) : null;
const selected = manifest.simulations.filter(sim => !filter || filter.has(sim.slug));
if (!selected.length || (filter && selected.length !== filter.size)) throw new Error('Unknown or empty --slugs filter.');
const entryMap = new Map(manifest.simulations.map(sim => [sim.slug, sim]));
let playwright;
try { playwright = await import('playwright-core'); }
catch {
  // This workspace already carried the original prototype QA dependency here.
  const require = createRequire(path.join(root, '.qa/package.json'));
  playwright = await import(pathToFileURL(require.resolve('playwright-core')).href);
}
playwright = playwright.chromium ? playwright : playwright.default;
const executablePath = await findChrome();
let ownedServer;
let baseUrl = options['base-url'] ? new URL(String(options['base-url'])).origin : null;
let harnessOrigin;
const startedAt = new Date().toISOString();
const results = [];
let reportQueue = Promise.resolve();
const infrastructure = { browser: executablePath, webgl: null, standaloneHarness: !baseUrl };

try {
  // The harness is separate from the production server when --base-url is used,
  // so parent-origin and event.source checks are exercised across origins too.
  ownedServer = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/__qa__/')) {
        const slug = decodeURIComponent(url.pathname.slice('/__qa__/'.length));
        const sim = entryMap.get(slug);
        if (!sim) { response.writeHead(404).end(); return; }
        const token = randomUUID().replaceAll('-', '');
        const source = new URL(`/simulations/${sim.slug}/${sim.version}/${sim.locale}.html`, baseUrl || harnessOrigin);
        source.searchParams.set('physimLoadId', token);
        source.searchParams.set('physimParentOrigin', harnessOrigin);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(harnessHtml(source.href, token));
        return;
      }
      if (url.pathname.startsWith('/simulations/')) {
        const match = /^\/simulations\/([a-z0-9-]+)\/([^/]+)\/(vi|en)\.html$/.exec(url.pathname);
        const sim = match && entryMap.get(match[1]);
        if (!sim || sim.version !== match[2] || sim.locale !== match[3]) { response.writeHead(404).end(); return; }
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(await fs.readFile(safeFile(storage, sim.htmlPath)));
        return;
      }
      if (url.pathname === '/bridge/adapters.js' || url.pathname === '/bridge/physim-bridge.js') {
        const file = path.join(root, 'apps/server/src/phet-bridge', path.basename(url.pathname));
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(await fs.readFile(file));
        return;
      }
      if (url.pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      response.writeHead(404).end('Not found');
    } catch (error) { response.writeHead(500).end(error.message); }
  });
  await new Promise((resolve, reject) => { ownedServer.once('error', reject); ownedServer.listen(0, '127.0.0.1', resolve); });
  harnessOrigin = `http://127.0.0.1:${ownedServer.address().port}`;
  const browser = await playwright.chromium.launch({
    executablePath, headless: true,
    args: ['--no-first-run', '--disable-gpu', '--in-process-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader']
  });
  try {
    const probe = await browser.newPage();
    infrastructure.webgl = await probe.evaluate(() => {
      const context = document.createElement('canvas').getContext('webgl');
      return { available: !!context, version: context?.getParameter(context.VERSION) || null };
    });
    await probe.close();
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
      while (next < selected.length) {
        const entry = selected[next++];
        const started = Date.now();
        const errors = [], failedRequests = [], localHttpErrors = [];
        const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
        page.on('response', response => {
          const url = new URL(response.url());
          if ([harnessOrigin, baseUrl].includes(url.origin) && response.status() >= 400) localHttpErrors.push({ url: response.url(), status: response.status() });
        });
        const result = { slug: entry.slug, version: entry.version, locale: entry.locale, sourceSha256: entry.sha256, passed: false };
        try {
          await page.goto(`${harnessOrigin}/__qa__/${entry.slug}`, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
          if (errors.length) throw new Error(`Uncaught browser error: ${errors[0]}`);
          await page.waitForFunction(() => window.__qa?.stateReply || window.__qa?.error, undefined, { timeout: timeoutMs });
          const protocol = await page.evaluate(() => window.__qa);
          if (protocol.error) throw new Error(`Bridge failed: ${protocol.error.code || ''} ${protocol.error.message || ''}`);
          const frame = page.frames().find(candidate => candidate !== page.mainFrame());
          if (!frame) throw new Error('Simulation iframe missing.');
          await frame.waitForFunction(() => {
            const sim = window.phet?.joist?.sim;
            const rect = sim?.display?.domElement?.getBoundingClientRect();
            return sim?.screens?.length && sim.screens.some(screen => !!(screen.model || screen._model)) && rect?.width > 0 && rect?.height > 0;
          }, undefined, { timeout: timeoutMs });
          result.runtime = await frame.evaluate(() => {
            const sim = window.phet.joist.sim, chipper = window.phet.chipper;
            const display = sim.display?.domElement;
            const rect = display?.getBoundingClientRect();
            return {
              slug: chipper.project, version: chipper.version, locale: chipper.locale,
              screenCount: sim.screens.length,
              display: { width: rect?.width || 0, height: rect?.height || 0 },
              modelReady: sim.screens.some(screen => !!(screen.model || screen._model)),
              bridgeProtocol: window.physimBridge?.protocol, bridgeVersion: window.physimBridge?.version
            };
          });
          if (result.runtime.slug !== entry.slug || result.runtime.version !== entry.version || result.runtime.locale !== entry.locale) {
            throw new Error('Runtime slug/version/locale does not match the pinned manifest.');
          }
          if (!result.runtime.display.width || !result.runtime.display.height) throw new Error('PhET display has no visible size.');
          if (result.runtime.bridgeProtocol !== 'physim-bridge' || result.runtime.bridgeVersion !== 1) throw new Error('Bridge protocol is missing or wrong.');
          if (protocol.stateReply.slug !== entry.slug || protocol.stateReply.version !== entry.version) throw new Error('GET_STATE reply does not match the simulation.');
          if (errors.length) throw new Error(`Uncaught browser error: ${errors[0]}`);
          if (localHttpErrors.length) throw new Error(`Local resource returned HTTP ${localHttpErrors[0].status}.`);
          result.capabilities = protocol.ready.capabilities;
          result.screenId = protocol.stateReply.screenId;
          result.passed = true;
        } catch (error) {
          result.error = error.message;
          const screenshot = path.join(root, '.qa/physim-phet-failures', `${entry.slug}.png`);
          await fs.mkdir(path.dirname(screenshot), { recursive: true });
          await page.screenshot({ path: screenshot }).catch(() => {});
          result.screenshot = path.relative(root, screenshot).replaceAll('\\', '/');
        } finally {
          result.elapsedMs = Date.now() - started;
          result.errors = errors;
          result.failedRequests = failedRequests;
          result.localHttpErrors = localHttpErrors;
          results.push(result);
          await context.close();
          console.log(`${result.passed ? 'PASS' : 'FAIL'} ${entry.slug}@${entry.version} [${entry.locale}] ${result.elapsedMs} ms${result.error ? ` — ${result.error}` : ''}`);
          await saveReport();
        }
      }
    }));
  } finally { await browser.close(); }
  await saveReport(true);
  if (results.some(result => !result.passed)) process.exitCode = 1;
} finally {
  if (ownedServer) await new Promise(resolve => ownedServer.close(resolve));
}

async function saveReport(completed = false) {
  const snapshot = {
    startedAt, completedAt: completed ? new Date().toISOString() : null,
    generation: active.generation, scope: filter ? 'selected simulations' : 'all 74 pinned simulations',
    expected: selected.length, completed: results.length, passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length, infrastructure,
    results: [...results].sort((a, b) => a.slug.localeCompare(b.slug))
  };
  reportQueue = reportQueue.then(async () => {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(snapshot, null, 2) + '\n');
  });
  await reportQueue;
}
function safeFile(directory, relative) {
  const absolute = path.resolve(directory, relative);
  if (!absolute.startsWith(path.resolve(directory) + path.sep)) throw new Error('Manifest file is outside storage.');
  return absolute;
}
async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  for (const candidate of candidates) { try { await fs.access(candidate); return candidate; } catch {} }
  throw new Error('No local Chromium found. Set CHROME_PATH to the installed browser executable.');
}
function harnessHtml(source, loadId) {
  const config = JSON.stringify({ source, loadId, origin: new URL(source).origin }).replaceAll('<', '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style></head><body><iframe title="PhET simulation"></iframe><script>
const config=${config}, frame=document.querySelector('iframe');
window.__qa={ready:null,stateReply:null,error:null};
function send(type,id){frame.contentWindow.postMessage(JSON.stringify({protocol:'physim-bridge',version:1,loadId:config.loadId,requestId:id,type,payload:{}}),config.origin);}
window.addEventListener('message',event=>{
  const message=event.data;
  if(event.source!==frame.contentWindow||event.origin!==config.origin||message?.protocol!=='physim-bridge'||message.version!==1||message.loadId!==config.loadId)return;
  if(message.type==='READY'){window.__qa.ready=message.payload;clearInterval(timer);send('GET_STATE','qa-state');}
  if(message.type==='RESULT'&&message.requestId==='qa-state')window.__qa.stateReply=message.payload;
  if(message.type==='ERROR')window.__qa.error=message.payload;
});
const timer=setInterval(()=>send('INIT','qa-init'),300);
frame.src=config.source;
</script></body></html>`;
}
