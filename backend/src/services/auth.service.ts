import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { normalizePhone } from '../lib/phone';
import { notifyNewUserSignup } from './signupNotify.service';
import { sendPasswordResetCodeEmail, sendPasswordResetCodeSms } from './passwordResetDelivery.service';

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
      select: { id: true, email: true, name: true, phone: true, photo: true, createdAt: true },
    });

    void notifyNewUserSignup({
      userId: user.id,
      email: user.email,
      name: user.name,
      method: 'password',
    }).catch((err) => console.error('[signup] notify failed:', err));

    const tokens = await this.generateTokens(user.id);
    return { user, ...tokens };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.passwordHash) throw new AppError('Invalid email or password', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const tokens = await this.generateTokens(user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  static async googleAuth(googleId: string, email: string, name: string, photo?: string) {
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

    if (stored.token.startsWith('pwdotp_') || stored.token.startsWith('reset_')) {
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
    return user;
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
      select: { id: true, email: true, name: true, phone: true, photo: true, createdAt: true },
    });
    return user;
  }

  /** Request 6-digit code via email or SMS (never reveals whether account exists). */
  static async forgotPassword(params: { email?: string; phone?: string }) {
    let user: { id: string; email: string; phone: string | null; passwordHash: string | null } | null = null;
    let smsDigits: string | null = null;

    if (params.email) {
      user = await prisma.user.findUnique({
        where: { email: params.email.trim().toLowerCase() },
        select: { id: true, email: true, phone: true, passwordHash: true },
      });
    } else if (params.phone) {
      const pn = normalizePhone(params.phone);
      if (!pn) return;
      smsDigits = pn;
      user = await prisma.user.findUnique({
        where: { phoneNormalized: pn },
        select: { id: true, email: true, phone: true, passwordHash: true },
      });
    }

    if (!user?.passwordHash) return;

    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ token: { startsWith: 'pwdotp_' } }, { token: { startsWith: 'reset_' } }],
      },
    });

    const code = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(code, 10);

    await prisma.refreshToken.create({
      data: {
        token: `pwdotp_${otpHash}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    if (params.email) {
      void sendPasswordResetCodeEmail(user.email, code).catch((e) => console.error('[forgot-password] email:', e));
    } else if (smsDigits) {
      void sendPasswordResetCodeSms(smsDigits, code).catch((e) => console.error('[forgot-password] sms:', e));
    }
  }

  static async resetPassword(params: {
    code: string;
    password: string;
    email?: string;
    phone?: string;
  }) {
    const digits = params.code.replace(/\D/g, '');
    if (digits.length !== 6) throw new AppError('Enter the 6-digit code', 400);

    let user: { id: string } | null = null;
    if (params.email) {
      user = await prisma.user.findUnique({
        where: { email: params.email.trim().toLowerCase() },
        select: { id: true },
      });
    } else if (params.phone) {
      const phoneNormalized = normalizePhone(params.phone);
      if (!phoneNormalized) throw new AppError('Invalid phone', 400);
      user = await prisma.user.findUnique({
        where: { phoneNormalized },
        select: { id: true },
      });
    } else {
      throw new AppError('Provide email or phone used when requesting the code', 400);
    }

    if (!user) throw new AppError('Invalid or expired code', 400);

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

    if (!matchedRecord) throw new AppError('Invalid or expired code', 400);

    const passwordHash = await bcrypt.hash(params.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
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
