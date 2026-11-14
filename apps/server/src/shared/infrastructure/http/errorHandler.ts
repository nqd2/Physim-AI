import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '../../domain/DomainError.ts';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) return next(error);
  if (error instanceof DomainError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError || (error instanceof SyntaxError && 'status' in error && error.status === 400)) {
    response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Thông tin gửi lên chưa hợp lệ. Hãy kiểm tra và thử lại.' } });
    return;
  }
  if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu vượt quá dung lượng cho phép.' } });
    return;
  }
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Máy chủ gặp lỗi. Hãy thử lại.' } });
};
