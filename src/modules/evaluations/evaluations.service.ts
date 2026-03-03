import { prisma } from '../../config/database.config';
import type { JdContext } from '../../services/scoring/nlp.service';
import { nlpScoringService } from '../../services/scoring/nlp.service';
import { AppError, NotFoundError } from '../../utils/errors';
import type { CreateEvaluationDto } from './evaluations.schema';

export class EvaluationsService {
  // Single evaluation — synchronous per CLAUDE.md
  async evaluate(dto: CreateEvaluationDto, triggeredBy: string) {
    const [cv, jd] = await Promise.all([
      prisma.cV.findUnique({ where: { id: dto.cvId } }),
      prisma.jobDescription.findUnique({ where: { id: dto.jobDescriptionId } }),
    ]);

    if (!cv) throw new NotFoundError('CV');
    if (!jd) throw new NotFoundError('Job Description');
    if (!jd.isActive) throw new AppError('Job Description is inactive', 400, 'JD_INACTIVE');

    if (cv.parseStatus !== 'COMPLETED' || !cv.extractedText) {
      throw new AppError('CV has not been parsed yet', 400, 'CV_NOT_PARSED');
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
          triggeredBy,
        },
      });
    } else {
      evaluation = await prisma.evaluation.create({
        data: {
          cvId: dto.cvId,
          jobDescriptionId: dto.jobDescriptionId,
          status: 'PROCESSING',
          startedAt: new Date(),
          triggeredBy,
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

      return prisma.evaluation.findUniqueOrThrow({
        where: { id: evaluation.id },
        include: { scores: true },
      });
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
  }) {
    const { page, limit, cvId, jobDescriptionId, status } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(cvId ? { cvId } : {}),
      ...(jobDescriptionId ? { jobDescriptionId } : {}),
      ...(status ? { status: status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.evaluation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { scores: true },
      }),
      prisma.evaluation.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: { scores: true },
    });
    if (!evaluation) throw new NotFoundError('Evaluation');
    return evaluation;
  }
}

export const evaluationsService = new EvaluationsService();
