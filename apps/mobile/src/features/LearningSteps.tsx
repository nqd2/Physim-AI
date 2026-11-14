import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Analysis, SimConfig, Variant } from '@physim/shared';
import { type Sample, assessSample } from './samples';
import { api } from '../shared/api';
import { capturePhoto } from '../shared/photo';
import { type Session, useStore } from '../shared/store';
import { color, focusRing, font } from '../shared/theme';
import { Action, Copy, Field, Heading, Icon, Notice, Row, Small } from '../shared/ui';

type Work = 'camera' | 'gallery' | 'teach' | 'variant' | '';
type ApplyConfig = (config: SimConfig, run: boolean) => Promise<boolean>;

const stepNames = ['Dự đoán và kiểm chứng', 'Giải từng bước', 'Giải thích lại', 'Thử biến thể'];

function Step({ children, index, selected, onSelect }: {
  children: ReactNode; index: number; selected: boolean; onSelect(): void;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={'Bước ' + (index + 1) + ' ' + stepNames[index]}
      accessibilityState={{ expanded: selected }}
      onPress={onSelect} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.step, (hovered || pressed) && styles.stepHover, selected && styles.stepActive, focused && focusRing]}>
      <Text style={[styles.stepIndex, selected && { color: color.gold }]}>{String(index + 1).padStart(2, '0')}</Text>
      <Text style={[styles.stepTitle, selected && { color: color.white }]}>{stepNames[index]}</Text>
      <Icon name={selected ? 'minus' : 'plus'} tint={selected ? color.white : color.navy} />
    </Pressable>
    {selected && <View style={styles.stepContent}>{children}</View>}
  </View>;
}

function reorder(items: string[], index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  return items.map((item, position) => position === index ? items[target] : position === target ? items[index] : item);
}

function shuffledChain(values: string[]) {
  return values.length === 2 ? values.slice().reverse() : [values[values.length - 1], ...values.slice(0, -1)];
}

function baseVariant(sample: Sample | undefined, current: Variant | undefined) {
  return current ?? sample?.variant;
}

