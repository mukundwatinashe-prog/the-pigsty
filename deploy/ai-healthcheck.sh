#!/usr/bin/env bash
# Daily AI-provider health check. Verifies the Claude API key + model still work
# and emails the admin (via Resend) on failure — so an expired key or exhausted
# credits is caught immediately instead of by a user hitting a broken chatbot.
# Alerts once per outage and once on recovery.
#
# Cron (daily 08:00 UTC):
#   0 8 * * * /opt/pigtrack-pro/deploy/ai-healthcheck.sh >> /var/log/pigsty-ai-health.log 2>&1
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
envval() { grep -m1 -E "^$1=" "$DIR/api.env" 2>/dev/null | cut -d= -f2- || true; }
KEY="$(envval CLAUDE_API_KEY)"
MODEL="$(envval CLAUDE_MODEL)"; MODEL="${MODEL:-claude-haiku-4-5}"
RKEY="$(envval RESEND_API_KEY)"
FROM="$(envval EMAIL_FROM)"; FROM="${FROM:-The Pigsty <noreply@the-pigsty.org>}"
TO="$(envval PLATFORM_ADMIN_EMAILS)"; TO="${TO%%,*}"
STATE=/tmp/pigsty-ai.down

send() { # subject, text (both must be free of double-quotes/newlines)
  { [ -z "$RKEY" ] || [ -z "$TO" ]; } && return 0
  curl -s -o /dev/null -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RKEY" -H "Content-Type: application/json" \
    -d "$(printf '{"from":"%s","to":["%s"],"subject":"%s","text":"%s"}' "$FROM" "$TO" "$1" "$2")" || true
}

resp=$(curl -s -w '\n%{http_code}' --max-time 30 https://api.anthropic.com/v1/messages \
  -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
  -d "{\"model\":\"$MODEL\",\"max_tokens\":5,\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}]}" || printf '\n000')
code=$(printf '%s' "$resp" | tail -1)
body=$(printf '%s' "$resp" | sed '$d')

if [ "$code" = "200" ]; then
  if [ -f "$STATE" ]; then
    rm -f "$STATE"
    send "[The Pigsty] Piglet AI is back online" "The Claude API check succeeded again at $(date -u)."
  fi
  echo "[ai-health] $(date -u) OK ($MODEL)"
  exit 0
fi

# Extract + sanitise the provider message for the alert (no quotes/newlines).
msg=$(printf '%s' "$body" | grep -oE '"message":"[^"]*"' | head -1 | sed 's/"message":"//; s/"$//' | tr '"\n' "' ")
echo "[ai-health] $(date -u) FAIL ($code): $msg"
if [ ! -f "$STATE" ]; then
  echo "$code" > "$STATE"
  send "[The Pigsty] ALERT: Piglet AI is down (Claude $code)" \
    "The Claude API health check failed at $(date -u). Reason: ${msg:-unknown}. This usually means the API key expired or credits ran out. Fix at platform.claude.com (top up / create a new key), then update CLAUDE_API_KEY in /opt/pigtrack-pro/deploy/api.env and recreate the api container."
fi
