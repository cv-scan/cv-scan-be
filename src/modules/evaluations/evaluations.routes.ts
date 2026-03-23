import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import {
  createEvaluationSchema,
  evaluationListQuerySchema,
  evaluationResponseSchema,
  evaluationStatsQuerySchema,
  jdStatsSchema,
} from './evaluations.schema';
import { evaluationsService } from './evaluations.service';

const serialize = (ev: {
  id: string;
  cvId: string;
  jobDescriptionId: string;
  candidateName: string | null;
  jdTitle: string | null;
  status: string;
  overallScore: number | null;
  classification: 'PASS' | 'WAITLIST' | 'FAIL' | null;
  recommendation: string | null;
  scoringEngine: string;
  processingTimeMs: number | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  scores?: Array<{
    id: string;
    category: string;
    rawScore: number;
    weight: number;
    weightedScore: number;
    rationale: string;
    evidence: string[];
    gaps: string[];
  }>;
}) => ({
  ...ev,
  startedAt: ev.startedAt?.toISOString() ?? null,
  completedAt: ev.completedAt?.toISOString() ?? null,
  createdAt: ev.createdAt.toISOString(),
  updatedAt: ev.updatedAt.toISOString(),
});

const evaluationsRoutes: FastifyPluginAsyncZod = async (app) => {
  // POST / — single evaluation (synchronous)
  app.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Evaluations'],
        summary: 'Evaluate a CV against a Job Description (synchronous)',
        body: createEvaluationSchema,
        response: { 201: evaluationResponseSchema },
      },
    },
    async (request, reply) => {
      const evaluation = await evaluationsService.evaluate(request.body, request.user.sub, request.user.role);
      return reply.status(201).send(serialize(evaluation));
    },
  );

  // GET /
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Evaluations'],
        querystring: evaluationListQuerySchema,
        response: {
          200: z.object({
            data: z.array(evaluationResponseSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await evaluationsService.list({
        ...request.query,
        userId: request.user.sub,
        role: request.user.role,
      });
      return reply.send({ data: result.data.map(serialize), meta: result.meta });
    },
  );

  // GET /stats — classification counts per JD
  app.get(
    '/stats',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Evaluations'],
        summary: 'Get pass/waitlist/fail counts per Job Description',
        querystring: evaluationStatsQuerySchema,
        response: {
          200: z.object({ data: z.array(jdStatsSchema) }),
        },
      },
    },
    async (request, reply) => {
      const data = await evaluationsService.getStats({
        jobDescriptionId: request.query.jobDescriptionId,
        userId: request.user.sub,
        role: request.user.role,
      });
      return reply.send({ data });
    },
  );

  // GET /:id
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Evaluations'],
        params: z.object({ id: z.string() }),
        response: { 200: evaluationResponseSchema },
      },
    },
    async (request, reply) => {
      const evaluation = await evaluationsService.getById(request.params.id, request.user.sub, request.user.role);
      return reply.send(serialize(evaluation));
    },
  );
};

export default evaluationsRoutes;