export function LearningSteps({
  session, sample, analysis, apply, simReady, simBusy, simulationVersion,
}: {
  session: Session; sample?: Sample; analysis: Analysis; apply: ApplyConfig;
  simReady: boolean; simBusy: boolean; simulationVersion?: string;
}) {
  const { server, patchSession, saveCard, cards } = useStore();
  const [busy, setBusy] = useState<Work>('');
  const [error, setError] = useState('');
  const patch = (change: Partial<Session>) => patchSession(session.id, change);
  const order = session.orderedChain ?? shuffledChain(analysis.causalChain);
  const variant = baseVariant(sample, session.variant);
  const cardSaved = Boolean(cards[session.id]);
  const hintCount = session.hintCount ?? 0;

  function select(index: number) {
    setError('');
    patch({ activeStep: session.activeStep === index ? -1 : index });
  }

  async function checkWork(camera: boolean) {
    setBusy(camera ? 'camera' : 'gallery');
    setError('');
    try {
      const photo = await capturePhoto(camera);
      if (!photo) return;
      patch({ diagnosis: await api.check(server, photo, analysis) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không chấm được bài nháp. Hãy thử lại.');
    } finally {
      setBusy('');
    }
  }

  async function teachBack() {
    const explanation = session.explanation?.trim();
    if (!explanation) return;
    setBusy('teach');
    setError('');
    try {
      const assessment = sample
        ? assessSample(analysis, order, explanation)
        : await api.teach(server, analysis, order, explanation);
      patch({ assessment });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không đánh giá được lời giải thích.');
    } finally {
      setBusy('');
    }
  }

  async function generateVariant() {
    if (!session.assessment) return;
    setBusy('variant');
    setError('');
    try {
      const next = await api.variant(server, analysis, session.assessment);
      patch({ variant: next, variantPrediction: '', variantObserved: false });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không tạo được bài biến thể.');
    } finally {
      setBusy('');
    }
  }

  async function verifyPrediction() {
    const config = sample?.comparison ?? analysis.config;
    if (config && !await apply(config, true)) return;
    patch({ observed: true });
  }

  function save() {
    if (!variant) return;
    saveCard({
      title: session.title, sessionId: session.id,
      prompt: variant.question, answer: variant.expectedObservation,
      config: variant.config ?? undefined, simulationVersion,
    });
  }

  return <View style={styles.steps}>
    <Step selected={session.activeStep === 0} index={0} onSelect={() => select(0)}>
      <Copy>{analysis.misconception.question}</Copy>
      <View style={styles.choiceList} accessibilityRole="radiogroup">
        {analysis.misconception.choices.map((choice, index) => (
          <Row key={choice} label={choice} selected={session.prediction === index}
            trailing={session.prediction === index ? 'check' : 'right'}
            onPress={() => patch({ prediction: index, observed: false })}>
            <Copy>{choice}</Copy>
          </Row>
        ))}
      </View>
      <Action label={analysis.config ? 'Chạy để kiểm chứng' : 'Đối chiếu dự đoán'}
        icon="right" busy={simBusy} disabled={session.prediction === undefined || Boolean(analysis.config && !simReady)}
        onPress={() => void verifyPrediction()} />
      {session.observed && <View style={styles.feedback}>
        <Small tint={color.goldInteractive}>{session.prediction === analysis.misconception.correctIndex ? 'Dự đoán đúng' : 'Đối chiếu kết quả'}</Small>
        <Copy>{analysis.misconception.explanation}</Copy>
      </View>}
      {session.observed && sample?.comparison && analysis.config && <Action kind="secondary"
        label="Chạy lại với điều kiện ban đầu" icon="reset" busy={simBusy} disabled={!simReady}
        onPress={() => void apply(analysis.config!, true)} />}
    </Step>
    <Step selected={session.activeStep === 1} index={1} onSelect={() => select(1)}>
      <Copy muted>Mở từng gợi ý khi bạn cần kiểm tra bước tiếp theo.</Copy>
      {analysis.hints.slice(0, hintCount).map((hint, index) => <View key={index} style={styles.feedback}>
        <Small tint={color.goldInteractive}>Gợi ý {index + 1}</Small>
        <Copy>{hint.text}</Copy>
        {hint.config && <Action kind="secondary" label="Đặt thông số trong mô phỏng" icon="right" busy={simBusy} disabled={!simReady}
          onPress={() => void apply(hint.config!, false)} />}
      </View>)}
      {hintCount < analysis.hints.length && <Action kind="secondary" label={hintCount ? 'Gợi ý tiếp theo' : 'Xem gợi ý đầu tiên'} icon="plus"
        onPress={() => patch({ hintCount: hintCount + 1 })} />}
      <Heading level={3}>Kiểm tra bài nháp</Heading>
      <View style={styles.actions}>
        <Action label="Chụp bài nháp" icon="camera" kind="secondary" disabled={Boolean(busy)}
          busy={busy === 'camera'} onPress={() => void checkWork(true)} />
        <Action label="Chọn ảnh bài nháp" icon="image" kind="secondary" disabled={Boolean(busy)}
          busy={busy === 'gallery'} onPress={() => void checkWork(false)} />
      </View>
      {session.diagnosis && <View style={styles.feedback}>
        <Small tint={color.goldInteractive}>Phản hồi bài nháp</Small>
        {session.diagnosis.firstError && <Copy>{session.diagnosis.firstError}</Copy>}
        <Copy muted>{session.diagnosis.hint}</Copy>
      </View>}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Step>
    <Step selected={session.activeStep === 2} index={2} onSelect={() => select(2)}>
      <Copy muted>Sắp xếp các mắt xích theo thứ tự nguyên nhân đến kết quả.</Copy>
      <View style={styles.chain}>
        {order.map((item, index) => <View style={styles.chainRow} key={index}>
          <Small tint={color.goldInteractive}>{String(index + 1).padStart(2, '0')}</Small>
          <Copy style={styles.chainText}>{item}</Copy>
          <View style={styles.chainActions}>
            <Action label="Lên" accessibilityLabel={'Đưa mắt xích ' + (index + 1) + ' lên'} kind="quiet" disabled={index === 0}
              onPress={() => patch({ orderedChain: reorder(order, index, -1), assessment: undefined })} />
            <Action label="Xuống" accessibilityLabel={'Đưa mắt xích ' + (index + 1) + ' xuống'} kind="quiet" disabled={index === order.length - 1}
              onPress={() => patch({ orderedChain: reorder(order, index, 1), assessment: undefined })} />
          </View>
        </View>)}
      </View>
      <Field label="Giải thích bằng một câu" value={session.explanation ?? ''} onChangeText={(value) => patch({ explanation: value, assessment: undefined })}
        multiline maxLength={1500} placeholder="Điều gì thay đổi và vì sao?" style={styles.multiline} />
      <Action label="Đánh giá lời giải thích" icon="right" busy={busy === 'teach'} disabled={!session.explanation?.trim()}
        onPress={() => void teachBack()} />
      {session.assessment && <View style={styles.feedback}>
        {session.assessment.missingLink && <Copy>{'Mắt xích cần bổ sung: ' + session.assessment.missingLink}</Copy>}
        <Copy muted>{session.assessment.feedback}</Copy>
      </View>}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Step>
    <Step selected={session.activeStep === 3} index={3} onSelect={() => select(3)}>
      {variant ? <>
        <Copy>{variant.question}</Copy>
        <Field label="Dự đoán của bạn" value={session.variantPrediction ?? ''} onChangeText={(value) => {
          patch({ variantPrediction: value, variantObserved: false });
        }} multiline maxLength={1500} placeholder="Ghi lại kết quả bạn dự đoán." style={styles.multiline} />
        <Action label={variant.config ? 'Chạy biến thể' : 'Đối chiếu dự đoán'}
          icon="right" disabled={!session.variantPrediction?.trim() || Boolean(variant.config && !simReady)} busy={simBusy}
          onPress={() => {
            void (async () => {
              if (variant.config && !await apply(variant.config, true)) return;
              patch({ variantObserved: true });
            })();
          }} />
        {session.variantObserved && <View style={styles.feedback}>
          <Small tint={color.goldInteractive}>Kết quả dự kiến</Small>
          <Copy>{variant.expectedObservation}</Copy>
        </View>}
        <Action label={cardSaved ? 'Đã lưu thẻ ôn tập' : 'Lưu thẻ ôn tập'} kind="secondary" icon={cardSaved ? 'check' : 'plus'}
          disabled={cardSaved || !session.variantObserved} onPress={save} />
      </> : <>
        <Copy muted>{session.assessment
          ? 'Dùng phản hồi ở bước trước để thử một bài với điều kiện mới.'
          : 'Hoàn thành Giải thích lại để tạo bài biến thể phù hợp.'}</Copy>
        <Action label="Tạo biến thể" icon="right" busy={busy === 'variant'} disabled={!session.assessment} onPress={() => void generateVariant()} />
      </>}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Step>
  </View>;
}

const styles = StyleSheet.create({
  steps: { borderTopWidth: 1, borderColor: color.hairline },
  step: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1,
    borderColor: color.hairline, paddingHorizontal: 12, paddingVertical: 9 },
  stepActive: { backgroundColor: color.navy, borderBottomColor: color.navy },
  stepHover: { backgroundColor: color.white },
  stepIndex: { minWidth: 27, color: color.goldInteractive, fontFamily: font.strong, fontSize: 13, fontVariant: ['tabular-nums'] },
  stepTitle: { color: color.navy, fontFamily: font.heading, fontSize: 17, lineHeight: 22, flex: 1 },
  stepContent: { backgroundColor: color.white, borderBottomWidth: 1, borderColor: color.hairline, padding: 14, gap: 12 },
  feedback: { backgroundColor: color.paper, padding: 11, gap: 5, borderTopWidth: 1, borderColor: color.hairline },
  choiceList: { borderTopWidth: 1, borderColor: color.hairline },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chain: { borderTopWidth: 1, borderColor: color.hairline },
  chainRow: { minHeight: 54, borderBottomWidth: 1, borderColor: color.hairline, alignItems: 'center',
    flexDirection: 'row', flexWrap: 'wrap', padding: 5, gap: 7 },
  chainText: { flex: 1, minWidth: 100 },
  chainActions: { flexDirection: 'row', gap: 2 },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
});
