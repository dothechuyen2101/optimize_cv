# OptimizeCV

Platform giúp ứng viên nhận được lời mời phỏng vấn: AI đọc CV và JD, chấm độ khớp kiểu ATS, gợi ý sửa từng bullet (không bịa kinh nghiệm), phân tích role, review portfolio và luyện phỏng vấn. Hỗ trợ tiếng Việt và tiếng Anh, theo chuẩn thị trường Việt Nam hoặc quốc tế.

## Trạng thái

| Phần | Trạng thái |
|---|---|
| Khung dự án: Next.js 16, TypeScript, Tailwind 4, Vitest, CI | Xong |
| Song ngữ vi/en (`/vi`, `/en`, tự chọn theo trình duyệt) | Xong |
| Tối ưu CV theo JD: upload PDF/DOCX/TXT, điểm ATS, gợi ý từng bullet, viết lại summary | Xong |
| Đăng nhập email + mật khẩu (Supabase Auth): đăng ký, đăng nhập, quên/đặt lại mật khẩu, đăng xuất | Xong |
| Lưu lịch sử, trang xem lại, lưu lựa chọn chấp nhận/bỏ qua/sửa gợi ý (cả bullet lẫn summary) | Xong |
| Xuất CV đã chỉnh sửa: xem trước, tải PDF và DOCX theo mẫu ATS một cột | Xong |
| Sửa tay mọi dòng của CV (tên, liên hệ, ngày tháng, bullet…) trên trang xem trước | Xong |
| Đánh giá lại CV đã sửa: chấm lại điểm ATS miễn phí, hoặc phân tích lại bằng AI (trừ 1 lượt) kèm so sánh điểm trước/sau | Xong |
| JD đã lưu: chọn lại JD cũ khi phân tích, upload CV sửa bằng Word với cùng JD và so sánh với lần trước | Xong |
| Đọc CV chính xác: dùng lớp text của PDF, đối chiếu từng trường, dùng model mạnh cho CV dạng ảnh | Xong |
| Quota gói free: 3 lượt/tháng (UTC) | Xong |
| Cache: JD dùng chung theo hash, CV theo hash file, cả lần phân tích khi trùng đầu vào | Xong |
| Phân tích role: giải mã JD, yêu cầu bắt buộc/ưu tiên, vòng phỏng vấn, câu hỏi luyện tập (miễn phí, 1 lần mỗi phân tích CV) | Xong |
| Luyện phỏng vấn bằng chat: người phỏng vấn AI hỏi và hỏi vặn, nhận xét từng câu, chấm điểm cuối buổi (free 2 buổi/tháng) | Xong |
| Review portfolio: GitHub, website/Behance, file PDF, đánh giá theo JD (free 1 lần/tháng) | Xong |
| Trang Tài khoản: lượt dùng tháng này, tải toàn bộ dữ liệu (JSON), xoá tài khoản và dữ liệu (Nghị định 13, GDPR) | Xong |
| Giới hạn tần suất gọi AI: 40 lần / 10 phút mỗi user | Xong |
| Phỏng vấn voice realtime, thanh toán | Chưa làm (Phase 4–5, cần tài khoản LiveKit/STT/TTS và Stripe/PayOS) |

## Chạy local

Yêu cầu: Node 22+, pnpm.

```bash
pnpm install
cp .env.example .env         # chọn AI_PROVIDER và điền key tương ứng
pnpm dev                     # http://localhost:3000
```

Thiếu key thì giao diện vẫn chạy, nhưng mọi lần phân tích sẽ báo lỗi "AI chưa được cấu hình".

### Nhà cung cấp AI

| `AI_PROVIDER` | Key | Endpoint | Model nhanh / mạnh |
|---|---|---|---|
| `wellflow` | `WELLFLOW_API_KEY` (`wf_…`) | `https://api.wellflow.dev` (định dạng Anthropic) | `claude-haiku-5.5` / `claude-opus-5-5` |
| `anthropic` (mặc định) | `ANTHROPIC_API_KEY` | `https://api.anthropic.com` | `claude-haiku-5-5` / `claude-opus-5-5` |

