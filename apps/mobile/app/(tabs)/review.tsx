import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReviewGrade } from '../../src/shared/sm2';
import { useStore } from '../../src/shared/store';
import type { ReviewCard } from '../../src/shared/store';
import { color } from '../../src/shared/theme';
import { Action, Copy, Frame, Heading, Notice, Page, Row, Small, useLayout } from '../../src/shared/ui';

const grades: { value: ReviewGrade; label: string }[] = [
  { value: 0, label: 'Quên hoàn toàn' },
  { value: 1, label: 'Sai, nhận ra đáp án' },
  { value: 2, label: 'Sai, suýt nhớ ra' },
  { value: 3, label: 'Đúng, nhưng khó' },
  { value: 4, label: 'Đúng sau khi nghĩ' },
  { value: 5, label: 'Nhớ ngay' },
];

function Card({ card }: { card: ReviewCard }) {
  const { gradeCard, createSession } = useStore();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);

  function reopen() {
    const sessionId = createSession({
      title: 'Ôn ' + card.title, slug: card.config?.slug, lastConfig: card.config, lastVersion: card.simulationVersion,
    });
    router.push({ pathname: '/lab/[sessionId]', params: { sessionId } });
  }

  return <View>
    <Row label={(expanded ? 'Thu gọn ' : 'Mở thẻ ') + card.title}
      onPress={() => setExpanded(!expanded)} trailing={expanded ? 'minus' : 'plus'} selected={expanded}>
      <Heading level={3}>{card.title}</Heading>
      <Small>Đến hạn {new Date(card.dueAt).toLocaleDateString('vi-VN')}</Small>
    </Row>
    {expanded && <View style={styles.cardContent}>
      <Copy>{card.prompt}</Copy>
      {card.config && <Action kind="secondary" icon="diagonal" label="Mở lại cấu hình mô phỏng" onPress={reopen} />}
      {revealed ? <>
        <Copy>{card.answer}</Copy>
        <Small>Mức độ nhớ</Small>
        <View style={styles.grades}>
          {grades.map((grade) => <Action key={grade.value} kind="secondary" label={grade.value + ' · ' + grade.label}
            onPress={() => { gradeCard(card.id, grade.value); setExpanded(false); setRevealed(false); }} />)}
        </View>
      </> : <Action label="Xem đáp án" icon="plus" onPress={() => setRevealed(true)} />}
    </View>}
  </View>;
}

export default function Review() {
  const { wide } = useLayout();
  const { cards } = useStore();
  const [now, setNow] = useState(Date.now);
  const all = Object.values(cards).sort((a, b) => a.dueAt - b.dueAt);
  const due = all.filter((card) => card.dueAt <= now);
  const later = all.filter((card) => card.dueAt > now);

  useFocusEffect(useCallback(() => {
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(clock);
  }, [cards]));

  return <Page><Frame style={[styles.page, wide && styles.wide]}>
    <View style={styles.intro}>
      <Heading>Ôn tập</Heading>
      <Copy muted>Nhớ lại dự đoán, xem đáp án rồi tự chấm để lên lịch lần ôn tiếp theo.</Copy>
    </View>
    <View style={styles.list}>
      <Heading level={3}>Đến hạn</Heading>
      {due.length ? due.map((card) => <Card key={card.id} card={card} />) : <Notice>
        {all.length ? 'Bạn đã hoàn thành các thẻ đến hạn.' : 'Chưa có thẻ. Lưu một thẻ ở bước Thử biến thể trong phòng thí nghiệm.'}
      </Notice>}
      {later.length > 0 && <><Heading level={3} style={styles.next}>Lịch tiếp theo</Heading>
        {later.map((card) => <Card key={card.id} card={card} />)}</>}
    </View>
  </Frame></Page>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 34, gap: 23 },
  wide: { flexDirection: 'row', gap: 50 },
  intro: { flex: 1, maxWidth: 420, gap: 8 },
  list: { flex: 2, gap: 10 },
  next: { marginTop: 15 },
  cardContent: { backgroundColor: color.white, padding: 13, gap: 10 },
  grades: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
