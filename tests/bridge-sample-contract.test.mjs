import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SAMPLE_LESSONS} from '../packages/shared/src/lessons.ts';

const registry=JSON.parse(await readFile(new URL('../packages/shared/data/adapter-schemas.json',import.meta.url),'utf8'));

test('all six guided samples use registered experiment actions without unsupported arguments',()=>{
  assert.equal(SAMPLE_LESSONS.length,6);
  for(const lesson of SAMPLE_LESSONS){
    const adapter=registry.adapters[lesson.slug];
    assert.ok(adapter?.verified,`${lesson.id}: adapter must have browser verification`);
    const screen=adapter.schema.screens.find(item=>item.id===lesson.config.screenId);
    assert.ok(screen,`${lesson.id}: screen must be registered`);
    assert.ok(screen.actions.some(action=>action.id===lesson.experiment.action),`${lesson.id}: experiment must be registered on the lesson screen`);
    assert.equal(Object.keys(lesson.experiment.args||{}).length,0,`${lesson.id}: the v1 bridge only accepts parameter-free experiments; configure properties first`);
  }
  const wave=SAMPLE_LESSONS.find(lesson=>lesson.slug==='wave-on-a-string');
  assert.equal(wave.experiment.action,'run');
});
