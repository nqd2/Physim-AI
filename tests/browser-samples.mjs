import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { SAMPLE_LESSONS } from '../packages/shared/src/lessons.ts';
import { launchBrowser, webUrl, apiUrl, artifact, blockLearningRequests } from './browser-support.mjs';

const selectedLesson = process.env.PHYSIM_LESSON;
const lessons = SAMPLE_LESSONS.filter(lesson => !selectedLesson || lesson.id === selectedLesson);
assert.ok(lessons.length, `Unknown PHYSIM_LESSON: ${selectedLesson}`);
const report = {
  startedAt: new Date().toISOString(), webUrl, apiUrl,
  selectedLesson: selectedLesson || null, results: [], pageErrors: [],
};
const reportName = selectedLesson
  ? `physim-six-samples-${selectedLesson}-report.json`
  : 'physim-six-samples-report.json';
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
});
await blockLearningRequests(context, report);
const page = await context.newPage();
page.setDefaultTimeout(70_000);
page.on('pageerror', error => report.pageErrors.push({
  lesson: report.results.at(-1)?.id, message: error.message,
}));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('physim.mobile.v1') || 'null'));
async function saveReport() {
  report.completedAt = new Date().toISOString();
  await writeFile(artifact(reportName), JSON.stringify(report, null, 2) + '\n');
}
function validate(measured, config) {
  assert.equal(measured.slug, config.slug);
  assert.equal(measured.screenId, config.screenId);
  for (const [key, value] of Object.entries(config.values)) {
    if (typeof value === 'number') {
      assert.ok(Math.abs(measured.values[key] - value) < 0.01,
        `${key}: expected ${value}, observed ${measured.values[key]}`);
    } else assert.equal(measured.values[key], value, key);
  }
  assert.ok(Object.values(measured.values).some(value => typeof value === 'number' && Number.isFinite(value)),
    'must contain real numeric readings');
}

try {
  // Configure through the same UI as a learner, including separate Expo Web/API origins.
  await page.goto(webUrl, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Cài đặt', exact: true }).click();
  await page.getByLabel('Địa chỉ server', { exact: true }).fill(apiUrl);
  await page.getByRole('button', { name: /Lưu và kiểm tra kết nối/ }).click();
  await page.getByText(/Đã kết nối\./).waitFor();
  assert.equal((await state()).settings.serverUrl, apiUrl);

  for (const lesson of lessons) {
    const result = { id: lesson.id, slug: lesson.slug, startedAt: new Date().toISOString() };
    report.results.push(result);
    console.log('START', lesson.id);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(webUrl, { waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: 'Quét đề', exact: true }).click();
      await page.waitForURL(/\/scan$/);
      await page.getByRole('button', { name: `Mở bài ${lesson.title}`, exact: true }).click();
      await page.waitForURL(/\/lab\//);
      const sessionId = page.url().split('/lab/')[1];
      result.sessionId = sessionId;
      await page.getByText('Đã mở đúng cấu hình của phiên học.', { exact: true }).waitFor();

      await page.getByRole('radio').nth(lesson.prediction.options.findIndex(
        option => option.id === lesson.prediction.correctOptionId)).click();
      await page.getByRole('button', { name: /Chạy và đối chiếu/ }).click();
      await page.waitForFunction(id => JSON.parse(localStorage.getItem('physim.mobile.v1'))
        ?.sessions[id]?.predictionChecked === true, sessionId, { timeout: 40_000 });
      result.base = (await state()).sessions[sessionId].measurements.at(-1);
      validate(result.base, lesson.config);

      await page.getByRole('button', { name: /Thử một biến thể/ }).click();
      await page.getByRole('radio').nth(lesson.variant.prediction.options.findIndex(
        option => option.id === lesson.variant.prediction.correctOptionId)).click();
      await page.getByRole('button', { name: /Kiểm chứng biến thể/ }).click();
      await page.waitForFunction(id => JSON.parse(localStorage.getItem('physim.mobile.v1'))
        ?.sessions[id]?.variantChecked === true, sessionId, { timeout: 40_000 });
      result.variant = (await state()).sessions[sessionId].measurements.at(-1);
      validate(result.variant, lesson.variant.config);

      await page.setViewportSize({ width: 320, height: 640 });
      result.layout320 = await page.evaluate(() => ({
        width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(result.layout320.scroll <= result.layout320.width + 1, 'No horizontal overflow at 320px');
      await page.setViewportSize({ width: 390, height: 844 });
      result.frameUrl = await page.locator('iframe').getAttribute('src');
      result.ariaChecked = await page.getByRole('radio', { checked: true }).count();
      assert.equal(result.ariaChecked, 1, 'selected prediction announced');
      result.pass = true;
      console.log('PASS', lesson.id, JSON.stringify({ base: result.base.values, variant: result.variant.values }));
    } catch (error) {
      result.pass = false;
      result.error = error.message;
      result.body = await page.locator('body').innerText().then(value => value.slice(-8000)).catch(() => '');
      result.frames = [];
      for (const frame of page.frames()) {
        try {
          result.frames.push({ url: frame.url(), details: await frame.evaluate(() => ({
            ready: document.readyState, bridge: !!window.physimBridge,
            phet: !!window.phet, sim: !!window.phet?.joist?.sim,
          })) });
        } catch { /* A failed or replaced frame may no longer have an execution context. */ }
      }
      await page.screenshot({ path: artifact(`physim-six-samples-${lesson.id}-failure.png`) }).catch(() => {});
      console.error('FAIL', lesson.id, error.message);
    }
    result.completedAt = new Date().toISOString();
    await saveReport();
  }
  assert.equal(report.results.length, lessons.length);
  assert.deepEqual(report.unexpectedLearningRequests, [], 'sample lessons must never call AI');
  assert.deepEqual(report.pageErrors, [], 'no uncaught browser exceptions');
  assert.ok(report.results.every(result => result.pass), 'all selected sample experiments must pass');
} catch (error) {
  report.error = error.message;
  console.error(error);
  process.exitCode = 1;
} finally {
  await saveReport();
  await context.close();
  await browser.close();
}
