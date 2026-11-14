import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { guided } from './phet-guided.mjs';
import { readBuildMetadata, scanExactSource } from './phet-source.mjs';

const phet = 'https://phet.colorado.edu';
const scripts = fileURLToPath(new URL('.', import.meta.url));
const storage = fileURLToPath(new URL('../apps/server/storage/', import.meta.url));
const lockPath = join(scripts, 'phet-catalog.json');
const extras = ['greenhouse-effect', 'projectile-sampling-distributions'];
const pinnedCount = 74;
const transient = new Set([408, 425, 429, 500, 502, 503, 504]);

const chapterOverrides = {
  'build-a-nucleus': 'quantum',
  'build-an-atom': 'quantum',
  'curve-fitting': 'mechanics',
  density: 'mechanics',
  'energy-forms-and-changes': 'thermodynamics',
  'greenhouse-effect': 'thermodynamics',
  'hookes-law': 'waves',
  'masses-and-springs': 'waves',
  'masses-and-springs-basics': 'waves',
  'pendulum-lab': 'waves',
  'projectile-sampling-distributions': 'mechanics',
  'quantum-coin-toss': 'quantum',
  'quantum-wave-interference': 'quantum',
  'under-pressure': 'mechanics',
};

const categoryRules = [
  ['electricity-magnets-and-circuits', 'electromagnetism'],
  ['sound-and-waves', 'waves'],
  ['quantum-phenomena', 'quantum'],
  ['light-and-radiation', 'optics'],
  ['motion', 'mechanics'],
  ['heat-and-thermodynamics', 'thermodynamics'],
  ['work-energy-and-power', 'mechanics'],
];

const cleanText = value => value?.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const fallbackName = slug => slug.replaceAll('-', ' ');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

function mapSims(metadata) {
  return metadata.projects.filter(project => project.type === 2)
    .flatMap(project => project.simulations.map(sim => ({ ...sim, version: project.version.string })));
}

function downloadUrl(slug, version, locale, downloadPath) {
  const fallback = `/sims/html/${slug}/latest/${slug}_${locale}.html`;
  const url = new URL(downloadPath ?? fallback, phet);
  url.pathname = url.pathname.replace('/latest/', `/${version}/`);
  const expected = `/sims/html/${slug}/${version}/${slug}_${locale}.html`;
  if (url.origin !== phet || url.pathname !== expected || url.search || url.hash || url.username || url.password) {
    throw new Error(`URL PhET không hợp lệ cho ${slug}/${locale}`);
  }
  return url.href;
}

export function makeCatalog(english, vietnamese, { extras: additions = extras, expected = pinnedCount } = {}) {
  const categories = Object.values(english.categories);
  const physics = new Set(categories.find(category => category.name === 'physics')?.simulationIds);
  const localized = new Map(mapSims(vietnamese).map(sim => [sim.id, sim]));
  const included = mapSims(english).filter(sim => physics.has(sim.id) || additions.includes(sim.name));
  const seen = new Set();
  const entries = included.map(sim => {
    const slug = sim.name;
    if (seen.has(slug)) throw new Error(`PhET trùng slug ${slug}`);
    seen.add(slug);
    const chapter = chapterOverrides[slug] ?? categoryRules.find(([name]) =>
      categories.some(category => category.name === name && category.simulationIds.includes(sim.id)))?.[1];
    if (!chapter) throw new Error(`Thiếu chương cho mô phỏng ${slug}`);
    const vi = localized.get(sim.id)?.localizedSimulations.vi;
    const en = sim.localizedSimulations.en;
    return {
      slug,
      version: sim.version,
      chapter,
      titles: { vi: cleanText(vi?.title) ?? cleanText(en?.title) ?? fallbackName(slug), en: cleanText(en?.title) ?? fallbackName(slug) },
      downloads: { vi: downloadUrl(slug, sim.version, 'vi', vi?.downloadUrl), en: downloadUrl(slug, sim.version, 'en', en?.downloadUrl) },
    };
  });
  if (entries.length !== expected) throw new Error(`Danh mục có ${entries.length} mục, cần đúng ${expected}`);
  return entries.sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
}

async function request(url, fetcher, consume) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(25_000) });
      if (!transient.has(response.status)) return await consume(response);
      await response.body?.cancel();
      lastError = new Error(`HTTP ${response.status} ${url}`);
    } catch (error) {
      if (error instanceof RejectedDownload) throw error;
      lastError = error;
    }
    if (attempt < 2) await delay(350 * 2 ** attempt);
  }
  throw new Error(`Không tải được ${url}`, { cause: lastError });
}

class RejectedDownload extends Error {}

function matchesDeclaration(html, key, value) {
  // Inspect only metadata declaring the project, brand and build version.
  const assignment = new RegExp(`(?:window\\.)?phet\\.chipper\\.${key}\\s*=\\s*(['"])([^'"]+)\\1`);
  return html.match(assignment)?.[2] === value;
}

export async function getLocalizedHtml(entry, fetcher = fetch) {
  for (const locale of ['vi', 'en']) {
    const url = entry.downloads[locale];
    if (!url) continue;
    const html = await request(url, fetcher, async response => {
      if ([404, 410].includes(response.status)) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        await response.body?.cancel();
        throw new RejectedDownload(`PhET trả tệp không hợp lệ (${response.status}) cho ${entry.slug}/${locale}`);
      }
      return response.text();
    });
    if (html === null) continue;
    const language = html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1];
    const valid = matchesDeclaration(html, 'project', entry.slug) && matchesDeclaration(html, 'version', entry.version)
      && matchesDeclaration(html, 'brand', 'phet');
    if (!valid) throw new Error(`Thông tin build PhET không khớp cho ${entry.slug}/${locale}`);
    if (language !== locale) continue;
    return { html, locale, url };
  }
  throw new Error(`Không có HTML đúng ngôn ngữ cho ${entry.slug}`);
}

