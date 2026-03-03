# Runbook — Deployment

## Môi trường

| Env | Branch | URL |
|---|---|---|
| Development | `develop` | `http://localhost:3000` |
| Staging | `staging` | TBD |
| Production | `main` | TBD |

## Deploy lần đầu

```bash
# 1. Clone và cài packages
git clone <repo>
cd cv-scan-be
npm install

# 2. Cấu hình env
cp .env.example .env
# Điền các giá trị: DATABASE_URL, REDIS_HOST, JWT_SECRET, ...

# 3. Khởi động infra (PostgreSQL + Redis)
docker compose -f docker/docker-compose.yml up -d postgres redis

# 4. Migrate database
npm run db:migrate:prod

# 5. Seed dữ liệu khởi tạo (chỉ lần đầu)
npm run db:seed

# 6. Build và start
npm run build
npm run start
```

## Deploy cập nhật

```bash
git pull origin main
npm install              # Nếu có thay đổi packages
npm run db:migrate:prod  # Nếu có migration mới
npm run build
pm2 restart cv-scan-be   # Hoặc restart service
```

## Kiểm tra sau deploy

```bash
# Health check
curl http://localhost:3000/health
curl http://localhost:3000/health/ready

# Kiểm tra queue
curl http://localhost:3000/admin/queues
```

## Rollback

```bash
git checkout <previous-tag>
npm install
npm run build
npm run start
# Nếu có migration rollback:
npx prisma migrate resolve --rolled-back <migration-name>
```

## Biến môi trường production

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_HOST=...
JWT_SECRET=<256-bit secret>
STORAGE_PROVIDER=s3
AWS_REGION=...
S3_BUCKET_NAME=...
```
