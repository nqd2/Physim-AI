import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleReview } from '../src/shared/sm2.ts';

const day = 86400000;
const now = Date.UTC(2026, 10, 14);
const initial = { repetitions: 0, intervalDays: 0, ease: 2.5, dueAt: now };

test('schedules successful repetitions at 1, 6, and 15 days', () => {
  const first = scheduleReview(initial, 4, now);
  const second = scheduleReview(first, 4, first.dueAt);
  const third = scheduleReview(second, 4, second.dueAt);
  assert.equal(first.dueAt, now + day);
  assert.equal(second.intervalDays, 6);
  assert.equal(third.intervalDays, 15);
  assert.equal(third.repetitions, 3);
});

test('lapse restarts interval and clamps the ease factor', () => {
  const result = scheduleReview({ ...initial, ease: 1.4, repetitions: 3 }, 0, now);
  assert.deepEqual(result, { repetitions: 0, intervalDays: 1, ease: 1.3, dueAt: now + day });
});
