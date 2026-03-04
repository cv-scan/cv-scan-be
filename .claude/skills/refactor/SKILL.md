# Skill: Refactor

## Mục đích

Hướng dẫn refactor code trong CV Scan Backend một cách an toàn.

## Nguyên tắc Refactor

### 1. Không thay đổi behavior
- Viết test trước khi refactor nếu chưa có
- Chạy `npm test` trước và sau khi refactor — kết quả phải giống nhau

### 2. Thứ tự ưu tiên refactor

```
1. Tách service logic ra khỏi controller (nếu controller quá dài)
2. Tách scorer thành file riêng nếu logic quá phức tạp
3. Extract synonym entries ra file data riêng nếu map quá lớn
4. Tạo helper function thay vì copy-paste code
```

### 3. Naming conventions

```typescript
// Scorer functions
scoreSkills(cvText: string, jdText: string): Promise<ScoreResult>
scoreExperience(cvText: string, requiredYears: number): Promise<ScoreResult>

// Service methods
evaluateCV(cvId: string, jdId: string): Promise<EvaluationResult>
batchEvaluate(batchId: string): Promise<void>

// Utility
normalizeSkill(raw: string): string
extractYearsOfExperience(text: string): number | null
```

### 4. Extract pattern cho Scorers

```typescript
// TRƯỚC — logic lẫn lộn
export async function evaluateCv(cv: string, jd: string) {
  const skills = cv.match(/\b(react|vue|angular)\b/gi) || [];
  const jdSkills = jd.match(/\b(react|vue|angular)\b/gi) || [];
  // ... 100 dòng nữa
}

// SAU — tách scorer
// src/services/scoring/skills.scorer.ts
export class SkillsScorer implements IScorer {
  score(cvText: string, jdText: string): ScoreResult { ... }
}
```

## Checklist trước khi submit refactor

- [ ] `npm run typecheck` pass
- [ ] `npm run lint` pass
- [ ] `npm test` pass (không có test mới bị fail)
- [ ] Không có breaking change cho API response shape
