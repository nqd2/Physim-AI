(() => {
  'use strict';

  const entry = JSON.parse(document.getElementById('physim-catalog-entry').textContent);
  const parameters = new URLSearchParams(location.search);
  const channel = parameters.get('physimChannel');
  if (!channel || channel.length > 160) return;

  const parentOrigin = allowedParentOrigin(parameters.get('physimParent'));
  const screenIds = [];
  let sim;
  let runtimeScreens = [];
  let screenId = '';
  let bindings;
  let unsubscribers = [];
  let stopped = false;
  let ready = false;
  let telemetryTimer;
  let previousSnapshot = '';
  let queue = Promise.resolve();

  function allowedParentOrigin(value) {
    if (!value) return null;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && url.origin === value ? value : null;
    } catch {
      return null;
    }
  }

  function send(type, payload, requestId = '') {
    if (stopped) return;
    const message = JSON.stringify({ version: 1, channel, requestId, type, payload });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
    else if (parentOrigin && window.parent !== window) window.parent.postMessage(message, parentOrigin);
  }

  function property(source, transform = value => value, inverse) {
    if (!source) throw new Error('Thiếu thuộc tính trong mô phỏng.');
    return {
      get: () => transform(source.value),
      set: value => { source.value = inverse ? inverse(value) : value; },
      watch: [source],
    };
  }

  function derived(get, ...watch) {
    return { get, watch };
  }

  function experiment(method, receiver, ...args) {
    if (typeof method !== 'function') throw new Error('Thiếu thao tác trong mô phỏng.');
    return () => method.apply(receiver, args);
  }

  const radians = degrees => degrees * Math.PI / 180;
  const degrees = radiansValue => radiansValue * 180 / Math.PI;

  function bindGuided(model) {
    switch (entry.slug) {
      case 'projectile-motion':
        return {
          values: {
            speed: property(model.launchVelocityProperty),
            angle: property(model.cannonAngleProperty),
            height: property(model.cannonHeightProperty),
            airResistance: property(model.airResistanceOnProperty),
            movingProjectiles: property(model.numberOfMovingProjectilesProperty),
          },
          actions: {
            launch: () => {
              if (model.fireEnabledProperty.value) model.cannonFired();
            },
          },
        };
      case 'gas-properties': {
        const pressure = model.pressureModel;
        const particleCount = model.particleSystem.numberOfHeavyParticlesProperty;
        return {
          values: {
            particleCount: property(particleCount, value => value, Math.round),
            pressure: derived(() => pressure.computePressure(), pressure.pressureKilopascalsProperty,
              pressure.temperatureProperty, pressure.volumeProperty, pressure.numberOfParticlesProperty),
          },
          actions: { advance: experiment(model.stepModelTime, model, 0.1) },
        };
      }
      case 'ohms-law':
        return {
          values: {
            voltage: property(model.voltageProperty),
            resistance: property(model.resistanceProperty),
            current: model.currentProperty ? property(model.currentProperty) : derived(() =>
              1000 * model.voltageProperty.value / model.resistanceProperty.value, model.voltageProperty, model.resistanceProperty),
          },
          actions: { measure: () => {} }, // Current is an instantaneous derived PhET Property.
        };
      case 'wave-on-a-string':
        return {
          values: {
            amplitude: property(model.amplitudeProperty),
            frequency: property(model.frequencyProperty),
            displacement: property(model.leftMostBeadYProperty),
          },
          actions: {
            oscillate: () => {
              const mode = model.waveModeProperty;
              const oscillator = mode.validValues.find(value => value.name === 'OSCILLATE');
              if (!oscillator) throw new Error('Thiếu chế độ dao động.');
              mode.value = oscillator;
              model.isPlayingProperty.value = true;
            },
          },
        };
      case 'bending-light': {
        const laser = model.laser;
        const angle = {
          get: () => degrees(laser.getAngle() - Math.PI / 2),
          set: value => laser.setAngle(Math.PI / 2 + radians(value)),
          watch: [laser.emissionPointProperty, laser.pivotProperty],
        };
        const top = model.indexOfRefractionOfTopMediumProperty;
        const bottom = model.indexOfRefractionOfBottomMediumProperty;
        const refraction = () => {
          if (!laser.onProperty.value) return undefined;
          const sine = top.value * Math.sin(radians(angle.get())) / bottom.value;
          return Math.abs(sine) <= 1 ? degrees(Math.asin(sine)) : undefined;
        };
        return {
          values: {
            angle,
            incidentIndex: property(top),
            transmittedIndex: property(bottom),
            refractionAngle: derived(refraction, ...angle.watch, top, bottom, laser.onProperty),
            laserOn: property(laser.onProperty),
          },
          actions: { illuminate: () => { laser.onProperty.value = true; } },
        };
      }
      case 'build-a-nucleus': {
        const atom = model.particleAtom;
        const setCounts = ({ protons = atom.protonCountProperty.value, neutrons = atom.neutronCountProperty.value }) => {
          model.reset();
          model.populateAtom(Math.round(protons), Math.round(neutrons));
        };
        return {
          values: {
            protons: { ...property(atom.protonCountProperty), set: undefined },
            neutrons: { ...property(atom.neutronCountProperty), set: undefined },
            massNumber: property(atom.massNumberProperty),
            stable: property(model.isStableProperty),
          },
          actions: { observe: experiment(model.step, model, 0) },
          apply: setCounts,
        };
      }
      default:
        return undefined;
    }
  }

  function selectedScreen() {
    if (sim.selectedScreenProperty) return sim.selectedScreenProperty.value;
    if (sim.getSelectedScreen) return sim.getSelectedScreen();
    if (sim.currentScreenProperty?.value?.model) return sim.currentScreenProperty.value;
    return runtimeScreens[sim.screenIndexProperty?.value ?? 0];
  }

  function selectScreen(id) {
    const index = screenIds.indexOf(id);
    if (index < 0) throw fault('INVALID_SCREEN', 'Mô phỏng không có màn hình này.');
    const screen = runtimeScreens[index];
    if (sim.selectedScreenProperty) {
      sim.selectedScreenProperty.value = screen;
    } else if (sim.screenIndexProperty) {
      sim.screenIndexProperty.value = index;
      if (sim.showHomeScreenProperty) sim.showHomeScreenProperty.value = false;
    } else if (selectedScreen() !== screen) {
      throw fault('UNSUPPORTED', 'Không thể chuyển màn hình từ phòng học.');
    }
    updateScreen();
  }

  function state() {
    const values = {};
    for (const [key, binding] of Object.entries(bindings?.values ?? {})) {
      const value = binding.get();
      if (typeof value === 'number' && Number.isFinite(value) ||
        typeof value === 'boolean' || typeof value === 'string') values[key] = value;
    }
    return { screenId, values };
  }

  function scheduleTelemetry() {
    if (!ready || telemetryTimer !== undefined || stopped) return;
    telemetryTimer = setTimeout(() => {
      telemetryTimer = undefined;
      const current = state();
      const key = JSON.stringify(current);
      if (key !== previousSnapshot) {
        previousSnapshot = key;
        send('PROPERTY_CHANGED', current);
      }
    }, 80);
  }

  function attach(source, callback) {
    if (typeof source?.lazyLink !== 'function' || typeof source?.unlink !== 'function') return null;
    source.lazyLink(callback);
    return () => source.unlink(callback);
  }

  function updateScreen() {
    const screen = selectedScreen();
    const id = screenIds[runtimeScreens.indexOf(screen)] ?? '';
    if (screenId === id) return;
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    screenId = id;
    bindings = entry.bridgeMode === 'guided' && id === 'main' ? bindGuided(screen.model) : undefined;
    const sources = new Set(Object.values(bindings?.values ?? {}).flatMap(binding => binding.watch));
    for (const source of sources) {
      const unsubscribe = attach(source, scheduleTelemetry);
      if (unsubscribe) unsubscribers.push(unsubscribe);
    }
    scheduleTelemetry();
  }

  function fault(code, message) {
    return Object.assign(new Error(message), { code });
  }

  function allowedValue(spec, value) {
    if (spec.kind === 'number') return typeof value === 'number' && Number.isFinite(value)
      && (!spec.range || (value >= spec.range[0] && value <= spec.range[1]));
    if (spec.kind === 'boolean') return typeof value === 'boolean';
    if (spec.kind === 'enum') return typeof value === 'string' && spec.choices.includes(value);
    return value !== null && typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y);
  }

  function applyConfig(payload) {
    if (entry.bridgeMode !== 'guided') throw fault('UNSUPPORTED', 'Mô phỏng này dùng điều khiển trực tiếp.');
    const screen = entry.screens.find(item => item.id === payload?.screenId);
    if (!screen || !screenIds.includes(screen.id)) throw fault('INVALID_SCREEN', 'Cấu hình dùng màn hình không tồn tại.');
    if (screen.id !== 'main') throw fault('UNSUPPORTED', 'Màn hình này dùng điều khiển trực tiếp.');
    if (!payload.values || typeof payload.values !== 'object' || Array.isArray(payload.values)) {
      throw fault('INVALID_VALUE', 'Cấu hình thiếu đại lượng.');
    }
    const values = Object.entries(payload.values);
    for (const [name, value] of values) {
      const spec = screen.properties.find(item => item.id === name && item.writable);
      if (!spec || !allowedValue(spec, value)) {
        throw fault('INVALID_VALUE', 'Cấu hình chứa đại lượng hoặc giá trị không hợp lệ.');
      }
    }
    if (!values.length) return;
    selectScreen(screen.id);
    const before = state().values;
    const assign = current => {
      if (bindings.apply) bindings.apply(current);
      else for (const [name, value] of Object.entries(current)) bindings.values[name].set(value);
    };
    try {
      assign(payload.values);
    } catch (error) {
      try { assign(Object.fromEntries(values.map(([name]) => [name, before[name]]))); } catch { /* Report the original write error. */ }
      throw error;
    }
  }

  function handle({ type, payload }) {
    if (!ready) throw fault('NOT_READY', 'Mô phỏng đang khởi động.');
    switch (type) {
      case 'GET_STATE':
        break;
      case 'SWITCH_SCREEN':
        selectScreen(payload?.screenId);
        break;
      case 'APPLY_CONFIG':
        applyConfig(payload);
        break;
      case 'RUN_EXPERIMENT': {
        const action = bindings?.actions[payload?.actionId];
        if (typeof action !== 'function' || !Object.hasOwn(bindings.actions, payload.actionId)) {
          throw fault('UNSUPPORTED', 'Thao tác chưa được hỗ trợ trên màn hình này.');
        }
        action();
        break;
      }
      case 'RESET_SIM': {
        if (!bindings) throw fault('UNSUPPORTED', 'Hãy đặt lại bằng nút trong PhET.');
        const screen = selectedScreen();
        if (typeof screen.view?.resetAllButton?.listener === 'function') screen.view.resetAllButton.listener();
        else if (typeof screen.model?.reset === 'function') screen.model.reset();
        else throw fault('UNSUPPORTED', 'Hãy đặt lại bằng nút trong PhET.');
        break;
      }
      default:
        throw fault('UNKNOWN_COMMAND', 'Lệnh không được hỗ trợ.');
    }
    scheduleTelemetry();
  }

  function receive(value) {
    let message;
    try {
      message = typeof value === 'string' && value.length < 16_384 ? JSON.parse(value) : value;
    } catch {
      return;
    }
    if (message?.version !== 1 || message.channel !== channel ||
      typeof message.requestId !== 'string' || !message.requestId || message.requestId.length > 160) return;
    queue = queue.then(() => {
      if (stopped) return;
      try {
        handle(message);
        send('ACK', state(), message.requestId);
      } catch (error) {
        send('ERROR', { code: error.code ?? 'SIMULATION_ERROR', message: error.message ?? 'Thao tác không thành công.' }, message.requestId);
      }
    });
    return queue;
  }

  window.physimBridge = Object.freeze({ receive });
  window.addEventListener('message', event => {
    if (parentOrigin && event.source === window.parent && event.origin === parentOrigin) receive(event.data);
  });

  function initialize() {
    sim = window.phet?.joist?.sim;
    runtimeScreens = sim?.simScreens ?? sim?.screens?.filter(screen => screen !== sim.homeScreen) ?? [];
    if (!runtimeScreens.length || !runtimeScreens.every(screen => screen.model) ||
      sim.isConstructionCompleteProperty?.value === false) return false;

    for (let index = 0; index < runtimeScreens.length; index++) {
      screenIds.push(entry.screens[index]?.id ?? `screen-${index + 1}`);
    }
    const stopSelectionObservers = [
      attach(sim.selectedScreenProperty, updateScreen),
      attach(sim.screenIndexProperty, updateScreen),
      attach(sim.showHomeScreenProperty, updateScreen),
    ].filter(Boolean);
    if (entry.bridgeMode === 'guided' && selectedScreen() !== runtimeScreens[0]) selectScreen('main');
    else updateScreen();
    ready = true;
    if (bindings) previousSnapshot = JSON.stringify(state());
    send('READY', { screenId, screenIds });
    if (bindings) send('PROPERTY_CHANGED', state());
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      stopped = true;
      clearTimeout(telemetryTimer);
      for (const unsubscribe of [...stopSelectionObservers, ...unsubscribers]) unsubscribe();
    }, { once: false });
    return true;
  }

  function waitForSim(retries = 300) {
    try {
      if (initialize()) return;
    } catch {
      send('ERROR', { code: 'INITIALIZATION_FAILED', message: 'Không kết nối được với phiên bản mô phỏng này.' });
      return;
    }
    if (retries) setTimeout(() => waitForSim(retries - 1), 100);
    else send('ERROR', { code: 'STARTUP_TIMEOUT', message: 'Mô phỏng chưa khởi động. Hãy tải lại.' });
  }

  waitForSim();
})();