Model ID, bảng giá và tính năng của từng nhà cung cấp nằm ở [src/lib/ai/providers.ts](src/lib/ai/providers.ts). Các step chỉ chọn hạng `fast` hoặc `strong`, nên đổi nhà cung cấp không cần sửa code ở nơi khác. Khi dùng Wellflow, client chỉ dùng `WELLFLOW_API_KEY` và không bao giờ gửi key Anthropic tới gateway.

Wellflow bỏ qua tham số structured output (`output_config.format`), nên với nhà cung cấp này app nhận JSON qua một tool `submit_result`. Với cả hai nhà cung cấp, kết quả đều được kiểm tra lại bằng Zod.

### Đăng nhập (Supabase Auth)

Cần cấu hình trong Supabase Dashboard:

1. **Authentication > URL Configuration**: đặt Site URL, và thêm `http://localhost:3000/api/auth/callback` (cùng URL tương ứng của domain production) vào **Redirect URLs**. Link trong email xác nhận và email đặt lại mật khẩu đều trỏ về route này.
2. **Authentication > Emails > SMTP**: dịch vụ email mặc định của Supabase chỉ gửi tới thành viên team và bị giới hạn số email mỗi giờ. Cần cấu hình SMTP riêng (Resend, Postmark…) trước khi mở cho người dùng thật.
3. (Nên làm) **Authentication > Providers > Email**: đặt độ dài mật khẩu tối thiểu 8 cho khớp với kiểm tra trong app.

Proxy làm mới session và chuyển hướng sớm khỏi các trang cần đăng nhập. Mỗi trang, route API và Server Action vẫn tự xác thực lại bằng `getSessionUser()` ([src/lib/auth/session.ts](src/lib/auth/session.ts)); mọi truy vấn database đều lọc theo user ID đó.

### Database (Supabase)

Host kết nối trực tiếp `db.<project>.supabase.co` chỉ có IPv6. Mạng không có IPv6 và Vercel đều không kết nối được, vì vậy `DATABASE_URL` phải là chuỗi **Session pooler** (`postgres.<project>@aws-0-<region>.pooler.supabase.com:5432`), lấy trong Supabase > Connect. Mọi bảng đều bật RLS mà không có policy, nên Data API của Supabase bị chặn; app truy cập phía server bằng Drizzle.

| Lệnh | Việc |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Chạy dev, build, chạy bản production |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Kiểm tra code (CI chạy cả bốn, kể cả build) |
| `pnpm db:generate` | Sinh migration SQL từ `src/db/schema.ts` |
| `pnpm db:migrate` | Áp migration vào `DATABASE_URL` |

## Cách hoạt động

`POST /api/analyze` yêu cầu đăng nhập, nhận file CV và text JD, rồi stream tiến độ về client dạng NDJSON. Trước khi gọi AI:
- Nếu đã có kết quả cho đúng file, đúng JD, cùng thị trường, cùng ngôn ngữ và cùng phiên bản prompt, route trả ngay kết quả đó, không tính quota.
- Nếu chưa, route giữ chỗ quota bằng một dòng `analyses` ở trạng thái `running`, trong transaction có khoá theo người dùng.

Xong thì client chuyển sang `/[lang]/analyses/[id]`. Pipeline gồm:

1. **Đọc CV và JD song song** bằng model hạng `fast`, trả về JSON có cấu trúc (structured outputs + Zod). Nếu kết quả sai schema, step được gọi lại một lần. Cách đọc CV:
   - PDF được gửi thẳng cho model để giữ bố cục, kèm **lớp text** của nó (trích bằng `unpdf`). Model chép ký tự từ lớp text thay vì đọc ảnh trang, vì đọc ảnh hay nhầm số kiểu `2018 → 2008`.
   - Sau đó [ground.ts](src/lib/parsing/ground.ts) đối chiếu từng trường với text gốc. Trường nào không có nguyên văn trong text gốc thì được thay bằng đoạn gần giống nhất, nhưng chỉ khi đoạn đó gần như trùng khớp và là lựa chọn duy nhất.
   - PDF không có lớp text (bản scan, xuất từ ảnh) được đọc bằng model hạng `strong` (step `parse_cv_scan`).
   - DOCX được chuyển sang text bằng `mammoth`, rồi cũng được đối chiếu như trên.
