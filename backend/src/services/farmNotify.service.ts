import prisma from '../config/database';
import { sendUserEmail } from './email/emailSender';

type FarmNotificationRecipient = {
  email: string;
  name: string;
  role: 'OWNER' | 'FARM_MANAGER';
};

/** Escape text so it renders safely inside the HTML email body. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre style="font-family:inherit;white-space:pre-wrap;margin:0">${escaped}</pre>`;
}

async function farmRecipientsForAlerts(farmId: string): Promise<FarmNotificationRecipient[]> {
  const members = await prisma.farmMember.findMany({
    where: {
      farmId,
      role: { in: ['OWNER', 'FARM_MANAGER'] },
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  const recipients: FarmNotificationRecipient[] = [];
  for (const member of members) {
    const email = member.user.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({
      email,
      name: member.user.name,
      role: member.role as 'OWNER' | 'FARM_MANAGER',
    });
  }
  return recipients;
}

/**
 * Notify a farm's owners/managers about farm activity (pig/pen added, imports, …).
 *
 * Sends through the same provider path as every other transactional email
 * (`sendUserEmail` → Cloudflare Worker / Resend), so any future activity
 * notification added here uses the one configured, working email system.
 *
 * Opt-in per farm: only sends when `activityEmailNotifications` is enabled
 * (default off) — activity emails are noisy, so farms turn them on deliberately.
 */
export async function notifyFarmLeads(opts: {
  farmId: string;
  subject: string;
  text: string;
  logTag: string;
}): Promise<void> {
  const farm = await prisma.farm.findUnique({
    where: { id: opts.farmId },
    select: { activityEmailNotifications: true },
  });
  if (!farm?.activityEmailNotifications) return; // opt-in disabled — nothing to send

  const recipients = await farmRecipientsForAlerts(opts.farmId);
  if (!recipients.length) return;

  const html = textToHtml(opts.text);
  await Promise.all(
    recipients.map((r) =>
      sendUserEmail({ to: r.email, subject: opts.subject, text: opts.text, html }).catch((e) =>
        console.error(`[${opts.logTag}] Failed to send farm email to ${r.email}:`, e),
      ),
    ),
  );
}

export function formatBreakdown(map: Map<string, number>, label: string): string[] {
  if (map.size === 0) return [`${label}: none`];
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return [
    `${label}:`,
    ...sorted.map(([key, count]) => `- ${key}: ${count}`),
  ];
}
