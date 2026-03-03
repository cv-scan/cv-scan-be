import { z } from 'zod';

export const createEvaluationSchema = z.object({
  cvId: z.string().min(1),
  jobDescriptionId: z.string().min(1),
});
export type CreateEvaluationDto = z.infer<typeof createEvaluationSchema>;

export const evaluationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cvId: z.string().optional(),
  jobDescriptionId: z.string().optional(),
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .optional(),
});

const scoreSchema = z.object({
  id: z.string(),
  category: z.string(),
  rawScore: z.number(),
  weight: z.number(),
  weightedScore: z.number(),
  rationale: z.string(),
  evidence: z.array(z.string()),
  gaps: z.array(z.string()),
});

export const evaluationResponseSchema = z.object({
  id: z.string(),
  cvId: z.string(),
  jobDescriptionId: z.string(),
  status: z.string(),
  overallScore: z.number().nullable(),
  recommendation: z.string().nullable(),
  scoringEngine: z.string(),
  processingTimeMs: z.number().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  scores: z.array(scoreSchema).optional(),
});
