/* Physim-AI adapter registry. PhET bundles remain unchanged. */
(function (global) {
  'use strict';
  const factories = new Map();
  global.PhysimAdapters = Object.freeze({
    register(factory) {
      if (!factory || !factory.slug || !Array.isArray(factory.versions) || typeof factory.bind !== 'function') throw new Error('Invalid adapter factory');
      if (factories.has(factory.slug)) throw new Error('Duplicate adapter: ' + factory.slug);
      factories.set(factory.slug, factory);
    },
    find(slug, version) {
      const factory = factories.get(slug);
      return factory && factory.versions.includes(version) ? factory : null;
    },
    property(property, transform) {
      if (!property || typeof property.lazyLink !== 'function' || typeof property.unlink !== 'function') throw new Error('Expected a PhET Property');
      const convert = transform || {};
      const read = value => convert.toPublic ? convert.toPublic(value) : value;
      return {
        get: () => read(property.value),
        set: value => { property.value = convert.fromPublic ? convert.fromPublic(value) : value; },
        subscribe(listener) {
          const linked = value => listener(read(value));
          property.lazyLink(linked);
          return () => property.unlink(linked);
        }
      };
    },
    screenModel(sim, index) {
      const screen = (sim.simScreens || sim.screens)[index];
      return screen.model || screen._model;
    }
  });
})(window);

/* Adapter verified against PhET Ohm's Law 1.4.33, standard HTML5 build. */
(function (global) {
  'use strict';
  const registry = global.PhysimAdapters;
  registry.register({
    slug: 'ohms-law', versions: ['1.4.33'],
    screens: [{
      id: 'main', index: 0, name: 'Định luật Ohm',
      properties: [
        { key: 'voltage', name: 'Hiệu điện thế', type: 'number', min: 0.1, max: 9, defaultValue: 4.5, unit: 'V', writable: true },
        { key: 'resistance', name: 'Điện trở', type: 'number', min: 10, max: 1000, defaultValue: 500, unit: 'Ω', writable: true },
        { key: 'current', name: 'Cường độ dòng điện', type: 'number', defaultValue: 9, unit: 'mA', writable: false }
      ],
      actions: [{ id: 'observe', name: 'Đo dòng điện' }]
    }],
    bind(sim, screenId) {
      if (screenId !== 'main') throw new Error('Unsupported Ohm screen');
      const model = registry.screenModel(sim, 0);
      const measured = () => ({ voltage: model.voltageProperty.value, resistance: model.resistanceProperty.value, current: model.currentProperty.value, currentUnit: 'mA' });
      return {
        properties: {
          voltage: registry.property(model.voltageProperty),
          resistance: registry.property(model.resistanceProperty),
          current: registry.property(model.currentProperty)
        },
        actions: { observe: measured },
        reset: () => model.reset()
      };
    }
  });
})(window);

/* Physim-AI adapter for the unmodified PhET Projectile Motion 1.0.36 HTML.
 * Source: embedded PROJECTILE_MOTION/ProjectileMotionModel, Trajectory and
 * ProjectileMotionConstants modules; contract verified in .qa/bridge-projectile-test.mjs.
 * This adapter reads PhET's recorded trajectory, never a replacement physics model.
 */
