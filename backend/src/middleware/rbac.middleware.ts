import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { AppError } from './error.middleware';
import prisma from '../config/database';

type Permission = 'pigs:read' | 'pigs:write' | 'pigs:delete' |
  'pens:read' | 'pens:write' | 'pens:delete' |
  'weights:read' | 'weights:write' |
  'reports:read' | 'reports:export' |
  'users:manage' | 'farm:settings' | 'farm:delete' |
  'audit:read' | 'import:write' |
  'feed:read' | 'feed:write';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    'pigs:read', 'pigs:write', 'pigs:delete',
    'pens:read', 'pens:write', 'pens:delete',
    'weights:read', 'weights:write',
    'reports:read', 'reports:export',
    'users:manage', 'farm:settings', 'farm:delete',
    'audit:read', 'import:write',
    'feed:read', 'feed:write',
  ],
  FARM_MANAGER: [
    'pigs:read', 'pigs:write', 'pigs:delete',
    'pens:read', 'pens:write', 'pens:delete',
    'weights:read', 'weights:write',
    'reports:read', 'reports:export',
    'users:manage', 'farm:settings',
    'audit:read', 'import:write',
    'feed:read', 'feed:write',
  ],
  WORKER: [
    'pigs:read', 'pigs:write',
    'pens:read',
    'weights:read', 'weights:write',
    'reports:read', 'reports:export',
    'audit:read', 'import:write',
    'feed:read', 'feed:write',
  ],
};

export interface FarmRequest extends AuthRequest {
  farmId?: string;
  memberRole?: string;
}

export const requireFarmAccess = (...permissions: Permission[]) => {
  return async (req: FarmRequest, _res: Response, next: NextFunction) => {
    try {
      const farmId = req.params.farmId || req.body.farmId;
      if (!farmId) return next(new AppError('Farm ID required', 400));

      const member = await prisma.farmMember.findUnique({
        where: { userId_farmId: { userId: req.userId!, farmId } },
      });
      if (!member) return next(new AppError('Not a member of this farm', 403));

      const rolePerms = ROLE_PERMISSIONS[member.role] || [];
      const hasAll = permissions.every(p => rolePerms.includes(p));
      if (!hasAll) return next(new AppError('Insufficient permissions', 403));

      req.farmId = farmId;
      req.memberRole = member.role;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const ASSIGNABLE_ROLES: Record<string, string[]> = {
  OWNER: ['FARM_MANAGER', 'WORKER'],
  FARM_MANAGER: ['WORKER'],
};
