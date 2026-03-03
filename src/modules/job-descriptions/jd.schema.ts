import { z } from 'zod';

const scoringWeightsSchema = z
  .object({
    skills: z.number().min(0).max(1).default(0.35),
    experience: z.number().min(0).max(1).default(0.30),
    education: z.number().min(0).max(1).default(0.15),
    achievements: z.number().min(0).max(1).default(0.10),
    relevance: z.number().min(0).max(1).default(0.10),
  })
  .refine(
    (w) => {
      const sum = w.skills + w.experience + w.education + w.achievements + w.relevance;
      return Math.abs(sum - 1.0) < 0.001;
    },
    { message: 'Scoring weights must sum to 1.0' },
  )
  .optional();

export const createJdSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  department: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  employmentType: z.string().max(50).optional(),
  experienceLevel: z.string().max(50).optional(),
  requiredExperienceYears: z.number().int().min(0).max(50).optional(),
  requiredEducation: z.string().max(100).optional(),
  scoringWeights: scoringWeightsSchema,
});
export type CreateJdDto = z.infer<typeof createJdSchema>;

export const updateJdSchema = createJdSchema.partial();
export type UpdateJdDto = z.infer<typeof updateJdSchema>;

export const jdListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const jdResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  department: z.string().nullable(),
  location: z.string().nullable(),
  employmentType: z.string().nullable(),
  experienceLevel: z.string().nullable(),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  requiredExperienceYears: z.number().nullable(),
  requiredEducation: z.string().nullable(),
  weightSkills: z.number(),
  weightExperience: z.number(),
  weightEducation: z.number(),
  weightAchievements: z.number(),
  weightRelevance: z.number(),
  isActive: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
