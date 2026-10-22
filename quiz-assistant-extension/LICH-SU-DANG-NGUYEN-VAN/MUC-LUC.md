# LỊCH SỬ ĐẢNG CỘNG SẢN VIỆT NAM

## Mục lục tra cứu nguồn nguyên văn

Toàn bộ văn bản có thể trích xuất từ 4 bài trình chiếu, kể cả chữ trong sơ đồ SmartArt (đồ họa thông minh), được giữ nguyên ký tự và thứ tự đoạn văn của tệp nguồn.
Mỗi chương có hai cách đọc: tệp chương đầy đủ và các tệp riêng theo trang chiếu để truy xuất nhanh.

| Học phần | Toàn văn chương | Mục lục từng trang | Số trang chiếu |
| --- | --- | --- | ---: |
| Nhập môn | [Đọc nguyên văn](00-NHAP-MON.md) | [Danh mục các trang](00-NHAP-MON.md#tra-cuu) | 20 |
| Chương 1 | [Đọc nguyên văn](01-CHUONG-1.md) | [Danh mục các trang](01-CHUONG-1.md#tra-cuu) | 115 |
| Chương 2 | [Đọc nguyên văn](02-CHUONG-2.md) | [Danh mục các trang](02-CHUONG-2.md#tra-cuu) | 136 |
| Chương 3 | [Đọc nguyên văn](03-CHUONG-3.md) | [Danh mục các trang](03-CHUONG-3.md#tra-cuu) | 162 |

## Đề mục chính

- [Nhập môn: NHẬP MÔN · MÔ TẢ HỌC PHẦN](00-NHAP-MON.md)
- [Chương 1: ĐẢNG CỘNG SẢN VIỆT NAM RA ĐỜI VÀ LÃNH ĐẠO ĐẤU TRANH GIÀNH CHÍNH QUYỀN (1930-1945)](01-CHUONG-1.md)
- [Chương 2: ĐẢNG LÃNH ĐẠO HAI CUỘC KHÁNG CHIẾN CHỐNG NGOẠI XÂM, GIÀNH ĐỘC LẬP HOÀN TOÀN, THỐNG NHẤT ĐẤT NƯỚC (1945 - 1975)](02-CHUONG-2.md)
- [Chương 3: ĐẢNG LÃNH ĐẠO CẢ NƯỚC QUÁ ĐỘ LÊN CHỦ NGHĨA XÃ HỘI VÀ TIẾN HÀNH CÔNG CUỘC ĐỔI MỚI (TỪ NĂM 1975 – ĐẾN NAY)](03-CHUONG-3.md)

## Cách truy xuất

1. Mở chương để tra theo danh mục trang chiếu và đọc nguyên văn liên tục.
2. Mở một tệp riêng trong thư mục `trang/` khi cần tìm chính xác một nội dung. Tên tệp `001.md` ứng với trang chiếu số 1 trong phần mềm PowerPoint (trình chiếu).
3. Tìm kiếm từ khóa trong toàn thư mục `trang/` khi lập chỉ mục tài liệu; các tệp chương có nội dung lặp lại để thuận tiện đọc, nên chỉ lập chỉ mục một trong hai nhóm.
4. Đối chiếu nội dung văn bản với bản xem trang chiếu và tệp phương tiện gốc bên dưới mỗi trang.

**Tìm nhanh trong thư mục sau khi giải nén:**

```bash
rg -n -i "Cương lĩnh chính trị" trang/
```

## Phạm vi và độ trung thực

- Giữ nguyên dấu câu, dấu tiếng Việt, lỗi gõ, ký tự và thứ tự xuất hiện của tất cả các đoạn `a:t` trong trang chiếu và dữ liệu sơ đồ PowerPoint (phần mềm trình chiếu).
- Khoảng ngắt đoạn được trình bày bằng dòng mới; nội dung chữ không bị tóm tắt.
- Dấu tiếng Việt được chuẩn hóa về Unicode NFC (dạng tổ hợp chuẩn) để hiển thị ổn định; không thay đổi từ ngữ.
- Hình ảnh, sơ đồ và nội dung chỉ nằm trong hình được giữ dưới dạng ảnh gốc và bản xem, không tự nhận dạng thành chữ thiếu kiểm chứng.
- Lời nói trong âm thanh hoặc đoạn phim, nếu có, được giữ qua tệp phương tiện gốc; chưa có bản chép lời đã xác minh.
- Ghi chú trang chiếu và đường dẫn ngoài (nếu có) được giữ tại trang tương ứng.
- Mô tả thay thế gắn trong hình ảnh và đối tượng cũng được đưa vào văn bản của từng trang khi có.
- Các ảnh xem được tạo từ tệp trình chiếu bằng bộ dựng tài liệu, có thể có khác biệt nhỏ về phông chữ so với Microsoft PowerPoint (phần mềm trình chiếu).
- Phụ lục chữ trong các mẫu trang (kh?ng k?m ?nh/media) lưu cả chữ mặc định của mẫu trình chiếu, để đối chiếu độ đầy đủ ở cấp tệp nguồn.

## Thống kê kiểm chứng

| Nguồn | Số trang | Chuỗi chữ trong trang | Chuỗi chữ trong sơ đồ | Số ký tự nguyên bản | Tệp phương tiện gốc |
| --- | ---: | ---: | ---: | ---: | ---: |
| `04-CH-NG-NH-P-M-N.pptx` | 20 | 210 | 136 | 5337 | 28 |
| `01-CH-NG-1.pptx` | 115 | 4177 | 1468 | 34511 | 111 |
| `02-CH-NG-2.pptx` | 136 | 9921 | 547 | 47153 | 118 |
| `03-CH-NG-3.pptx` | 162 | 6650 | 3730 | 60397 | 88 |

**Kiểm tra tự động:** Mọi chuỗi `a:t` trong trang chiếu và mỗi phần dữ liệu sơ đồ liên quan đều được đối chiếu với XML (ngôn ngữ đánh dấu mở rộng) gốc.
