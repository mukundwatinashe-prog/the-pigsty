import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { SecurityService } from '../services/security.service';

export class SecurityController {
  static async summary(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await SecurityService.getThreatSummary();
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async listEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 200);
      const events = await prisma.securityEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      res.json({ events });
    } catch (error) {
      next(error);
    }
  }

  static async acknowledge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const event = await prisma.securityEvent.findUnique({ where: { id } });
      if (!event) return next(new AppError('Event not found', 404));
      await prisma.securityEvent.update({
        where: { id },
        data: { acknowledged: true },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  static async acknowledgeAll(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.securityEvent.updateMany({
        where: { acknowledged: false, severity: { in: ['HIGH', 'CRITICAL'] } },
        data: { acknowledged: true },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}
