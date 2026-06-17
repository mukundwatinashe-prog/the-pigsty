import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { normalizePhone } from '../lib/phone';
import { notifyNewUserSignup } from './signupNotify.service';
import { sendPasswordResetCodeEmail, sendPasswordResetCodeSms } from './passwordResetDelivery.service';
import { sendUserEmail } from './email/emailSender';
import { welcomeEmail } from './email/templates';
import { MfaService } from './mfa.service';
import { isPlatformAdminEmail, SecurityService } from './security.service';

const RESET_CODE_LENGTH = 8;
export const RESET_CODE_EXPIRY_MS = 5 * 60 * 1000;
export const RESET_CODE_EXPIRY_SECONDS = RESET_CODE_EXPIRY_MS / 1000;

function generateResetCode(): string {
  return String(crypto.randomInt(10 ** (RESET_CODE_LENGTH - 1), 10 ** RESET_CODE_LENGTH));
}

export type AuthResult =
  | { user: Record<string, unknown>; accessToken: string; refreshToken: string }
  | { mfaRequired: true; mfaChallenge: string };

export class AuthService {
  static async register(name: string, email: string, password: string, phone: string) {
    const emailNorm = email.trim().toLowerCase();
    const phoneNormalized = normalizePhone(phone);
    if (!phoneNormalized) {
      throw new AppError('Enter a valid phone number (8–15 digits, include country code if needed)', 400);
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existingEmail) throw new AppError('Email already registered', 400);

    const existingPhone = await prisma.user.findUnique({ where: { phoneNormalized } });
    if (existingPhone) throw new AppError('Phone number already registered', 400);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: emailNorm,
        passwordHash,
        phone: phone.trim(),
        phoneNormalized,
      },
      select: { id: true, email: true, name: true, phone: true, photo: true, mfaEnabled: true, createdAt: true },
    });

    void notifyNewUserSignup({
      userId: user.id,
      email: user.email,
      name: user.name,
      method: 'password',
    }).catch((err) => console.error('[signup] notify failed:', err));

    const welcome = welcomeEmail(user.name);
    void sendUserEmail({ to: user.email, ...welcome }).catch((err) =>
      console.error('[signup] welcome email failed:', err),
    );

    const tokens = await this.generateTokens(user.id);
    return { user, ...tokens };
  }

  static async login(email: string, password: string, ip?: string): Promise<AuthResult> {
    const emailNorm = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user || !user.passwordHash) {
      await SecurityService.log({
        type: 'FAILED_LOGIN',
        severity: 'LOW',
        email: emailNorm,
        ip,
        details: 'Unknown email or no password',
      });
      throw new AppError('Invalid email or password', 401);
    }

    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      throw new AppError('Account temporarily locked due to failed sign-in attempts. Try again later.', 429);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await SecurityService.log({
        type: 'FAILED_LOGIN',
        severity: 'MEDIUM',
        userId: user.id,
        email: user.email,
        ip,
        details: 'Invalid password',
      });
      await SecurityService.maybeLockLogin(user.id, user.email, ip);
      throw new AppError('Invalid email or password', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { loginLockedUntil: null },
    });

    if (user.mfaEnabled) {
      const mfaChallenge = await MfaService.createChallenge(user.id);
      return { mfaRequired: true, mfaChallenge };
    }

    const tokens = await this.generateTokens(user.id);
    const { passwordHash: _, mfaSecret: __, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  static async googleAuth(googleId: string, email: string, name: string, photo?: string, ip?: string): Promise<AuthResult> {
    const emailNorm = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { googleId } });
    let createdNewUser = false;

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: emailNorm } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, photo: photo || user.photo },
        });
      } else {
        user = await prisma.user.create({
          data: { email: emailNorm, name, googleId, photo },
        });
        createdNewUser = true;
      }
    }

    if (createdNewUser) {
      void notifyNewUserSignup({
        userId: user.id,
        email: user.email,
        name: user.name,
        method: 'google',
      }).catch((err) => console.error('[signup] notify failed:', err));

      const welcome = welcomeEmail(user.name);
      void sendUserEmail({ to: user.email, ...welcome }).catch((err) =>
        console.error('[signup] welcome email failed:', err),
      );
    }

    if (user.mfaEnabled) {
      const mfaChallenge = await MfaService.createChallenge(user.id);
      return { mfaRequired: true, mfaChallenge };
    }

    const tokens = await this.generateTokens(user.id);
    const { passwordHash: _, mfaSecret: __, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  static async completeMfaLogin(challenge: string, code: string, ip?: string) {
    const { userId } = await MfaService.verifyChallenge(challenge, code, ip);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, phone: true, photo: true, mfaEnabled: true, createdAt: true,
      },
    });
    if (!user) throw new AppError('User not found', 404);
    const tokens = await this.generateTokens(userId);
    return { user, ...tokens };
  }

  static async revokeRefreshToken(token: string | undefined) {
    if (!token) return;

    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      select: { userId: true },
    });
    if (!stored) return;

    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: stored.userId } }),
      prisma.user.update({
        where: { id: stored.userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
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

    if (
      stored.token.startsWith('pwdotp_') ||
      stored.token.startsWith('reset_') ||
      stored.token.startsWith('mfachal_')
    ) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
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
        id: true,
        email: true,
        name: true,
        phone: true,
        photo: true,
        mfaEnabled: true,
        createdAt: true,
        farmMemberships: {
          include: { farm: { select: { id: true, name: true, country: true } } },
        },
      },
    });
    if (!user) throw new AppError('User not found', 404);
    return { ...user, isPlatformAdmin: isPlatformAdminEmail(user.email) };
  }

  static async updateProfile(
    userId: string,
    data: { name?: string; phone?: string | null; photo?: string | null },
  ) {
    const updateData: {
      name?: string;
      phone?: string | null;
      phoneNormalized?: string | null;
      photo?: string | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.photo !== undefined) updateData.photo = data.photo;

    if (data.phone !== undefined) {
      if (data.phone === null || data.phone.trim() === '') {
        updateData.phone = null;
        updateData.phoneNormalized = null;
      } else {
        const phoneNormalized = normalizePhone(data.phone);
        if (!phoneNormalized) {
          throw new AppError('Enter a valid phone number (8–15 digits)', 400);
        }
        const clash = await prisma.user.findFirst({
          where: { phoneNormalized, id: { not: userId } },
        });
        if (clash) throw new AppError('Phone number already in use', 400);
        updateData.phone = data.phone.trim();
        updateData.phoneNormalized = phoneNormalized;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, phone: true, photo: true, mfaEnabled: true, createdAt: true },
    });
    return user;
  }

  static async forgotPassword(params: { email?: string; phone?: string }, ip?: string) {
    let user: {
      id: string;
      email: string;
      phone: string | null;
      passwordHash: string | null;
      passwordResetLockedUntil: Date | null;
    } | null = null;
    let smsDigits: string | null = null;

    if (params.email) {
      const emailNorm = params.email.trim().toLowerCase();
      user = await prisma.user.findUnique({
        where: { email: emailNorm },
        select: { id: true, email: true, phone: true, passwordHash: true, passwordResetLockedUntil: true },
      });
    } else if (params.phone) {
      const pn = normalizePhone(params.phone);
      if (!pn) return;
      smsDigits = pn;
      user = await prisma.user.findUnique({
        where: { phoneNormalized: pn },
        select: { id: true, email: true, phone: true, passwordHash: true, passwordResetLockedUntil: true },
      });
    }

    if (!user?.passwordHash) return;

    if (user.passwordResetLockedUntil && user.passwordResetLockedUntil > new Date()) {
      await SecurityService.log({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        userId: user.id,
        email: user.email,
        ip,
        details: 'Password reset requested while account reset is locked',
      });
      return;
    }

    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ token: { startsWith: 'pwdotp_' } }, { token: { startsWith: 'reset_' } }],
      },
    });

    const code = generateResetCode();
    const otpHash = await bcrypt.hash(code, 10);

    await prisma.refreshToken.create({
      data: {
        token: `pwdotp_${otpHash}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_CODE_EXPIRY_MS),
      },
    });

    let delivered = false;
    if (params.email) {
      delivered = await sendPasswordResetCodeEmail(user.email, code);
    } else if (smsDigits) {
      delivered = await sendPasswordResetCodeSms(smsDigits, code);
      if (!delivered && user.email) {
        console.warn('[forgot-password] SMS delivery failed — falling back to email');
        delivered = await sendPasswordResetCodeEmail(user.email, code);
      }
    }

    if (!delivered) {
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id, token: { startsWith: 'pwdotp_' } },
      });
      console.error('[forgot-password] code delivery failed for user', user.id);
    }
  }

  static async resetPassword(params: {
    code: string;
    password: string;
    email?: string;
    phone?: string;
    ip?: string;
  }) {
    const digits = params.code.replace(/\D/g, '');
    if (digits.length !== RESET_CODE_LENGTH) {
      throw new AppError(`Enter the ${RESET_CODE_LENGTH}-digit code`, 400);
    }

    let user: { id: string; email: string; passwordResetLockedUntil: Date | null } | null = null;
    if (params.email) {
      user = await prisma.user.findUnique({
        where: { email: params.email.trim().toLowerCase() },
        select: { id: true, email: true, passwordResetLockedUntil: true },
      });
    } else if (params.phone) {
      const phoneNormalized = normalizePhone(params.phone);
      if (!phoneNormalized) throw new AppError('Invalid phone', 400);
      user = await prisma.user.findUnique({
        where: { phoneNormalized },
        select: { id: true, email: true, passwordResetLockedUntil: true },
      });
    } else {
      throw new AppError('Provide email or phone used when requesting the code', 400);
    }

    if (!user) throw new AppError('Invalid or expired code', 400);

    if (user.passwordResetLockedUntil && user.passwordResetLockedUntil > new Date()) {
      throw new AppError('Too many failed reset attempts. Try again in an hour.', 429);
    }

    const records = await prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        token: { startsWith: 'pwdotp_' },
        expiresAt: { gt: new Date() },
      },
    });

    let matchedRecord: (typeof records)[0] | null = null;
    for (const record of records) {
      const hash = record.token.replace('pwdotp_', '');
      const valid = await bcrypt.compare(digits, hash);
      if (valid) {
        matchedRecord = record;
        break;
      }
    }

    if (!matchedRecord) {
      await SecurityService.log({
        type: 'FAILED_PASSWORD_RESET',
        severity: 'MEDIUM',
        userId: user.id,
        email: user.email,
        ip: params.ip,
        details: 'Invalid reset code',
      });
      await SecurityService.maybeLockPasswordReset(user.id, user.email, params.ip);
      throw new AppError('Invalid or expired code', 400);
    }

    const passwordHash = await bcrypt.hash(params.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetLockedUntil: null },
    });

    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  private static async generateTokens(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    const tv = user?.tokenVersion ?? 0;

    const accessToken = jwt.sign({ userId, tv }, env.JWT_SECRET, {
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
