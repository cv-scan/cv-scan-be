# CLAUDE.md — Hướng dẫn cho AI Developer

File này cung cấp context và quy ước cho Claude (hoặc AI assistant bất kỳ) khi làm việc trong codebase này.

## Mục đích dự án

CV Scan Backend là hệ thống Node.js + PostgreSQL để:
1. Upload và parse CV (PDF, DOCX)
2. Quản lý Job Descriptions — NLP tự động trích xuất skills khi tạo JD
3. **Chấm điểm CV so với JD bằng Rule-based NLP Engine** (không AI trả phí)
4. Xử lý batch nhiều CV qua BullMQ queue

> **Không có Anthropic API, không có OpenAI, không có bất kỳ AI API trả phí nào.**
> Scoring chạy hoàn toàn locally bằng `natural`, `compromise`, `fuse.js`.

## Commands thường dùng

```bash
npm run dev             # Dev server (tsx watch src/server.ts)
npm run typecheck       # TypeScript check — chạy trước khi commit
npm run lint            # Biome linter
npm run format          # Biome format auto-fix
npm test                # Jest tests
npm run db:migrate      # Prisma migrations (dev)
npm run db:studio       # Prisma Studio GUI
npm run db:seed         # Seed dữ liệu mẫu
```

## Kiến trúc và patterns bắt buộc

### 1. Modules (Vertical Slices)

```
src/modules/<feature>/
├── <feature>.controller.ts   # HTTP handler, không có business logic
├── <feature>.service.ts      # Business logic, DB operations
├── <feature>.routes.ts       # Fastify route registration
└── <feature>.schema.ts       # Zod schemas (định nghĩa TRƯỚC)
```

- **KHÔNG** cross-import giữa các modules. Nếu cần dùng chung, promote lên `src/services/`
- Controller chỉ parse request, gọi service, trả response — không có logic
- Service chứa toàn bộ business logic

### 2. Schema First

Định nghĩa Zod schema trong `<feature>.schema.ts` **TRƯỚC** khi viết controller/service.

```typescript
// evaluations.schema.ts
export const createEvaluationSchema = z.object({
  cvId: z.string().cuid2(),
  jobDescriptionId: z.string().cuid2(),
});
export type CreateEvaluationDto = z.infer<typeof createEvaluationSchema>;
```

### 3. Single Evaluation là Synchronous

Scoring NLP chạy < 50ms — **single evaluation trả kết quả ngay lập tức**:

```
// ĐÚNG — single evaluation
controller → evaluation.service.evaluate(cvId, jdId) → NlpScoringService.score() → return result

// SAI — không cần queue cho single evaluation
controller → queue.add(job) → worker → ... (quá phức tạp, không cần thiết)
```

BullMQ **chỉ dùng cho batch processing** (fan-out nhiều CV, concurrency control).

### 4. NLP Scoring Engine — KHÔNG được thay bằng AI API

Core scoring nằm trong `src/services/scoring/`. Khi cần thay đổi logic chấm điểm:

- **Thêm synonyms**: sửa `synonym.map.ts`
- **Thay đổi thuật toán skills**: sửa `skills.scorer.ts`
- **Điều chỉnh trọng số**: thay đổi default weights trong JD schema, không hardcode

```typescript
// src/services/scoring/nlp.service.ts — orchestrator
export class NlpScoringService {
  async score(cvText: string, jdText: string, weights: ScoringWeights): Promise<ScoringResult> {
    const [skills, experience, education, achievements, relevance] = await Promise.all([
      this.skillsScorer.score(cvText, jdText),
      this.experienceScorer.score(cvText, jdText),
      this.educationScorer.score(cvText, jdText),
      this.achievementsScorer.score(cvText),
      this.relevanceScorer.score(cvText, jdText),
    ]);
    return scoreCalculator.aggregate({ skills, experience, education, achievements, relevance }, weights);
  }
}
```

### 5. JD Skills Extraction (NLP, không phải AI)

Khi `POST /api/v1/job-descriptions`, dùng `compromise` + tech keyword dictionary để extract skills:

```typescript
// src/modules/job-descriptions/jd.extractor.ts
export function extractSkillsFromJD(jdText: string): string[] {
  const doc = nlp(jdText);
  const nouns = doc.nouns().out('array');
  // Filter qua tech keyword dictionary + synonym normalization
  return normalizeSkills(filterTechKeywords(nouns));
}
```

