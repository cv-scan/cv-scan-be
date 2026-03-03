import { prisma } from '../../config/database.config';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { extractSkillsFromJD } from './jd.extractor';
import type { CreateJdDto, UpdateJdDto } from './jd.schema';

export class JdService {
  async create(dto: CreateJdDto, userId: string) {
    const { requiredSkills, preferredSkills } = extractSkillsFromJD(dto.content);

    const weights = dto.scoringWeights;

    return prisma.jobDescription.create({
      data: {
        title: dto.title,
        content: dto.content,
        department: dto.department,
        location: dto.location,
        employmentType: dto.employmentType,
        experienceLevel: dto.experienceLevel,
        requiredExperienceYears: dto.requiredExperienceYears,
        requiredEducation: dto.requiredEducation,
        requiredSkills,
        preferredSkills,
        weightSkills: weights?.skills ?? 0.35,
        weightExperience: weights?.experience ?? 0.30,
        weightEducation: weights?.education ?? 0.15,
        weightAchievements: weights?.achievements ?? 0.10,
        weightRelevance: weights?.relevance ?? 0.10,
        createdBy: userId,
      },
    });
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
    userId: string;
    role: string;
  }) {
    const { page, limit, search, isActive, userId, role } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(role !== 'ADMIN' ? { createdBy: userId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { department: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.jobDescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobDescription.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id: string, userId: string, role: string) {
    const jd = await prisma.jobDescription.findUnique({ where: { id } });
    if (!jd) throw new NotFoundError('Job Description');
    if (role !== 'ADMIN' && jd.createdBy !== userId) throw new ForbiddenError();
    return jd;
  }

  async update(id: string, dto: UpdateJdDto, userId: string, role: string) {
    const jd = await this.getById(id, userId, role);

    // Re-extract skills if content changed
    let requiredSkills = jd.requiredSkills;
    let preferredSkills = jd.preferredSkills;
    if (dto.content) {
      const extracted = extractSkillsFromJD(dto.content);
      requiredSkills = extracted.requiredSkills;
      preferredSkills = extracted.preferredSkills;
    }

    const weights = dto.scoringWeights;

    return prisma.jobDescription.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.employmentType !== undefined && { employmentType: dto.employmentType }),
        ...(dto.experienceLevel !== undefined && { experienceLevel: dto.experienceLevel }),
        ...(dto.requiredExperienceYears !== undefined && {
          requiredExperienceYears: dto.requiredExperienceYears,
        }),
        ...(dto.requiredEducation !== undefined && { requiredEducation: dto.requiredEducation }),
        requiredSkills,
        preferredSkills,
        ...(weights && {
          weightSkills: weights.skills,
          weightExperience: weights.experience,
          weightEducation: weights.education,
          weightAchievements: weights.achievements,
          weightRelevance: weights.relevance,
        }),
      },
    });
  }

  async softDelete(id: string, userId: string, role: string) {
    await this.getById(id, userId, role);
    return prisma.jobDescription.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const jdService = new JdService();
