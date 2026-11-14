export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewSchedule {
  repetitions: number;
  intervalDays: number;
  ease: number;
  dueAt: number;
}

export function scheduleReview(previous: ReviewSchedule, grade: ReviewGrade, now: number): ReviewSchedule {
  const difference = 5 - grade;
  const ease = Math.max(1.3, previous.ease + (0.1 - difference * (0.08 + difference * 0.02)));
  const repetitions = grade < 3 ? 0 : previous.repetitions + 1;
  let intervalDays = 1;
  if (repetitions === 2) intervalDays = 6;
  if (repetitions > 2) intervalDays = Math.ceil(previous.intervalDays * previous.ease);
  return { repetitions, intervalDays, ease, dueAt: now + intervalDays * 86400000 };
}
