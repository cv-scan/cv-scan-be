# Kiến trúc hệ thống — CV Scan Backend

## Tổng quan

CV Scan Backend là RESTful API xử lý upload CV, quản lý JD và chấm điểm CV theo rule-based NLP. Không phụ thuộc AI API trả phí.

## Sơ đồ kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│                        Clients                           │
│              (Web App / Mobile / CLI)                    │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼─────────────────────────────────┐
│                   Fastify v5 (API Layer)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   auth   │  │   cvs    │  │   JDs    │  │evaluations│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              JWT Auth Middleware                      │ │
│  └──────────────────────────────────────────────────────┘ │
└────────┬───────────────┬───────────────────┬─────────────┘
         │               │                   │
┌────────▼──────┐ ┌──────▼──────┐  ┌────────▼────────────┐
│  NLP Scoring  │ │   Storage   │  │    BullMQ Queue      │
│    Engine     │ │  (local/S3) │  │  (batch only)        │
│               │ │             │  │                      │
│ • skills      │ │             │  │ ┌──────────────────┐ │
│ • experience  │ │             │  │ │ evaluation.worker│ │
│ • education   │ │             │  │ │ batch.worker     │ │
│ • achievements│ │             │  │ └──────────────────┘ │
│ • relevance   │ │             │  │         │ Redis       │
└───────────────┘ └─────────────┘  └─────────────────────┘
         │
┌────────▼─────────────────────────────────────────────────┐
│                   PostgreSQL 17                           │
│  users │ job_descriptions │ cvs │ evaluations │ scores   │
│  batches │ batch_items │ refresh_tokens │ audit_logs     │
└──────────────────────────────────────────────────────────┘
```

## Các lớp kiến trúc

### 1. API Layer (`src/modules/`)
Fastify routes + controllers. Mỗi module là một vertical slice:
- `auth/` — register, login, refresh token, logout
- `users/` — user profile, admin management
- `job-descriptions/` — CRUD JD + NLP skill extraction
- `cvs/` — upload, parse, download CV
- `evaluations/` — trigger và xem kết quả chấm điểm
- `batches/` — batch processing nhiều CV

### 2. NLP Scoring Engine (`src/services/scoring/`)
Core của hệ thống. Hoạt động synchronous, < 50ms/CV:

```
NlpScoringService.score(cvText, jdText, weights)
  ├── SkillsScorer     → Jaccard similarity + Jaro-Winkler fuzzy + synonym map
  ├── ExperienceScorer → Regex extract years + level keywords
  ├── EducationScorer  → Degree level comparison
  ├── AchievementsScorer → Quantified impact detection
  └── RelevanceScorer  → TF-IDF cosine similarity
```

### 3. Queue Layer (`src/queues/`)
**Chỉ dùng cho batch processing.** Single evaluation là synchronous.

```
batch.worker     → fan-out: tạo job cho mỗi CV trong batch
evaluation.worker → gọi NlpScoringService + persist result
```

### 4. Persistence Layer (`prisma/`)
Prisma v6 + PostgreSQL 17. Schema là source of truth cho toàn bộ DB.

### 5. Infrastructure (`src/plugins/`, `src/middleware/`, `src/config/`)
- JWT auth, rate limiting, multipart upload
- Local/S3 file storage (abstracted qua interface)
- Zod-validated env config (fail-fast on startup)

## Luồng xử lý chính

### Upload và chấm điểm CV

```
1. POST /api/v1/cvs        → Upload file → pdf-parse/mammoth extract text
2. POST /api/v1/evaluations → NlpScoringService.score() → persist → return 200
```

### Batch processing

```
1. POST /api/v1/batches    → Tạo Batch + BatchItems → enqueue coordinator job
2. batch.worker            → Fan-out: 1 job/CV vào evaluation queue
3. evaluation.worker (×N)  → NlpScoringService.score() → persist → update progress
4. GET /api/v1/batches/:id → Poll progress
5. GET /api/v1/batches/:id/export → CSV export khi hoàn thành
```

## Quyết định kiến trúc

Xem `docs/decisions/` để biết lý do cho từng lựa chọn công nghệ.

## Giới hạn hiện tại

- NLP rule-based không hiểu ngữ nghĩa sâu (synonym map cần maintain thủ công)
- Chỉ support tiếng Anh (NLP libraries dùng English tokenizer)
- Không sinh narrative/summary text (chỉ có structured scores)