Kết quả lưu vào `job_descriptions.required_skills[]` và `preferred_skills[]`.

### 6. Error Handling

- Throw `AppError` từ `src/utils/errors.ts` trong service layer
- Global error handler ở `src/middleware/error-handler.ts` map sang HTTP response
- Không throw generic `new Error()` — dùng `new AppError(message, statusCode)`

### 7. Environment Variables

**KHÔNG** dùng `process.env` trực tiếp. Luôn import từ `src/config/env.ts`:

```typescript
// SAI
const secret = process.env.JWT_SECRET;

// ĐÚNG
import { env } from '../config/env';
const secret = env.JWT_SECRET;
```

`env.ts` dùng Zod để validate tất cả env vars khi startup — fail-fast nếu thiếu.

### 8. Prisma — không dùng raw SQL

```typescript
// SAI
prisma.$queryRaw`SELECT * FROM evaluations WHERE ...`

// ĐÚNG
prisma.evaluation.findMany({ where: { ... } })
```

Ngoại lệ: aggregation phức tạp mà Prisma không support — document rõ lý do bằng comment.

## NLP Libraries — Cách dùng đúng

### `natural` — TF-IDF và string distance

```typescript
import natural from 'natural';

// TF-IDF
const tfidf = new natural.TfIdf();
tfidf.addDocument(jdText);
const similarity = tfidf.tfidf('keyword', 0);

// Jaro-Winkler cho fuzzy skill match
const distance = natural.JaroWinklerDistance('javascript', 'js'); // 0.0 - 1.0

// Tokenizer
const tokenizer = new natural.WordTokenizer();
const tokens = tokenizer.tokenize(text);

// Stemmer (tiếng Anh)
const stem = natural.PorterStemmer.stem('programming'); // → 'program'
```

### `compromise` — Entity và noun extraction

```typescript
import nlp from 'compromise';

const doc = nlp(jdText);
const nouns = doc.nouns().out('array');         // Extract noun phrases
const verbs = doc.verbs().out('array');         // Extract verbs (for achievements)
const numbers = doc.numbers().out('array');     // Extract numbers (for experience years)
```

### `fuse.js` — Fuzzy search cho skill matching

```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(cvSkillsList, { threshold: 0.3 });
const matches = fuse.search('reactjs'); // Tìm tất cả skills tương tự
```

### Synonym map (`synonym.map.ts`)

Luôn normalize skills qua synonym map trước khi so sánh:

```typescript
export const SKILL_SYNONYMS: Record<string, string> = {
  'js': 'javascript',
  'reactjs': 'react',
  'react.js': 'react',
  'node': 'nodejs',
  'node.js': 'nodejs',
  'ts': 'typescript',
  'postgres': 'postgresql',
  'k8s': 'kubernetes',
  // ... thêm khi gặp edge cases
};

export function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  return SKILL_SYNONYMS[lower] ?? lower;
}
```

## Database Conventions

| Convention | Rule |
|---|---|
| IDs | `cuid2` (không dùng UUID hay auto-increment) |
| Timestamps | `createdAt`, `updatedAt` (Prisma auto-manage) |
| Column naming | `snake_case` trong DB, `camelCase` trong TypeScript |
| Soft delete | `isActive: false` cho JD. CV dùng **hard delete** (GDPR) |
| Unique constraint | `(cvId, jobDescriptionId)` trong `evaluations` |
| Enums | Định nghĩa trong Prisma schema, không dùng string literals |
| Arrays | `String[]` trong Prisma → PostgreSQL `TEXT[]` |

## File Upload Rules

- Max file size: **10MB** (`@fastify/multipart`)
- Allowed MIME: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Storage: cấu hình qua `STORAGE_PROVIDER=local|s3`
- **KHÔNG** lưu file vào repo hay commit upload paths
- Khi xóa CV: xóa file khỏi storage TRƯỚC, rồi mới xóa DB record

## Testing Strategy

### Unit tests (`tests/unit/`)
- Test từng scorer riêng lẻ: `skills.scorer.test.ts`, `experience.scorer.test.ts`, ...
- Test với sample CV text và sample JD text (fixtures)
- **Không cần mock** — NLP scorers là pure functions (text in → score out)
- File naming: `<module>.service.test.ts`, `<scorer>.scorer.test.ts`

