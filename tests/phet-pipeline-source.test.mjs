import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonDeclaration, sourceCandidates, scanSourceAst } from '../scripts/phet-source-scan.mjs';

test('source declaration parser handles quoted braces and never executes bundle code',()=>{
  assert.deepEqual(readJsonDeclaration('window.phet.chipper.buildInfo={"totalitySHA":"abc","text":"a } brace"}; throw Error("never execute");','buildInfo'),{totalitySHA:'abc',text:'a } brace'});
  assert.equal(readJsonDeclaration('window.phet.chipper.buildInfo=alert(1);','buildInfo'),null);
});

test('source candidates use exact embedded commits or exact release tags, never main/latest',()=>{
  const sha='a'.repeat(40);
  const result=sourceCandidates('ohms-law','1.4.33',`window.phet.chipper.buildInfo={"totalitySHA":"${sha}"};`);
  assert.equal(result.candidates[0].ref,sha);
  assert.deepEqual(result.candidates.slice(1).map(item=>item.ref),['1.4.33','v1.4.33']);
  assert.ok(result.candidates.every(item=>!['main','master','latest'].includes(item.ref)));
  assert.throws(()=>sourceCandidates('../private','1.0.0',''),/Unsafe/);
});

test('AST records literal property types/defaults/ranges/actions as read-only evidence',async()=>{
  const evidence=await scanSourceAst(`
    import NumberProperty from './NumberProperty.js';
    class ExampleModel {
      constructor() {
        this.voltageProperty = new NumberProperty(6, { range: new Range(0, 12), units: 'V' });
        this.enabledProperty = new BooleanProperty(true);
        this.modeProperty = new StringProperty('steady', { validValues: ['steady','pulse'] });
      }
      reset() {} fire() {}
    }
    class ExampleScreen extends Screen {}
    const screen = new ExampleScreen({ name: 'Màn hình mẫu' });
  `,'ExampleModel.ts');
  const voltage=evidence.properties.find(item=>item.key==='voltageProperty');
  assert.equal(voltage.type,'number');assert.equal(voltage.defaultValue,6);
  assert.equal(voltage.min,0);assert.equal(voltage.max,12);assert.equal(voltage.unit,'V');
  assert.ok(evidence.properties.every(item=>item.writable===false && item.permission==='evidence-only'));
  assert.deepEqual(evidence.properties.find(item=>item.key==='modeProperty').values,['steady','pulse']);
  assert.ok(evidence.actions.some(item=>item.id==='fire' && item.executable===false));
  assert.ok(evidence.screens.some(item=>item.className==='ExampleScreen'));
  assert.equal(evidence.parseDiagnostics.length,0);
});
