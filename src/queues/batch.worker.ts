import { Worker } from 'bullmq';
import { prisma } from '../config/database.config';
import { env } from '../config/env';
import { redisConnection } from './redis';
import type { BatchJobData } from './batch.queue';
import { getEvaluationQueue } from './evaluation.queue';

export function createBatchWorker() {
  const worker = new Worker<BatchJobData>(
    'batch-coordinator',
    async (job) => {
      const { batchId } = job.data;

      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: { items: true },
      });

      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }

      if (batch.status === 'CANCELLED') {
        return;
      }

      await prisma.batch.update({
        where: { id: batchId },
        data: { status: 'PROCESSING' },
      });

      const evaluationQueue = getEvaluationQueue();

      // Fan-out: one evaluation job per CV
      const jobs = batch.items.map((item) => ({
        name: 'evaluate-cv',
        data: {
          batchId,
          batchItemId: item.id,
          cvId: item.cvId,
          jobDescriptionId: batch.jobDescriptionId,
        },
        opts: { jobId: `eval-${item.id}` },
      }));

      await evaluationQueue.addBulk(jobs);

      // Update batch items to PENDING (they're queued)
      await prisma.batchItem.updateMany({
        where: { batchId },
        data: { status: 'PENDING' },
      });
    },
    {
      connection: redisConnection,
      concurrency: env.QUEUE_BATCH_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`Batch job ${job?.id} failed:`, err.message);
  });

  return worker;
}
