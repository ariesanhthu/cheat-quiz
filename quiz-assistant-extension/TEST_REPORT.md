# Báo cáo kiểm thử — 2026-10-23

## Kết quả

| Kiểm tra | Kết quả |
| --- | --- |
| Unit / integration bằng Node test runner | **82/82 pass**, 0 fail, 0 skip |
| Tiện ích MV3 thật trong Chromium bằng Playwright | **12/12 pass** |
| Load unpacked trực tiếp thư mục mã nguồn hiện tại, không qua bản copy fixture | Pass; trang Cài đặt hiển thị 151 câu, 149 đáp án, 433 trang nguồn |
| Cú pháp JavaScript, tài nguyên đóng gói, quyền manifest, không dùng database trong worker | Pass |
| Kiểm tra SKILL.md của knowledge base | Pass |
| Regression toàn bộ quiz nguồn | Giữ đủ 151 câu; 149 câu có đáp án ánh xạ đúng sau khi đảo và đổi nhãn option; 2 câu thiếu đáp án không tự chọn |
| Knowledge base | 433 đoạn từ 433 trang; nội dung đối chiếu với khối nguyên văn và giữ đường dẫn nguồn |

Môi trường: Windows, Node 22.20.0, Playwright 1.64.1, Chromium for Testing 156.0.8078.4. AI trong test dùng phản hồi giả hoặc child process fixture; không gửi yêu cầu tính phí tới model thật.

## Các trường hợp đã kiểm tra

| Nhóm | Trường hợp và kết quả mong đợi đã xác nhận |
| --- | --- |
| TF-IDF | Cả câu hỏi và toàn bộ phương án tham gia tính điểm; Unicode NFC; đảo thứ tự option; bỏ nhãn a/b/c/d; cùng câu khác bộ đáp án phân biệt đúng; giữ top 3 và hiện đủ option |
| Chính sách chọn | Mâu thuẫn nằm ngoài top 3 vẫn bị chặn; số, ngày, số thập phân, phủ định và toán tử khác không tự gán; nguồn chưa tin cậy, đáp án thiếu, trùng hoặc không tồn tại không được tự chọn |
| DOM | Giữ nguyên các node câu hỏi và phương án; chạy/inject nhiều lần không trùng; text nguồn có markup được hiển thị như văn bản; bản Moodle nguyên gốc có fieldset lồng và aria labels được đọc đúng |
| Layout | Giữ DOM/theme Moodle gốc; chữ kết quả 12px dưới fieldset và đủ chiều rộng; ba file HTML cục bộ, nút Q sát góc phải; native Popover/Command và fallback jsdom |
| Bôi đen | Chuột kéo thật trên page-2.html tự mở bảng, hiển thị top 3; listener mô phỏng Translate xóa vùng chọn và stopImmediatePropagation ở bubble vẫn không làm mất lookup; không tự chọn từ highlight; đóng/Escape giữ Q và focus |
| Cập nhật GitHub | So phiên bản bằng số, chặn draft/prerelease/URL sai, opt-in + quyền GitHub, coalesce/TTL, lỗi mạng giữ bản cũ, alarm 6 giờ và worker restart; không gửi kho quiz; UI mở đúng trang Release |
| Xung đột input | Không ghi đè lựa chọn sẵn có theo mặc định; hỗ trợ ghi đè khi bật rõ ràng; người dùng sửa trong lúc chờ luôn được ưu tiên; radio disabled/inert/hidden/CSS-hidden, checkbox, ảnh, thiếu nhãn, thiếu name và trùng group bị chặn |
| Vòng đời | Hủy/Đóng/destroy/đổi URL/pagehide/thay input/thay câu/xóa câu ngăn phản hồi muộn; tạm dừng chặn áp dụng; hủy giải phóng tra cứu đang treo để có thể chạy lại; context invalidated đồng bộ không thoát ra handler trang |
| Nội dung động | Câu mới, câu đổi nội dung, clone có sẵn placeholder, thay cả body được xử lý; không lặp do quan sát chính kết quả của tiện ích; Hủy dừng theo dõi |
| Lưu dữ liệu | Kho và cài đặt là JSON trong `chrome.storage.local`, không có index/vector hoặc database; worker mới dựng lại index trong bộ nhớ; import append/replace, xóa/reset/rebuild, ghi đồng thời và Chrome storage đầy giữ hành vi nhất quán |
| Không có AI | TF-IDF chạy offline; không có token/model thì không tự gọi AI kể cả trước đó đã bật autoAI; khớp kho đủ điều kiện không gọi AI |
| AI | Schema, ánh xạ text và trích dẫn được kiểm tra; trích dẫn bịa, 401/429/500, offline, JSON lỗi, từ chối, output dở dang không chọn bừa; API deadline/abort; AI chỉ tự chọn khi bật riêng |
| Hủy AI | Hủy request trong một tab không hủy tab khác; đóng tab dừng request; request ID trùng bị từ chối; double click/retry không tạo nhiều request cho cùng câu |
| Proxy API | Request Chromium → loopback thật, đúng Origin/token; không chuyển tool tùy ý; khóa upstream không được trả về trang |
| Codex / Claude CLI | Kiểm tra login subscription; bỏ API-key env; child process không dùng shell và không mở cửa sổ; Codex read-only/ephemeral, Claude tắt tool/MCP và session; job/poll/delete, timeout, giới hạn đồng thời, hủy child process và dọn tệp tạm |
| CLI trong Chromium | Cả hai provider chạy end-to-end qua HTTP loopback thật và child process fixture; model để trống; không API key; JSON/dẫn chứng được kiểm tra trước khi chọn |
| Điều hướng | Các luồng tự chọn không nhấn submit/Next/Finish và không đổi URL; demo chỉ chuyển Next/Previous khi người dùng nhấn |
| Nguồn | Nút xem dẫn chứng mở đúng trang nguồn đóng gói; không chấp nhận URL tùy ý |

