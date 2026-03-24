import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../../config/database.config';
import { env } from '../../config/env';
import { isAllowedMimeType, parseFile } from '../../services/parser';
import { getStorage } from '../../services/storage';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors';

function extractNameFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  const cleaned = base
    .replace(/^(cv|resume|curriculum.?vitae)[-_\s]*/i, '')
    .replace(/[-_\s]*(cv|resume|curriculum.?vitae|application)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  const name = cleaned || base.replace(/[-_]+/g, ' ').trim() || 'Unknown';
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export class CvsService {
  async upload(params: {
    buffer: Buffer;
    filename: string;
    mimetype: string;
    filesize: number;
    uploadedBy: string;
  }) {
    const { buffer, filename, mimetype, filesize, uploadedBy } = params;

    const maxBytes = 10 * 1024 * 1024;
    if (filesize > maxBytes) {
      throw new AppError('File is too large. Maximum allowed size is 10MB.', 400, 'FILE_TOO_LARGE');
    }

    if (!isAllowedMimeType(mimetype)) {
      throw new AppError(
        'Unsupported file type. Please upload a PDF or DOCX file.',
        400,
        'UNSUPPORTED_FILE_TYPE',
      );
    }

    const candidateName = extractNameFromFilename(filename);
    const ext = path.extname(filename);
    const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;

    const storage = getStorage();
    const storagePath = await storage.save(uniqueName, buffer, mimetype);

    let extractedText = '';
    let parseStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';
    let parseError: string | null = null;

    try {
      extractedText = await parseFile(buffer, mimetype);
    } catch (err) {
      parseStatus = 'FAILED';
      parseError = err instanceof Error ? err.message : 'Parse failed';
    }

    return prisma.cV.create({
      data: {
        candidateName,
        candidateEmail: null,
        fileName: filename,
        fileType: mimetype,
        fileSize: filesize,
        storagePath,
        storageProvider: env.STORAGE_PROVIDER,
        extractedText,
        extractedAt: parseStatus === 'COMPLETED' ? new Date() : null,
        parseStatus,
        parseError,
        uploadedBy,
      },
    });
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    parseStatus?: string;
    userId: string;
    role: string;
  }) {
    const { page, limit, search, parseStatus, userId, role } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(role !== 'ADMIN' ? { uploadedBy: userId } : {}),
      ...(parseStatus
        ? {
            parseStatus: parseStatus as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                candidateName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                candidateEmail: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              { fileName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.cV.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          candidateName: true,
          candidateEmail: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          storagePath: true,
          parseStatus: true,
          parseError: true,
          uploadedBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.cV.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, role: string) {
    const cv = await prisma.cV.findUnique({ where: { id } });
    if (!cv) throw new NotFoundError('CV');
    if (role !== 'ADMIN' && cv.uploadedBy !== userId) throw new ForbiddenError();
    return cv;
  }

  async getPublicViewById(id: string) {
    const cv = await prisma.cV.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        storagePath: true,
        storageProvider: true,
      },
    });
    if (!cv) throw new NotFoundError('CV');
    return cv;
  }

  async delete(id: string, userId: string, role: string) {
    const cv = await this.getById(id, userId, role);

    const evaluationCount = await prisma.evaluation.count({ where: { cvId: id } });
    if (evaluationCount > 0) {
      throw new AppError(
        'Cannot delete this CV because it has been used in evaluations.',
        409,
        'CV_IN_USE',
      );
    }

    // Delete from storage first (CLAUDE.md rule)
    const storage = getStorage();
    await storage.delete(cv.storagePath);

    await prisma.cV.delete({ where: { id } });
  }
}

export const cvsService = new CvsService();
