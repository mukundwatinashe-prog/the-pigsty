import { Response, NextFunction } from 'express';
import { FarmPlan } from '@prisma/client';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { AppError } from './error.middleware';

/**
 * Gate the AI assistant behind the first paid wall: the user must belong to at
 * least one active (non-deleted) farm on a paid plan (Grower or Enterprise).
 * Returns 402 otherwise, matching the app's plan-gating convention.
 */
export const requireAiAccess = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    if (!req.userId) return next(new AppError('Authentication required', 401));

    const paidMembership = await prisma.farmMember.findFirst({
      where: {
        userId: req.userId,
        farm: { isDeleted: false, plan: { not: FarmPlan.FREE } },
      },
      select: { id: true },
    });

    if (!paidMembership) {
      return next(
        new AppError('The AI assistant is available on the Grower and Enterprise plans.', 402),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};
