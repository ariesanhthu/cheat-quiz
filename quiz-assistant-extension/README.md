# Quiz Assistant 1.3

Bấm icon trên thanh Chrome → chọn **TF-IDF** hoặc **ChatGPT** → **Chạy**.

## Cài một lần

1. Tải **quiz-assistant-extension-1.3.0.zip**, giải nén vào thư mục cố định.
2. Mở chrome://extensions → Developer mode → Load unpacked → chọn thư mục có manifest.json. Khi cập nhật, chép đè đúng thư mục cũ rồi Reload để giữ dữ liệu Chrome.
3. Dùng ChatGPT: chạy **SETUP.cmd** trong thư mục đó một lần. Installer tự nhận extension và Codex; nếu thiếu thì tải Node.js/Codex chính thức vào thư mục riêng, không cần quyền admin.
4. Bấm icon → **ChatGPT → Đăng nhập**. Nếu trên máy đã đăng nhập thì hiện trạng thái kết nối ngay. Bấm **Thử kết nối** để hỏi một bài thử thật.

Sau đó chỉ cần **Chạy**. Bộ kết nối tự chạy nền khi Chrome gọi, không phải mở terminal, nhập token hay cổng localhost. Chỉ **Đăng nhập/Kết nối lại** mới mở tab; hỏi AI không mở tab mới. TF-IDF không cần tài khoản hoặc Internet.

Nếu SETUP không tự nhận ID, mở **Cài kết nối một lần** trong popup, sao chép ID vào SETUP. Bộ cài hỗ trợ Windows x64. Đăng nhập dùng Codex và hạn mức tài khoản ChatGPT; không lấy cookie hoặc hội thoại web. [Tài liệu chính thức](https://learn.chatgpt.com/docs/app-server).

## Khi chạy

- Top 1 khớp câu hỏi và bộ phương án: **tự chọn radio**, TF-IDF không hiện nội dung trên trang. Bật **Đối chiếu đáp án** trong popup để xem khung bên phải: câu trong kho, đáp án, option, mức khớp và lựa chọn hiện tại. Tắt khung không dừng tool.
- AI trả lời bằng chữ nhỏ ngay dưới khung câu hỏi gốc, không nền/viền/box riêng. Dẫn chứng và nút xem nguồn nằm trong khung đối chiếu. Trong khung này có thể chủ động **Kiểm tra bằng AI** cho câu đã match kho.
- Top-k chỉ dự phòng khi cả câu hỏi lẫn bộ phương án của top 1 không khớp. Bật ChatGPT thì AI retrieve giáo trình, trả đáp án ngay dưới câu hỏi và tự chọn khi đáp án/dẫn chứng hợp lệ.
- Cùng câu hỏi nhưng khác option được đối chiếu riêng. Kho gồm 151 câu/149 đáp án và 433 trang giáo trình. Kho mâu thuẫn, đáp án không ánh xạ duy nhất hoặc input không hỗ trợ sẽ không tự chọn bừa.
- **Chạy** một lần cho tab. Khi bạn tự nhấn Next/Previous hoặc câu tải động, tool tự nhận câu mới và chạy tiếp. **Dừng/Hủy** tắt chế độ tiếp tục. Tool không bấm Next/Submit/Finish.
- Giữ lựa chọn người dùng, câu hỏi gốc và giao diện Moodle. Nút Q và bôi đen vẫn dùng được.

Kho quiz/cài đặt ở Chrome local storage, không có database hoặc đồng bộ cloud. Trạng thái chạy theo tab ở Chrome session storage, giới hạn theo website (hoặc thư mục file HTML). Bộ kết nối không lưu kho quiz; phiên đăng nhập do Codex quản lý trên máy. AI chỉ nhận câu hỏi, option và tối đa 6 đoạn giáo trình, không nhận HTML/cookie trang.

## Demo và nâng cao

Trang test đã deploy: https://quiz-assistant-moodle-anhthu.shadycrab513.chatgpt.site/page.html (quyền riêng tư do chủ site quản lý).

Bản local: ../page.html → Next tới page-2.html → page-3.html. Cả ba trang khớp kho quiz; hai trang sau cùng đề, khác bộ đáp án. Với file HTML, bật **Allow access to file URLs** trong Details extension. Hoặc chạy node scripts/demo-server.cjs và mở http://127.0.0.1:8789/page.html.

Cài đặt nâng cao vẫn có nhập JSON/CSV, đổi ngưỡng, API/CLI cũ và kiểm tra GitHub Releases. Bản unpacked tự báo bản mới; cập nhật mã cần tải ZIP, chép đè và Reload.

Knowledge base: [SKILL.md](LICH-SU-DANG-NGUYEN-VAN/SKILL.md), [chỉ mục trang](LICH-SU-DANG-NGUYEN-VAN/references/page-index.json). Chỉ giữ văn bản cần retrieve, bỏ ảnh/media gốc khỏi GitHub.

## Phát triển

- npm ci; npm run check; npm test
- npx playwright install chromium; npm run test:e2e
- node scripts/build-data.cjs sau khi sửa quiz nguồn hoặc trang giáo trình.
- python scripts/package-release.py tạo một ZIP extension và SHA256SUMS trong dist/. Thêm --demo nếu cần ZIP demo riêng.

Xem [TEST_REPORT.md](TEST_REPORT.md). Đã thử AI thật và native messaging Chrome trên máy; test tự động dùng fixture để không tiêu hao hạn mức. Không đưa credential, profile Chrome, node_modules hoặc artifact vào bản phát hành.
