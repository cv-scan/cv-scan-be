import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/authenticate';
import {
  createDepartmentSchema,
  departmentListQuerySchema,
  departmentResponseSchema,
  updateDepartmentSchema,
} from './departments.schema';
import { departmentsService } from './departments.service';

const serialize = (dept: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...dept,
  createdAt: dept.createdAt.toISOString(),
  updatedAt: dept.updatedAt.toISOString(),
});

const departmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  // POST /
  app.post(
    '/',
    {
      preHandler: [requireRole('ADMIN', 'RECRUITER')],
      schema: {
        tags: ['Departments'],
        body: createDepartmentSchema,
        response: { 201: departmentResponseSchema },
      },
    },
    async (request, reply) => {
      const dept = await departmentsService.create(request.body);
      return reply.status(201).send(serialize(dept));
    },
  );

  // GET /
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Departments'],
        querystring: departmentListQuerySchema,
        response: {
          200: z.object({
            data: z.array(departmentResponseSchema),
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
      const result = await departmentsService.list(request.query);
      return reply.send({ data: result.data.map(serialize), meta: result.meta });
    },
  );

  // GET /:id
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Departments'],
        params: z.object({ id: z.string() }),
        response: { 200: departmentResponseSchema },
      },
    },
    async (request, reply) => {
      const dept = await departmentsService.getById(request.params.id);
      return reply.send(serialize(dept));
    },
  );

  // PATCH /:id
  app.patch(
    '/:id',
    {
      preHandler: [requireRole('ADMIN', 'RECRUITER')],
      schema: {
        tags: ['Departments'],
        params: z.object({ id: z.string() }),
        body: updateDepartmentSchema,
        response: { 200: departmentResponseSchema },
      },
    },
    async (request, reply) => {
      const dept = await departmentsService.update(request.params.id, request.body);
      return reply.send(serialize(dept));
    },
  );

  // DELETE /:id
  app.delete(
    '/:id',
    {
      preHandler: [requireRole('ADMIN')],
      schema: {
        tags: ['Departments'],
        params: z.object({ id: z.string() }),
        response: { 200: departmentResponseSchema },
      },
    },
    async (request, reply) => {
      const dept = await departmentsService.remove(request.params.id);
      return reply.send(serialize(dept));
    },
  );
};

export default departmentsRoutes;
