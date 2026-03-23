import { Queue } from "bullmq";
import { env } from "../config/env";
import { redisConnection } from "./redis";

export interface EvaluationJobData {
  batchId: string;
  batchItemId: string;
  cvId: string;
  jobDescriptionId: string;
}

let _queue: Queue<EvaluationJobData, unknown, string> | null = null;

export function getEvaluationQueue(): Queue<
  EvaluationJobData,
  unknown,
  string
> {
  if (_queue) return _queue;
  _queue = new Queue<EvaluationJobData>("cv-evaluation", {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: env.QUEUE_JOB_ATTEMPTS,
      backoff: { type: "fixed", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
  return _queue;
}
