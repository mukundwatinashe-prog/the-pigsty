import { deliverInboxEmail } from './contactNotify.service';

export async function notifyNewUserSignup(p: {
  userId: string;
  email: string;
  name: string;
  method: 'password' | 'google';
}): Promise<void> {
  const methodLabel = p.method === 'password' ? 'Email & password' : 'Google';
  const text = [
    'A new user signed up for The Pigsty.',
    '',
    `Name: ${p.name}`,
    `Email: ${p.email}`,
    `User ID: ${p.userId}`,
    `Sign-up method: ${methodLabel}`,
    `Time (UTC): ${new Date().toISOString()}`,
  ].join('\n');

  await deliverInboxEmail({
    subject: `[The Pigsty] New signup — ${p.email}`,
    text,
    logTag: 'signup',
  });
}
