import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { samples } from '../../src/features/samples';
import type { Sample } from '../../src/features/samples';
import { api } from '../../src/shared/api';
import { chapters } from '../../src/shared/chapters';
import { capturePhoto } from '../../src/shared/photo';
import { useStore } from '../../src/shared/store';
import { color, font } from '../../src/shared/theme';
import { Action, Copy, Frame, Heading, Page, Row, Small, useLayout } from '../../src/shared/ui';

function OhmPreview({ onOpen }: { onOpen(): void }) {
  const { wide } = useLayout();
  const [voltage, setVoltage] = useState<3 | 6>(3);
  const current = voltage / 300 * 1000;
  const point = voltage === 3 ? { x: 142, y: 76 } : { x: 248, y: 28 };
  return <View style={[styles.preview, wide && styles.previewWide]}>
    <View style={styles.previewHeader}>
      <View style={styles.previewCopy}>
        <Small tint={color.lightOnNavy}>Cường độ dòng điện</Small>
        <Text style={styles.readout}>{current} <Text style={styles.units}>mA</Text></Text>
      </View>
      <Small tint={color.lightOnNavy}>R = 300 Ω</Small>
    </View>
    <Svg width="100%" height={124} viewBox="0 0 280 145" aria-hidden={true}>
      <Path d="M36 13v111h223" stroke={color.darkRule} fill="none" />
      <Line x1={36} y1={76} x2={267} y2={76} stroke={color.darkRule} />
      <Line x1={36} y1={28} x2={267} y2={28} stroke={color.darkRule} />
      <Path d="M36 124 248 28" stroke={color.gold} fill="none" strokeWidth={2} />
      <Line x1={point.x} y1={point.y + 7} x2={point.x} y2={124} stroke={color.lightOnNavy} strokeDasharray="3 4" />
      <Circle cx={point.x} cy={point.y} r={5} fill={color.gold} />
      <SvgText x={11} y={32} fill={color.lightOnNavy} fontSize={11}>20</SvgText>
      <SvgText x={11} y={80} fill={color.lightOnNavy} fontSize={11}>10</SvgText>
      <SvgText x={139} y={142} fill={color.lightOnNavy} fontSize={11}>3</SvgText>
      <SvgText x={245} y={142} fill={color.lightOnNavy} fontSize={11}>6</SvgText>
      <SvgText x={268} y={142} fill={color.lightOnNavy} fontSize={11}>V</SvgText>
    </Svg>
    <View style={styles.heroActions}>
      <Action kind="inverse" label={'Đặt ' + (voltage === 3 ? 6 : 3) + ' V'} onPress={() => setVoltage(voltage === 3 ? 6 : 3)} />
      <Action kind="inverse" label="Mở bài Ohm" onPress={onOpen} icon="diagonal" />
    </View>
  </View>;
}

export default function Scanner() {
  const router = useRouter();
  const { createSession, server } = useStore();
  const { wide } = useLayout();
  const [busy, setBusy] = useState<'camera' | 'library' | ''>('');
  const [error, setError] = useState('');

  function open(sample: Sample) {
    const id = createSession({ title: sample.title, slug: sample.slug, sampleId: sample.id, analysis: sample.analysis });
    router.push({ pathname: '/lab/[sessionId]', params: { sessionId: id } });
  }

  async function submit(camera: boolean) {
    if (busy) return;
    setError('');
    setBusy(camera ? 'camera' : 'library');
    try {
      const image = await capturePhoto(camera);
      if (!image) return;
      const analysis = await api.analyze(server, image);
      const title = analysis.problemText.length > 54 ? analysis.problemText.slice(0, 53).trimEnd() + '…' : analysis.problemText;
      const sessionId = createSession({ title, slug: analysis.config?.slug, analysis });
      router.push({ pathname: '/lab/[sessionId]', params: { sessionId } });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không phân tích được đề. Hãy thử lại.');
    } finally {
      setBusy('');
    }
  }

  return <Page>
    <View style={styles.hero}>
      <Frame style={[styles.heroFrame, wide && styles.heroWide]}>
        <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
          <Heading inverse style={wide ? { fontSize: 57, lineHeight: 66, letterSpacing: -1.88 } : undefined}>Kiểm chứng bằng thí nghiệm</Heading>
          <Copy inverse style={styles.heroDescription}>
            Chụp đề Vật lý, dự đoán kết quả rồi kiểm tra bằng mô phỏng PhET.
          </Copy>
          <View style={styles.heroActions}>
            <Action label="Chụp đề" icon="camera" disabled={Boolean(busy)} busy={busy === 'camera'} onPress={() => void submit(true)} />
            <Action label="Chọn ảnh" icon="image" kind="inverse" disabled={Boolean(busy)} busy={busy === 'library'} onPress={() => void submit(false)} />
          </View>
          {busy ? <Small tint={color.lightOnNavy}>Đang mở ảnh hoặc phân tích đề…</Small> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
        <OhmPreview onOpen={() => open(samples.find((sample) => sample.slug === 'ohms-law')!)} />
      </Frame>
    </View>
    <Frame style={[styles.samples, wide && styles.samplesWide]}>
      <View style={[styles.sectionCopy, wide && styles.sectionCopyWide]}>
        <Heading level={2}>Đề mẫu THPT</Heading>
        <Copy muted>Chọn một đề theo chương để mở phòng thí nghiệm và thử bốn bước học.</Copy>
      </View>
      <View style={[styles.list, wide && styles.listWide]}>
        {samples.map((sample, index) => {
          const chapter = chapters.find((entry) => entry.id === sample.chapter)!;
          return <Row key={sample.id} label={'Mở bài ' + sample.title} index={index + 1} onPress={() => open(sample)}>
            <Text style={styles.sampleTitle}>{sample.title}</Text>
            <Small>{chapter.title}</Small>
          </Row>;
        })}
      </View>
    </Frame>
  </Page>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: color.navy },
  heroFrame: { gap: 28, paddingTop: 34, paddingBottom: 28 },
  heroWide: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 48, paddingTop: 47, paddingBottom: 45 },
  heroCopy: { gap: 15, maxWidth: 620 },
  heroCopyWide: { flex: 1 },
  heroDescription: { maxWidth: 460 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  error: { color: color.white, fontFamily: font.medium, fontSize: 14, lineHeight: 22 },
  preview: { borderTopWidth: 1, borderColor: color.darkRule, alignSelf: 'stretch', maxWidth: 420, gap: 7, paddingTop: 12 },
  previewWide: { flexBasis: '38%', flexShrink: 1 },
  previewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  previewCopy: { gap: 0 },
  readout: { color: color.gold, fontFamily: font.heading, fontSize: 36, lineHeight: 43, fontVariant: ['tabular-nums'] },
  units: { fontFamily: font.regular, fontSize: 16, color: color.lightOnNavy },
  samples: { paddingTop: 35, gap: 13 },
  samplesWide: { flexDirection: 'row', gap: 50, paddingTop: 43 },
  sectionCopy: { gap: 8, maxWidth: 350 },
  sectionCopyWide: { flex: 1 },
  list: { borderTopWidth: 1, borderColor: color.hairline },
  listWide: { flex: 2 },
  sampleTitle: { fontFamily: font.heading, fontSize: 17, lineHeight: 23, color: color.navy },
});
