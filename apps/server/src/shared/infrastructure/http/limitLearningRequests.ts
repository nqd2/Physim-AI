import type { RequestHandler } from 'express';
import { DomainError } from '../../domain/DomainError.ts';

const windowMs = 60_000;

export function limitLearningRequests({ perMinute = 60, concurrent = 8 } = {}) {
  const counts = new Map<string, number>();
  let windowEnd = 0;
  let pending = 0;

  return (handler: RequestHandler): RequestHandler => async (request, response, next) => {
    const now = Date.now();
    if (now >= windowEnd) {
      counts.clear();
      windowEnd = now + windowMs;
    }
    if (pending >= concurrent) {
      response.setHeader('Retry-After', '3');
      throw new DomainError('AI_BUSY', 429, 'Máy chủ đang xử lý nhiều yêu cầu AI. Hãy thử lại sau vài giây.');
    }
    const ip = request.ip ?? 'unknown';
    const count = counts.get(ip) ?? 0;
    if (count >= perMinute) {
      response.setHeader('Retry-After', String(Math.ceil((windowEnd - now) / 1000)));
      throw new DomainError('AI_REQUEST_LIMIT', 429, 'Bạn đã gửi nhiều yêu cầu AI. Hãy thử lại sau một phút.');
    }
    counts.set(ip, count + 1);
    pending++;
    try {
      await handler(request, response, next);
    } finally {
      pending--;
    }
  };
}

export type LearningRequestLimiter = ReturnType<typeof limitLearningRequests>;
