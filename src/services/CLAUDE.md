# Context: src/services/ — Shared Services

Thư mục này chứa các **shared infrastructure services** được dùng bởi nhiều modules.

## Cấu trúc

```
services/
├── scoring/      # NLP Scoring Engine — core của hệ thống
├── storage/      # File storage abstraction (local / S3)
└── parser/       # Document parsing (PDF, DOCX)
```

## scoring/ — NLP Scoring Engine

**Đây là thư mục quan trọng nhất.** Không được gọi AI API từ đây.

```
scoring/
├── nlp.service.ts          # Orchestrator: gọi tất cả scorers
├── skills.scorer.ts        # Jaccard + Jaro-Winkler + synonym map
├── experience.scorer.ts    # Regex year extraction
├── education.scorer.ts     # Degree level comparison
├── achievements.scorer.ts  # Quantified impact detection
├── relevance.scorer.ts     # TF-IDF cosine similarity
└── synonym.map.ts          # Tech skill synonyms — cần maintain thường xuyên
```

**Interface mọi scorer phải implement:**
```typescript
interface IScorer {
  score(cvText: string, jdText: string): Promise<ScoreResult>;
}

interface ScoreResult {
  raw: number;        // 0–100
  evidence: string[]; // Những gì tìm thấy trong CV
  gaps: string[];     // Những gì thiếu so với JD
  rationale: string;  // Giải thích ngắn gọn
}
```

## storage/ — File Storage

Port/Adapter pattern. Swap local ↔ S3 chỉ bằng env var.

```typescript
interface IStorageService {
  save(buffer: Buffer, filename: string): Promise<string>; // returns path/key
  delete(path: string): Promise<void>;
  getDownloadUrl(path: string): Promise<string>;
}
```

## parser/ — Document Parsing

```typescript
// pdf.parser.ts — dùng pdf-parse
// docx.parser.ts — dùng mammoth
```

Mỗi parser nhận `Buffer`, trả về `string` (plain text).