(function () {
  'use strict';
  const registry = window.PhysimAdapters;
  const failure = (code, message) => Object.assign(new Error(message), { code });
  registry.register({
    slug: 'projectile-motion',
    versions: ['1.0.36'],
    sourceSha256: '770dc2ebaa7d5f200fafe9785c5263fafc63435fa48963e7cec6f3583ea6ed8a',
    screens: [{
      id: 'intro', index: 0, name: 'Giới thiệu',
      properties: [
        { key: 'speed', name: 'Tốc độ ban đầu', type: 'number', min: 0, max: 30, defaultValue: 15, unit: 'm/s', writable: true },
        { key: 'angle', name: 'Góc bắn', type: 'number', min: -90, max: 90, defaultValue: 0, unit: '°', writable: true },
        { key: 'height', name: 'Độ cao ban đầu', type: 'number', min: 0, max: 15, defaultValue: 10, unit: 'm', writable: true },
        { key: 'airResistance', name: 'Lực cản không khí', type: 'boolean', defaultValue: false, writable: true },
        { key: 'gravity', name: 'Gia tốc trọng trường', type: 'number', defaultValue: 9.81, unit: 'm/s²', writable: false },
        { key: 'movingProjectiles', name: 'Số vật đang bay', type: 'number', defaultValue: 0, writable: false }
      ],
      actions: [{ id: 'fire', name: 'Bắn và đo tầm xa' }, { id: 'observe', name: 'Đọc quỹ đạo hiện tại' }]
    }],
    bind(sim, screenId) {
      if (screenId !== 'intro') throw new Error('UNSUPPORTED: màn hình chưa có adapter.');
      const screen = (sim.simScreens || sim.screens)[0];
      const model = screen && (screen.model || screen._model);
      if (!model || typeof model.cannonFired !== 'function') throw new Error('NOT_READY: mô hình chưa sẵn sàng.');
      function observe(trajectory) {
        const tr = trajectory || model.trajectories.get(model.trajectories.length - 1);
        if (!tr || !tr.dataPoints.length) return { range: 0, flightTime: 0, peakHeight: model.cannonHeightProperty.value, landed: false, samples: 0 };
        const point = tr.dataPoints.get(tr.dataPoints.length - 1);
        let peakHeight = model.cannonHeightProperty.value;
        // The apex can be null for a horizontal/downward launch: retain the highest observed data point.
        for (let i = 0; i < tr.dataPoints.length; i++) peakHeight = Math.max(peakHeight, tr.dataPoints.get(i).position.y);
        return { range: point.position.x, flightTime: point.time, peakHeight, landed: Boolean(tr.reachedGround), samples: tr.dataPoints.length };
      }
      return {
        properties: {
          speed: registry.property(model.launchVelocityProperty),
          angle: registry.property(model.cannonAngleProperty),
          height: registry.property(model.cannonHeightProperty),
          airResistance: registry.property(model.airResistanceOnProperty),
          gravity: registry.property(model.gravityProperty),
          movingProjectiles: registry.property(model.numberOfMovingProjectilesProperty)
        },
        actions: {
          observe: () => observe(),
          fire: async () => {
            if (!model.fireEnabledProperty.value) throw new Error('BUSY: hãy đợi vật đang bay chạm đất.');
            // Start a fresh measured trial without resetting the learner's configuration.
            model.eraseTrajectories();
            model.isPlayingProperty.value = true;
            model.cannonFired();
            const tr = model.trajectories.get(model.trajectories.length - 1);
            const deadline = Date.now() + 16000;
            while (!tr.reachedGround) {
              if ((sim.currentScreenProperty || sim.selectedScreenProperty)?.value !== screen) throw failure('SIMULATION_ERROR', '?? ??i m?n h?nh; th? nghi?m d?ng quan s?t.');
              if (Date.now() >= deadline) throw new Error('TIMEOUT: mô phỏng chưa ghi nhận vật chạm đất.');
              if (!model.trajectories.includes ? model.trajectories.indexOf(tr) < 0 : !model.trajectories.includes(tr)) throw new Error('CANCELLED: quỹ đạo đã bị xóa.');
              await new Promise(resolve => setTimeout(resolve, 30));
            }
            return observe(tr);
          }
        },
        reset: () => model.reset()
      };
    }
  });
}());

/* Physim-AI adapter for the unmodified PhET Gas Properties 1.1.12 HTML.
 * Verified source SHA-256: 467cbce2ecc6b64e57a91e41436ac4c5eb16858ccae5018ca09f8b2edcecf584.
 * Model objects and ranges were inspected in the pinned release, not inferred from PhET-iO.
 */
