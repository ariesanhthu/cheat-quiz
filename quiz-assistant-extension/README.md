# Quiz Assistant

Tiện ích Chrome Manifest V3, chạy trực tiếp từ thư mục này. Kho đi kèm gồm **151 câu từ quiz.json–quiz5.json**, 149 câu có đáp án và **433 trang giáo trình nguyên văn**. Không cần Node, Python hoặc máy chủ để tra cứu TF-IDF.

## Cài và dùng

1. Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và chọn thư mục `quiz-assistant-extension`.
2. Tải lại trang quiz sau khi cài/reload extension. Nút **Q** tự xuất hiện sát góc trên bên phải. Bôi đen câu hỏi để tra ngay, hoặc bấm Q → **Chạy trên trang**. Đóng bảng vẫn giữ nút Q; Escape đóng bảng và trả focus về nút.
3. Kết quả xuất hiện dưới câu gốc, chữ 12px. Hiển thị top 3 câu trong kho cùng đáp án, nguồn, điểm tương đồng và toàn bộ phương án. Câu và option gốc được giữ nguyên.
4. Khi khớp duy nhất, tiện ích tự chọn radio tương ứng. Mặc định giữ lựa chọn đã có. **Tạm dừng**, **Hủy**, **Đóng** ngăn kết quả đang chờ áp dụng lên trang. Kéo tiêu đề để di chuyển bảng; vị trí được lưu.
5. Có thể bôi đen văn bản để tra cứu thủ công, sao chép hoặc chọn **Dùng đáp án này**. Mỗi lần chỉ có một bảng gợi ý thủ công.

Dữ liệu người dùng được lưu trong **Chrome local storage**, không cần database. Vào **Cài đặt → Khôi phục 5 bộ quiz gốc** để dùng 151 câu mới. Bản này không đọc kho IndexedDB của MVP cũ; nếu trước đó đã nhập một kho riêng, hãy nhập lại file. Sau khi reload/update tiện ích, tải lại tab quiz rồi mở tiện ích.

Tiện ích xử lý trang hiện tại và theo dõi câu tải động sau khi nhấn Chạy. Khi URL thay đổi, phải nhấn Chạy lại. Không có thao tác Next/Previous/Submit/Finish tự động. Chỉ radio được hỗ trợ; checkbox, câu ảnh, đáp án thiếu nhãn hoặc nhóm radio xung đột cần kiểm tra thủ công. Moodle có autosave nên việc chọn radio có thể được website lưu ngay.

## Phiên bản và cập nhật GitHub

Mở **Cài đặt → Phiên bản & cập nhật GitHub** để kiểm tra Release mới hoặc bật kiểm tra định kỳ 6 giờ. Nút cuối bảng trên trang hiển thị phiên bản hiện tại và thông báo bản mới sau khi kiểm tra. GitHub là quyền tùy chọn: chưa cấp quyền/chưa bật thì không tự gửi request. Request chỉ đọc metadata Release công khai, không gửi kho câu hỏi, vùng bôi đen, cookie hay lịch sử học.

