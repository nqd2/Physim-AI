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
