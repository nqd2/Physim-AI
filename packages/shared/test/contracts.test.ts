import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSimulationConfig,type SimulationSchema,SimulationConfigSchema} from '../src/simulation.ts';
import {makeBridgeCommand,parseBridgeMessage,BridgeEnvelopeSchema} from '../src/bridge.ts';
import {AnalyzePhotoRequestSchema,AnalyzePhotoResponseSchema,GenerateVariantRequestSchema} from '../src/learning.ts';

const schema:SimulationSchema={slug:'test-simulation',version:'1.0.0',adapterVerified:true,screens:[{
  id:'main',name:'Thí nghiệm',properties:[
    {key:'voltage',type:'number',min:0,max:10,writable:true},
    {key:'current',type:'number',writable:false},
    {key:'particles',type:'number',integer:true,min:0,max:20,writable:true},
    {key:'mode',type:'string',values:['one','two'],writable:true},
    {key:'paused',type:'boolean',writable:true}
  ],actions:[{id:'measure',name:'Đo'}]
}]};
const config={slug:'test-simulation',version:'1.0.0',screenId:'main',values:{voltage:6,particles:8,mode:'one',paused:false}};

test('schema permits a verified configuration and does not mutate its proposal',()=>{
  const before=structuredClone(config);
  assert.deepEqual(validateSimulationConfig(schema,config),{success:true,errors:[]});
  assert.deepEqual(config,before);
});
test('a configuration reports all invalid values before any write is possible',()=>{
  const result=validateSimulationConfig(schema,{...config,values:{voltage:11,current:3,missing:true,particles:1.5,mode:'other',paused:'true'}});
  assert.equal(result.success,false);
  for(const key of ['voltage','current','missing','particles','mode','paused'])assert.ok(result.errors.some(error=>error.includes(key)));
});
test('unverified adapter, stale version, wrong slug and wrong screen are rejected',()=>{
  assert.equal(validateSimulationConfig({...schema,adapterVerified:false},config).success,false);
  assert.equal(validateSimulationConfig(schema,{...config,version:'2.0.0'}).success,false);
  assert.equal(validateSimulationConfig(schema,{...config,slug:'other'}).success,false);
  assert.equal(validateSimulationConfig(schema,{...config,screenId:'unknown'}).success,false);
});
test('nonfinite values and extra config fields are rejected at DTO boundary',()=>{
  assert.equal(SimulationConfigSchema.safeParse({...config,values:{voltage:NaN}}).success,false);
  assert.equal(SimulationConfigSchema.safeParse({...config,values:{voltage:Infinity}}).success,false);
  assert.equal(SimulationConfigSchema.safeParse({...config,runArbitraryScript:true}).success,false);
});
test('bridge accepts current load and drops stale load, unknown protocol, invalid JSON',()=>{
  const message=makeBridgeCommand('GET_STATE','load-current','request-1');
  assert.deepEqual(parseBridgeMessage(JSON.stringify(message),'load-current'),message);
  assert.equal(parseBridgeMessage(message,'load-previous'),null);
  assert.equal(parseBridgeMessage({...message,protocol:'other'},'load-current'),null);
  assert.equal(parseBridgeMessage('{broken','load-current'),null);
  assert.equal(BridgeEnvelopeSchema.safeParse({...message,requestId:undefined}).success,false);
});
test('image requests accept only JPEG/PNG base64 and refuse unrelated request fields',()=>{
  const request={sessionId:'session-1',image:{mimeType:'image/png',base64:'aGVsbG8='}};
  assert.equal(AnalyzePhotoRequestSchema.safeParse(request).success,true);
  assert.equal(AnalyzePhotoRequestSchema.safeParse({...request,image:{...request.image,mimeType:'image/svg+xml'}}).success,false);
  assert.equal(AnalyzePhotoRequestSchema.safeParse({...request,image:{...request.image,base64:'data:image/png;base64,abcd'}}).success,false);
  assert.equal(AnalyzePhotoRequestSchema.safeParse({...request,apiKey:'not-allowed'}).success,false);
});
test('readable text without a suitable simulation can still return educational guidance',()=>{
  const response={status:'no_simulation',message:'Chưa có mô phỏng phù hợp.',transcription:'Tính công suất của máy.',facts:[],misconceptions:[],hints:['Xét công thực hiện trong một đơn vị thời gian.'],simulationConfig:null};
  assert.equal(AnalyzePhotoResponseSchema.safeParse(response).success,true);
  assert.equal(GenerateVariantRequestSchema.safeParse({sessionId:'session-1',context:{problem:'Một bài Vật lý',step:4}}).success,true);
});
