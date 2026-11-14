// Reproduce the existing UI.html / web artwork without introducing new illustrations.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
await mkdir(path.join(directory, 'icons'), { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  headless: true,
  args: ['--no-first-run', '--disable-gpu', '--in-process-gpu'],
});
try {
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.setContent('<html><head><style>html,body{margin:0;width:390px;height:844px;background-color:#FFD2EC;background-image:radial-gradient(#ffffffbb 1.6px,transparent 1.6px),linear-gradient(165deg,#FFC9E8,#EBCDF8 55%,#CFC8F4);background-size:16px 16px,100% 100%;}</style></head><body></body></html>');
  await page.screenshot({ path: path.join(directory, 'study-background.png') });
  await context.close();

  const iconContext = await browser.newContext({ deviceScaleFactor: 4, viewport: { width: 84, height: 84 } });
  const iconPage = await iconContext.newPage();
  const paths = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    lab: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21h15"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  };
  for (const [name, body] of Object.entries(paths)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B2849" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    await writeFile(path.join(directory, 'icons', `${name}.svg`), svg + '\n');
    await iconPage.setContent(`<html><head><style>html,body{margin:0;background:transparent}</style></head><body>${svg}</body></html>`);
    await iconPage.locator('svg').screenshot({ path: path.join(directory, 'icons', `${name}.png`), omitBackground: true });
  }
  const portrait = '<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" viewBox="0 0 84 84"><rect width="84" height="84" rx="10" fill="#DCCBF5"/><circle cx="42" cy="34" r="14" fill="#fff" stroke="#3B2849" stroke-width="3.5"/><path d="M14 84c0-18 12-28 28-28s28 10 28 28z" fill="#fff" stroke="#3B2849" stroke-width="3.5"/></svg>';
  await writeFile(path.join(directory, 'study-avatar.svg'), portrait + '\n');
  await iconPage.setContent(`<html><head><style>html,body{margin:0;background:transparent}</style></head><body>${portrait}</body></html>`);
  await iconPage.locator('svg').screenshot({ path: path.join(directory, 'study-avatar.png'), omitBackground: true });
  await iconContext.close();
} finally {
  await browser.close();
}