(function registerGasAdapter(global) {
  'use strict';
  const registry = global.PhysimAdapters;
  if (!registry) throw new Error('PhysimAdapters registry must load first');
  const definition = {
    slug: 'gas-properties',
    versions: ['1.1.12'],
    sourceSha256: '467cbce2ecc6b64e57a91e41436ac4c5eb16858ccae5018ca09f8b2edcecf584',
    screens: [{
      id: 'ideal', index: 0, name: 'Khí lý tưởng',
      properties: [
        { key: 'heavyParticles', name: 'Số hạt nặng', type: 'number', min: 0, max: 1000, step: 1, integer: true, defaultValue: 0, writable: true },
        { key: 'lightParticles', name: 'Số hạt nhẹ', type: 'number', min: 0, max: 1000, step: 1, integer: true, defaultValue: 0, writable: true },
        { key: 'widthNm', name: 'Chiều rộng bình', type: 'number', min: 5, max: 15, unit: 'nm', defaultValue: 10, writable: true },
        { key: 'injectionTemperatureK', name: 'Nhiệt độ khí bơm vào', type: 'number', min: 50, max: 1000, unit: 'K', defaultValue: 300, writable: true },
        { key: 'holdConstant', name: 'Đại lượng giữ không đổi', type: 'string', values: ['nothing', 'volume', 'temperature'], defaultValue: 'nothing', writable: true },
        { key: 'temperatureK', name: 'Nhiệt độ đo được', type: 'number', unit: 'K', nullable: true, defaultValue: null, writable: false },
        { key: 'pressureKPa', name: 'Áp suất đo được', type: 'number', unit: 'kPa', defaultValue: 0, writable: false },
        { key: 'volumeNm3', name: 'Thể tích bình', type: 'number', unit: 'nm³', defaultValue: 350, writable: false }
      ],
      actions: [{ id: 'observe', name: 'Đo trạng thái khí' }]
    }],
    bind(sim, screenId) {
      if (screenId !== 'ideal') throw new Error('Gas Properties adapter only supports the ideal screen');
      const screen = sim.simScreens.find(item => item.phetioID === 'gasProperties.idealScreen');
      if (!screen || !screen.model) throw new Error('Gas Properties ideal model is not ready');
      const model = screen.model;
      const particles = model.particleSystem;
      const container = model.container;
      const temperature = model.temperatureModel;
      const pressure = model.pressureModel;
      if (container.widthProperty.range.min !== 5000 || container.widthProperty.range.max !== 15000 ||
          particles.numberOfHeavyParticlesProperty.range.max !== 1000 || typeof model.updateWhenPaused !== 'function') {
        throw new Error('Pinned Gas Properties adapter contract no longer matches');
      }
      const bindProperty = (property, transform) => registry.property(property, transform);
      const withUpdate = (property, setter) => {
        const binding = bindProperty(property);
        return { ...binding, set(value) { setter(value); model.updateWhenPaused(); } };
      };
      const width = bindProperty(container.widthProperty, { toPublic: value => value / 1000, fromPublic: value => value * 1000 });
      const properties = {
        heavyParticles: withUpdate(particles.numberOfHeavyParticlesProperty, value => {
          if (!Number.isInteger(value) || value < 0 || value > 1000) throw new Error('Particle count must be an integer between 0 and 1000');
          particles.numberOfHeavyParticlesProperty.value = value;
        }),
        lightParticles: withUpdate(particles.numberOfLightParticlesProperty, value => {
          if (!Number.isInteger(value) || value < 0 || value > 1000) throw new Error('Particle count must be an integer between 0 and 1000');
          particles.numberOfLightParticlesProperty.value = value;
        }),
        widthNm: {
          ...width,
          set(value) {
            const previous = container.widthProperty.value;
            const next = value * 1000;
            container.resizeImmediately(next);
            particles.redistributeParticles(next / previous);
            model.updateWhenPaused();
          }
        },
        injectionTemperatureK: withUpdate(temperature.injectionTemperatureProperty, value => {
          temperature.injectionTemperatureProperty.value = value;
          temperature.setInjectionTemperatureEnabledProperty.value = true;
        }),
        holdConstant: withUpdate(model.holdConstantProperty, value => { model.holdConstantProperty.value = value; }),
        temperatureK: bindProperty(temperature.temperatureKelvinProperty),
        pressureKPa: bindProperty(pressure.pressureKilopascalsProperty),
        volumeNm3: bindProperty(container.volumeProperty, { toPublic: value => value / 1e9 })
      };
      return {
        properties,
        actions: {
          observe() {
            // Pressure starts reading only after a real particle/wall collision.
            // Advance the real PhET model (never fabricate a collision or pressure).
            for (let frame = 0; frame < 120 && particles.numberOfParticlesProperty.value > 0 && pressure.pressureKilopascalsProperty.value === 0; frame++) {
              model.stepRealTime(1 / 60);
            }
            model.updateWhenPaused();
            return {
              heavyParticles: particles.numberOfHeavyParticlesProperty.value,
              lightParticles: particles.numberOfLightParticlesProperty.value,
              widthNm: container.widthProperty.value / 1000,
              volumeNm3: container.volumeProperty.value / 1e9,
              temperatureK: temperature.temperatureKelvinProperty.value,
              pressureKPa: pressure.pressureKilopascalsProperty.value,
              holdConstant: model.holdConstantProperty.value
            };
          }
        },
        reset() { model.reset(); model.updateWhenPaused(); }
      };
    }
  };
  registry.register(definition);
})(window);

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