2. **Chấm ATS bằng code** (`src/lib/ats`): độ phủ kỹ năng bắt buộc, kỹ năng ưu tiên, từ khóa, số năm kinh nghiệm và lỗi định dạng theo thị trường. Bước này không gọi AI, nên kết quả ổn định và không tốn tiền. Phần so khớp bỏ dấu tiếng Việt và gộp các tên gọi khác nhau (ReactJS = React, Postgres = PostgreSQL…).
3. **Phân tích và viết gợi ý** bằng model hạng `strong` (Claude Opus 5.5, effort `medium`): nhận định, điểm mạnh, khoảng trống, gợi ý từng bullet, summary mới, câu hỏi cần làm rõ. Prompt cấm bịa số liệu hay kỹ năng. Khi thiếu dữ liệu, AI để placeholder `[X%]` và hỏi lại người dùng.

Chi phí tối ưu theo các cách sau:
- Mỗi step chọn hạng model riêng, cấu hình tại [src/lib/ai/router.ts](src/lib/ai/router.ts).
- System prompt được cache (prompt caching).
- Usage và chi phí ước tính (theo bảng giá của nhà cung cấp đang dùng) được ghi vào log `[ai_usage]`.
- Ở chế độ dev, chi phí hiển thị ngay dưới kết quả.

Mọi lời gọi AI đi qua một client duy nhất là [src/lib/ai/client.ts](src/lib/ai/client.ts).

### Xuất CV đã chỉnh sửa

Người dùng chấp nhận, bỏ qua hoặc sửa lại từng gợi ý; app nhắc điền các chỗ trống kiểu `[X%]` trước khi xuất. Trang `/[lang]/analyses/[id]/cv` xem trước CV, và người dùng bấm vào bất kỳ dòng nào để sửa tay. Cơ chế lưu chỗ sửa:
- Mỗi chỗ sửa nằm trong bảng `cv_edits`, gắn với khoá cố định của dòng đó (ví dụ `contact.phone`, `experience.0.b.2`) và lưu kèm text gốc lúc sửa.
- Chỗ sửa chỉ được áp dụng khi dòng đó vẫn còn đúng text gốc. Vì vậy nếu người dùng đổi lựa chọn gợi ý sau đó, hành động mới nhất được ưu tiên.

`GET /api/analyses/[id]/cv?format=pdf|docx` tải file đã áp dụng cả gợi ý lẫn chỗ sửa tay.

Trên cùng trang có khung "Đánh giá lại CV đã sửa". `resumeFromDocument` ([document.ts](src/lib/export/document.ts)) ghi từng dòng của CV đã sửa trở lại đúng trường dữ liệu, không qua AI, rồi khung này có hai lựa chọn:
- **Chấm lại điểm ATS:** server action `rescoreCv` chấm bằng code với cùng JD và cùng thị trường. Không tốn phí, không trừ lượt.
- **Phân tích lại bằng AI:** gọi `POST /api/analyze` với `from=<id>`.
  - Không đọc lại CV hay JD: CV đã sửa được lưu thành phiên bản tiếp theo của CV gốc, JD dùng lại bản đã đọc, nên chỉ chạy bước phân tích.
  - Bản phân tích mới gắn `parent_id` với bản cũ. Trang kết quả hiện điểm so với lần trước; Lịch sử gắn nhãn "Đánh giá lại" và hiện mức thay đổi điểm (ví dụ `73 → 96 +23`).
  - Trừ 1 lượt như phân tích mới, trừ khi CV không đổi: khi đó cache trả lại kết quả cũ.

**JD đã lưu.** Mỗi JD đã phân tích đều được lưu sẵn. Bảng `job_descriptions` dùng chung giữa các user, nên user chỉ đọc được JD thông qua bản phân tích của chính mình.
- Trang `/[lang]/analyze` có ô chọn "JD đã lưu"; chọn một JD thì điền sẵn nội dung và thị trường.
- `/[lang]/analyze?from=<id>` mở form với JD của bản phân tích đó. Trang CV và trang kết quả có nút "Upload CV đã sửa với JD này" dẫn tới đây, dành cho CV đã tải về và sửa bằng Word.
- Form gửi kèm `parent=<id>`. Server gắn `parent_id` chỉ khi đó là bản phân tích của user và JD giữ nguyên (so hash). Khi đó trang kết quả hiện điểm so với lần trước.

