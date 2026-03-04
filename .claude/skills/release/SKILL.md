# Skill: Release

## Mục đích

Chuẩn bị và thực hiện release cho CV Scan Backend.

## Quy trình Release

### 1. Pre-release checklist

```bash
# Chạy toàn bộ test suite
npm test

# TypeScript check
npm run typecheck

# Lint
npm run lint

# Kiểm tra migration không có pending
npm run db:migrate status
```

### 2. Version bump

CV Scan Backend dùng Semantic Versioning (`MAJOR.MINOR.PATCH`):
- `PATCH`: bug fix, không thay đổi API
- `MINOR`: tính năng mới, backward compatible
- `MAJOR`: breaking change API

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

### 3. Changelog format

```markdown
## [1.1.0] - 2025-03-03

### Added
- Batch CSV export endpoint
- DOCX file support for CV upload

### Changed
- SKILLS scorer: thêm 50 synonym entries mới

### Fixed
- Experience scorer: fix parse "2+ years" edge case

### Security
- Rate limiting cho /api/v1/evaluations endpoint
```

### 4. Migration checklist (nếu có schema change)

- [ ] Migration file đã được test trên staging DB
- [ ] Migration có thể rollback an toàn
- [ ] Deployment guide trong `docs/runbooks/deployment.md` được cập nhật

### 5. Post-release

```bash
# Tag release
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# Verify production health
curl https://api.production.com/health/ready
```
