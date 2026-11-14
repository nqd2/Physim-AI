# Study Buddy mobile và Web

Ứng dụng Expo Router dùng chung cho Android, iOS và Web. Thiết bị lưu tiến độ và thẻ SM-2; Express phục vụ mô phỏng và bốn API học tập.

Từ thư mục gốc, cài workspace bằng `pnpm install`, chạy `pnpm dev`. Các lệnh riêng:

```text
pnpm --filter @physim/mobile dev
pnpm --filter @physim/mobile android
pnpm --filter @physim/mobile ios
pnpm --filter @physim/mobile check
pnpm --filter @physim/mobile test
pnpm --filter @physim/mobile build
```

Mở **Cài đặt**, nhập URL Express (mặc định cổng 4000) và bấm **Lưu và kiểm tra kết nối**. Điện thoại thật dùng IP LAN, Android Emulator dùng `http://10.0.2.2:4000`. Web phát hành cùng Express tự dùng cùng origin. Không đặt OpenAI API key trong ứng dụng.

Sáu bài mẫu được đóng gói cùng app và có phản hồi theo đáp án tham khảo khi chưa cấu hình AI. Mô phỏng vẫn cần server đã chạy `pnpm phet:sync`. Ảnh chỉ nằm trong bộ nhớ khi gửi; tiến độ lưu kết quả phân tích chứ không lưu ảnh.

Bridge Web kiểm tra cả source window, origin, protocol và nonce mỗi lượt tải; native kiểm tra nonce và chỉ mở URL cùng origin. Mỗi thao tác chờ READY, kiểm tra khả năng/schema trước khi gửi và bỏ các phản hồi từ lượt tải cũ. Các thẻ giữ phiên bản đã ghim: phiên bản không còn sẵn sàng được báo lỗi thay vì âm thầm mở phiên bản khác.

`APP_VARIANT=production` khi prebuild/build native bật yêu cầu HTTPS ở Android/iOS. Bản local cho phép HTTP để nối server LAN. Build iOS yêu cầu macOS/Xcode hoặc một môi trường build iOS phù hợp.

Giao diện giữ phong cách Study Buddy trong `UI.html` và bản `web/`: nền chấm hồng/tím, thẻ bo tròn viền tím đậm, bóng đổ lệch, avatar và năm biểu tượng điều hướng gốc. Trang chủ hiển thị số liệu học thật trên thiết bị; màn `/scan` dành cho chụp/chọn ảnh. Các chức năng Physim, API và mã ứng dụng giữ nguyên.

Font TTF tĩnh được đóng gói trong `assets/fonts`, kèm giấy phép và bằng chứng nguồn. Fredoka dùng cho thương hiệu và chữ số; Nunito 800 dùng cho tiêu đề tiếng Việt vì Fredoka gốc thiếu dấu tiếng Việt. Giao diện hỗ trợ bàn phím/trình đọc màn hình và không dùng chuyển cảnh động; mô phỏng chuyển động theo thao tác học sinh.