### Integration tests (`tests/integration/`)
- Test API routes với real PostgreSQL test database
- Không mock Prisma — dùng DB transaction rollback sau mỗi test
- Test file upload với `tests/fixtures/sample.pdf` và `sample.docx`

### Test fixtures
```
tests/fixtures/
├── sample.pdf        # CV mẫu để test parse
├── sample.docx       # CV mẫu DOCX
├── cv-senior-dev.txt # CV text mẫu để test NLP scorer
└── jd-backend.txt    # JD text mẫu
```

## Queue Configuration (Batch Only)

```
Queue: cv-evaluation (dùng trong batch context)
  concurrency: 20      (NLP nhanh, tăng được parallelism cao)
  attempts: 3          (retry nếu DB lỗi, không phải rate limit)
  backoff: fixed 1000  (1s — lỗi thường do DB, không cần exponential)

Queue: batch-coordinator
  concurrency: 5

Job Priority:
  Không cần phân priority — single evaluation là synchronous, không qua queue
```

## Startup Order (server.ts)

1. Parse & validate env → fail nếu thiếu biến bắt buộc
2. Build Fastify instance
3. Register plugins: logger → cors → jwt → multipart → rate-limit → prisma → swagger → bull-board
4. Initialize BullMQ queues + workers
5. Register module routes (`/api/v1/*`)
6. Register global error handler
7. `fastify.listen()`

## Files quan trọng nhất

| File | Vai trò |
|---|---|
| `prisma/schema.prisma` | Source of truth cho toàn bộ DB schema |
| `src/config/env.ts` | Zod-validated env — import thay vì `process.env` |
| `src/services/scoring/nlp.service.ts` | Orchestrator của NLP scoring engine |
| `src/services/scoring/skills.scorer.ts` | Logic phức tạp nhất: Jaccard + fuzzy + synonym |
| `src/services/scoring/synonym.map.ts` | Tech skill synonym dictionary — cần cập nhật liên tục |
| `src/modules/job-descriptions/jd.extractor.ts` | NLP extraction skills từ JD text |
| `src/queues/evaluation.worker.ts` | Batch worker: gọi NlpScoringService per item |
| `src/utils/errors.ts` | Custom AppError classes |

## Các lỗi thường gặp cần tránh

1. **Gọi AI API bên ngoài** — hệ thống dùng NLP local, không có external AI calls
2. **Dùng `process.env` trực tiếp** — import từ `src/config/env.ts`
3. **Queue single evaluation** — single eval là synchronous, chỉ batch mới dùng queue
4. **Cross-import giữa modules** — promote lên `src/services/`
5. **So sánh skills không qua synonym map** — luôn `normalizeSkill()` trước khi compare
6. **Hard-delete JD** — dùng soft delete (`isActive: false`)
7. **Commit file .env** — `.env` phải trong `.gitignore`
8. **Hardcode scoring weights** — weights phải đến từ `job_descriptions.scoring_weights` trong DB

## Khi thêm scorer mới hoặc cải thiện thuật toán

Checklist:
- [ ] Tạo `src/services/scoring/<name>.scorer.ts` implement interface `IScorer`
- [ ] Viết unit test với ít nhất 5 test cases (edge cases: empty text, no match, full match)
- [ ] Register scorer trong `nlp.service.ts`
- [ ] Thêm category vào Prisma enum `ScoreCategory` nếu cần
- [ ] Cập nhật default weights trong JD schema (tổng phải = 1.0)
- [ ] Cập nhật `synonym.map.ts` nếu scorer cần thêm normalization

## Khi thêm feature mới

Checklist:
- [ ] Định nghĩa Zod schema trong `<feature>.schema.ts`
- [ ] Cập nhật `prisma/schema.prisma` nếu cần bảng/column mới
- [ ] Chạy `npm run db:migrate` để tạo migration
- [ ] Viết service với unit test
- [ ] Viết controller (thin layer)
- [ ] Register routes trong `<feature>.routes.ts`
- [ ] Import routes trong `src/server.ts`
- [ ] Chạy `npm run typecheck` để verify không có lỗi TypeScript
- [ ] Cập nhật `.env.example` nếu thêm env var mới

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cv-scan-be** (440 symbols, 889 relationships, 34 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/cv-scan-be/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cv-scan-be/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cv-scan-be/clusters` | All functional areas |
| `gitnexus://repo/cv-scan-be/processes` | All execution flows |
| `gitnexus://repo/cv-scan-be/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
