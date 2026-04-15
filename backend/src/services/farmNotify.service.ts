import prisma from '../config/database';

type FarmNotificationRecipient = {
  email: string;
  name: string;
  role: 'OWNER' | 'FARM_MANAGER';
};

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

async function sendMail(to: string[], subject: string, text: string, logTag: string): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info(`[${logTag}] SMTP_HOST not set — recipients=${to.join(', ')}`, text.replace(/\n/g, ' | '));
    return;
  }

  const from = process.env.SMTP_FROM?.trim();
  if (!from) {
    console.warn(`[${logTag}] SMTP_FROM is not set — skipping email send.`);
    return;
  }

  try {
    const nodemailer = await import('nodemailer');
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({
      from,
      to: to.join(', '),
      subject,
      text,
    });
  } catch (e) {
    console.error(`[${logTag}] Failed to send farm email:`, e);
  }
}

export async function notifyFarmLeads(opts: {
  farmId: string;
  subject: string;
  text: string;
  logTag: string;
}): Promise<void> {
  const recipients = await farmRecipientsForAlerts(opts.farmId);
  if (!recipients.length) return;
  await sendMail(
    recipients.map((r) => r.email),
    opts.subject,
    opts.text,
    opts.logTag,
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
