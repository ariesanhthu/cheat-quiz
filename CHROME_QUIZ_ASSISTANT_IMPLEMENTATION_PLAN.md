# KẾ HOẠCH TRIỂN KHAI TIỆN ÍCH CHROME TRA CỨU CÂU HỎI VÀ HỖ TRỢ CHỌN PHƯƠNG ÁN

**Phạm vi:** Chrome Manifest V3; tự tra cứu kho câu hỏi bằng TF-IDF (phương pháp đánh trọng số từ khóa); chế độ bôi đen thủ công; chế độ xử lý trang đang mở từ nút nổi; phần kết quả được chèn bổ sung dưới mỗi câu hỏi; tự đánh dấu phương án khi đáp án có cơ sở xác minh; tùy chọn GPT qua API (giao diện lập trình ứng dụng). Không tự nộp hoặc kết thúc bài làm.

## 1. Mục tiêu và nguyên tắc

1. Người dùng cài tiện ích và sử dụng phần tra cứu cục bộ không cần máy chủ, Python hay Codex.
2. Nút nổi cố định ở mép phải trang, có trạng thái **Tắt**, **Đang xử lý**, **Tạm dừng**, **Hoàn thành**, **Lỗi**.
3. Ở chế độ thủ công, người dùng bôi đen đoạn văn bản, bảng kết quả hiện gần vùng chọn; hiển thị tối đa 5 kết quả tương đồng cùng nguồn, nút yêu cầu GPT.
4. Ở chế độ tự động, một lần nhấn nút sẽ quét các câu hỏi được hỗ trợ trên **trang hiện tại**, xử lý từng câu, bổ sung khối kết quả và đánh dấu phương án đã xác định.
5. **Không chỉnh sửa `innerHTML` của câu hỏi, không xoá, không thay thế nút hoặc văn bản Moodle.** Chỉ tạo phần tử mới đặt sau vùng câu hỏi gốc.
6. Không ghi đè các ô người dùng đã tự chọn, trừ khi người dùng bật tùy chọn đó một cách rõ ràng.
7. Không nhấn các nút `Submit`, `Finish attempt`, `End test`; không tự chuyển trang trong bản đầu tiên.
8. Kết quả TF-IDF chỉ là độ tương đồng văn bản, không được báo là xác suất đúng. Nếu không thể xác định một phương án duy nhất thì hiển thị **Cần kiểm tra**, không chọn bừa.
9. Giao diện chỉ hoạt động ở các tên miền mà người dùng cấp quyền.

## 2. Hai chế độ sử dụng

### 2.1 Chế độ thủ công

- Bôi đen đoạn văn bản, lấy `Selection` và `Range` để xác định nội dung cùng tọa độ.
- Hiện bảng nổi gần vùng chọn. Khi chọn nội dung mới, cập nhật bảng cũ, tránh tạo nhiều bảng đè nhau.
- Hiển thị tối đa 5 kết quả kho mẫu; mỗi kết quả có văn bản khớp, đáp án tương ứng, mức tương đồng và nguồn.
- Các nút: **Sao chép**, **Dùng đáp án**, **Yêu cầu GPT**, **Đóng**.
- Nếu không nhận diện được ô trắc nghiệm, chỉ hiển thị và sao chép; tuyệt đối không giả định có thể điền vào biểu mẫu.

### 2.2 Chế độ tự động

- Nút nổi mép phải màn hình, cho phép kéo để đổi vị trí, thu gọn và giữ vị trí đã chọn.
- Khi người dùng nhấn **Chạy trên trang**, tiện ích quét tất cả các khối câu hỏi được hỗ trợ.
- Tra cứu TF-IDF, áp dụng quy tắc kiểm chứng, có thể tự gọi GPT nếu đã bật **Tự yêu cầu GPT khi chưa tìm thấy**.
- Mỗi câu được chèn một khối `.qa-assistant-result` bên dưới phần phương án, hoặc ngay sau `.formulation` nếu cần đảm bảo tính ổn định.
- Khối hiển thị đầy đủ: câu hỏi, đáp án đề xuất, nguồn, mức tương đồng, tình trạng đánh dấu, nút kiểm tra lại.
- Chỉ tự đánh dấu đáp án nếu ánh xạ được duy nhất vào một lựa chọn trên trang và vượt ngưỡng đã hiệu chỉnh.
- Hiển thị tiến độ X/Y, số câu đã đánh dấu, số câu cần xác minh, số lỗi.
- Chạy lại không được chèn hai khối kết quả cho cùng một câu; cập nhật khối hiện hữu theo `data-qa-question-key`.

## 3. Kiến trúc

