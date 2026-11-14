/* Physim-AI adapter for the unmodified PhET Wave on a String 1.2.6 bundle.
 * Binding evidence: .qa/bridge-wave-evidence.json. No PhET-iO API is used.
 */
(function registerWaveAdapter(global) {
  'use strict';
  const registry = global.PhysimAdapters;
  if (!registry) throw new Error('PhysimAdapters registry is required');
  const definitions = [
    {key:'frequency',name:'Tần số',type:'number',unit:'Hz',min:0,max:3,defaultValue:1.5,writable:true},
    {key:'amplitude',name:'Biên độ',type:'number',unit:'cm',min:0,max:1.3,defaultValue:0.75,writable:true},
    {key:'tension',name:'Độ căng tương đối',type:'number',min:0.2,max:0.8,defaultValue:0.8,writable:true},
    {key:'damping',name:'Độ tắt dần',type:'number',min:0,max:1,defaultValue:0.2,writable:true},
    {key:'pulseWidth',name:'Độ rộng xung',type:'number',unit:'s',min:0.2,max:1,defaultValue:0.5,writable:true},
    {key:'waveMode',name:'Chế độ nguồn',type:'string',values:['MANUAL','OSCILLATE','PULSE'],defaultValue:'MANUAL',writable:true},
    {key:'stringEndType',name:'Đầu dây',type:'string',values:['FIXED_END','LOOSE_END','NO_END'],defaultValue:'FIXED_END',writable:true},
    {key:'isPlaying',name:'Đang chạy',type:'boolean',defaultValue:true,writable:true},
    {key:'sourceDisplacement',name:'Li độ đầu dây',type:'number',unit:'cm',writable:false},
    {key:'midpointDisplacement',name:'Li độ giữa dây',type:'number',unit:'cm',writable:false},
    {key:'phase',name:'Pha nguồn',type:'number',unit:'rad',writable:false}
  ];
  function fail(message) { const error=new Error(message);error.code='INVALID_CONFIG';throw error; }
  function noArgs(args) { if (args && (typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)) fail('Thao tác này không nhận tham số.'); }
  registry.register({
    slug:'wave-on-a-string',
    versions:['1.2.6'],
    sourceSha256:'0498d3b6f8ed2d1a4c850bb9d2f085938fc5d1bb5c0c928cdd0bea65e9d195fb',
    screens:[{id:'main',index:0,name:'Sóng trên một sợi dây',properties:definitions,actions:[
      {id:'observe',name:'Đọc số liệu'},
      {id:'run',name:'Chạy thí nghiệm'},
      {id:'pulse',name:'Phát một xung'}
    ]}],
    bind(sim,screenId) {
      if(String(sim.version)!=='1.2.6'||screenId!=='main') throw new Error('Unsupported Wave on a String version or screen');
      const model=(sim.simScreens||sim.screens)[0].model;
      if(!model?.frequencyProperty||typeof model.manualStep!=='function') throw new Error('Wave model is not ready');
      const properties={};
      for(const key of ['frequency','amplitude','tension','damping','pulseWidth','isPlaying']) properties[key]=registry.property(model[key+'Property']);
      for(const key of ['waveMode','stringEndType']) {
        const property=model[key+'Property'];
        properties[key]=registry.property(property,{
          toPublic:value=>value.name,
          fromPublic:value=>{
            const item=property.validValues.find(candidate=>candidate.name===value);
            if(!item)fail('Giá trị chế độ sóng không hợp lệ.');
            return item;
          }
        });
      }
      properties.sourceDisplacement={
        get:()=>-model.yDraw[0]/80||0,
        subscribe(listener){
          const notify=()=>listener(-model.yDraw[0]/80);
          model.yNowChangedEmitter.addListener(notify);
          return ()=>model.yNowChangedEmitter.removeListener(notify);
        }
      };
      properties.phase=registry.property(model.angleProperty);
      // The pinned model maps centimetres to scene coordinates by exactly 80.
      // This conversion is observed in manualStep and verified in browser tests.
      properties.midpointDisplacement={
        get:()=>-model.yDraw[30]/80||0,
        subscribe(listener){
          const notify=()=>listener(-model.yDraw[30]/80);
          model.yNowChangedEmitter.addListener(notify);
          return ()=>model.yNowChangedEmitter.removeListener(notify);
        }
      };
      properties.maximumDisplacement={
        get:()=>Math.max(...model.yDraw.map(Math.abs))/80,
        subscribe(listener){
          const notify=()=>listener(Math.max(...model.yDraw.map(Math.abs))/80);
          model.yNowChangedEmitter.addListener(notify);
          return ()=>model.yNowChangedEmitter.removeListener(notify);
        }
      };
      const read=()=>Object.fromEntries(Object.entries(properties).map(([key,binding])=>[key,binding.get()]));
      return {
        properties,
        actions:{
          observe(args){noArgs(args);return read();},
          run(args={}){
            if(typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>key!=='steps'))fail('Tham số chạy không hợp lệ.');
            const steps=args.steps??50;
            if(!Number.isInteger(steps)||steps<1||steps>300)fail('Số bước phải là số nguyên từ 1 đến 300.');
            model.isPlayingProperty.value=false;
            for(let i=0;i<steps;i++)model.manualStep(0.02);
            return {...read(),steps,advancedSeconds:steps*0.02};
          },
          pulse(args){
            noArgs(args);
            model.isPlayingProperty.value=false;
            properties.waveMode.set('PULSE');
            model.manualRestart();
            model.manualPulse();
            for(let i=0;i<25;i++)model.manualStep(0.02);
            return {...read(),steps:25,advancedSeconds:0.5};
          }
        },
        reset(){model.reset();}
      };
    }
  });
})(window);
