import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { AppError } from '../../utils/errors';
import {
  cvDetailResponseSchema,
  cvListQuerySchema,
  cvResponseSchema,
  cvUploadQuerySchema,
} from './cvs.schema';
import { cvsService } from './cvs.service';

type CvBase = {
  id: string;
  candidateName: string;
  candidateEmail: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  parseStatus: string;
  parseError: string | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

const serialize = (cv: CvBase) => ({
  ...cv,
  createdAt: cv.createdAt.toISOString(),
  updatedAt: cv.updatedAt.toISOString(),
});

const serializeDetail = (cv: CvBase & { extractedText: string }) => ({
  ...cv,
  createdAt: cv.createdAt.toISOString(),
  updatedAt: cv.updatedAt.toISOString(),
});

const cvsRoutes: FastifyPluginAsyncZod = async (app) => {
  // POST / — upload CV
  app.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CVs'],
        summary: 'Upload a CV (PDF or DOCX)',
        querystring: cvUploadQuerySchema,
        response: { 201: cvResponseSchema },
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) throw new AppError('No file uploaded', 400, 'NO_FILE');

      const buffer = await data.toBuffer();

      const cv = await cvsService.upload({
        buffer,
        filename: data.filename,
        mimetype: data.mimetype,
        filesize: buffer.length,
        candidateName: request.query.candidateName,
        candidateEmail: request.query.candidateEmail,
        uploadedBy: request.user.sub,
      });

      return reply.status(201).send(serialize(cv));
    },
  );

  // GET /
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CVs'],
        querystring: cvListQuerySchema,
        response: {
          200: z.object({
            data: z.array(cvResponseSchema),
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
      const result = await cvsService.list({
        ...request.query,
        userId: request.user.sub,
        role: request.user.role,
      });
      return reply.send({ data: result.data.map(serialize), meta: result.meta });
    },
  );

  // GET /:id — with extractedText
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CVs'],
        params: z.object({ id: z.string() }),
        response: { 200: cvDetailResponseSchema },
      },
    },
    async (request, reply) => {
      const cv = await cvsService.getById(
        request.params.id,
        request.user.sub,
        request.user.role,
      );
      return reply.send(serializeDetail(cv));
    },
  );

  // DELETE /:id
  app.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CVs'],
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await cvsService.delete(request.params.id, request.user.sub, request.user.role);
      return reply.status(204).send(null);
    },
  );
};

export default cvsRoutes;