```text
Trang web
  ├── Content Script (mã tích hợp vào trang)
  │     ├── Site Adapter (bộ nhận diện cấu trúc trang)
  │     ├── Selection Detector (phát hiện phần bôi đen)
  │     ├── Floating Button + Results Panel (nút nổi và bảng kết quả)
  │     ├── DOM Injector (chèn phần tử kết quả, không thay thế câu hỏi)
  │     └── Answer Applier (đánh dấu lựa chọn và kiểm tra lại)
  │
  └── Chrome Runtime Messaging (truyền thông điệp nội bộ)
           └── Extension Service Worker (tiến trình xử lý nền)
                 ├── IndexedDB (cơ sở dữ liệu cục bộ cho kho mẫu và chỉ mục)
                 ├── TF-IDF Search Engine (bộ tìm kiếm tương đồng)
                 ├── Decision Policy (quy tắc tự chọn hoặc bỏ qua)
                 ├── GPT Provider (dịch vụ gọi mô hình, có thể tắt)
                 └── Task State (trạng thái tác vụ và chống xử lý trùng)

Trang Settings (cài đặt): kho mẫu, ngưỡng, tên miền, chế độ GPT, quyền tự chọn.
```

Sử dụng Manifest V3 và Content Script mặc định ở môi trường cô lập. Với giao diện nổi nên dùng Shadow DOM (cây giao diện tách biệt) để hạn chế xung đột định dạng với Moodle. Không dùng giao diện trò chuyện ChatGPT để tự động quét nội dung câu trả lời.

## 4. Bộ nhận diện Moodle, đối chiếu tệp `page.html`

Các bộ chọn đã được xác nhận từ tệp mẫu:

| Ý nghĩa | Bộ chọn |
|---|---|
| Khối câu hỏi | `.que` |
| Văn bản câu hỏi | `.qtext` |
| Khối hiển thị câu hỏi | `.formulation` |
| Danh sách phương án | `.answer` |
| Ô chọn một đáp án | `.answer input[type="radio"]:not([value="-1"])` |
| Nhãn phương án | `[data-region="answer-label"] .flex-fill` |
| Nút chuyển trang | `#mod_quiz-next-nav` |
| Biểu mẫu làm bài | `#responseform` |

Tệp cụ thể dùng `div.que.multichoice`, các phương án là `input[type="radio"]`, nhãn có `aria-labelledby`; nút **Next page** là một nút gửi biểu mẫu. Có cơ chế tự lưu, do đó việc chọn đáp án có thể được ghi nhận ngay cả khi không nộp bài.

Trích xuất:
- Lấy nội dung từ `.qtext` bằng `textContent` sau khi chuẩn hóa dấu cách.
- Với mỗi ô `input`, dùng `aria-labelledby` để tìm nhãn; nếu không có, sử dụng phần tử lân cận và báo thiếu nếu vẫn không nhận được.
- Lưu `option.value`, `option.text`, `option.element`, `option.selected`; không dựa vào ký tự a, b, c, d làm đáp án định danh.
- Mỗi câu được xác định bởi id của `.que` + bản băm nội dung câu hỏi và phương án; cập nhật nếu dữ liệu trên trang đổi.

Áp dụng đáp án:
- Chỉ hỗ trợ câu hỏi chọn một trong nhiều phương án ở bản đầu tiên.
- Ánh xạ **nội dung đáp án** vào phương án thực tế trên trang (so trùng chính xác sau chuẩn hóa, rồi mới so gần đúng có ngưỡng).
- Nếu đúng một lựa chọn hợp lệ, sử dụng `.click()` trên input để kích hoạt xử lý tương tác của Moodle; sau đó kiểm tra lại `.checked`.
- Không chạm vào `input[value="-1"]` (lựa chọn xóa câu trả lời).
- Không can thiệp nút gửi biểu mẫu, chuyển trang, kết thúc hoặc tổng kết.

## 5. Dữ liệu kho mẫu và thuật toán tra cứu

Đề xuất dữ liệu chuẩn hóa:

```json
{
  "id": "sample-001",
  "question": "Which AWS service provides object storage?",
  "options": ["Amazon S3", "Amazon EC2", "Amazon EBS"],
  "correct_answer_text": "Amazon S3",
  "source": "verified-question-bank",
  "verified": true,
  "tags": ["cloud", "storage"]
}
```

Bước tìm kiếm:
1. Chuẩn hóa Unicode, dấu câu, khoảng trắng và kiểu chữ; **giữ** phủ định, toán tử so sánh, số và tên dịch vụ.
2. Kết hợp unigram và bigram, tính TF-IDF và độ tương đồng cosin; tìm Top K, mặc định K = 5.
3. Kiểm tra đáp án đã xác minh và mức tương thích với các phương án thực tế.
4. So sánh chênh lệch điểm giữa kết quả đứng đầu và kết quả thứ hai, cộng kiểm tra phủ định và các con số.
5. Các ngưỡng chỉ là cấu hình khởi tạo, **phải hiệu chỉnh bằng dữ liệu có nhãn**. Không mặc định 0,90 tương đương 90% khả năng đúng.
6. Nếu chưa chắc chắn: trạng thái `needs_review`, không tự đánh dấu; có thể yêu cầu GPT theo cấu hình.

