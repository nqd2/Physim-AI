import type { ChapterId, SimulationConfig } from './simulation.ts';

export interface Prediction {
  question: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  explanation: string;
}

/** Authored sample content; measured values always come separately from PhET. */
export interface SampleLesson {
  id: string;
  slug: string;
  title: string;
  chapter: ChapterId;
  level: string;
  description: string;
  problem: string;
  objective: string;
  config: SimulationConfig;
  experiment: { action: string; args?: Record<string, string | number | boolean> };
  prediction: Prediction;
  hints: string[];
  causalLinks: Array<{ id: string; text: string }>;
  teachBackPrompt: string;
  variant: {
    problem: string;
    changedCondition: string;
    config: SimulationConfig;
    prediction: Prediction;
  };
  review: { question: string; answer: string };
}

const config = (slug: string, screenId: string, values: SimulationConfig['values']): SimulationConfig => ({ slug, screenId, values });
const projectile = { speed: 20, angle: 40, height: 2, airResistance: false };
const gas = { injectionTemperatureK: 300, heavyParticles: 150, lightParticles: 0, widthNm: 10, holdConstant: 'temperature' };
const wave = { frequency: 1.5, amplitude: 0.75, tension: 0.8, damping: 0.2, waveMode: 'OSCILLATE', stringEndType: 'NO_END', isPlaying: false };
const optics = { angleDeg: 45, upperMedium: 'air', lowerMedium: 'glass', wavelengthNm: 650, laserOn: true, showNormal: true, showAngles: true };

