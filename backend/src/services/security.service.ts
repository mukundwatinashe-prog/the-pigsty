import { SecurityEventType, SecuritySeverity } from '@prisma/client';
import prisma from '../config/database';
import { env } from '../config/env';
import { sendUserEmail } from './email/emailSender';

export type SecurityLogInput = {
  type: SecurityEventType;
  severity: SecuritySeverity;
  ip?: string;
  userId?: string;
  email?: string;
  path?: string;
  details?: string;
};

const ALERT_SEVERITIES: SecuritySeverity[] = ['HIGH', 'CRITICAL'];

const LOCKOUT_WINDOW_MS = 30 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000;

function adminEmails(): string[] {
  return env.PLATFORM_ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isPlatformAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

export class SecurityService {
  static async log(input: SecurityLogInput): Promise<void> {
    const event = await prisma.securityEvent.create({
      data: {
        type: input.type,
        severity: input.severity,
        ip: input.ip,
        userId: input.userId,
        email: input.email?.trim().toLowerCase(),
        path: input.path,
        details: input.details,
      },
    });

    if (ALERT_SEVERITIES.includes(input.severity)) {
      void this.notifyAdmins(event.id, input).catch((e) =>
        console.error('[security] admin alert failed:', e),
      );
    }
  }

  private static async notifyAdmins(eventId: string, input: SecurityLogInput): Promise<void> {
    const recipients = adminEmails();
    if (!recipients.length) return;

    const subject = `[The Pigsty SECURITY ${input.severity}] ${input.type.replace(/_/g, ' ')}`;
    const text = [
      'A security event was detected on The Pigsty API.',
      '',
      `Event ID: ${eventId}`,
      `Type: ${input.type}`,
      `Severity: ${input.severity}`,
      `Time (UTC): ${new Date().toISOString()}`,
      input.email ? `Email: ${input.email}` : '',
      input.ip ? `IP: ${input.ip}` : '',
      input.path ? `Path: ${input.path}` : '',
      input.details ? `Details: ${input.details}` : '',
      '',
      'Review unacknowledged events in the Security dashboard (/security) or via GET /api/security/events.',
    ]
      .filter(Boolean)
      .join('\n');

    for (const to of recipients) {
      void sendUserEmail({ to, subject, text, html: `<pre>${text.replace(/</g, '&lt;')}</pre>` }).catch((e) =>
        console.error('[security] email to', to, e),
      );
    }
  }

  static async countRecentEvents(
    type: SecurityEventType,
    filter: { email?: string; userId?: string; ip?: string },
    windowMs = LOCKOUT_WINDOW_MS,
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    return prisma.securityEvent.count({
      where: {
        type,
        createdAt: { gte: since },
        ...(filter.email ? { email: filter.email.trim().toLowerCase() } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.ip ? { ip: filter.ip } : {}),
      },
    });
  }

  static async maybeLockLogin(userId: string, email: string, ip?: string): Promise<boolean> {
    const failures = await this.countRecentEvents('FAILED_LOGIN', { userId });
    if (failures < LOCKOUT_THRESHOLD) return false;

    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await prisma.user.update({
      where: { id: userId },
      data: { loginLockedUntil: lockedUntil },
    });

    await this.log({
      type: 'LOGIN_LOCKOUT',
      severity: 'HIGH',
      userId,
      email,
      ip,
      details: `${failures} failed login attempts in ${LOCKOUT_WINDOW_MS / 60000} minutes — locked until ${lockedUntil.toISOString()}`,
    });
    return true;
  }

  static async maybeLockPasswordReset(userId: string, email: string, ip?: string): Promise<boolean> {
    const failures = await this.countRecentEvents('FAILED_PASSWORD_RESET', { userId });
    if (failures < LOCKOUT_THRESHOLD) return false;

    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordResetLockedUntil: lockedUntil },
    });

    await this.log({
      type: 'PASSWORD_RESET_LOCKOUT',
      severity: 'HIGH',
      userId,
      email,
      ip,
      details: `${failures} failed reset attempts — locked until ${lockedUntil.toISOString()}`,
    });
    return true;
  }

  static async getThreatSummary(): Promise<{
    unacknowledgedHigh: number;
    unacknowledgedCritical: number;
    recent24h: number;
    latestThreats: {
      id: string;
      type: string;
      severity: string;
      email: string | null;
      ip: string | null;
      details: string | null;
      createdAt: Date;
      acknowledged: boolean;
    }[];
  }> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [unacknowledgedHigh, unacknowledgedCritical, recent24h, latestThreats] = await Promise.all([
      prisma.securityEvent.count({
        where: { acknowledged: false, severity: 'HIGH' },
      }),
      prisma.securityEvent.count({
        where: { acknowledged: false, severity: 'CRITICAL' },
      }),
      prisma.securityEvent.count({
        where: { createdAt: { gte: since24h }, severity: { in: ['HIGH', 'CRITICAL', 'MEDIUM'] } },
      }),
      prisma.securityEvent.findMany({
        where: { severity: { in: ['HIGH', 'CRITICAL', 'MEDIUM'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          severity: true,
          email: true,
          ip: true,
          details: true,
          createdAt: true,
          acknowledged: true,
        },
      }),
    ]);

    return { unacknowledgedHigh, unacknowledgedCritical, recent24h, latestThreats };
  }
}