Lưu kho mẫu và chỉ mục bằng IndexedDB trong vùng lưu trữ của tiện ích. Hỗ trợ nhập `.json` và `.csv`, xem số lượng câu, xóa, dựng lại chỉ mục, cập nhật phiên bản nguồn. Không yêu cầu máy chủ trong chế độ tra cứu cục bộ.

## 6. Tích hợp GPT và đăng nhập

**Giai đoạn đầu:** phương thức `local-only` và phương thức `gpt-api` tách biệt.

- Người dùng có thể thêm khóa API và chọn mô hình trong trang cài đặt; tuy nhiên, **không đóng gói khóa bí mật trong tiện ích phát hành công khai**.
- Phương án an toàn để phát hành cho nhiều người: ứng dụng đăng nhập với máy chủ của bạn, máy chủ giữ khóa phía hệ thống và áp dụng hạn mức yêu cầu.
- Phương án tự dùng trên máy: dịch vụ cục bộ `127.0.0.1` đọc khóa từ biến môi trường rồi thay mặt tiện ích gọi API. Tiện ích thuần trình duyệt vẫn có thể tra cứu TF-IDF mà không cần dịch vụ này.
- Một chế độ nâng cao dùng khóa cá nhân trực tiếp trong tiện ích chỉ nên xem là lựa chọn thử nghiệm có rủi ro, không lưu khóa lâu dài hoặc đưa khóa vào mã chạy trên trang.
- Đăng nhập tài khoản ChatGPT trên trình duyệt **không phải** phương thức xác thực OpenAI API.
- Trả kết quả từ GPT dưới dạng JSON có cấu trúc với các trường `answer_text`, `explanation`, `evidence`, `status`; kiểm tra toàn bộ trước khi chèn lên trang.
- Không tự diễn giải câu trả lời GPT là chính xác; nếu không thể đối chiếu phương án duy nhất thì dừng ở bước gợi ý.

## 7. Cấu trúc thư mục đề nghị

```text
quiz-assistant-extension/
├── manifest.json
├── package.json
├── src/
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── message-router.ts
│   │   ├── search-engine.ts
│   │   ├── question-repository.ts
│   │   ├── decision-policy.ts
│   │   └── providers/openai-provider.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── selection-detector.ts
│   │   ├── quiz-scanner.ts
│   │   ├── result-injector.ts
│   │   ├── answer-applier.ts
│   │   ├── floating-control.ts
│   │   └── adapters/moodle-adapter.ts
│   ├── ui/
│   │   ├── manual-panel.ts
│   │   ├── settings.ts
│   │   └── run-status.ts
│   ├── shared/
│   │   ├── types.ts
│   │   ├── normalization.ts
│   │   ├── message-contract.ts
│   │   └── constants.ts
│   └── assets/
├── tests/
│   ├── fixtures/page.html
│   ├── normalization.test.ts
│   ├── search.test.ts
│   ├── answer-mapping.test.ts
│   ├── injector.test.ts
│   └── moodle-e2e.spec.ts
└── README.md
```

Đề xuất TypeScript (JavaScript có kiểm tra kiểu tĩnh), Vite (công cụ đóng gói mã nguồn), Vitest (kiểm thử đơn vị), Playwright (kiểm thử trình duyệt). Giao diện nhỏ có thể viết bằng HTML và CSS nguyên bản, không bắt buộc React.

## 8. Hợp đồng dữ liệu và trạng thái

```ts
type AnswerStatus =
  | "matched"
  | "model_suggested"
  | "needs_review"
  | "unsupported"
  | "error";

type QuestionResult = {
  questionKey: string;
  questionText: string;
  options: Array<{ value: string; text: string }>;
  answerText: string | null;
  matchedOptionValue: string | null;
  source: "tfidf" | "gpt" | "none";
  similarityScore: number | null;
  explanation: string | null;
  status: AnswerStatus;
  applied: boolean;
};
```

Quy trình trạng thái: `idle → scanning → searching → [matched | needs_review] → applying → verified → completed`; riêng GPT: `needs_review → requesting_model → verifying → ...`. Có `paused`, `cancelled`, `error` và cơ chế hủy yêu cầu đang chạy.

## 9. Các giai đoạn triển khai

