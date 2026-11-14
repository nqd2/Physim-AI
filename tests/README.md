# Kiểm thử trình duyệt

Các harness trong thư mục này được giữ cùng mã nguồn để chạy lại từ checkout mới. Chúng dùng Playwright Core đã có trong dependency và Chrome cài trên máy; không cần tải browser của Playwright.

Trước khi chạy, hoàn thành `pnpm install --frozen-lockfile`, `pnpm phet:sync`, `pnpm build`, rồi giữ Express chạy bằng `pnpm start`. Quy trình cài đặt và ngoại lệ runner Windows được mô tả trong [README gốc](../README.md). Xem [kết quả nghiệm thu](../docs/verification.md) để phân biệt các kiểm tra đã chạy với phần còn chờ.

## Chạy

Tại thư mục gốc, với Express phục vụ cả Web và API ở `http://localhost:4000`:

```sh
node tests/browser-ui.mjs
node tests/browser-photo-errors.mjs
node tests/browser-aria.mjs
node tests/browser-samples.mjs
```

| Harness | Nội dung |
| --- | --- |
| `browser-ui.mjs` | Luồng Ohm đủ bốn bước, cấu hình PhET thật, lưu phiên/thẻ, SM-2, tải lại iframe, lỗi kết nối và bố cục 320/390/768. |
| `browser-photo-errors.mjs` | Chọn PNG do test tự tạo, phản hồi ảnh không đọc được, bài không có mô phỏng, mất kết nối và không lưu ảnh trong tiến độ. |
| `browser-aria.mjs` | Trạng thái tab/radio/bước học trong accessibility tree và môi trường reduced motion. Không thay thế kiểm thử bằng trình đọc màn hình thật. |
| `browser-samples.mjs` | Cả sáu bài mẫu: áp cấu hình gốc, đo số liệu, kiểm chứng biến thể qua giao diện và rà lựa chọn tại 320 px. |

Các lệnh trả exit code khác 0 khi thất bại. JSON và ảnh chụp được ghi vào `.test-artifacts/browser/` ở gốc checkout, tự tạo khi cần và được Git bỏ qua. Không phụ thuộc thư mục `.qa/` của phiên phát triển. Có thể chạy script bằng đường dẫn tuyệt đối từ thư mục khác.

Tất cả request `/api/v1/learning/**` đều bị chặn mặc định. Harness ảnh chỉ trả response giả lập hoặc chủ động ngắt request, **không chuyển ảnh tới server/OpenAI**, kể cả khi server có khóa. Harness giao tiếp với API health/danh mục và HTML mô phỏng thật. Fixture PNG được tạo trong bộ nhớ; không dùng ảnh hay khóa của người dùng. Kiểm thử thiếu khóa và provider thuộc bộ kiểm thử backend; tích hợp OpenAI thật là lệnh riêng có chủ đích.

## Tùy chọn

| Biến môi trường | Mặc định / tác dụng |
| --- | --- |
| `PHYSIM_WEB_URL` | `http://localhost:4000`, địa chỉ Web đã build. |
| `PHYSIM_API_URL` | Cùng `PHYSIM_WEB_URL`. Nếu dùng Expo Web ở cổng khác, cấu hình origin đó trong `ALLOWED_ORIGINS` của server. |
| `CHROME_PATH` | Khi bỏ trống, dùng Chrome stable cài trên máy. Có thể trỏ tới executable Chrome/Chromium bằng đường dẫn tuyệt đối. |
| `PHYSIM_BROWSER_OUTPUT` | `.test-artifacts/browser`; đường dẫn tương đối được tính từ gốc checkout. |
| `PHYSIM_SKIP_LAYOUT` | Chỉ `1` mới bỏ kiểm tra đa kích thước trong `browser-ui.mjs`; báo cáo ghi rõ đã bỏ qua. Không dùng để nghiệm thu đầy đủ. |
| `PHYSIM_LESSON` | Chỉ dùng với `browser-samples.mjs`: ID chính xác của một bài mẫu để kiểm tra riêng. Khi bỏ trống, chạy đủ sáu bài; ID không hợp lệ bị từ chối. |

Ví dụ PowerShell:

```powershell
$env:PHYSIM_WEB_URL='http://localhost:4000'
$env:PHYSIM_API_URL='http://localhost:4000'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/browser-ui.mjs
```

Các kiểm tra tải đủ 74 mô phỏng và điều khiển sáu adapter được giữ riêng:

```sh
pnpm phet:verify
node tests/bridge-browser.mjs
```

`phet:verify` mặc định dựng HTTP harness tạm từ generation đang hoạt động. Để kiểm tra thêm route Express với một mô phỏng:

```sh
node scripts/verify-phet-browser.mjs --base-url=http://localhost:4000 --slugs=ohms-law --report=.test-artifacts/browser/express-ohm.json
```

Các bài kiểm thử trình duyệt không nằm trong `pnpm test`: cần Chrome, bộ HTML PhET đã đồng bộ và server đang chạy. Chạy chúng sau các kiểm tra tự động thông thường.
