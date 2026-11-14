# Triển khai Physim-AI trên server

Server Express phục vụ API, giao diện Expo đã xuất web và các tệp PhET từ cùng một địa chỉ. Điện thoại dùng địa chỉ server để gọi API và mở mô phỏng trong WebView. Bản này dành cho thí điểm giáo dục phi thương mại; xem [ghi công và giấy phép PhET](../scripts/phet-license-notes.md).

Các tệp bên dưới chuẩn bị việc triển khai trên server của bạn. Chưa có tên miền hay server Internet nào được triển khai trong phiên làm việc này. Máy hiện tại có Docker CLI nhưng Docker daemon chưa chạy, nên chưa xác nhận được build/container/Caddy bằng Docker thực tế.

## Chạy trực tiếp từ mã nguồn

Cần Node.js 24 và pnpm 12.21.0. Chạy tại thư mục gốc của checkout:

```sh
npm install --global pnpm@12.21.0
pnpm install --frozen-lockfile
pnpm phet:sync
pnpm check
pnpm test
pnpm build
pnpm start
```

`pnpm start` chạy Express ở `0.0.0.0:4000`. Giao diện nằm tại `http://localhost:4000`, health check tại `/api/v1/health`. Lần đồng bộ PhET đầu cần Internet và tải khoảng 210 MiB HTML gốc; bản đã chèn bridge được lưu riêng nên dung lượng cache lớn hơn. `pnpm build` tạo `apps/mobile/dist`; không dùng Expo development server để phục vụ bản triển khai.

Tạo `.env` từ `.env.example` nếu chưa có; giữ nguyên tệp đã chứa khóa của bạn. Mở tệp bằng trình soạn thảo và điền `OPENAI_API_KEY` nếu cần phân tích ảnh/phản hồi AI. Không đưa khóa vào `EXPO_PUBLIC_*`, giao diện, APK hay lệnh build. Không có khóa vẫn dùng được sáu bài mẫu và thư viện mô phỏng; các yêu cầu AI cần khóa hợp lệ.

Ứng dụng server hiện chạy mã TypeScript bằng `node --experimental-transform-types`; package shared cũng trỏ tới mã nguồn TypeScript. Khi tự đóng gói, phải giữ `apps/server/src`, `packages/shared/src`, dữ liệu shared và các dependency, thay vì chỉ chép thư mục `dist` của server.

## Build image và thử trên máy

Trên máy có Docker Engine chạy Linux containers:

```sh
docker build --tag physim-ai:pilot .
docker run --detach --name physim-local --publish 127.0.0.1:4000:4000 physim-ai:pilot
curl --fail http://localhost:4000/api/v1/health
```

Container này không truyền khóa và đủ để kiểm tra sáu bài mẫu, giao diện, thư viện PhET. Khi cần thử AI, tạo lại container với `--env-file .env`; kiểm tra `.env` không ghi đè `HOST`, `PORT` hoặc các đường dẫn container. Dừng và xóa riêng container thử bằng `docker stop physim-local` rồi `docker rm physim-local`.

Image dùng Node 24 và pnpm 12.21.0, cài dependency từ `pnpm-lock.yaml`, chạy build và `pnpm phet:sync`. Docker context chỉ cho phép source cần thiết; `.env`, ảnh/dữ liệu của prototype, toolchain, `node_modules` của máy và cache PhET cũ không được gửi vào build. Runtime giữ nguyên bộ dependency đã cài, bao gồm một số công cụ build, để bảo toàn workspace liên kết; đây chưa phải image tối ưu dung lượng.

Các phiên bản PhET lấy từ `packages/shared/data/phet-catalog.lock.json`, SHA-256 được đối chiếu với `phet-manifest.json`. Chỉ adapter đã xác minh đúng phiên bản và hash mới có quyền cấu hình mô phỏng; sáu adapter nằm trong `adapter-schemas.json`. Đồng bộ thất bại làm build thất bại; không âm thầm thay phiên bản hoặc dùng tệp chưa xác minh. Build vẫn phụ thuộc khả năng truy cập metadata PhET và tệp nguồn đã ghim. Các tag image nền `node:24-bookworm-slim` và `caddy:2-alpine` nhận bản vá mới; bản build chưa bảo đảm đồng nhất từng byte. Nếu cần phát hành cố định, ghi lại image digest đã build/kiểm thử để triển khai và rollback.

## HTTPS bằng Docker Compose và Caddy

Cần một tên miền trỏ A/AAAA tới server, Docker Engine/Compose và cổng TCP 80/443 có thể truy cập từ Internet. Cổng UDP 443 cho HTTP/3 là tùy chọn. Nếu dùng NAT, chuyển tiếp các cổng này tới server; xóa bản ghi AAAA sai nếu server chưa có IPv6 hoạt động. Không công khai cổng Express 4000.

