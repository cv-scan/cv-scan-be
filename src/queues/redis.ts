import { env } from '../config/env';

// Shared connection options for BullMQ (uses its own bundled ioredis)
// REDIS_TLS=true required for Upstash Redis (production)
export const redisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  db: env.REDIS_DB,
  tls: env.REDIS_TLS ? {} : undefined,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};