Phần xuất không gọi AI:

1. [revise.ts](src/lib/export/revise.ts) thay các dòng đã chấp nhận vào CV đã parse. Dòng gốc được tìm theo vị trí AI trả về; nếu không khớp thì tìm theo nội dung. Gợi ý không tìm thấy dòng gốc sẽ được báo lại, không bị chèn bừa.
2. [document.ts](src/lib/export/document.ts) dựng bố cục chung, dùng tiêu đề mục theo ngôn ngữ của CV.
3. Bố cục này được render ra ba dạng: HTML để xem trước, PDF ([pdf.tsx](src/lib/export/pdf.tsx), `@react-pdf/renderer`) và DOCX ([docx.ts](src/lib/export/docx.ts), `docx`).

PDF nhúng font Be Vietnam Pro (giấy phép OFL, nằm trong `src/lib/export/fonts/`), vì font mặc định của PDF không có dấu tiếng Việt. `next.config.ts` khai báo `outputFileTracingIncludes` để font được đóng gói vào route khi deploy. DOCX dùng Arial để người dùng mở bằng Word là sửa tiếp được.

### Phân tích role và luyện phỏng vấn

Từ trang kết quả phân tích có hai hướng tiếp theo, cả hai dùng CV và JD của lần phân tích đó.

**Phân tích role:** `POST /api/analyses/[id]/role`, step `role_analysis` (hạng `strong`).
- Kết quả gồm: role thực chất làm gì, yêu cầu bắt buộc/ưu tiên kèm căn cứ trong JD, cấp độ, những điểm JD chưa nói rõ, các vòng phỏng vấn thường gặp, 10–14 câu hỏi luyện tập kèm gợi ý theo CV, và câu hỏi nên hỏi lại nhà tuyển dụng.
- Prompt cấm bịa thông tin về công ty; các vòng phỏng vấn được ghi rõ là "thường gặp".
- Mỗi bản phân tích CV có một báo cáo role, lưu ở bảng `role_reports`. Một dòng trạng thái `running` giữ chỗ để hai request song song không tạo hai lần.

**Luyện phỏng vấn:** bảng `interview_sessions` và `interview_turns`.
- `POST /api/interviews` tạo buổi phỏng vấn (giữ chỗ quota trong transaction có khoá theo user) và lấy câu hỏi đầu tiên. Nếu không tạo được câu hỏi thì xoá buổi đó để không trừ lượt.
- `POST /api/interviews/[id]/answer` lưu câu trả lời, kèm nhận xét nếu bật, và lượt tiếp theo của người phỏng vấn. Lượt hỏi dùng step `interview_turn` (hạng `fast`, ưu tiên độ trễ thấp); JD và CV nằm trong system prompt để được prompt cache giữa các lượt.
- `POST /api/interviews/[id]/finish` chấm cả buổi bằng step `interview_report` (hạng `strong`): rubric cấu trúc / trọng tâm / dẫn chứng / diễn đạt, điểm từng câu, ưu tiên cải thiện, và câu trả lời yếu nhất được viết lại chỉ từ dữ kiện có thật.
- Khi người phỏng vấn tự kết thúc (`closing`), client tự gọi chấm điểm.
- Mỗi buổi tối đa 40 lượt; câu trả lời tối đa 4000 ký tự.
- Danh sách các buổi ở `/[lang]/interviews`.

### Review portfolio

`POST /api/portfolio-reviews` nhận dữ liệu multipart gồm GitHub (username hoặc link), tối đa 3 link và file PDF tùy chọn (tối đa 4 MB, 100 trang). Route đọc các nguồn rồi đánh giá theo JD và CV của bản phân tích bằng step `portfolio_review` (hạng `strong`). Kết quả lưu ở bảng `portfolio_reviews`.

