# PhET: ghi chú nguồn và giấy phép cho bản thí điểm

Đối chiếu ngày 14/11/2026, cho phạm vi giáo dục phi thương mại trong `plan.md`. Đây là ghi chú triển khai theo tài liệu được dẫn, không phải xác nhận pháp lý cho mọi hình thức phân phối sản phẩm.

## Bản HTML thường và bản lịch sử

[Trang giấy phép PhET](https://phet.colorado.edu/en/licensing/) xác định các tệp HTML mô phỏng thông thường hiện tại theo CC BY-NC 4.0, cho sử dụng và phân phối lại phi thương mại. Mục dành cho giáo viên/học sinh cho phép dùng trong lớp, bài tập và dự án học tập mà không phải xin thêm quyền cho các cách dùng đó. PhET-iO là sản phẩm được cấp phép riêng; pipeline này chỉ lấy bản HTML thường.

[Thỏa thuận cho bộ lịch sử](https://phet.colorado.edu/en/licensing/html) áp dụng cho phiên bản xuất bản **trước 29/03/2026**, theo CC BY 4.0. Ngày tải xuống không quyết định giấy phép của phiên bản. Dùng ngày phát hành được ghi trong bản HTML/About hoặc metadata của phiên bản, đồng thời giữ thông tin giấy phép nhúng trong tệp. Không gán CC BY cho tệp chỉ vì repo nguồn từng dùng giấy phép đó.

[Thông báo của PhET ngày 30/03/2026](https://phetsims.substack.com/p/a-small-change-to-support-a-big-mission) giải thích việc chuyển thư viện sang BY-NC và yêu cầu thỏa thuận thương mại riêng cho cách dùng nhằm lợi thế thương mại hoặc nhận tiền, kể cả tổ chức phi lợi nhuận. Phạm vi thí điểm trong kế hoạch chưa bao gồm cách dùng này.

## Ghi công và thay đổi trong wrapper

Dòng ghi công cần đặt sát mô phỏng, có thể dịch sang tiếng Việt. Giữ nguyên tên đơn vị, đường dẫn PhET, liên kết giấy phép tương ứng và logo trong mô phỏng. Không che hoặc thay logo. Ví dụ đúng nguyên văn cho tệp BY-NC:

> Simulation by PhET Interactive Simulations, University of Colorado Boulder, licensed under CC BY-NC 4.0 (https://phet.colorado.edu).

Giữ nguyên tệp nguồn đã tải và thông báo bản quyền. Ghi riêng thay đổi của Physim-AI: thêm script bridge, thời điểm, phiên bản bridge và checksum trước/sau. Không mô tả Physim-AI là sản phẩm được PhET bảo trợ.

[CC BY-NC 4.0, toàn văn](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en), mục 2(a)(1), cho phép tái tạo, phân phối và tạo tác phẩm phái sinh cho mục đích phi thương mại. Mục 3 yêu cầu giữ ghi công, bản quyền, thông tin giấy phép, ghi rõ đã sửa và giữ dấu vết sửa trước đó. Dựa trên các điều khoản này, script bridge tách riêng là cách triển khai có thể truy nguyên thay đổi; nhận định này không tự xác nhận mọi tính năng thương mại hoặc mọi hợp đồng khác.

[Điều khoản website PhET](https://phet.colorado.edu/en/terms-of-use), phiên bản hiệu lực 20/09/2026, có các điều kiện chung về truy cập dịch vụ, không gây quá tải và không nhúng toàn bộ Site. Vì vậy, thư viện nhúng tệp mô phỏng đã tải hợp lệ, không iframe trang web PhET; tải với mức đồng thời hữu hạn. Giữ bước đánh giá pháp lý trước khi chuyển sang thương mại như kế hoạch đã nêu.

## Metadata dùng để chọn 74 mục

[Metadata API 1.3](https://phet.colorado.edu/services/metadata/1.3/simulations?format=json&locale=en) tại lần đối chiếu có 127 project `type: 2` (HTML5). Trong các simulation của chúng có đúng 72 mục mang subject `4` (Physics). Bổ sung `greenhouse-effect` và `projectile-sampling-distributions` cho tổng 74. Slug của simulation có thể khác tên project, và nhiều tên có bản Java/Flash cũ; phải lọc project HTML5 trước.

Nhãn con Vật lý: `5` Motion, `6` Sound & Waves, `7` Work/Energy/Power, `8` Heat/Thermo, `9` Quantum Phenomena, `10` Light/Radiation, `11` Electricity/Magnets/Circuits. Sáu chương của ứng dụng là phép ánh xạ biên tập, không phải phân loại sáu chương do PhET xuất bản. Lưu nhãn gốc và lý do ngoại lệ trong manifest để kiểm tra được các mục đa chủ đề hoặc thiếu nhãn con.