/* Physim-AI adapter for the unmodified PhET Bending Light 1.2.7 release.
 * Capability evidence: .qa/bridge-optics-evidence.json. No PhET-iO API is used.
 */
(function () {
  'use strict';
  const A = window.PhysimAdapters;
  const degrees = radians => radians * 180 / Math.PI;
  const radians = degrees => degrees * Math.PI / 180;
  const round = value => { const rounded = Math.round(value * 1e8) / 1e8; return Object.is(rounded, -0) ? 0 : rounded; };
  const number = (key, name, min, max, defaultValue, unit) => ({ key, name, type: 'number', min, max, defaultValue, unit, writable: true });
  const bool = (key, name, defaultValue) => ({ key, name, type: 'boolean', defaultValue, writable: true });
  const definition = {
    slug: 'bending-light',
    versions: ['1.2.7'],
    screens: [{
      id: 'intro', index: 0, name: 'Giới thiệu',
      properties: [
        number('angleDeg', 'Góc tới', 0, 80, 45, '°'),
        { key: 'upperMedium', name: 'M\u00f4i tr\u01b0\u1eddng tr\u00ean', type: 'string', values: ['air', 'water', 'glass'], defaultValue: 'air', writable: true },
        { key: 'lowerMedium', name: 'M\u00f4i tr\u01b0\u1eddng d\u01b0\u1edbi', type: 'string', values: ['air', 'water', 'glass'], defaultValue: 'water', writable: true },
        number('wavelengthNm', 'Bước sóng trong chân không', 380, 700, 650, 'nm'),
        bool('laserOn', 'Bật laser', false),
        bool('showNormal', 'Hiện pháp tuyến', true),
        bool('showAngles', 'Hiện góc', false),
        { key: 'n1', name: 'Chiết suất trên tại bước sóng hiện tại', type: 'number', writable: false },
        { key: 'n2', name: 'Chiết suất dưới tại bước sóng hiện tại', type: 'number', writable: false }
      ],
      actions: [{ id: 'observe', name: 'Bật laser và quan sát tia khúc xạ' }]
    }],
    bind(sim, screenId) {
      if (screenId !== 'intro') throw new Error('Unsupported Bending Light screen');
      const screen = (sim.simScreens || sim.screens).find(item => /introScreen$/.test(item.phetioID));
      const model = screen && screen.model;
      const namespace = window.phet && window.phet.bendingLight;
      if (!model || !model.laser || typeof model.laser.setAngle !== 'function' || !namespace?.Medium || !namespace?.Substance) {
        throw new Error('Pinned Bending Light model is unavailable');
      }
      const subscribe = (property, transform = value => value) => listener => {
        const linked = value => listener(transform(value));
        property.lazyLink(linked);
        return () => property.unlink(linked);
      };
      const substances = { air: namespace.Substance.AIR, water: namespace.Substance.WATER, glass: namespace.Substance.GLASS };
      const mediumName = medium => Object.keys(substances).find(key => substances[key] === medium.substance) || 'custom';
      const mediumBinding = property => ({
        get: () => mediumName(property.value),
        set: name => {
          const substance = substances[name];
          if (!substance) throw new Error('Unsupported material');
          property.value = new namespace.Medium(property.value.shape, substance, model.mediumColorFactory.getColor(substance.indexOfRefractionForRedLight));
        },
        subscribe: subscribe(property, mediumName)
      });
      const angle = () => round(degrees(model.laser.getAngle() - Math.PI / 2));
      const observe = () => {
        model.laser.onProperty.value = true;
        model.updateModel();
        const rays = Array.from(model.rays);
        const incident = rays.find(ray => ray.rayType === 'incident');
        const reflected = rays.find(ray => ray.rayType === 'reflected');
        const transmitted = rays.find(ray => ray.rayType === 'transmitted');
        const transmittedDirection = transmitted && transmitted.getUnitVector();
        return {
          angleDeg: angle(),
          n1: model.indexOfRefractionOfTopMediumProperty.value,
          n2: model.indexOfRefractionOfBottomMediumProperty.value,
          wavelengthNm: round(model.wavelengthProperty.value * 1e9),
          incidentPowerFraction: incident ? incident.powerFraction : 0,
          reflectedPowerFraction: reflected ? reflected.powerFraction : 0,
          transmittedPowerFraction: transmitted ? transmitted.powerFraction : 0,
          refractedAngleDeg: transmitted ? round(Math.abs(degrees(Math.atan2(transmittedDirection.x, -transmittedDirection.y)))) : null,
          totalInternalReflection: !transmitted && !!reflected && reflected.powerFraction > 0.999999,
          rayCount: rays.length
        };
      };
      return {
        properties: {
          angleDeg: {
            get: angle,
            set: value => {
              if (!Number.isFinite(value) || value < 0 || value > 80) throw new Error('Angle must be within [0, 80]');
              model.laser.setAngle(Math.PI / 2 + radians(value));
            },
            subscribe: listener => subscribe(model.laser.emissionPointProperty, angle)(listener)
          },
          upperMedium: mediumBinding(model.topMediumProperty),
          lowerMedium: mediumBinding(model.bottomMediumProperty),
          wavelengthNm: A.property(model.wavelengthProperty, { toPublic: value => round(value * 1e9), fromPublic: value => value * 1e-9 }),
          laserOn: A.property(model.laser.onProperty),
          showNormal: A.property(model.showNormalProperty),
          showAngles: A.property(model.showAnglesProperty),
          n1: { get: () => model.indexOfRefractionOfTopMediumProperty.value, subscribe: subscribe(model.indexOfRefractionOfTopMediumProperty) },
          n2: { get: () => model.indexOfRefractionOfBottomMediumProperty.value, subscribe: subscribe(model.indexOfRefractionOfBottomMediumProperty) }
        },
        actions: { observe },
        reset: () => model.reset()
      };
    }
  };
  A.register(definition);
}());

