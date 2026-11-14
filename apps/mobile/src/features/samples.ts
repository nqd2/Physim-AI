import type { Analysis, SimConfig, TeachBackAssessment, Variant } from '@physim/shared';
import { chapters } from '../shared/chapters';

type Values = SimConfig['values'];

export interface Sample {
  id: string;
  title: string;
  slug: string;
  chapter: (typeof chapters)[number]['id'];
  analysis: Analysis;
  variant: Variant;
  comparison?: SimConfig;
}

interface SampleInput {
  slug: string;
  title: string;
  chapter: Sample['chapter'];
  problem: string;
  facts: string[];
  prediction: Analysis['misconception'];
  hints: string[];
  causalChain: string[];
  values: Values;
  actionId: string;
  variantQuestion: string;
  comparisonValues?: Values;
  variantValues: Values;
  expectedObservation: string;
}

function sample(input: SampleInput): Sample {
  const config: SimConfig = { slug: input.slug, screenId: 'main', values: input.values, actionId: input.actionId };
  return {
    id: input.slug,
    slug: input.slug,
    title: input.title,
    chapter: input.chapter,
    analysis: {
      problemText: input.problem,
      facts: input.facts,
      misconception: input.prediction,
      hints: input.hints.map((text, index) => ({
        text,
        config: index === 1 ? { ...config, actionId: null } : null,
      })),
      causalChain: input.causalChain,
      config,
    },
    comparison: input.comparisonValues ? { ...config, values: input.comparisonValues } : undefined,
    variant: {
      question: input.variantQuestion,
      expectedObservation: input.expectedObservation,
      config: { ...config, values: input.variantValues },
    },
  };
}

export function assessSample(analysis: Analysis, orderedChain: string[], explanation: string): TeachBackAssessment {
  const wrongIndex = analysis.causalChain.findIndex((item, index) => item !== orderedChain[index]);
  if (wrongIndex >= 0) {
    return {
      missingLink: analysis.causalChain[wrongIndex],
      feedback: 'Xem lại mắt xích ở vị trí ' + (wrongIndex + 1) + ', rồi giải thích điều gì dẫn đến kết quả quan sát.',
    };
  }
  return {
    missingLink: null,
    feedback: explanation.trim()
      ? 'Chuỗi đã đúng. Đối chiếu câu giải thích của bạn với chuỗi vừa xếp và kết quả quan sát.'
      : 'Chuỗi đã đúng. Hãy thử diễn đạt mối liên hệ bằng lời của mình.',
  };
}