## Demo để thử thủ công

`../page.html` giữ giao diện Moodle và câu AWS gốc. Hai câu trong quiz.json số 5 và 11 nằm ở `page-2.html` và `page-3.html`, giữ cùng DOM/theme. Phương án đảo thứ tự: mẫu đầu chọn giá trị 2, mẫu sau chọn giá trị 1. Next/Previous mở đúng file cục bộ, không gửi form tới Moodle; quay lại giữ lựa chọn. CSS/font/ảnh cache ở page-assets; những tài nguyên nguồn trả 403/404 được giữ trạng thái thiếu, không thay bằng hình/theme khác.

Bản Moodle nguyên gốc được giữ tại `tests/fixtures/moodle-original.html`; regression test dùng bản này để tránh chỉ kiểm tra markup tự dựng.

```powershell
node scripts/demo-server.cjs
# Mở http://127.0.0.1:8789/page.html
```

Hoặc mở trực tiếp `../page.html` và bật quyền **Allow access to file URLs** của tiện ích. Trang 1 có câu gốc và mẫu 1; trang 2 có mẫu 2. Nhấn biểu tượng tiện ích và Chạy trên từng trang.

## Chạy lại

```powershell
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:e2e
```

Output cục bộ: `artifacts/unit-results.tap`, `test-results/e2e-results.json`; ảnh `artifacts/demo-page-1.png`, `artifacts/demo-page-2.png`. Các thư mục artifact/profile test nằm trong `.gitignore`; profile tạm được dọn sau test.

## Giới hạn kiểm chứng

- Profile Chromium dùng nguyên manifest phát hành, không thêm host_permissions hoặc executeScript để thay việc tự inject. Nhánh AI/GitHub mô phỏng kết quả cấp quyền vì hộp thoại native không thuộc DOM headless; request loopback và child process vẫn chạy thật. Thao tác nhấn toolbar thật và hộp chấp nhận quyền native chưa được tự động hóa.
- Translate được mô phỏng bằng listener chặn sự kiện và xóa selection; chưa cài/chạy extension Google Translate chính thức trong profile test.
- Đã kiểm tra Codex CLI thật trên máy và thấy đăng nhập bằng ChatGPT. Chưa gửi câu hỏi tới Codex thật; Claude CLI chưa có trên PATH. Hai nhánh inference được kiểm tra bằng child process fixture và tài liệu CLI chính thức, không phải bằng tài khoản/model thật.
- Chưa thao tác trên tài khoản Moodle thật hoặc xác nhận autosave của máy chủ Moodle. Chỉ hỗ trợ trang chính, câu một lựa chọn có nhãn văn bản; iframe và câu ảnh cần xử lý thủ công.
- Timeout được kiểm tra bằng timer tăng tốc ở unit test; không chờ đủ 25/90 giây trong từng case.
- Nhãn đáp án của 5 bộ quiz do người dùng cung cấp, chưa thẩm định độc lập nội dung lịch sử. Trích dẫn có thật không tự chứng minh suy luận AI đúng.
- Các kết quả trên xác nhận các case đã kiểm tra, không phải bảo đảm tuyệt đối mọi phiên bản website hoặc mọi sự cố trình duyệt.
