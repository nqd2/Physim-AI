# Bridge PhET của Physim-AI

`registry.js` và các file trong `adapters/` là mã do Physim-AI thêm. Không sửa mã, logo hay thông báo bản quyền trong bundle PhET. `build-assets.mjs` ghép chúng thành `adapters.js`; pipeline chèn file này và `physim-bridge.js` trước thẻ `</body>` cuối cùng của HTML.

Adapter chỉ bật khi pipeline khớp phiên bản và SHA-256 bản HTML gốc với `packages/shared/data/adapter-schemas.json`, đồng thời runtime khớp phiên bản thực tế của `phet.joist.sim`. Bằng chứng nằm trong `packages/shared/data/adapter-evidence/`. Không sử dụng PhET-iO. Với các bản mới không có nguồn công khai khớp `totalitySHA`, bằng chứng ghi rõ giới hạn này; quyền ghi dựa trên kiểm thử bản HTML đã ghim.

## Giao thức

Envelope: `{ protocol: 'physim-bridge', version: 1, loadId, requestId, type, payload }`.

- Web đặt `physimParentOrigin` và `physimLoadId` trong query URL, gửi envelope dạng chuỗi JSON bằng `postMessage` với origin cụ thể. Chuỗi JSON tương thích listener cũ của một số bản PhET. Bridge kiểm tra cả `event.source === parent`, origin, version và loadId.
- Native đặt `physimNative=1`, `physimLoadId`, rồi gọi `window.physimBridge.receive(JSON.stringify(envelope), loadId)` qua WebView injection. Kết quả gửi qua `ReactNativeWebView.postMessage`.
- `loadId` là nonce mới cho mỗi lượt tải, 16–128 ký tự `[a-zA-Z0-9_-]`. `requestId` dài 1–100 ký tự `[a-zA-Z0-9_.:-]`.
- Gửi `INIT` sau khi frame tải; `READY` sẽ trả khi mô phỏng và adapter đã sẵn sàng. App phải kiểm tra lại source/origin/version/loadId ở đầu nhận.

`APPLY_CONFIG` nhận `{slug?, version?, screenId, values}` và kiểm tra toàn bộ dữ liệu trước khi ghi. `RUN_EXPERIMENT` nhận `{action}`; chỉ chạy thao tác đăng ký trên màn hình hiện hành. `SWITCH_SCREEN` nhận `{screenId}`. `GET_STATE` và `RESET_SIM` nhận `{}`.

`RESULT` trả trực tiếp `{slug, version, screenId, values}`, trừ thí nghiệm trả `{state, measurement}`. Lỗi trả `ERROR` với `{code, message}`. `PROPERTY_CHANGED` gộp thay đổi trong cửa sổ 100 ms. Listener được gỡ khi đổi màn hình hoặc đóng frame. Hành động chạy tuần tự; app nên dùng timeout 30 giây cho thí nghiệm.

## Adapter đã kiểm thử

| Mô phỏng | Phiên bản | Màn hình | Thí nghiệm |
| --- | --- | --- | --- |
| Ohm’s Law | 1.4.33 | `main` | `observe` đọc dòng điện thật, đơn vị mA |
| Projectile Motion | 1.0.36 | `intro` | `fire` đọc quỹ đạo PhET sau khi chạm đất |
| Gas Properties | 1.1.12 | `ideal` | `observe` đọc áp suất, nhiệt độ và thể tích |
| Wave on a String | 1.2.6 | `main` | `run` tiến 50 bước của model; `pulse` phát xung |
| Bending Light | 1.2.7 | `intro` | `observe` đọc các tia thật và góc khúc xạ |
| Build a Nucleus | 1.1.12 | `decay`, `chart` | `observe`, `add-neutron` dùng các hạt thật |

Gas: `injectionTemperatureK` chỉ ảnh hưởng hạt mới bơm, không đổi nhiệt độ của hạt đã có. Khi dùng nhiệt độ bơm mới, đặt thông số này trước khi thêm hạt. Bài mẫu Boyle thay đổi chiều rộng bình, giữ nhiệt độ. Nhiệt độ của bình rỗng là `null`.

Optics: chỉ cho chọn môi trường `air`, `water`, `glass`; không ghi chiết suất tùy ý vì UI PhET sẽ xử lý lại giá trị đó. `angleDeg` là góc tới tính từ pháp tuyến. Nucleus: số proton/neutron phải là số nguyên và được dựng bằng `populateAtom`, không ghi trực tiếp vào thuộc tính đếm.

## Kiểm tra lại

```text
node apps/server/src/phet-bridge/build-assets.mjs
node --test tests/bridge-runtime.test.mjs
node tests/bridge-browser.mjs
```

Kiểm tra trình duyệt cần bản HTML trong `apps/server/storage/phet-sims/originals/` (chạy `pnpm phet:sync` trước), `playwright-core` và Chrome/Chromium. Có thể chỉ định executable bằng `PHYSIM_BROWSER_PATH`.

`bridge-browser.mjs` kiểm tra cả sáu adapter qua iframe thật, bao gồm INIT/READY, cấu hình, đọc lại, thí nghiệm, từ chối cấu hình lạ, reset và đổi hai màn hình nucleus. Mặc định chỉ ghi báo cáo vào `.qa/`; thêm `--publish` mới cập nhật registry. Chỉ publish sau khi kiểm tra các thay đổi điều khiển và telemetry trên đúng bản HTML. Bản HTML khác phiên bản hoặc checksum phải được kiểm chứng lại trước khi bật quyền ghi.
