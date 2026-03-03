# Prompt: Debug NLP Scoring

Dùng prompt này khi cần debug tại sao một CV nhận điểm thấp/cao bất thường.

---

Tôi đang debug NLP scoring engine cho CV Scan Backend.

**CV text:**
```
[Dán CV text ở đây]
```

**JD text:**
```
[Dán JD text ở đây]
```

**Kết quả scoring nhận được:**
- overallScore: [X]
- skillsScore: [X] (expected: [Y])
- experienceScore: [X]
- educationScore: [X]
- achievementsScore: [X]
- relevanceScore: [X]

**Vấn đề:**
[Mô tả vấn đề, ví dụ: "skillsScore = 0 mặc dù CV có React và Node.js"]

Hãy phân tích:
1. Skills nào trong JD có thể không được extract đúng?
2. Skills nào trong CV có thể không được nhận dạng (alias, viết tắt)?
3. Entries nào cần thêm vào `synonym.map.ts`?
4. Logic nào trong scorer có thể cần điều chỉnh?
