---
name: Physim-AI
description: Technical Editorial cho ứng dụng thực hành Vật lý THPT bằng tiếng Việt.
colors:
  navy: "#0B2537"
  navy-active: "#214358"
  gold: "#E7BB7C"
  gold-hover: "#F1CD98"
  gold-interactive: "#854D0E"
  body: "#52616B"
  light-on-navy: "#C2D0D6"
  white: "#FFFFFF"
  paper: "#F5F5F1"
  hairline: "#D3DADD"
typography:
  display:
    fontFamily: "Plus Jakarta Sans"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.035em"
  heading:
    fontFamily: "Plus Jakarta Sans"
    fontWeight: 600
    lineHeight: 1.18
  body:
    fontFamily: "Inter"
    fontWeight: 400
    fontSize: "16px"
    lineHeight: 1.75
  label:
    fontFamily: "Inter"
    fontWeight: 600
  navigation:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 600
rounded:
  input: "3px"
  card: "0px"
  navigation: "100px"
---

# Physim-AI Technical Editorial

Ứng dụng chuyển hệ thiết kế Weamis Technical Editorial sang giao diện thực hành. Trên màn hình rộng, đặt tiêu đề và lời dẫn ở trái, nội dung hoặc thao tác chính ở phải. Điện thoại đọc theo một cột với lề khoảng 20 đơn vị. Bắt đầu mỗi màn hình bằng tiêu đề hữu ích cho thao tác đang làm.

## Màu, chữ và khoảng cách

Dùng navy làm mực chính và cho bề mặt tương phản. Paper hoặc white làm nền. Gold đánh dấu hành động chính, đặt chữ navy trên gold. Dùng gold-interactive cho chi tiết có thể tương tác trên nền sáng. Dùng đường phân cách 1 đơn vị giữa các hàng và section. Trên navy, dùng trắng 19%.

Plus Jakarta Sans dùng cho tiêu đề sentence case. Inter dùng cho nội dung và điều hướng. Cả hai font được đóng gói với dấu tiếng Việt. Tiêu đề có line-height 1.18. Dùng số tabular cho bốn bước và số đo. Số bước biểu thị thứ tự học. Thẻ và khung mô phỏng góc vuông. Nút và trường nhập bo 3. PillNav chỉ dùng cho điều hướng chính.

## Màn hình

- **Quét đề** đặt thao tác ảnh đầu tiên. Một bài mẫu nổi bật đưa người học thẳng vào lab. Sáu bài mẫu xuất hiện thành danh sách có chủ đề và tên bài.
- **Thư viện** trình bày danh mục theo chương với bộ lọc và ô tìm theo tên. Ghi rõ khả năng học có hướng dẫn trên mục tương ứng.
- **Phòng lab** ưu tiên diện tích mô phỏng. Các số đo nằm cạnh mô phỏng và hiển thị đơn vị. Bốn bước là các hàng có dấu cộng hoặc trừ. Bước mở dùng nền navy. Trên màn hình hẹp, các bước nằm sau mô phỏng trong cùng chiều cuộn.
- **Ôn tập** hiển thị thẻ đến hạn trước, tên bài và ngày hẹn. Học sinh có thể mở lại đúng cấu hình hoặc tự chấm mức nhớ 0–5.
- **Cài đặt** gồm trường địa chỉ server có nhãn và trạng thái kiểm tra kết nối. Mỗi lỗi có bước phục hồi cụ thể.

## Trạng thái và truy cập

Nút có nhãn hành động và vùng chạm tối thiểu 44 đơn vị. Dùng SVG nét đồng nhất cho mũi tên và thao tác. Tất cả điều khiển có focus rõ, trạng thái đã chọn hoặc mở được đọc bởi trình đọc màn hình, và phản hồi tức thì khi giảm chuyển động. Lỗi mô phỏng giữ thao tác thử lại. Thông tin cấp phép nằm gần mô phỏng và không che nội dung PhET.

Rà thiết kế trên Web ở 320, 390, 768 và 1440 px. Rà thêm bàn phím, đọc số liệu, chuyển bước, zoom và bản native theo khả năng thiết bị.
