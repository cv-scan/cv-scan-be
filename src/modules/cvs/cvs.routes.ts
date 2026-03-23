import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { AppError } from '../../utils/errors';
import {
  cvBulkUploadResponseSchema,
  cvDetailResponseSchema,
  cvListQuerySchema,
  cvResponseSchema,
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
  // POST / — upload one or more CVs (no extra info required)
  app.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CVs'],
        summary: 'Upload one or more CVs (PDF or DOCX). Candidate name is extracted from filename.',
        response: { 201: cvBulkUploadResponseSchema },
      },
    },
    async (request, reply) => {
      const parts = request.files();
      const uploaded: ReturnType<typeof serialize>[] = [];
      const failed: { filename: string; reason: string }[] = [];

      for await (const part of parts) {
        const buffer = await part.toBuffer();
        try {
          const cv = await cvsService.upload({
            buffer,
            filename: part.filename,
            mimetype: part.mimetype,
            filesize: buffer.length,
            uploadedBy: request.user.sub,
          });
          uploaded.push(serialize(cv));
        } catch (err) {
          failed.push({
            filename: part.filename,
            reason: err instanceof Error ? err.message : 'Upload failed',
          });
        }
      }

      if (uploaded.length === 0 && failed.length === 0) {
        throw new AppError('No file attached. Please include at least one PDF or DOCX file.', 400, 'NO_FILE');
      }

      return reply.status(201).send({ data: uploaded, failed });
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