/* Physim-AI adapter for the unmodified PhET Build a Nucleus 1.1.12 HTML.
 * This registers model access verified in .qa/bridge-nucleus-test.mjs.
 * It does not use PhET-iO or bypass a licensed API.
 */
(function () {
  'use strict';
  const registry = window.PhysimAdapters;
  function screenSchema(id, index, name, maxProtons, maxNeutrons) {
    return {
      id, index, name,
      properties: [
        { key: 'protons', name: 'Số proton', type: 'number', unit: 'hạt', min: 0, max: maxProtons, integer: true, defaultValue: 0, writable: true },
        { key: 'neutrons', name: 'Số neutron', type: 'number', unit: 'hạt', min: 0, max: maxNeutrons, integer: true, defaultValue: 0, writable: true },
        { key: 'massNumber', name: 'Số khối', type: 'number', unit: 'hạt', min: 0, defaultValue: 0, writable: false },
        { key: 'isStable', name: 'Hạt nhân bền', type: 'boolean', defaultValue: false, writable: false },
        { key: 'nuclideExists', name: 'Đồng vị tồn tại', type: 'boolean', defaultValue: false, writable: false }
      ],
      actions: [
        { id: 'observe', name: 'Quan sát đồng vị hiện tại' },
        { id: 'add-neutron', name: 'Thêm một neutron và quan sát' }
      ]
    };
  }
  const screens = [
    screenSchema('decay', 0, 'Phân rã', 94, 146),
    screenSchema('chart', 1, 'Biểu đồ đồng vị', 10, 12)
  ];
  registry.register({
    slug: 'build-a-nucleus',
    versions: ['1.1.12'],
    screens,
    bind(sim, screenId) {
      const schema = screens.find(item => item.id === screenId);
      if (!schema) throw new Error('Unsupported Build a Nucleus screen');
      const screen = (sim.simScreens || sim.screens.filter(item => item.model && item.model.particleAtom))[schema.index];
      const model = screen && screen.model;
      if (!model || !model.particleAtom || typeof model.populateAtom !== 'function' || typeof model.reset !== 'function') {
        throw new Error('The pinned Build a Nucleus model is unavailable');
      }
      const atom = model.particleAtom;
      const read = () => ({
        protons: atom.protonCountProperty.value,
        neutrons: atom.neutronCountProperty.value,
        massNumber: atom.massNumberProperty.value,
        isStable: model.isStableProperty.value,
        nuclideExists: model.nuclideExistsProperty.value
      });
      function countBinding(key, property, max) {
        return {
          get: () => property.value,
          set(value) {
            if (!Number.isInteger(value) || value < 0 || value > max) throw new Error('Nucleon counts must be integers within the registered range');
            const protons = key === 'protons' ? value : atom.protonCountProperty.value;
            const neutrons = key === 'neutrons' ? value : atom.neutronCountProperty.value;
            // populateAtom creates real model particles through addParticle and updates
            // both the visible nucleus and PhET's derived properties. Directly writing
            // countProperty would leave the particle model inconsistent.
            model.reset();
            model.populateAtom(protons, neutrons);
          },
          subscribe(listener) {
            property.lazyLink(listener);
            return () => property.unlink(listener);
          }
        };
      }
      const proton = countBinding('protons', atom.protonCountProperty, schema.properties[0].max);
      const neutron = countBinding('neutrons', atom.neutronCountProperty, schema.properties[1].max);
      return {
        properties: {
          protons: proton,
          neutrons: neutron,
          massNumber: registry.property(atom.massNumberProperty),
          isStable: registry.property(model.isStableProperty),
          nuclideExists: registry.property(model.nuclideExistsProperty)
        },
        actions: {
          observe: async () => read(),
          'add-neutron': async () => {
            if (neutron.get() >= schema.properties[1].max) throw new Error('The neutron limit has been reached');
            neutron.set(neutron.get() + 1);
            return read();
          }
        },
        reset() {
          model.reset();
          if (screen.view && typeof screen.view.reset === 'function') screen.view.reset();
        }
      };
    }
  });
})();
