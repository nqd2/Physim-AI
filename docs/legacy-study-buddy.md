# Study Buddy · Express + Android WebView

> Tài liệu lưu trữ của prototype trước `plan.md`. Các lệnh npm bên dưới mô tả dự án cũ; workspace hiện tại dùng pnpm. Chạy prototype bằng `pnpm legacy:start`, kiểm thử bằng `pnpm legacy:test`. Xem README ở thư mục gốc để chạy Physim-AI mới.

Giao diện được triển khai từ `UI.html`: nền hồng/tím, font Fredoka/Nunito, thẻ viền đậm, thanh điều hướng và luồng bài học. Giữ nội dung tiếng Anh như bản thiết kế. `UI.html` được giữ nguyên; các màn hình tham khảo đã giải nén nằm trong `reference/`.

```text
Android WebView ── HTTP(S) ── Express
                              ├─ web/             giao diện + font
                              ├─ /api/uploads     nhận ảnh
                              ├─ /api/state       tải tiến độ
                              ├─ /api/sessions    lưu kết quả
                              └─ data/            dữ liệu trên server
```

Android chỉ chứa WebView và các tích hợp hệ thống như camera, chọn ảnh, nút Back, lỗi kết nối. HTML/CSS/JS được tải từ Express. Thay đổi giao diện trên server sẽ có hiệu lực khi tải lại app, không cần đóng gói lại APK.

## Chạy server

Cần Node.js 22 trở lên.

```powershell
npm ci
npm start
```

Mở `http://localhost:3000` trên máy host. Terminal in địa chỉ IP LAN để điện thoại kết nối. Server lắng nghe `0.0.0.0:3000` theo mặc định; điện thoại dùng IP của máy host, không dùng `localhost`.

Đổi cổng hoặc nơi lưu dữ liệu bằng biến môi trường:

```powershell
$env:PORT = '3000'
$env:HOST = '0.0.0.0'
$env:DATA_DIR = 'D:\study-buddy-data'
npm start
```

Hai thiết bị cần truy cập được cùng mạng. Nếu điện thoại không mở được URL, kiểm tra server đang chạy, IP LAN, Wi-Fi không bật client isolation và firewall của máy cho phép kết nối đến cổng đang dùng. Dùng IP mạng Wi-Fi/Ethernet thực, tránh IP adapter VPN không truy cập được từ điện thoại.

## Chạy trên Android

Máy này đã có bộ công cụ portable trong `.toolchain/`: Temurin JDK 17.0.21, SDK Platform 35 (rev 2), Build Tools 35.0.0, Platform Tools 37.0.1 và Gradle 8.11.1. Không thay đổi Java hoặc PATH toàn hệ thống. Build bằng bộ công cụ này từ thư mục gốc:

```powershell
.\android\build-debug.cmd
```

Trên máy khác, mở thư mục `android/` trong Android Studio, cấu hình JDK 17 / Android SDK 35 / Build Tools 35.0.0 rồi build:

```powershell
cd android
.\gradlew.bat assembleDebug
```

APK sau khi build thành công: `android/app/build/outputs/apk/debug/app-debug.apk`.

Đã build APK debug thành công trên workspace này. Chưa kiểm thử trực tiếp trên điện thoại.

1. Cài APK lên điện thoại Android 8.0 trở lên.
2. Lần đầu mở app, nhập URL Express, ví dụ `http://192.168.1.9:3000` khi máy host đang có IP đó.
3. Nếu chạy Android Emulator trên máy host, nhập `http://10.0.2.2:3000`.
4. Bấm **Kết nối**. Địa chỉ được lưu cho lần mở tiếp theo.

Bản debug cho phép HTTP đến IP LAN; bản release yêu cầu HTTPS. Có thể đổi URL bằng nút Back khi đang ở đầu lịch sử điều hướng hoặc trên màn hình lỗi kết nối. Hướng dẫn đầy đủ: [android/README.md](android/README.md).

`android/toolchain.cmd` cấu hình biến môi trường cho tiến trình build; `android/local.properties` trỏ tới SDK cục bộ. Các công cụ, cache và dữ liệu ký debug trong `.toolchain/` được bỏ qua bởi Git.

## Các chức năng đã nối

- Home: lịch tuần, tiến độ và nhiệm vụ dựa trên kết quả đã lưu.
- Snap: chọn/chụp ảnh, xem trước, upload thật đến Express; kiểm tra JPEG/PNG/WebP, tối đa 10 MB.
- Set up → Pick a demo: nhập thông số của đề bài hoặc dùng bài mẫu.
- Projectile Lab: thanh kéo vận tốc/góc/độ cao, dự đoán tầm xa, chuyển chế độ hiển thị, hoạt ảnh bắn và tính kết quả theo mô hình không có lực cản.
- Result: tầm xa, độ cao cực đại, thời gian bay, điểm và lưu kết quả lên server; có retry khi lỗi.
- Triangle Lab / Teach-back: minh họa định lý Pythagoras, câu hỏi và phản hồi theo đáp án cố định.
- Review / Me: lịch sử buổi học, XP, coins và thông tin server.

Giao diện co giãn cho điện thoại, có nội dung cuộn, vùng an toàn và thanh điều hướng dưới. Font phục vụ từ server, không cần tải Google Fonts trên điện thoại.

## API và dữ liệu

| API | Chức năng |
| --- | --- |
| `GET /api/health` | Trạng thái server |
| `GET /api/state` | Profile, streak, XP, coins, lịch sử |
| `POST /api/uploads` | Multipart form, trường `image`; trả `{id, url, name}` |
| `POST /api/sessions` | JSON `{topic, score, durationSeconds, mode, clientSessionId?}`; trả `{session, state, duplicate}` |

`score` là số nguyên 0–100; `durationSeconds` là số nguyên 0–86400. Client gửi cùng `clientSessionId` khi retry để tránh cộng thưởng hai lần trong lịch sử đang giữ. Server giữ 100 session gần nhất; XP/coins vẫn tích lũy. Streak hiện tính theo ngày UTC.

`data/state.json` chứa tiến độ; `data/uploads/` chứa ảnh. Sao lưu thư mục `data/` để giữ dữ liệu khi chuyển server. Chạy một tiến trình Express cho mỗi thư mục dữ liệu.

Đây là bản UI/prototype với **một profile chung**, chưa có đăng nhập hay tách dữ liệu theo người dùng. Tích hợp AI/OCR chưa có: ảnh được upload, người học tự nhập thông số; các bài mẫu và phản hồi được ghi rõ trong giao diện. Khi đưa lên server công khai, cần bổ sung xác thực, dữ liệu riêng từng tài khoản và đặt Express sau HTTPS reverse proxy.

## Kiểm tra

```powershell
npm test
node --check web/app.js
```

Bộ kiểm tra API bao gồm lưu bền vững sau khởi động lại, request đồng thời, retry không trùng thưởng, upload và giới hạn file, validation, chặn truy cập file riêng. Kiểm tra trình duyệt mobile được thực hiện riêng với Chrome; không thay thế kiểm thử APK trên Android thật.

## Cấu trúc

```text
server.js             Express và API
web/index.html        HTML entry
web/styles.css        giao diện responsive theo UI.html
web/app.js            điều hướng, tương tác, gọi API
web/assets/           font và giấy phép
android/              Android WebView shell và Gradle wrapper
tests/server.test.js  kiểm tra API
UI.html               bản thiết kế gốc
reference/            bản thiết kế đã giải nén
```
