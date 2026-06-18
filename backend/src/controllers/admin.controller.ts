import { Response, NextFunction } from 'express';
import { FarmPlan } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { AdminPlanFilter, AdminService } from '../services/admin.service';

const VALID_PLANS: AdminPlanFilter[] = ['ALL', FarmPlan.FREE, FarmPlan.GROWER, FarmPlan.ENTERPRISE];

function parsePlanFilter(raw: unknown): AdminPlanFilter {
  const value = String(raw || 'ALL').toUpperCase();
  if (VALID_PLANS.includes(value as AdminPlanFilter)) return value as AdminPlanFilter;
  return 'ALL';
}

export class AdminController {
  static async summary(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await AdminService.getSummary());
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '25'), 10) || 25));
      const plan = parsePlanFilter(req.query.plan);
      const search = String(req.query.search || '').trim() || undefined;

      res.json(await AdminService.listUsers({ page, pageSize, plan, search }));
    } catch (error) {
      next(error);
    }
  }

  static async listFarms(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '25'), 10) || 25));
      const plan = parsePlanFilter(req.query.plan);
      const search = String(req.query.search || '').trim() || undefined;

      res.json(await AdminService.listFarms({ page, pageSize, plan, search }));
    } catch (error) {
      next(error);
    }
  }

  static async getUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const user = await AdminService.getUser(userId);
      if (!user) return next(new AppError('User not found', 404));
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async unlockUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const user = await AdminService.getUser(userId);
      if (!user) return next(new AppError('User not found', 404));
      res.json(await AdminService.unlockUser(userId));
    } catch (error) {
      next(error);
    }
  }

  static async forceLogout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      if (userId === req.userId) return next(new AppError('Cannot force-logout your own account', 400));
      const user = await AdminService.getUser(userId);
      if (!user) return next(new AppError('User not found', 404));
      res.json(await AdminService.forceLogout(userId));
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const { name, phone } = req.body as { name?: string; phone?: string | null };
      if (name !== undefined && !name.trim()) return next(new AppError('Name cannot be empty', 400));
      const user = await AdminService.getUser(userId);
      if (!user) return next(new AppError('User not found', 404));
      res.json(await AdminService.updateUser(userId, { name, phone }));
    } catch (error) {
      next(error);
    }
  }

  static async resetGrowerTrial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const user = await AdminService.getUser(userId);
      if (!user) return next(new AppError('User not found', 404));
      res.json(await AdminService.resetGrowerTrial(userId));
    } catch (error) {
      next(error);
    }
  }

  static async setFarmPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const farmId = req.params.farmId as string;
      const plan = String(req.body?.plan || '').toUpperCase() as FarmPlan;
      if (!Object.values(FarmPlan).includes(plan)) {
        return next(new AppError('Invalid plan', 400));
      }
      res.json(await AdminService.setFarmPlan(farmId, plan));
    } catch (error) {
      next(error);
    }
  }

  static async exportUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plan = parsePlanFilter(req.query.plan);
      const search = String(req.query.search || '').trim() || undefined;
      const csv = await AdminService.exportUsersCsv({ plan, search });
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pigsty-users-${date}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const { confirmEmail } = req.body as { confirmEmail?: string };
      const user = await AdminService.getUser(userId);
      if (!user) return next(new AppError('User not found', 404));
      if (!confirmEmail || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
        return next(new AppError('Email confirmation does not match', 400));
      }
      const result = await AdminService.deleteUser(userId, req.userId!);
      if (!result) return next(new AppError('User not found', 404));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
