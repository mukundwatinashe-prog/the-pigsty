import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { strongPasswordSchema } from '../validation/password';
import { setAuthCookies, clearAuthCookies, COOKIE_REFRESH } from '../utils/auth.cookies';
import { verifyGoogleIdToken } from '../utils/googleVerify';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(8).max(24),
  password: strongPasswordSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

const profileUpdateSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    phone: z.union([z.string().max(40), z.literal('')]).optional(),
    photo: z.union([z.string().max(2000), z.literal('')]).optional(),
  })
  .strict();

const forgotSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(8).max(24).optional(),
  })
  .superRefine((d, ctx) => {
    const e = (d.email ?? '').trim();
    const p = (d.phone ?? '').trim();
    const hasE = e.length > 0;
    const hasP = p.length > 0;
    if (hasE === hasP) {
      ctx.addIssue({
        code: 'custom',
        message: 'Send either your email or your phone number (not both)',
        path: ['email'],
      });
    }
  });

const resetSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(8).max(24).optional(),
    code: z.string().min(6).max(12),
    password: strongPasswordSchema,
  })
  .superRefine((d, ctx) => {
    const e = (d.email ?? '').trim();
    const p = (d.phone ?? '').trim();
    const hasE = e.length > 0;
    const hasP = p.length > 0;
    if (hasE === hasP) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide the same email or phone you used to request the code (not both)',
        path: ['email'],
      });
    }
  });

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, password } = registerSchema.parse(req.body);
      const result = await AuthService.register(name, email, password, phone);
      setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
      res.status(201).json({ user: result.user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await AuthService.login(email, password);
      setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
      res.json({ user: result.user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async googleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = googleAuthSchema.parse(req.body);
      const profile = await verifyGoogleIdToken(idToken);
      const result = await AuthService.googleAuth(
        profile.googleId,
        profile.email,
        profile.name,
        profile.photo,
      );
      setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
      res.json({ user: result.user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.[COOKIE_REFRESH] as string | undefined;
      if (!refreshToken) throw new AppError('Refresh token required', 400);
      const tokens = await AuthService.refreshToken(refreshToken);
      setAuthCookies(res, tokens);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.[COOKIE_REFRESH] as string | undefined;
      await AuthService.revokeRefreshToken(refreshToken);
      clearAuthCookies(res);
      res.json({ message: 'Logged out' });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getProfile(req.userId!);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = profileUpdateSchema.parse(req.body);
      const data: { name?: string; phone?: string | null; photo?: string | null } = {};
      if (parsed.name !== undefined) data.name = parsed.name;
      if (parsed.phone !== undefined) data.phone = parsed.phone === '' ? null : parsed.phone;
      if (parsed.photo !== undefined) data.photo = parsed.photo === '' ? null : parsed.photo;
      if (Object.keys(data).length === 0) {
        return next(new AppError('No valid fields to update', 400));
      }
      const user = await AuthService.updateProfile(req.userId!, data);
      res.json({ user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = forgotSchema.parse(req.body);
      const email = parsed.email?.trim() ? parsed.email.trim().toLowerCase() : undefined;
      const phone = parsed.phone?.trim() ? parsed.phone.trim() : undefined;
      await AuthService.forgotPassword(email ? { email } : { phone: phone! });
      res.json({
        message:
          'If an account exists with that email or phone, we sent a 6-digit code (email or SMS). It expires in 15 minutes.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = resetSchema.parse(req.body);
      const email = parsed.email?.trim() ? parsed.email.trim().toLowerCase() : undefined;
      const phone = parsed.phone?.trim() ? parsed.phone.trim() : undefined;
      await AuthService.resetPassword({
        code: parsed.code,
        password: parsed.password,
        email,
        phone,
      });
      res.json({ message: 'Password reset successfully. You can sign in with your new password.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }
}