export const SAMPLE_LESSONS: SampleLesson[] = [
  {
    id: 'ohm-current', slug: 'ohms-law', title: 'Dòng điện thay đổi thế nào?', chapter: 'electricity', level: 'Cơ bản',
    description: 'Giữ điện trở không đổi, dự đoán và đo cường độ dòng điện.',
    problem: 'Đặt hiệu điện thế 4,5 V vào điện trở 500 Ω. Cường độ dòng điện qua điện trở bằng bao nhiêu miliampe?',
    objective: 'Dùng I = U/R và phân biệt đơn vị A với mA.',
    config: config('ohms-law', 'main', { voltage: 4.5, resistance: 500 }),
    experiment: { action: 'observe' },
    prediction: {
      question: 'Bạn dự đoán ampe kế chỉ bao nhiêu?',
      options: [{ id: 'a', text: '0,009 mA' }, { id: 'b', text: '9 mA' }, { id: 'c', text: '900 mA' }],
      correctOptionId: 'b', explanation: 'I = 4,5/500 = 0,009 A = 9 mA. Chia U cho R trước, rồi đổi ampe sang miliampe.',
    },
    hints: [
      'Ghi riêng U = 4,5 V và R = 500 Ω. Đại lượng cần tìm là I.',
      'Với điện trở tuân theo định luật Ohm, I = U/R. Kết quả phép chia có đơn vị ampe.',
      '1 A = 1 000 mA. So sánh số đo của mô phỏng với phép tính sau khi đổi đơn vị.',
    ],
    causalLinks: [
      { id: 'resistance', text: 'Giữ điện trở R không đổi.' },
      { id: 'voltage', text: 'Tăng hiệu điện thế U đặt vào điện trở.' },
      { id: 'ratio', text: 'Tỉ số U/R tăng cùng tỉ lệ với U.' },
      { id: 'current', text: 'Vì I = U/R, cường độ dòng điện tăng.' },
    ],
    teachBackPrompt: 'Vì sao tăng gấp đôi hiệu điện thế làm dòng điện tăng gấp đôi khi điện trở không đổi? Nêu điều kiện cần giữ nguyên.',
    variant: {
      problem: 'Giữ R = 500 Ω và chỉ tăng U từ 4,5 V lên 9 V. Cường độ dòng điện mới bằng bao nhiêu?',
      changedCondition: 'Hiệu điện thế tăng từ 4,5 V lên 9 V.',
      config: config('ohms-law', 'main', { voltage: 9, resistance: 500 }),
      prediction: {
        question: 'Dòng điện mới sẽ là…',
        options: [{ id: 'a', text: '4,5 mA' }, { id: 'b', text: '9 mA' }, { id: 'c', text: '18 mA' }],
        correctOptionId: 'c', explanation: 'I = 9/500 = 0,018 A = 18 mA. U tăng hai lần còn R giữ nguyên nên I tăng hai lần.',
      },
    },
    review: { question: 'Khi giữ R không đổi và tăng U gấp đôi, I thay đổi thế nào? Vì sao?', answer: 'I tăng gấp đôi vì I = U/R. Kết luận cần điều kiện R không thay đổi.' },
  },
  {
    id: 'projectile-height', slug: 'projectile-motion', title: 'Bệ phóng cao hơn, vật bay xa hơn?', chapter: 'mechanics', level: 'Cơ bản',
    description: 'Tách chuyển động ngang và thẳng đứng để hiểu tầm xa.',
    problem: 'Phóng một vật từ độ cao 2 m với tốc độ 20 m/s, góc 40°. Bỏ qua lực cản không khí. So với phóng từ mặt đất với cùng tốc độ và góc, vật sẽ rơi xa hơn hay gần hơn?',
    objective: 'Liên hệ độ cao ban đầu, thời gian bay và tầm xa khi tốc độ ngang không đổi.',
    config: config('projectile-motion', 'intro', projectile),
    experiment: { action: 'fire' },
    prediction: {
      question: 'Nâng bệ từ 0 m lên 2 m, còn mọi điều kiện khác giữ nguyên, tầm xa sẽ…',
      options: [{ id: 'a', text: 'Tăng' }, { id: 'b', text: 'Giảm' }, { id: 'c', text: 'Không đổi' }],
      correctOptionId: 'a', explanation: 'Bệ cao hơn làm thời gian tới mặt đất dài hơn. Khi không có lực cản, tốc độ ngang vẫn là v₀ cos α nên tầm xa tăng.',
    },
    hints: [
      'Phân tích vận tốc ban đầu thành vₓ = v₀ cos α và vᵧ = v₀ sin α.',
      'Trong mô hình không có lực cản, trọng lực chỉ làm biến đổi thành phần vận tốc thẳng đứng.',
      'Viết y(t) = h + vᵧt − gt²/2. Tìm lúc y = 0 rồi liên hệ tầm xa với x = vₓt.',
    ],
    causalLinks: [
      { id: 'height', text: 'Độ cao ban đầu tăng, còn tốc độ và góc phóng giữ nguyên.' },
      { id: 'time', text: 'Vật cần thêm thời gian để chạm mặt đất.' },
      { id: 'horizontal', text: 'Tốc độ ngang không đổi trong suốt chuyến bay.' },
      { id: 'distance', text: 'x = vₓt nên thời gian bay dài hơn làm tầm xa tăng.' },
    ],
    teachBackPrompt: 'Giải thích vì sao tăng độ cao bệ làm vật bay xa hơn. Phân biệt thời gian bay với tốc độ ngang.',
    variant: {
      problem: 'Chỉ hạ bệ từ 2 m xuống 0 m, vẫn phóng ở 20 m/s và 40°, không có lực cản. Dự đoán tầm xa mới so với lần trước.',
      changedCondition: 'Độ cao ban đầu giảm từ 2 m xuống 0 m.',
      config: config('projectile-motion', 'intro', { ...projectile, height: 0 }),
      prediction: {
        question: 'Tầm xa khi phóng từ mặt đất sẽ…',
        options: [{ id: 'a', text: 'Nhỏ hơn lần phóng từ 2 m' }, { id: 'b', text: 'Lớn hơn' }, { id: 'c', text: 'Bằng nhau' }],
        correctOptionId: 'a', explanation: 'Hạ bệ làm thời gian bay giảm. Vì vₓ không đổi so với lần trước nên x = vₓt giảm.',
      },
    },
    review: { question: 'Vì sao không thể tính tầm xa của vật phóng từ bệ cao bằng công thức dành cho điểm phóng và điểm rơi cùng độ cao?', answer: 'Độ cao ban đầu làm thay đổi thời gian bay. Cần giải phương trình chuyển động thẳng đứng với y = 0 rồi dùng x = vₓt.' },
  },
  {
    id: 'gas-compression', slug: 'gas-properties', title: 'Nén bình khí, áp suất thay đổi ra sao?', chapter: 'thermal', level: 'Cơ bản',
    description: 'Giữ lượng khí và nhiệt độ để kiểm chứng mối liên hệ giữa áp suất và thể tích.',
    problem: 'Trong mô hình, 150 hạt khí lí tưởng ở 300 K chiếm thể tích 350 nm³. Cho hằng số Boltzmann kB ≈ 1,38 × 10⁻²³ J/K. Áp suất gần bằng bao nhiêu? Sau đó dự đoán khi nén thể tích còn một nửa mà giữ nguyên lượng khí và nhiệt độ.',
    objective: 'Dùng pV = NkBT và nhận ra pV không đổi khi N và T không đổi.',
    config: config('gas-properties', 'ideal', gas),
    experiment: { action: 'observe' },
    prediction: {
      question: 'Áp suất của trạng thái ban đầu gần bằng…',
      options: [{ id: 'a', text: '17,75 kPa' }, { id: 'b', text: '1 775 kPa' }, { id: 'c', text: '3 550 kPa' }],
      correctOptionId: 'b', explanation: '350 nm³ = 350 × 10⁻²⁷ m³. Từ p = NkBT/V, áp suất xấp xỉ 1,775 × 10⁶ Pa = 1 775 kPa. So sánh với giá trị đo được trong mô phỏng.',
    },
    hints: [
      'Ghi lại N = 150 hạt, T = 300 K và V = 350 nm³. Đừng nhầm số hạt N với số mol n.',
      'Dùng pV = NkBT. Đổi 1 nm³ = 10⁻²⁷ m³ trước khi thay vào công thức theo đơn vị SI.',
      'Khi nén mà giữ N và T không đổi, p₂/p₁ = V₁/V₂. Quan sát nhiệt độ đo được để kiểm tra điều kiện giữ nhiệt độ.',
    ],
    causalLinks: [
      { id: 'conditions', text: 'Giữ nguyên số hạt N và nhiệt độ tuyệt đối T.' },
      { id: 'volume', text: 'Nén thể tích bình V còn một nửa.' },
      { id: 'density', text: 'Mật độ hạt N/V tăng gấp đôi, còn động năng trung bình không đổi.' },
      { id: 'pressure', text: 'Vì p = NkBT/V, áp suất tăng gấp đôi.' },
    ],
    teachBackPrompt: 'Vì sao nén thể tích còn một nửa làm áp suất tăng gấp đôi trong thí nghiệm này? Nêu hai điều kiện phải giữ nguyên.',
    variant: {
      problem: 'Chỉ giảm chiều rộng bình từ 10 nm xuống 5 nm, làm thể tích giảm từ 350 nm³ xuống 175 nm³. Giữ 150 hạt khí và nhiệt độ 300 K. Dự đoán áp suất mới.',
      changedCondition: 'Chiều rộng bình giảm từ 10 nm xuống 5 nm; thể tích còn một nửa.',
      config: config('gas-properties', 'ideal', { ...gas, widthNm: 5 }),
      prediction: {
        question: 'Áp suất mới so với khoảng 1 775 kPa ban đầu sẽ…',
        options: [{ id: 'a', text: 'Giảm một nửa, còn khoảng 887 kPa' }, { id: 'b', text: 'Không đổi' }, { id: 'c', text: 'Tăng gấp đôi, lên khoảng 3 550 kPa' }],
        correctOptionId: 'c', explanation: 'p₂/p₁ = V₁/V₂ = 350/175 = 2 khi N và T không đổi. Vì vậy áp suất mới xấp xỉ 3 550 kPa.',
      },
    },
    review: { question: 'Giữ lượng khí lí tưởng và nhiệt độ không đổi. Nếu thể tích giảm còn một nửa thì áp suất thay đổi thế nào?', answer: 'Áp suất tăng gấp đôi vì pV không đổi, hay p₂/p₁ = V₁/V₂. Không dùng kết luận này nếu nhiệt độ hoặc lượng khí thay đổi.' },
  },
  {
    id: 'wave-frequency', slug: 'wave-on-a-string', title: 'Biên độ và chu kì có giống nhau?', chapter: 'waves', level: 'Cơ bản',
    description: 'Phân biệt độ lớn dao động với số dao động trong một giây.',
    problem: 'Nguồn dao động trên dây có tần số 1,5 Hz và biên độ 0,75 cm. Chu kì dao động của nguồn bằng bao nhiêu?',
    objective: 'Dùng T = 1/f và nhận ra thay đổi biên độ không tự làm thay đổi tần số nguồn.',
    config: config('wave-on-a-string', 'main', wave),
    experiment: { action: 'run' },
    prediction: {
      question: 'Một chu kì dao động kéo dài khoảng…',
      options: [{ id: 'a', text: '0,67 giây' }, { id: 'b', text: '1,5 giây' }, { id: 'c', text: '2 giây' }],
      correctOptionId: 'a', explanation: 'f = 1,5 Hz nghĩa là 1,5 dao động mỗi giây. Chu kì T = 1/1,5 ≈ 0,67 s.',
    },
    hints: [
      'Tần số là số dao động trong một giây; chu kì là thời gian thực hiện một dao động.',
      'Dùng T = 1/f, không nhân tần số với biên độ.',
      'Giữ nguyên thanh tần số rồi thay đổi biên độ. Quan sát chiều cao dao động và nhịp dao động như hai đặc trưng khác nhau.',
    ],
    causalLinks: [
      { id: 'frequency', text: 'Nguồn được đặt ở tần số f = 1,5 Hz.' },
      { id: 'count', text: 'Trong mỗi giây, nguồn thực hiện 1,5 dao động.' },
      { id: 'period', text: 'Thời gian một dao động là T = 1/f.' },
      { id: 'independence', text: 'Chỉ đổi biên độ, giữ f không đổi, thì T vẫn không đổi.' },
    ],
    teachBackPrompt: 'Một bạn nói kéo biên độ lên thì sóng dao động nhanh hơn. Hãy phân biệt biên độ, tần số và chu kì để giải thích cho bạn.',
    variant: {
      problem: 'Chỉ tăng biên độ từ 0,75 cm lên 1,2 cm; giữ tần số 1,5 Hz, độ căng dây và độ tắt dần như trước. Chu kì nguồn thay đổi thế nào?',
      changedCondition: 'Biên độ tăng từ 0,75 cm lên 1,2 cm.',
      config: config('wave-on-a-string', 'main', { ...wave, amplitude: 1.2 }),
      prediction: {
        question: 'Chu kì mới của nguồn là…',
        options: [{ id: 'a', text: 'Nhỏ hơn 0,67 s' }, { id: 'b', text: 'Vẫn khoảng 0,67 s' }, { id: 'c', text: 'Lớn hơn 0,67 s' }],
        correctOptionId: 'b', explanation: 'Tần số vẫn là 1,5 Hz nên T = 1/f không đổi. Biên độ lớn hơn chỉ làm độ lệch cực đại của dao động lớn hơn.',
      },
    },
    review: { question: 'Nguồn có f = 2 Hz. Nếu chỉ tăng biên độ gấp đôi thì chu kì là bao nhiêu?', answer: 'T = 1/f = 0,5 s, không đổi vì tần số nguồn vẫn là 2 Hz.' },
  },
  {
    id: 'light-refraction', slug: 'bending-light', title: 'Ánh sáng đổi hướng ở mặt phân cách', chapter: 'optics', level: 'Cơ bản',
    description: 'Dùng pháp tuyến để so sánh góc tới và góc khúc xạ.',
    problem: 'Tia sáng đi từ không khí (chiết suất xấp xỉ 1) vào thủy tinh (chiết suất xấp xỉ 1,5), với góc tới 45° tính từ pháp tuyến. Tia khúc xạ lệch về phía nào?',
    objective: 'Đo góc từ pháp tuyến và vận dụng n₁ sin i = n₂ sin r.',
    config: config('bending-light', 'intro', optics),
    experiment: { action: 'observe' },
    prediction: {
      question: 'Góc khúc xạ r so với góc tới i = 45° sẽ…',
      options: [{ id: 'a', text: 'Nhỏ hơn 45°: tia lệch gần pháp tuyến' }, { id: 'b', text: 'Lớn hơn 45°: tia lệch xa pháp tuyến' }, { id: 'c', text: 'Bằng 45°' }],
      correctOptionId: 'a', explanation: 'sin r = (1/1,5) sin 45°, nên r ≈ 28,1°. Tia đi vào môi trường có chiết suất lớn hơn sẽ lệch gần pháp tuyến.',
    },
    hints: [
      'Bật pháp tuyến và số đo góc. Góc tới và góc khúc xạ đều được tính từ pháp tuyến, không phải từ mặt phân cách.',
      'Viết n₁ sin i = n₂ sin r. Trong bài này n₂ lớn hơn n₁.',
      'Suy ra sin r = (n₁/n₂) sin i. Với các góc từ 0° đến 90°, sin r nhỏ hơn sin i thì r nhỏ hơn i.',
    ],
    causalLinks: [
      { id: 'indices', text: 'Tia đi từ n₁ xấp xỉ 1 sang n₂ xấp xỉ 1,5.' },
      { id: 'snell', text: 'Định luật khúc xạ cho n₁ sin i = n₂ sin r.' },
      { id: 'ratio', text: 'n₁/n₂ nhỏ hơn 1 nên sin r nhỏ hơn sin i.' },
      { id: 'normal', text: 'Góc r nhỏ hơn góc i: tia khúc xạ lệch gần pháp tuyến.' },
    ],
    teachBackPrompt: 'Vì sao tia sáng trong trường hợp này lệch gần pháp tuyến? Nêu cách đo góc và liên hệ với chiết suất hai môi trường.',
    variant: {
      problem: 'Giữ nguyên hai môi trường và chỉ tăng góc tới từ 45° lên 60°. Góc khúc xạ thay đổi thế nào?',
      changedCondition: 'Góc tới tăng từ 45° lên 60°.',
      config: config('bending-light', 'intro', { ...optics, angleDeg: 60 }),
      prediction: {
        question: 'Góc khúc xạ mới sẽ…',
        options: [{ id: 'a', text: 'Giảm so với 28,1°' }, { id: 'b', text: 'Tăng, nhưng vẫn nhỏ hơn 60°' }, { id: 'c', text: 'Bằng 60°' }],
        correctOptionId: 'b', explanation: 'r = arcsin((1/1,5) sin 60°) ≈ 35,3°. Góc khúc xạ tăng theo góc tới nhưng vẫn nhỏ hơn góc tới trong hai môi trường này.',
      },
    },
    review: { question: 'Một tia đi vào môi trường có chiết suất lớn hơn với góc tới khác 0°. Nó lệch gần hay xa pháp tuyến?', answer: 'Lệch gần pháp tuyến: n₁ sin i = n₂ sin r và n₂ > n₁ nên r < i. Cả hai góc đều đo từ pháp tuyến.' },
  },
  {
    id: 'nucleus-isotope', slug: 'build-a-nucleus', title: 'Thêm neutron có đổi nguyên tố?', chapter: 'nuclear', level: 'Cơ bản',
    description: 'Phân biệt số proton, số neutron, số khối và đồng vị.',
    problem: 'Một hạt nhân có 6 proton và 6 neutron. Hãy xác định số hiệu nguyên tử Z và số khối A. Nếu chỉ thêm một neutron, hạt nhân có trở thành nguyên tố khác không?',
    objective: 'Dùng Z = số proton và A = số proton + số neutron để phân biệt nguyên tố với đồng vị.',
    config: config('build-a-nucleus', 'decay', { protons: 6, neutrons: 6 }),
    experiment: { action: 'observe' },
    prediction: {
      question: 'Với 6 proton và 6 neutron, hạt nhân có…',
      options: [{ id: 'a', text: 'Z = 6 và A = 12' }, { id: 'b', text: 'Z = 12 và A = 6' }, { id: 'c', text: 'Z = 6 và A = 6' }],
      correctOptionId: 'a', explanation: 'Z đếm proton nên Z = 6. A đếm tổng proton và neutron nên A = 6 + 6 = 12. Đó là hạt nhân carbon-12.',
    },
    hints: [
      'Số hiệu nguyên tử Z chỉ bằng số proton. Đây là đại lượng xác định nguyên tố.',
      'Số khối A là tổng số nucleon: A = Z + N, với N là số neutron.',
      'Hai hạt nhân cùng Z nhưng khác N là hai đồng vị của cùng một nguyên tố. Không suy ra độ bền chỉ từ việc A lớn hơn.',
    ],
    causalLinks: [
      { id: 'neutron', text: 'Chỉ thêm một neutron, giữ số proton bằng 6.' },
      { id: 'atomic', text: 'Z không đổi nên nguyên tố vẫn là carbon.' },
      { id: 'mass', text: 'Tổng số proton và neutron tăng một, nên A tăng một.' },
      { id: 'isotope', text: 'Hạt nhân chuyển từ carbon-12 sang đồng vị carbon-13.' },
    ],
    teachBackPrompt: 'Giải thích vì sao thêm neutron có thể đổi đồng vị nhưng không đổi nguyên tố. Phân biệt Z với A.',
    variant: {
      problem: 'Chỉ tăng số neutron từ 6 lên 7; giữ nguyên 6 proton. Hãy dự đoán Z, A và tên nguyên tố.',
      changedCondition: 'Số neutron tăng từ 6 lên 7.',
      config: config('build-a-nucleus', 'decay', { protons: 6, neutrons: 7 }),
      prediction: {
        question: 'Hạt nhân mới là…',
        options: [{ id: 'a', text: 'Carbon-13: Z = 6, A = 13' }, { id: 'b', text: 'Nitrogen-13: Z = 7, A = 13' }, { id: 'c', text: 'Carbon-12: Z = 6, A = 12' }],
        correctOptionId: 'a', explanation: 'Số proton vẫn là 6 nên Z = 6 và nguyên tố vẫn là carbon. A = 6 + 7 = 13, nên đây là carbon-13.',
      },
    },
    review: { question: 'Hai hạt nhân có cùng số proton nhưng khác số neutron được gọi là gì? Đại lượng nào thay đổi?', answer: 'Chúng là các đồng vị của cùng nguyên tố. Z giữ nguyên còn N và số khối A thay đổi.' },
  },
];

export const sampleLessons = SAMPLE_LESSONS;

export function getSampleLesson(id: string): SampleLesson | undefined {
  return SAMPLE_LESSONS.find(lesson => lesson.id === id || lesson.slug === id);
}
