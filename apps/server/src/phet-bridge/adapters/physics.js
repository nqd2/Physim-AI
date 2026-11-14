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
