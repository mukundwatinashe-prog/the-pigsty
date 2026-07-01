import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService, RESET_CODE_EXPIRY_SECONDS } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { strongPasswordSchema } from '../validation/password';
import { setAuthCookies, clearAuthCookies, COOKIE_REFRESH } from '../utils/auth.cookies';
import { verifyGoogleIdToken } from '../utils/googleVerify';
import { getClientIp } from '../utils/requestIp';
import { MfaService } from '../services/mfa.service';

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

const mfaVerifySchema = z.object({
  mfaChallenge: z.string().min(1),
  code: z.string().min(6).max(8),
});

const mfaEnableSchema = z.object({
  secret: z.string().min(16).max(64),
  code: z.string().min(6).max(8),
});

const mfaDisableSchema = z.object({
  code: z.string().min(6).max(8),
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
    code: z.string().min(8).max(12),
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

function sendAuthResult(
  req: Request,
  res: Response,
  result: Awaited<ReturnType<typeof AuthService.login>>,
) {
  if ('mfaRequired' in result) {
    res.json({ mfaRequired: true, mfaChallenge: result.mfaChallenge });
    return;
  }
  sendTokens(req, res, result, { user: result.user });
}

/**
 * Native apps (Capacitor) run on a `capacitor://localhost` origin where cross-site
 * httpOnly cookies to the API are unreliable, so they authenticate with Bearer
 * tokens. They opt in via `X-Client: mobile`; web clients keep the cookie-only
 * flow (tokens are never exposed to JS on the web).
 */
function isMobileClient(req: Request): boolean {
  return (req.get('x-client') || '').toLowerCase() === 'mobile';
}

/** Read a refresh token from the cookie, an `Authorization: Bearer` header, or the body. */
function extractRefreshToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[COOKIE_REFRESH] as string | undefined;
  const authHeader = req.headers.authorization;
  const fromBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const bodyToken = (req.body as { refreshToken?: unknown })?.refreshToken;
  const fromBody = typeof bodyToken === 'string' ? bodyToken : undefined;
  return fromCookie || fromBearer || fromBody;
}

/** Set auth cookies and, for mobile clients, also return the tokens in the JSON body. */
function sendTokens(
  req: Request,
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  body: Record<string, unknown>,
  status = 200,
) {
  setAuthCookies(res, tokens);
  const payload = isMobileClient(req)
    ? { ...body, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
    : body;
  res.status(status).json(payload);
}

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, password } = registerSchema.parse(req.body);
      const result = await AuthService.register(name, email, password, phone);
      sendTokens(req, res, result, { user: result.user }, 201);
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
      const result = await AuthService.login(email, password, getClientIp(req));
      sendAuthResult(req, res, result);
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
        getClientIp(req),
      );
      sendAuthResult(req, res, result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async verifyMfa(req: Request, res: Response, next: NextFunction) {
    try {
      const { mfaChallenge, code } = mfaVerifySchema.parse(req.body);
      const result = await AuthService.completeMfaLogin(mfaChallenge, code, getClientIp(req));
      sendTokens(req, res, result, { user: result.user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async mfaSetup(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { secret, otpauthUrl } = MfaService.generateSecret();
      res.json({ secret, otpauthUrl });
    } catch (error) {
      next(error);
    }
  }

  static async mfaEnable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { secret, code } = mfaEnableSchema.parse(req.body);
      await MfaService.enableMfa(req.userId!, secret, code, getClientIp(req));
      res.json({ mfaEnabled: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async mfaDisable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code } = mfaDisableSchema.parse(req.body);
      await MfaService.disableMfa(req.userId!, code, getClientIp(req));
      res.json({ mfaEnabled: false });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = extractRefreshToken(req);
      if (!refreshToken) throw new AppError('Refresh token required', 400);
      const tokens = await AuthService.refreshToken(refreshToken);
      sendTokens(req, res, tokens, { ok: true });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = extractRefreshToken(req);
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
      await AuthService.forgotPassword(email ? { email } : { phone: phone! }, getClientIp(req));
      res.json({
        message:
          'If an account exists with that email or phone, we sent an 8-digit code (email or SMS). It expires in 5 minutes.',
        sentAt: new Date().toISOString(),
        expiresInSeconds: RESET_CODE_EXPIRY_SECONDS,
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
        ip: getClientIp(req),
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
