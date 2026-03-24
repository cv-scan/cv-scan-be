import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../../config/database.config';
import { isAllowedMimeType, parseFile } from '../../services/parser';
import { getStorage } from '../../services/storage';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { extractJdMetadata, extractSkillsFromJD } from './jd.extractor';
import type { CreateJdDto, UpdateJdDto, UploadJdQueryDto } from './jd.schema';

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
        weightExperience: weights?.experience ?? 0.3,
        weightEducation: weights?.education ?? 0.15,
        weightAchievements: weights?.achievements ?? 0.1,
        weightRelevance: weights?.relevance ?? 0.1,
        createdBy: userId,
      },
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

    return prisma.jobDescription.create({
      data: {
        title,
        content,
        fileUrl,
        department: metadata.department,
        location: metadata.location,
        employmentType: metadata.employmentType,
        experienceLevel: metadata.experienceLevel,
        requiredExperienceYears: metadata.requiredExperienceYears,
        requiredEducation: metadata.requiredEducation,
        requiredSkills: metadata.requiredSkills,
        preferredSkills: metadata.preferredSkills,
        weightSkills: 0.35,
        weightExperience: 0.3,
        weightEducation: 0.15,
        weightAchievements: 0.1,
        weightRelevance: 0.1,
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
        include: {
          _count: {
            select: { evaluations: { where: { status: 'COMPLETED' } } },
          },
        },
      }),
      prisma.jobDescription.count({ where }),
    ]);

    return {
      data: data.map((jd) => ({ ...jd, cvCount: jd._count.evaluations })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, role: string) {
    const jd = await prisma.jobDescription.findUnique({
      where: { id },
      include: {
        _count: { select: { evaluations: { where: { status: 'COMPLETED' } } } },
      },
    });
    if (!jd) throw new NotFoundError('Job Description');
    if (role !== 'ADMIN' && jd.createdBy !== userId) throw new ForbiddenError();
    return { ...jd, cvCount: jd._count.evaluations };
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

    const updated = await prisma.jobDescription.update({
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
      include: {
        _count: { select: { evaluations: { where: { status: 'COMPLETED' } } } },
      },
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
      include: {
        _count: { select: { evaluations: { where: { status: 'COMPLETED' } } } },
      },
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
