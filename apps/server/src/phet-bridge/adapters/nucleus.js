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
