import crypto from 'crypto';
import { authenticator } from 'otplib';
import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { SecurityService } from './security.service';

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;

authenticator.options = { window: 1 };

export class MfaService {
  static generateSecret(): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri('user@the-pigsty.org', 'The Pigsty', secret);
    return { secret, otpauthUrl };
  }

  static verifyCode(secret: string, code: string): boolean {
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) return false;
    return authenticator.verify({ token: digits, secret });
  }

  static async enableMfa(userId: string, secret: string, code: string, ip?: string): Promise<void> {
    if (!this.verifyCode(secret, code)) {
      throw new AppError('Invalid authenticator code', 400);
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: true },
      select: { email: true },
    });
    await SecurityService.log({
      type: 'MFA_ENABLED',
      severity: 'LOW',
      userId,
      email: user.email,
      ip,
      details: 'Two-factor authentication enabled',
    });
  }

  static async disableMfa(userId: string, code: string, ip?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true, email: true },
    });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new AppError('MFA is not enabled', 400);
    }
    if (!this.verifyCode(user.mfaSecret, code)) {
      await SecurityService.log({
        type: 'MFA_FAILED',
        severity: 'MEDIUM',
        userId,
        email: user.email,
        ip,
        details: 'Failed MFA disable attempt',
      });
      throw new AppError('Invalid authenticator code', 400);
    }
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabled: false },
    });
    await SecurityService.log({
      type: 'MFA_DISABLED',
      severity: 'MEDIUM',
      userId,
      email: user.email,
      ip,
      details: 'Two-factor authentication disabled',
    });
  }

  static async createChallenge(userId: string): Promise<string> {
    await prisma.refreshToken.deleteMany({
      where: { userId, token: { startsWith: 'mfachal_' } },
    });
    const challenge = `mfachal_${crypto.randomBytes(32).toString('hex')}`;
    await prisma.refreshToken.create({
      data: {
        token: challenge,
        userId,
        expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
      },
    });
    return challenge;
  }

  static async verifyChallenge(
    challenge: string,
    code: string,
    ip?: string,
  ): Promise<{ userId: string }> {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: challenge },
      include: { user: { select: { id: true, mfaSecret: true, mfaEnabled: true, email: true } } },
    });

    if (!stored || !challenge.startsWith('mfachal_') || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new AppError('MFA session expired. Sign in again.', 401);
    }

    if (!stored.user.mfaEnabled || !stored.user.mfaSecret) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new AppError('MFA is not enabled for this account', 400);
    }

    if (!this.verifyCode(stored.user.mfaSecret, code)) {
      await SecurityService.log({
        type: 'MFA_FAILED',
        severity: 'MEDIUM',
        userId: stored.user.id,
        email: stored.user.email,
        ip,
        details: 'Invalid TOTP during login',
      });
      const locked = await SecurityService.maybeLockLogin(stored.user.id, stored.user.email, ip);
      if (locked) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
        throw new AppError('Too many failed attempts. Try again in an hour.', 429);
      }
      throw new AppError('Invalid authenticator code', 401);
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });
    return { userId: stored.user.id };
  }
}
