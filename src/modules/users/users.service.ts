import { prisma } from '../../config/database.config';
import { NotFoundError } from '../../utils/errors';
import type { UpdateUserDto } from './users.schema';

export class UsersService {
  async list(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    isActive?: boolean;
  }) {
    const { page, limit, search, role, isActive } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(role ? { role: role as 'ADMIN' | 'RECRUITER' | 'VIEWER' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.getById(id);
    return prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}

export const usersService = new UsersService();