Đọc nguồn ([src/lib/portfolio/fetch.ts](src/lib/portfolio/fetch.ts)):
- **GitHub:** gọi GitHub API để lấy profile và tối đa 6 repo nổi bật kèm 3000 ký tự đầu của README. Đặt biến tùy chọn `GITHUB_TOKEN` để vượt giới hạn 60 request/giờ của truy cập ẩn danh.
- **Website:** server tự tải trang và trích tiêu đề, mô tả, text và link. Trang dựng hoàn toàn bằng JavaScript (như Behance) chỉ đọc được rất ít; AI sẽ nói rõ điều đó và gợi ý xuất PDF.
- **Chống SSRF:**
  - chỉ cho phép http/https ở cổng mặc định, không có user:pass trong URL;
  - DNS được tra ngay trong lúc kết nối, và mọi IP mà hostname trỏ tới phải là IP công khai (chặn loopback, mạng nội bộ, link-local và metadata của cloud, IPv6 ULA…);
  - redirect được xử lý thủ công và kiểm tra lại ở từng bước;
  - giới hạn 10 giây và 1.5 MB mỗi trang.

Quota: free 1 lần/tháng. Lần thất bại không tính, kể cả khi không đọc được nguồn nào (khi đó không gọi AI).

### Tài khoản, dữ liệu cá nhân và giới hạn

- `/[lang]/account` hiển thị gói và lượt dùng tháng này của từng tính năng.
- `GET /api/account/export` tải về mọi dữ liệu đang lưu về user dưới dạng JSON: CV đã đọc, JD, kết quả phân tích, lựa chọn gợi ý, chỗ sửa tay, phân tích role, các buổi phỏng vấn và review portfolio.
- Xoá tài khoản: người dùng phải gõ đúng email của mình, và server kiểm tra lại.
  - Server xoá user trong `auth.users`. Mọi bảng của user nối với `profiles` bằng `ON DELETE CASCADE` nên bị xoá theo.
  - `ai_usage` chỉ giữ dòng chi phí đã ẩn danh (`user_id` thành null); các dòng JD dùng chung vẫn được giữ.
  - File CV gốc vốn không được lưu.
- Rate limit ([src/lib/billing/rate-limit.ts](src/lib/billing/rate-limit.ts)): mỗi route gọi AI từ chối khi user đã có 40 lần gọi trong 10 phút, đếm từ `ai_usage`, trả mã `too_many_requests`.
  - Mốc thời gian tính bằng `now()` của database, cùng đồng hồ với `created_at`. Đồng hồ máy chủ app có thể lệch: một máy dev từng lệch 82 giây.
  - Khi phân tích CV, việc trả lại kết quả đã cache không bị chặn.
- Mỗi lần tạo Supabase client phía server đều gọi `connection()` trước, vì Supabase Auth gọi `Date.now()` khi kiểm tra token. Nếu không, Next ghi lỗi "unstable value Date.now()" khi prerender mọi trang cần đăng nhập.

## Cấu trúc thư mục

```
src/
  app/[lang]/             trang chủ, /analyze (root layout nằm trong [lang])
  app/api/analyze/        route handler phân tích (NDJSON stream)
  components/analyze/     form, kết quả, thẻ gợi ý
  i18n/                   cấu hình locale, từ điển vi/en
  proxy.ts                chuyển hướng sang locale (Next 16 gọi middleware là proxy)
  lib/ai/                 client, router model, run-step, prompts, schemas, steps
  lib/ats/                chuẩn hoá văn bản và chấm điểm ATS
  lib/analysis/           pipeline và kiểu dữ liệu báo cáo
  lib/parsing/            đọc file CV
  lib/export/             ghép gợi ý vào CV, xuất PDF/DOCX, font nhúng
  lib/role/, lib/interview/   phân tích role, phiên luyện phỏng vấn và quota
  lib/portfolio/          đọc GitHub/website an toàn (chống SSRF), review portfolio và quota
  db/                     schema Drizzle và migrations
```

Lưu ý: dự án dùng Next.js 16 với Cache Components. API khác nhiều so với các bản cũ; xem [AGENTS.md](AGENTS.md) và tài liệu trong `node_modules/next/dist/docs/`.
