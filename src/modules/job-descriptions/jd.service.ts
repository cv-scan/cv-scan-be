import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../../config/database.config';
import { isAllowedMimeType, parseFile } from '../../services/parser';
import { getStorage } from '../../services/storage';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { extractJdMetadata, extractSkillsFromJD, inferScoringWeights } from './jd.extractor';
import type { CreateJdDto, UpdateJdDto, UploadJdQueryDto } from './jd.schema';

const includeJd = {
  department: { select: { id: true, name: true } },
  _count: { select: { evaluations: { where: { status: 'COMPLETED' as const } } } },
} as const;

export class JdService {
  async create(dto: CreateJdDto, userId: string) {
    const { requiredSkills, preferredSkills } = extractSkillsFromJD(dto.content);
    const weights = dto.scoringWeights;

    return prisma.jobDescription.create({
      data: {
        title: dto.title,
        content: dto.content,
        departmentId: dto.departmentId,
        location: dto.location,
        employmentTypes: dto.employmentTypes ?? [],
        experienceLevel: dto.experienceLevel,
        requiredExperienceYears: dto.requiredExperienceYears,
        requiredEducation: dto.requiredEducation,
        requiredSkills,
        preferredSkills,
        weightSkills: weights?.skills ?? 0.35,
        weightExperience: weights?.experience ?? 0.3,
        weightEducation: weights?.education ?? 0.15,
        weightAchievements: weights?.achievements ?? 0.1,
        weightRelevance: weights?.relevance ?? 0.1,
        createdBy: userId,
      },
      include: includeJd,
    });
  }

  async uploadFromFile(
    buffer: Buffer,
    mimetype: string,
    filename: string,
    query: UploadJdQueryDto,
    userId: string,
  ) {
    if (!isAllowedMimeType(mimetype)) {
      throw new AppError(
        'Unsupported file type. Please upload a PDF or DOCX file.',
        400,
        'UNSUPPORTED_FILE_TYPE',
      );
    }

    const content = await parseFile(buffer, mimetype);
    const metadata = extractJdMetadata(content);
    const title = query.title ?? metadata.title;

    if (!title) {
      throw new AppError(
        'Could not extract a title from the file. Please provide a title via the ?title= query parameter.',
        400,
        'TITLE_REQUIRED',
      );
    }

    const ext = path.extname(filename);
    const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const storage = getStorage();
    const fileUrl = await storage.save(uniqueName, buffer, mimetype);

    const inferred = inferScoringWeights(metadata);

    // Auto-lookup or create department from extracted name if no departmentId provided
    let departmentId = query.departmentId;
    if (!departmentId && metadata.department) {
      const dept = await prisma.department.upsert({
        where: { name: metadata.department },
        create: { name: metadata.department },
        update: {},
        select: { id: true },
      });
      departmentId = dept.id;
    }

    return prisma.jobDescription.create({
      data: {
        title,
        content,
        fileUrl,
        departmentId,
        location: metadata.location,
        employmentTypes: query.employmentTypes ?? metadata.employmentTypes,
        experienceLevel: query.experienceLevel ?? metadata.experienceLevel,
        requiredExperienceYears: metadata.requiredExperienceYears,
        requiredEducation: metadata.requiredEducation,
        requiredSkills: metadata.requiredSkills,
        preferredSkills: metadata.preferredSkills,
        weightSkills: query.weightSkills ?? inferred.skills,
        weightExperience: query.weightExperience ?? inferred.experience,
        weightEducation: query.weightEducation ?? inferred.education,
        weightAchievements: query.weightAchievements ?? inferred.achievements,
        weightRelevance: query.weightRelevance ?? inferred.relevance,
        createdBy: userId,
      },
      include: includeJd,
    });
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
    departmentId?: string;
    userId: string;
    role: string;
  }) {
    const { page, limit, search, isActive, departmentId, userId, role } = params;
    const skip = (page - 1) * limit;

    const where = {
      isActive: isActive ?? true,
      ...(role !== 'ADMIN' ? { createdBy: userId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { department: { name: { contains: search, mode: 'insensitive' as const } } },
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
        include: includeJd,
      }),
      prisma.jobDescription.count({ where }),
    ]);

    return {
      data: data.map((jd) => ({ ...jd, cvCount: jd._count.evaluations })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, role: string) {
    const jd = await prisma.jobDescription.findFirst({
      where: { id, isActive: true },
      include: includeJd,
    });
    if (!jd) throw new NotFoundError('Job Description');
    if (role !== 'ADMIN' && jd.createdBy !== userId) throw new ForbiddenError();
    return { ...jd, cvCount: jd._count.evaluations };
  }

  async update(id: string, dto: UpdateJdDto, userId: string, role: string) {
    const jd = await this.getById(id, userId, role);

    let requiredSkills = jd.requiredSkills;
    let preferredSkills = jd.preferredSkills;
    if (dto.content) {
      const extracted = extractSkillsFromJD(dto.content);
      requiredSkills = extracted.requiredSkills;
      preferredSkills = extracted.preferredSkills;
    }

    const weights = dto.scoringWeights;

    const updated = await prisma.jobDescription.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.employmentTypes !== undefined && { employmentTypes: dto.employmentTypes }),
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
      include: includeJd,
    });
    return { ...updated, cvCount: updated._count.evaluations };
  }

  async softDelete(id: string, userId: string, role: string) {
    await this.getById(id, userId, role);

    const evaluationCount = await prisma.evaluation.count({ where: { jobDescriptionId: id } });
    if (evaluationCount > 0) {
      throw new AppError(
        'Cannot delete this Job Description because it has been used in evaluations.',
        409,
        'JD_IN_USE',
      );
    }

    const deleted = await prisma.jobDescription.update({
      where: { id },
      data: { isActive: false },
      include: includeJd,
    });
    return { ...deleted, cvCount: deleted._count.evaluations };
  }

  async getStats(id: string, userId: string, role: string) {
    await this.getById(id, userId, role);

    const [total, pass, waitlist, fail] = await Promise.all([
      prisma.evaluation.count({ where: { jobDescriptionId: id, status: 'COMPLETED' } }),
      prisma.evaluation.count({ where: { jobDescriptionId: id, status: 'COMPLETED', classification: 'PASS' } }),
      prisma.evaluation.count({ where: { jobDescriptionId: id, status: 'COMPLETED', classification: 'WAITLIST' } }),
      prisma.evaluation.count({ where: { jobDescriptionId: id, status: 'COMPLETED', classification: 'FAIL' } }),
    ]);

    return { jobDescriptionId: id, total, pass, waitlist, fail };
  }
}

export const jdService = new JdService();
