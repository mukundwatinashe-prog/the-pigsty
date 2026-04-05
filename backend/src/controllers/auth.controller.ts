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

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: strongPasswordSchema,
});

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = registerSchema.parse(req.body);
      const result = await AuthService.register(name, email, password);
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
      const { email } = forgotSchema.parse(req.body);
      await AuthService.forgotPassword(email);
      res.json({ message: 'If that email exists, a reset link has been sent' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = resetSchema.parse(req.body);
      await AuthService.resetPassword(token, password);
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }
}
