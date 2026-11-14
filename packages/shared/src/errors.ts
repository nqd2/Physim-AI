import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR', 'NOT_FOUND', 'SIMULATION_NOT_READY', 'SIMULATION_VERSION_MISMATCH',
  'UNSUPPORTED', 'INVALID_CONFIG', 'UNKNOWN_PROPERTY', 'READ_ONLY_PROPERTY', 'OUT_OF_RANGE',
  'UNKNOWN_SCREEN', 'UNKNOWN_ACTION', 'BRIDGE_NOT_READY', 'BRIDGE_TIMEOUT', 'STALE_LOAD',
  'INVALID_PROTOCOL', 'AI_NOT_CONFIGURED', 'AI_RATE_LIMIT', 'AI_TIMEOUT', 'AI_REFUSAL',
  'AI_INVALID_RESPONSE', 'AI_UNAVAILABLE', 'IMAGE_TOO_LARGE', 'UNSUPPORTED_IMAGE',
  'NETWORK_ERROR', 'INTERNAL_ERROR'
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export const ApiErrorSchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string(), retryable: z.boolean() }),
  requestId: z.string().optional()
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Dữ liệu gửi lên chưa hợp lệ. Hãy kiểm tra lại thông tin.',
  NOT_FOUND: 'Không tìm thấy nội dung này.',
  SIMULATION_NOT_READY: 'Mô phỏng chưa được đồng bộ. Người quản trị cần chạy pnpm phet:sync.',
  SIMULATION_VERSION_MISMATCH: 'Phiên bản mô phỏng đã thay đổi. Hãy mở lại bài học để kiểm tra cấu hình.',
  UNSUPPORTED: 'Mô phỏng này chưa hỗ trợ thao tác tự động. Bạn vẫn có thể điều khiển trực tiếp.',
  INVALID_CONFIG: 'Cấu hình mô phỏng chưa hợp lệ.',
  UNKNOWN_PROPERTY: 'Đại lượng này không có trong mô phỏng đang mở.',
  READ_ONLY_PROPERTY: 'Đại lượng này chỉ có thể đọc từ mô phỏng.',
  OUT_OF_RANGE: 'Giá trị nằm ngoài khoảng mô phỏng hỗ trợ.',
  UNKNOWN_SCREEN: 'Màn hình mô phỏng không tồn tại.',
  UNKNOWN_ACTION: 'Thao tác này chưa được đăng ký cho màn hình hiện tại.',
  BRIDGE_NOT_READY: 'Mô phỏng chưa sẵn sàng. Hãy chờ một chút rồi thử lại.',
  BRIDGE_TIMEOUT: 'Mô phỏng chưa phản hồi. Hãy tải lại mô phỏng.',
  STALE_LOAD: 'Phản hồi thuộc lượt tải trước và đã được bỏ qua.',
  INVALID_PROTOCOL: 'Phiên bản giao tiếp mô phỏng không tương thích.',
  AI_NOT_CONFIGURED: 'Server chưa cấu hình OpenAI. Bạn có thể học với sáu đề mẫu.',
  AI_RATE_LIMIT: 'AI đang nhận quá nhiều yêu cầu. Hãy đợi một chút rồi thử lại.',
  AI_TIMEOUT: 'AI phản hồi quá lâu. Hãy kiểm tra kết nối rồi thử lại.',
  AI_REFUSAL: 'AI chưa thể xử lý nội dung này. Hãy dùng ảnh đề Vật lý rõ nét hoặc chọn đề mẫu.',
  AI_INVALID_RESPONSE: 'AI trả về dữ liệu chưa hợp lệ. Hãy thử lại.',
  AI_UNAVAILABLE: 'Dịch vụ AI tạm thời chưa sẵn sàng. Bạn có thể tiếp tục bằng đề mẫu.',
  IMAGE_TOO_LARGE: 'Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 10 MB.',
  UNSUPPORTED_IMAGE: 'Hãy chọn ảnh JPEG hoặc PNG.',
  NETWORK_ERROR: 'Không kết nối được với server. Hãy kiểm tra địa chỉ và mạng.',
  INTERNAL_ERROR: 'Server chưa xử lý được yêu cầu. Hãy thử lại.'
};
