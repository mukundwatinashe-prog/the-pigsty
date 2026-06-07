/**
 * Plain, dependency-free HTML/text email templates for The Pigsty.
 * Kept intentionally simple (inline styles, no external assets) so they render
 * well across email clients.
 */

const BRAND = 'The Pigsty';
/** Public support inbox — shown in email footers and site contact UI. */
export const SUPPORT_EMAIL = 'pigfarm@the-pigsty.org';

function layout(opts: { heading: string; bodyHtml: string; cta?: { label: string; url: string } }): string {
  const button = opts.cta
    ? `<tr><td style="padding:24px 0 8px;">
         <a href="${opts.cta.url}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:15px;">${opts.cta.label}</a>
       </td></tr>`
    : '';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;">
          <tr><td style="font-size:20px;font-weight:700;color:#15803d;padding-bottom:16px;">${BRAND}</td></tr>
          <tr><td style="font-size:18px;font-weight:600;padding-bottom:12px;">${opts.heading}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:#374151;">${opts.bodyHtml}</td></tr>
          ${button}
          <tr><td style="padding-top:28px;border-top:1px solid #f3f4f6;margin-top:24px;font-size:12px;color:#9ca3af;">
            You're receiving this email from ${BRAND}. Questions? Email us at
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#15803d;">${SUPPORT_EMAIL}</a>.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function welcomeEmail(name: string): EmailTemplate {
  const firstName = name?.trim().split(/\s+/)[0] || 'there';
  const subject = `Welcome to ${BRAND}`;
  const bodyHtml = `
    <p>Hi ${firstName},</p>
    <p>Welcome to ${BRAND} — your account is ready. You can now set up your farm, add pigs and pens, log weights, and track feed and finances all in one place.</p>
    <p>If you ever need a hand, email us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
    <p>Happy farming,<br/>The ${BRAND} team</p>`;
  const text = [
    `Hi ${firstName},`,
    '',
    `Welcome to ${BRAND} — your account is ready. You can now set up your farm, add pigs and pens, log weights, and track feed and finances all in one place.`,
    '',
    `If you ever need a hand, email us at ${SUPPORT_EMAIL}.`,
    '',
    `Happy farming,`,
    `The ${BRAND} team`,
  ].join('\n');
  return { subject, html: layout({ heading: `Welcome aboard`, bodyHtml }), text };
}

export function passwordResetEmail(code: string, resetUrl: string): EmailTemplate {
  const subject = 'Your password reset code';
  const bodyHtml = `
    <p>You requested a password reset for ${BRAND}.</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;color:#15803d;margin:16px 0;">${code}</p>
    <p>Enter this code on the reset page. It expires in <strong>15 minutes</strong>.</p>
    <p>If you did not request this, you can ignore this email.</p>`;
  const text = [
    `You requested a password reset for ${BRAND}.`,
    '',
    `Your verification code is: ${code}`,
    '',
    'It expires in 15 minutes. If you did not request this, ignore this email.',
    '',
    `Reset page: ${resetUrl}`,
  ].join('\n');
  return {
    subject,
    html: layout({ heading: 'Reset your password', bodyHtml, cta: { label: 'Open reset page', url: resetUrl } }),
    text,
  };
}

export function contactInboxEmail(p: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string | null;
  source: string;
}): EmailTemplate {
  const subj = p.subject?.trim() || 'Contact';
  const subject = `[The Pigsty] ${subj} — ${p.firstName} ${p.lastName}`;
  const bodyHtml = `
    <p><strong>Name:</strong> ${p.firstName} ${p.lastName}</p>
    <p><strong>Email:</strong> <a href="mailto:${p.email}">${p.email}</a></p>
    ${p.phone ? `<p><strong>Phone:</strong> ${p.phone}</p>` : ''}
    <p><strong>Source:</strong> ${p.source}</p>
    ${p.subject ? `<p><strong>Subject:</strong> ${p.subject}</p>` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
    <p style="white-space:pre-wrap;">${(p.message || '(no message)').replace(/</g, '&lt;')}</p>`;
  const text = [
    'New message from The Pigsty contact form',
    '',
    `Name: ${p.firstName} ${p.lastName}`,
    `Email: ${p.email}`,
    p.phone ? `Phone: ${p.phone}` : null,
    `Source: ${p.source}`,
    p.subject ? `Subject: ${p.subject}` : null,
    '',
    p.message || '(no message)',
  ]
    .filter(Boolean)
    .join('\n');
  return { subject, html: layout({ heading: 'New contact message', bodyHtml }), text };
}

export function upgradeEmail(name: string, planLabel: string): EmailTemplate {
  const firstName = name?.trim().split(/\s+/)[0] || 'there';
  const subject = `Your ${BRAND} plan is now ${planLabel}`;
  const bodyHtml = `
    <p>Hi ${firstName},</p>
    <p>Thanks for upgrading — your farm is now on the <strong>${planLabel}</strong> plan.</p>
    <p>You've unlocked more capacity plus team access: you can now invite managers and workers to your farm so everyone can collaborate.</p>
    <p>Head to <strong>Settings &rarr; Team members</strong> to send your first invite.</p>
    <p>Thanks for growing with us,<br/>The ${BRAND} team</p>`;
  const text = [
    `Hi ${firstName},`,
    '',
    `Thanks for upgrading — your farm is now on the ${planLabel} plan.`,
    '',
    `You've unlocked more capacity plus team access: you can now invite managers and workers to your farm so everyone can collaborate.`,
    '',
    'Head to Settings > Team members to send your first invite.',
    '',
    'Thanks for growing with us,',
    `The ${BRAND} team`,
  ].join('\n');
  return { subject, html: layout({ heading: `You're on ${planLabel}`, bodyHtml }), text };
}

function roleLabel(role: string): string {
  if (role === 'FARM_MANAGER') return 'Farm Manager';
  if (role === 'WORKER') return 'Worker';
  if (role === 'OWNER') return 'Owner';
  return role;
}

export function inviteEmail(opts: {
  farmName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}): EmailTemplate {
  const subject = `${opts.inviterName} invited you to join ${opts.farmName} on ${BRAND}`;
  const bodyHtml = `
    <p>Hi,</p>
    <p><strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.farmName}</strong> on ${BRAND} as a <strong>${roleLabel(opts.role)}</strong>.</p>
    <p>${BRAND} helps farms track pigs, pens, weights, feed, and finances together. Click below to accept — if you don't have an account yet, you'll be able to create one in a moment.</p>
    <p style="font-size:13px;color:#6b7280;">This invitation link expires in 7 days.</p>`;
  const text = [
    'Hi,',
    '',
    `${opts.inviterName} has invited you to join ${opts.farmName} on ${BRAND} as a ${roleLabel(opts.role)}.`,
    '',
    `${BRAND} helps farms track pigs, pens, weights, feed, and finances together.`,
    'Accept your invitation here (create an account if you don\'t have one yet):',
    opts.acceptUrl,
    '',
    'This invitation link expires in 7 days.',
  ].join('\n');
  return {
    subject,
    html: layout({ heading: `Join ${opts.farmName}`, bodyHtml, cta: { label: 'Accept invitation', url: opts.acceptUrl } }),
    text,
  };
}
