import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { AppError } from '../../utils/errors';
import {
  createJdSchema,
  jdListQuerySchema,
  jdResponseSchema,
  updateJdSchema,
  uploadJdQuerySchema,
} from './jd.schema';
import { jdService } from './jd.service';

const serialize = (jd: {
  id: string;
  title: string;
  content: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredExperienceYears: number | null;
  requiredEducation: string | null;
  weightSkills: number;
  weightExperience: number;
  weightEducation: number;
  weightAchievements: number;
  weightRelevance: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...jd,
  createdAt: jd.createdAt.toISOString(),
  updatedAt: jd.updatedAt.toISOString(),
});

const jdRoutes: FastifyPluginAsyncZod = async (app) => {
  // POST /upload — parse PDF/DOCX and auto-extract metadata
  app.post(
    '/upload',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        summary: 'Upload a JD file (PDF or DOCX) — auto-extracts title, location, skills, etc.',
        querystring: uploadJdQuerySchema,
        response: { 201: jdResponseSchema },
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data)
        throw new AppError(
          'No file attached. Please include a PDF or DOCX file in your request.',
          400,
          'NO_FILE',
        );

      const buffer = await data.toBuffer();
      const jd = await jdService.uploadFromFile(
        buffer,
        data.mimetype,
        request.query,
        request.user.sub,
      );
      return reply.status(201).send(serialize(jd));
    },
  );

  // POST /
  app.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        body: createJdSchema,
        response: { 201: jdResponseSchema },
      },
    },
    async (request, reply) => {
      const jd = await jdService.create(request.body, request.user.sub);
      return reply.status(201).send(serialize(jd));
    },
  );

  // GET /
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        querystring: jdListQuerySchema,
        response: {
          200: z.object({
            data: z.array(jdResponseSchema),
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
      const result = await jdService.list({
        ...request.query,
        userId: request.user.sub,
        role: request.user.role,
      });
      return reply.send({
        data: result.data.map(serialize),
        meta: result.meta,
      });
    },
  );

  // GET /:id
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        params: z.object({ id: z.string() }),
        response: { 200: jdResponseSchema },
      },
    },
    async (request, reply) => {
      const jd = await jdService.getById(request.params.id, request.user.sub, request.user.role);
      return reply.send(serialize(jd));
    },
  );

  // PATCH /:id
  app.patch(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        params: z.object({ id: z.string() }),
        body: updateJdSchema,
        response: { 200: jdResponseSchema },
      },
    },
    async (request, reply) => {
      const jd = await jdService.update(
        request.params.id,
        request.body,
        request.user.sub,
        request.user.role,
      );
      return reply.send(serialize(jd));
    },
  );

  // DELETE /:id — soft delete
  app.delete(
    '/:id',
    {
      preHandler: [requireRole('ADMIN', 'RECRUITER')],
      schema: {
        tags: ['Job Descriptions'],
        params: z.object({ id: z.string() }),
        response: { 200: jdResponseSchema },
      },
    },
    async (request, reply) => {
      const jd = await jdService.softDelete(request.params.id, request.user.sub, request.user.role);
      return reply.send(serialize(jd));
    },
  );
};

export default jdRoutes;
