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

> ⚠️ **Break-glass first.** Before hardening SSH, make sure the server has a **root
> password set** (Hetzner Cloud → server → *Reset root password*) and save it. If
> sshd ever fails to start (e.g. a bad config after a reboot), the Hetzner web
> **Console** is the only way back in, and it needs that password. Servers created
> with only an SSH key have *no* console password until you set one.

**SSH — key-only, no passwords.** The box was taking ~6k/day password brute-force
attempts. Key auth is already used for deploys, so passwords can be turned off with
no downside. `sshd` is first-match-wins and reads `sshd_config.d/*.conf` before the
main file, so a `00-`-prefixed drop-in overrides both `50-cloud-init.conf`
(`PasswordAuthentication yes`) and the main config's `PermitRootLogin yes`.

Keep the drop-in **minimal** — only directives valid in the installed OpenSSH.
(OpenSSH 10 **removed** `ChallengeResponseAuthentication`; including it makes sshd
refuse to start.) `PasswordAuthentication no` already disables keyboard-interactive
password auth, so three lines suffice:
```bash
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'CONF'
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
CONF
chmod 600 /etc/ssh/sshd_config.d/00-hardening.conf
sync                                     # flush to disk — an unclean reboot can
                                         # otherwise leave the file half-written and
                                         # corrupt, and sshd won't start on boot
cat -A /etc/ssh/sshd_config.d/00-hardening.conf   # sanity: plain `$` line-ends, no ^M
sshd -t && systemctl restart ssh         # validate, then FULL restart (not reload —
                                         # only a restart proves it survives a boot)
sshd -T | grep -iE '^passwordauthentication|^permitrootlogin'   # confirm
```
Then, from **another terminal**, open a *fresh* connection to confirm key login
still works and password auth is refused (`Permission denied (publickey)`). Only
trust the change once a brand-new SSH session succeeds.

**fail2ban — auto-ban repeat offenders.** Use **standard** mode, not `aggressive`:
aggressive mode counts key-only auth probes as failures and once locked our own ops
IP out. The jail config is version-controlled at `deploy/fail2ban-sshd.local` and
re-applied on every deploy by `.github/workflows/deploy.yml` (which also clears
stale bans, so an operator or the CI runner can never stay locked out):
```bash
apt-get install -y fail2ban
install -m 644 /opt/pigtrack-pro/deploy/fail2ban-sshd.local /etc/fail2ban/jail.d/sshd.local
systemctl enable --now fail2ban
fail2ban-client status sshd        # shows currently-banned IPs
```

**If sshd is down and you're locked out** (all IPs get `connection refused` on
port 22 — not a per-IP ban): use the Hetzner **Console** (root + the break-glass
password), then:
```bash
sshd -t                            # prints the exact bad line, e.g. a corrupt drop-in
rm -f /etc/ssh/sshd_config.d/00-hardening.conf   # remove the offender
systemctl restart ssh && systemctl is-active ssh # -> active
```
Re-apply the hardening above once you're back in over SSH.

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
