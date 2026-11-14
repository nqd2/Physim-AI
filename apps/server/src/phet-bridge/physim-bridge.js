/* Physim-AI bridge v1: separately injected into an unmodified PhET HTML bundle. */
(function (global) {
  'use strict';
  if (global.physimBridge) return;
  const PROTOCOL = 'physim-bridge', VERSION = 1;
  const meta = global.__PHYSIM_SIM__ || {};
  const query = new URLSearchParams(global.location.search);
  const loadId = query.get('physimLoadId') || '';
  const native = query.get('physimNative') === '1' && !!global.ReactNativeWebView;
  let parentOrigin = query.get('physimParentOrigin') || '';
  try { if (!/^https?:$/.test(new URL(parentOrigin).protocol) || new URL(parentOrigin).origin !== parentOrigin) parentOrigin = ''; } catch (_) { parentOrigin = ''; }
  const configured = /^[a-zA-Z0-9_-]{16,128}$/.test(loadId) && (native || !!parentOrigin);
  let simulation, adapter, schema, currentBindings, currentId;
  let disposed = false, initialized = false, telemetryTimer, queue = Promise.resolve();
  let propertyUnlinks = [], screenUnlink = null;
  const pendingChanges = {};
  const commands = new Set(['INIT', 'APPLY_CONFIG', 'RUN_EXPERIMENT', 'SWITCH_SCREEN', 'RESET_SIM', 'GET_STATE']);
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const safeName = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value);
  const finiteValue = value => ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
  const simScreens = () => simulation.simScreens || simulation.screens;

  function send(type, payload, requestId) {
    if (!configured || !initialized || disposed) return;
    const message = { protocol: PROTOCOL, version: VERSION, loadId, type, payload };
    if (requestId) message.requestId = requestId;
    if (native) global.ReactNativeWebView.postMessage(JSON.stringify(message));
    else global.parent.postMessage(message, parentOrigin);
  }
  function screenIndex() {
    const selected = simulation.currentScreenProperty?.value || simulation.selectedScreenProperty?.value;
    const index = simScreens().indexOf(selected);
    return index >= 0 ? index : selected ? -1 : simulation.screenIndexProperty?.value ?? 0;
  }
  function screenDefinition(id) { return schema.screens.find(screen => screen.id === id); }
  function actualScreenId() {
    const index = screenIndex();
    return adapter?.screens.find(screen => screen.index === index)?.id || `screen-${index}`;
  }
  function cleanupProperties() {
    propertyUnlinks.forEach(unlink => { try { unlink(); } catch (_) { /* disposed PhET property */ } });
    propertyUnlinks = [];
    clearTimeout(telemetryTimer);
    telemetryTimer = null;
    for (const key of Object.keys(pendingChanges)) delete pendingChanges[key];
  }
  function bindingsFor(id) {
    if (!adapter || !adapter.screens.some(screen => screen.id === id)) return null;
    return adapter.bind(simulation, id);
  }
  function bindCurrent() {
    cleanupProperties();
    currentId = actualScreenId();
    currentBindings = bindingsFor(currentId);
    const definition = screenDefinition(currentId);
    if (!currentBindings || !definition) return;
    for (const spec of definition.properties) {
      const binding = currentBindings.properties[spec.key];
      if (!binding || typeof binding.subscribe !== 'function') continue;
      propertyUnlinks.push(binding.subscribe(value => {
        if (!finiteValue(value) && !(value === null && spec.nullable)) return;
        pendingChanges[spec.key] = value;
        if (!telemetryTimer) telemetryTimer = setTimeout(() => {
          telemetryTimer = null;
          const values = { ...pendingChanges };
          for (const key of Object.keys(pendingChanges)) delete pendingChanges[key];
          send('PROPERTY_CHANGED', { screenId: currentId, values });
        }, 100);
      }));
    }
  }
  function state() {
    if (currentId !== actualScreenId()) bindCurrent();
    const values = {};
    const definition = screenDefinition(currentId);
    if (definition && currentBindings) for (const spec of definition.properties) {
      const binding = currentBindings.properties[spec.key];
      if (!binding || typeof binding.get !== 'function') continue;
      const value = binding.get();
      if (finiteValue(value) || (value === null && spec.nullable)) values[spec.key] = value;
    }
    return { slug: meta.slug, version: meta.version, screenId: currentId, values };
  }
  function capabilities() {
    const bound = !!currentBindings;
    const definition = screenDefinition(currentId);
    return {
      applyConfig: bound && !!definition?.properties.some(p => p.writable),
      runExperiment: bound && !!definition?.actions.length,
      switchScreen: !!adapter && (schema.screens.length > 1 || !bound),
      resetSim: bound && typeof currentBindings.reset === 'function',
      getState: true,
      telemetry: bound
    };
  }
  function readyMessage(requestId) { send('READY', { ...state(), capabilities: capabilities(), schema }, requestId); }
  function selectScreen(id) {
    const definition = adapter?.screens.find(screen => screen.id === id);
    if (!definition) throw fail('UNSUPPORTED', 'Màn hình này chưa có adapter đã kiểm chứng.');
    if (simulation.screenIndexProperty) simulation.screenIndexProperty.value = definition.index;
    else if (simulation.selectedScreenProperty) simulation.selectedScreenProperty.value = simScreens()[definition.index];
    else if (screenIndex() !== definition.index) throw fail('UNSUPPORTED', 'Phiên bản mô phỏng này không hỗ trợ đổi màn hình.');
    if (simulation.showHomeScreenProperty) simulation.showHomeScreenProperty.value = false;
    bindCurrent();
  }
  function validateConfig(config) {
    if (!record(config) || !record(config.values) || !safeName(config.screenId)) throw fail('INVALID_CONFIG', 'Cấu hình mô phỏng không hợp lệ.');
    if (config.slug !== undefined && config.slug !== meta.slug) throw fail('INVALID_CONFIG', 'Cấu hình thuộc mô phỏng khác.');
    if (config.version !== undefined && config.version !== meta.version) throw fail('VERSION_MISMATCH', 'Cấu hình không khớp phiên bản mô phỏng.');
    const definition = screenDefinition(config.screenId);
    if (!adapter || !definition) throw fail('UNSUPPORTED', 'Mô phỏng này chưa có adapter đã kiểm chứng.');
    const keys = Object.keys(config.values);
    if (keys.length > 64) throw fail('INVALID_CONFIG', 'Cấu hình có quá nhiều thuộc tính.');
    for (const key of keys) {
      const spec = definition.properties.find(p => p.key === key);
      const value = config.values[key];
      if (!spec || !spec.writable || ['__proto__', 'constructor', 'prototype'].includes(key)) throw fail('INVALID_CONFIG', `Không được thay đổi thuộc tính ${key}.`);
      if (typeof value !== spec.type || !finiteValue(value)) throw fail('INVALID_CONFIG', `Sai kiểu dữ liệu của ${key}.`);
      if (typeof value === 'number' && ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max))) throw fail('INVALID_CONFIG', `${key} nằm ngoài khoảng cho phép.`);
      if (spec.integer && !Number.isInteger(value)) throw fail('INVALID_CONFIG', `${key} phải là số nguyên.`);
      if (spec.values && !spec.values.includes(value)) throw fail('INVALID_CONFIG', `${key} không thuộc tập giá trị cho phép.`);
    }
    return definition;
  }
  function apply(config) {
    validateConfig(config); // Validate every value before switching screens or writing anything.
    const oldId = currentId;
    selectScreen(config.screenId);
    const binding = currentBindings;
    const before = {};
    for (const key of Object.keys(config.values)) {
      if (!binding?.properties[key]?.set) throw fail('UNSUPPORTED', 'Thuộc tính chưa sẵn sàng.');
      before[key] = binding.properties[key].get();
    }
    try {
      for (const [key, value] of Object.entries(config.values)) binding.properties[key].set(value);
    } catch (_) {
      for (const [key, value] of Object.entries(before).reverse()) { try { binding.properties[key].set(value); } catch (_) { /* preserve best effort recovery */ } }
      if (oldId !== currentId && adapter.screens.some(s => s.id === oldId)) selectScreen(oldId);
      throw fail('APPLY_FAILED', 'Không áp dụng được cấu hình; các giá trị cũ đã được khôi phục nếu có thể.');
    }
    return state();
  }
  async function process(message) {
    if (disposed) return;
    if (message.type === 'INIT') initialized = true;
    try {
      await ready;
      if (message.type === 'INIT') { readyMessage(message.requestId); return; }
      if (!initialized) return;
      let payload;
      if (message.type === 'GET_STATE') payload = state();
      else if (message.type === 'APPLY_CONFIG') payload = apply(message.payload);
      else if (message.type === 'SWITCH_SCREEN') { selectScreen(message.payload.screenId); payload = state(); readyMessage(); }
      else if (message.type === 'RESET_SIM') {
        if (!currentBindings?.reset) throw fail('UNSUPPORTED', 'Màn hình này chưa hỗ trợ đặt lại từ app.');
        await currentBindings.reset(); payload = state();
      } else if (message.type === 'RUN_EXPERIMENT') {
        const action = message.payload.action;
        const definition = screenDefinition(currentId);
        if (!safeName(action) || !definition?.actions.some(item => item.id === action) || !currentBindings?.actions[action]) throw fail('UNSUPPORTED', 'Thao tác chưa được đăng ký cho màn hình hiện hành.');
        const args = message.payload.args || {};
        if (!record(args) || Object.keys(args).length > 0) throw fail('INVALID_CONFIG', 'Thao tác này không nhận tham số; hãy áp dụng cấu hình trước.');
        const measurement = await currentBindings.actions[action](args);
        payload = { state: state(), measurement };
      }
      send('RESULT', payload, message.requestId);
    } catch (error) { send('ERROR', { code: error.code || 'SIMULATION_ERROR', message: error.code ? error.message : 'Mô phỏng không thực hiện được yêu cầu. Hãy đặt lại và thử lại.' }, message.requestId); }
  }
  function accept(raw) {
    let message;
    try { message = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { return false; }
    if (!configured || disposed || !record(message) || message.protocol !== PROTOCOL || message.version !== VERSION || message.loadId !== loadId || !safeName(message.requestId) || !commands.has(message.type) || !record(message.payload)) return false;
    queue = queue.then(() => process(message)).catch(() => {});
    return true;
  }
  const onMessage = event => { if (!native && event.source === global.parent && event.origin === parentOrigin) accept(event.data); };
  global.addEventListener('message', onMessage);
  let poll;
  const ready = new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (disposed) { clearInterval(poll); reject(fail('DISPOSED', 'Mô phỏng đã đóng.')); return; }
      if (Date.now() - started > 45000) { clearInterval(poll); reject(fail('SIM_TIMEOUT', 'Mô phỏng tải quá lâu. Hãy thử lại.')); return; }
      const sim = global.phet?.joist?.sim;
      if (!(sim?.simScreens || sim?.screens)?.length) {
        return;
      }
      if (sim.isConstructionCompleteProperty && !sim.isConstructionCompleteProperty.value) return;
      try {
        simulation = sim;
        adapter = meta.adapterVerified === true && String(sim.version) === meta.version ? global.PhysimAdapters?.find(meta.slug, meta.version) : null;
        schema = { slug: meta.slug, version: meta.version, adapterVerified: !!adapter, screens: adapter ? adapter.screens.map(({ index, ...screen }) => screen) : simScreens().map((screen, index) => ({ id: `screen-${index}`, name: screen.nameProperty?.value || screen.name || `Màn hình ${index + 1}`, properties: [], actions: [] })) };
        if (adapter) selectScreen(adapter.screens[0].id);
        else bindCurrent();
        const selection = sim.currentScreenProperty || sim.selectedScreenProperty || sim.screenIndexProperty;
        if (selection?.lazyLink) {
          const listener = () => { bindCurrent(); readyMessage(); };
          selection.lazyLink(listener); screenUnlink = () => selection.unlink(listener);
        }
        clearInterval(poll); resolve(schema);
      } catch (_) { /* A screen model may still be initializing; retry without exposing write capabilities. */ }
    };
    poll = setInterval(check, 50); check();
  });
  ready.catch(() => {});
  function dispose() {
    if (disposed) return;
    disposed = true; clearInterval(poll); cleanupProperties();
    if (screenUnlink) screenUnlink();
    global.removeEventListener('message', onMessage);
    global.removeEventListener('pagehide', dispose);
  }
  global.addEventListener('pagehide', dispose);
  global.physimBridge = Object.freeze({ protocol: PROTOCOL, version: VERSION, ready, dispose,
    receive(raw, nonce) { return native && nonce === loadId ? accept(raw) : false; }
  });
})(window);
