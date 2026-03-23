import { prisma } from '../../config/database.config';
import type { JdContext } from '../../services/scoring/nlp.service';
import { nlpScoringService } from '../../services/scoring/nlp.service';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { type Classification, classify, type CreateEvaluationDto } from './evaluations.schema';

export class EvaluationsService {
  // Single evaluation — synchronous per CLAUDE.md
  async evaluate(dto: CreateEvaluationDto, userId: string, role: string) {
    const [cv, jd] = await Promise.all([
      prisma.cV.findUnique({ where: { id: dto.cvId } }),
      prisma.jobDescription.findUnique({ where: { id: dto.jobDescriptionId } }),
    ]);

    if (!cv) throw new NotFoundError('CV');
    if (!jd) throw new NotFoundError('Job Description');
    if (!jd.isActive) throw new AppError('This job description is no longer active and cannot be used for evaluation.', 400, 'JD_INACTIVE');
    if (role !== 'ADMIN' && cv.uploadedBy !== userId) throw new ForbiddenError();
    if (role !== 'ADMIN' && jd.createdBy !== userId) throw new ForbiddenError();

    if (cv.parseStatus !== 'COMPLETED' || !cv.extractedText) {
      throw new AppError('This CV is still being processed. Please wait a moment and try again.', 400, 'CV_NOT_PARSED');
    }

    // Upsert: if evaluation exists, overwrite scores
    let evaluation = await prisma.evaluation.findUnique({
      where: { cvId_jobDescriptionId: { cvId: dto.cvId, jobDescriptionId: dto.jobDescriptionId } },
    });

    if (evaluation) {
      // Reset existing evaluation
      await prisma.score.deleteMany({ where: { evaluationId: evaluation.id } });
      evaluation = await prisma.evaluation.update({
        where: { id: evaluation.id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          completedAt: null,
          overallScore: null,
          recommendation: null,
          errorMessage: null,
          triggeredBy: userId,
        },
      });
    } else {
      evaluation = await prisma.evaluation.create({
        data: {
          cvId: dto.cvId,
          jobDescriptionId: dto.jobDescriptionId,
          status: 'PROCESSING',
          startedAt: new Date(),
          triggeredBy: userId,
        },
      });
    }

    try {
      const jdContext: JdContext = {
        content: jd.content,
        requiredSkills: jd.requiredSkills,
        preferredSkills: jd.preferredSkills,
        requiredExperienceYears: jd.requiredExperienceYears,
        requiredEducation: jd.requiredEducation,
        weightSkills: jd.weightSkills,
        weightExperience: jd.weightExperience,
        weightEducation: jd.weightEducation,
        weightAchievements: jd.weightAchievements,
        weightRelevance: jd.weightRelevance,
      };

      const result = await nlpScoringService.score(cv.extractedText, jdContext);

      // Persist scores + update evaluation
      await prisma.$transaction([
        prisma.score.createMany({
          data: result.categories.map((cat) => ({
            evaluationId: evaluation.id,
            category: cat.category as
              | 'SKILLS'
              | 'EXPERIENCE'
              | 'EDUCATION'
              | 'ACHIEVEMENTS'
              | 'RELEVANCE',
            rawScore: cat.rawScore,
            weight: cat.weight,
            weightedScore: cat.weightedScore,
            rationale: cat.rationale,
            evidence: cat.evidence,
            gaps: cat.gaps,
          })),
        }),
        prisma.evaluation.update({
          where: { id: evaluation.id },
          data: {
            status: 'COMPLETED',
            overallScore: result.overallScore,
            recommendation: result.recommendation,
            processingTimeMs: result.processingTimeMs,
            completedAt: new Date(),
          },
        }),
      ]);

      const completed = await prisma.evaluation.findUniqueOrThrow({
        where: { id: evaluation.id },
        include: {
          scores: true,
          cv: { select: { candidateName: true } },
          jobDescription: { select: { title: true } },
        },
      });
      return {
        ...completed,
        candidateName: completed.cv.candidateName,
        jdTitle: completed.jobDescription.title,
        classification: classify(completed.overallScore),
      };
    } catch (err) {
      await prisma.evaluation.update({
        where: { id: evaluation.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Scoring failed',
        },
      });
      throw err;
    }
  }

