import { prisma } from '../../config/database.config';
import { AppError, NotFoundError } from '../../utils/errors';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './departments.schema';

export class DepartmentsService {
  async create(dto: CreateDepartmentDto) {
    const existing = await prisma.department.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new AppError(`Department "${dto.name}" already exists`, 409, 'DEPARTMENT_EXISTS');
    }
    return prisma.department.create({ data: dto });
  }

  async list(params: { page: number; limit: number; search?: string; isActive?: boolean }) {
    const { page, limit, search, isActive } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.department.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.department.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundError('Department');
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.getById(id);

    if (dto.name) {
      const existing = await prisma.department.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new AppError(`Department "${dto.name}" already exists`, 409, 'DEPARTMENT_EXISTS');
      }
    }

    return prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.getById(id);

    const jdCount = await prisma.jobDescription.count({ where: { departmentId: id } });
    if (jdCount > 0) {
      throw new AppError(
        'Cannot delete this department because it is linked to Job Descriptions.',
        409,
        'DEPARTMENT_IN_USE',
      );
    }

    return prisma.department.delete({ where: { id } });
  }
}

export const departmentsService = new DepartmentsService();
