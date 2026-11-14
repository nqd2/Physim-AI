const number = (id, label, defaultValue, range, unit) => ({ id, label, kind: 'number', writable: true, defaultValue, range, unit });
const reading = (id, label, unit) => ({ id, label, kind: 'number', writable: false, unit });
const flag = (id, label, defaultValue, writable = true) => ({ id, label, kind: 'boolean', writable, defaultValue });

function main(title, properties, actionId, actionLabel) {
  return { id: 'main', title, properties, actions: [{ id: actionId, label: actionLabel }] };
}

// These are the published builds whose model bindings are exercised by phet-smoke.mjs.
export const guided = {
  'projectile-motion': {
    version: '1.0.36',
    screen: main('Giới thiệu', [
      number('speed', 'Tốc độ ban đầu', 15, [0, 30], 'm/s'),
      number('angle', 'Góc phóng', 0, [-90, 90], '°'),
      number('height', 'Độ cao ban đầu', 10, [0, 15], 'm'),
      flag('airResistance', 'Sức cản không khí', false),
      reading('movingProjectiles', 'Vật đang chuyển động'),
    ], 'launch', 'Phóng vật'),
    smoke: { values: { speed: 15, angle: 45, height: 0, airResistance: false }, reading: 'movingProjectiles', passes: value => value === 1 },
  },
  'gas-properties': {
    version: '1.1.12',
    screen: main('Khí lý tưởng', [
      number('particleCount', 'Số hạt nặng', 0, [0, 1000]),
      reading('pressure', 'Áp suất', 'kPa'),
    ], 'advance', 'Đo áp suất'),
    smoke: { values: { particleCount: 50 }, reading: 'pressure', passes: value => value > 0 },
  },
  'ohms-law': {
    version: '1.4.33',
    screen: main('Định luật Ohm', [
      number('voltage', 'Hiệu điện thế', 4.5, [0.1, 9], 'V'),
      number('resistance', 'Điện trở', 500, [10, 1000], 'Ω'),
      reading('current', 'Cường độ dòng điện', 'mA'),
    ], 'measure', 'Đo dòng điện'),
    smoke: { values: { voltage: 3, resistance: 300 }, reading: 'current', passes: value => Math.abs(value - 10) < 0.01 },
  },
  'wave-on-a-string': {
    version: '1.2.6',
    screen: main('Sóng trên dây', [
      number('amplitude', 'Biên độ', 0.75, [0, 1.3], 'cm'),
      number('frequency', 'Tần số', 1.5, [0, 3], 'Hz'),
      reading('displacement', 'Li độ đầu dây', 'cm'),
    ], 'oscillate', 'Tạo dao động'),
    smoke: { values: { amplitude: 0.5, frequency: 1 }, reading: 'displacement', passes: value => typeof value === 'number' },
  },
  'bending-light': {
    version: '1.2.7',
    screen: main('Giới thiệu', [
      number('angle', 'Góc tới', 45, [0, 85], '°'),
      reading('incidentIndex', 'Chiết suất môi trường tới'),
      reading('transmittedIndex', 'Chiết suất môi trường khúc xạ'),
      reading('refractionAngle', 'Góc khúc xạ', '°'),
      flag('laserOn', 'Nguồn sáng đang bật', false, false),
    ], 'illuminate', 'Bật tia sáng'),
    smoke: { values: { angle: 30 }, reading: 'laserOn', passes: value => value === true },
  },
  'build-a-nucleus': {
    version: '1.1.12',
    screen: main('Phân rã', [
      number('protons', 'Số proton', 0, [0, 94]),
      number('neutrons', 'Số neutron', 0, [0, 146]),
      reading('massNumber', 'Số khối'),
      flag('stable', 'Hạt nhân bền', false, false),
    ], 'observe', 'Quan sát hạt nhân'),
    smoke: { values: { protons: 6, neutrons: 8 }, reading: 'massNumber', passes: value => value === 14 },
  },
};
