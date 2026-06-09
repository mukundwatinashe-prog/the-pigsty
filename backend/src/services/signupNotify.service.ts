import { contactInboxAddress, notifyContactInbox, type ContactPayload } from './contactNotify.service';
import { sendUserEmail } from './email/emailSender';

export async function notifyNewUserSignup(p: {
  userId: string;
  email: string;
  name: string;
  method: 'password' | 'google';
}): Promise<void> {
  const methodLabel = p.method === 'password' ? 'Email & password' : 'Google';
  const subject = `[The Pigsty] New signup — ${p.email}`;
  const text = [
    'A new user signed up for The Pigsty.',
    '',
    `Name: ${p.name}`,
    `Email: ${p.email}`,
    `User ID: ${p.userId}`,
    `Sign-up method: ${methodLabel}`,
    `Time (UTC): ${new Date().toISOString()}`,
  ].join('\n');

  await sendUserEmail({
    to: contactInboxAddress(),
    subject,
    html: `<pre style="font-family:monospace;font-size:14px;">${text.replace(/</g, '&lt;')}</pre>`,
    text,
    replyTo: p.email,
  });
}
