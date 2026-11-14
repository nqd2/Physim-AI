# Kết quả kiểm chứng Physim-AI

Cập nhật ngày 14/11/2026, phạm vi mục 1–5 của [plan.md](../plan.md). Bảng dưới ghi kết quả đã chạy trong phiên triển khai trên Windows; các mục đang chờ được giữ riêng, không tính là đạt. Server Express và bản Expo Web được kiểm tra tại `http://localhost:4000`.

Theo yêu cầu mới, giao diện đã chuyển về Study Buddy hồng/tím trong `UI.html`, giữ nguyên chức năng mục 1–5. Bản web mới đã export thành công và đạt kiểm tra TypeScript. Kiểm thử lại giao diện mới đạt 5 mục ảnh/lỗi và 3 mục ARIA; luồng chính chạy qua 14 mục trước khi dừng theo yêu cầu, chưa kết luận toàn bộ lượt kiểm thử hoàn tất. Bảng kết quả đầy đủ bên dưới thuộc đợt trước khi đổi giao diện. Một chỉnh font nhỏ cho dữ liệu văn bản trong lab đã lưu ở source sau lần export cuối, chưa build lại.

## Kết quả đã chạy

| Hạng mục | Kết quả | Phạm vi bằng chứng |
| --- | --- | --- |
| `pnpm check` | Đạt | Kiểm tra TypeScript tại workspace và staging nguồn sạch. |
| `pnpm test` | 61/61 đạt | Chạy lại tại staging: shared 18, server 20, mobile 6, pipeline/bridge 17; gồm hợp đồng giữa sáu bài mẫu với adapter. |
| `pnpm build` | Đạt | Build shared, server và xuất Expo Web tại workspace và staging. Đây chưa phải kết quả build APK. |
| Khởi chạy PhET | 74/74 đạt | Chrome thực sự mở mô phỏng của generation `5dd63234f47de7c765be`; không chỉ kiểm tra HTTP hay phần đầu HTML. |
| Sáu bài mẫu | 6/6 đạt | Cấu hình gốc và biến thể chạy qua giao diện với PhET thật; radio dùng được ở 320 px, không tràn ngang, không lỗi JavaScript, không gọi AI. Sáu bài mẫu cũng đạt kiểm thử bridge trên bundle thật. |
| Luồng Web chính | 16 mục đạt | Danh mục/tìm kiếm, cấu hình server, mất mạng/thử lại, bốn bước bài Ohm với số liệu PhET thật, lưu phiên, SM-2, mở lại đúng cấu hình và phiên bản. Tải lại iframe đổi load ID và áp lại cấu hình; lưu lại thẻ giữ lịch ôn. |
| Ảnh và trạng thái lỗi | 5 mục đạt | Chọn PNG qua hộp chọn tệp thật; ảnh mờ và không có mô phỏng dùng phản hồi giả lập; mất mạng dùng chặn request. Bài học văn bản giữ gợi ý sau tải lại, không lưu ảnh vào tiến độ. |
| ARIA và giảm chuyển động | 3 mục đạt | Trạng thái tab/bộ lọc, lựa chọn dự đoán/bước mở và tùy chọn giảm chuyển động được kiểm tra trong trình duyệt. Chưa thay thế kiểm tra bằng trình đọc màn hình thật. |
| OpenAI thật | 4/4 endpoint đạt | Đợt tích hợp dùng ảnh đề tự soạn: analyze-photo khoảng 7,9 giây; check-work 4,9 giây; evaluate-teach-back 2,0 giây; generate-variant 2,6 giây. Đây là một lượt đo, không phải cam kết độ trễ. |
| Phạm vi public và khóa AI | Đạt | Rà 34 tệp Web không có khóa; 12 đường dẫn riêng tư trả HTTP 404. |
| Cấu hình Docker Compose | Đạt | `docker compose config` hợp lệ; chưa build hoặc chạy container. |

Luồng Web đã rà các màn chính và lab ở chiều rộng 320, 390, 768; không phát hiện tràn ngang hoặc ngoại lệ JavaScript chưa xử lý trong lượt chạy. Kiểm thử ảnh không gửi dữ liệu tới OpenAI khi health báo đã có khóa: hai phản hồi được giả lập và một request bị chặn. Nhánh lỗi thiếu khóa thật được bỏ qua ở lượt này; kết quả OpenAI thật đến từ đợt tích hợp API riêng.

