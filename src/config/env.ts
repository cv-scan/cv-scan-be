import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  API_PREFIX: z.string().default("/api/v1"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  LOCAL_UPLOAD_DIR: z.string().default("./uploads"),

  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3001")
    .transform((val) => val.split(",").map((s) => s.trim())),

  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  QUEUE_EVALUATION_CONCURRENCY: z.coerce.number().default(20),
  QUEUE_BATCH_CONCURRENCY: z.coerce.number().default(5),
  QUEUE_JOB_ATTEMPTS: z.coerce.number().default(3),

  BULL_BOARD_USERNAME: z.string().default("admin"),
  BULL_BOARD_PASSWORD: z.string().default("admin"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment variables:");
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;
