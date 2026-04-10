import prisma from '../config/database';
import { notifyContactInbox, type ContactPayload } from './contactNotify.service';

export async function recordAndNotifyContact(row: ContactPayload): Promise<void> {
  await prisma.lead.create({
    data: {
      email: row.email.trim().toLowerCase(),
      firstName: row.firstName.trim() || null,
      lastName: row.lastName.trim() || null,
      phone: row.phone?.trim() || null,
      subject: row.subject?.trim() || null,
      message: row.message?.trim() || null,
      source: row.source,
      userId: row.userId,
      farmId: row.farmId,
    },
  });
  await notifyContactInbox(row);
}
