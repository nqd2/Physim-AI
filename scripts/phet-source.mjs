import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

function jsonAssignment(html, key) {
  const match = html.match(new RegExp(`window\\.phet\\.chipper\\.${key}\\s*=\\s*(\\{[^\\r\\n]*\\});`));
  if (!match) return null;
  try { return JSON.parse(match[1]); }
  catch { return null; }
}

const clean = value => value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();

export function readBuildMetadata(html, slug) {
  const project = jsonAssignment(html, 'packageObject');
  const dependencies = jsonAssignment(html, 'dependencies');
  const info = jsonAssignment(html, 'buildInfo');
  const screenKeys = project?.phet?.screenNameKeys ??
    (html.match(/"screenNameKeys"\s*:\s*\[(.*?)\]/s)?.[1] ?? '').match(/"[^"]+"/g)?.map(value => value.slice(1, -1)) ?? [];
  const strings = jsonAssignment(html, 'strings');
  const screens = screenKeys.map(key => {
    const localized = Object.values(strings ?? {}).find(locale => typeof locale?.[key] === 'string')?.[key];
    const id = key.split('/').at(-1).replace(/^screen\./, '');
    const label = id.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ');
    return { title: localized ? clean(localized) : label.charAt(0).toUpperCase() + label.slice(1) };
  });
  return { screens, sourceSha: dependencies?.[slug]?.sha ?? info?.totalitySHA };
}

const recognizedProperties = {
  NumberProperty: 'number', BooleanProperty: 'boolean',
  EnumerationProperty: 'enum', Vector2Property: 'vector2',
};
const actions = new Set(['fireCannon', 'cannonFired', 'reset', 'step']);

function literal(node) {
  if (!node) return undefined;
  if (['NumericLiteral', 'BooleanLiteral', 'StringLiteral'].includes(node.type)) return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'NumericLiteral') {
    return -node.argument.value;
  }
  if (node.type === 'NewExpression' && node.callee.name === 'Vector2') {
    const [x, y] = node.arguments.map(literal);
    if (typeof x === 'number' && typeof y === 'number') return { x, y };
  }
  return undefined;
}

function memberName(node) {
  return node?.name ?? node?.property?.name ?? node?.value;
}

function visit(node, callback, parent) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, callback, parent);
    return;
  }
  if (typeof node.type !== 'string') return;
  callback(node, parent);
  for (const value of Object.values(node)) visit(value, callback, node);
}

export function inspectSource(code, file) {
  const ast = parse(code, { sourceType: 'unambiguous', plugins: file.endsWith('.ts') ? ['typescript'] : [] });
  const declarations = [];
  visit(ast, (node, parent) => {
    if (node.type === 'NewExpression') {
      const name = memberName(node.callee);
      const kind = recognizedProperties[name];
      const id = memberName(parent?.left ?? parent?.key ?? parent?.id);
      if (kind && id) {
        const [initial, options] = node.arguments;
        const rangeNode = options?.properties?.find(property => memberName(property.key) === 'range')?.value;
        const bounds = rangeNode?.type === 'NewExpression' && memberName(rangeNode.callee) === 'Range'
          ? rangeNode.arguments.map(literal) : [];
        declarations.push({
          file, id, kind, defaultValue: literal(initial),
          range: bounds.length === 2 && bounds.every(value => typeof value === 'number') ? bounds : undefined,
        });
      }
      if (/Screen$/.test(name ?? '') && id) declarations.push({ file, id, kind: 'screen' });
    }
    if (['ClassMethod', 'ObjectMethod', 'ObjectProperty', 'TSDeclareMethod'].includes(node.type) && actions.has(memberName(node.key))) {
      declarations.push({ file, id: memberName(node.key), kind: 'action' });
    }
  });
  return declarations;
}

async function publicFile(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4500) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
  return response;
}

export async function scanExactSource(entry, metadata, cache) {
  const sha = metadata.sourceSha;
  if (!sha || !/^[a-f0-9]{40}$/.test(sha)) return [];
  const cachePath = join(cache, `${entry.slug}-${sha}.source.json`);
  try { return JSON.parse(await readFile(cachePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const repo = `phetsims/${entry.slug}`;
  const raw = `https://raw.githubusercontent.com/${repo}/${sha}`;
  try {
    const manifest = await publicFile(`${raw}/package.json`);
    if (!manifest || (await manifest.json()).version !== entry.version) {
      await writeFile(cachePath, '[]');
      return [];
    }
    const tree = await publicFile(`https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`);
    if (!tree) return [];
    const files = (await tree.json()).tree.filter(item => item.type === 'blob' &&
      /^js\/[A-Za-z0-9_.\/-]+\.(?:js|ts)$/.test(item.path) &&
      (/\/model\//.test(item.path) || /Screen\.(?:js|ts)$/.test(item.path)));
    const declarations = [];
    for (const file of files) {
      const response = await publicFile(`${raw}/${file.path}`);
      if (response) declarations.push(...inspectSource(await response.text(), file.path));
    }
    await writeFile(cachePath, JSON.stringify(declarations));
    return declarations;
  } catch (error) {
    console.warn(`Bỏ qua quét mã nguồn ${entry.slug}: ${error.message}`);
    return [];
  }
}
