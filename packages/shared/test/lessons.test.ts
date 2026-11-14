import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { getSampleLesson, SAMPLE_LESSONS } from '../src/lessons.ts';

type AdapterProperty = {
  key: string;
  type: string;
  writable: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  values?: Array<string | number | boolean>;
};
type AdapterDefinition = {
  slug: string;
  screens: Array<{ id: string; properties: AdapterProperty[]; actions: Array<{ id: string }> }>;
};

function adapterDeclarations(): Map<string, AdapterDefinition> {
  const directory = new URL('../../../apps/server/src/phet-bridge/adapters/', import.meta.url);
  const declarations = new Map<string, AdapterDefinition>();
  const context = vm.createContext({
    window: {
      PhysimAdapters: {
        register(definition: AdapterDefinition) {
          assert.equal(declarations.has(definition.slug), false, `Duplicate adapter: ${definition.slug}`);
          declarations.set(definition.slug, definition);
        },
      },
    },
  });
  // These are the six sample adapters bundled by phet-bridge/build-assets.mjs.
  // Standalone research files in that directory are not production adapters.
  for (const name of ['ohms-law.js', 'physics.js', 'gas.js', 'wave.js', 'optics-nucleus.js']) {
    vm.runInContext(readFileSync(new URL(name, directory), 'utf8'), context, { filename: name, timeout: 1_000 });
  }
  return declarations;
}

test('six authored lessons cover all six chapters and each has a complete learning sequence', () => {
  assert.equal(SAMPLE_LESSONS.length, 6);
  assert.equal(new Set(SAMPLE_LESSONS.map(lesson => lesson.id)).size, 6);
  assert.equal(new Set(SAMPLE_LESSONS.map(lesson => lesson.slug)).size, 6);
  assert.deepEqual(new Set(SAMPLE_LESSONS.map(lesson => lesson.chapter)), new Set(['mechanics', 'thermal', 'electricity', 'waves', 'optics', 'nuclear']));
  for (const lesson of SAMPLE_LESSONS) {
    assert.ok(lesson.problem.length > 30, lesson.id);
    assert.ok(lesson.objective.length > 15, lesson.id);
    assert.ok(lesson.hints.length >= 3, lesson.id);
    assert.ok(lesson.causalLinks.length >= 3, lesson.id);
    assert.equal(new Set(lesson.causalLinks.map(link => link.id)).size, lesson.causalLinks.length, lesson.id);
    assert.ok(lesson.teachBackPrompt.length > 20, lesson.id);
    assert.ok(lesson.review.question.length > 20 && lesson.review.answer.length > 20, lesson.id);
    for (const prediction of [lesson.prediction, lesson.variant.prediction]) {
      assert.ok(prediction.options.length >= 2);
      assert.equal(new Set(prediction.options.map(option => option.id)).size, prediction.options.length);
      assert.equal(prediction.options.filter(option => option.id === prediction.correctOptionId).length, 1);
      assert.ok(prediction.explanation.length > 20);
    }
  }
});

test('each variant changes exactly one simulation condition while preserving its screen and slug', () => {
  for (const lesson of SAMPLE_LESSONS) {
    const original = lesson.config;
    const variant = lesson.variant.config;
    assert.equal(original.slug, lesson.slug);
    assert.equal(variant.slug, original.slug);
    assert.equal(variant.screenId, original.screenId);
    assert.notEqual(variant, original);
    assert.notEqual(variant.values, original.values);
    const keys = new Set([...Object.keys(original.values), ...Object.keys(variant.values)]);
    const changed = [...keys].filter(key => original.values[key] !== variant.values[key]);
    assert.equal(changed.length, 1, `${lesson.id}: changed ${changed.join(', ')}`);
  }
});

test('all lesson configurations and experiment actions match the actual adapter declarations', () => {
  const adapters = adapterDeclarations();
  for (const lesson of SAMPLE_LESSONS) {
    const adapter = adapters.get(lesson.slug);
    assert.ok(adapter, `No adapter declaration for ${lesson.slug}`);
    for (const config of [lesson.config, lesson.variant.config]) {
      const screen: AdapterDefinition['screens'][number] | undefined = adapter.screens.find(candidate => candidate.id === config.screenId);
      assert.ok(screen, `${lesson.id}: unknown screen ${config.screenId}`);
      assert.ok(screen.actions.some(action => action.id === lesson.experiment.action), `${lesson.id}: unknown action ${lesson.experiment.action}`);
      assert.ok(Object.keys(config.values).length > 0, `${lesson.id}: missing authored configuration`);
      for (const [key, value] of Object.entries(config.values)) {
        const property: AdapterProperty | undefined = screen.properties.find(candidate => candidate.key === key);
        assert.ok(property, `${lesson.id}: unknown property ${key}`);
        assert.equal(property.writable, true, `${lesson.id}: read-only property ${key}`);
        assert.equal(typeof value, property.type, `${lesson.id}: invalid type for ${key}`);
        if (typeof value === 'number') {
          assert.ok(Number.isFinite(value));
          if (property.min !== undefined) assert.ok(value >= property.min, `${lesson.id}: ${key} below minimum`);
          if (property.max !== undefined) assert.ok(value <= property.max, `${lesson.id}: ${key} above maximum`);
          if (property.integer) assert.ok(Number.isInteger(value), `${lesson.id}: ${key} must be an integer`);
        }
        if (property.values) assert.ok(property.values.includes(value), `${lesson.id}: ${key} invalid enum value`);
      }
    }
  }
});

test('quantitative answer keys remain consistent with the authored parameters', () => {
  const ohm = getSampleLesson('ohms-law');
  assert.ok(ohm);
  for (const pair of [{ config: ohm.config, prediction: ohm.prediction }, { config: ohm.variant.config, prediction: ohm.variant.prediction }]) {
    const currentMA = Number(pair.config.values.voltage) / Number(pair.config.values.resistance) * 1000;
    assert.equal(pair.prediction.options.find(option => option.id === pair.prediction.correctOptionId)?.text, `${currentMA} mA`);
  }
  const wave = getSampleLesson('wave-on-a-string');
  assert.ok(wave);
  assert.equal((1 / Number(wave.config.values.frequency)).toFixed(2), '0.67');
  const nucleus = getSampleLesson('build-a-nucleus');
  assert.ok(nucleus);
  for (const pair of [{ config: nucleus.config, prediction: nucleus.prediction }, { config: nucleus.variant.config, prediction: nucleus.variant.prediction }]) {
    const answer = pair.prediction.options.find(option => option.id === pair.prediction.correctOptionId)?.text ?? '';
    assert.ok(answer.includes(`Z = ${pair.config.values.protons}`));
    assert.ok(answer.includes(`A = ${Number(pair.config.values.protons) + Number(pair.config.values.neutrons)}`));
  }
});

test('lesson lookup accepts the saved lesson id or simulation slug and rejects missing lessons', () => {
  assert.equal(getSampleLesson('ohm-current'), getSampleLesson('ohms-law'));
  assert.equal(getSampleLesson('not-a-lesson'), undefined);
});
