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
