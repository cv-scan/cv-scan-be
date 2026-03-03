import { Worker } from 'bullmq';
import { prisma } from '../config/database.config';
import { env } from '../config/env';
import type { JdContext } from '../services/scoring/nlp.service';
import { nlpScoringService } from '../services/scoring/nlp.service';
import { redisConnection } from './redis';
import type { EvaluationJobData } from './evaluation.queue';

export function createEvaluationWorker() {
  const worker = new Worker<EvaluationJobData>(
    'cv-evaluation',
    async (job) => {
      const { batchId, batchItemId, cvId, jobDescriptionId } = job.data;

      // Update batch item status
      await prisma.batchItem.update({
        where: { id: batchItemId },
        data: { status: 'PROCESSING' },
      });

      const [cv, jd] = await Promise.all([
        prisma.cV.findUnique({ where: { id: cvId } }),
        prisma.jobDescription.findUnique({ where: { id: jobDescriptionId } }),
      ]);

      if (!cv || !jd || cv.parseStatus !== 'COMPLETED' || !cv.extractedText) {
        await prisma.batchItem.update({
          where: { id: batchItemId },
          data: { status: 'FAILED' },
        });
        await incrementBatchFailed(batchId);
        return;
      }

      let evaluation = await prisma.evaluation.findUnique({
        where: { cvId_jobDescriptionId: { cvId, jobDescriptionId } },
      });

      if (evaluation) {
        await prisma.score.deleteMany({ where: { evaluationId: evaluation.id } });
        evaluation = await prisma.evaluation.update({
          where: { id: evaluation.id },
          data: { status: 'PROCESSING', startedAt: new Date(), completedAt: null, overallScore: null, batchItemId },
        });
      } else {
        evaluation = await prisma.evaluation.create({
          data: { cvId, jobDescriptionId, status: 'PROCESSING', startedAt: new Date(), batchItemId, triggeredBy: 'batch' },
        });
      }

      try {
        const jdContext: JdContext = {
          content: jd.content,
          requiredSkills: jd.requiredSkills,
          preferredSkills: jd.preferredSkills,
          requiredExperienceYears: jd.requiredExperienceYears,
          requiredEducation: jd.requiredEducation,
          weightSkills: jd.weightSkills,
          weightExperience: jd.weightExperience,
          weightEducation: jd.weightEducation,
          weightAchievements: jd.weightAchievements,
          weightRelevance: jd.weightRelevance,
        };

        const result = await nlpScoringService.score(cv.extractedText, jdContext);

        await prisma.$transaction([
          prisma.score.createMany({
            data: result.categories.map((cat) => ({
              evaluationId: evaluation!.id,
              category: cat.category as 'SKILLS' | 'EXPERIENCE' | 'EDUCATION' | 'ACHIEVEMENTS' | 'RELEVANCE',
              rawScore: cat.rawScore,
              weight: cat.weight,
              weightedScore: cat.weightedScore,
              rationale: cat.rationale,
              evidence: cat.evidence,
              gaps: cat.gaps,
            })),
          }),
          prisma.evaluation.update({
            where: { id: evaluation!.id },
            data: {
              status: 'COMPLETED',
              overallScore: result.overallScore,
              recommendation: result.recommendation,
              processingTimeMs: result.processingTimeMs,
              completedAt: new Date(),
            },
          }),
          prisma.batchItem.update({
            where: { id: batchItemId },
            data: { status: 'COMPLETED' },
          }),
        ]);

        await incrementBatchCompleted(batchId);
      } catch (err) {
        await prisma.evaluation.update({
          where: { id: evaluation.id },
          data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Failed' },
        });
        await prisma.batchItem.update({
          where: { id: batchItemId },
          data: { status: 'FAILED' },
        });
        await incrementBatchFailed(batchId);
        throw err; // Let BullMQ handle retry
      }
    },
    {
      connection: redisConnection,
      concurrency: env.QUEUE_EVALUATION_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`Evaluation job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function incrementBatchCompleted(batchId: string) {
  const batch = await prisma.batch.update({
    where: { id: batchId },
    data: { completedCount: { increment: 1 } },
  });
  await checkBatchCompletion(batch);
}

async function incrementBatchFailed(batchId: string) {
  const batch = await prisma.batch.update({
    where: { id: batchId },
    data: { failedCount: { increment: 1 } },
  });
  await checkBatchCompletion(batch);
}

async function checkBatchCompletion(batch: {
  id: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  status: string;
}) {
  const processed = batch.completedCount + batch.failedCount;
  if (processed >= batch.totalCount) {
    const finalStatus =
      batch.failedCount === 0
        ? 'COMPLETED'
        : batch.completedCount === 0
          ? 'FAILED'
          : 'PARTIALLY_FAILED';

    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: finalStatus, completedAt: new Date() },
    });
  }
}
