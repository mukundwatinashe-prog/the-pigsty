# Go-live environment checklist

Set these on **Vercel → the-pigsty-ctcf** (backend). Redeploy after changes.

| Variable | Production value |
|----------|------------------|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Strong random strings |
| `FRONTEND_URL` | `https://the-pigsty.org` |
| `CORS_ORIGIN` | `https://the-pigsty.org,https://www.the-pigsty.org` |
| `CONTACT_INBOX_EMAIL` | `pigfarm@the-pigsty.org` |
| `CLOUDFLARE_EMAIL_WORKER_URL` | `https://pigsty-email-worker.<subdomain>.workers.dev` |
| `EMAIL_WORKER_TOKEN` | Same as Worker secret (rotate periodically) |
| `EMAIL_FROM` | `The Pigsty <noreply@the-pigsty.org>` |
| `STRIPE_SECRET_KEY` | Live key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks → signing secret |
| `STRIPE_PRICE_ID_GROWER` / `STRIPE_PRICE_ID_ENTERPRISE` | Live price IDs |
| `GOOGLE_CLIENT_ID` | OAuth Web client ID |

Set these on **Vercel → the-pigsty** (frontend). Redeploy after changes.

| Variable | Production value |
|----------|------------------|
| `VITE_API_BASE_URL` | `https://api.the-pigsty.org/api` |
| `VITE_SUPPORT_EMAIL` | `pigfarm@the-pigsty.org` |
| `VITE_GOOGLE_CLIENT_ID` | Same as backend `GOOGLE_CLIENT_ID` |

## Stripe webhook

1. Run `cd backend && node scripts/setup-stripe-webhook.mjs --list`
2. If missing: `node scripts/setup-stripe-webhook.mjs --create`
3. Copy signing secret to `STRIPE_WEBHOOK_SECRET` on Vercel backend
4. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Complete one live test checkout and confirm farm plan updates

## Google OAuth (Google Cloud Console)

Authorized JavaScript origins:

- `https://the-pigsty.org`
- `https://www.the-pigsty.org`

Authorized redirect URIs (if using redirect flow): same origins.

## Email deliverability

- Resend: domain `the-pigsty.org` verified (SPF/DKIM)
- Cloudflare Email Routing: MX for `pigfarm@the-pigsty.org` inbox

## Verify

```bash
cd backend && node scripts/go-live-check.mjs
cd backend && node scripts/go-live-journey.mjs
```

## Secret rotation (after exposure)

1. `node scripts/rotate-email-worker-token.mjs`
2. `cd email-worker && npx wrangler secret put EMAIL_WORKER_TOKEN`
3. Update `EMAIL_WORKER_TOKEN` on Vercel backend and redeploy
4. Rotate Resend API key in Resend dashboard → update Worker `RESEND_API_KEY` secret

## One live payment (required before paid launch)

Complete Grower checkout with a real card, then confirm:

- Farm plan shows **GROWER** on Billing
- Financials and reports load (not 402)
- Upgrade email arrives
- Stripe Dashboard → Webhooks shows successful `checkout.session.completed` delivery
