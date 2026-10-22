# Kiểm thử v1.3.1 — 2026-10-23

| Hạng mục | Kết quả |
| --- | --- |
| Node unit/integration | 95/95 pass, không skip |
| Chromium MV3 / Playwright | 13/13 pass |
| Syntax, tài nguyên, manifest | Pass |
| SETUP thật trên Windows | Pass; nhận ID Chrome từ metadata/path, đăng ký host HKCU, sao chép runtime vào LocalAppData |
| Native messaging Chrome thật | Pass; xác nhận tài khoản ChatGPT Plus trên máy |
| Popup → ChatGPT thật → kết quả quiz | Pass; tự chọn đúng option 2, có dẫn chứng, không tăng số tab |
| Thử kết nối AI thật | Pass; trả lời đúng bài thử và dẫn chứng được kiểm tra |
| Web deploy + extension thật | HTTP 200; câu đầu khớp kho, TF-IDF ẩn, toggle popup mở sidebar, Next/Previous tự tiếp tục; ChatGPT thật hiện chữ ngoài khung, không mở tab, không có page error |

Môi trường Windows x64, Node 22.20.0, Playwright 1.64.1. Test tự động dùng fixture; các lần thử AI thật dùng tài khoản đã đăng nhập trên máy.

Bản 1.3.1 chỉ cập nhật phiên bản/đóng gói; 95 test code và 13 test trình duyệt được chạy lại. Các lần kiểm thử ChatGPT thật và web deploy bên trên thực hiện ở 1.3.0, cùng mã chức năng.

## Phạm vi

- Giữ đủ 151 câu/149 đáp án và 433 trang giáo trình; đảo/relabel option vẫn ánh xạ đúng, hai câu chưa có đáp án không chọn bừa.
- Top 1 khớp câu và option thì tự chọn; TF-IDF ẩn nội dung, mở đối chiếu bên phải khi bật toggle. Khung hiển thị lựa chọn thực tế sau khi người dùng đổi radio; đóng khung không hủy chạy. Top-k chỉ dự phòng khi cả hai phần không khớp; mâu thuẫn vẫn bị chặn.
- AI là chữ nhỏ ngay sau khung .formulation, không section/box/nền/viền riêng. Dẫn chứng ở sidebar; xóa câu hỏi tự dọn kết quả đối chiếu cũ.
- Fact-check bằng AI giữ trạng thái match TF-IDF, báo rõ nếu AI khác kho và không ghi đè lựa chọn có sẵn. Match trusted từ highlight ngăn AI cũ ghi đè kể cả khi bật overwrite.
- Giữ DOM/theme Moodle, chữ nhỏ dưới câu gốc. Chỉ Chạy ở page-2.html; Next sang page-3.html tự xử lý, Previous tiếp tục; Dừng rồi Next không chạy.
- SPA/DOM đổi câu tự tiếp tục. Trạng thái theo tab sống qua worker restart, tách tab/website/thư mục file HTML, xóa khi dừng/đóng tab. Cancel muộn từ document cũ không hủy AI của document mới trong cùng tab.
- Popup lưu chế độ, chạy nền không mở bảng trên trang. Native AI không cần API key/token HTTP/quyền localhost; chỉ đăng nhập chủ động mới mở auth URL được allowlist.
- Native binary framing phân mảnh/gộp, validate payload/quote, giới hạn hai job, hủy từng request. Không chuyển token/email/log CLI vào trang.
- Bôi đen bằng chuột thật và listener mô phỏng Translate chặn mouseup/xóa selection: khớp duy nhất vẫn tự chọn.
- Dừng/đóng/pagehide/thay input/câu/URL chặn phản hồi cũ; pause/resume, giữ lựa chọn người dùng, disabled/inert/ẩn/checkbox/trùng nhóm radio.
- Chrome local storage, import nguyên tử/đồng thời, quota đầy giữ kho cũ, offline và worker CDP restart.
- AI schema/citation/timeout/abort/lỗi mạng; proxy và Codex/Claude CLI cũ qua HTTP/child process thật với inference fixture.
- GitHub version số, URL allowlist, opt-in/quyền, alarm/restart; không gửi kho quiz để check update.

## Giới hạn

- Đã xác nhận session đăng nhập hiện có; chưa tự nhập mật khẩu/consent của tài khoản khác trong luồng đăng nhập mới.
- SETUP đã chạy nhánh Node/Codex có sẵn. Nhánh tải portable Node khi thiếu và npm cài Codex có xử lý lỗi/checksum, chưa chạy trên Windows trắng hoàn toàn.
- Toolbar và hộp cấp quyền native không thuộc DOM headless. Test mở popup.html đúng manifest default_popup, chọn tab đích kiểm thử; native messaging và AI thật được chạy riêng trên Chrome.
- Translate được mô phỏng bằng listener, chưa chạy Google Translate chính thức. Chưa thao tác tài khoản/server Moodle thật hoặc mọi phiên bản website.
- Đáp án do người dùng cung cấp; dẫn chứng có thật không đảm bảo mọi suy luận AI đều đúng.

Artifact không commit: popup-1.2.png, native-live-result.png, moodle-original-layout.png, demo-page-1.png, demo-page-2.png. Không phát hành credential, profile, node_modules hoặc ảnh/media giáo trình.

Hosted QA: https://quiz-assistant-moodle-anhthu.shadycrab513.chatgpt.site — ba file HTML giữ giao diện gốc, hosting chuẩn hóa .html thành URL ngắn. Ảnh hosted-fact-check.png và hosted-ai-plain.png nằm trong artifacts/. Kiểm thử trang riêng tư dùng service credential do Sites trả về, chỉ gửi header tới đúng origin và không lưu credential trong mã nguồn.
