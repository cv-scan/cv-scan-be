# ADR 002 — Rule-based NLP thay vì AI API

- **Status:** Accepted
- **Date:** 2025-03-03

## Context

Cần một engine để chấm điểm CV so với JD theo nhiều hạng mục. Có hai hướng:
1. Gọi AI API (Claude, GPT, Gemini) để phân tích
2. Tự xây dựng NLP scoring engine

## Quyết định

Dùng **Rule-based NLP Engine** với `natural` + `compromise` + `fuse.js`.

## Lý do

| Tiêu chí | AI API | Rule-based NLP |
|---|---|---|
| Chi phí | $0.02–0.10/CV | $0 |
| Tốc độ | 10–60 giây/CV | < 50ms/CV |
| Offline | Không | Có |
| Deterministic | Không | Có |
| Explainable | Khó (black box) | Có (logic rõ ràng) |
| Privacy | CV gửi ra ngoài | CV ở local |
| Rate limit | Có (quota) | Không |

Với use case là chấm điểm CV theo cấu trúc rõ ràng (skills match, years of experience, degree level), rule-based NLP đủ khả năng và cho kết quả predictable hơn.

## Hệ quả

- Cần maintain `synonym.map.ts` khi gặp skill aliases mới
- Không có narrative generation (chỉ structured scores)
- Cần viết test kỹ cho từng scorer để đảm bảo accuracy
- Nếu cần narrative trong tương lai: tích hợp Ollama local (free) là hướng mở rộng

## Hướng mở rộng

Nếu cần AI chất lượng cao hơn:
- **Ollama** (local, free): `llama3.2`, `qwen2.5` — không gửi data ra ngoài
- **Groq** (cloud free tier): 14,400 req/ngày — nếu cần narrative text
