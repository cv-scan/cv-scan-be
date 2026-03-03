import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireRole } from '../../middleware/authenticate';
import { updateUserSchema, userResponseSchema, usersListQuerySchema } from './users.schema';
import { usersService } from './users.service';

const serialize = (user: {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...user,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  // All users routes require ADMIN role
  // GET /
  app.get(
    '/',
    {
      preHandler: [requireRole('ADMIN')],
      schema: {
        tags: ['Users'],
        querystring: usersListQuerySchema,
        response: {
          200: z.object({
            data: z.array(userResponseSchema),
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
      const result = await usersService.list(request.query);
      return reply.send({ data: result.data.map(serialize), meta: result.meta });
    },
  );

  // GET /:id
  app.get(
    '/:id',
    {
      preHandler: [requireRole('ADMIN')],
      schema: {
        tags: ['Users'],
        params: z.object({ id: z.string() }),
        response: { 200: userResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await usersService.getById(request.params.id);
      return reply.send(serialize(user));
    },
  );

  // PATCH /:id
  app.patch(
    '/:id',
    {
      preHandler: [requireRole('ADMIN')],
      schema: {
        tags: ['Users'],
        params: z.object({ id: z.string() }),
        body: updateUserSchema,
        response: { 200: userResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await usersService.update(request.params.id, request.body);
      return reply.send(serialize(user));
    },
  );
};

export default usersRoutes;
