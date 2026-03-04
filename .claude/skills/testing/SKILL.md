# Skill: Testing

## Mục đích

Viết tests chất lượng cao cho CV Scan Backend.

## Testing Strategy

### Unit Tests — `tests/unit/`

Test từng scorer và service riêng lẻ. **Không cần mock** cho NLP scorers (pure functions).

```typescript
// tests/unit/scoring/skills.scorer.test.ts
describe('SkillsScorer', () => {
  const scorer = new SkillsScorer();

  it('should return 100 when all required skills match exactly', async () => {
    const cv = 'Experienced in React, TypeScript, Node.js';
    const jd = 'Required: React, TypeScript, Node.js';
    const result = await scorer.score(cv, jd);
    expect(result.raw).toBeGreaterThanOrEqual(90);
  });

  it('should match JS as JavaScript via synonym map', async () => {
    const cv = 'Expert in JS and TS';
    const jd = 'Required: JavaScript, TypeScript';
    const result = await scorer.score(cv, jd);
    expect(result.raw).toBeGreaterThan(50);
  });

  it('should return 0 when no skills match', async () => {
    const cv = 'Marketing specialist with brand management experience';
    const jd = 'Required: React, Node.js, PostgreSQL';
    const result = await scorer.score(cv, jd);
    expect(result.raw).toBeLessThan(10);
  });

  it('should handle empty CV text gracefully', async () => {
    const result = await scorer.score('', 'Required: React');
    expect(result.raw).toBe(0);
    expect(result.evidence).toEqual([]);
  });
});
```

### Test Fixtures — `tests/fixtures/`

```
tests/fixtures/
├── sample.pdf              # CV thật (PDF có text layer)
├── sample.docx             # CV thật (DOCX)
├── cv-senior-backend.txt   # CV text: senior backend dev
├── cv-junior-frontend.txt  # CV text: junior frontend dev
├── cv-no-experience.txt    # CV text: fresh graduate
├── jd-backend-senior.txt   # JD: senior backend engineer
└── jd-marketing.txt        # JD: marketing manager (để test mismatch)
```

### Integration Tests — `tests/integration/`

Test API endpoints với real PostgreSQL DB (transaction rollback sau mỗi test).

```typescript
// tests/integration/evaluations.test.ts
describe('POST /api/v1/evaluations', () => {
  it('should return evaluation result synchronously', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluations',
      headers: { authorization: `Bearer ${testToken}` },
      body: { cvId: testCvId, jobDescriptionId: testJdId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      overallScore: expect.any(Number),
      status: 'COMPLETED',
      scores: expect.arrayContaining([
        expect.objectContaining({ category: 'SKILLS' }),
      ]),
    });
  });
});
```

## Coverage Targets

| Layer | Target |
|---|---|
| NLP Scorers | > 90% |
| Service layer | > 80% |
| API routes | > 70% (integration) |
| Utils | > 95% |

## Chạy tests

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npx jest skills.scorer      # Test file cụ thể
```
