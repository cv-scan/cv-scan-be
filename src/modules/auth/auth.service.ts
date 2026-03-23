import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.config';
import { env } from '../../config/env';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import type { LoginDto, RegisterDto } from './auth.schema';

export type SignJwt = (payload: { sub: string; email: string; role: string }) => string;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export class AuthService {
  async register(
    dto: RegisterDto,
    signJwt: SignJwt,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, env.BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role, signJwt);

    return { user: this.toAuthUser(user), tokens };
  }

  async login(
    dto: LoginDto,
    signJwt: SignJwt,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role, signJwt);
    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(
    refreshToken: string,
    signJwt: SignJwt,
  ): Promise<AuthTokens> {
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Your session has expired. Please log in again.');
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Your account is inactive. Please contact support.');
    }

    // Rotate refresh token
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.email, user.role, signJwt);
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');
    return this.toAuthUser(user);
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    signJwt: SignJwt,
  ): Promise<AuthTokens> {
    const accessToken = signJwt({ sub: userId, email, role });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshExpiresIn = this.parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN);

    await prisma.refreshToken.create({
      data: {
        token: rawRefreshToken,
        userId,
        expiresAt: new Date(Date.now() + refreshExpiresIn),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.parseExpiresIn(env.JWT_ACCESS_EXPIRES_IN) / 1000,
    };
  }

  private parseExpiresIn(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return num * (multipliers[unit] ?? 1000);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
