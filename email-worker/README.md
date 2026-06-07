# Pigsty email Worker

A small Cloudflare Worker that the backend uses to send transactional email
(welcome, plan upgrade, team invitations). It authenticates requests with a
shared bearer token and relays the message to [Resend](https://resend.com).

```
backend  --POST { to, subject, html, text } + Bearer token-->  this Worker  --Resend API-->  inbox
```

## Why a Worker?

Cloudflare has no native outbound transactional email API for arbitrary
recipients, so the Worker calls Resend behind the scenes. Keeping the Resend
key inside the Worker means the application backend only needs the Worker URL
and the shared token.

## Configure

You need a Resend account, a verified sending domain (e.g. `the-pigsty.org`),
and the DNS records Resend provides (SPF/DKIM).

1. Install deps and log in:

   ```bash
   cd email-worker
   npm install
   npx wrangler login
   ```

2. Set the `EMAIL_FROM` var in `wrangler.toml` to a verified sender address.

3. Set secrets (these are never committed):

   ```bash
   npx wrangler secret put RESEND_API_KEY      # re_...
   npx wrangler secret put EMAIL_WORKER_TOKEN  # long random string
   ```

   Use the same `EMAIL_WORKER_TOKEN` value in the backend env.

4. Deploy:

   ```bash
   npm run deploy
   ```

   Wrangler prints the Worker URL (e.g. `https://pigsty-email-worker.<subdomain>.workers.dev`).
   Put that into the backend env as `CLOUDFLARE_EMAIL_WORKER_URL`.

## Backend env (in `backend/.env`)

```
CLOUDFLARE_EMAIL_WORKER_URL=https://pigsty-email-worker.<subdomain>.workers.dev
EMAIL_WORKER_TOKEN=<same value as the Worker secret>
EMAIL_FROM=The Pigsty <noreply@the-pigsty.org>
```

If `CLOUDFLARE_EMAIL_WORKER_URL` is unset, the backend logs emails to the
console instead of sending them (handy for local development).

## Local test

```bash
npm run dev
# then, in another shell:
curl -X POST http://localhost:8787 \
  -H "Authorization: Bearer <EMAIL_WORKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"to":"you@example.com","subject":"Test","text":"Hello from the Worker"}'
```
