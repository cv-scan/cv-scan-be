import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import {
  batchListQuerySchema,
  batchResponseSchema,
  createBatchSchema,
} from './batches.schema';
import { batchesService } from './batches.service';

const serialize = (batch: {
  id: string;
  name: string | null;
  jobDescriptionId: string;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  queueJobId: string | null;
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
  items?: Array<{ id: string; cvId: string; status: string; queueJobId: string | null }>;
}) => ({
  ...batch,
  createdAt: batch.createdAt.toISOString(),
  completedAt: batch.completedAt?.toISOString() ?? null,
  updatedAt: batch.updatedAt.toISOString(),
});

const batchesRoutes: FastifyPluginAsyncZod = async (app) => {
  // POST /
  app.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Batches'],
        summary: 'Create a batch evaluation job',
        body: createBatchSchema,
        response: { 201: batchResponseSchema },
      },
    },
    async (request, reply) => {
      const batch = await batchesService.create(request.body, request.user.sub);
      return reply.status(201).send(serialize(batch));
    },
  );

  // GET /
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Batches'],
        querystring: batchListQuerySchema,
        response: {
          200: z.object({
            data: z.array(batchResponseSchema),
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
      const result = await batchesService.list({
        ...request.query,
        userId: request.user.sub,
      });
      return reply.send({ data: result.data.map(serialize), meta: result.meta });
    },
  );

  // GET /:id
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Batches'],
        params: z.object({ id: z.string() }),
        response: { 200: batchResponseSchema },
      },
    },
    async (request, reply) => {
      const batch = await batchesService.getById(
        request.params.id,
        request.user.sub,
        request.user.role,
      );
      return reply.send(serialize(batch));
    },
  );

  // POST /:id/cancel
  app.post(
    '/:id/cancel',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Batches'],
        params: z.object({ id: z.string() }),
        response: { 200: batchResponseSchema },
      },
    },
    async (request, reply) => {
      const batch = await batchesService.cancel(
        request.params.id,
        request.user.sub,
        request.user.role,
      );
      return reply.send(serialize(batch));
    },
  );
};

export default batchesRoutes;
