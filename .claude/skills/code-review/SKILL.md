# Skill: Code Review

## Mục đích

Review code trong dự án CV Scan Backend theo các tiêu chí nhất quán.

## Cách dùng

Khi được yêu cầu review code, thực hiện theo checklist sau:

## Checklist Review

### TypeScript & Type Safety
- [ ] Không có `any` type — dùng proper types hoặc generics
- [ ] Zod schema được định nghĩa cho mọi API input/output
- [ ] Prisma types được dùng thay vì tự định nghĩa interface DB

### Architecture
- [ ] Controller không chứa business logic — chỉ parse request + gọi service
- [ ] Service không import trực tiếp từ module khác — dùng `src/services/` shared
- [ ] Không có `process.env` trực tiếp — dùng `src/config/env.ts`
- [ ] Không có AI API calls — scoring qua `NlpScoringService`

### NLP Scoring
- [ ] Skill comparison đi qua `normalizeSkill()` từ `synonym.map.ts`
- [ ] Scorer mới implement interface `IScorer`
- [ ] Score output trong range 0–100

### Error Handling
- [ ] Throw `AppError` từ `src/utils/errors.ts`, không throw generic `Error`
- [ ] Worker errors được catch và mark job là failed (không crash worker)

### Security
- [ ] Input validation với Zod trên mọi endpoint
- [ ] File upload validate MIME type và size
- [ ] Không log sensitive data (password, JWT secret)

### Tests
- [ ] Unit test cho scorer/service mới
- [ ] Edge cases được cover: empty input, special characters, tiếng Việt