export function injectBridge(html, schema, bridge) {
  if (html.includes('<script id="physim-bridge"')) return html;
  const bodyEnd = /<\/body\s*>\s*<\/html\s*>\s*$/i.exec(html)?.index;
  if (bodyEnd === undefined) throw new Error(`HTML thiếu </body> cho ${schema.slug}`);
  const json = JSON.stringify(schema).replaceAll('<', '\\u003c');
  const script = `<!-- Physim-AI added a simulation bridge. Upstream PhET scripts and notices are preserved. -->
<script id="physim-catalog-entry" type="application/json">${json}</script>
<script id="physim-bridge">${bridge}</script>
`;
  return html.slice(0, bodyEnd) + script + html.slice(bodyEnd);
}

async function atomicWrite(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function hasFile(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function pinnedCatalog(refresh) {
  if (!refresh) {
    const lock = await readJson(lockPath);
    if (lock.catalogVersion !== 1 || lock.simulations.length !== pinnedCount ||
      new Set(lock.simulations.map(sim => sim.slug)).size !== pinnedCount) {
      throw new Error(`Manifest phải có đúng ${pinnedCount} mô phỏng khác nhau`);
    }
    for (const entry of lock.simulations) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || !/^\d+\.\d+\.\d+$/.test(entry.version)) {
        throw new Error('Manifest chứa slug hoặc phiên bản không hợp lệ');
      }
      for (const locale of ['vi', 'en']) {
        downloadUrl(entry.slug, entry.version, locale, entry.downloads[locale]);
      }
    }
    return lock.simulations;
  }
  const [en, vi] = await Promise.all(['en', 'vi'].map(locale =>
    request(`${phet}/services/metadata/1.3/simulations?format=json&locale=${locale}`, fetch, response => {
      if (!response.ok) throw new RejectedDownload(`Metadata PhET trả HTTP ${response.status}`);
      return response.json();
    })));
  const simulations = makeCatalog(en, vi);
  await atomicWrite(lockPath, JSON.stringify({ catalogVersion: 1, simulations }, null, 2) + '\n');
  return simulations;
}

async function syncEntry(entry, bridge, assetDir, cache) {
  const cacheFile = join(cache, `${entry.slug}-${entry.version}.json`);
  let downloaded = await hasFile(cacheFile) ? await readJson(cacheFile) : null;
  if (!downloaded) {
    downloaded = await getLocalizedHtml(entry);
    await atomicWrite(cacheFile, JSON.stringify(downloaded));
  }
  const { html, locale, url } = downloaded;
  const metadata = readBuildMetadata(html, entry.slug);
  const verified = guided[entry.slug];
  if (verified && verified.version !== entry.version) {
    throw new Error(`Phiên bản ${entry.slug} thay đổi. Hãy kiểm tra adapter cho ${entry.version}`);
  }
  const screens = metadata.screens.map(({ title }, index) => ({
    id: index === 0 ? 'main' : `screen-${index + 1}`, title, properties: [], actions: [],
  }));
  if (screens.length === 0) screens.push({ id: 'main', title: entry.titles[locale], properties: [], actions: [] });
  if (verified) screens[0] = { ...verified.screen };
  const schema = { slug: entry.slug, title: entry.titles[locale], chapter: entry.chapter, version: entry.version,
    locale, screens, bridgeMode: verified ? 'guided' : 'manual' };
  const candidates = await scanExactSource(entry, metadata, cache);
  const rendered = injectBridge(html, schema, bridge);
  const sha256 = hash(rendered);
  const assetPath = `${entry.slug}-${entry.version}-${locale}-${sha256.slice(0, 16)}.html`;
  await atomicWrite(join(assetDir, assetPath), rendered);
  return {
    ...schema, assetPath, sha256, sourceUrl: url, sourceSha256: hash(html),
    ...(candidates.length ? { sourceProperties: candidates } : {}),
  };
}

export async function runPipeline({ refresh = false, manifestOnly = false } = {}) {
  const manifest = await pinnedCatalog(refresh);
  if (manifestOnly) {
    console.log(`Đã ghim ${manifest.length} bản PhET HTML5.`);
    return;
  }
  const bridge = await readFile(join(scripts, 'physim-bridge.js'), 'utf8');
  const assetDir = join(storage, 'phet-sims');
  const cache = join(storage, '.phet-cache');
  const results = new Array(manifest.length);
  let cursor = 0;
  let completed = 0;

  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < manifest.length) {
      const index = cursor++;
      results[index] = await syncEntry(manifest[index], bridge, assetDir, cache);
      completed++;
      if (completed % 10 === 0 || completed === manifest.length) {
        console.log(`PhET ${completed}/${manifest.length}`);
      }
    }
  });
  const outcomes = await Promise.allSettled(workers);
  const failures = outcomes.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length) throw new AggregateError(failures, 'Bản đồng bộ PhET chưa hoàn thành');
  await atomicWrite(join(storage, 'sim-schemas.json'), JSON.stringify({ schemaVersion: 1, simulations: results }, null, 2) + '\n');
  console.log(`Đã kích hoạt ${results.length} mô phỏng, ${results.filter(sim => sim.bridgeMode === 'guided').length} adapter học tập.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const argumentsSet = new Set(process.argv.slice(2));
  try {
    await runPipeline({ refresh: argumentsSet.has('--refresh-manifest'), manifestOnly: argumentsSet.has('--manifest-only') });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
