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
