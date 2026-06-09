/**
 * One-off: send welcome + upgrade test emails via the Cloudflare email Worker.
 * Usage: node scripts/send-test-emails.mjs you@example.com
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);

const workerUrl = env.CLOUDFLARE_EMAIL_WORKER_URL?.trim();
const token = env.EMAIL_WORKER_TOKEN?.trim();
const to = process.argv[2]?.trim();

if (!to) {
  console.error('Usage: node scripts/send-test-emails.mjs <recipient>');
  process.exit(1);
}
if (!workerUrl || !token) {
  console.error('Missing CLOUDFLARE_EMAIL_WORKER_URL or EMAIL_WORKER_TOKEN in backend/.env');
  process.exit(1);
}

const SUPPORT = 'pigfarm@the-pigsty.org';
const BRAND = 'The Pigsty';

function layout(heading, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;">
<tr><td style="font-size:20px;font-weight:700;color:#15803d;padding-bottom:16px;">${BRAND}</td></tr>
<tr><td style="font-size:18px;font-weight:600;padding-bottom:12px;">${heading}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</td></tr>
<tr><td style="padding-top:28px;border-top:1px solid #f3f4f6;margin-top:24px;font-size:12px;color:#9ca3af;">Questions? Email us at <a href="mailto:${SUPPORT}" style="color:#15803d;">${SUPPORT}</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

const emails = [
  {
    label: 'welcome',
    subject: `Welcome to ${BRAND}`,
    html: layout(
      'Welcome aboard',
      `<p>Hi there,</p><p>Welcome to ${BRAND} — your account is ready. You can now set up your farm, add pigs and pens, log weights, and track feed and finances all in one place.</p><p>Happy farming,<br/>The ${BRAND} team</p>`,
    ),
    text: `Welcome to ${BRAND} — your account is ready.`,
  },
  {
    label: 'upgrade',
    subject: `Your ${BRAND} plan is now Grower`,
    html: layout(
      "You're on Grower",
      `<p>Hi there,</p><p>Thanks for upgrading — your farm is now on the <strong>Grower</strong> plan.</p><p>You've unlocked more capacity plus team access.</p><p>Thanks for growing with us,<br/>The ${BRAND} team</p>`,
    ),
    text: 'Thanks for upgrading — your farm is now on the Grower plan.',
  },
];

async function send(email) {
  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: SUPPORT,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${email.label} failed ${res.status}: ${body}`);
  return body;
}

for (const email of emails) {
  const result = await send(email);
  console.log(`${email.label}: ok`, result);
}
