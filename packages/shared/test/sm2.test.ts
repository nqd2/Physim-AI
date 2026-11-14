import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSM2, isReviewDue, reviewSM2 } from '../src/sm2.ts';

test('successful recalls follow one, six, then ease-scaled days without mutation', () => {
  const original = { ...initialSM2('2026-11-14T08:00:00Z'), id: 'saved-card', slug: 'ohms-law' };
  const first = reviewSM2(original, 4, '2026-11-14T08:00:00Z');
  const second = reviewSM2(first, 4, '2026-11-15T08:00:00Z');
  const third = reviewSM2(second, 4, '2026-11-21T08:00:00Z');
  assert.equal(first.intervalDays, 1);
  assert.equal(second.intervalDays, 6);
  assert.equal(third.intervalDays, 15);
  assert.equal(third.dueAt, '2026-12-06T08:00:00.000Z');
  assert.equal(third.repetitions, 3);
  assert.equal(third.easeFactor, 2.5);
  assert.equal(third.id, 'saved-card');
  assert.equal(third.slug, 'ohms-law');
  assert.equal(original.repetitions, 0);
  assert.equal(original.lastReviewedAt, undefined);
});

test('failed recall restarts the interval sequence while preserving learned difficulty', () => {
  const mature = { repetitions: 4, intervalDays: 40, easeFactor: 2.5, dueAt: '2026-11-14T08:00:00Z' };
  const failed = reviewSM2(mature, 2, '2026-11-14T08:00:00Z');
  assert.equal(failed.repetitions, 0);
  assert.equal(failed.intervalDays, 1);
  assert.equal(failed.easeFactor, 2.18);
  const relearned = reviewSM2(failed, 4, '2026-11-15T08:00:00Z');
  assert.equal(relearned.repetitions, 1);
  assert.equal(relearned.intervalDays, 1);
  assert.equal(relearned.easeFactor, 2.18);
});

test('quality boundaries affect ease and never reduce it below 1.3', () => {
  let card = initialSM2('2026-11-14T00:00:00Z');
  for (let i = 0; i < 20; i++) card = reviewSM2(card, 0, '2026-11-14T00:00:00Z');
  assert.equal(card.easeFactor, 1.3);
  assert.equal(card.repetitions, 0);
  const good = reviewSM2(card, 5, '2026-11-14T00:00:00Z');
  assert.equal(good.easeFactor, 1.4);
  const difficult = reviewSM2(initialSM2('2026-11-14T00:00:00Z'), 3, '2026-11-14T00:00:00Z');
  assert.equal(difficult.repetitions, 1);
  assert.equal(difficult.easeFactor, 2.36);
});

test('fractional intervals round up using prior ease, and UTC dates cross leap day', () => {
  const card = { repetitions: 2, intervalDays: 6, easeFactor: 2.36, dueAt: '2028-02-28T18:15:00Z' };
  const scheduled = reviewSM2(card, 5, '2028-02-28T18:15:00Z');
  assert.equal(scheduled.intervalDays, 15);
  assert.equal(scheduled.dueAt, '2028-03-14T18:15:00.000Z');
  assert.equal(scheduled.easeFactor, 2.46);
  const initial = reviewSM2(initialSM2('2028-02-28T18:15:00Z'), 4, '2028-02-28T18:15:00Z');
  assert.equal(initial.dueAt, '2028-02-29T18:15:00.000Z');
});

test('due comparison is inclusive and compares instants across timezone offsets', () => {
  const card = initialSM2('2026-11-14T08:00:00Z');
  assert.equal(isReviewDue(card, '2026-11-14T14:59:59+07:00'), false);
  assert.equal(isReviewDue(card, '2026-11-14T15:00:00+07:00'), true);
  assert.equal(isReviewDue(card, '2026-11-15T00:00:00Z'), true);
});

test('invalid grades, dates and corrupted stored schedules are rejected', () => {
  const card = initialSM2('2026-11-14T00:00:00Z');
  for (const quality of [-1, 6, 2.5, NaN, Infinity]) {
    assert.throws(() => reviewSM2(card, quality, '2026-11-14T00:00:00Z'), RangeError);
  }
  assert.throws(() => initialSM2('not a date'), RangeError);
  assert.throws(() => reviewSM2(card, 4, 'not a date'), RangeError);
  assert.throws(() => reviewSM2({ ...card, repetitions: -1 }, 4, '2026-11-14T00:00:00Z'), RangeError);
  assert.throws(() => reviewSM2({ ...card, easeFactor: Infinity }, 4, '2026-11-14T00:00:00Z'), RangeError);
  assert.throws(() => isReviewDue({ dueAt: 'broken' }, '2026-11-14T00:00:00Z'), RangeError);
});
