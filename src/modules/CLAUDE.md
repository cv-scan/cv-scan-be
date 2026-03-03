# Context: src/modules/ — API Layer

Thư mục này chứa các feature modules theo **vertical slice** pattern.

## Quy tắc

1. **Mỗi module tự chứa**: controller, service, routes, schema
2. **KHÔNG import chéo** giữa các module — dùng `src/services/` nếu cần share
3. **Controller = thin layer**: parse request → gọi service → trả response
4. **Schema định nghĩa TRƯỚC** khi viết code

## Module hiện có

| Module | Route prefix | Chức năng |
|---|---|---|
| `auth/` | `/api/v1/auth` | Register, login, refresh token |
| `users/` | `/api/v1/users` | User profile, admin management |
| `job-descriptions/` | `/api/v1/job-descriptions` | CRUD JD + NLP skill extraction |
| `cvs/` | `/api/v1/cvs` | Upload, parse, download CV |
| `evaluations/` | `/api/v1/evaluations` | Chấm điểm CV (synchronous) |
| `batches/` | `/api/v1/batches` | Batch processing nhiều CV |

## Thêm module mới

1. Tạo thư mục `src/modules/<feature>/`
2. Tạo 4 files: `controller.ts`, `service.ts`, `routes.ts`, `schema.ts`
3. Import routes trong `src/server.ts`
4. Chạy `npm run typecheck`
