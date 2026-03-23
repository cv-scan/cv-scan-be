import { prisma } from "../../config/database.config";
import { AppError, NotFoundError } from "../../utils/errors";
import type { CreateBatchDto } from "./batches.schema";

// Set after server initializes queues (avoid circular imports)
type QueueFactory = () => import("bullmq").Queue<
  { batchId: string },
  unknown,
  string
>;
let getBatchQueue: QueueFactory | null = null;

export function setBatchQueueFactory(factory: QueueFactory) {
  getBatchQueue = factory;
}

export class BatchesService {
  async create(dto: CreateBatchDto, userId: string) {
    const jd = await prisma.jobDescription.findUnique({
      where: { id: dto.jobDescriptionId },
    });
    if (!jd) throw new NotFoundError("Job Description");
    if (!jd.isActive)
      throw new AppError(
        "This job description is no longer active and cannot be used for batch evaluation.",
        400,
        "JD_INACTIVE",
      );

    // Validate all CVs exist
    const cvs = await prisma.cV.findMany({
      where: { id: { in: dto.cvIds } },
      select: { id: true, parseStatus: true },
    });
    if (cvs.length !== dto.cvIds.length) {
      throw new AppError(
        "Some CVs in your selection could not be found. Please verify the IDs and try again.",
        400,
        "CVS_NOT_FOUND",
      );
    }

    const batch = await prisma.batch.create({
      data: {
        name: dto.name,
        jobDescriptionId: dto.jobDescriptionId,
        totalCount: dto.cvIds.length,
        createdBy: userId,
        items: {
          create: dto.cvIds.map((cvId) => ({ cvId })),
        },
      },
      include: { items: true },
    });

    // Enqueue batch job
    if (getBatchQueue) {
      const queue = getBatchQueue();
      const job = await queue.add(
        "process-batch",
        { batchId: batch.id },
        { jobId: `batch-${batch.id}` },
      );

      await prisma.batch.update({
        where: { id: batch.id },
        data: { queueJobId: job.id ?? null },
      });
    }

    return batch;
  }

  async list(params: {
    page: number;
    limit: number;
    status?: string;
    userId: string;
  }) {
    const { page, limit, status, userId } = params;
    const skip = (page - 1) * limit;

    const where = {
      createdBy: userId,
      ...(status
        ? {
            status: status as
              | "PENDING"
              | "PROCESSING"
              | "COMPLETED"
              | "PARTIALLY_FAILED"
              | "FAILED"
              | "CANCELLED",
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.batch.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, role: string) {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        items: {
          select: { id: true, cvId: true, status: true, queueJobId: true },
        },
      },
    });
    if (!batch) throw new NotFoundError("Batch");
    if (role !== "ADMIN" && batch.createdBy !== userId) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }
    return batch;
  }

  async cancel(id: string, userId: string, role: string) {
    const batch = await this.getById(id, userId, role);
    if (!["PENDING", "PROCESSING"].includes(batch.status)) {
      throw new AppError(
        "Only PENDING or PROCESSING batches can be cancelled",
        400,
        "INVALID_STATUS",
      );
    }
    return prisma.batch.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }
}

export const batchesService = new BatchesService();
