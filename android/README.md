# Android WebView — Study Buddy

App Android tải giao diện từ **server Express**. HTML, CSS, JavaScript và API không được đóng gói trong APK. Khi cập nhật giao diện trên server, điện thoại nhận bản mới khi tải lại app.

## Build APK

Công cụ đã cài sẵn cho workspace này tại `../.toolchain/`: Temurin JDK 17.0.21+9, Android SDK Platform 35 rev 2, Build Tools 35.0.0, Platform Tools 37.0.1 và Gradle 8.11.1. Chạy từ thư mục gốc dự án:

```powershell
.\android\build-debug.cmd
```

Script dùng công cụ cục bộ và cache trong `.toolchain/`, không đổi Java/PATH toàn hệ thống và không yêu cầu thay đổi Execution Policy của PowerShell. `toolchain.cmd` có thể được `call` từ cửa sổ cmd để cấu hình phiên đó. Nếu dùng máy khác, làm theo các bước dưới.

Cần **JDK 17**, **Android SDK Platform 35**, **Build Tools 35.0.0** và kết nối mạng để tải Gradle/Android Gradle Plugin lần đầu. Có thể cài các thành phần này bằng Android Studio; chọn Gradle JDK 17 trong cấu hình IDE.

1. Mở thư mục `android/` bằng Android Studio.
2. Cấu hình SDK bằng Android Studio hoặc tạo `android/local.properties` với đường dẫn SDK, ví dụ:

   ```properties
   sdk.dir=C\:\\Users\\YOUR_USER\\AppData\\Local\\Android\\Sdk
   ```

3. Chọn biến thể **debug**, rồi chạy trên thiết bị hoặc build bằng PowerShell từ thư mục `android/`:

   ```powershell
   .\gradlew.bat assembleDebug
   ```

APK nằm tại `app/build/outputs/apk/debug/app-debug.apk`. Có thể chép APK lên điện thoại để cài hoặc dùng:

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Gradle wrapper 8.11.1 đã kèm trong repo; checksum JAR đã đối chiếu với Gradle, và checksum bản phân phối được ghim trong `gradle-wrapper.properties`. AGP 8.9.2 / Gradle 8.11.1 / JDK 17 theo [bảng tương thích Android chính thức](https://developer.android.com/build/releases/agp-8-9-0-release-notes).

## Kết nối Express

Khởi động server từ thư mục gốc theo README của dự án. Server phải lắng nghe trên `0.0.0.0`, không chỉ `127.0.0.1`.

- **Điện thoại thật:** điện thoại và máy host cùng mạng Wi-Fi, nhập `http://<IP-LAN-của-máy>:3000` trên màn hình đầu tiên của app debug. Xem IP của máy bằng `ipconfig`; mở cổng TCP 3000 trên firewall nếu mạng đang chặn.
- **Android Emulator:** nhập `http://10.0.2.2:3000`.
- **Server công khai:** đặt Express sau reverse proxy HTTPS có chứng chỉ hợp lệ, rồi nhập URL HTTPS của server. Bản release chỉ chấp nhận HTTPS.

`localhost` trên điện thoại là chính điện thoại, không phải máy đang chạy Express. Không cần chỉnh URL API trong app vì trang web gọi API cùng origin với server phục vụ giao diện.

App ghi nhớ URL. Bấm **Quay lại** cho đến khi hết lịch sử web để mở menu **Đổi địa chỉ server**. Khi mất kết nối có nút **Thử lại** và **Đổi địa chỉ server**. Đổi URL sẽ xóa cookie và dữ liệu web cục bộ của shell để tránh mang phiên đăng nhập sang server khác.

## Chức năng native

- JavaScript, DOM storage, cookie first-party và nút Quay lại hoạt động trong WebView.
- `<input type="file" accept="image/*">` mở thư viện ảnh và lựa chọn chụp ảnh. Nếu có thuộc tính `capture`, app mở camera trực tiếp khi camera có sẵn. Không cần quyền đọc toàn bộ bộ nhớ hoặc quyền camera thường trực; app camera nhận quyền ghi tạm thời vào một file riêng.
- Điều hướng trong WebView giới hạn cùng scheme/host/port với URL đã chọn. Liên kết HTTP(S) khác origin do người dùng bấm mở trong trình duyệt; các scheme khác bị chặn.
- Bản release chặn HTTP; bản debug chỉ cho phép URL HTTP localhost/IP LAN. Lỗi chứng chỉ HTTPS không được bỏ qua. Không có JavaScript bridge native.
- Bản debug cho phép kiểm tra WebView bằng Chrome `chrome://inspect`; bản release tắt chức năng này.

## Kiểm tra đã thực hiện

Đã kiểm tra XML/Gradle wrapper và chạy 39 kiểm tra chính sách URL bằng JDK có sẵn. Kiểm tra URL độc lập Android SDK:

```powershell
New-Item -ItemType Directory -Force build/url-policy | Out-Null
javac -encoding UTF-8 -d build/url-policy app/src/main/java/com/kawaii/studybuddy/UrlPolicy.java tests/UrlPolicyCheck.java
java -cp build/url-policy com.kawaii.studybuddy.UrlPolicyCheck
```

JDK và các ZIP công cụ đã được kiểm tra checksum theo nguồn Adoptium/Google/Gradle; `java`, `javac`, `sdkmanager --list_installed` và `aapt2` đã chạy thành công.

Đã build `assembleDebug` thành công bằng bộ công cụ này. APK: `app/build/outputs/apk/debug/app-debug.apk` (app ID `com.kawaii.studybuddy.debug`, Android 8.0/API 26 trở lên).

Chưa kiểm tra trên điện thoại thật. `adb` trong phiên thực thi bị lỗi tra cứu profile Windows (`Cannot mkdir '\.android': Permission denied`); hãy chạy `adb` từ terminal Windows thông thường để kết nối thiết bị. Sau khi cài APK, kiểm tra tải trang, nút Quay lại, xoay màn hình, chụp/chọn ảnh và mất kết nối trên thiết bị thật.

Bản phát hành cần ký bằng keystore của bạn qua Android Studio → Generate Signed Bundle / APK; repo không chứa khóa ký hoặc cấu hình chữ ký cá nhân.
