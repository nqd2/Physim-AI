/**
 * SM-2 scheduling for learner-owned review cards.
 * Algorithm: https://www-beta.supermemo.com/archives1990-2015/english/ol/sm2
 * Calendar intervals are added in UTC so stored ISO instants do not drift at DST.
 * A failed recall resets the repetition sequence, not the accumulated ease factor.
 */
export interface SM2State {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  dueAt: string;
  lastReviewedAt?: string;
}

export type Sm2State = SM2State;

export const REVIEW_GRADES = [
  { score: 0, label: 'Quên hoàn toàn' },
  { score: 1, label: 'Nhớ sau khi xem đáp án' },
  { score: 2, label: 'Trả lời sai nhưng đáp án quen thuộc' },
  { score: 3, label: 'Đúng nhưng rất khó nhớ' },
  { score: 4, label: 'Đúng sau một chút suy nghĩ' },
  { score: 5, label: 'Nhớ rõ và giải thích được' },
] as const;

function instant(value: string): Date {
  const date = new Date(value);
  if (typeof value !== 'string' || !Number.isFinite(date.getTime())) {
    throw new RangeError('Thời điểm ôn tập không hợp lệ.');
  }
  return date;
}

function assertState(state: SM2State): void {
  if (!Number.isSafeInteger(state.repetitions) || state.repetitions < 0 ||
      !Number.isSafeInteger(state.intervalDays) || state.intervalDays < 0 ||
      !Number.isFinite(state.easeFactor) || state.easeFactor < 1.3) {
    throw new RangeError('Lịch ôn tập không hợp lệ.');
  }
  instant(state.dueAt);
}

export function initialSM2(nowISO: string): SM2State {
  return {
    repetitions: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    dueAt: instant(nowISO).toISOString(),
  };
}

/** Pure update: the caller supplies the clock and persists the returned card. */
export function reviewSM2<T extends SM2State>(card: T, quality: number, nowISO: string): T {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError('Mức nhớ phải là số nguyên từ 0 đến 5.');
  }
  assertState(card);
  const now = instant(nowISO);
  const passed = quality >= 3;
  const repetitions = passed ? card.repetitions + 1 : 0;
  // The source algorithm rounds fractional intervals up and uses the current
  // ease factor for this interval, then updates it for the next repetition.
  const intervalDays = !passed || card.repetitions === 0
    ? 1
    : card.repetitions === 1 ? 6 : Math.ceil(card.intervalDays * card.easeFactor);
  const gap = 5 - quality;
  const easeFactor = Math.max(1.3, Number((card.easeFactor + 0.1 - gap * (0.08 + gap * 0.02)).toFixed(4)));
  const due = new Date(now.getTime());
  due.setUTCDate(due.getUTCDate() + intervalDays);
  return {
    ...card,
    repetitions,
    intervalDays,
    easeFactor,
    dueAt: due.toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

export function isReviewDue(card: Pick<SM2State, 'dueAt'>, nowISO: string): boolean {
  return instant(card.dueAt).getTime() <= instant(nowISO).getTime();
}
