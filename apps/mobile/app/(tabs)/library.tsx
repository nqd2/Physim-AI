import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { SimulationSchema } from '@physim/shared';
import { api } from '../../src/shared/api';
import { chapters } from '../../src/shared/chapters';
import { useStore } from '../../src/shared/store';
import { color, font } from '../../src/shared/theme';
import { Action, Copy, Field, Frame, Heading, Notice, Page, Row, Small, useLayout } from '../../src/shared/ui';

const fold = (text: string) => text.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

export default function Library() {
  const router = useRouter();
  const { createSession, server } = useStore();
  const { wide } = useLayout();
  const [simulations, setSimulations] = useState<SimulationSchema[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    setSimulations(null);
    api.catalog(server).then((result) => {
      if (active) setSimulations(result.simulations);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'Không tải được thư viện.');
    });
    return () => { active = false; };
  }, [server, attempt]);

  function open(sim: SimulationSchema) {
    const sessionId = createSession({ title: sim.title, slug: sim.slug });
    router.push({ pathname: '/lab/[sessionId]', params: { sessionId } });
  }

  const needle = fold(query.trim());
  const matching = simulations?.filter((sim) =>
    (!activeChapter || activeChapter === sim.chapter) && fold(sim.title + ' ' + sim.slug).includes(needle)) ?? [];

  return <Page><Frame style={styles.page}>
    <View style={[styles.heading, wide && styles.headingWide]}>
      <View style={styles.headingCopy}>
        <Heading>Thư viện mô phỏng</Heading>
        <Copy muted>Khám phá mô phỏng PhET theo chương Vật lý.</Copy>
      </View>
      <View style={styles.search}>
        <Field label="Tìm mô phỏng" placeholder="Ví dụ, con lắc" autoCorrect={false} value={query} onChangeText={setQuery} />
      </View>
    </View>
    {error ? <View style={styles.feedback}>
      <Notice tone="error">{error}</Notice>
      <Action kind="secondary" label="Tải lại thư viện" icon="reset" onPress={() => setAttempt(attempt + 1)} />
    </View> : !simulations ? <View accessibilityRole="progressbar" style={styles.feedback}>
      <Notice>Đang tải thư viện mô phỏng…</Notice>
      {[0, 1, 2].map((index) => <View key={index} style={styles.skeleton} />)}
    </View> : <View style={[styles.content, wide && styles.contentWide]}>
      <View style={styles.chapters}>
        <Heading level={3}>Các chương</Heading>
        <View style={styles.chapterRows}>
          <Row label="Tất cả mô phỏng" onPress={() => setActiveChapter('')} selected={!activeChapter}>
            <Text style={styles.title}>Tất cả <Text style={styles.count}>{simulations.length}</Text></Text>
          </Row>
          {chapters.map((chapter, index) => <Row key={chapter.id} index={index + 1} label={chapter.title}
            onPress={() => setActiveChapter(chapter.id)} selected={activeChapter === chapter.id}>
            <Text style={styles.title}>{chapter.title}</Text>
          </Row>)}
        </View>
      </View>
      <View style={styles.results}>
        {needle || activeChapter ? <Small>{matching.length} mô phỏng</Small> : null}
        {!matching.length && <Notice>Không tìm thấy mô phỏng. Hãy thử tên khác hoặc chọn tất cả chương.</Notice>}
        {chapters.map((chapter) => {
          const group = matching.filter((sim) => sim.chapter === chapter.id);
          if (!group.length) return null;
          return <View style={styles.group} key={chapter.id}>
            <Heading level={3}>{chapter.title}</Heading>
            <View style={styles.chapterRows}>
              {group.map((sim) => <Row key={sim.slug} label={'Mở ' + sim.title} onPress={() => open(sim)}>
                <Text style={styles.title}>{sim.title}</Text>
                <Small>{sim.locale === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'} · {sim.bridgeMode === 'guided' ? 'Điều khiển từ phòng lab' : 'Tương tác trong mô phỏng'}</Small>
              </Row>)}
            </View>
          </View>;
        })}
      </View>
    </View>}
  </Frame></Page>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 34, gap: 23 },
  heading: { gap: 16 },
  headingWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headingCopy: { maxWidth: 620, gap: 6 },
  search: { flex: 1, maxWidth: 370 },
  feedback: { gap: 10, maxWidth: 460 },
  skeleton: { width: '100%', height: 48, backgroundColor: color.white, borderBottomWidth: 1, borderColor: color.hairline },
  content: { gap: 26 },
  contentWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 46 },
  chapters: { flex: 1, gap: 9 },
  chapterRows: { borderTopWidth: 1, borderColor: color.hairline },
  title: { color: color.navy, fontFamily: font.strong, fontSize: 15, lineHeight: 22 },
  count: { color: color.goldInteractive, fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  results: { flex: 2, gap: 22 },
  group: { gap: 8 },
});
