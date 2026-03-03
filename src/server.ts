import { env } from './config/env';
import { buildApp } from './config/app.config';
import { setBatchQueueFactory } from './modules/batches/batches.service';
import { getBatchQueue } from './queues/batch.queue';
import { createBatchWorker } from './queues/batch.worker';
import { createEvaluationWorker } from './queues/evaluation.worker';

async function main() {
  const app = await buildApp();

  // ─── Register queue factory in batch service ──────────────────
  setBatchQueueFactory(getBatchQueue);

  // ─── Initialize workers (batch mode only) ─────────────────────
  const batchWorker = createBatchWorker();
  const evaluationWorker = createEvaluationWorker();

  // ─── Graceful shutdown ─────────────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await batchWorker.close();
    await evaluationWorker.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`CV Scan Backend running on http://${env.HOST}:${env.PORT}`);
    app.log.info(`Swagger docs: http://localhost:${env.PORT}/docs`);
    app.log.info(`Environment: ${env.NODE_ENV}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
