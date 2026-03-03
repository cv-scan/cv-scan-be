# Prompt: Mở rộng Synonym Map

Dùng prompt này khi cần tìm thêm aliases cho một technology stack cụ thể.

---

Tôi đang xây dựng `synonym.map.ts` cho NLP scoring engine trong hệ thống chấm điểm CV.

Map hiện tại normalize tên skill về dạng chuẩn:
```
'js' → 'javascript'
'reactjs' → 'react'
'node.js' → 'nodejs'
```

Hãy liệt kê tất cả các aliases phổ biến (viết tắt, viết khác, tên cũ) cho các technologies sau:

**[Liệt kê technologies cần tìm alias]**

Ví dụ: PostgreSQL, Kubernetes, TypeScript, ...

Format output:
```typescript
// postgresql aliases
'postgres': 'postgresql',
'pg': 'postgresql',
'psql': 'postgresql',

// kubernetes aliases
'k8s': 'kubernetes',
'kube': 'kubernetes',
```

Chỉ include aliases thực sự phổ biến trong CV/JD, không include những dạng quá hiếm gặp.