Tải ZIP ở [GitHub Releases](https://github.com/ariesanhthu/cheat-quiz/releases/latest), chép đè đúng thư mục cài đặt rồi Reload extension và tải lại tab quiz. Chrome local storage được giữ theo extension ID. Bản **Load unpacked** chỉ tự kiểm tra/thông báo; không tự thay mã extension từ GitHub. [Chrome mô tả các cách phân phối và cập nhật](https://developer.chrome.com/docs/extensions/how-to/distribute).

Đóng gói bản phát hành bằng `python scripts/package-release.py`; ZIP runtime, ZIP demo và SHA256SUMS nằm trong `dist/`. Đổi cả version trong manifest.json và package.json trước khi phát hành.

## TF-IDF và quyết định đáp án

- Chuẩn hóa Unicode NFC, khoảng trắng, nhãn a/b/c/d; giữ số, phủ định và toán tử.
- Dùng unigram + bigram, cosine TF-IDF cho câu hỏi và **toàn bộ phương án**. Điểm tổng = 65% câu hỏi + 35% phương án. Bộ phương án được sắp xếp khi lập chỉ mục để không phụ thuộc vị trí option trên trang.
- Giữ mọi biến thể cùng câu hỏi nhưng khác bộ phương án. Câu hỏi và bộ phương án khớp nguyên bản được ưu tiên. Ánh xạ bằng **nội dung đáp án**, không dùng vị trí a/b/c/d.
- Kiểm tra mâu thuẫn trên toàn bộ kết quả, rồi chỉ hiển thị top 3. Nếu đáp án không khớp duy nhất, khác số/phủ định hoặc nhiều ứng viên gần nhau cho đáp án khác nhau, không tự chọn.
- Ngưỡng gần đúng mặc định: mỗi trường ≥ 0.94, chênh lệch ứng viên khác đáp án ≥ 0.08. Đây là cấu hình khởi đầu, chưa hiệu chỉnh bằng tập dữ liệu độc lập. Điểm tương đồng không phải xác suất đúng.
- Kho đi kèm tin cậy **đáp án do người dùng cung cấp**, không có nghĩa nội dung lịch sử đã được thẩm định độc lập. Hai câu chưa có đáp án được giữ nguyên, có thể hỏi AI để gợi ý.

Kho đã nhập, cài đặt và vị trí bảng được lưu bằng `chrome.storage.local`, chỉ trên profile Chrome của người dùng, không dùng IndexedDB/SQL/database máy chủ hoặc đồng bộ cloud. Chỉ mục TF-IDF ở bộ nhớ, được dựng lại khi worker khởi động. Khóa/token tùy chọn nằm trong `chrome.storage.session`, không nằm trong trang quiz. Các lần ghi kho được xếp nối tiếp; file lỗi hoặc Chrome storage đầy sẽ giữ kho cũ. Có nút xóa, khôi phục, dựng lại chỉ mục.

## Không có AI

Dùng TF-IDF bình thường, không cần đăng nhập, API key, CLI hoặc bridge. Mặc định **Tự hỏi AI** tắt. Nếu bật trước đó nhưng đã quên khóa/token, tra cứu vẫn trả kết quả TF-IDF và không tự gửi yêu cầu AI.

## Dùng tài khoản Codex / Claude, không API key

Tiện ích có hai provider **Codex CLI** và **Claude Code**. Một bridge chỉ nghe loopback chuyển câu hỏi và các đoạn giáo trình đã retrieve đến CLI chính thức. Người dùng đăng nhập bằng luồng chính thức của CLI; tiện ích không lấy cookie, đọc tệp OAuth hoặc gọi endpoint đăng nhập riêng của web chat.

Đăng nhập một lần trong terminal:

```powershell
codex login
codex login status
# Hoặc, nếu đã cài Claude Code:
claude auth login
claude auth status
```

Tạo token riêng để tiện ích kết nối bridge và chạy bridge (Node 22+):

```powershell
$env:QA_EXTENSION_ID = 'YOUR_EXTENSION_ID_FROM_CHROME_EXTENSIONS'
$env:QA_BRIDGE_TOKEN = 'YOUR_RANDOM_LONG_LOCAL_TOKEN'
node scripts/cli-bridge.cjs
```

Trong **Cài đặt**, chọn Codex CLI hoặc Claude Code, đặt endpoint `http://127.0.0.1:8788/responses`, nhập **QA_BRIDGE_TOKEN** vào ô token, cấp quyền kết nối và Lưu. Model có thể để trống để dùng mặc định CLI. Bật **Tự hỏi AI** nếu muốn dự phòng tự động. Nếu Windows không tìm thấy CLI native, đặt `$env:QA_CODEX_BIN` / `$env:QA_CLAUDE_BIN` thành đường dẫn chính xác đến executable trước khi chạy bridge; không dùng shell command hoặc file `.cmd` làm giá trị.

Bridge kiểm tra trạng thái đăng nhập subscription, bỏ biến môi trường API key/provider trước khi gọi CLI. Codex chạy read-only, ephemeral trong thư mục tạm riêng; Claude không được cung cấp tool/MCP và không ghi session hội thoại. Bridge không lưu kho quiz hoặc lịch sử trả lời. Các tệp tạm của job được xóa sau khi xong. Phiên đăng nhập của CLI do chính Codex/Claude quản lý trên máy.

Job được tạo nhanh rồi poll qua localhost để không treo một fetch dài trong MV3. Deadline 90 giây; Hủy/đóng tab hủy job và dừng child process. Mỗi bridge có tối đa 2 job chạy đồng thời. Nếu CLI chưa cài, chưa đăng nhập, hết hạn mức hoặc trả sai JSON, tiện ích giữ gợi ý TF-IDF. Không tự chuyển sang API có tính phí.

Tài liệu chính thức: [Codex đăng nhập ChatGPT](https://learn.chatgpt.com/docs/auth), [Codex non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode), [Claude Code đăng nhập](https://code.claude.com/docs/en/authentication), [Claude Code CLI](https://code.claude.com/docs/en/cli-reference). Khả năng dùng model và hạn mức phụ thuộc tài khoản/gói đang đăng nhập.

## AI dự phòng với giáo trình

Trong **Cài đặt**, nhập model bạn có quyền dùng và hỗ trợ Responses API + Structured Outputs. Chọn provider, cấp quyền kết nối, nhập khóa/token rồi Lưu. Bật **Tự hỏi AI khi TF-IDF chưa xác định được đáp án**, hoặc dùng nút **Hỏi AI + giáo trình** dưới từng câu.

AI retrieve tối đa 6 đoạn liên quan, giới hạn 14.000 ký tự, từ knowledge base nguyên văn; chỉ gửi câu hỏi, phương án và các đoạn đó. Không gửi HTML trang, cookie hay khóa phiên Moodle. JSON trả về được kiểm tra: đúng schema, đáp án khớp duy nhất, mã nguồn có thật và quote là trích dẫn nguyên văn trong đoạn đã gửi. Nút **Xem nguồn** mở trang giáo trình trong tab riêng theo yêu cầu của bạn.

Mặc định AI chỉ gợi ý. Nếu muốn tiện ích chọn gợi ý AI, bật thêm **Cho phép tự chọn gợi ý AI có dẫn chứng và khớp duy nhất**. Trích dẫn có thật không tự chứng minh suy luận AI đúng; kết quả vẫn mang nhãn AI, không được ghi ngược vào kho đáp án tin cậy.

Ở chế độ **API trực tiếp**: khóa chỉ lưu trong `chrome.storage.session`, ràng buộc đúng endpoint, chỉ worker/trang tiện ích truy cập được; không lưu vào kho, không chuyển vào trang quiz. Khởi động lại trình duyệt có thể cần nhập lại khóa. Chế độ này dùng API key; để dùng tài khoản đăng nhập, chọn provider CLI ở trên.

Proxy cục bộ giữ OpenAI API key ở tiến trình Node. Chạy bằng PowerShell trong thư mục này (Node 22+):

```powershell
$env:OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY'
$env:QA_PROXY_TOKEN = 'YOUR_RANDOM_LONG_TOKEN'
$env:QA_EXTENSION_ID = 'YOUR_EXTENSION_ID_FROM_CHROME_EXTENSIONS'
node scripts/proxy.cjs
```

Trong Cài đặt chọn **Proxy cục bộ**, URL `http://127.0.0.1:8787/responses`, nhập `QA_PROXY_TOKEN` vào ô token. Proxy chỉ nghe loopback, kiểm tra Origin đúng extension ID và token. Không đưa khóa thật vào mã nguồn hoặc commit.

AI qua API có timeout 25 giây; CLI có deadline 90 giây. Hủy bằng AbortController khi Hủy/Đóng/đổi trang/đóng tab. Không tự retry AI để tránh gọi trùng. 401/429/500, offline, JSON sai, từ chối, dẫn chứng bịa hoặc output dở dang sẽ báo lỗi và giữ gợi ý cục bộ. TF-IDF không cần kết nối AI.

Tham khảo tích hợp: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) và [vòng đời Chrome service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## Nhập dữ liệu và cập nhật knowledge base

JSON: mảng `{q, options, answer}` với `answer` là chỉ số **bắt đầu từ 0**, hoặc `{question, options, correct_answer_text}`. Có thể dùng `verified: true` và `source`. Đáp án nhiều lựa chọn được giữ nhưng không tự chọn radio. Câu chưa có đáp án: `answer: null`.

CSV UTF-8: cột `q`/`question`, `options` là mảng JSON có escape CSV, hoặc các cột `option_a`, `option_b`, …; đáp án ở `answer` (chỉ số 0-based) hoặc `correct_answer_text`. Cột `verified=true` đánh dấu tin cậy. Hỗ trợ BOM, dấu phẩy trong ngoặc kép và xuống dòng. File tối đa 10 MB, tổng kho tối đa 20.000 câu. Mặc định file nhập chưa được tin cậy; có thể bật ô tin cậy khi nhập sau khi kiểm tra đáp án.

[SKILL.md](LICH-SU-DANG-NGUYEN-VAN/SKILL.md) là điểm vào của knowledge base, có hướng dẫn retrieve và dẫn chứng. [Chỉ mục trang](LICH-SU-DANG-NGUYEN-VAN/references/page-index.json) trỏ đến từng trang. Bản GitHub giữ văn bản từng trang và toàn chương, bỏ ảnh/media gốc vì tool không sử dụng. Chỉ lập chỉ mục các khối văn bản `text` trong `trang/`, tránh nhân đôi với toàn chương; không OCR ảnh thành chứng cứ chưa kiểm tra.

Sau khi sửa 5 quiz nguồn hoặc tài liệu trang, tạo lại dữ liệu đóng gói:

```powershell
node scripts/build-data.cjs
```

Script giữ tất cả câu, không deduplicate biến thể. `data-manifest.json` ghi số lượng và SHA-256 nguồn; dữ liệu đóng gói không có timestamp để build lặp lại cho cùng kết quả. Kho bundled được cập nhật theo phiên bản nguồn; kho tùy chỉnh được giữ.

## Kiểm thử

`../page.html` giữ giao diện Moodle và câu AWS gốc. Next mở `page-2.html`, rồi `page-3.html`, với **2 câu mới cùng đề nhưng khác phương án/đáp án** từ `quiz.json:5` và `quiz.json:11`. Ba trang dùng nguyên DOM/theme Moodle, tài nguyên CSS/font/ảnh được cache trong `page-assets/`. Next/Previous chỉ mở các file cục bộ khi người dùng bấm, không gửi form tới Moodle. Bản nguyên gốc ở `tests/fixtures/moodle-original.html`; baseline ở `../page-assets/moodle-baseline.html`. Tạo lại demo bằng `node scripts/build-demo.cjs`.

Mở `page.html` trực tiếp và bật **Allow access to file URLs** trong Details của tiện ích, hoặc chạy server mẫu (chỉ phục vụ file HTML, không lưu dữ liệu):

```powershell
node scripts/demo-server.cjs
# Mở http://127.0.0.1:8789/page.html
```

Trang 1 là câu AWS ngoài kho Lịch sử Đảng, cần kiểm tra khi không có AI. Tự nhấn Next sang trang 2, bấm Q → Chạy; mẫu thứ nhất chọn radio giá trị 2. Next sang trang 3 rồi Chạy; mẫu cùng đề thứ hai chọn radio giá trị 1. Previous trở lại trang 2 phải giữ lựa chọn trước đó.

```powershell
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:e2e
```

Test tự động gồm: toàn bộ 151 câu và đảo option, cùng câu khác đáp án, mâu thuẫn ngoài top 3, số/phủ định/toán tử, schema/CSV lỗi, bảo toàn DOM, hủy/đóng/tạm dừng, phản hồi muộn, người dùng đổi lựa chọn khi đang chờ, radio disabled/inert/ẩn, nhóm radio trùng, câu tải động, lỗi runtime, nhập kho đồng thời, Chrome storage đầy, worker restart, AI/timeout/abort, CLI child process và proxy.

Playwright chạy manifest phát hành nguyên bản trong profile Chromium riêng, kiểm tra tự inject không nhấn toolbar, bôi đen bằng chuột thật, listener mô phỏng Translate xóa selection/chặn bubble, nút Q/native popover, offline, import/reset, dừng worker bằng CDP, Next/Previous và cập nhật GitHub. Hộp thoại quyền native không nằm trong DOM headless: các nhánh AI/GitHub mô phỏng kết quả quyền; loopback vẫn dùng request HTTP và child process thật. AI dùng fixture, không gọi dịch vụ tính phí. Không khẳng định đã kiểm thử extension Google Translate chính thức.

Chưa kiểm thử trực tiếp tài khoản Moodle thật hoặc gọi AI bằng khóa thật của bạn. Các test xác nhận hành vi đã nêu trên các fixture và Chromium kiểm thử; không thể bảo đảm tuyệt đối mọi phiên bản website hoặc mọi sự cố trình duyệt. Nếu tab vừa được reload/update tiện ích, cần tải lại trang để khôi phục content script.
