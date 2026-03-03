# ADR 003 — Chọn Prisma thay vì Sequelize / Drizzle

- **Status:** Accepted
- **Date:** 2025-03-03

## Context

Cần ORM cho PostgreSQL. Các lựa chọn: Prisma, Sequelize, Drizzle, TypeORM.

## Quyết định

Dùng **Prisma v6**.

## Lý do

- `prisma/schema.prisma` là **single source of truth**: DB schema + TypeScript types + migrations
- Generated client cung cấp compile-time type safety cho mọi query
- `prisma migrate dev` workflow tốt hơn Sequelize cho team
- Prisma Studio giúp debug data nhanh trong development
- Drizzle nhẹ hơn nhưng migration tooling chưa mature bằng Prisma

## Hệ quả

- Migration files auto-generated, không viết SQL tay
- Raw SQL chỉ dùng khi Prisma không hỗ trợ aggregation phức tạp
- Schema change → regenerate client → TypeScript errors ngay lập tức
