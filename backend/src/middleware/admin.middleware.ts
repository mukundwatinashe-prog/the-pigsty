import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { AppError } from './error.middleware';
import { isPlatformAdminEmail } from '../services/security.service';

export const requirePlatformAdmin = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { email: true },
    });
    if (!user || !isPlatformAdminEmail(user.email)) {
      return next(new AppError('Platform admin access required', 403));
    }
    next();
  } catch (error) {
    next(error);
  }
};
