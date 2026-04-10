import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { recordAndNotifyContact } from '../services/leadContact.service';

const authedBodySchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  email: z.string().email().trim(),
  phone: z.string().max(40).optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  farmId: z.string().uuid(),
});

export class ContactController {
  static async submitAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = authedBodySchema.parse(req.body);
      const member = await prisma.farmMember.findUnique({
        where: { userId_farmId: { userId: req.userId!, farmId: body.farmId } },
      });
      if (!member) return next(new AppError('Not a member of this farm', 403));

      await recordAndNotifyContact({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone?.trim() || null,
        subject: body.subject?.trim() || null,
        message: body.message?.trim() || null,
        source: 'settings',
        userId: req.userId!,
        farmId: body.farmId,
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }
}
