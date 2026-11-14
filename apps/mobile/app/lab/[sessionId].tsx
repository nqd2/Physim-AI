import { useEffect, useRef, useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EnsureReady, PropertyValue, SimConfig } from '@physim/shared';
import { api } from '../../src/shared/api';
import { type Session, useStore } from '../../src/shared/store';
import { color, font } from '../../src/shared/theme';
import { Action, Copy, Frame, Heading, Notice, Page, Small, useLayout } from '../../src/shared/ui';
import { LearningSteps } from '../../src/features/LearningSteps';
import { samples } from '../../src/features/samples';
import SimHost from '../../src/features/SimHost';
import { useBridge } from '../../src/features/useBridge';

const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

function formatProperty(value: PropertyValue, unit = '') {
  let rendered: string;
  if (typeof value === 'boolean') rendered = value ? 'Có' : 'Không';
  else if (typeof value === 'number') rendered = decimal.format(value);
  else if (typeof value === 'string') rendered = value;
  else rendered = '(' + decimal.format(value.x) + ' ; ' + decimal.format(value.y) + ')';
  return rendered + (unit ? ' ' + unit : '');
}

function LabHeader() {
  const router = useRouter();
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.header}>
    <Frame style={styles.headerContent}>
      <Action label="Quay lại" icon="back" kind="quiet" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <Text style={styles.headerTitle}>Phòng thí nghiệm</Text>
    </Frame>
  </SafeAreaView>;
}

export default function LabRoute() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions } = useStore();
  const session = sessions[sessionId];
  return <View style={styles.route}>
    <LabHeader />
    {session ? <Lab key={session.id} session={session} /> : <Page><Frame style={styles.page}>
      <Heading>Không tìm thấy phiên học</Heading>
      <Copy muted>Phiên này chưa được lưu trên thiết bị.</Copy>
      <Action label="Mở trang quét đề" icon="right" onPress={() => router.replace('/')} />
    </Frame></Page>}
  </View>;
}

