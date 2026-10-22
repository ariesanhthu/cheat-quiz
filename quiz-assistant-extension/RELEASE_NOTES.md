# Quiz Assistant v1.3.0

- TF-IDF chạy âm thầm, không hiện kết quả dưới câu hỏi. Bật **Đối chiếu đáp án** để mở khung bên phải khi cần xem nguồn, mức khớp và lựa chọn thực tế.
- AI hiện thẳng dưới khung câu hỏi, chỉ chữ nhỏ, bỏ nền/viền/box. Dẫn chứng chuyển vào khung đối chiếu.
- Sửa câu và option của page.html đầu tiên để khớp kho. Deploy ba trang Moodle lên web để test; Next/Previous vẫn tự xử lý sau một lần Chạy.

- Popup gọn từ icon trên thanh Chrome: TF-IDF / ChatGPT, Đăng nhập, Thử kết nối, Chạy và Dừng.
- SETUP.cmd cài bộ kết nối một lần trên Windows x64. Tự nhận extension, tìm/cài Codex và Node khi thiếu. Không cần API key, token bridge hay terminal mỗi lần dùng.
- ChatGPT chạy nền qua Codex đăng nhập chính thức; trả đáp án/dẫn chứng dưới quiz, không mở tab mỗi lần hỏi. Tab chỉ mở khi chủ động đăng nhập.
- Chạy một lần, tự tiếp tục khi người dùng nhấn Next/Previous hoặc trang đổi câu. Dừng tắt chế độ tiếp tục; không tự điều hướng/submit.
- Top 1 khớp câu hỏi + option thì tự chọn, chỉ hiện kết quả ngắn. Bỏ nút Dùng đáp án này. Top-k chỉ dùng khi cả hai phần đều không khớp.
- Giữ giao diện Moodle, kho 151 câu và 433 trang văn bản, dữ liệu Chrome local; bỏ ảnh/media giáo trình.

## Cài / cập nhật

Tải **quiz-assistant-extension-1.3.0.zip** duy nhất, giải nén/chép đè đúng thư mục extension cũ rồi Reload trong chrome://extensions, tải lại trang quiz. Nếu đã cài bộ kết nối ở 1.2 thì không cần cài lại. Máy mới chạy **SETUP.cmd** một lần, sau đó mở popup → ChatGPT → Đăng nhập (nếu cần) → Chạy.

Bộ kết nối đã được cài trên máy phát triển và kiểm tra bằng native messaging Chrome thật. Luồng popup → AI thật → tự chọn đáp án/dẫn chứng đã qua, không mở tab mới. Xem TEST_REPORT.md trong repository về phạm vi kiểm chứng.
