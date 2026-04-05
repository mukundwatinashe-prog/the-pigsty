import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

export class AuthService {
  static async register(name: string, email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already registered', 400);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, email: true, name: true, phone: true, photo: true, createdAt: true },
    });

    const tokens = await this.generateTokens(user.id);
    return { user, ...tokens };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new AppError('Invalid email or password', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const tokens = await this.generateTokens(user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  static async googleAuth(googleId: string, email: string, name: string, photo?: string) {
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, photo: photo || user.photo },
        });
      } else {
        user = await prisma.user.create({
          data: { email, name, googleId, photo },
        });
      }
    }

    const tokens = await this.generateTokens(user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  static async revokeRefreshToken(token: string | undefined) {
    if (!token) return;
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  static async refreshToken(token: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new AppError('Invalid or expired refresh token', 401);
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await this.generateTokens(stored.userId);
    return tokens;
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, phone: true, photo: true,
        mfaEnabled: true, createdAt: true,
        farmMemberships: {
          include: { farm: { select: { id: true, name: true, country: true } } },
        },
      },
    });
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  static async updateProfile(
    userId: string,
    data: { name?: string; phone?: string | null; photo?: string | null },
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, phone: true, photo: true, createdAt: true },
    });
    return user;
  }

  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return; // Don't reveal whether email exists

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash = await bcrypt.hash(resetToken, 10);

    await prisma.refreshToken.create({
      data: {
        token: `reset_${resetHash}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // In production, send email with reset link containing resetToken (never log the token).
    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string) {
    const records = await prisma.refreshToken.findMany({
      where: {
        token: { startsWith: 'reset_' },
        expiresAt: { gt: new Date() },
      },
    });

    let matchedRecord = null;
    for (const record of records) {
      const hash = record.token.replace('reset_', '');
      const valid = await bcrypt.compare(token, hash);
      if (valid) {
        matchedRecord = record;
        break;
      }
    }

    if (!matchedRecord) throw new AppError('Invalid or expired reset token', 400);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: matchedRecord.userId },
      data: { passwordHash },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: matchedRecord.userId } });
  }

  private static async generateTokens(userId: string) {
    const accessToken = jwt.sign({ userId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as string,
    } as jwt.SignOptions);

    const refreshTokenValue = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { token: refreshTokenValue, userId, expiresAt },
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }
}
