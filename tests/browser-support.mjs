import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(repositoryRoot, process.env.PHYSIM_BROWSER_OUTPUT || '.test-artifacts/browser');
await mkdir(outputDirectory, { recursive: true });

function serverUrl(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Browser test URLs must be HTTP(S) without credentials, query strings or fragments.');
  }
  return parsed.toString().replace(/\/$/, '');
}

export const webUrl = serverUrl(process.env.PHYSIM_WEB_URL || 'http://localhost:4000');
export const apiUrl = serverUrl(process.env.PHYSIM_API_URL || webUrl);
export const artifact = filename => path.join(outputDirectory, filename);

export function launchBrowser() {
  return chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: path.resolve(process.env.CHROME_PATH) } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-first-run', '--disable-gpu', '--in-process-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
}

// A browser acceptance run must never unexpectedly invoke a configured provider.
// Photo tests install their explicit reply mocks after this default deny handler.
export async function blockLearningRequests(context, report) {
  report.unexpectedLearningRequests = [];
  await context.route('**/api/v1/learning/**', async route => {
    report.unexpectedLearningRequests.push(new URL(route.request().url()).pathname);
    await route.abort('blockedbyclient');
  });
}

export function requestLocation(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`;
}
