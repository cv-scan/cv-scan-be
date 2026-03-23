import { z } from 'zod';

export const cvListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  parseStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
});

export const cvResponseSchema = z.object({
  id: z.string(),
  candidateName: z.string(),
  candidateEmail: z.string().nullable(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  parseStatus: z.string(),
  parseError: z.string().nullable(),
  uploadedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const cvDetailResponseSchema = cvResponseSchema.extend({
  extractedText: z.string(),
});

export const cvBulkUploadResponseSchema = z.object({
  data: z.array(cvResponseSchema),
  failed: z.array(
    z.object({
      filename: z.string(),
      reason: z.string(),
    }),
  ),
});
