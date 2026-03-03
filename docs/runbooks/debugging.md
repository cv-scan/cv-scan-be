# Runbook — Debugging

## Các vấn đề thường gặp

### 1. Evaluation trả về điểm 0 cho SKILLS

**Triệu chứng:** `skillsScore = 0` mặc dù CV có đủ skills.

**Nguyên nhân thường gặp:**
- Skill trong CV dùng alias chưa có trong `synonym.map.ts` (vd: `"JS"` thay vì `"javascript"`)
- JD không extract được skills (JD text quá ngắn hoặc không có tech keywords)

**Debug:**
```bash
# Xem extracted skills từ JD
GET /api/v1/job-descriptions/:id  # Kiểm tra required_skills[]

# Log NLP output tạm thời
LOG_LEVEL=debug npm run dev
# Xem logs: "SkillsScorer: cv_skills=[], jd_skills=[]"
```

**Fix:** Thêm synonym vào `src/services/scoring/synonym.map.ts`.

---

### 2. Batch evaluation bị stuck ở PROCESSING

**Triệu chứng:** Batch ở trạng thái PROCESSING nhưng không tiến triển.

**Check:**
```bash
# Kiểm tra Bull Board
open http://localhost:3000/admin/queues

# Kiểm tra Redis
redis-cli ping
redis-cli llen bull:cv-evaluation:wait

# Xem worker logs
LOG_LEVEL=debug npm run dev
```

**Nguyên nhân thường gặp:**
- Redis bị down → worker không nhận job
- Worker crash do lỗi unhandled exception → kiểm tra logs
- Database connection pool exhausted → kiểm tra `DATABASE_POOL_MAX`

---

### 3. PDF parse lỗi / extracted text rỗng

**Triệu chứng:** `parseStatus = FAILED` hoặc `extractedText = ""`

**Debug:**
```bash
# Test parse thủ công
node -e "
const pdf = require('pdf-parse');
const fs = require('fs');
pdf(fs.readFileSync('./tests/fixtures/sample.pdf')).then(d => console.log(d.text.slice(0, 500)));
"
```

**Fix phổ biến:**
- PDF được scan (ảnh, không có text layer) → cần OCR (ngoài scope hiện tại)
- PDF có password → yêu cầu user upload file không có password

---

### 4. Database migration fail

```bash
# Xem lịch sử migration
npx prisma migrate status

# Reset migration (dev only — XÓA DATA)
npx prisma migrate reset

# Production: resolve manually
npx prisma migrate resolve --applied <migration-name>
```

---

### 5. JWT token hết hạn liên tục

**Kiểm tra:**
- `JWT_ACCESS_EXPIRES_IN` trong `.env` (mặc định `15m`)
- Client có implement refresh token flow không
- Server time sync (token validation dùng thời gian server)

## Công cụ debug

```bash
# Prisma Studio (xem/sửa DB trực tiếp)
npm run db:studio

# Bull Board (xem queue jobs)
open http://localhost:3000/admin/queues

# Swagger UI (test API)
open http://localhost:3000/documentation

# Xem logs với pretty print
LOG_LEVEL=debug npm run dev | npx pino-pretty
```
