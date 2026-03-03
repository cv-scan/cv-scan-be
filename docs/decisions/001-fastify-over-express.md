# ADR 001 — Chọn Fastify thay vì Express

- **Status:** Accepted
- **Date:** 2025-03-03

## Context

Cần chọn HTTP framework cho Node.js backend. Hai lựa chọn chính: Express.js (phổ biến nhất) và Fastify (hiệu năng cao).

## Quyết định

Dùng **Fastify v5**.

## Lý do

| Tiêu chí | Express | Fastify |
|---|---|---|
| Throughput | ~20k req/s | ~70k req/s |
| Schema validation | Không có sẵn | Built-in (JSON Schema / Zod) |
| TypeScript | Partial | Native |
| OpenAPI generation | Plugin bên ngoài | `@fastify/swagger` |
| Plugin lifecycle | Middleware đơn giản | Encapsulated plugin system |

Với CV Scan, bottleneck là NLP processing và DB I/O — không phải HTTP layer. Chọn Fastify để không "trả thuế" framework overhead và tận dụng built-in schema validation.

## Hệ quả

- Phải học Fastify plugin system (khác với Express middleware)
- `fastify-type-provider-zod` cần thiết để dùng Zod thay JSON Schema
- Cú pháp route registration khác Express