export const samples: Sample[] = [
  sample({
    slug: 'projectile-motion',
    title: 'Ném xiên và tầm xa',
    chapter: 'mechanics',
    problem: 'Một vật được phóng từ mặt đất với tốc độ ban đầu 15 m/s, góc 45°. Tìm tầm xa khi bỏ qua lực cản không khí và lấy g = 9,8 m/s².',
    facts: ['v₀ = 15 m/s', 'α = 45°', 'g = 9,8 m/s²', 'Độ cao đầu và cuối như nhau'],
    prediction: {
      question: 'Nếu tăng góc phóng từ 45° lên 60° và giữ nguyên tốc độ, tầm xa thay đổi thế nào?',
      choices: ['Tầm xa tăng', 'Tầm xa giảm', 'Tầm xa giữ nguyên'],
      correctIndex: 1,
      explanation: 'Ở 60°, thời gian bay tăng nhưng vận tốc ngang giảm. Với cùng độ cao đầu và cuối, tầm xa tỉ lệ với sin(2α) và lớn nhất ở 45°.',
    },
    hints: ['Tách v₀ thành hai thành phần ngang và dọc.', 'Dùng điều kiện vật trở lại độ cao ban đầu để tìm thời gian bay.', 'Nhân thời gian bay với vận tốc ngang. Kết quả xấp xỉ 23 m.'],
    causalChain: ['Tách vận tốc ban đầu theo hai phương', 'Dùng chuyển động dọc để tìm thời gian bay', 'Nhân thời gian bay với vận tốc ngang'],
    values: { speed: 15, angle: 45, height: 0, airResistance: false },
    actionId: 'launch',
    comparisonValues: { speed: 15, angle: 60, height: 0, airResistance: false },
    variantQuestion: 'Giữ góc 45° và giảm tốc độ ban đầu xuống 10 m/s. Tầm xa còn khoảng bao nhiêu?',
    variantValues: { speed: 10, angle: 45, height: 0, airResistance: false },
    expectedObservation: 'Tầm xa còn khoảng 10,2 m. Với góc cố định và bỏ qua lực cản, tầm xa tỉ lệ với bình phương tốc độ ban đầu.',
  }),
  sample({
    slug: 'gas-properties',
    title: 'Số hạt và áp suất khí',
    chapter: 'thermodynamics',
    problem: 'Một bình kín chứa 50 hạt khí. Khi thể tích và nhiệt độ được giữ cố định, dự đoán áp suất khi chuyển sang 100 hạt.',
    facts: ['N ban đầu = 50 hạt', 'V cố định', 'T cố định khi so sánh'],
    prediction: {
      question: 'Tăng số hạt gấp đôi khi giữ nguyên V và T khiến áp suất thay đổi ra sao?',
      choices: ['Giảm còn một nửa', 'Giữ nguyên', 'Tăng xấp xỉ gấp đôi'],
      correctIndex: 2,
      explanation: 'Theo pV = NkT, tại cùng thể tích và nhiệt độ, áp suất tỉ lệ thuận với số hạt. Số hạt nhiều hơn cũng làm tăng tần suất va chạm với thành bình.',
    },
    hints: ['Xác định biến được giữ cố định trong pV = NkT.', 'Chạy mô phỏng với 50 hạt và đọc áp suất sau khi số đo ổn định.', 'Khi so sánh, kiểm tra nhiệt độ và thể tích của cả hai lần đo.'],
    causalChain: ['Thêm hạt khi giữ nhiệt độ và thể tích', 'Tăng tần suất va chạm với thành bình', 'Áp suất tăng'],
    values: { particleCount: 50 },
    actionId: 'advance',
    comparisonValues: { particleCount: 100 },
    variantQuestion: 'Thử với 100 hạt và đối chiếu áp suất với cấu hình 50 hạt sau khi số đo ổn định.',
    variantValues: { particleCount: 100 },
    expectedObservation: 'Với V cố định và nhiệt độ tương đương, áp suất xấp xỉ gấp đôi. Đồng hồ mô phỏng có thể dao động.',
  }),
  sample({
    slug: 'ohms-law',
    title: 'Định luật Ohm',
    chapter: 'electromagnetism',
    problem: 'Một điện trở 300 Ω được đặt dưới hiệu điện thế 3 V. Tính cường độ dòng điện qua điện trở và dự đoán kết quả nếu hiệu điện thế tăng gấp đôi.',
    facts: ['U = 3 V', 'R = 300 Ω', 'I = U/R'],
    prediction: {
      question: 'Khi tăng U từ 3 V lên 6 V và giữ R = 300 Ω, cường độ dòng điện thay đổi thế nào?',
      choices: ['Tăng gấp đôi', 'Giữ nguyên', 'Giảm còn một nửa'],
      correctIndex: 0,
      explanation: 'Với điện trở cố định, dòng điện tỉ lệ thuận với hiệu điện thế. Dòng điện tăng từ 10 mA lên 20 mA.',
    },
    hints: ['Viết I = U/R và giữ đơn vị V, Ω để kết quả ra A.', 'Thế 3 V và 300 Ω rồi đọc giá trị trong mô phỏng.', 'Đổi 0,01 A thành 10 mA bằng cách nhân với 1.000.'],
    causalChain: ['Giữ điện trở của mạch cố định', 'Tăng hiệu điện thế đặt lên điện trở', 'Cường độ dòng điện tăng theo I = U/R'],
    values: { voltage: 3, resistance: 300 },
    actionId: 'measure',
    comparisonValues: { voltage: 6, resistance: 300 },
    variantQuestion: 'Giữ hiệu điện thế 3 V và tăng điện trở lên 600 Ω. Dòng điện còn bao nhiêu?',
    variantValues: { voltage: 3, resistance: 600 },
    expectedObservation: 'Dòng điện giảm từ 10 mA còn 5 mA vì I = 3/600 = 0,005 A.',
  }),
  sample({
    slug: 'wave-on-a-string',
    title: 'Tần số và bước sóng',
    chapter: 'waves',
    problem: 'Một nguồn dao động điều hòa tạo sóng trên dây. Giữ nguyên lực căng và biên độ 0,5 cm, rồi so sánh sóng ở 1 Hz với 2 Hz.',
    facts: ['A = 0,5 cm', 'f ban đầu = 1 Hz', 'Lực căng không đổi'],
    prediction: {
      question: 'Khi tăng tần số lên 2 Hz, khoảng cách giữa hai đỉnh liền nhau thay đổi thế nào?',
      choices: ['Tăng gấp đôi', 'Giảm còn một nửa', 'Giữ nguyên'],
      correctIndex: 1,
      explanation: 'Tốc độ truyền do dây và lực căng quyết định. Khi v cố định, λ = v/f nên tần số gấp đôi cho bước sóng bằng một nửa.',
    },
    hints: ['Xác định bước sóng bằng khoảng cách giữa hai đỉnh liền nhau.', 'Chạy dao động, dùng thước của mô phỏng để so khoảng cách.', 'Dùng λ = v/f với v không đổi.'],
    causalChain: ['Dây và lực căng giữ nguyên', 'Tần số nguồn tăng khi tốc độ truyền không đổi', 'Bước sóng giảm'],
    values: { amplitude: 0.5, frequency: 1 },
    actionId: 'oscillate',
    comparisonValues: { amplitude: 0.5, frequency: 2 },
    variantQuestion: 'Tăng tần số từ 1 Hz lên 2 Hz. Biên độ đặt ở nguồn và bước sóng thay đổi thế nào?',
    variantValues: { amplitude: 0.5, frequency: 2 },
    expectedObservation: 'Ở nguồn, biên độ vẫn là 0,5 cm. Các đỉnh sóng tới nằm gần nhau hơn.',
  }),
  sample({
    slug: 'bending-light',
    title: 'Khúc xạ qua mặt nước',
    chapter: 'optics',
    problem: 'Chiếu một tia sáng từ không khí vào nước với góc tới 30° so với pháp tuyến. Tìm góc khúc xạ với n₁ ≈ 1,00 và n₂ ≈ 1,33.',
    facts: ['i = 30°', 'n₁ ≈ 1,00', 'n₂ ≈ 1,33'],
    prediction: {
      question: 'Tia trong nước lệch về phía nào so với tia tới?',
      choices: ['Xa pháp tuyến hơn', 'Cùng phương với tia tới', 'Gần pháp tuyến hơn'],
      correctIndex: 2,
      explanation: 'n₂ lớn hơn n₁ nên sin r nhỏ hơn sin i trong định luật Snell. Tia khúc xạ lệch về phía pháp tuyến.',
    },
    hints: ['Đo góc từ pháp tuyến vuông góc với mặt nước.', 'Bật tia sáng rồi đọc góc tới và góc khúc xạ.', 'Tính r = arcsin(n₁ sin i/n₂). Với i = 30°, r xấp xỉ 22°.'],
    causalChain: ['Tia đi từ không khí vào nước', 'Chiết suất tăng nên sin góc khúc xạ giảm', 'Tia khúc xạ gần pháp tuyến hơn'],
    values: { angle: 30 },
    actionId: 'illuminate',
    variantQuestion: 'Tăng góc tới lên 50°. Hãy ước lượng góc khúc xạ trong nước.',
    variantValues: { angle: 50 },
    expectedObservation: 'Góc khúc xạ tăng lên khoảng 35°. Tia trong nước vẫn nằm gần pháp tuyến hơn tia tới.',
  }),
  sample({
    slug: 'build-a-nucleus',
    title: 'Đồng vị carbon',
    chapter: 'quantum',
    problem: 'Hạt nhân có 6 proton và 8 neutron. Xác định nguyên tố, số khối và cách hạt nhân đổi khi giảm hai neutron.',
    facts: ['Z = 6', 'N = 8', 'A = Z + N'],
    prediction: {
      question: 'Bớt hai neutron và giữ nguyên số proton tạo ra nguyên tố nào?',
      choices: ['Carbon', 'Boron', 'Nitrogen'],
      correctIndex: 0,
      explanation: 'Số proton xác định nguyên tố. Giữ 6 proton thì hạt nhân vẫn là carbon. Số khối giảm từ 14 xuống 12.',
    },
    hints: ['Dùng số proton để tra nguyên tố.', 'So sánh số proton và số neutron trên mô phỏng.', 'Cộng Z và N để tính số khối của từng đồng vị.'],
    causalChain: ['Giữ số proton ở 6', 'Giảm số neutron từ 8 còn 6', 'Nguyên tố vẫn là carbon và số khối giảm'],
    values: { protons: 6, neutrons: 8 },
    actionId: 'observe',
    comparisonValues: { protons: 6, neutrons: 6 },
    variantQuestion: 'Hạt nhân 6 proton và 6 neutron có ký hiệu đồng vị nào?',
    variantValues: { protons: 6, neutrons: 6 },
    expectedObservation: 'Đó là carbon-12. Carbon-12 và carbon-14 cùng có 6 proton nhưng khác số neutron.',
  }),
];
