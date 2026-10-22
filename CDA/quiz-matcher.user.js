// ==UserScript==
// @name         Quiz bank matcher (inline)
// @namespace    tool-quiz
// @version      1.3
// @description  Match quiz questions against the bundled CDA/result.json bank or imported JSON files.
// @match        https://courses.ctda.hcmus.edu.vn/mod/quiz/attempt.php*
// @match        https://courses.hcmus.edu.vn/mod/quiz/attempt.php*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

// Toggle with the "Flag question" link. Fork of match.user.js.
// Usage: install in Tampermonkey/Violentmonkey, or paste the whole file into the DevTools console.
// CDA/result.json is bundled below so Console execution needs no local-file access.
// Import any bank JSON: [{ n, q, options: [...], answer: index | [indexes] | null }]

(() => {
  const STORE = 'quizBank.cda.v1';
  const HIGHLIGHT_THRESHOLD = 0.8;
  // Bundled snapshot of CDA/result.json; use the file picker for newer data.
  const DEFAULT_BANK = [
    {"n":1,"q":"Heroin thuộc nhóm chất ma túy nào sau đây?","options":["Chất ma túy có nguồn gốc hoàn toàn tự nhiên","Chất ma túy bán tổng hợp từ morphine","Chất kích thích tổng hợp hoàn toàn","Tiền chất ma túy nhóm I"],"answer":1,"explanation":"Heroin (diacetylmorphine) được điều chế bằng cách bán tổng hợp từ morphine (chiết xuất từ nhựa thuốc phiện) kết hợp với anhydrid axetic."},
    {"n":2,"q":"Ma túy dạng 'nước vui' thường có đặc điểm và thành phần như thế nào?","options":["Chỉ chứa nước cất tinh khiết pha phẩm màu","Hỗn hợp pha trộn nhiều loại ma túy tổng hợp như Ketamine, Diazepam, MDMA và cafein dưới dạng gói bột hòa tan","Nước tăng lực thông thường được đóng chai ở nước ngoài","Chế phẩm chiết xuất 100% từ lá cây coca"],"answer":1,"explanation":"'Nước vui' là dạng ma túy tổng hợp ngụy trang dưới dạng bột hòa tan trong nước, thường phối trộn nhiều hoạt chất hướng thần nguy hiểm."},
    {"n":3,"q":"Quá trình tái nghiện ma túy theo y học tâm thần thường diễn biến qua 3 giai đoạn tuần tự là:","options":["Tái nghiện thể chất -> Tái nghiện cảm xúc -> Tái nghiện tâm trí","Tái nghiện tâm trí -> Tái nghiện thể chất -> Tái nghiện hành vi","Tái nghiện cảm xúc -> Tái nghiện tâm trí -> Tái nghiện thể chất","Tái nghiện sinh lý -> Tái nghiện xã hội -> Tái nghiện tinh thần"],"answer":2,"explanation":"3 giai đoạn tái nghiện kinh điển gồm: Tái nghiện cảm xúc (chưa nghĩ đến dùng ma túy nhưng cảm xúc bất ổn), Tái nghiện tâm trí (đấu tranh nội tâm, thèm nhớ thuốc), và Tái nghiện thể chất (thực tế sử dụng lại)."},
    {"n":4,"q":"Theo quy định tại Nghị định 116/2021/NĐ-CP, quy trình cai nghiện ma túy chính thức gồm bao nhiêu giai đoạn?","options":["3 giai đoạn","4 giai đoạn","5 giai đoạn","6 giai đoạn"],"answer":2,"explanation":"Quy trình gồm 5 giai đoạn: Tiếp nhận, phân loại; Điều trị cắt cơn, giải độc, điều trị rối loạn tâm thần; Giáo dục, tư vấn, phục hồi hành vi, nhân cách; Lao động trị liệu, học nghề; Chuẩn bị tái hòa nhập cộng đồng."},
    {"n":5,"q":"Theo Luật Phòng, chống ma túy 2021, cơ quan hoặc chức danh nào có thẩm quyền ra quyết định quản lý người sử dụng trái phép chất ma túy?","options":["Chủ tịch Ủy ban nhân dân cấp xã","Trưởng Công an cấp xã","Trưởng phòng Lao động - Thương binh và Xã hội","Trưởng Công an cấp huyện"],"answer":1,"explanation":"Khoản 2 Điều 23 Luật Phòng, chống ma túy năm 2021 quy định Trưởng Công an cấp xã là người ra quyết định và tổ chức quản lý người sử dụng trái phép chất ma túy cư trú tại địa phương."},
    {"n":6,"q":"Thời hạn quản lý người sử dụng trái phép chất ma túy theo Luật Phòng, chống ma túy 2021 là bao lâu?","options":["06 tháng kể từ ngày có kết quả xét nghiệm dương tính","01 năm kể từ ngày có kết quả xét nghiệm dương tính","02 năm kể từ ngày có quyết định quản lý","03 năm liên tục"],"answer":1,"explanation":"Khoản 2 Điều 23 Luật Phòng, chống ma túy 2021 quy định thời hạn quản lý người sử dụng trái phép chất ma túy là 01 năm kể từ ngày có kết quả xét nghiệm dương tính."},
    {"n":7,"q":"Chính sách hỗ trợ tiền ăn, quần áo, sinh hoạt cá nhân cho người cai nghiện ma túy tự nguyện tại cơ sở cai nghiện công lập được tính dựa trên chuẩn nào?","options":["Mức lương tối thiểu vùng","Mức chuẩn trợ giúp xã hội","Mức lương cơ sở","Do cơ sở cai nghiện tự quy định mức cố định"],"answer":2,"explanation":"Các định mức hỗ trợ tiền ăn, chăn màn, quần áo, đồ dùng sinh hoạt cá nhân của người cai nghiện tự nguyện tại cơ sở công lập được quy định tương ứng theo tỷ lệ phần trăm của mức lương cơ sở."},
    {"n":8,"q":"Nghị quyết số 02-NQ/TU của Ban Thường vụ Thành ủy TP.HCM nhấn mạnh mục tiêu trọng tâm nào?","options":["Phấn đấu xây dựng xã, phường, thị trấn, cơ quan, doanh nghiệp, trường học không có ma túy","Tăng cường cấp phép sử dụng chất hướng thần trong kinh doanh","Giảm nhẹ mức xử phạt đối với tội phạm ma túy","Chuyển giao toàn bộ việc xử phạt ma túy cho các tổ chức xã hội"],"answer":0,"explanation":"Nghị quyết 02-NQ/TU của Thành ủy TP.HCM đặt trọng tâm lãnh đạo, chỉ đạo xây dựng địa bàn trong sạch, tiến tới mục tiêu xây dựng xã, phường, thị trấn, cơ sở giáo dục không ma túy."},
    {"n":9,"q":"Ma túy tổng hợp Methamphetamine (ma túy 'đá') thường có hình dạng đặc trưng nào?","options":["Chất bột màu nâu sẫm, dẻo quánh","Dạng tinh thể trong suốt hoặc trắng đục, giống hạt muối ăn hoặc bột ngọt","Viên nén hình tròn dập nổi logo hoa quả","Dung dịch sệt màu xanh lá cây"],"answer":1,"explanation":"Methamphetamine dạng tinh thể (thường gọi là hàng đá) có cấu trúc tinh thể trong suốt hoặc trắng ngà, dễ nhầm với hạt muối hoặc phèn chua."},
    {"n":10,"q":"Hành vi cho thuê, cho mượn địa điểm hoặc có bất kỳ hành vi nào khác chứa chấp việc sử dụng trái phép chất ma túy (chưa đến mức truy cứu hình sự) theo Nghị định 282/2025/NĐ-CP bị phạt tiền:","options":["1.000.000 đồng – 2.000.000 đồng","5.000.000 đồng – 10.000.000 đồng","10.000.000 đồng – 20.000.000 đồng","30.000.000 đồng – 50.000.000 đồng"],"answer":2,"explanation":"Nghị định 282/2025/NĐ-CP quy định mức phạt từ 10.000.000 đồng đến 20.000.000 đồng đối với cá nhân có hành vi cho thuê, cho mượn địa điểm hoặc chứa chấp việc sử dụng trái phép chất ma túy nhưng chưa cấu thành tội phạm hình sự."},
    {"n":11,"q":"Biểu hiện nào sau đây phản ánh đặc trưng của giai đoạn 'Tái nghiện cảm xúc' (Emotional Relapse)?","options":["Người cai nghiện đã trực tiếp liên hệ đầu nậu để mua hàng","Bản thân chưa có ý nghĩ sử dụng lại ma túy nhưng xuất hiện cảm xúc lo âu, bực bội, cô lập và bỏ bê chăm sóc bản thân","Lên kế hoạch cụ thể về thời gian và địa điểm để sử dụng lại","Hội chứng cai thể chất bùng phát dữ dội"],"answer":1,"explanation":"Ở giai đoạn tái nghiện cảm xúc, người cai nghiện chưa có chủ đích tái nghiện nhưng tâm lý bị stress, thu mình, tạo điều kiện kích hoạt ham muốn ở giai đoạn sau."},
    {"n":12,"q":"Biểu hiện nào cho thấy người cai nghiện đang rơi vào giai đoạn 'Tái nghiện tâm trí' (Mental Relapse)?","options":["Tâm lý thoải mái, tích cực tham gia các hoạt động thể thao","Xảy ra cuộc đấu tranh nội tâm giữa việc muốn giữ tỉnh táo và việc khao khát nhớ lại cảm giác 'phê thuốc'","Cơ thể bị sốc thuốc do tái sử dụng liều cao","Mất hoàn toàn khả năng nhận thức và ngôn ngữ"],"answer":1,"explanation":"Tái nghiện tâm trí đặc trưng bởi sự giằng xé nội tâm: nhớ lại cảm giác hưng phấn trong quá khứ, tự huyễn hoặc 'chỉ dùng một lần duy nhất'."},
    {"n":13,"q":"Theo Luật Phòng, chống ma túy 2021, tiền chất ma túy được định nghĩa là gì?","options":["Là các chất làm giảm đau, hạ sốt thông thường","Là hóa chất không thể thiếu trong quá trình điều chế, sản xuất chất ma túy","Là chất cặn bã sau khi tinh chế thuốc phiện","Là mọi loại phân bón hóa học dùng cho cây trồng"],"answer":1,"explanation":"Khoản 4 Điều 2 Luật Phòng, chống ma túy 2021 quy định: Tiền chất là hóa chất không thể thiếu trong quá trình điều chế, sản xuất chất ma túy được quy định trong danh mục do Chính phủ ban hành."},
    {"n":14,"q":"Biện pháp xử lý hành chính đưa vào cơ sở cai nghiện bắt buộc áp dụng đối với người nghiện ma túy từ đủ bao nhiêu tuổi theo quyết định của Tòa án nhân dân?","options":["Từ đủ 14 tuổi trở lên","Từ đủ 16 tuổi trở lên","Từ đủ 18 tuổi trở lên","Từ đủ 21 tuổi trở lên"],"answer":2,"explanation":"Theo Luật Xử lý vi phạm hành chính và Luật Phòng, chống ma túy 2021, biện pháp xử lý hành chính đưa vào cơ sở cai nghiện bắt buộc chỉ áp dụng đối với người nghiện từ đủ 18 tuổi trở lên."},
    {"n":15,"q":"Đối với người nghiện ma túy từ đủ 12 tuổi đến dưới 18 tuổi, biện pháp đưa vào cơ sở cai nghiện bắt buộc có tính chất pháp lý như thế nào?","options":["Là biện pháp xử lý vi phạm hành chính thông thường","Là biện pháp hình sự áp dụng cho người chưa thành niên","Không phải là biện pháp xử lý vi phạm hành chính, do Tòa án nhân dân cấp huyện quyết định áp dụng","Do Chủ tịch UBND cấp xã trực tiếp ra quyết định đưa đi"],"answer":2,"explanation":"Khoản 1 Điều 33 Luật Phòng, chống ma túy 2021 quy định người từ đủ 12 đến dưới 18 tuổi bị đưa vào cơ sở cai nghiện bắt buộc theo quyết định của TAND cấp huyện và không bị coi là bị xử lý vi phạm hành chính."},
    {"n":16,"q":"Ma túy 'cỏ Mỹ' (K2/Spice) thực chất là sản phẩm gì?","options":["Một loại cỏ tự nhiên mọc ở vùng Bắc Mỹ không có độc tố","Lá thảo mộc khô được tẩm ướp các hóa chất cần sa tổng hợp (Synthetic Cannabinoids)","Lá chè xanh sấy khô ngâm dung dịch muối","Nhựa cây thuốc phiện nguyên chất tán mịn"],"answer":1,"explanation":"'Cỏ Mỹ' là các loại thực vật, thảo mộc khô bị tẩm ướp hóa chất cần sa tổng hợp, có độc tính và khả năng gây loạn thần cao gấp nhiều lần cần sa tự nhiên."},
    {"n":17,"q":"Thời hạn quản lý sau cai nghiện tại nơi cư trú đối với người đã hoàn thành thời hạn cai nghiện bắt buộc là:","options":["06 tháng đến 01 năm","01 năm đến 02 năm","03 năm đến 05 năm","Vĩnh viễn"],"answer":1,"explanation":"Khoản 3 Điều 40 Luật Phòng, chống ma túy 2021 quy định thời hạn quản lý sau cai nghiện ma túy tại nơi cư trú là từ 01 năm đến 02 năm kể từ ngày hoàn thành cai nghiện."},
    {"n":18,"q":"Theo Luật Phòng, chống ma túy 2021, lực lượng nào có thẩm quyền yêu cầu người nghi vấn xét nghiệm chất ma túy trong cơ thể?","options":["Ban quản lý khu phố hoặc Tổ trưởng dân phố","Công an cấp xã, Công an cấp huyện hoặc cơ quan có thẩm quyền tiến hành tố tụng","Ban Giám hiệu nhà trường","Bảo vệ dân phố độc lập"],"answer":1,"explanation":"Điều 22 Luật Phòng, chống ma túy 2021 quy định Công an cấp xã, Công an cấp huyện chủ trì, phối hợp với cơ quan y tế thực hiện xét nghiệm chất ma túy trong cơ thể."},
    {"n":19,"q":"Hậu quả nguy hiểm cấp tính đe dọa tính mạng trực tiếp nhất khi sử dụng quá liều nhóm Opiats (Heroin, Morphine) là gì?","options":["Tăng huyết áp đột ngột gây vỡ mạch máu","Ức chế trung tâm hô hấp ở hành não dẫn đến ngừng thở","Sốt cao ác tính và co giật","Hạ đường huyết cấp tính"],"answer":1,"explanation":"Chất ma túy nhóm Opiats ức chế chọn lọc trung tâm hô hấp tại thân não; quá liều sẽ dẫn đến ngừng thở, thiếu oxy não và tử vong nhanh chóng nếu không được tiêm Naloxone giải độc kịp thời."},
    {"n":20,"q":"Thuốc lắc (MDMA / Ecstasy) tác động chủ yếu lên hệ thần kinh trung ương theo cơ chế nào?","options":["Thuần túy an thần và gây ngủ sâu","Kích thích giải phóng ồ ạt serotonin, dopamine và norepinephrine gây hưng phấn, ảo giác và tăng thân nhiệt","Làm tê liệt tủy sống","Làm chậm nhịp tim dưới mức bình thường"],"answer":1,"explanation":"MDMA là dẫn xuất của amphetamine, kích thích phóng thích mạnh serotonin và dopamine tạo trạng thái đồng cảm ảo, tăng động, mất kiểm soát thân nhiệt và mất nước."},
    {"n":21,"q":"Cai nghiện ma túy là quá trình thực hiện các hoạt động hỗ trợ về ……………………… giúp người nghiện ma túy dừng sử dụng chất ma túy, thuốc gây nghiện, thuốc hướng thần. Chỗ “….” là:","options":["Y tế, xã hội","Y tế, tâm lý, xã hội","Y tế, đời sống, tâm lý","Y tế và sức khỏe thể chất, tâm thần, đời sống xã hội"],"answer":1,"explanation":"Theo khoản 13 Điều 2 Luật Phòng, chống ma túy 2021, cai nghiện ma túy là quá trình thực hiện các hoạt động hỗ trợ về y tế, tâm lý, xã hội."},
    {"n":22,"q":"Theo quy định của pháp luật hiện hành, việc không ban hành quy trình cai nghiện ma túy, quy trình cung cấp dịch vụ cai nghiện tự nguyện tại gia đình, cộng đồng sẽ bị xử phạt hành chính từ 10.000.000 đồng – 15.000.000 đồng.","options":["Sai","Đúng"],"answer":0,"explanation":"Theo điểm a khoản 1 Điều 31 Nghị định 282/2025/NĐ-CP, hành vi này bị phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với cá nhân, không phải khung 10.000.000 – 15.000.000 đồng."},
    {"n":23,"q":"Một người sử dụng chất X có biểu hiện ban đầu phấn khích, tự tin; sau đó suy sụp, lo âu và mất ngủ. Nếu chỉ căn cứ chuỗi diễn biến này, chất X phù hợp nhất với:","options":["Cocaine.","Thuốc ngủ.","Diazepam.","Thuốc phiện."],"answer":0,"explanation":"Cocaine là chất kích thích thần kinh gây trạng thái bùng nổ hưng phấn, tự tin tức thời, tiếp theo ngay sau đó là giai đoạn suy sụp cảm xúc nghiêm trọng (crash), hoảng loạn và mất ngủ."},
    {"n":24,"q":"Vì sao không thể kết luận một sản phẩm “không phải ma túy” chỉ vì nó có dạng bánh, kẹo hoặc đồ uống?","options":["Vì hình thức thực phẩm tự động làm sản phẩm trở thành tiền chất.","Vì mọi bánh kẹo đều có chất hướng thần.","Vì chỉ thực phẩm mới được dùng để vận chuyển ma túy.","Vì thực tế cho thấy chất ma túy có thể được pha, tẩm hoặc ngụy trang trong sản phẩm tiêu dùng."],"answer":3,"explanation":"Tội phạm ma túy thường xuyên ngụy trang, tẩm ướp ma túy vào bánh kẹo, đồ uống, tinh dầu thuốc lá điện tử nhằm qua mặt lực lượng kiểm tra."},
    {"n":25,"q":"Vì sao khâu vận chuyển có thể vừa được chuẩn bị rất kỹ nhưng vẫn được xem là “khâu yếu”?","options":["Vì quá trình dịch chuyển làm tang vật phải đi qua không gian kiểm soát và tạo cơ hội bị phát hiện.","Vì người cầm đầu luôn đi cùng tang vật.","Vì không thể sử dụng hàng hóa ngụy trang.","Vì không thể thuê người vận chuyển."],"answer":0,"explanation":"Khi vận chuyển trên đường giao thông, tang vật buộc phải lưu thông qua các chốt kiểm soát, máy soi chiếu, trạm liên ngành, phát sinh nhiều yếu tố bất ngờ khiến đối tượng dễ bị bắt quả tang."},
    {"n":26,"q":"Theo Thông tư 40/2026/TT-BGDĐT, sinh viên thực hiện hành vi 'Tổ chức, xúi giục, cưỡng ép người khác sử dụng ma túy' trong môi trường học đường thì nhà trường xử lý ra sao?","options":["Áp dụng hình thức đình chỉ học tập 06 tháng – 1 năm và báo cáo về địa phương","Áp dụng hình thức cảnh cáo và cho nộp bản kiểm điểm, khắc phục hậu quả","Áp dụng hình thức buộc thôi học và chuyển hồ sơ sang cơ quan công an xử lý theo quy định hình sự","Yêu cầu chuyển sang cơ sở giáo dục khác"],"answer":2,"explanation":"Hành vi tổ chức, cưỡng ép, xúi giục sử dụng ma túy là vi phạm đặc biệt nghiêm trọng; chế tài xử lý của nhà trường là buộc thôi học và bàn giao hồ sơ sang cơ quan công an để xử lý hình sự."},
    {"n":27,"q":"Chủ cơ sở cho thuê trọ không thực hiện thông báo lưu trú cho sinh viên/khách đến ở theo quy định Nghị định 282/2025/NĐ-CP có thể bị xử phạt khung tiền nào?","options":["Phạt tiền từ 100.000 đồng đến 300.000 đồng (mức nặng có thể lên đến 2.000.000 đồng đối với cơ sở kinh doanh lưu trú)","Thu hồi giấy phép kinh doanh trong khoảng thời gian 01 tháng","Chỉ cần nhanh chóng thực hiện lại báo cáo lưu trú trên ứng dụng VNeID","Phạt tiền từ 1.000.000 đồng đến 2.000.000 đồng (mức nặng có thể lên đến 12.000.000 đồng đối với cơ sở kinh doanh lưu trú)"],"answer":3,"explanation":"Khung phạt tiền khởi điểm từ 1.000.000 đến 2.000.000 đồng đối với cá nhân và tăng dần theo quy mô số người vi phạm, tối đa lên tới 12.000.000 đồng đối với cơ sở kinh doanh lưu trú."},
    {"n":28,"q":"Việc tội phạm ma tuý dịch chuyển sang hoạt động trên không gian mạng, có thể giúp cho tội phạm về ma tuý:","options":["Cả 3 đáp án đều đúng","Có thể tăng cường quảng cáo, mua bán, giao dịch","Khó phát hiện, khó đấu tranh","Tăng lợi nhuận bằng cách pha trộn thêm các loại bột khác"],"answer":0,"explanation":"Không gian mạng giúp tội phạm mở rộng quảng cáo mua bán, lợi dụng tính ẩn danh gây khó khăn cho điều tra và dễ dàng gian lận chất lượng để trục lợi."},
    {"n":29,"q":"Nội dung nào sau đây là liên quan đến tệ nạn ma tuý là gì?","options":["Hành vi vi phạm pháp luật về ma tuý","Nghiện ma tuý","Sử dụng chất ma tuý","Tất cả đáp án trên đều là tệ nạn ma tuý"],"answer":3,"explanation":"Khoản 14 Điều 2 Luật Phòng, chống ma túy 2021 xác định tệ nạn ma túy bao gồm việc sử dụng trái phép chất ma túy, nghiện ma túy và các hành vi vi phạm pháp luật về ma túy chưa đến mức xử lý hình sự."},
    {"n":30,"q":"Điểm đáng chú ý của GHB (“Nước biển”) trong công tác nhận biết là:","options":["Luôn có màu sắc đặc trưng.","Chỉ tồn tại dạng bột.","Có mùi rất mạnh nên dễ nhận biết.","Rất khó phát hiện khi hòa vào nước."],"answer":3,"explanation":"GHB nguyên chất là dung dịch lỏng không màu, không mùi, vị hơi mặn nhạt nên khi hòa vào rượu bia, nước ngọt rất khó bị nhận biết bằng mắt hoặc mũi."},
    {"n":31,"q":"Trước khi chuyển về Bộ Công an thì nhiệm việc quản lý nhà nước về cai nghiên ma tuý và quản lý sau cai nghiện ma tuý thuộc:","options":["Ủy ban Nhân dân cấp Xã","Ủy ban Nhân dân cấp Tỉnh","Bộ Lao động - Thương binh và Xã hội","Bộ Khoa học và Công nghệ"],"answer":2,"explanation":"Bộ Lao động - Thương binh và Xã hội trước đây là cơ quan đầu mối cấp bộ thực hiện quản lý nhà nước về công tác cai nghiện ma túy và quản lý sau cai."},
    {"n":32,"q":"Theo Bộ luật Hình sự năm 2015 sửa đổi, bổ sung năm 2025, có bao nhiêu tội danh là tội phạm về ma tuý được xác định là tội phạm đặc biệt nghiêm trọng?","options":["10 tội danh","9 tội danh","8 tội danh","7 tội danh"],"answer":0,"explanation":"Trong 13 tội danh thuộc Chương XX BLHS, có 10 tội danh có khung hình phạt cao nhất vượt quá 15 năm tù (từ 20 năm, chung thân đến tử hình) thuộc nhóm tội đặc biệt nghiêm trọng."},
    {"n":33,"q":"Nhận định nào sau đây là chưa đúng?","options":["Dùng ma túy sẽ làm tăng khả năng tình dục, tuy nhiên khả năng tình dục suy giảm sau khi ngưng dùng thuốc một thời gian khá lâu","Ma túy làm hủy hoại sức khoẻ, làm mất khả năng lao động, học tập, làm cho thần kinh người nghiện bị tổn hại","Ma túy phá hoại thể xác và nhân cách người nghiện, gây di hại cho con cái từ bào thai","Các chất ma túy sẽ kích thích làm tăng nhịp tim, ảnh hưởng trực tiếp lên tim, thậm chí gây nhồi máu cơ tim"],"answer":0,"explanation":"Quan niệm ma túy làm tăng khả năng tình dục là sai lầm; ma túy kích thích giải phóng dopamine tạo hưng phấn tức thời nhưng hủy hoại chức năng cương dương và làm giảm ham muốn sinh lý nhanh chóng."},
    {"n":34,"q":"Việc phân loại chất ma túy theo cấu trúc hóa học đặc biệt có giá trị đối với:","options":["Nghiên cứu chuyển hóa và phương pháp giám định chất ma túy.","Xác định mức án đối với người phạm tội.","Xác định người sử dụng đã nghiện hay chưa","Lựa chọn địa điểm cai nghiện."],"answer":0,"explanation":"Phân loại theo cấu trúc khung hóa học giúp xác định cơ chế chuyển hóa trong cơ thể và cung cấp cơ sở để lựa chọn kỹ thuật phân tích, giám định pháp y (GC-MS, LC-MS)."},
    {"n":35,"q":"Điểm nào làm LSD đặc biệt nguy hiểm theo mô tả trong tài liệu?","options":["Khả năng gây ảo giác mạnh có thể dẫn đến hành vi cực kỳ nguy hiểm.","Chỉ nguy hiểm khi được tiêm vào cơ thể.","Chỉ gây buồn ngủ kéo dài.","Chỉ gây giảm huyết áp mà không ảnh hưởng nhận thức."],"answer":0,"explanation":"LSD là chất gây ảo giác cực mạnh chỉ với liều microgram, khiến người dùng rơi vào trạng thái 'bad trip', hoang tưởng, ảo giác dẫn đến hành vi tự sát hoặc tấn công bạo lực."},
    {"n":36,"q":"Theo Luật phòng, chống ma tuý, hành vi nào sau đây bị nghiêm cấm","options":["Tất cả đáp án trên đều đúng","Tàng trữ trái phép chất ma tuý","Chứa chấp, lôi kéo người khác sử dụng ma tuý","Lợi vụ chức vụ, quyền hạn để bao che vi phạm về ma tuý"],"answer":0,"explanation":"Điều 5 Luật Phòng, chống ma túy 2021 quy định nghiêm cấm tàng trữ, vận chuyển, mua bán ma túy; chứa chấp, lôi kéo người khác; và lợi dụng chức vụ, quyền hạn để bao che vi phạm."},
    {"n":37,"q":"Nhận định nào sau đây là không đúng?","options":["Bản thân shisa chứa nhiều nicotin là chất - gây hưng phấn, dễ gây nghiện","Shisha khi hít vào sẽ ảnh hưởng trực tiếp đến đường dẫn khí, cơ quan hô hấp","Shisa là ma tuý, là loại cỏ có xuất sứ từ Ả Rập","Shisa cũng có thể ảnh hưởng đến hệ thần kinh gây ảo giác ở một số người."],"answer":2,"explanation":"Shisha không phải là chất ma túy và không phải là một loại cỏ; bản chất shisha là lá thuốc lá được tẩm hương liệu, chịu sự điều chỉnh của Luật Phòng, chống tác hại của thuốc lá."},
    {"n":38,"q":"Thời hạn tạm giữ người theo thủ tục hành chính để xác định tình trạng nghiện ma túy tối đa là bao lâu theo quy định?","options":["Tối đa 15 ngày liên tục","Tối đa 30 ngày","Tối đa 03 ngày (72 giờ) và có thể gia hạn theo quy định nhưng không quá 05 ngày","Tối đa 24 giờ và có thể gia hạn khi chờ điều tra nhưng không quá 05 ngày"],"answer":2,"explanation":"Khoản 3 Điều 122 Luật Xử lý vi phạm hành chính quy định trường hợp tạm giữ để xác định tình trạng nghiện ma túy thì thời hạn tạm giữ có thể kéo dài hơn nhưng không quá 05 ngày."},
    {"n":39,"q":"Trong các nhóm chất sau, nhóm nào là các chất ma tuý có nguồn gốc tự nhiên?","options":["Heroin, morphine, codein, cocaine","Các sản phẩm của cần sa, thuốc phiện, heroin, crắck","Tất cả các sản phẩm được nêu đều đúng","Thuốc phiện, morphine, codein, cần sa"],"answer":3,"explanation":"Thuốc phiện, morphine, codein và cần sa đều được thu hoạch, chiết xuất trực tiếp từ thực vật mà không qua bán tổng hợp hay biến đổi phân tử như Heroin hay Crắck."},
    {"n":40,"q":"Biểu hiện nào sau đây thể hiện thủ đoạn đối phó khi bị bắt của các đối tượng phạm tội về ma tuý?","options":["Các phương tiện thông tin được đối tượng sử dụng chủ yếu là máy nhắn tin, điện thoại","Không khai báo hoặc khai báo một cách nhỏ giọt, khai có tính chất vừa khai vừa thăm dò","Dùng tiếng lóng, ký hiệu được ẩn dưới dạng trao đổi công việc","Sử dụng người già, trẻ vị thành niên, phụ nữ đang mang thai để giao nhận ma túy"],"answer":1,"explanation":"Khi bị bắt giữ, đối tượng thường áp dụng thủ đoạn giữ im lặng, không khai báo hoặc khai báo nhỏ giọt mang tính thăm dò cơ quan điều tra nhằm tìm cách chối tội và bao che đồng phạm."},
    {"n":41,"q":"Trong các phương pháp sau, đâu không phải là phương pháp nhận biết chất ma tuý hiện nay?","options":["Nhận biết qua trạng thái người sử dụng"],"answer":0},
    {"n":42,"q":"Người nước ngoài có hành vi vi phạm pháp luật nghiêm trọng về an ninh trật tự hoặc tệ nạn xã hội trên lãnh thổ Việt Nam ngoài phạt tiền có thể bị áp dụng hình thức xử phạt nào?","options":["Trục xuất khỏi lãnh thổ nước Cộng hòa Xã hội Chủ nghĩa Việt Nam"],"answer":0},
    {"n":43,"q":"Theo Luật phòng, chống ma tuý, lực lượng nào có vai trò quan trọng góp phần kết nối giữa chính quyền và người dân trong công tác tuyên truyền, vận động và hỗ trợ người sau cai nghiện tái hòa nhập cộng đồng?","options":["Mặt trận Tổ quốc Việt Nam và tổ chức thành viên"],"answer":0},
    {"n":44,"q":"Nhận định nào sau đây là đúng?","options":["Khi sử dụng trái phép chất ma túy thường là nguyên nhân chủ yếu của mâu thuẫn và bất hoà với bạn bè, thầy cô giáo và gia đình"],"answer":0},
    {"n":45,"q":"Theo các cơ quan chức năng xác định, ma tuý “trà sữa” có thành phần chính là:","options":["Ma tuý “đá”"],"answer":0},
    {"n":46,"q":"Đối với hành vi cung cấp địa điểm, phương tiện cho người khác tàng trữ trái phép chất ma tuý sẽ bị xử phạt hành chính","options":["Từ 50 triệu đồng – 70 triệu đồng"],"answer":0},
    {"n":47,"q":"Quốc gia nào được trồng thuốc phiện hợp pháp dưới sự kiểm soát của Liên hợp quốc vì mục tiêu lấy nguyên liệu phục vụ sản xuất thuốc chữa bệnh trên toàn cầu?","options":["Ấn Độ"],"answer":0},
    {"n":48,"q":"Tội phạm ma túy trên không gian mạng tận dụng ưu thế nào của các ứng dụng liên lạc?","options":["Nhanh, không biên giới, có tính ẩn danh và bảo mật tương đối cao"],"answer":0},
    {"n":49,"q":"Một người sau cai nghiện bắt đầu cô lập, bỏ sinh hoạt hỗ trợ, dễ cáu gắt. Theo diễn tiến của nguy cơ tái nghiện, đây là dấu hiệu cảnh báo gần nhất với loại hình tái nghiện nào?","options":["Tái nghiện cảm xúc"],"answer":0},
    {"n":50,"q":"Vì sao TP.HCM cần Tổ công tác liên ngành kiểm soát hoạt động hợp pháp liên quan đến ma túy?","options":["Vì hoạt động liên quan trải rộng công nghiệp, y tế, thú y, hải quan... nên cần phối hợp để ngăn bị lợi dụng"],"answer":0},
    {"n":51,"q":"Việt Nam tham gia 3 Công ước của Liên hợp quốc về kiểm soát ma túy năm 1997. Ý nghĩa của hoạt động này là gì?","options":["Tăng cường hợp tác quốc tế và năng lực ngăn chặn ma túy thẩm lậu từ nước ngoài"],"answer":0},
    {"n":52,"q":"Theo quy định của pháp luật hiện nay, việc kỳ thị người sử dụng trái phép chất ma túy, người cai nghiện ma túy, người sau cai nghiện ma túy sẽ bị xử phạt:","options":["Phạt tiền từ 1.000.000 đồng đến 2.000.000 đồng"],"answer":0},
    {"n":53,"q":"Người sử dụng trái phép chất ma túy bị xử lý hình sự trong trường hợp nào sau đây?","options":["Đang trong thời hạn quản lý sau cai nghiện ma túy"],"answer":0},
    {"n":54,"q":"Biện pháp giám sát điện tử người cai nghiện hoặc sau cai nghiện ma túy có mục đích nào?","options":["Tất cả đáp án đều đúng"],"answer":0},
    {"n":55,"q":"Theo định nghĩa trong tài liệu, kết quả xét nghiệm dương tính là một thành tố để xác định người sử dụng trái phép chất ma túy.","options":["Đúng"],"answer":0},
    {"n":56,"q":"Cần sa có thể gây thay đổi tri giác, còn cỏ Mỹ là chất tổng hợp tẩm trên vật liệu thực vật. Từ hai mô tả này, nhận định nào chính xác nhất?","options":["Hình thức thực vật không đủ để suy ra nguồn gốc hóa học của chất tác động."],"answer":0},
    {"n":57,"q":"Người nghiện suy giảm sức khỏe và khả năng lao động; gia đình phải chi phí chăm sóc; xã hội tăng chi phí y tế. Đây là ví dụ điển hình cho:","options":["Một tác hại ban đầu có thể lan truyền từ cá nhân sang gia đình và kinh tế – xã hội."],"answer":0},
    {"n":58,"q":"Theo Thông tư 40/2026/TT-BGDĐT, trường hợp sinh viên có hành vi 'Tái phạm việc sử dụng trái phép chất ma túy' hoặc 'Chứa chấp, môi giới mại dâm' sẽ bị xử lý kỷ luật ở mức nào?","options":["Buộc thôi học"],"answer":0},
    {"n":59,"q":"Biểu hiện nào giúp phân biệt tương đối rõ nhóm gây ảo giác với nhóm gây kích thích sau khi sử dụng ma tuý?","options":["Thay đổi nhận thức, xuất hiện ảo ảnh hoặc hoang tưởng."],"answer":0},
    {"n":60,"q":"Tội phạm ma tuý có đặc điểm liên quan đến các hoạt động rửa tiền, với tội phạm về tài chính và tội phạm khủng bố","options":["Đúng"],"answer":0},
    {"n":61,"q":"Việc nghiên cứu đặc điểm cấu trúc hoá học của các chất ma tuý đối với các nhà khoa học, dược sĩ có ý nghĩa đặc biệt nào?","options":["Tìm ra phương pháp giám định các chất ma tuý"],"answer":0},
    {"n":62,"q":"Nội dung nào sau đây nhận định không đúng về ma túy “Nước vui”?","options":["Chỉ có chứa Methamphetamine và Ketamine"],"answer":0},
    {"n":63,"q":"Các sản phầm của cần sa được nêu điển hình cho nhóm tác dụng nào?","options":["Gây ảo giác"],"answer":0},
    {"n":64,"q":"Một mẫu chất có biểu hiện giống chất kích thích nhưng nguồn gốc chưa rõ. Cách xử lý nhận thức nào phù hợp nhất?","options":["Cần tách biệt tiêu chí “tác dụng” với tiêu chí “nguồn gốc” trước khi kết luận."],"answer":0},
    {"n":65,"q":"Một người nói “thuốc lá điện tử chỉ là hơi nước nên không thể liên quan ma túy”. Nhận định nào phù hợp?","options":["Sai, dung dịch có thể bị lợi dụng để pha trộn ma túy và đã có ca ngộ độc"],"answer":0},
    {"n":66,"q":"Một sinh viên sau khi dùng chất lạ có biểu hiện kích thích, hoang tưởng và hành vi bạo lực. Chất nào sau đây có thể liên quan kiểu tác động này? A Nước tinh khiết","options":["Methamphetamine"],"answer":0},
    {"n":67,"q":"Nhận định nào sau đây là đúng?","options":["Phần lớn nguồn gây căn bệnh thế kỷ HIV/AIDS là do tiêm chích ma túy"],"answer":0},
    {"n":68,"q":"Một chất có khả năng làm thay đổi trạng thái ý thức và sinh lý, có thể gây lệ thuộc, nhưng chưa được quy định trong danh mục chất ma túy do Chính phủ ban hành. Hãy cho biết yếu tố nào khiến chưa thể khẳng định chất đó là “chất ma túy”?","options":["Chưa thuộc danh mục chất ma túy do Chính phủ ban hành."],"answer":0},
    {"n":69,"q":"Điểm khác biệt cơ bản giữa ma túy bán tổng hợp và ma túy tổng hợp toàn phần nằm ở:","options":["Nguồn nguyên liệu và quá trình tạo thành chất."],"answer":0},
    {"n":70,"q":"Giải pháp công nghệ trọng tâm nào được TP. Hồ Chí Minh chỉ đạo đẩy mạnh trong Nghị quyết 02-NQ/TU để quản lý địa bàn và đối tượng nghiện?","options":["Ứng dụng công nghệ số, cơ sở dữ liệu dân cư VNeID kết hợp các thiết bị giám sát điện tử"],"answer":0},
    {"n":71,"q":"Ai là người có thẩm quyền ra quyết định hủy bỏ biện pháp quản lý người sử dụng trái phép chất ma túy khi đối tượng hoàn thành thời hạn hoặc thuộc trường hợp chấm dứt?","options":["Trưởng Công an cấp xã - nơi ban hành quyết định quản lý"],"answer":0},
    {"n":72,"q":"Thẩm quyền ban hành quyết định áp dụng biện pháp quản lý người sử dụng trái phép chất ma túy tại địa bàn cơ sở thuộc về ai?","options":["Chủ tịch Ủy ban nhân dân cấp xã"],"answer":0},
    {"n":73,"q":"Theo quy định của Luật Phòng, chống ma túy 2025, cơ quan nào có thẩm quyền chính trong việc xem xét hoặc ra quyết định đưa đối tượng nghiện ma túy từ đủ 12 đến dưới 18 tuổi vào cơ sở cai nghiện bắt buộc?","options":["Tòa án nhân dân khu vực"],"answer":0},
    {"n":74,"q":"Phương pháp cảm quan có thể hỗ trợ nhận biết ban đầu nhưng kết quả chịu ảnh hưởng bởi kinh nghiệm của người quan sát.","options":["Đúng"],"answer":0},
    {"n":75,"q":"Hai chất gây biểu hiện tâm sinh lý tương tự nhau có thể vẫn thuộc hai nhóm nguồn gốc khác nhau; do đó không thể dùng riêng biểu hiện của người sử dụng để khẳng định nguồn gốc của chất.","options":["Đúng"],"answer":0},
    {"n":76,"q":"Một người sử dụng trái phép chất ma túy nhưng không thuộc trường hợp bị truy cứu trách nhiệm hình sự. Theo Nghị định 282/2025/NĐ-CP, mức xử lý hành chính thuộc nhóm nào?","options":["Cảnh cáo hoặc phạt 1-2 triệu đồng"],"answer":0},
    {"n":77,"q":"Đặc điểm nào phản ánh rõ sự kết hợp giữa thủ đoạn truyền thống và công nghệ của tội phạm ma túy tại TP.HCM?","options":["Nhóm kín, thanh toán qua ngân hàng và giao hàng công nghệ"],"answer":0},
    {"n":78,"q":"Theo quy định pháp luật hiện hành, quy định thời hạn cai nghiện được nêu là lần đầu và từ lần thứ hai trở lên lần lượt là:","options":["24 và 36 tháng"],"answer":0},
    {"n":79,"q":"Một chương trình cai nghiện có y tế tốt nhưng không có can thiệp tâm lý, kỹ năng sống, nghề nghiệp và kế hoạch sau cai nghiện. Nhận định nào sau đây là đúng:","options":["Chỉ xử lý một phần của quá trình phục hồi đa ngành"],"answer":0},
    {"n":80,"q":"Ba Công ước quốc tế về kiểm soát ma túy hiện nay nêu có cùng một trọng tâm duy nhất là cai nghiện ma túy.","options":["Sai"],"answer":0},
    {"n":81,"q":"Hai chất A và B đều gây hưng phấn. A được chiết trực tiếp từ thực vật; B được tổng hợp hoàn toàn từ hóa chất. Điều này chứng minh rằng:","options":["Tác dụng tâm sinh lý không nhất thiết quyết định nguồn gốc của chất."],"answer":0},
    {"n":82,"q":"Cơ quan nào sau đây KHÔNG có thẩm quyền xử phạt vi phạm hành chính theo quy định tại Chương III Nghị định số 282/2025/NĐ-CP?","options":["Ban Vệ sinh Hợp tác xã Nông nghiệp địa phương"],"answer":0},
    {"n":83,"q":"Morphine được cho tác dụng với hóa chất để tạo thành heroine. Nếu phân loại theo nguồn gốc, heroine thuộc nhóm:","options":["Bán tổng hợp."],"answer":0},
    {"n":84,"q":"Nhà nước ta đã xác định phòng, chống ma túy là:","options":["Nhiệm vụ trung tâm"],"answer":0}
  ];

  // ---------- matcher (pure, no DOM) ----------

  const norm = (s) =>
    String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/^\s*(question\s*)?\d+\s*[.)]\s*/, '')   // "Question 5." / "6. "
      .replace(/^\s*[a-d]\s*[.):]\s*/, '')              // "a. " / "B: "
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const bigrams = (s) => {
    const t = ' ' + s + ' ';
    const m = new Map();
    for (let i = 0; i < t.length - 1; i++) {
      const g = t.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };

  const dice = (a, b) => {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const A = bigrams(a), B = bigrams(b);
    let inter = 0, sa = 0, sb = 0;
    for (const v of A.values()) sa += v;
    for (const v of B.values()) sb += v;
    for (const [g, v] of A) inter += Math.min(v, B.get(g) || 0);
    return (2 * inter) / (sa + sb);
  };

  const jaccard = (a, b) => {
    const A = new Set(a.split(' ').filter(Boolean)), B = new Set(b.split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let i = 0;
    for (const x of A) if (B.has(x)) i++;
    return i / (A.size + B.size - i);
  };

  const sim = (a, b) => 0.6 * dice(a, b) + 0.4 * jaccard(a, b);

  // Maximum-weight one-to-one assignment, padded with unmatched options.
  // Hungarian algorithm: O(n^3), including banks with more than four options.
  const pairOptions = (pageOpts, bankOpts) => {
    const pn = pageOpts.map(norm), bn = bankOpts.map(norm);
    const n = Math.max(pn.length, bn.length);
    if (!n) return { score: null, pairs: [] };
    const weights = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i < pn.length && j < bn.length ? sim(pn[i], bn[j]) : 0));
    const u = Array(n + 1).fill(0), v = Array(n + 1).fill(0);
    const p = Array(n + 1).fill(0), way = Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = Array(n + 1).fill(Infinity), used = Array(n + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const cost = 1 - weights[i0 - 1][j - 1] - u[i0] - v[j];
          if (cost < minv[j]) { minv[j] = cost; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const pairs = [];
    for (let j = 1; j <= n; j++) if (p[j] <= pn.length && j <= bn.length)
      pairs.push({ page: p[j] - 1, bank: j - 1, score: weights[p[j] - 1][j - 1] });
    return { score: pairs.reduce((s, x) => s + x.score, 0) / n, pairs };
  };

  const optionsScore = (pageOpts, bankOpts) => {
    if (!pageOpts.length || !bankOpts.length) return null;
    return pairOptions(pageOpts, bankOpts).score;
  };

  const correctTexts = (item) => {
    if (item.answer == null) return [];
    const idx = Array.isArray(item.answer) ? item.answer : [item.answer];
    return idx.map((i) => item.options[i]).filter((x) => x != null);
  };

  const loadBank = (files) => {
    if (!Array.isArray(files)) throw new Error('Danh sách ngân hàng không hợp lệ.');
    return files.flatMap((file) => {
      if (!file || typeof file.name !== 'string' || !Array.isArray(file.data))
        throw new Error('File ngân hàng phải chứa một mảng JSON.');
      return file.data.map((x, i) => {
        const fail = () => { throw new Error(`${file.name}: câu thứ ${i + 1} không đúng cấu trúc.`); };
        if (!x || typeof x.q !== 'string' || !norm(x.q) || !Array.isArray(x.options) ||
            x.options.some(o => typeof o !== 'string' || !norm(o))) fail();
        const indexes = x.answer == null ? [] : Array.isArray(x.answer) ? x.answer : [x.answer];
        if (indexes.some(k => !Number.isInteger(k) || k < 0 || k >= x.options.length) ||
            new Set(indexes).size !== indexes.length) fail();
        return { ...x, source: String(x.source || file.name), _qn: norm(x.q) };
      });
    });
  };

  const warnings = (r, results, pageOpts, hasImage = false) => {
    const reasons = [];
    if (r.score < HIGHLIGHT_THRESHOLD || r.qs < 0.8) reasons.push('Độ giống thấp');
    if (results.some(other => other !== r && Math.abs(other.score - r.score) < 0.04))
      reasons.push('Có ứng viên gần bằng điểm');
    const answers = correctTexts(r.item);
    if (!answers.length) reasons.push('Ngân hàng thiếu đáp án');
    if (hasImage || /hình ảnh|hình vẽ|không lấy được/i.test(r.item.q))
      reasons.push('Chưa đối chiếu nội dung hình ảnh');
    if (!pageOpts.length) reasons.push('Chưa đối chiếu lựa chọn trên trang');
    else {
      const mapping = pairOptions(pageOpts, r.item.options);
      if (pageOpts.length !== r.item.options.length) reasons.push('Số lựa chọn khác nhau');
      const indices = r.item.answer == null ? [] : [].concat(r.item.answer);
      if (indices.some(k => {
        const pair = mapping.pairs.find(x => x.bank === k);
        if (!pair || pair.score < 0.85) return true;
        return pageOpts.some((o, j) => j !== pair.page && sim(norm(o), norm(r.item.options[k])) >= pair.score - 0.04);
      })) reasons.push('Chưa ánh xạ chắc chắn đáp án');
    }
    return reasons;
  };

  function match(question, pageOpts, bank, top = 3) {
    const qn = norm(question);
    return bank
      .map((item) => {
        const qs = sim(qn, item._qn);
        const os = optionsScore(pageOpts, item.options);
        const score = os == null ? qs : 0.7 * qs + 0.3 * os;
        return { item, score, qs, os };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, top);
  }

  if (typeof document === 'undefined') {
    module.exports = { norm, sim, match, loadBank, correctTexts, pairOptions, warnings };
    return;
  }

  // ---------- page side ----------
  window.quizMatch?.destroy?.();
  const UI_KEY = 'quizBank.cda.inline.ui.v1';
  let files = [{ name: 'CDA/result.json', data: DEFAULT_BANK }];
  let bank = loadBank(files), notice = '', open = true, destroyed = false;
  const states = new Map();
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      const savedFiles = JSON.parse(saved);
      const savedBank = loadBank(savedFiles);
      if (savedBank.length) { files = savedFiles; bank = savedBank; }
    }
  } catch (error) { notice = `! Không đọc được ngân hàng đã lưu, đang dùng CDA/result.json: ${error.message}`; }
  try {
    const savedUi = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    if (typeof savedUi.open === 'boolean') open = savedUi.open;
  } catch {}
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const style = document.createElement('style');
  style.textContent = '.qm-x{color:transparent!important;user-select:text}.qm-x::selection{color:#0a7a2f;background:transparent}.qm-panel{scrollbar-width:none;-ms-overflow-style:none}.qm-panel::-webkit-scrollbar{display:none}';
  document.head.appendChild(style);

  function openQuizPanel() {
    const drawer = document.getElementById('theme_boost-drawers-blocks');
    if (drawer && !drawer.classList.contains('show'))
      document.querySelector('[data-toggler="drawers"][data-action="toggle"][data-target="theme_boost-drawers-blocks"]')?.click();
  }
  const text = el => {
    if (!el) return '';
    const copy = el.cloneNode(true);
    copy.querySelectorAll('.qm-x,.answernumber,script,style').forEach(n => n.remove());
    return (copy.textContent || '').replace(/\s+/g, ' ').trim();
  };
  function readQuestion(que = document.querySelector('.que')) {
    if (!que) return null;
    const body = que.querySelector('.qtext');
    const optEls = [...que.querySelectorAll('.answer > div')]
      .filter(el => el.querySelector('input[type="radio"],input[type="checkbox"]'));
    return { q: text(body), opts: optEls.map(el => text(el.querySelector('.flex-fill,[data-region="answer-label"],label') || el)),
      optEls, hasImage: !!que.querySelector('.qtext img,.qtext svg,.qtext canvas,.answer img,.answer svg,.answer canvas') };
  }
  function rememberUi() {
    try { localStorage.setItem(UI_KEY, JSON.stringify({ open })); }
    catch { notice = '! Không lưu được trạng thái giao diện.'; }
  }
  function stateFor(que) {
    if (states.has(que)) return states.get(que);
    const body = que.querySelector('.qtext');
    if (!body) return null;
    const panel = document.createElement('div');
    panel.className = 'qm-panel';
    panel.style.cssText = 'box-sizing:border-box;overflow:auto;padding:0;background:transparent;color:inherit;border:0;font:inherit;line-height:1.4;max-height:4.2em';
    panel.setAttribute('aria-label', 'Bank matcher');
    body.before(panel);
    const flag = que.querySelector('.questionflag a.aabtn');
    const state = { body, panel, display: body.style.display, flag, title: flag?.getAttribute('title') };
    if (flag) flag.title = 'Bật/tắt Bank matcher';
    states.set(que, state);
    return state;
  }
  async function importFiles(selected) {
    if (!selected.length) return;
    // Parse and validate every file before replacing the current bank.
    try {
      const incoming = await Promise.all(selected.map(async f => {
        try { return { name: f.name, data: JSON.parse((await f.text()).replace(/^\uFEFF/, '')) }; }
        catch (error) { throw new Error(`${f.name}: ${error.message}`); }
      }));
      if (destroyed) return;
      const nextBank = loadBank(incoming);
      if (!nextBank.length) throw new Error('Các file được chọn không chứa câu hỏi.');
      files = incoming;
      bank = nextBank;
      notice = `Đã nạp ${bank.length} câu từ ${files.length} file.`;
      try { localStorage.setItem(STORE, JSON.stringify(files)); }
      catch { notice = '! Đã nạp cho trang hiện tại, nhưng không lưu được. Cần nạp lại khi chuyển trang.'; }
    } catch (error) { if (!destroyed) notice = `! Không thay ngân hàng: ${error.message}`; }
    if (!destroyed) run();
  }
  function render(que, state) {
    que.querySelectorAll('.qm-x').forEach(el => el.remove());
    state.panel.style.display = open ? 'block' : 'none';
    state.body.style.display = open ? 'none' : state.display;
    if (!open) return;
    const cur = readQuestion(que);
    let html = '';
    if (!bank.length) html = '<div>Chọn result.json hoặc các file ngân hàng .json bên dưới để bắt đầu.</div>';
    else {
      const results = match(cur.q, cur.opts, bank);
      results.forEach((r, i) => {
        const reasons = warnings(r, results, cur.opts, cur.hasImage);
        const ans = correctTexts(r.item);
        html += `<div style="font-weight:${i ? 400 : 700}">${reasons.length ? '<span title="' + esc(reasons.join('; ')) + '">! </span>' : ''}${(r.score * 100).toFixed(0)}% <small>${esc(r.item.source)} #${esc(r.item.n ?? '?')}</small> → ${ans.length ? ans.map(esc).join(' | ') : '(chưa có đáp án)'}${reasons.length ? '<small> — ' + esc(reasons.join('; ')) + '</small>' : ''}</div>`;
      });
      const best = results[0];
      if (best && !warnings(best, results, cur.opts, cur.hasImage).length) {
        const indices = [].concat(best.item.answer);
        const mapping = pairOptions(cur.opts, best.item.options);
        mapping.pairs.filter(pair => indices.includes(pair.bank)).forEach(pair => {
          const el = cur.optEls[pair.page];
          const marker = document.createElement('span');
          marker.className = 'qm-x'; marker.textContent = ' x';
          (el.querySelector('.flex-fill,[data-region="answer-label"],label') || el).appendChild(marker);
        });
      }
    }
    const missing = bank.filter(x => !correctTexts(x).length).length;
    html += `<div style="font-size:11px;font-weight:400">Bank matcher · ${bank.length} câu · ${files.length} file${missing ? ' · ! ' + missing + ' câu thiếu đáp án' : ''} · % = độ giống văn bản<br><label>Nạp/thay toàn bộ ngân hàng: <input class="qm-file" type="file" accept=".json,application/json" multiple style="font-size:11px;max-width:60%"></label><button type="button" class="qm-refresh" style="font:inherit">Cập nhật</button></div>`;
    if (notice) html += `<div role="status" style="font-size:11px">${esc(notice)}</div>`;
    state.panel.innerHTML = html;
    state.panel.querySelector('.qm-file').onchange = e => importFiles([...e.target.files]);
    state.panel.querySelector('.qm-refresh').onclick = run;
  }
  function run() {
    if (destroyed) return;
    for (const [que, state] of states) if (!que.isConnected) {
      state.panel.remove(); states.delete(que);
    }
    document.querySelectorAll('.que').forEach(que => {
      const state = stateFor(que);
      if (state) render(que, state);
    });
    if (open) openQuizPanel();
  }
  function toggle() { open = !open; rememberUi(); run(); }
  function onClick(e) {
    const flag = e.target instanceof Element && e.target.closest('.questionflag a,.questionflag .aabtn');
    const que = flag?.closest('.que');
    if (!que || !states.has(que)) return;
    e.preventDefault(); e.stopImmediatePropagation(); toggle();
  }
  window.addEventListener('click', onClick, true);
  const observer = new MutationObserver(records => {
    // Only structural question changes, never our own panel/marker mutations.
    const changed = records.some(r => [...r.addedNodes, ...r.removedNodes].some(n =>
      n.nodeType === 1 && (n.matches('.que,.qtext') || n.querySelector('.que,.qtext'))));
    if (changed) {
      for (const [que, state] of states) if (que.isConnected && state.body !== que.querySelector('.qtext')) {
        state.panel.remove(); states.delete(que);
      }
      run();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  function destroy() {
    destroyed = true; observer.disconnect();
    window.removeEventListener('click', onClick, true);
    for (const [que, state] of states) {
      state.body.style.display = state.display; state.panel.remove();
      que.querySelectorAll('.qm-x').forEach(el => el.remove());
      if (state.flag) {
        if (state.title == null) state.flag.removeAttribute('title');
        else state.flag.setAttribute('title', state.title);
      }
    }
    states.clear(); style.remove();
  }
  window.quizMatch = { run, openQuizPanel, readQuestion, match: (q, opts = []) => match(q, opts, bank), toggle, destroy };
  run();
})();
