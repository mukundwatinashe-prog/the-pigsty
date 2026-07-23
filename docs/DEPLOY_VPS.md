# VPS deployment (Hetzner)

The backend API and PostgreSQL run on a Hetzner VPS via Docker Compose, behind
Caddy (automatic HTTPS). The frontend stays on Vercel/CDN. Stripe, Resend/
Cloudflare email worker, R2, Twilio, and Turnstile are unchanged.

```
Internet ──▶ Caddy (:443, auto-TLS) ──▶ api (Node/Express :4000) ──▶ db (Postgres)
                                                   │
                                     nightly pg_dump ──▶ Cloudflare R2
```

## Files
- `backend/Dockerfile` — builds the API image (TypeScript + Prisma client), runs
  `prisma migrate deploy` on start, then `node dist/server.js`.
- `deploy/docker-compose.yml` — the `db` + `api` + `caddy` stack.
- `deploy/Caddyfile` — reverse proxy + TLS for `api.the-pigsty.org`.
- `deploy/api.env.example` — template for the app secrets (copy to `deploy/api.env`).
- `deploy/backup.sh` — nightly Postgres → R2 backup with retention.
- `.github/workflows/deploy.yml` — auto-deploy on `main` after CI passes.

`deploy/api.env` and `deploy/.env` are **gitignored** — they hold secrets and
live only on the server.

## First-time provisioning (on the VPS, as root)
```bash
apt-get update && apt-get -y upgrade
# Docker
curl -fsSL https://get.docker.com | sh
# Firewall
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
# AWS CLI (for R2 backups)
apt-get install -y awscli
# Clone the repo
mkdir -p /opt && git clone https://github.com/mukundwatinashe-prog/the-pigsty.git /opt/pigtrack-pro
```

## Security hardening (on the VPS, as root)
Applied to the live box on 2026-07-23. These live **only on the server** (not in
the repo), so re-apply them after any server rebuild.

**SSH — key-only, no passwords.** The box was taking ~6k/day password brute-force
attempts. Key auth is already used for deploys, so passwords can be turned off with
no downside. `sshd` is first-match-wins and reads `sshd_config.d/*.conf` before the
main file, so a `00-`-prefixed drop-in overrides both `50-cloud-init.conf`
(`PasswordAuthentication yes`) and the main config's `PermitRootLogin yes`:
```bash
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'CONF'
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
CONF
chmod 600 /etc/ssh/sshd_config.d/00-hardening.conf
sshd -t && systemctl reload ssh          # validate BEFORE reload — never skip
sshd -T | grep -iE '^passwordauthentication|^permitrootlogin'   # confirm
```
Before trusting it, verify from another terminal that a **fresh key login still
works** and that password auth is refused (`Permission denied (publickey)`).

**fail2ban — auto-ban repeat offenders:**
```bash
apt-get install -y fail2ban
cat > /etc/fail2ban/jail.d/sshd.local <<'CONF'
[sshd]
enabled  = true
mode     = aggressive
maxretry = 4
findtime = 10m
bantime  = 1h
CONF
systemctl enable --now fail2ban
fail2ban-client status sshd        # shows currently-banned IPs
```

Other posture already in place: `ufw` allows only OpenSSH/80/443; Postgres and the
API are container-internal (never host-published); Caddy adds TLS + HSTS; secrets
files are `chmod 600`; `unattended-upgrades` is active.

## Configure secrets (on the VPS)
```bash
cd /opt/pigtrack-pro/deploy
cp api.env.example api.env          # then fill every value (from the Vercel prod env)
printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
```
`DATABASE_URL` is intentionally NOT in `api.env` — compose points the app at the
local `db` container using `POSTGRES_PASSWORD`.

## Bring up the stack
```bash
cd /opt/pigtrack-pro/deploy
docker compose up -d --build
docker compose logs -f api          # watch migrations + startup
```

## Migrate data from Neon (one-off)
```bash
# From a machine with the Neon connection string (use the DIRECT, non-pooler host):
pg_dump "$NEON_DIRECT_URL" --no-owner --no-privileges -Fc -f pigtrack.dump
# Copy to the VPS and restore into the running container:
scp pigtrack.dump root@VPS:/tmp/
docker exec -i pigsty-db pg_restore -U pigsty -d pigtrack --clean --if-exists --no-owner < /tmp/pigtrack.dump
```
Verify row counts match, then the app is serving from the VPS DB.

## DNS cutover (Cloudflare)
Point `api.the-pigsty.org` → VPS IP:
- Type **A**, name **api**, value **<VPS_IP>**, **Proxy status: DNS only (grey cloud)**
  so Caddy can complete the Let's Encrypt HTTP-01 challenge and terminate TLS.
- After propagation, Caddy issues the cert automatically. Verify:
  `curl https://api.the-pigsty.org/api/health`
- Keep the Neon database for a few days as a fallback before decommissioning.

## Automated backups
Add a root cron entry (nightly at 02:00 UTC):
```
0 2 * * * /opt/pigtrack-pro/deploy/backup.sh >> /var/log/pigsty-backup.log 2>&1
```
Backups land in `s3://<R2_BUCKET>/db-backups/` (kept `BACKUP_RETAIN_DAYS`, default 14).

## CI/CD
`Deploy` workflow SSHes in after CI passes on `main` and runs
`docker compose up -d --build`. Required GitHub repo secrets:
- `VPS_HOST` — server IP
- `VPS_USER` — deploy user
- `VPS_SSH_KEY` — that user's private SSH key

## Common operations
```bash
docker compose ps                 # status
docker compose logs -f api        # logs
docker compose up -d --build      # deploy latest (also run by CI)
docker compose down               # stop (data persists in the pgdata volume)
docker exec -it pigsty-db psql -U pigsty -d pigtrack   # DB shell
```
