#!/usr/bin/env bash
# On-box uptime watchdog: checks the API health endpoint and emails an alert (via
# Resend) when it fails, and once more when it recovers. Catches the common case
# of "box up, app down" (crash-loop, bad deploy, DB down). A box-wide outage still
# needs an EXTERNAL monitor (e.g. UptimeRobot on https://api.the-pigsty.org/api/health)
# since this cron can't run if the box is down.
#
# Cron (every 5 min):
#   */5 * * * * /opt/pigtrack-pro/deploy/healthcheck.sh >> /var/log/pigsty-health.log 2>&1
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
envval() { grep -m1 -E "^$1=" "$DIR/api.env" 2>/dev/null | cut -d= -f2- || true; }
KEY="$(envval RESEND_API_KEY)"
FROM="$(envval EMAIL_FROM)"; FROM="${FROM:-The Pigsty <noreply@the-pigsty.org>}"
TO="$(envval PLATFORM_ADMIN_EMAILS)"; TO="${TO%%,*}"   # first admin email
URL="https://api.the-pigsty.org/api/health"
STATE=/tmp/pigsty-health.down

send() { # subject, body — values are controlled (no quotes/newlines), so plain JSON is safe
  { [ -z "$KEY" ] || [ -z "$TO" ]; } && return 0
  curl -s -o /dev/null -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "$(printf '{"from":"%s","to":["%s"],"subject":"%s","text":"%s"}' "$FROM" "$TO" "$1" "$2")" || true
}

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL" || echo 000)

if [ "$code" = "200" ]; then
  if [ -f "$STATE" ]; then
    rm -f "$STATE"
    send "[The Pigsty] RECOVERED: API is healthy again" "api/health returned 200 at $(date -u)."
    echo "[health] $(date -u) recovered (200)"
  fi
  exit 0
fi

echo "[health] $(date -u) UNHEALTHY ($code)"
if [ ! -f "$STATE" ]; then   # alert once per outage, not every 5 min
  echo "$code" > "$STATE"
  send "[The Pigsty] ALERT: API health check failed ($code)" \
    "api.the-pigsty.org/api/health returned $code at $(date -u). SSH in and check: cd /opt/pigtrack-pro/deploy && docker compose ps && docker compose logs --tail 50 api"
fi
