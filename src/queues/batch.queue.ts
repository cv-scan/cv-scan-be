import { Queue } from 'bullmq';
import { env } from '../config/env';
import { redisConnection } from './redis';

export interface BatchJobData {
  batchId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _queue: Queue<BatchJobData, any, string> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBatchQueue(): Queue<BatchJobData, any, string> {
  if (_queue) return _queue;
  _queue = new Queue<BatchJobData>('batch-coordinator', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: env.QUEUE_JOB_ATTEMPTS,
      backoff: { type: 'fixed', delay: 1000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  });
  return _queue;
}
