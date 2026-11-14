import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../apps/server/src/phet-bridge/physim-bridge.js',import.meta.url),'utf8');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function property(initial){
  let value=initial;const listeners=new Set();
  return {get value(){return value},set value(next){value=next;listeners.forEach(fn=>fn(next))},lazyLink(fn){listeners.add(fn)},unlink(fn){listeners.delete(fn)},get count(){return listeners.size}};
}
function createRuntime({verified=true,native=true}={}){
  const writes=[],events=[],handlers=new Map();const value=property(3),count=property(6);
  const screens=[{model:{}}],selected=property(screens[0]);
  const factory={screens:[{id:'main',index:0,name:'Test',properties:[{key:'voltage',type:'number',min:0,max:10,writable:true},{key:'count',type:'number',min:0,max:10,integer:true,writable:true}],actions:[{id:'observe',name:'Observe'}]}],bind(){return{properties:{voltage:{get:()=>value.value,set:v=>{writes.push(['voltage',v]);value.value=v},subscribe(fn){value.lazyLink(fn);return()=>value.unlink(fn)}},count:{get:()=>count.value,set:v=>{writes.push(['count',v]);count.value=v},subscribe(fn){count.lazyLink(fn);return()=>count.unlink(fn)}}},actions:{observe:()=>({voltage:value.value})},reset:()=>{value.value=3;count.value=6}}}};
  const parent={postMessage:data=>events.push(data)};
  const window={location:{search:native?'?physimNative=1&physimLoadId=verified-load-12345':'?physimParentOrigin=https%3A%2F%2Fapp.example&physimLoadId=verified-load-12345'},parent,
    __PHYSIM_SIM__:{slug:'test',version:'1',adapterVerified:verified},phet:{joist:{sim:{version:'1',screens,screenIndexProperty:property(0),currentScreenProperty:selected}}},
    PhysimAdapters:{find:()=>factory},ReactNativeWebView:native?{postMessage:raw=>events.push(JSON.parse(raw))}:undefined,
    addEventListener(type,fn){handlers.set(type,fn)},removeEventListener(type){handlers.delete(type)}};
  vm.runInNewContext(source,{window,URL,URLSearchParams,setTimeout,clearTimeout,setInterval,clearInterval,console});
  const packet=(type,payload={},overrides={})=>({protocol:'physim-bridge',version:1,loadId:'verified-load-12345',requestId:'request-'+Math.random().toString(36).slice(2),type,payload,...overrides});
  const send=async(type,payload,overrides)=>{const message=packet(type,payload,overrides);if(native)window.physimBridge.receive(JSON.stringify(message),'verified-load-12345');else handlers.get('message')?.({source:parent,origin:'https://app.example',data:JSON.stringify(message)});await delay(2);return events.find(event=>event.requestId===message.requestId)};
  return {window,value,count,writes,events,handlers,parent,packet,send,dispose:()=>window.physimBridge.dispose()};
}
test('native bridge requires nonce and validates the whole configuration before any mutation',async()=>{
  const runtime=createRuntime();try{
    await runtime.send('INIT');
    assert.equal(runtime.window.physimBridge.receive(JSON.stringify(runtime.packet('APPLY_CONFIG',{screenId:'main',values:{voltage:8}})),'wrong'),false);
    assert.equal(runtime.window.physimBridge.receive(JSON.stringify(runtime.packet('APPLY_CONFIG',{screenId:'main',values:{voltage:8}},{version:2})),'verified-load-12345'),false);
    const invalid=await runtime.send('APPLY_CONFIG',{screenId:'main',values:{voltage:8,count:1.5}});
    assert.equal(invalid.type,'ERROR');assert.equal(invalid.payload.code,'INVALID_CONFIG');assert.deepEqual(runtime.writes,[]);assert.equal(runtime.value.value,3);
    const valid=await runtime.send('APPLY_CONFIG',{screenId:'main',values:{voltage:8,count:7}});
    assert.equal(valid.type,'RESULT');assert.equal(valid.payload.values.voltage,8);
  }finally{runtime.dispose();}
});
test('iframe bridge checks message source and origin as well as current load id',async()=>{
  const runtime=createRuntime({native:false});try{
    await runtime.send('INIT');const message=runtime.packet('APPLY_CONFIG',{screenId:'main',values:{voltage:9}});
    runtime.handlers.get('message')({source:{},origin:'https://app.example',data:message});
    runtime.handlers.get('message')({source:runtime.parent,origin:'https://foreign.example',data:message});
    runtime.handlers.get('message')({source:runtime.parent,origin:'https://app.example',data:{...message,loadId:'stale-load'}});
    await delay(10);assert.deepEqual(runtime.writes,[]);
    assert.equal(runtime.window.physimBridge.receive(JSON.stringify(message),'verified-load-12345'),false);
  }finally{runtime.dispose();}
});
test('unverified simulation offers direct interaction only and rejects adapter operations',async()=>{
  const runtime=createRuntime({verified:false});try{
    const ready=await runtime.send('INIT');assert.equal(ready.payload.capabilities.applyConfig,false);
    const response=await runtime.send('APPLY_CONFIG',{screenId:'main',values:{voltage:9}});
    assert.equal(response.payload.code,'UNSUPPORTED');assert.deepEqual(runtime.writes,[]);
    const state=await runtime.send('GET_STATE');assert.equal(Object.keys(state.payload.values).length,0);
  }finally{runtime.dispose();}
});
test('telemetry batches property changes, survives a pending rebind, and removes listeners on dispose',async()=>{
  const runtime=createRuntime();try{
    await runtime.send('INIT');runtime.value.value=5;runtime.value.value=6;
    await runtime.send('SWITCH_SCREEN',{screenId:'main'});runtime.value.value=7;
    await delay(130);const changed=runtime.events.filter(event=>event.type==='PROPERTY_CHANGED');
    assert.equal(changed.length,1);assert.equal(changed[0].payload.values.voltage,7);assert.equal(runtime.value.count,1);
    runtime.dispose();assert.equal(runtime.value.count,0);const before=runtime.events.length;runtime.value.value=2;await delay(120);assert.equal(runtime.events.length,before);
  }finally{runtime.dispose();}
});
test('only actions registered for the active screen execute',async()=>{
  const runtime=createRuntime();try{
    await runtime.send('INIT');const missing=await runtime.send('RUN_EXPERIMENT',{action:'launch'});assert.equal(missing.payload.code,'UNSUPPORTED');
    const badArgs=await runtime.send('RUN_EXPERIMENT',{action:'observe',args:{arbitrary:1}});assert.equal(badArgs.payload.code,'INVALID_CONFIG');
    const observed=await runtime.send('RUN_EXPERIMENT',{action:'observe'});assert.equal(observed.payload.measurement.voltage,3);
  }finally{runtime.dispose();}
});
