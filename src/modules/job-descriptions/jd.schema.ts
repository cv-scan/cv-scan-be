import { z } from 'zod';

export const EmploymentTypeEnum = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERNSHIP',
  'FREELANCE',
]);
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

export const ExperienceLevelEnum = z.enum([
  'INTERN',
  'JUNIOR',
  'MID_LEVEL',
  'SENIOR',
  'LEAD',
  'MANAGER',
  'DIRECTOR',
]);
export type ExperienceLevel = z.infer<typeof ExperienceLevelEnum>;

const scoringWeightsSchema = z
  .object({
    skills: z.number().min(0).max(1).default(0.35),
    experience: z.number().min(0).max(1).default(0.3),
    education: z.number().min(0).max(1).default(0.15),
    achievements: z.number().min(0).max(1).default(0.1),
    relevance: z.number().min(0).max(1).default(0.1),
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
  departmentId: z.string().optional(),
  location: z.string().max(100).optional(),
  employmentTypes: z.array(EmploymentTypeEnum).optional().default([]),
  experienceLevel: ExperienceLevelEnum.optional(),
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
  departmentId: z.string().optional(),
});

export const jdStatsResponseSchema = z.object({
  jobDescriptionId: z.string(),
  total: z.number(),
  pass: z.number(),
  waitlist: z.number(),
  fail: z.number(),
});

export const uploadJdQuerySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    departmentId: z.string().optional(),
    employmentTypes: z
      .preprocess(
        (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()) : v),
        z.array(EmploymentTypeEnum),
      )
      .optional(),
    experienceLevel: ExperienceLevelEnum.optional(),
    // Scoring weights — all optional, must sum to 1.0 if any provided
    weightSkills: z.coerce.number().min(0).max(1).optional(),
    weightExperience: z.coerce.number().min(0).max(1).optional(),
    weightEducation: z.coerce.number().min(0).max(1).optional(),
    weightAchievements: z.coerce.number().min(0).max(1).optional(),
    weightRelevance: z.coerce.number().min(0).max(1).optional(),
  })
  .refine(
    (d) => {
      const weights = [d.weightSkills, d.weightExperience, d.weightEducation, d.weightAchievements, d.weightRelevance];
      if (weights.every((w) => w === undefined)) return true;
      const sum = weights.reduce<number>((acc, w) => acc + (w ?? 0), 0);
      return Math.abs(sum - 1.0) < 0.001;
    },
    { message: 'Scoring weights must sum to 1.0' },
  );
export type UploadJdQueryDto = z.infer<typeof uploadJdQuerySchema>;

const departmentShape = z.object({ id: z.string(), name: z.string() }).nullable();

export const jdResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  fileUrl: z.string().nullable(),
  departmentId: z.string().nullable(),
  department: departmentShape,
  location: z.string().nullable(),
  employmentTypes: z.array(EmploymentTypeEnum),
  experienceLevel: ExperienceLevelEnum.nullable(),
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
  cvCount: z.number(),
});
