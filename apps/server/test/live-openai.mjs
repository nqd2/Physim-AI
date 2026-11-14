/** Manual, billable integration check. Run only with an explicitly configured server/key. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { AnalyzePhotoResponseSchema, CheckWorkResponseSchema, EvaluateTeachBackResponseSchema, GenerateVariantResponseSchema, validateSimulationConfig } from '@physim/shared';

const base = (process.env.PHYSIM_TEST_SERVER || 'http://127.0.0.1:4000').replace(/\/$/, '');
const all = process.argv.includes('--all');
const health = await fetch(`${base}/api/v1/health`).then(response => response.json());
assert.equal(health.ai?.configured, true, 'Server must have OPENAI_API_KEY configured before this manual check.');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-gpu', '--in-process-gpu'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 650 }, deviceScaleFactor: 1 });
const problem = 'Một điện trở R = 100 Ω được đặt vào hiệu điện thế U = 6 V. Giữ R không đổi, tăng U lên 9 V. Dự đoán cường độ dòng điện thay đổi thế nào và giải thích bằng định luật Ohm.';
async function photo(text) {
  await page.setContent('<html lang="vi"><meta charset="utf-8"><body style="font:26px/1.7 Arial,sans-serif;padding:50px;color:#101820;background:white"><h1 style="font-size:34px">Vật lý THPT · Bài tự soạn</h1><p id="problem"></p></body></html>');
  await page.locator('#problem').evaluate((element, value) => { element.textContent = value; }, text);
  return { mimeType: 'image/png', base64: (await page.screenshot({ type: 'png' })).toString('base64') };
}
async function call(endpoint, input, schema) {
  const start = Date.now();
  const response = await fetch(`${base}/api/v1/learning/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(90_000) });
  const body = await response.json();
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}, ${body.error?.code || 'UNKNOWN'}`);
  const parsed = schema.parse(body);
  if (parsed.simulationConfig) {
    const simSchema = await fetch(`${base}/api/v1/simulations/${parsed.simulationConfig.slug}/schema`).then(result => result.json());
    assert.equal(validateSimulationConfig(simSchema, parsed.simulationConfig).success, true, 'AI config must satisfy the active simulation schema.');
  }
  console.log(JSON.stringify({ endpoint, status: parsed.status, elapsedMs: Date.now() - start, dtoValid: true, configurationChecked: Boolean(parsed.simulationConfig) }));
  return parsed;
}
try {
  const sessionId = `live-check-${Date.now()}`;
  const analysis = await call('analyze-photo', { sessionId, image: await photo(problem) }, AnalyzePhotoResponseSchema);
  assert.notEqual(analysis.status, 'unreadable', 'The self-authored high-contrast image should be readable.');
  if (all) {
    const context = { problem, step: 2, ...(analysis.simulationConfig ? { slug: analysis.simulationConfig.slug, simulationConfig: analysis.simulationConfig } : {}) };
    await call('check-work', { sessionId, context, image: await photo('Bài nháp tự soạn: I₁ = U × R = 6 × 100 = 600 A. Khi U tăng lên 9 V, em cho rằng dòng điện không đổi vì điện trở không đổi.') }, CheckWorkResponseSchema);
    await call('evaluate-teach-back', { sessionId, context: { ...context, step: 3 }, explanation: 'Khi R giữ nguyên, I tỉ lệ thuận với U vì I = U/R; tăng U làm dòng điện tăng.', orderedLinks: ['Giữ R không đổi', 'Tăng U', 'I tăng theo U/R'] }, EvaluateTeachBackResponseSchema);
    await call('generate-variant', { sessionId, context: { ...context, step: 4 } }, GenerateVariantResponseSchema);
  }
} finally { await browser.close(); }
