import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../config/database';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';
import { FarmRequest, ASSIGNABLE_ROLES } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';
import { FarmPlan, InvitationStatus, Role } from '@prisma/client';
import { allowsMultiUser, memberLimitForPlan } from '../config/planLimits';
import { sendUserEmail } from '../services/email/emailSender';
import { inviteEmail } from '../services/email/templates';

const INVITE_TTL_DAYS = 7;

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['FARM_MANAGER', 'WORKER']),
});

function acceptUrlFor(token: string): string {
  return `${env.FRONTEND_URL.replace(/\/+$/, '')}/invite/${token}`;
}

function seatLimitMessage(plan: FarmPlan): string {
  if (plan === FarmPlan.FREE) return 'Free plan supports only 1 user. Upgrade to Grower or Enterprise.';
  if (plan === FarmPlan.GROWER) return 'Grower plan supports up to 5 users. Upgrade to Enterprise for more seats.';
  return 'Seat limit reached for this plan.';
}

export class InvitationController {
  /** Create a link-based invitation and email it. The invitee does not need an account yet. */
  static async create(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { email, role } = inviteSchema.parse(req.body);
      const emailNorm = email.trim().toLowerCase();

      const assignable = ASSIGNABLE_ROLES[req.memberRole!] || [];
      if (!assignable.includes(role)) {
        return next(new AppError(`Cannot assign role ${role}`, 403));
      }

      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { name: true, plan: true, _count: { select: { members: true } } },
      });
      if (!farm) return next(new AppError('Farm not found', 404));

      if (!allowsMultiUser(farm.plan)) {
        return next(new AppError('Team management is available on Grower and Enterprise plans.', 402));
      }

      // Block inviting someone who already belongs to this farm.
      const existingUser = await prisma.user.findUnique({ where: { email: emailNorm } });
      if (existingUser) {
        const member = await prisma.farmMember.findUnique({
          where: { userId_farmId: { userId: existingUser.id, farmId: req.farmId! } },
        });
        if (member) return next(new AppError('That person is already a member of this farm.', 400));
      }

      // Seat check counts current members plus outstanding pending invitations.
      const pendingCount = await prisma.invitation.count({
        where: { farmId: req.farmId!, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
      });
      const limit = memberLimitForPlan(farm.plan);
      if (farm._count.members + pendingCount >= limit) {
        return next(new AppError(seatLimitMessage(farm.plan), 402));
      }

      // Replace any prior pending invite for this email on this farm.
      await prisma.invitation.updateMany({
        where: { farmId: req.farmId!, email: emailNorm, status: InvitationStatus.PENDING },
        data: { status: InvitationStatus.REVOKED },
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

      const invitation = await prisma.invitation.create({
        data: {
          farmId: req.farmId!,
          email: emailNorm,
          role: role as Role,
          token,
          invitedById: req.userId!,
          expiresAt,
        },
      });

      const inviter = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { name: true },
      });

      const url = acceptUrlFor(token);
      const tmpl = inviteEmail({
        farmName: farm.name,
        inviterName: inviter?.name || 'A farm owner',
        role,
        acceptUrl: url,
      });
      void sendUserEmail({ to: emailNorm, ...tmpl }).catch((err) =>
        console.error('[invite] email failed:', err),
      );

      await AuditService.log({
        userId: req.userId!,
        farmId: req.farmId!,
        action: 'INVITE',
        entity: 'Invitation',
        entityId: invitation.id,
        details: `Invited ${emailNorm} as ${role}`,
      });

      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        acceptUrl: url,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  /** List outstanding (pending, unexpired) invitations for a farm. */
  static async list(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const invitations = await prisma.invitation.findMany({
        where: { farmId: req.farmId!, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          invitedBy: { select: { id: true, name: true } },
        },
      });
      res.json(invitations);
    } catch (error) {
      next(error);
    }
  }

  /** Return accept URL for a single pending invitation (for copy-link; not exposed in list). */
  static async getAcceptUrl(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const invitationId = req.params.invitationId as string;
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        select: { farmId: true, token: true, status: true, expiresAt: true },
      });
      if (!invitation || invitation.farmId !== req.farmId!) {
        return next(new AppError('Invitation not found', 404));
      }
      if (invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) {
        return next(new AppError('Invitation is no longer valid', 410));
      }
      res.json({ acceptUrl: acceptUrlFor(invitation.token) });
    } catch (error) {
      next(error);
    }
  }

  /** Revoke a pending invitation. */
  static async revoke(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const invitationId = req.params.invitationId as string;
      const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation || invitation.farmId !== req.farmId!) {
        return next(new AppError('Invitation not found', 404));
      }
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED },
      });
      await AuditService.log({
        userId: req.userId!,
        farmId: req.farmId!,
        action: 'REVOKE',
        entity: 'Invitation',
        entityId: invitationId,
        details: `Revoked invite for ${invitation.email}`,
      });
      res.json({ message: 'Invitation revoked' });
    } catch (error) {
      next(error);
    }
  }

  /** Public: read invitation details for the accept page (no auth required). */
  static async getByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token as string;
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        select: {
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          farm: { select: { name: true } },
          invitedBy: { select: { name: true } },
        },
      });
      if (!invitation) return next(new AppError('Invitation not found', 404));

      const expired = invitation.expiresAt < new Date();
      const status =
        invitation.status === InvitationStatus.PENDING && expired ? 'EXPIRED' : invitation.status;

      res.json({
        email: invitation.email,
        role: invitation.role,
        status,
        farmName: invitation.farm.name,
        inviterName: invitation.invitedBy?.name || 'A farm owner',
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }

  /** Authenticated: accept an invitation and join the farm as a member child. */
  static async accept(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = req.params.token as string;
      const invitation = await prisma.invitation.findUnique({ where: { token } });
      if (!invitation) return next(new AppError('Invitation not found', 404));

      if (invitation.status !== InvitationStatus.PENDING) {
        return next(new AppError('This invitation is no longer valid.', 410));
      }
      if (invitation.expiresAt < new Date()) {
        return next(new AppError('This invitation has expired.', 410));
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, email: true },
      });
      if (!user) return next(new AppError('User not found', 404));

      if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
        return next(
          new AppError(
            `This invitation was sent to ${invitation.email}. Sign in (or register) with that email to accept it.`,
            403,
          ),
        );
      }

      const farm = await prisma.farm.findUnique({
        where: { id: invitation.farmId },
        select: { id: true, name: true, plan: true, isDeleted: true, _count: { select: { members: true } } },
      });
      if (!farm || farm.isDeleted) return next(new AppError('Farm not found', 404));

      if (!allowsMultiUser(farm.plan)) {
        return next(new AppError('This farm can no longer add team members on its current plan.', 402));
      }

      const alreadyMember = await prisma.farmMember.findUnique({
        where: { userId_farmId: { userId: user.id, farmId: farm.id } },
      });
      if (alreadyMember) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedByUserId: user.id, acceptedAt: new Date() },
        });
        return res.json({ farmId: farm.id, farmName: farm.name, role: alreadyMember.role, alreadyMember: true });
      }

      const limit = memberLimitForPlan(farm.plan);
      if (farm._count.members >= limit) {
        return next(new AppError(seatLimitMessage(farm.plan), 402));
      }

      const member = await prisma.farmMember.create({
        data: {
          userId: user.id,
          farmId: farm.id,
          role: invitation.role,
          invitedById: invitation.invitedById,
        },
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedByUserId: user.id, acceptedAt: new Date() },
      });

      await AuditService.log({
        userId: user.id,
        farmId: farm.id,
        action: 'JOIN',
        entity: 'FarmMember',
        entityId: member.id,
        details: `Accepted invite as ${invitation.role}`,
      });

      res.status(201).json({ farmId: farm.id, farmName: farm.name, role: member.role });
    } catch (error) {
      next(error);
    }
  }
}
