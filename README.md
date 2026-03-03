# CV Scan Backend

Hệ thống backend để scan, đánh giá và chấm điểm CV (hồ sơ ứng viên) dựa trên Job Description (JD) được chọn, sử dụng **Rule-based NLP Engine** — hoàn toàn miễn phí, không phụ thuộc external API.

## Tổng quan

CV Scan Backend cung cấp API để:
- Upload và phân tích CV (PDF, DOCX)
- Quản lý Job Descriptions (CRUD) với tự động trích xuất skills bằng NLP
- Chấm điểm CV so với JD theo 5 hạng mục bằng thuật toán NLP tùy chỉnh
- Xử lý batch nhiều CV cùng lúc
- Theo dõi lịch sử và audit log các lần đánh giá

## Tech Stack

| Thành phần | Công nghệ | Lý do chọn |
|---|---|---|
| Runtime | Node.js >= 22 LTS | Hiệu năng cao, hệ sinh thái phong phú |
| Framework | Fastify v5 | ~3x nhanh hơn Express, built-in schema validation |
| Database | PostgreSQL 17 | ACID, JSON support, production-grade |
| ORM | Prisma v6 | Type-safe queries, migration tooling |
| NLP Core | `natural` | TF-IDF, tokenizer, stemmer, Jaro-Winkler distance |
| NLP Parsing | `compromise` | Entity recognition, noun/verb extraction |
| Fuzzy Match | `fuse.js` | Skill synonym matching (JS ↔ JavaScript) |
| Queue | BullMQ + Redis | Batch processing, concurrency control |
| Validation | Zod | Runtime validation + TypeScript types |
| Auth | JWT + Refresh Token | Stateless access token, revocable refresh |
| File Parsing | pdf-parse + mammoth | PDF và DOCX extraction |
| Linting | Biome | ESLint + Prettier trong một tool |
| Language | TypeScript 5.7 | Type safety toàn bộ codebase |

> **Không dùng AI trả phí.** Toàn bộ scoring chạy locally bằng NLP thuần túy — nhanh (<50ms/CV), offline, deterministic, không tốn API credits.

## Scoring Engine — Cách hoạt động

Mỗi CV được chấm điểm theo **5 hạng mục** độc lập, sau đó nhân trọng số để ra điểm tổng:

### Hạng mục và thuật toán

| Hạng mục | Trọng số mặc định | Thuật toán |
|---|---|---|
| `SKILLS` | 35% | Jaccard similarity giữa skills CV và skills JD, fuzzy match qua synonym map |
| `EXPERIENCE` | 30% | Regex trích xuất số năm kinh nghiệm, so sánh với yêu cầu JD |
| `EDUCATION` | 15% | So sánh degree level (PhD > Master > Bachelor > Associate) |
| `ACHIEVEMENTS` | 10% | Đếm thành tích có số liệu cụ thể (%, revenue, users, ...) |
| `RELEVANCE` | 10% | TF-IDF cosine similarity giữa toàn bộ văn bản CV và JD |

### Chi tiết từng hạng mục

**SKILLS (35%)**
- Trích xuất danh sách skills từ JD bằng `compromise` (noun phrases) + tech keyword dictionary
- Xây dựng synonym map: `js → javascript`, `reactjs → react`, `node → nodejs`, ...
- So khớp với CV bằng Jaro-Winkler distance (fuzzy match)
- `score = (matched_skills / required_skills) * 100`

**EXPERIENCE (30%)**
- Regex nhận dạng: `"5 years"`, `"5+ years"`, `"2018 - 2023"`, `"since 2019"`
- Ghi nhận level keywords: `senior` (~7yr), `mid-level` (~4yr), `junior` (~1yr)
- So sánh tổng số năm kinh nghiệm với yêu cầu JD
- Điểm giảm dần nếu thiếu năm, điểm tối đa nếu đạt hoặc vượt

**EDUCATION (15%)**
- Regex nhận dạng bằng cấp: PhD, Master/MSc/MBA, Bachelor/BSc, Associate/Diploma
- Map degree level sang thang điểm: PhD=100, Master=85, Bachelor=70, Associate=50
- So sánh với yêu cầu trong JD nếu có, không yêu cầu thì cho điểm theo level

**ACHIEVEMENTS (10%)**
- Đếm pattern có số liệu cụ thể: `\d+%`, `$\d+k`, `\d+ users`, ...
- Nhận dạng impact verbs: `increased`, `reduced`, `led`, `delivered`, `optimized`
- Score theo số lượng achievements có thể đo lường được

