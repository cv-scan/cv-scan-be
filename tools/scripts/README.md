# Tools — Scripts

Thư mục chứa các script hỗ trợ phát triển và vận hành.

## Scripts hiện có

*(Thêm script vào đây khi cần)*

## Scripts nên có

### `check-env.sh`
Kiểm tra tất cả biến môi trường bắt buộc đã được set chưa trước khi deploy.

```bash
#!/bin/bash
required=("DATABASE_URL" "REDIS_HOST" "JWT_SECRET" "STORAGE_PROVIDER")
for var in "${required[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: Missing required env var: $var"
    exit 1
  fi
done
echo "All required env vars are set."
```

### `seed-test-data.sh`
Tạo dữ liệu test nhanh (JD + CV mẫu) cho môi trường development.

### `export-batch-results.sh`
Export kết quả một batch cụ thể ra CSV từ command line.
```bash
./export-batch-results.sh <batch-id> output.csv
```
