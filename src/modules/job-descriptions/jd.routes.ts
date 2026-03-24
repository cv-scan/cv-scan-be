import type { EmploymentType, ExperienceLevel } from '@prisma/client';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { AppError } from '../../utils/errors';
import {
  EmploymentTypeEnum,
  ExperienceLevelEnum,
  createJdSchema,
  jdListQuerySchema,
  jdResponseSchema,
  jdStatsResponseSchema,
  updateJdSchema,
  uploadJdQuerySchema,
} from './jd.schema';
import { jdService } from './jd.service';

type JdRow = {
  id: string;
  title: string;
  content: string;
  fileUrl: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  location: string | null;
  employmentTypes: EmploymentType[];
  experienceLevel: ExperienceLevel | null;
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
  cvCount?: number;
};

const serialize = (jd: JdRow) => ({
  ...jd,
  cvCount: jd.cvCount ?? 0,
  createdAt: jd.createdAt.toISOString(),
  updatedAt: jd.updatedAt.toISOString(),
});

const jdRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /employment-types
  app.get(
    '/employment-types',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        summary: 'Get all employment type options',
        response: { 200: z.object({ data: z.array(EmploymentTypeEnum) }) },
      },
    },
    async (_request, reply) => {
      return reply.send({ data: EmploymentTypeEnum.options });
    },
  );

  // GET /experience-levels
  app.get(
    '/experience-levels',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        summary: 'Get all experience level options',
        response: { 200: z.object({ data: z.array(ExperienceLevelEnum) }) },
      },
    },
    async (_request, reply) => {
      return reply.send({ data: ExperienceLevelEnum.options });
    },
  );

  // POST /upload — parse PDF/DOCX and auto-extract metadata
  // Form fields: file (required), title?, departmentId?, experienceLevel?, employmentTypes? (comma-sep or repeated)
  app.post(
    '/upload',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        summary: 'Upload a JD file (PDF or DOCX). Form fields: file, title?, departmentId?, experienceLevel?, employmentTypes? (comma-separated or repeated)',
        response: { 201: jdResponseSchema },
      },
    },
    async (request, reply) => {
      const formFields: Record<string, string | string[]> = {};
      let fileBuffer: Buffer | null = null;
      let fileMimetype = '';
      let fileFilename = '';

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer();
          fileMimetype = part.mimetype;
          fileFilename = part.filename;
        } else {
          const val = part.value as string;
          const existing = formFields[part.fieldname];
          formFields[part.fieldname] = existing
            ? [...(Array.isArray(existing) ? existing : [existing]), val]
            : val;
        }
      }

      if (!fileBuffer) {
        throw new AppError(
          'No file attached. Please include a PDF or DOCX file in your request.',
          400,
          'NO_FILE',
        );
      }

      const rawEt = formFields.employmentTypes;
      const employmentTypesRaw = rawEt
        ? Array.isArray(rawEt)
          ? rawEt
          : rawEt.split(',').map((s) => s.trim())
        : undefined;

      const query = uploadJdQuerySchema.parse({
        title: formFields.title,
        departmentId: formFields.departmentId,
        employmentTypes: employmentTypesRaw,
        experienceLevel: formFields.experienceLevel,
        weightSkills: formFields.weightSkills,
        weightExperience: formFields.weightExperience,
        weightEducation: formFields.weightEducation,
        weightAchievements: formFields.weightAchievements,
        weightRelevance: formFields.weightRelevance,
      });

      const jd = await jdService.uploadFromFile(
        fileBuffer,
        fileMimetype,
        fileFilename,
        query,
        request.user.sub,
      );
      return reply.status(201).send(serialize(jd as JdRow));
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
      return reply.status(201).send(serialize(jd as JdRow));
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
        data: result.data.map((jd) => serialize(jd as JdRow)),
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
      return reply.send(serialize(jd as JdRow));
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
      return reply.send(serialize(jd as JdRow));
    },
  );

  // GET /:id/stats
  app.get(
    '/:id/stats',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Job Descriptions'],
        summary: 'Get CV scan statistics for a Job Description',
        params: z.object({ id: z.string() }),
        response: { 200: jdStatsResponseSchema },
      },
    },
    async (request, reply) => {
      const stats = await jdService.getStats(
        request.params.id,
        request.user.sub,
        request.user.role,
      );
      return reply.send(stats);
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
      return reply.send(serialize(jd as JdRow));
    },
  );
};

export default jdRoutes;