Tại checkout trên server, thêm vào `.env` (không thêm tiền tố `https://` hay đường dẫn cho tên miền):

```dotenv
PHYSIM_DOMAIN=physim.example.org
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini-2026-03-17
```

Thay `physim.example.org` bằng tên miền thật. Điền khóa bằng trình soạn thảo nếu cần AI; đây là biến môi trường runtime. Có thể dùng một tệp riêng qua `docker compose --env-file /duong-dan/physim.env ...` thay vì `.env`. [Compose nội suy biến môi trường](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) vào cấu hình; tránh chia sẻ kết quả `docker compose config` đầy đủ vì nó có thể chứa khóa. Lệnh `--quiet` bên dưới chỉ kiểm tra tính hợp lệ.

```sh
docker compose config --quiet
docker compose build
docker compose up --detach
docker compose ps
curl --fail https://physim.example.org/api/v1/health
```

Caddy chuyển tiếp toàn bộ giao diện, API, `/bridge` và `/simulations` tới `physim:4000`, giữ cùng origin. Với tên miền đúng và cổng thông, [Caddy tự cấp/gia hạn chứng chỉ và chuyển HTTP sang HTTPS](https://caddyserver.com/docs/automatic-https). Hai volume `caddy_data` và `caddy_config` giữ trạng thái chứng chỉ; không xóa chúng khi cập nhật ứng dụng. Container ứng dụng chỉ mở cổng 4000 trong mạng Compose và chạy bằng user `node`.

Trên điện thoại, mở `https://physim.example.org`. Trong bản Expo native, vào **Cài đặt → Địa chỉ server**, nhập cùng URL rồi chọn **Lưu và kiểm tra kết nối**. `localhost` trên điện thoại là chính điện thoại. Nếu đã dùng một reverse proxy HTTPS khác, có thể chạy image Express sau proxy đó thay vì dùng dịch vụ Caddy; giữ cả giao diện, API và PhET cùng origin, và giới hạn cổng 4000 ở mạng nội bộ.

Compose không có tài khoản/đăng nhập hoặc giới hạn chi phí AI theo người dùng. CORS chỉ kiểm soát trình duyệt, không xác thực người gọi API. Với khóa AI, giới hạn người truy cập bằng mạng/VPN hoặc cổng truy cập có xác thực của đơn vị trước khi mở thí điểm; chưa phù hợp để mở API AI cho Internet không hạn chế. Tiến độ, phiên học và thẻ ôn tập lưu trên thiết bị. Server không có cơ sở dữ liệu người dùng và không lưu ảnh đề/bài làm; nội dung gửi tới chức năng AI được chuyển tới OpenAI để xử lý.

## Kiểm tra sau triển khai và cập nhật

1. Health check trả `ok: true`; `ai.configured` chỉ cho biết có cấu hình khóa, chưa chứng minh khóa gọi API thành công.
2. Mở trang chủ và sáu bài mẫu trên điện thoại. Mỗi mô phỏng phải tải, nhận cấu hình và cho phép thao tác; thử xoay ngang/dọc.
3. Mở thư viện: đủ 74 mô phỏng, chia sáu chương, có ghi công/giấy phép. Thử một mô phỏng không có adapter để xác nhận chỉ điều khiển được trong chính PhET.
4. Nếu bật AI, thử một ảnh đề nhỏ và kiểm tra phản hồi/lỗi trong ứng dụng. Không gửi khóa hay ảnh học sinh vào log/chụp màn hình để hỗ trợ.
5. Đóng rồi mở lại ứng dụng để xác nhận tiến độ trên thiết bị còn nguyên; thiết bị khác không tự đồng bộ tiến độ.

Khi cập nhật mã nguồn, kiểm tra lockfile và dữ liệu đã ghim, chạy kiểm thử rồi `docker compose build` và `docker compose up --detach`. Giữ image phiên trước theo tag hoặc digest riêng để rollback. PhET cache nằm trong image; không cần volume dữ liệu học sinh. Với cài đặt trực tiếp, chạy lại `pnpm phet:sync` chỉ kích hoạt generation mới sau khi toàn bộ tệp hợp lệ, giữ generation đang chạy khi có lỗi.

Không dùng `pnpm phet:sync --update` như bước bảo trì tự động: phiên bản PhET mới cần rà soát hash, giấy phép, schema và kiểm thử lại adapter. Nếu cần tải lại đúng bộ đã ghim khi build Docker, dùng `docker compose build --no-cache` để bỏ cache layer đồng bộ. Build không yêu cầu OpenAI API key; không truyền khóa qua Docker `ARG`, `ENV` trong Dockerfile hay build argument ([Docker: build secrets](https://docs.docker.com/build/building/secrets/)).