function Lab({ session }: { session: Session }) {
  const { server, patchSession } = useStore();
  const { wide } = useLayout();
  const { width } = useWindowDimensions();
  const [material, setMaterial] = useState<EnsureReady>();
  const [resourceError, setResourceError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [configNote, setConfigNote] = useState('');
  const [presetApplied, setPresetApplied] = useState(false);
  const didRestore = useRef('');
  const slug = session.slug;
  const sample = samples.find((item) => item.id === session.sampleId);
  const simulation = material?.simulation;
  const uri = material ? new URL(material.url, server).href : undefined;
  const bridge = useBridge(uri, simulation);
  const split = wide && Boolean(simulation && session.analysis);
  const labHeight = wide ? 430 : Math.max(230, Math.min(385, Math.round((width - 40) * 0.66)));
  const schemaScreen = simulation?.screens.find((screen) => screen.id === bridge.snapshot?.screenId);
  const properties = schemaScreen?.properties.filter((item) => bridge.snapshot?.values[item.id] !== undefined) ?? [];

  useEffect(() => {
    let active = true;
    setMaterial(undefined);
    setResourceError('');
    setConfigNote('');
    setPresetApplied(false);
    if (!slug) return () => { active = false; };
    api.simulation(server, slug).then((value) => {
      if (active) setMaterial(value);
    }).catch((failure: unknown) => {
      if (active) setResourceError(failure instanceof Error ? failure.message : 'Không tìm thấy mô phỏng.');
    });
    return () => { active = false; };
  }, [server, slug, attempt]);

  const restoreDescription = session.lastVersion && simulation && session.lastVersion !== simulation.version
    ? 'Mô phỏng đã đổi phiên bản từ lúc lưu cấu hình. Bạn vẫn có thể mở mô phỏng và đặt lại thông số.'
    : undefined;

  useEffect(() => {
    if (!simulation || !bridge.ready || bridge.busy || didRestore.current === bridge.channel) return;
    didRestore.current = bridge.channel;
    const config = session.lastConfig ?? session.analysis?.config;
    if (!config || restoreDescription || simulation.bridgeMode !== 'guided') return;
    void bridge.configure(config, false).then(setPresetApplied);
  }, [bridge, restoreDescription, session.analysis?.config, session.lastConfig, simulation]);

  async function apply(config: SimConfig, run: boolean) {
    const success = await bridge.configure(config, run);
    if (success) {
      patchSession(session.id, { lastConfig: config, lastVersion: simulation?.version });
      setPresetApplied(true);
    }
    return success;
  }

  function retry() {
    bridge.retry();
    setMaterial(undefined);
    setPresetApplied(false);
    setConfigNote('');
    setAttempt(attempt + 1);
  }

  return <Page>
    <Frame style={styles.page}>
      <View style={styles.title}>
        <Heading>{session.title}</Heading>
        {session.analysis && <>
          <Copy>{session.analysis.problemText}</Copy>
          <View style={styles.facts} accessibilityLabel="Dữ kiện">
            {session.analysis.facts.map((fact, index) => <Small key={index} tint={color.goldInteractive} style={styles.fact}>{fact}</Small>)}
          </View>
        </>}
      </View>
      <View style={[styles.body, split && styles.bodyWide]}>
        {slug ? <View style={[styles.simulation, split && styles.simulationWide]}>
          <View style={styles.stageHeader}>
            <Small tint={color.navy}>{simulation?.title ?? 'Mô phỏng PhET'}</Small>
            <Small tint={bridge.ready ? color.success : color.body}>{bridge.ready ? 'Sẵn sàng' : bridge.loaded ? 'Đang kết nối' : 'Đang tải'}</Small>
          </View>
          {resourceError ? <View style={styles.feedback}>
            <Notice tone="error">{resourceError}</Notice>
            <Action label="Tải lại mô phỏng" kind="secondary" icon="reset" onPress={retry} />
          </View> : <View style={[styles.stage, { height: labHeight }]}>
            {bridge.uri ? <SimHost key={bridge.channel} ref={bridge.host} uri={bridge.uri}
              title={simulation?.title ?? session.title} onMessage={bridge.receive} onFailure={bridge.markFailure} onLoad={bridge.markLoaded} /> :
              <View style={styles.wait}><Notice>Đang chuẩn bị mô phỏng…</Notice></View>}
          </View>}
          {bridge.failure ? <View style={styles.feedback}>
            <Notice tone={simulation?.bridgeMode === 'manual' && bridge.loaded ? 'neutral' : 'error'}>{bridge.failure}</Notice>
            <Action label="Tải lại mô phỏng" kind="secondary" icon="reset" onPress={retry} />
          </View> : null}
          {restoreDescription && <Notice>{restoreDescription}</Notice>}
          {session.lastConfig && !restoreDescription && presetApplied && <Notice tone="success">Đã áp dụng cấu hình trong phòng thí nghiệm.</Notice>}
          {simulation && <View style={styles.tools}>
            {simulation.bridgeMode === 'guided' && bridge.ready && <>
              {!!bridge.screenIds.length && bridge.screenIds.length > 1 && <View style={styles.actions}>
                {bridge.screenIds.map((id) => <Action key={id} kind={id === bridge.snapshot?.screenId ? 'primary' : 'secondary'}
                  label={simulation.screens.find((entry) => entry.id === id)?.title ?? id}
                  disabled={bridge.busy} onPress={() => void bridge.select(id)} />)}
              </View>}
              {properties.length > 0 && <View style={styles.readings}>
                {properties.map((item) => <View key={item.id} style={styles.reading}>
                  <Small>{item.label}</Small>
                  <Text style={styles.value}>{formatProperty(bridge.snapshot!.values[item.id], item.unit)}</Text>
                </View>)}
              </View>}
              <Action label="Đặt lại mô phỏng" kind="quiet" icon="reset" style={styles.reset} disabled={bridge.busy} onPress={() => {
                void bridge.reset().then((reset) => {
                  if (reset) {
                    setPresetApplied(false);
                    setConfigNote('Đã đặt lại màn hình hiện tại.');
                  }
                });
              }} />
            </>}
            {configNote ? <Notice>{configNote}</Notice> : null}
            <Small>Mô phỏng của PhET Interactive Simulations, University of Colorado Boulder, cấp phép theo CC BY-NC 4.0.</Small>
            <Small tint={color.goldInteractive}><Link href="https://phet.colorado.edu" target="_blank" rel="noopener noreferrer"
              style={styles.creditLink}>phet.colorado.edu</Link> · Tích hợp kết nối Physim-AI</Small>
          </View>}
        </View> : null}
        {session.analysis && <View style={[styles.learning, split && styles.learningWide]}>
          <LearningSteps session={session} sample={sample} analysis={session.analysis} apply={apply}
            simReady={bridge.ready && simulation?.bridgeMode === 'guided'} simBusy={bridge.busy} simulationVersion={simulation?.version} />
        </View>}
      </View>
    </Frame>
  </Page>;
}

const styles = StyleSheet.create({
  route: { flex: 1, backgroundColor: color.paper },
  header: { backgroundColor: color.white, borderBottomWidth: 1, borderColor: color.hairline },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  headerTitle: { color: color.navy, fontFamily: font.strong, fontSize: 14 },
  page: { paddingTop: 26, gap: 24 },
  title: { gap: 6, maxWidth: 790 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 3 },
  fact: { borderBottomWidth: 1, borderColor: color.hairline, paddingVertical: 4 },
  body: { gap: 24 },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 26 },
  simulation: { minWidth: 0 },
  simulationWide: { flex: 1.25 },
  learning: { minWidth: 0 },
  learningWide: { flex: 1 },
  stageHeader: { backgroundColor: color.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 7, paddingHorizontal: 9, paddingVertical: 8, borderTopWidth: 1, borderColor: color.hairline },
  stage: { width: '100%', backgroundColor: color.white, borderBottomWidth: 1, borderColor: color.hairline },
  wait: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  feedback: { gap: 9, paddingVertical: 8 },
  tools: { gap: 6, paddingTop: 8 },
  creditLink: { textDecorationLine: 'underline' },
  readings: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 7 },
  reading: { minWidth: 75, paddingBottom: 4 },
  value: { color: color.navy, fontFamily: font.strong, fontSize: 16, lineHeight: 23, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reset: { alignSelf: 'flex-start' },
});