  async list(params: {
    page: number;
    limit: number;
    cvId?: string;
    jobDescriptionId?: string;
    status?: string;
    classification?: Classification;
    userId: string;
    role: string;
  }) {
    const { page, limit, cvId, jobDescriptionId, status, classification, userId, role } = params;
    const skip = (page - 1) * limit;

    // Map classification filter to score ranges
    const scoreFilter = classification === 'PASS'
      ? { overallScore: { gt: 70 } }
      : classification === 'WAITLIST'
        ? { overallScore: { gte: 40, lte: 70 } }
        : classification === 'FAIL'
          ? { overallScore: { lt: 40 } }
          : {};

    const where = {
      ...(role !== 'ADMIN' ? { cv: { uploadedBy: userId } } : {}),
      ...(cvId ? { cvId } : {}),
      ...(jobDescriptionId ? { jobDescriptionId } : {}),
      ...(status ? { status: status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' } : {}),
      ...scoreFilter,
    };

    const [data, total] = await Promise.all([
      prisma.evaluation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          scores: true,
          cv: { select: { candidateName: true } },
          jobDescription: { select: { title: true } },
        },
      }),
      prisma.evaluation.count({ where }),
    ]);

    return {
      data: data.map((ev) => ({
        ...ev,
        candidateName: ev.cv.candidateName,
        jdTitle: ev.jobDescription.title,
        classification: classify(ev.overallScore),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, role: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        scores: true,
        cv: { select: { uploadedBy: true, candidateName: true } },
        jobDescription: { select: { title: true } },
      },
    });
    if (!evaluation) throw new NotFoundError('Evaluation');
    if (role !== 'ADMIN' && evaluation.cv.uploadedBy !== userId) throw new ForbiddenError();
    return {
      ...evaluation,
      candidateName: evaluation.cv.candidateName,
      jdTitle: evaluation.jobDescription.title,
      classification: classify(evaluation.overallScore),
    };
  }

  async getStats(params: { jobDescriptionId?: string; userId: string; role: string }) {
    const { jobDescriptionId, userId, role } = params;

    const evaluations = await prisma.evaluation.findMany({
      where: {
        status: 'COMPLETED',
        overallScore: { not: null },
        ...(jobDescriptionId ? { jobDescriptionId } : {}),
        ...(role !== 'ADMIN' ? { cv: { uploadedBy: userId } } : {}),
      },
      select: {
        jobDescriptionId: true,
        overallScore: true,
        jobDescription: { select: { title: true } },
      },
    });

    // Group by JD and count classifications
    const groups = new Map<string, { jdTitle: string; pass: number; waitlist: number; fail: number }>();

    for (const ev of evaluations) {
      if (!groups.has(ev.jobDescriptionId)) {
        groups.set(ev.jobDescriptionId, {
          jdTitle: ev.jobDescription.title,
          pass: 0,
          waitlist: 0,
          fail: 0,
        });
      }
      const g = groups.get(ev.jobDescriptionId)!;
      const c = classify(ev.overallScore);
      if (c === 'PASS') g.pass++;
      else if (c === 'WAITLIST') g.waitlist++;
      else if (c === 'FAIL') g.fail++;
    }

    return Array.from(groups.entries()).map(([jdId, g]) => ({
      jobDescriptionId: jdId,
      jdTitle: g.jdTitle,
      total: g.pass + g.waitlist + g.fail,
      pass: g.pass,
      waitlist: g.waitlist,
      fail: g.fail,
    }));
  }
}

export const evaluationsService = new EvaluationsService();