| Giai đoạn | Công việc | Điều kiện hoàn thành |
|---|---|---|
| P0: Nền tảng | Manifest V3, cấp quyền theo tên miền, liên lạc giữa mã trang và tiến trình nền | Cài được trên Chrome, nhận diện đúng trang mẫu |
| P1: Giao diện | Nút nổi, bảng nổi khi bôi đen, khối kết quả dưới câu hỏi | Không sửa cấu trúc câu hỏi gốc, không chèn trùng |
| P2: Kho mẫu | Nhập JSON, IndexedDB, TF-IDF, Top K, kiểm tra đáp án | Chạy được khi không có mạng, có bài kiểm thử so khớp |
| P3: Tự chọn | Ánh xạ nội dung vào input radio, xác minh sau click | Đánh dấu đúng ô và không thao tác nút nộp |
| P4: GPT | Bộ kết nối API tùy chọn, kết quả JSON có cấu trúc, xử lý lỗi | Không gọi khi kho mẫu đủ chắc chắn; không lộ bí mật |
| P5: Hoàn thiện | Tạm dừng, hủy, làm mới, trạng thái, nhật ký, kiểm thử toàn trang | Không gây trùng, không ghi đè trái phép, không xử lý quá phạm vi |

### Lộ trình phát hành

- **MVP 1:** chỉ trang Moodle mẫu, câu hỏi một lựa chọn, chạy trên trang hiện tại, tìm kho mẫu và bổ sung khối kết quả.
- **MVP 2:** tự chọn có kiểm chứng, bảng kết quả khi bôi đen, nhập kho mẫu theo lô.
- **V1:** GPT tùy chọn, cấu hình tài khoản hoặc máy chủ, báo cáo tiến độ, phân tích lỗi và kiểm thử nhiều trang Moodle khác nhau.
- **Sau V1:** hỗ trợ nhiều loại câu hỏi, bộ nhận diện cho trang web khác, cơ chế đồng bộ kho mẫu, tích hợp bộ điều phối tác nhân.

## 10. Kiểm thử chấp nhận

- [ ] Nhấn nút nổi một lần: xuất hiện đúng một khối kết quả cho mỗi câu hỏi.
- [ ] Nhấn nút nổi lần hai: không chèn trùng; có thể tạm dừng hoặc cập nhật kết quả.
- [ ] Câu gốc và toàn bộ phương án không bị thay thế hoặc xóa.
- [ ] Câu hỏi khớp kho mẫu, đáp án ánh xạ duy nhất: đánh dấu đúng ô.
- [ ] Hai kết quả tương tự nhưng đáp án khác nhau: không tự đánh dấu nếu chưa xác minh.
- [ ] Câu hỏi có từ phủ định hoặc số khác với bản mẫu: không tự gán theo độ tương đồng thuần túy.
- [ ] Người dùng đã đánh dấu một ô: tiện ích không ghi đè theo cấu hình mặc định.
- [ ] Không có kết nối hoặc chưa nhập khóa API: vẫn dùng TF-IDF cục bộ.
- [ ] GPT lỗi, hết hạn mức hoặc trả định dạng không hợp lệ: không đánh dấu bừa.
- [ ] Trang chứa nhiều câu và câu mới xuất hiện sau tải động: không bỏ sót, không xử lý lặp.
- [ ] Không có bất kỳ đường thực thi nào tự nhấn nút hoàn tất, nộp bài hoặc kết thúc.
- [ ] Không gửi thông tin phiên đăng nhập, cookie, khóa biểu mẫu hoặc toàn bộ HTML lên GPT.
- [ ] Thử trên bản sao cục bộ của `page.html` trước khi cấp quyền chạy trên trang thật.

## 11. Các quyết định cần giữ ổn định

1. Chế độ tự động là **một thao tác kích hoạt trên trang hiện tại**, không phải tự động di chuyển qua toàn bộ kỳ thi.
2. **Gợi ý khi thiếu bằng chứng, chỉ chọn khi đã xác minh ánh xạ.**
3. Chỉ làm mới hoặc bổ sung phần giao diện riêng; Moodle vẫn giữ nguyên sở hữu đối với biểu mẫu gốc.
4. GPT là tuyến dự phòng, không phải nguồn tra cứu mặc định.
5. Chế độ tra cứu bằng TF-IDF phải chạy được hoàn toàn cục bộ.
6. Tách `SiteAdapter`, `SearchEngine`, `DecisionPolicy`, `ResultRenderer`, `AnswerApplier` để dễ hỗ trợ các hệ thống học tập khác.

## 12. Tài liệu kỹ thuật tham khảo

- Chrome Extension Content Scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Chrome Storage API: https://developer.chrome.com/docs/extensions/reference/api/storage
- IndexedDB trong vùng tiến trình nền: https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Bảo vệ khóa API: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
- ChatGPT và API có hệ thống thanh toán riêng: https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
