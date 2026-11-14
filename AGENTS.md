# AGENTS.md

Physim-AI là ứng dụng thực hành Vật lý THPT bằng tiếng Việt. Xem [PRODUCT.md](PRODUCT.md) để hiểu luồng học và [DESIGN.md](DESIGN.md) trước khi sửa giao diện.

## Workspace

- `apps/mobile` dùng Expo Router cho Android, iOS và Web. Chỉ lớp hiển thị PhET phụ thuộc nền tảng.
- `apps/server` dùng Express và Modular DDD. Đặt hành vi nghiệp vụ trong use case của bounded context tương ứng. Tạo adapter cho filesystem và OpenAI ở infrastructure. Giữ domain độc lập với Express, SDK và lưu trữ.
- `packages/shared` chứa Zod schema, kiểu DTO và giao thức bridge dùng chung. Thay đổi giao thức phải được kiểm thử ở cả hai đầu.
- `scripts` tải mô phỏng PhET theo manifest và kiểm thử bridge. Tệp HTML tải về, catalog sinh ra và ảnh học sinh không thuộc Git.

## PhET và AI

- Ghim slug, phiên bản và chương trong manifest. Mỗi lần đồng bộ phải tạo catalog hoàn chỉnh trước khi thay catalog đang chạy.
- Dùng bản HTML công khai, giữ logo và thông báo giấy phép. Ghi công PhET tại phòng lab. Bản thí điểm phục vụ giáo dục phi thương mại.
- Mọi lệnh mô phỏng phải qua khả năng khai báo theo màn hình và phiên bản. Chỉ dùng adapter đã kiểm thử để ghi giá trị hoặc chạy thao tác. AST cung cấp thông tin tham khảo khi có nguồn phù hợp.
- Giữ khóa OpenAI ở server. Không ghi log ảnh, nội dung bài làm hay khóa. Kiểm tra output AI bằng Zod rồi đối chiếu cấu hình mô phỏng với catalog.
- Lưu phiên học và thẻ ôn tập trên thiết bị. Tránh ghép dữ liệu hiển thị giả vào số liệu mô phỏng.

## Kiểm tra

Chạy `pnpm check`, `pnpm test`, `pnpm build` trước khi đẩy. Với thay đổi PhET, chạy đồng bộ rồi kiểm thử browser. Với thay đổi UI, xem bản Web ở 320, 390, 768 và 1440 px. Kiểm tra bàn phím, chữ tiếng Việt, trạng thái tải và lỗi. Ghi rõ các nền tảng chưa kiểm tra được.
