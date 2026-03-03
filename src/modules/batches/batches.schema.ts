import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().max(200).optional(),
  jobDescriptionId: z.string().min(1),
  cvIds: z.array(z.string()).min(1).max(500),
});
export type CreateBatchDto = z.infer<typeof createBatchSchema>;

export const batchListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED'])
    .optional(),
});

export const batchItemSchema = z.object({
  id: z.string(),
  cvId: z.string(),
  status: z.string(),
  queueJobId: z.string().nullable(),
});

export const batchResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  jobDescriptionId: z.string(),
  status: z.string(),
  totalCount: z.number(),
  completedCount: z.number(),
  failedCount: z.number(),
  queueJobId: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  updatedAt: z.string(),
  items: z.array(batchItemSchema).optional(),
});