**RELEVANCE (10%)**
- TF-IDF vectorize toàn bộ JD và CV text
- Tính cosine similarity giữa hai vector
- Đo mức độ liên quan tổng thể về ngành nghề và lĩnh vực

### Công thức tính điểm tổng

```
overallScore = (skills * 0.35) + (experience * 0.30) + (education * 0.15)
             + (achievements * 0.10) + (relevance * 0.10)
```

Trọng số có thể tùy chỉnh per-JD trong `job_descriptions.scoring_weights`.

## Cấu trúc thư mục

```
cv-scan-be/
├── src/
│   ├── config/
│   │   ├── app.config.ts          # Fastify instance factory
│   │   ├── database.config.ts     # Prisma client singleton
│   │   ├── redis.config.ts        # IORedis client
│   │   ├── s3.config.ts           # AWS S3 client
│   │   └── env.ts                 # Zod-validated env variables (fail-fast)
│   │
│   ├── modules/                   # Feature modules (vertical slices)
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.schema.ts
│   │   ├── users/
│   │   ├── job-descriptions/
│   │   │   └── jd.extractor.ts    # NLP extraction của skills từ JD text
│   │   ├── cvs/
│   │   │   └── cv.parser.ts       # PDF/DOCX text extraction
│   │   ├── evaluations/
│   │   └── batches/
│   │
│   ├── queues/                    # BullMQ (dùng cho batch, không phải rate limit AI)
│   │   ├── batch.queue.ts
│   │   ├── batch.worker.ts        # Fan-out batch items
│   │   ├── evaluation.queue.ts    # Queue cho batch items
│   │   ├── evaluation.worker.ts   # Gọi NlpScoringService
│   │   └── queue.registry.ts
│   │
│   ├── services/
│   │   ├── scoring/               # NLP Scoring Engine (core)
│   │   │   ├── nlp.service.ts         # Orchestrator chính
│   │   │   ├── skills.scorer.ts       # Jaccard + fuzzy skill matching
│   │   │   ├── experience.scorer.ts   # Regex year extraction
│   │   │   ├── education.scorer.ts    # Degree level comparison
│   │   │   ├── achievements.scorer.ts # Quantified impact detection
│   │   │   ├── relevance.scorer.ts    # TF-IDF cosine similarity
│   │   │   └── synonym.map.ts         # Tech skill synonyms dictionary
│   │   ├── storage/
│   │   │   ├── storage.interface.ts
│   │   │   ├── local.storage.ts
│   │   │   └── s3.storage.ts
│   │   └── parser/
│   │       ├── pdf.parser.ts
│   │       └── docx.parser.ts
│   │
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── authorize.ts
│   │   ├── rate-limit.ts
│   │   └── error-handler.ts
│   │
│   ├── plugins/
│   │   ├── prisma.plugin.ts
│   │   ├── jwt.plugin.ts
│   │   ├── multipart.plugin.ts
│   │   ├── swagger.plugin.ts
│   │   ├── rate-limit.plugin.ts
│   │   └── bull-board.plugin.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   ├── pagination.ts
│   │   └── score.calculator.ts    # Weighted score aggregation
│   │
│   └── server.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│       ├── sample.pdf
│       └── sample.docx
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── .env.example
├── package.json
├── tsconfig.json
├── biome.json
├── jest.config.ts
├── README.md
└── CLAUDE.md
```

## Database Schema

Các bảng chính:

```
users               — Tài khoản người dùng (ADMIN, RECRUITER, VIEWER)
refresh_tokens      — Refresh token management
job_descriptions    — JD với scoring weights và extracted skills (NLP)
cvs                 — CV metadata + extracted text
evaluations         — Kết quả chấm điểm (synchronous với single CV)
scores              — Điểm từng hạng mục + rationale text
batches             — Batch job container
batch_items         — CV items trong một batch
audit_logs          — Audit trail
```

## API Endpoints

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### Job Descriptions
```
GET    /api/v1/job-descriptions
POST   /api/v1/job-descriptions       # NLP tự động extract skills từ JD text
GET    /api/v1/job-descriptions/:id
PUT    /api/v1/job-descriptions/:id
DELETE /api/v1/job-descriptions/:id
GET    /api/v1/job-descriptions/:id/stats
```

### CVs
```
GET    /api/v1/cvs
POST   /api/v1/cvs                    # Upload CV (multipart/form-data)
GET    /api/v1/cvs/:id
DELETE /api/v1/cvs/:id
GET    /api/v1/cvs/:id/download
GET    /api/v1/cvs/:id/evaluations
```

