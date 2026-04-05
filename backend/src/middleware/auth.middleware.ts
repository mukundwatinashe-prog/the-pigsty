import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error.middleware';
import { COOKIE_ACCESS } from '../utils/auth.cookies';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const fromCookie = req.cookies?.[COOKIE_ACCESS] as string | undefined;
  const authHeader = req.headers.authorization;
  const fromBearer =
    authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const token = fromCookie || fromBearer;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};
