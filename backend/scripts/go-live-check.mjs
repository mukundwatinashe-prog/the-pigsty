/**
 * Verify production readiness: API health, billing webhook, email worker, contact form.
 * Usage: node scripts/go-live-check.mjs [--api https://api.the-pigsty.org/api]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
      }),
  );
}

const apiBase = (process.argv.find((a) => a.startsWith('--api='))?.slice(6) || 'https://api.the-pigsty.org/api').replace(
  /\/+$/,
  '',
);
const env = loadEnv();

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log(`Checking ${apiBase}\n`);

  try {
    const h = await fetch(`${apiBase}/health`);
    if (h.ok) pass('API health', await h.text());
    else fail('API health', String(h.status));
  } catch (e) {
    fail('API health', e.message);
  }

  try {
    const w = await fetch(`${apiBase}/billing/webhook`, { method: 'POST', body: '' });
    const t = await w.text();
    if (w.status === 503 && t.includes('Webhook not configured')) {
      fail('Stripe webhook secret on server', 'STRIPE_WEBHOOK_SECRET missing in production');
    } else if (w.status === 400) {
      pass('Stripe webhook endpoint', 'reachable (needs valid Stripe signature for events)');
    } else {
      pass('Stripe webhook endpoint', `status ${w.status}`);
    }
  } catch (e) {
    fail('Stripe webhook endpoint', e.message);
  }

  const workerUrl = env.CLOUDFLARE_EMAIL_WORKER_URL?.trim();
  const token = env.EMAIL_WORKER_TOKEN?.trim();
  if (workerUrl && token) {
    try {
      const r = await fetch(workerUrl, {
        method: 'POST',
        headers: { authorization: 'Bearer invalid', 'content-type': 'application/json' },
        body: '{}',
      });
      if (r.status === 401) pass('Email Worker auth', 'rejects bad token');
      else fail('Email Worker auth', `expected 401, got ${r.status}`);
    } catch (e) {
      fail('Email Worker reachability', e.message);
    }
  } else {
    fail('Email Worker local env', 'CLOUDFLARE_EMAIL_WORKER_URL or EMAIL_WORKER_TOKEN missing in backend/.env');
  }

  try {
    const c = await fetch(`${apiBase}/public/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'GoLive',
        lastName: 'Check',
        email: 'golive-check@mailinator.com',
        subject: 'Automated go-live check',
        message: `Sent at ${new Date().toISOString()}`,
        source: 'landing',
      }),
    });
    if (c.status === 201) pass('Contact form API', '201 created');
    else fail('Contact form API', `${c.status} ${(await c.text()).slice(0, 120)}`);
  } catch (e) {
    fail('Contact form API', e.message);
  }

  try {
    const g = await fetch(`${apiBase}/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid' }),
    });
    const body = await g.json();
    if (body.message?.includes('not configured')) fail('Google Sign-In', 'GOOGLE_CLIENT_ID missing on server');
    else pass('Google Sign-In', 'configured (token validation active)');
  } catch (e) {
    fail('Google Sign-In', e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
