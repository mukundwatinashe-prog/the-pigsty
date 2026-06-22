import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import prisma from '../config/database';
import { runEnterpriseAutomationCron } from '../services/enterpriseAutomation.service';

export class CronController {
  /** Vercel Cron: daily Enterprise report emails + SMS alerts. */
  static async runEnterpriseAutomation(req: Request, res: Response, next: NextFunction) {
    try {
      const secret = env.CRON_SECRET.trim();
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!secret || token !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await prisma.$connect();
      const result = await runEnterpriseAutomationCron();
      res.json({ ok: true, ...result, timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  }
}
