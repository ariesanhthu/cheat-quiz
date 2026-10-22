# Quiz Assistant v1.1.0

- Tự khởi tạo trên trang web; nút Q luôn ở sát góc trên bên phải để bật/tắt bảng.
- Bôi đen để tra cứu ngay. Chụp vùng chọn ở capture phase để tránh listener ở bubble phase của extension dịch làm mất câu hỏi.
- Bảng dùng native Popover/Command khi trình duyệt hỗ trợ, có fallback và hỗ trợ Escape.
- Giữ giao diện Moodle gốc trong demo. Next/Previous mở ba file cục bộ: page.html, page-2.html, page-3.html. Hai câu mẫu cùng đề nhưng khác phương án/đáp án.
- Hiển thị phiên bản hiện tại, kiểm tra GitHub Releases, bật kiểm tra định kỳ 6 giờ và mở ZIP cập nhật. Chỉ truy cập GitHub sau khi người dùng cấp quyền.
- TF-IDF dùng cả câu hỏi và phương án, giữ top 3; kho gồm 151 câu, 149 đáp án và 433 trang giáo trình. Không có AI vẫn dùng offline.
- Dữ liệu người dùng nằm trong Chrome local storage; không có database hoặc đồng bộ lên GitHub. Codex/Claude CLI là tùy chọn.

## Cài đặt / cập nhật

1. Tải `quiz-assistant-extension-1.1.0.zip`, giải nén vào thư mục cố định.
2. Mở `chrome://extensions`, bật Developer mode, Load unpacked thư mục có manifest.json.
3. Nếu cập nhật, chép đè **đúng thư mục đã cài**, nhấn Reload extension rồi tải lại tab quiz để giữ cùng extension ID và dữ liệu Chrome.
4. Khi mở demo qua file://, bật **Allow access to file URLs** trong Details của extension. ZIP demo phải giải nén cả thư mục page-assets cùng ba file HTML.

Bản Load unpacked tự kiểm tra và báo phiên bản mới; bước cài ZIP/reload cần người dùng thực hiện. Chrome không tự thay mã từ GitHub cho bản unpacked. Không cần cung cấp tài khoản GitHub để kiểm tra Release công khai.

## Kiểm thử

Xem [TEST_REPORT.md](TEST_REPORT.md) trong repository để biết số test, phạm vi và giới hạn kiểm chứng. Xung đột Translate được mô phỏng bằng listener chặn mouseup và xóa selection; không phải kiểm thử extension Google Translate chính thức. AI dùng fixture, không gọi model tính phí.
