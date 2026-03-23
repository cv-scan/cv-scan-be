import { Queue } from "bullmq";
import { env } from "../config/env";
import { redisConnection } from "./redis";

export interface BatchJobData {
  batchId: string;
}

let _queue: Queue<BatchJobData, unknown, string> | null = null;

export function getBatchQueue(): Queue<BatchJobData, unknown, string> {
  if (_queue) return _queue;
  _queue = new Queue<BatchJobData>("batch-coordinator", {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: env.QUEUE_JOB_ATTEMPTS,
      backoff: { type: "fixed", delay: 1000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  });
  return _queue;
}
