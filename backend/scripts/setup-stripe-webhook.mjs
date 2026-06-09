/**
 * List or create the Stripe webhook for production billing.
 * Usage:
 *   node scripts/setup-stripe-webhook.mjs --list
 *   node scripts/setup-stripe-webhook.mjs --create
 *
 * Requires STRIPE_SECRET_KEY in backend/.env (live key for production).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
const WEBHOOK_URL = 'https://api.the-pigsty.org/api/billing/webhook';
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

function loadEnv() {
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

const env = loadEnv();
const key = env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error('STRIPE_SECRET_KEY missing in backend/.env');
  process.exit(1);
}

const stripe = new Stripe(key);
const listOnly = process.argv.includes('--list');
const create = process.argv.includes('--create');

const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
const existing = endpoints.data.find((e) => e.url === WEBHOOK_URL);

console.log('Webhook URL:', WEBHOOK_URL);
if (existing) {
  console.log('Found endpoint:', existing.id, 'status:', existing.status);
  console.log('Events:', existing.enabled_events.join(', '));
  console.log('\nSet on Vercel backend (the-pigsty-ctcf):');
  console.log('STRIPE_WEBHOOK_SECRET=whsec_...  (copy from Stripe Dashboard → Webhooks → signing secret)');
} else {
  console.log('No endpoint registered for this URL yet.');
}

if (listOnly) process.exit(0);

if (create) {
  if (existing) {
    console.log('Already exists — not creating duplicate.');
    process.exit(0);
  }
  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: EVENTS,
    description: 'The Pigsty production billing',
  });
  console.log('\nCreated:', created.id);
  console.log('Signing secret (save to Vercel STRIPE_WEBHOOK_SECRET):', created.secret);
  console.log('\nRedeploy backend after setting the secret.');
}

if (!listOnly && !create) {
  console.log('\nRun with --list or --create');
}
