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