## Mục đang chờ

| Hạng mục | Trạng thái |
| --- | --- |
| APK Physim-AI mới | Chưa tạo được: Ninja gặp đường dẫn object của Gesture Handler dài hơn giới hạn 260 ký tự trên Windows. Đã dừng build theo yêu cầu, chưa sửa hoặc chạy lại. APK Study Buddy cũ không phải bằng chứng nghiệm thu app mới. |
| Phiên học đầy đủ trên Android vật lý | Chưa thực hiện. Viewport điện thoại trong Chrome không thay thế WebView trên thiết bị. |
| Phiên học đầy đủ trên iOS vật lý | Chưa thực hiện; môi trường hiện tại là Windows. |
| Docker image, container và HTTPS/Caddy | Chưa chạy thực tế vì Docker daemon không sẵn sàng. Kiểm tra cấu hình Compose đạt; xem [hướng dẫn triển khai](deployment.md). |

## Cài dependency trong staging sạch

Staging `.qa/clean-checkout` được tạo từ nguồn mới sao chép, không mang theo `.env` hoặc `node_modules`. Cài dependency bằng pnpm JS 11.28.12 với frozen lockfile, `--prefer-offline --ignore-scripts`: liên kết 641 package từ cache, không tải package mới; 640 mục supply chain được giữ. Chỉ trường `engines.pnpm` trong bản staging được tạm bỏ khi bootstrap rồi khôi phục đúng từng byte trước khi chạy pnpm 12.21.0. `packageManager` vẫn ghim 12.21.0. Lockfile hai tài liệu YAML với đủ bốn importer hợp lệ, hash SHA-256 giữ nguyên sau cài đặt và check/test/build.

Bước `install` bằng pnpm 12 native vẫn gặp lỗi khóa store trong hồ sơ người dùng của runner Windows hạn chế quyền. Các lệnh check/test/build tại staging dùng pnpm 12 thật với `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`. Xem [hướng dẫn Windows](../README.md#bộ-công-cụ-windows-trong-workspace-này). Kết quả staging xác nhận quy trình bootstrap đã nêu; cài mới hoàn toàn bằng pnpm 12 native trong runner này chưa đạt.

## Chạy lại từ checkout

Theo [hướng dẫn triển khai](deployment.md) để cài dependency, đồng bộ PhET, build và khởi động Express. [Hướng dẫn kiểm thử](../tests/README.md) mô tả điều kiện chạy, biến môi trường và nơi xuất báo cáo cho các bộ chạy được lưu trong repo:

- [Luồng Web chính](../tests/browser-ui.mjs).
- [Ảnh, phản hồi giả lập và lỗi mạng](../tests/browser-photo-errors.mjs).
- [ARIA và giảm chuyển động](../tests/browser-aria.mjs).
- [Sáu bài mẫu qua giao diện](../tests/browser-samples.mjs).
- [Khởi chạy 74 mô phỏng](../scripts/verify-phet-browser.mjs).
- [Bridge trên HTML PhET thật](../tests/bridge-browser.mjs) và [hợp đồng bài mẫu/adapter](../tests/bridge-sample-contract.test.mjs).

Các JSON kết quả và ảnh chụp trong `.qa/` là đầu ra cục bộ bị bỏ qua bởi Git, không được giả định có trong checkout mới. Harness đã được chuyển vào `tests/` và kiểm tra cú pháp; bộ ARIA chạy lại từ thư mục `tests` đạt 3 mục, xác nhận đường dẫn đầu ra không phụ thuộc thư mục chạy. Luồng Web và ảnh không chạy lại chỉ vì di chuyển file. Các harness được giữ lại chặn request học tập thật và chỉ dùng ảnh do test tự tạo. Lượt chạy mới ghi báo cáo trong `.test-artifacts/browser/`. Tài liệu này giữ lại kết quả đã quan sát; chạy lại harness sẽ tạo bằng chứng mới cho mã nguồn và môi trường lúc chạy. Không đưa khóa API, ảnh người học hoặc nội dung bí mật vào báo cáo.
