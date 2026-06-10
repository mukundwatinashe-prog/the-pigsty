import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { getClientIp } from '../utils/requestIp';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many login attempts. Try again in 15 minutes.' },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many registration attempts. Try again later.' },
});

const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many Google sign-in attempts. Try again later.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many password reset requests. Try again later.' },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const body = req.body as { email?: string; phone?: string };
    const email = body?.email?.trim().toLowerCase();
    const phone = body?.phone?.trim();
    if (email) return `reset:${email}`;
    if (phone) return `reset:phone:${phone}`;
    return `reset:ip:${getClientIp(req) || 'unknown'}`;
  },
  message: { status: 'error', message: 'Too many password reset attempts. Try again later.' },
});

const mfaVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many MFA attempts. Try again later.' },
});

router.post('/register', registerLimiter, AuthController.register);
router.post('/login', loginLimiter, AuthController.login);
router.post('/google', googleLimiter, AuthController.googleAuth);
router.post('/mfa/verify', mfaVerifyLimiter, AuthController.verifyMfa);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', forgotPasswordLimiter, AuthController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, AuthController.resetPassword);
router.get('/me', authenticate, AuthController.me);
router.patch('/profile', authenticate, AuthController.updateProfile);
router.post('/mfa/setup', authenticate, AuthController.mfaSetup);
router.post('/mfa/enable', authenticate, AuthController.mfaEnable);
router.post('/mfa/disable', authenticate, AuthController.mfaDisable);

export default router;