### Evaluations
```
GET    /api/v1/evaluations
POST   /api/v1/evaluations            # Trả về kết quả ngay lập tức (synchronous)
GET    /api/v1/evaluations/:id
DELETE /api/v1/evaluations/:id
GET    /api/v1/evaluations/:id/scores
GET    /api/v1/evaluations/:id/audit-log
POST   /api/v1/evaluations/:id/retry
```

### Batch Processing
```
GET    /api/v1/batches
POST   /api/v1/batches                # { jobDescriptionId, cvIds[], name? }
GET    /api/v1/batches/:id
GET    /api/v1/batches/:id/items
DELETE /api/v1/batches/:id
GET    /api/v1/batches/:id/results
GET    /api/v1/batches/:id/export     # CSV export
```

### Admin
```
GET    /api/v1/admin/users
PUT    /api/v1/admin/users/:id
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/queue-stats
```

### Health
```
GET    /health
GET    /health/ready
```

## Cài đặt và chạy

### Yêu cầu

- Node.js >= 22.0.0
- PostgreSQL 17+
- Redis 7+ (chỉ cần cho batch processing)

> Không cần API key bên ngoài nào.

### 1. Clone và cài dependencies

```bash
git clone <repo-url>
cd cv-scan-be
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Chỉnh sửa .env với các giá trị thực
```

### 3. Chạy với Docker (khuyến nghị)

```bash
docker compose -f docker/docker-compose.yml up -d
npm run db:migrate
npm run dev
```

### 4. Chạy thủ công

```bash
# Khởi động PostgreSQL và Redis
npm run db:migrate
npm run dev
```

### 5. Seed dữ liệu mẫu

```bash
npm run db:seed
```

## Scripts

```bash
npm run dev             # Dev server với hot reload (tsx watch)
npm run build           # Build TypeScript → dist/
npm run start           # Chạy production build
npm run db:migrate      # Chạy Prisma migrations (dev)
npm run db:migrate:prod # Chạy migrations (production)
npm run db:studio       # Mở Prisma Studio (DB GUI)
npm run db:seed         # Seed dữ liệu mẫu
npm test                # Chạy toàn bộ test suite
npm run test:watch      # Test với watch mode
npm run test:coverage   # Test với coverage report
npm run lint            # Biome linter
npm run format          # Biome formatter (auto-fix)
npm run typecheck       # TypeScript check (không build)
```

## Biến môi trường

Các biến bắt buộc:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/cv_scan_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=<min-32-chars>
STORAGE_PROVIDER=local          # local | s3
```

Xem `.env.example` để biết toàn bộ các biến tùy chọn.

## Luồng xử lý

### Single CV Evaluation (synchronous)

```
POST /api/v1/evaluations  { cvId, jobDescriptionId }
        │
        ▼
  evaluation.service.ts
  ├── Fetch CV text + JD text + weights từ DB
  └── NlpScoringService.score(cvText, jdText, weights)
              │
              ├── skills.scorer      → skillsScore
              ├── experience.scorer  → experienceScore
              ├── education.scorer   → educationScore
              ├── achievements.scorer→ achievementsScore
              └── relevance.scorer   → relevanceScore
                          │
                          ▼
              Tính overallScore (weighted sum)
              Persist Evaluation + Scores
              Return result (200 OK, ~50ms)
```

### Batch Evaluation (async qua BullMQ)

```
POST /api/v1/batches  { jobDescriptionId, cvIds[] }
        │
        ▼
  batch.service.ts → Tạo Batch + BatchItems → enqueue batch job
               │
               ▼
       batch.worker.ts → fan-out: enqueue 1 job/CV
                          │
                          ▼ (concurrency: 20 — NLP rất nhanh)
               evaluation.worker.ts
               └── NlpScoringService.score() → persist → update progress
```

## Hạn chế và hướng mở rộng

| Hạn chế | Hướng giải quyết |
|---|---|
| Không hiểu ngữ nghĩa sâu ("JS" ≠ "JavaScript" nếu thiếu synonym) | Mở rộng `synonym.map.ts` |
| Không đọc hiểu context câu | Tích hợp word embeddings (sentence-transformers local) |
| Skills domain hẹp nếu thiếu keyword | Cập nhật tech keyword dictionary |
| Không sinh narrative text | Tích hợp Ollama local (optional, free) nếu cần |

## Tài liệu API

Sau khi chạy server:
- Swagger UI: `http://localhost:3000/documentation`
- Bull Board: `http://localhost:3000/admin/queues`

## License

MIT
