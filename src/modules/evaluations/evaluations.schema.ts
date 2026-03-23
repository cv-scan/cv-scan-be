import { z } from 'zod';

export const CLASSIFICATION_THRESHOLDS = {
  PASS: 70,
  FAIL: 40,
} as const;

export type Classification = 'PASS' | 'WAITLIST' | 'FAIL';

export function classify(score: number | null): Classification | null {
  if (score === null) return null;
  if (score > CLASSIFICATION_THRESHOLDS.PASS) return 'PASS';
  if (score >= CLASSIFICATION_THRESHOLDS.FAIL) return 'WAITLIST';
  return 'FAIL';
}

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
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  classification: z.enum(['PASS', 'WAITLIST', 'FAIL']).optional(),
});

export const evaluationStatsQuerySchema = z.object({
  jobDescriptionId: z.string().optional(),
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
  candidateName: z.string().nullable(),
  jdTitle: z.string().nullable(),
  status: z.string(),
  overallScore: z.number().nullable(),
  classification: z.enum(['PASS', 'WAITLIST', 'FAIL']).nullable(),
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

export const jdStatsSchema = z.object({
  jobDescriptionId: z.string(),
  jdTitle: z.string(),
  total: z.number(),
  pass: z.number(),
  waitlist: z.number(),
  fail: z.number(),
});
