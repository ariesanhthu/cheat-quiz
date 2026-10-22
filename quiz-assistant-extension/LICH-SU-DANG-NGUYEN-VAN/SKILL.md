---
name: lich-su-dang-nguyen-van
description: Tra cứu giáo trình nguyên văn Lịch sử Đảng Cộng sản Việt Nam của Nguyễn Văn theo chương và trang chiếu; đối chiếu đáp án trắc nghiệm với dẫn chứng trong tài liệu.
---

# Tra cứu Lịch sử Đảng

Kho nguồn này giữ nguyên văn, bao gồm lỗi gõ của tài liệu. Không suy diễn nội dung chỉ nằm trong hình ảnh thành văn bản đã xác minh.

## Truy xuất

- Đọc [mục lục chương](MUC-LUC.md) để xác định giai đoạn: nhập môn; 1930–1945; 1945–1975; từ 1975.
- Tra [chỉ mục trang](references/page-index.json) rồi tìm từ khóa trong `trang/`. Mỗi tệp là một trang chiếu có nguồn, văn bản nguyên văn và liên kết ảnh. Chỉ lập chỉ mục nhóm `trang/`, tránh nhân đôi với tệp toàn chương.
- Khi cần ngữ cảnh, đọc cả trang trước và sau của cùng chương. Đối chiếu năm, số liệu, phủ định và từng phương án; các câu cùng đề nhưng khác phương án là các trường hợp riêng.
- Trích dẫn đường dẫn trang, tên nguồn và một đoạn nguyên văn có chứa bằng chứng. Nếu nguồn mâu thuẫn hoặc không đủ thông tin, trả `needs_review`; không bịa số trang hoặc dẫn chứng.
- Các tệp `00-NHAP-MON.md` đến `03-CHUONG-3.md` dành cho đọc liền mạch. Bản GitHub chỉ giữ văn bản; ảnh/media gốc không được đóng gói vì tool không dùng. Không suy đoán nội dung chỉ có trong ảnh.

## Dùng trong tiện ích

`../scripts/build-data.cjs` tạo `../knowledge-base.json` từ các khối `text` nguyên văn. Runtime retrieve các trang liên quan bằng TF-IDF rồi cung cấp ngữ cảnh cho AI. Đầu ra gồm `status`, `answer_text`, `explanation`, `evidence` (mã trang và trích nguyên văn). Chỉ đối chiếu một phương án duy nhất; không dùng chỉ số a/b/c/d làm danh tính đáp án.

Kho quiz là nguồn đáp án do người dùng cung cấp, không phải giáo trình đã thẩm định. Phân biệt rõ nguồn quiz, gợi ý AI và dẫn chứng nguyên văn khi trả lời.
